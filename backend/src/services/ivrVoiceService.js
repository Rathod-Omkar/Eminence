const { Customer, Booking, Driver, Vehicle } = require('../models');
const { handleSupportMessage, isOffTopicQuery, OFF_TOPIC_REFUSAL_MESSAGE } = require('./supportBotService');
let Groq;
let groqClient = null;

function getGroqClient() {
  if (groqClient) return groqClient;
  if (process.env.GROQ_API_KEY) {
    try {
      Groq = require('groq-sdk');
      groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
      return groqClient;
    } catch (err) {
      console.warn('Groq SDK initialization note:', err.message);
      return null;
    }
  }
  return null;
}

/**
 * Transcribe raw audio buffer using Groq Whisper Large v3-Turbo.
 * @param {Buffer} audioBuffer - Binary audio data
 * @param {string} [filename='recording.wav'] - File name with extension
 * @param {string} [mimeType='audio/wav'] - MIME type of the audio
 * @returns {Promise<{ text: string, model: string }>}
 */
async function transcribeAudio(audioBuffer, filename = 'recording.wav', mimeType = 'audio/wav') {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Audio buffer is empty or missing');
  }

  const client = getGroqClient();
  if (!client) {
    throw new Error('Groq client is not configured or GROQ_API_KEY is missing');
  }

  try {
    const GroqModule = require('groq-sdk');
    const uploadableFile = await GroqModule.toFile(audioBuffer, filename, { type: mimeType });

    const response = await client.audio.transcriptions.create({
      file: uploadableFile,
      model: 'whisper-large-v3-turbo',
      prompt: 'Eminence Logistics, tempo, driver, delivery, booking, Swargate, Pune, Maharashtra, Chhota Hathi',
      response_format: 'json',
      temperature: 0.0
    });

    return {
      text: (response.text || '').trim(),
      model: 'whisper-large-v3-turbo'
    };
  } catch (error) {
    console.error('Groq Whisper Transcription Error:', error.message);
    throw error;
  }
}

/**
 * Identify a registered customer from an incoming phone number.
 * @param {string} rawPhone - Caller ID / phone number
 * @returns {Promise<Customer|null>}
 */
async function findCustomerByPhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  // Clean phone number: remove non-digits, take last 10 digits
  const digits = rawPhone.replace(/\D/g, '');
  const cleanPhone = digits.length >= 10 ? digits.slice(-10) : digits;

  if (!cleanPhone) return null;

  try {
    const customer = await Customer.findOne({
      where: { phone: cleanPhone }
    });
    return customer;
  } catch (err) {
    console.warn('Could not query customer by phone:', err.message);
    return null;
  }
}

/**
 * End-to-end voice query pipeline:
 * 1. Transcribes voice audio using Groq Whisper
 * 2. Identifies customer context if phone is provided
 * 3. Resolves answer through Groq LLM with logistics guardrails
 * @param {Object} params
 * @param {Buffer} params.audioBuffer
 * @param {string} [params.filename]
 * @param {string} [params.mimeType]
 * @param {string} [params.phoneNumber]
 * @param {string} [params.customerId]
 * @returns {Promise<Object>}
 */
async function processVoiceHelplineQuery({ audioBuffer, filename = 'speech.wav', mimeType = 'audio/wav', phoneNumber, customerId }) {
  // 1. Transcribe speech to text
  const transcription = await transcribeAudio(audioBuffer, filename, mimeType);
  const speechText = transcription.text;

  if (!speechText) {
    return {
      success: true,
      transcription: '',
      reply: 'We could not detect any speech in your voice message. Please speak clearly or dial our customer helpline at +1234567890.',
      isOffTopic: false,
      customer: null
    };
  }

  // 2. Caller Recognition
  let resolvedCustomerId = customerId;
  let resolvedCustomer = null;

  if (!resolvedCustomerId && phoneNumber) {
    resolvedCustomer = await findCustomerByPhone(phoneNumber);
    if (resolvedCustomer) {
      resolvedCustomerId = resolvedCustomer.id;
    }
  } else if (resolvedCustomerId) {
    try {
      resolvedCustomer = await Customer.findByPk(resolvedCustomerId);
    } catch (_) {}
  }

  // 3. Process transcribed text via logistics support bot
  const isOffTopic = isOffTopicQuery(speechText);
  let replyText;

  if (isOffTopic) {
    replyText = OFF_TOPIC_REFUSAL_MESSAGE;
  } else {
    replyText = await handleSupportMessage(resolvedCustomerId, speechText);
  }

  return {
    success: true,
    transcription: speechText,
    reply: replyText,
    isOffTopic,
    customer: resolvedCustomer ? { id: resolvedCustomer.id, name: resolvedCustomer.name, phone: resolvedCustomer.phone } : null
  };
}

/**
 * Generate TwiML Voice XML for telephone IVR responses.
 * @param {string} messageText
 * @param {Object} [options]
 * @param {string} [options.actionUrl] - URL to forward or record next input
 * @param {boolean} [options.allowRecord=false] - Whether to prompt for next voice recording
 * @returns {string} XML string
 */
function generateTwimlResponse(messageText, options = {}) {
  const { actionUrl, allowRecord = false, hangup = false } = options;
  const safeText = (messageText || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
  xml += `  <Say voice="Polly.Aditi" language="en-IN">${safeText}</Say>\n`;

  if (allowRecord && actionUrl) {
    xml += `  <Record action="${actionUrl}" maxLength="15" playBeep="true" trim="trim-silence"/>\n`;
  } else if (hangup) {
    xml += '  <Hangup/>\n';
  }

  xml += '</Response>';
  return xml;
}

module.exports = {
  getGroqClient,
  transcribeAudio,
  findCustomerByPhone,
  processVoiceHelplineQuery,
  generateTwimlResponse
};
