import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ContentH2,
  ContentPageShell,
} from '../components/content/ContentPageShell'
import { formatCurrency } from '../lib/format'

const STEPS = [
  {
    step: '01',
    title: '1. Chọn giày & kiểm tra lịch trống',
    desc: 'Duyệt kệ giày trực tuyến, chọn khoảng ngày bắt đầu và ngày trả dự kiến. Hệ thống kiểm tra tồn kho theo thời gian thực để tránh trùng lịch.',
  },
  {
    step: '02',
    title: '2. Chọn biến thể Size/Màu',
    desc: 'Mỗi cặp Size EU và Màu sắc là một biến thể độc lập. Chọn đúng size vừa chân và thêm vào giỏ thuê (tối đa 5 đôi cùng lúc).',
  },
  {
    step: '03',
    title: '3. Áp dụng Hạng thành viên & Voucher',
    desc: 'Hệ thống tự động áp dụng ưu đãi Hạng thành viên (SILVER 5%, GOLD 10%, DIAMOND 15%) và cộng dồn mã Voucher khuyến mãi (tổng giảm tối đa 50%).',
  },
  {
    step: '04',
    title: '4. Đặt cọc 500.000₫/đôi & Thanh toán COD/MoMo',
    desc: 'Mỗi đôi giày có mức cọc bảo đảm cố định 500.000₫. Bạn có thể chọn thanh toán khi nhận giày (COD) hoặc thanh toán ví MoMo (giữ chỗ 15 phút).',
  },
  {
    step: '05',
    title: '5. Nhận giày, Gia hạn linh hoạt & Hoàn cọc 100%',
    desc: 'Nhận giày đã vệ sinh khử khuẩn. Cần dùng thêm ngày có thể bấm Gia hạn trực tuyến. Khi trả giày đúng hạn & nguyên vẹn, hoàn lại 100% tiền cọc.',
  },
]

const RANK_TIERS = [
  {
    rank: 'BRONZE',
    threshold: '0₫ (Mặc định)',
    discount: '0%',
    maxItems: '5 đôi đang thuê',
    perks: 'Tích lũy chi tiêu tự động sau mỗi đơn RETURNED',
  },
  {
    rank: 'SILVER',
    threshold: '≥ 2.000.000₫',
    discount: '-5%',
    maxItems: '5 đôi đang thuê',
    perks: 'Giảm 5% mọi đơn thuê + Cộng dồn Voucher',
  },
  {
    rank: 'GOLD',
    threshold: '≥ 5.000.000₫',
    discount: '-10%',
    maxItems: '5 đôi đang thuê',
    perks: 'Giảm 10% mọi đơn thuê + Ưu tiên giữ lịch lễ/Tết',
  },
  {
    rank: 'DIAMOND',
    threshold: '≥ 10.000.000₫',
    discount: '-15%',
    maxItems: '5 đôi đang thuê',
    perks: 'Giảm 15% mọi đơn thuê + Hỗ trợ VIP 1-1',
  },
]

