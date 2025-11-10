// @ts-nocheck
/**
 * Unit tests for VoiceInterface
 */

import { VoiceInterface } from '../../src/voice.js';
import type { ResearchConfig } from '../../src/types.js';

describe('VoiceInterface', () => {
  let voice: VoiceInterface;
  let config: ResearchConfig;

  beforeEach(() => {
    config = {
      anthropicApiKey: 'test-key',
      openaiApiKey: 'openai-test-key',
      minSourcesPerTopic: 10,
      maxSearchDepth: 3,
      enableVoice: true,
      outputDir: './test-output',
      outputFormat: 'markdown',
    };

    voice = new VoiceInterface(config);
  });

  describe('isEnabled', () => {
    it('should return true when voice is enabled with OpenAI key', () => {
      expect(voice.isEnabled()).toBe(true);
    });

    it('should return false when voice is disabled', () => {
      config.enableVoice = false;
      voice = new VoiceInterface(config);
      expect(voice.isEnabled()).toBe(false);
    });

    it('should return false when OpenAI key is missing', () => {
      config.openaiApiKey = undefined;
      voice = new VoiceInterface(config);
      expect(voice.isEnabled()).toBe(false);
    });
  });

  describe('getInteractions', () => {
    it('should return empty array initially', () => {
      const interactions = voice.getInteractions();
      expect(interactions).toEqual([]);
    });

    it('should return copy of interactions', () => {
      const interactions1 = voice.getInteractions();
      const interactions2 = voice.getInteractions();
      expect(interactions1).toEqual(interactions2);
      expect(interactions1).not.toBe(interactions2);
    });
  });
});
