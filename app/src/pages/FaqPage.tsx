import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ContentH2, ContentPageShell } from '../components/content/ContentPageShell'
import { fetchActiveVouchers, type VoucherRecord } from '../lib/rentals.api'

type FaqCategory =
  | 'ALL'
  | 'Đặt thuê & Tiền cọc'
  | 'Hạng & Voucher'
  | 'Thanh toán MoMo'
  | 'Gia hạn & Trả giày'

const FAQ_CATEGORIES: FaqCategory[] = [
  'ALL',
  'Đặt thuê & Tiền cọc',
  'Hạng & Voucher',
  'Thanh toán MoMo',
  'Gia hạn & Trả giày',
]

type FaqEntry = {
  id: string
  category: Exclude<FaqCategory, 'ALL'>
  q: string
  a: string
}

const FAQ_DATA: FaqEntry[] = [
  {
    id: 'faq-1',
    category: 'Đặt thuê & Tiền cọc',
    q: 'Giá thuê giày và số ngày thuê được tính như thế nào?',
    a: 'Giá niêm yết là đơn giá thuê mỗi ngày (VND/ngày). Số ngày thuê được tính theo ngày lịch bao gồm cả ngày bắt đầu nhận giày và ngày hẹn trả (ví dụ: thuê từ 10/11 đến 12/11 là 3 ngày).',
  },
  {
    id: 'faq-2',
    category: 'Đặt thuê & Tiền cọc',
    q: 'Tiền đặt cọc bảo đảm là bao nhiêu và khi nào được hoàn lại?',
    a: 'Mỗi đôi giày có mức đặt cọc cố định là 500.000₫/đôi. Khi bạn trả giày đúng hạn và giày không bị hư hỏng, cửa hàng hoàn trả lại 100% tiền cọc ngay lập tức.',
  },
  {
    id: 'faq-3',
    category: 'Đặt thuê & Tiền cọc',
    q: 'Mỗi tài khoản được thuê tối đa bao nhiêu đôi giày cùng lúc?',
    a: 'Để đảm bảo an toàn tồn kho, mỗi khách hàng được phép thuê tối đa 5 đôi giày cùng lúc (tính tổng số đôi trong các đơn đang ở trạng thái RESERVED và ACTIVE).',
  },
  {
    id: 'faq-4',
    category: 'Hạng & Voucher',
    q: 'Hạng thành viên (BRONZE, SILVER, GOLD, DIAMOND) được nâng cấp tự động thế nào?',
    a: 'Sau mỗi đơn thuê hoàn tất trả giày (RETURNED), hệ thống tự động cộng dồn chi tiêu gốc vào hồ sơ của bạn: đạt từ 2.000.000₫ lên SILVER (-5%), từ 5.000.000₫ lên GOLD (-10%), và từ 10.000.000₫ lên DIAMOND (-15%).',
  },
  {
    id: 'faq-5',
    category: 'Hạng & Voucher',
    q: 'Tôi có được cộng dồn chiết khấu Hạng thành viên với mã Voucher không?',
    a: 'Có! Hệ thống cộng dồn phần trăm giảm giá của Hạng thành viên và mã Voucher khuyến mãi trên cùng một đơn thuê, với tổng mức giảm tối đa lên đến 50% đơn giá ngày.',
  },
  {
    id: 'faq-6',
    category: 'Hạng & Voucher',
    q: 'Nếu tôi hủy đơn đã áp mã Voucher thì có bị mất lượt dùng mã không?',
    a: 'Không. Khi đơn ở trạng thái RESERVED được hủy hợp lệ, hệ thống tự động hoàn lại lượt sử dụng (usedCount) cho mã Voucher đó để bạn dùng cho đơn tiếp theo.',
  },
  {
    id: 'faq-7',
    category: 'Thanh toán MoMo',
    q: 'Thanh toán qua ví điện tử MoMo hoạt động ra sao?',
    a: 'Khi chọn thanh toán qua MoMo ở bước Checkout, hệ thống tạo giao dịch giữ chỗ trong vòng 15 phút và chuyển bạn sang cổng thanh toán QR/MoMo để xác nhận tức thì.',
  },
  {
    id: 'faq-8',
    category: 'Thanh toán MoMo',
    q: 'Nếu quá 15 phút tôi chưa thanh toán MoMo thì đơn hàng sẽ thế nào?',
    a: 'Sau 15 phút nếu giao dịch MoMo vẫn ở trạng thái chờ (PENDING), hệ thống sẽ đánh dấu phiên thanh toán hết hạn (EXPIRED) và tự động hủy giữ chỗ để giải phóng tồn kho giày.',
  },
  {
    id: 'faq-9',
    category: 'Gia hạn & Trả giày',
    q: 'Tôi đang thuê giày nhưng muốn giữ lại đi thêm vài ngày thì làm thế nào?',
    a: 'Bạn chỉ cần mở mục Tài khoản (/account) → Lịch sử đơn thuê → bấm nút "Gia hạn" trên đơn đang RESERVED hoặc ACTIVE và chọn ngày trả mới. Nếu biến thể còn lịch trống, hệ thống sẽ gia hạn ngay.',
  },
  {
    id: 'faq-10',
    category: 'Gia hạn & Trả giày',
    q: 'Phí trả giày trễ hạn và phí kiểm định vệ sinh/hư hỏng được tính thế nào?',
    a: 'Nếu trả sau ngày hẹn trả, phí trễ hạn tính bằng 50% đơn giá ngày × số ngày quá hạn. Khi nhận lại giày, nhân viên kiểm định tình trạng: Nguyên vẹn (0₫), Bẩn nhiều cần vệ sinh chuyên sâu (+50.000₫), Trầy xước nhẹ (+150.000₫) và đối soát trực tiếp vào tiền cọc.',
  },
]

