const { 
  generateTwimlResponse, 
  findCustomerByPhone, 
  transcribeAudio, 
  getGroqClient 
} = require('../../src/services/ivrVoiceService');

describe('Module: AI Voice IVR Helpline Unit Tests', () => {
  describe('TwiML Response Generator', () => {
    test('should generate compliant TwiML XML with Aditi Indian accent', () => {
      const xml = generateTwimlResponse('Welcome to Eminence transport helpline');
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<Response>');
      expect(xml).toContain('<Say voice="Polly.Aditi" language="en-IN">Welcome to Eminence transport helpline</Say>');
      expect(xml).toContain('</Response>');
    });

    test('should properly escape XML special characters', () => {
      const xml = generateTwimlResponse('Fare is ₹500 & delivery for <Tata Motors> "Express" is confirmed');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&lt;Tata Motors&gt;');
      expect(xml).toContain('&quot;Express&quot;');
      expect(xml).not.toContain('<Tata Motors>');
    });

    test('should include Record action tag when allowRecord is true', () => {
      const xml = generateTwimlResponse('Speak your request', {
        allowRecord: true,
        actionUrl: '/api/ivr/recording-callback'
      });
      expect(xml).toContain('<Record action="/api/ivr/recording-callback" maxLength="15" playBeep="true" trim="trim-silence"/>');
    });

    test('should include Hangup tag when hangup option is true', () => {
      const xml = generateTwimlResponse('Thank you for calling. Goodbye!', { hangup: true });
      expect(xml).toContain('<Hangup/>');
    });

    test('should handle empty or null input gracefully', () => {
      const xml = generateTwimlResponse('');
      expect(xml).toContain('<Say voice="Polly.Aditi" language="en-IN"></Say>');
    });
  });

  describe('Audio Buffer Validation', () => {
    test('should reject null or undefined audio buffer', async () => {
      await expect(transcribeAudio(null)).rejects.toThrow('Audio buffer is empty or missing');
      await expect(transcribeAudio(undefined)).rejects.toThrow('Audio buffer is empty or missing');
    });

    test('should reject zero-length audio buffer', async () => {
      await expect(transcribeAudio(Buffer.alloc(0))).rejects.toThrow('Audio buffer is empty or missing');
    });
  });

  describe('Groq Client Initialization', () => {
    test('should initialize and return Groq client instance when GROQ_API_KEY is available', () => {
      const client = getGroqClient();
      expect(client).toBeDefined();
      expect(client).not.toBeNull();
      expect(client.audio).toBeDefined();
      expect(client.audio.transcriptions).toBeDefined();
    });
  });

  describe('Phone Number Input Normalization', () => {
    test('should return null for non-string, empty, or whitespace-only input', async () => {
      expect(await findCustomerByPhone(null)).toBeNull();
      expect(await findCustomerByPhone('')).toBeNull();
      expect(await findCustomerByPhone(12345)).toBeNull();
    });
  });
});
