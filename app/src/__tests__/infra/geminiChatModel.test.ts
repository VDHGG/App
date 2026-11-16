import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModel,
} from '@adapter/http/ChatController.adapter';

describe('resolveGeminiModel', () => {
  it('defaults empty or undefined GEMINI_MODEL to gemini-2.5-flash', () => {
    expect(resolveGeminiModel(undefined)).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('')).toBe('gemini-2.5-flash');
    expect(resolveGeminiModel('   ')).toBe('gemini-2.5-flash');
  });

  it('auto-upgrades retired gemini-1.5 and gemini-2.0 models to gemini-2.5-flash', () => {
    expect(resolveGeminiModel('gemini-2.0-flash')).toBe('gemini-2.5-flash');
    expect(resolveGeminiModel('gemini-2.0-flash-lite')).toBe('gemini-2.5-flash');
    expect(resolveGeminiModel('gemini-1.5-flash')).toBe('gemini-2.5-flash');
    expect(resolveGeminiModel('gemini-1.5-pro')).toBe('gemini-2.5-flash');
  });

  it('preserves active configured models', () => {
    expect(resolveGeminiModel('gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(resolveGeminiModel('gemini-2.5-flash-lite')).toBe('gemini-2.5-flash-lite');
    expect(resolveGeminiModel('gemini-2.5-pro')).toBe('gemini-2.5-pro');
    expect(resolveGeminiModel('gemini-3.5-flash')).toBe('gemini-3.5-flash');
  });
});
