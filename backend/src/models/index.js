const sequelize = require('../config/database');
const process = require('node:process');
const Customer = require('./Customer');
const Admin = require('./Admin');
const Otp = require('./Otp');
const Driver = require('./Driver');
const Vehicle = require('./Vehicle');
const Booking = require('./Booking');
const Review = require('./Review');
const Wallet = require('./Wallet');
const Transaction = require('./Transaction');
const B2BContract = require('./B2BContract');
const Invoice = require('./Invoice');
const Address = require('./Address');
const Inventory = require('./Inventory');
const AuditLog = require('./AuditLog');
const PlatformConfig = require('./PlatformConfig');
const UserConsent = require('./UserConsent');
const SupportChat = require('./SupportChat');
const Notification = require('./Notification');
const PromoCode = require('./PromoCode');

// Define Relationships
Customer.hasMany(UserConsent, { foreignKey: 'userId', as: 'consents', constraints: false });
UserConsent.belongsTo(Customer, { foreignKey: 'userId', as: 'customer', constraints: false });
Driver.hasMany(UserConsent, { foreignKey: 'userId', as: 'consents', constraints: false });
UserConsent.belongsTo(Driver, { foreignKey: 'userId', as: 'driver', constraints: false });
Customer.hasMany(Otp, { foreignKey: 'customerId', as: 'otps' });
Otp.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Customer.hasMany(Booking, { foreignKey: 'customerId', as: 'bookings' });
Booking.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Driver.hasMany(Booking, { foreignKey: 'driverId', as: 'bookings' });
Booking.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });

Vehicle.hasMany(Booking, { foreignKey: 'vehicleId', as: 'bookings' });
Booking.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });

Customer.hasMany(Review, { foreignKey: 'customerId', as: 'reviews' });
Review.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Driver.hasMany(Review, { foreignKey: 'driverId', as: 'reviews' });
Review.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });

Booking.hasOne(Review, { foreignKey: 'bookingId', as: 'review' });
Review.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

Customer.hasOne(Wallet, { foreignKey: 'customerId', as: 'wallet' });
Wallet.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Wallet.hasMany(Transaction, { foreignKey: 'walletId', as: 'transactions' });
Transaction.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });

// B2B Associations
Customer.hasMany(B2BContract, { foreignKey: 'customerId', as: 'contracts' });
B2BContract.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Customer.hasMany(Invoice, { foreignKey: 'customerId', as: 'invoices' });
Invoice.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Customer.hasMany(Address, { foreignKey: 'customerId', as: 'addresses' });
Address.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Customer.hasMany(Inventory, { foreignKey: 'customerId', as: 'inventories' });
Inventory.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

const { Client } = require('pg');

