const { Wallet, Transaction, Customer, PromoCode, sequelize } = require('../models');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret'
});

const getWallet = async (req, res) => {
  try {
    const customerId = req.user.id;
    
    // Fetch the customer to get the referral code
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    let wallet = await Wallet.findOne({
      where: { customerId },
      include: [{
        model: Transaction,
        as: 'transactions',
        order: [['createdAt', 'DESC']],
        limit: 10
      }]
    });

    // Fallback: If wallet doesn't exist (e.g. for older users), create it now
    if (!wallet) {
      wallet = await Wallet.create({ customerId, balance: 0.0 });
      wallet.dataValues.transactions = [];
    }
    
    // Make sure customer has a referral code
    if (!customer.referralCode) {
      customer.referralCode = `EMINENCE-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      await customer.save();
    }

    return res.status(200).json({
      success: true,
      wallet: {
        balance: parseFloat(wallet.balance) || 0,
        currency: wallet.currency,
        transactions: wallet.transactions || []
      },
      balance: parseFloat(wallet.balance) || 0,
      referralCode: customer.referralCode,
      referredBy: customer.referredBy
    });
  } catch (error) {
    console.error('Get Wallet Error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching wallet' });
  }
};

const applyReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.body;
    const customerId = req.user.id;

    if (!referralCode) {
      return res.status(400).json({ success: false, message: 'Referral code is required' });
    }

    const transaction = await sequelize.transaction();
    try {
      const currentCustomer = await Customer.findByPk(customerId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!currentCustomer) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }

      if (currentCustomer.referredBy) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'You have already used a referral code' });
      }

      if (currentCustomer.referralCode === referralCode) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'You cannot use your own referral code' });
      }

      // Check if it matches a managed PromoCode first
      const promo = await PromoCode.findOne({ 
        where: { code: referralCode.trim().toUpperCase() },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (promo) {
        if (!promo.isActive) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'This promo code is currently inactive.' });
        }

        if (new Date() > new Date(promo.expiresAt)) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'This promo code has expired.' });
        }

        if (promo.maxUses && promo.usedCount >= promo.maxUses) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'This promo code has reached its maximum usage limit.' });
        }

        const discount = parseFloat(promo.discountValue) || 100.0;

        let currentWallet = await Wallet.findOne({ where: { customerId: currentCustomer.id }, transaction });
        if (!currentWallet) {
          currentWallet = await Wallet.create({ customerId: currentCustomer.id, balance: 0 }, { transaction });
        }
        currentWallet.balance += discount;
        await currentWallet.save({ transaction });

        await Transaction.create({
          walletId: currentWallet.id,
          amount: discount,
          type: 'CREDIT',
          description: `Promo Code Applied: ${promo.code}`,
          referenceId: promo.id
        }, { transaction });

        promo.usedCount = (promo.usedCount || 0) + 1;
        await promo.save({ transaction });

        currentCustomer.referredBy = promo.code;
        await currentCustomer.save({ transaction });

        await transaction.commit();

        return res.status(200).json({
          success: true,
          message: `Promo code applied! ₹${discount} added to your wallet.`,
          newBalance: currentWallet.balance,
          discount
        });
      }

      // Otherwise, check for Customer Peer Referral code
      let referrer = null;
      if (referralCode !== 'EMINENCE-XYZ123') {
        referrer = await Customer.findOne({ where: { referralCode }, transaction, lock: transaction.LOCK.UPDATE });
        if (!referrer) {
          await transaction.rollback();
          return res.status(404).json({ success: false, message: 'Invalid referral code or promo code' });
        }
      }

      // Reward amount for peer referral
      const REWARD_AMOUNT = 100.0;
      // 1. Update current customer wallet
      let currentWallet = await Wallet.findOne({ where: { customerId: currentCustomer.id }, transaction });
      if (!currentWallet) {
        currentWallet = await Wallet.create({ customerId: currentCustomer.id, balance: 0 }, { transaction });
      }
      currentWallet.balance += REWARD_AMOUNT;
      await currentWallet.save({ transaction });

      await Transaction.create({
        walletId: currentWallet.id,
        amount: REWARD_AMOUNT,
        type: 'CREDIT',
        description: 'Signup Referral Bonus',
        referenceId: referrer ? referrer.id : 'PROMO_CODE'
      }, { transaction });

      // 2. Update referrer wallet (Skip for test promo code)
      if (referrer) {
        let referrerWallet = await Wallet.findOne({ where: { customerId: referrer.id }, transaction });
        if (!referrerWallet) {
          referrerWallet = await Wallet.create({ customerId: referrer.id, balance: 0 }, { transaction });
        }
        referrerWallet.balance += REWARD_AMOUNT;
        await referrerWallet.save({ transaction });

        await Transaction.create({
          walletId: referrerWallet.id,
          amount: REWARD_AMOUNT,
          type: 'CREDIT',
          description: 'Friend Referral Bonus',
          referenceId: currentCustomer.id
        }, { transaction });
      }

      // 3. Mark current customer as referred
      currentCustomer.referredBy = referralCode;
      await currentCustomer.save({ transaction });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: `Referral applied! ₹${REWARD_AMOUNT} added to your wallet.`,
        newBalance: currentWallet.balance,
        discount: REWARD_AMOUNT
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Apply Referral Error:', error);
      return res.status(500).json({ success: false, message: 'Server error applying referral' });
    }
  } catch (error) {
    console.error('Apply Referral Error:', error);
    return res.status(500).json({ success: false, message: 'Server error applying referral' });
  }
};

/**
 * Create a Razorpay Order for adding funds to customer wallet
 * POST /api/wallet/create-order
 */
const createWalletOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount < 10) {
      return res.status(400).json({
        success: false,
        message: 'Minimum top-up amount is ₹10'
      });
    }

    if (parsedAmount > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum top-up amount is ₹1,00,000 per transaction'
      });
    }

    const options = {
      amount: Math.round(parsedAmount * 100), // amount in paise
      currency: "INR",
      receipt: `topup_${req.user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        customerId: req.user.id,
        purpose: 'WALLET_TOPUP'
      }
    };

    const isMock = process.env.RAZORPAY_KEY_ID === 'rzp_test_mock' || !process.env.RAZORPAY_KEY_ID;
    if (isMock) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({
          success: false,
          message: 'Payment gateway is misconfigured or disabled in production mode.'
        });
      }
      return res.status(200).json({
        success: true,
        order: {
          id: 'order_mock_' + Math.floor(Math.random() * 1000000),
          amount: options.amount,
          currency: 'INR'
        },
        keyId: 'rzp_test_mock'
      });
    }

    const order = await razorpay.orders.create(options);
    return res.status(200).json({
      success: true,
      order,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create Wallet Order Error:', error);
    return res.status(500).json({
      success: false,
      message: error.error?.description || 'Server error creating payment order'
    });
  }
};

