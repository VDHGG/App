/**
 * Maps Gemini / Google API error strings to Vietnamese copy for the chat widget.
 */
export function humanizeGeminiUpstreamError(raw: string): {
  assistantMessage: string
  technicalDetail?: string
} {
  const t = raw.trim()
  const lower = t.toLowerCase()

  if (
    /resource_exhausted|quota exceeded|billing has not been enabled|exceeded your current quota|insufficient[_\s]?quota|check your plan and billing/.test(
      lower,
    )
  ) {
    return {
      assistantMessage:
        'Dịch vụ trò chuyện AI hiện không khả dụng (hết hạn mức hoặc chưa bật billing trên Google AI / Gemini). Quản trị viên cần kiểm tra gói và API key tại aistudio.google.com hoặc Google Cloud Billing.',
    }
  }

  if (/api[_\s]?key not valid|invalid api key|api_key_invalid|permission denied|401/.test(lower)) {
    return {
      assistantMessage:
        'Không xác thực được với Google Gemini (API key không hợp lệ hoặc thiếu). Quản trị viên cần tạo key tại Google AI Studio và đặt GEMINI_API_KEY trong .env của server.',
    }
  }

  if (/rate limit|resource exhausted|429|too many requests/.test(lower)) {
    return {
      assistantMessage:
        'Hệ thống đang bận (giới hạn tốc độ từ Gemini). Bạn vui lòng đợi vài giây và thử gửi lại.',
    }
  }

  if (/model.*not found|is not found for api version|invalid model|404/.test(lower)) {
    return {
      assistantMessage:
        'Tên model Gemini không đúng hoặc không khả dụng với API key này. Quản trị viên cần kiểm tra GEMINI_MODEL trong .env (ví dụ gemini-2.0-flash, gemini-1.5-flash).',
      technicalDetail: t,
    }
  }

  if (/safety|blocked|harm/i.test(t) && t.length < 400) {
    return {
      assistantMessage:
        'Tin nhắn bị chặn bởi bộ lọc an toàn của Gemini. Bạn thử diễn đạt lại ngắn gọn hơn nhé.',
      technicalDetail: t,
    }
  }

  return {
    assistantMessage: 'Ôi, mình chưa kết nối được lúc này. Bạn thử lại sau giúp mình nhé.',
    technicalDetail: t,
  }
}
