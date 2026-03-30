import { ContentH2, ContentPageShell } from '../components/content/ContentPageShell'

export function ContactPage() {
  return (
    <ContentPageShell
      title="Liên hệ"
    >
      <section className="space-y-4">
        <ContentH2>Hỗ trợ đặt thuê & khách hàng</ContentH2>
        <dl className="space-y-3 not-italic">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</dt>
            <dd>
              <a className="text-primary font-medium hover:underline" href="mailto:vuduchuy2072004@gmail.com">
                vuduchuy2072004@gmail.com
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Điện thoại / Zalo</dt>
            <dd>
              <a className="text-primary font-medium hover:underline" href="tel:+84906086356">
                +84 906086356
              </a>{' '}
              <span className="text-slate-500 text-sm">(Giờ hành chính)</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Địa chỉ nhận / trả giày</dt>
            <dd>
              Số 123, Đường ABC, Quận XYZ, TP. HN
              <br />
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <ContentH2>Ghi chú</ContentH2>
        <p>
          Thời gian xử lý: phản hồi trong vòng <strong>24–48 giờ</strong> làm việc (chỉnh theo thực
          tế). Các thắc mắc về cách đặt đơn, trễ hạn, hạng khách có thể xem nhanh tại trang{' '}
          <strong>FAQ</strong> trước khi gửi tin.
        </p>
      </section>
    </ContentPageShell>
  )
}