export function HowItWorksPage() {
  const [pricePerDay, setPricePerDay] = useState<number>(300000)
  const [qty, setQty] = useState<number>(1)
  const [days, setDays] = useState<number>(3)
  const [rankDiscount, setRankDiscount] = useState<number>(5)
  const [voucherDiscount, setVoucherDiscount] = useState<number>(10)
  const [overdueDays, setOverdueDays] = useState<number>(0)

  const sim = useMemo(() => {
    const safePrice = Math.max(1000, Number(pricePerDay) || 0)
    const safeQty = Math.min(5, Math.max(1, qty))
    const safeDays = Math.min(14, Math.max(1, days))
    const safeOverdue = Math.min(7, Math.max(0, overdueDays))

    const totalDiscountPercent = Math.min(50, rankDiscount + voucherDiscount)
    const discountedUnitPerDay = Math.max(
      1,
      Math.round((safePrice * (100 - totalDiscountPercent)) / 100)
    )
    const originalBasePrice = safePrice * safeQty * safeDays
    const basePrice = discountedUnitPerDay * safeQty * safeDays
    const savedAmount = Math.max(0, originalBasePrice - basePrice)
    const depositAmount = safeQty * 500000
    const lateFee = Math.round((basePrice / safeDays) * 0.5 * safeOverdue)
    const totalDueAtCheckout = basePrice + depositAmount
    const netRefundOnReturn = depositAmount - lateFee

    return {
      totalDiscountPercent,
      discountedUnitPerDay,
      originalBasePrice,
      basePrice,
      savedAmount,
      depositAmount,
      lateFee,
      totalDueAtCheckout,
      netRefundOnReturn,
    }
  }, [pricePerDay, qty, days, rankDiscount, voucherDiscount, overdueDays])

  return (
    <ContentPageShell
      title="Hướng dẫn thuê giày (How It Works)"
      intro="Quy trình thuê giày thông minh, minh bạch từ khâu kiểm tra lịch trống, tính ưu đãi cộng dồn Hạng & Voucher, đến đối soát hoàn tiền cọc tự động."
    >
      <section className="space-y-4">
        <ContentH2>Quy trình 5 bước thuê giày chuẩn xác</ContentH2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose">
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-primary/15 text-primary">
                  Bước {s.step}
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {s.title}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <ContentH2>🧮 Bộ Mô Phỏng Chi Phí Thuê, Cọc & Phí Trễ Hạn</ContentH2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Thử điều chỉnh các thông số bên dưới để xem cách hệ thống tự động tính tiền thuê, ưu đãi cộng dồn, tiền đặt cọc và số tiền hoàn lại khi trả giày:
        </p>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm space-y-5 not-prose">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Đơn giá thuê / ngày (VND)
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[200000, 300000, 450000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPricePerDay(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      pricePerDay === preset
                        ? 'bg-primary text-white border-primary'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {formatCurrency(preset)}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={50000}
                step={10000}
                value={pricePerDay}
                onChange={(e) => setPricePerDay(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Số lượng đôi ({qty} đôi — Tối đa 5 đôi)
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full accent-primary mt-2"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-semibold mt-1">
                <span>1 đôi</span>
                <span>2 đôi</span>
                <span>3 đôi</span>
                <span>4 đôi</span>
                <span>5 đôi</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Số ngày thuê ({days} ngày)
              </label>
              <input
                type="range"
                min={1}
                max={14}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full accent-primary mt-2"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-semibold mt-1">
                <span>1 ngày</span>
                <span>7 ngày</span>
                <span>14 ngày</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Giả lập số ngày trả trễ ({overdueDays} ngày)
              </label>
              <input
                type="range"
                min={0}
                max={7}
                value={overdueDays}
                onChange={(e) => setOverdueDays(Number(e.target.value))}
                className="w-full accent-rose-600 mt-2"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-semibold mt-1">
                <span>Đúng hạn (0d)</span>
                <span>Trễ 3 ngày</span>
                <span>Trễ 7 ngày</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Hạng thành viên
              </label>
              <select
                value={rankDiscount}
                onChange={(e) => setRankDiscount(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
              >
                <option value={0}>BRONZE (0%)</option>
                <option value={5}>SILVER (-5%)</option>
                <option value={10}>GOLD (-10%)</option>
                <option value={15}>DIAMOND (-15%)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Voucher giảm thêm
              </label>
              <select
                value={voucherDiscount}
                onChange={(e) => setVoucherDiscount(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
              >
                <option value={0}>Không dùng Voucher (0%)</option>
                <option value={10}>WELCOME10 / WEEKEND10 (-10%)</option>
                <option value={20}>SNEAKER20 (-20%)</option>
                <option value={35}>FLASH35 (-35%)</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-4 border border-slate-200 dark:border-slate-700 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">
                Tổng mức giảm cộng dồn (Tối đa 50%):
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                -{sim.totalDiscountPercent}% (Đơn giá còn {formatCurrency(sim.discountedUnitPerDay)}/ngày)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">
                Giá thuê sau ưu đãi ({qty} đôi × {days} ngày):
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatCurrency(sim.basePrice)}
                {sim.savedAmount > 0 && (
                  <span className="ml-2 text-xs text-emerald-600 font-semibold">
                    (Tiết kiệm {formatCurrency(sim.savedAmount)})
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-amber-700 dark:text-amber-400">
              <span>Tiền đặt cọc bảo đảm (500.000₫ × {qty} đôi):</span>
              <span className="font-bold">{formatCurrency(sim.depositAmount)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-base">
              <span>Tổng thanh toán / Tạm giữ khi nhận giày:</span>
              <span className="text-primary">{formatCurrency(sim.totalDueAtCheckout)}</span>
            </div>
            <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between text-xs font-bold">
              <span>
                Phí trả trễ giả lập ({overdueDays} ngày × 50% đơn giá ngày):{' '}
                <strong className={sim.lateFee > 0 ? 'text-rose-600' : ''}>
                  +{formatCurrency(sim.lateFee)}
                </strong>
              </span>
              {sim.netRefundOnReturn >= 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Hoàn lại tiền cọc khi trả giày: {formatCurrency(sim.netRefundOnReturn)}
                </span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400">
                  Cần thu thêm sau khi cấn trừ cọc: +{formatCurrency(Math.abs(sim.netRefundOnReturn))}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              to="/shoes"
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Khám phá kệ giày & Đặt thuê ngay →
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <ContentH2>Bảng đặc quyền Hạng thành viên (Loyalty Tiers)</ContentH2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 not-prose">
          <table className="w-full text-left text-xs sm:text-sm bg-white dark:bg-slate-900">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase text-[11px] font-bold">
              <tr>
                <th className="px-4 py-3">Hạng</th>
                <th className="px-4 py-3">Mốc chi tiêu tích lũy</th>
                <th className="px-4 py-3">Chiết khấu tự động</th>
                <th className="px-4 py-3">Giới hạn thuê</th>
                <th className="px-4 py-3">Quyền lợi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {RANK_TIERS.map((t) => (
                <tr key={t.rank}>
                  <td className="px-4 py-3 font-black text-primary">{t.rank}</td>
                  <td className="px-4 py-3 font-semibold">{t.threshold}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                    {t.discount}
                  </td>
                  <td className="px-4 py-3">{t.maxItems}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.perks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="pt-4">
        <Link to="/shoes" className="text-primary font-semibold hover:underline">
          ← Quay lại danh mục giày
        </Link>
      </p>
    </ContentPageShell>
  )
}