const bootstrapDatabase = async () => {
  try {
    const dialect = sequelize.getDialect();
    if (dialect === 'postgres') {
      await sequelize.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Customers_b2bStatus') THEN
            CREATE TYPE "enum_Customers_b2bStatus" AS ENUM('none', 'pending_verification', 'approved', 'rejected');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Customers_billingMode') THEN
            CREATE TYPE "enum_Customers_billingMode" AS ENUM('prepaid', 'postpaid');
          END IF;
        END $$;
      `);

      await sequelize.query(`
        ALTER TABLE "Customers" 
          ADD COLUMN IF NOT EXISTS "password" VARCHAR(255),
          ADD COLUMN IF NOT EXISTS "isPro" BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS "totalTrips" INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS "isBusiness" BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS "b2bStatus" "enum_Customers_b2bStatus" DEFAULT 'none',
          ADD COLUMN IF NOT EXISTS "companyName" VARCHAR(255),
          ADD COLUMN IF NOT EXISTS "gstNumber" VARCHAR(255),
          ADD COLUMN IF NOT EXISTS "billingMode" "enum_Customers_billingMode" DEFAULT 'prepaid',
          ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(10,2) DEFAULT 0.00,
          ADD COLUMN IF NOT EXISTS "creditUsed" DECIMAL(10,2) DEFAULT 0.00,
          ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS "termsVersion" VARCHAR(255);
      `);

      await sequelize.query(`
        ALTER TABLE "Bookings" 
          ADD COLUMN IF NOT EXISTS "stops" JSONB,
          ADD COLUMN IF NOT EXISTS "totalDistance" DECIMAL(10,2),
          ADD COLUMN IF NOT EXISTS "isRoundTrip" BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS "waitingTimeHours" INTEGER,
          ADD COLUMN IF NOT EXISTS "waitingFee" DECIMAL(10,2),
          ADD COLUMN IF NOT EXISTS "insuranceFee" DECIMAL(10,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS "isB2B" BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS "gstAmount" DECIMAL(10,2),
          ADD COLUMN IF NOT EXISTS "esgEmissions" REAL,
          ADD COLUMN IF NOT EXISTS "is3plOutsourced" BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS "thirdPartyProvider" VARCHAR(255),
          ADD COLUMN IF NOT EXISTS "podHash" VARCHAR(255);
      `);

      await sequelize.query(`
        ALTER TABLE "Drivers"
          ADD COLUMN IF NOT EXISTS "password" VARCHAR(255),
          ADD COLUMN IF NOT EXISTS "email" VARCHAR(255),
          ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN DEFAULT true,
          ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS "termsVersion" VARCHAR(255);
      `);

      // Database-level constraint preventing multiple referral rewards for one customer's wallet
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "unique_signup_bonus" ON "Transactions" ("walletId") WHERE description = 'Signup Referral Bonus';
      `);

      // Ensure wallet payment method value exists in PostgreSQL enum
      await sequelize.query(`
        ALTER TYPE "enum_Bookings_paymentMethod" ADD VALUE IF NOT EXISTS 'wallet';
      `).catch(() => {});
    } else if (dialect === 'sqlite') {
      // For SQLite test environment, use a similar partial index
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "unique_signup_bonus" ON "Transactions" ("walletId") WHERE description = 'Signup Referral Bonus';
      `);
    }
  } catch (e) {
    console.warn('Bootstrap database note:', e.message);
  }
};



// Function to sync models
const syncDatabase = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.log('Production environment detected: Skipping automatic schema alteration. Controlled database migrations should be used.');
      await sequelize.authenticate();
      return;
    }

    await bootstrapDatabase();
    // Sync schema without expensive alter operations on every start
    await sequelize.sync();
    console.log('Database synced successfully');

    // Ensure single authoritative admin exists based on .env
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV) {
      const bcrypt = require('bcrypt');
      const seedEmail = process.env.SEED_EMAIL || 'admin@eminence.com';
      const seedPassword = process.env.SEED_PASSWORD || 'password123';
      const hashedSeedPassword = await bcrypt.hash(seedPassword, 10);

      // Clean up legacy admin@example.com if present
      if (seedEmail !== 'admin@example.com') {
        await Admin.destroy({ where: { email: 'admin@example.com' } }).catch(() => {});
      }

      const admin = await Admin.findOne({ where: { email: seedEmail } });
      if (!admin) {
        await Admin.create({
          name: 'Super Admin',
          email: seedEmail,
          password: hashedSeedPassword
        });
        console.log(`Seeded primary admin: ${seedEmail}`);
      } else {
        admin.password = hashedSeedPassword;
        await admin.save();
      }
    }

    const shouldSeed = process.env.NODE_ENV === 'development' && process.env.DEMO_SEED === 'true';

    if (!shouldSeed) {
      console.log('Skipping demo seed data (non-demo / live environment)');
      return;
    }
  } catch (error) {
    console.error('Error syncing database:', error);
  }
};

module.exports = {
  sequelize,
  syncDatabase,
  Customer,
  Admin,
  Otp,
  Driver,
  Vehicle,
  Booking,
  Review,
  Wallet,
  Transaction,
  B2BContract,
  Invoice,
  Address,
  Inventory,
  AuditLog,
  PlatformConfig,
  UserConsent,
  SupportChat,
  Notification,
  PromoCode
};