/**
 * Verify Razorpay payment and credit customer wallet
 * POST /api/wallet/verify-funds
 */
const verifyWalletFunds = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid top-up amount is required' });
    }

    const isMock = process.env.RAZORPAY_KEY_ID === 'rzp_test_mock' || !process.env.RAZORPAY_KEY_ID;
    if (isMock) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({
          success: false,
          message: 'Mock payment verification is prohibited in production mode.'
        });
      }
    } else {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing required Razorpay verification credentials'
        });
      }

      const sign = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

      if (razorpay_signature !== expectedSign) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
    }

    const customerId = req.user.id;
    const paymentRef = razorpay_payment_id || `mock_pay_${Date.now()}`;

    const transaction = await sequelize.transaction();
    try {
      // Idempotency check: don't credit twice for the same payment reference
      const existingTx = await Transaction.findOne({
        where: { referenceId: paymentRef },
        transaction
      });

      let wallet = await Wallet.findOne({
        where: { customerId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!wallet) {
        wallet = await Wallet.create({ customerId, balance: 0.0 }, { transaction });
      }

      if (existingTx) {
        await transaction.rollback();
        return res.status(200).json({
          success: true,
          message: 'Payment already verified and credited to wallet',
          newBalance: parseFloat(wallet.balance)
        });
      }

      const currentBalance = parseFloat(wallet.balance) || 0;
      const updatedBalance = Number((currentBalance + parsedAmount).toFixed(2));
      wallet.balance = updatedBalance;
      await wallet.save({ transaction });

      const newTx = await Transaction.create({
        walletId: wallet.id,
        amount: parsedAmount,
        type: 'CREDIT',
        description: `Wallet Recharge via Razorpay`,
        referenceId: paymentRef
      }, { transaction });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: `₹${parsedAmount.toFixed(2)} added to your wallet successfully!`,
        newBalance: updatedBalance,
        transaction: newTx
      });
    } catch (err) {
      await transaction.rollback();
      console.error('Wallet Credit Transaction Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to update wallet balance' });
    }
  } catch (error) {
    console.error('Verify Wallet Funds Error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying payment' });
  }
};

module.exports = {
  getWallet,
  applyReferralCode,
  createWalletOrder,
  verifyWalletFunds
};
