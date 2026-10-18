const https = require('https');

const apiKey = process.env.FAST2SMS_API_KEY;
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

if (!apiKey || apiKey === 'your_api_key_here') {
  if (!isTestEnv) {
    console.warn("Fast2SMS credentials not configured. SMS sending will be mocked in console.");
  }
}

/**
 * Send an SMS using Fast2SMS
 * @param {string} to - Recipient phone number (e.g., +919999999999)
 * @param {string} body - SMS body content
 */
const sendSMS = (to, body) => {
  return new Promise((resolve, reject) => {
    if (!apiKey || apiKey === 'your_api_key_here' || apiKey === 'your_fast2sms_api_key_here') {
      // Always fallback to terminal logging if API key is missing, to save Fast2SMS limit limits
      const maskPhone = (phone) => {
        if (!phone) return phone;
        const str = String(phone);
        if (str.length <= 4) return '*'.repeat(str.length);
        return str.slice(0, -4).replace(/./g, '*') + str.slice(-4);
      };

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV MOCK SMS SENT TO: ${maskPhone(to)}: ${body}]`);
      } else {
        console.warn(`[SMS WARNING] Fast2SMS credentials not configured in production. SMS to ${maskPhone(to)} was not dispatched.`);
      }
      return resolve(null);
    }
    
    try {
      // Clean phone number (Fast2SMS expects 10 digits without +91)
      let cleanPhone = to.replace('+', '');
      if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
         cleanPhone = cleanPhone.substring(2); // Remove 91 prefix for India
      }

      const options = {
        hostname: 'www.fast2sms.com',
        path: `/dev/bulkV2?authorization=${apiKey}&route=q&message=${encodeURIComponent(body)}&language=english&flash=0&numbers=${cleanPhone}`,
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
           console.log("SMS sent via Fast2SMS:", data);
           resolve(data);
        });
      });

      req.on('error', (error) => {
        console.error("Error sending SMS:", error);
        resolve(null);
      });

      req.end();
    } catch (error) {
      console.error("Error sending SMS:", error);
      resolve(null);
    }
  });
};

module.exports = {
  sendSMS
};