export function FaqPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<FaqCategory>('ALL')
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([])
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    fetchActiveVouchers()
      .then((res) => setVouchers(res.vouchers ?? []))
      .catch(() => setVouchers([]))
  }, [])

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return FAQ_DATA.filter((item) => {
      if (category !== 'ALL' && item.category !== category) return false
      if (!q) return true
      return (
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      )
    })
  }, [search, category])

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(code)
    }
    setCopiedCode(code)
    window.setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev))
    }, 2000)
  }

  return (
    <ContentPageShell
      title="Câu hỏi thường gặp (FAQ)"
      intro="Tra cứu nhanh mọi quy định về đặt thuê giày, tiền đặt cọc 500.000₫/đôi, tích lũy Hạng thành viên, mã giảm giá Voucher và thanh toán MoMo."
    >
      {vouchers.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-5 not-prose space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              🎁 Mã Giảm Giá Đang Mở Trên Hệ Thống
            </h2>
            <Link
              to="/shoes"
              className="text-xs font-bold text-primary hover:underline"
            >
              Dùng ngay tại cửa hàng →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vouchers.map((v) => (
              <div
                key={v.code}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                      {v.code}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                      -{v.discountPercent}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{v.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(v.code)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shrink-0 transition-colors"
                >
                  {copiedCode === v.code ? 'Đã sao chép!' : 'Sao chép mã'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 not-prose">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm câu hỏi (ví dụ: tiền cọc, MoMo, gia hạn, voucher...)"
          className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        />

        <div className="flex flex-wrap gap-2">
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                category === cat
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary'
              }`}
            >
              {cat === 'ALL' ? 'Tất cả' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 not-prose">
        {filteredFaqs.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-sm text-slate-500">
            Không tìm thấy câu hỏi phù hợp với từ khóa "{search}".
          </div>
        ) : (
          filteredFaqs.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                  {item.category}
                </span>
              </div>
              <p className="font-bold text-slate-900 dark:text-white text-base">{item.q}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-l-2 border-primary/40 pl-3">
                {item.a}
              </p>
            </div>
          ))
        )}
      </div>

      <ContentH2>Cần hỗ trợ thêm?</ContentH2>
      <p>
        Bạn có thể thử{' '}
        <Link to="/how-it-works" className="text-primary font-semibold hover:underline">
          Bộ mô phỏng chi phí thuê
        </Link>{' '}
        hoặc gửi yêu cầu trực tiếp tại trang{' '}
        <Link to="/contact" className="text-primary font-semibold hover:underline">
          Liên hệ & Hỗ trợ
        </Link>
        .
      </p>
    </ContentPageShell>
  )
}
