import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ContentH2, ContentPageShell } from '../components/content/ContentPageShell'
import { useAuth } from '../auth/AuthContext'

const SUPPORT_TOPICS = [
  'Hỗ trợ đặt thuê',
  'Gia hạn / Đổi lịch đơn',
  'Hoàn cọc & Thanh toán MoMo',
  'Góp ý dịch vụ',
] as const

export function ContactPage() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState<string>(SUPPORT_TOPICS[0])
  const [rentalId, setRentalId] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticketId: string
    topic: string
    rentalId: string
    createdAt: string
  } | null>(null)

  useEffect(() => {
    if (user) {
      setFullName((prev) => prev || user.fullName || '')
      setEmail((prev) => prev || user.email || '')
    }
  }, [user])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) {
      setFormError('Vui lòng nhập đầy đủ họ tên và email liên hệ.')
      return
    }
    if (!message.trim()) {
      setFormError('Vui lòng nhập nội dung cần hỗ trợ.')
      return
    }
    setFormError(null)
    const suffix = Math.floor(100000 + Math.random() * 900000)
    setSubmittedTicket({
      ticketId: `#SUP-${suffix}`,
      topic,
      rentalId: rentalId.trim(),
      createdAt: new Date().toLocaleString('vi-VN'),
    })
    setMessage('')
  }

  return (
    <ContentPageShell
      title="Liên hệ & Trung tâm Hỗ trợ"
      intro="Đội ngũ Rental Shoes Vietnam luôn sẵn sàng hỗ trợ bạn về lịch thuê giày, gia hạn kỳ thuê, hoàn tiền đặt cọc và đối soát giao dịch MoMo."
    >
      <section className="space-y-4">
        <ContentH2>Thông tin liên hệ trực tiếp</ContentH2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 not-italic not-prose">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Email hỗ trợ
            </dt>
            <dd>
              <a
                className="text-primary font-bold text-sm hover:underline break-all"
                href="mailto:vuduchuy2072004@gmail.com"
              >
                vuduchuy2072004@gmail.com
              </a>
            </dd>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Điện thoại / Zalo
            </dt>
            <dd>
              <a
                className="text-primary font-bold text-sm hover:underline"
                href="tel:+84906086356"
              >
                +84 906086356
              </a>
              <p className="text-slate-500 text-xs mt-0.5">08:30 – 21:30 (Tất cả các ngày)</p>
            </dd>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Địa chỉ nhận / trả giày
            </dt>
            <dd className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Số 123, Đường ABC, Quận XYZ, TP. HN
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4">
        <ContentH2>Gửi yêu cầu hỗ trợ / Tra cứu đơn thuê</ContentH2>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm not-prose">
          {submittedTicket && (
            <div className="mb-5 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  ✓ Đã ghi nhận phiếu hỗ trợ {submittedTicket.ticketId}
                </span>
                <span className="text-[11px] text-slate-500">{submittedTicket.createdAt}</span>
              </div>
              <p className="text-xs">
                Chủ đề: <strong>{submittedTicket.topic}</strong>
                {submittedTicket.rentalId ? ` · Mã đơn: ${submittedTicket.rentalId}` : ''}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Bộ phận Chăm sóc Khách hàng sẽ phản hồi qua email <strong>{email}</strong> trong thời gian sớm nhất.
              </p>
            </div>
          )}

          {formError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-semibold">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Email liên hệ *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@example.com"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Chủ đề hỗ trợ
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
                >
                  {SUPPORT_TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Mã đơn thuê (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={rentalId}
                  onChange={(e) => setRentalId(e.target.value)}
                  placeholder="Ví dụ: rent-101"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Nội dung chi tiết *
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mô tả yêu cầu hỗ trợ, đổi lịch hoặc thắc mắc về hoàn cọc..."
                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Gửi yêu cầu hỗ trợ
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        <ContentH2>Lối tắt hữu ích</ContentH2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 not-prose">
          <Link
            to="/shoes"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary transition-colors"
          >
            <p className="font-bold text-sm text-slate-900 dark:text-white">👟 Kệ giày trực tuyến</p>
            <p className="text-xs text-slate-500 mt-1">Xem tồn kho & đặt thuê ngay</p>
          </Link>
          <Link
            to="/account"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary transition-colors"
          >
            <p className="font-bold text-sm text-slate-900 dark:text-white">📋 Quản lý đơn thuê</p>
            <p className="text-xs text-slate-500 mt-1">Gia hạn, hủy đơn & in biên nhận</p>
          </Link>
          <Link
            to="/faq"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary transition-colors"
          >
            <p className="font-bold text-sm text-slate-900 dark:text-white">❓ Câu hỏi thường gặp</p>
            <p className="text-xs text-slate-500 mt-1">Tra cứu nhanh quy định & mã giảm giá</p>
          </Link>
        </div>
      </section>
    </ContentPageShell>
  )
}
