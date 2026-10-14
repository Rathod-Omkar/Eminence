const request = require('supertest');
const app = require('../../src/app');
const ivrVoiceService = require('../../src/services/ivrVoiceService');
const { Customer, Booking, Driver, Vehicle, syncDatabase } = require('../../src/models');

/**
 * Helper to generate a minimal valid 1-second 8kHz mono 16-bit PCM WAV audio buffer.
 */
function createSilentWavBuffer() {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate; // 1 second
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

describe('AI Voice IVR Helpline Integration Tests', () => {
  let testCustomer;

  beforeAll(async () => {
    await syncDatabase();

    // Ensure a test customer with known phone exists
    [testCustomer] = await Customer.findOrCreate({
      where: { phone: '9888777666' },
      defaults: {
        name: 'Ramesh Sharma',
        phone: '9888777666',
        email: 'ramesh.sharma@example.com'
      }
    });
  }, 30000);

  afterAll(async () => {
    if (testCustomer) {
      await Customer.destroy({ where: { phone: '9888777666' } }).catch(() => {});
    }
  });

  describe('GET /api/ivr/health', () => {
    it('should report IVR service health and Groq Whisper configuration', async () => {
      const res = await request(app).get('/api/ivr/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.audioModel).toBe('whisper-large-v3-turbo');
      expect(res.body.groqConfigured).toBe(true);
      expect(res.body.supportedFormats).toContain('audio/wav');
    });
  });

  describe('POST /api/ivr/webhook (Inbound Phone Call)', () => {
    it('should greet an unregistered caller and prompt for voice input with TwiML', async () => {
      const res = await request(app)
        .post('/api/ivr/webhook')
        .send({ From: '+919999999999' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/xml');
      expect(res.text).toContain('<Response>');
      expect(res.text).toContain('<Say voice="Polly.Aditi" language="en-IN">');
      expect(res.text).toContain('Welcome to Eminence');
      expect(res.text).toContain('<Record action="/api/ivr/recording-callback"');
    });

    it('should recognize registered customer by caller ID and personalize greeting', async () => {
      const res = await request(app)
        .post('/api/ivr/webhook')
        .send({ From: '+919888777666' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/xml');
      expect(res.text).toContain('Welcome back to Eminence, Ramesh Sharma');
    });
  });

  describe('TwiML Response Generator', () => {
    it('should correctly format XML with escaped entities and hangup tag', () => {
      const xml = ivrVoiceService.generateTwimlResponse('Fare is ₹350 & Driver <Ramesh> is assigned', { hangup: true });
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&lt;Ramesh&gt;');
      expect(xml).toContain('<Hangup/>');
    });
  });

  describe('Caller Recognition Helper', () => {
    it('should match phone number with country code +91', async () => {
      const matched = await ivrVoiceService.findCustomerByPhone('+919888777666');
      expect(matched).not.toBeNull();
      expect(matched.name).toBe('Ramesh Sharma');
    });

    it('should match phone number with dashes and spaces', async () => {
      const matched = await ivrVoiceService.findCustomerByPhone('988-877-7666');
      expect(matched).not.toBeNull();
      expect(matched.phone).toBe('9888777666');
    });

    it('should return null for unknown phone numbers', async () => {
      const matched = await ivrVoiceService.findCustomerByPhone('0000000000');
      expect(matched).toBeNull();
    });
  });

  describe('POST /api/ivr/voice-query (REST Endpoint)', () => {
    it('should reject requests with missing audio with 400', async () => {
      const res = await request(app)
        .post('/api/ivr/voice-query')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No audio provided');
    });

    it('should process base64 audio and return transcription & logistics reply', async () => {
      const wavBuffer = createSilentWavBuffer();
      const audioBase64 = wavBuffer.toString('base64');

      const res = await request(app)
        .post('/api/ivr/voice-query')
        .send({
          audioBase64,
          mimeType: 'audio/wav',
          filename: 'test_speech.wav',
          phoneNumber: '9888777666'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('transcription');
      expect(res.body.data).toHaveProperty('reply');
      expect(res.body.data.customer).not.toBeNull();
      expect(res.body.data.customer.name).toBe('Ramesh Sharma');
    }, 20000);

    it('should accept multipart audio file uploads', async () => {
      const wavBuffer = createSilentWavBuffer();

      const res = await request(app)
        .post('/api/ivr/voice-query')
        .attach('audio', wavBuffer, 'recording.wav')
        .field('phoneNumber', '9888777666');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('reply');
    }, 20000);
  });

  describe('Groq Whisper Transcription Direct Service', () => {
    it('should transcribe audio buffer using whisper-large-v3-turbo', async () => {
      const wavBuffer = createSilentWavBuffer();
      const result = await ivrVoiceService.transcribeAudio(wavBuffer, 'audio_sample.wav', 'audio/wav');
      expect(result).toHaveProperty('text');
      expect(result.model).toBe('whisper-large-v3-turbo');
    }, 15000);

    it('should throw error when audio buffer is null or empty', async () => {
      await expect(ivrVoiceService.transcribeAudio(null)).rejects.toThrow('Audio buffer is empty or missing');
    });
  });
});
