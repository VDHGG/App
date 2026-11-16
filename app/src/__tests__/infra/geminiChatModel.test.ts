import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModel,
} from '@adapter/http/ChatController.adapter';
import { normalizeConversationTurns } from '@infra/gemini/geminiChat';

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

describe('normalizeConversationTurns', () => {
  it('strips leading assistant messages and empty turns', () => {
    const out = normalizeConversationTurns([
      { role: 'assistant', content: 'Chào bạn!' },
      { role: 'user', content: '   ' },
      { role: 'assistant', content: 'Gợi ý mở đầu' },
      { role: 'user', content: 'Tìm giày Nike' },
    ]);

    expect(out).toEqual([{ role: 'user', content: 'Tìm giày Nike' }]);
  });

  it('replaces unanswered consecutive user turns with the latest user turn so Gemini answers the newest question', () => {
    const out = normalizeConversationTurns([
      { role: 'assistant', content: 'Chào bạn!' },
      { role: 'user', content: 'Tìm giày chạy bộ' },
      { role: 'user', content: 'Shop đang có mã giảm giá nào?' },
    ]);

    expect(out).toEqual([{ role: 'user', content: 'Shop đang có mã giảm giá nào?' }]);
  });

  it('merges consecutive assistant turns to maintain strict user/model alternation', () => {
    const out = normalizeConversationTurns([
      { role: 'user', content: 'Xin chào' },
      { role: 'assistant', content: 'Phản hồi 1' },
      { role: 'assistant', content: 'Phản hồi 2' },
      { role: 'user', content: 'Báo giá SHOE001' },
    ]);

    expect(out).toEqual([
      { role: 'user', content: 'Xin chào' },
      { role: 'assistant', content: 'Phản hồi 1\n\nPhản hồi 2' },
      { role: 'user', content: 'Báo giá SHOE001' },
    ]);
  });
});
