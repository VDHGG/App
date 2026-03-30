import { Link } from 'react-router-dom'
import {
  ContentH2,
  ContentList,
  ContentPageShell,
} from '../components/content/ContentPageShell'

export function PoliciesPage() {
  return (
    <ContentPageShell
      title="Chính sách & điều khoản thuê"
      intro="Văn bản này mô tả các nguyên tắc nghiệp vụ mà phần mềm hỗ trợ: giá theo ngày, trạng thái đơn, phí trễ hạn, giới hạn theo hạng khách. Điều chỉnh pháp lý chi tiết do chủ cửa hàng bổ sung."
    >
      <section className="space-y-3">
        <ContentH2>1. Giá và thời hạn thuê</ContentH2>
        <p>
          Giá niêm yết là <strong>giá thuê mỗi ngày</strong> (theo đơn vị tiền tệ trên cửa hàng). Kỳ
          thuê được xác định bởi <strong>ngày bắt đầu</strong> và <strong>ngày trả dự kiến</strong>
          ; số ngày tính theo lịch, bao gồm cả hai mốc.
        </p>
      </section>

      <section className="space-y-3">
        <ContentH2>2. Trạng thái đơn thuê</ContentH2>
        <ContentList>
          <li>
            <strong>Đã giữ chỗ (RESERVED):</strong> đơn đã được tạo; tồn kho biến thể được giữ cho
            kỳ đó theo quy tắc hệ thống.
          </li>
          <li>
            <strong>Đang thuê (ACTIVE):</strong> đơn đã kích hoạt khi khách nhận giày (hoặc bắt đầu
            kỳ thuê theo quy trình cửa hàng).
          </li>
          <li>
            <strong>Đã trả (RETURNED):</strong> giày đã được trả; tổng tiền có thể bao gồm phí trễ
            hạn nếu có.
          </li>
          <li>
            <strong>Đã hủy (CANCELLED):</strong> đơn không còn hiệu lực.
          </li>
        </ContentList>
      </section>

      <section className="space-y-3">
        <ContentH2>3. Phí trễ hạn</ContentH2>
        <p>
          Nếu ngày trả thực tế <strong>sau</strong> ngày trả dự kiến, hệ thống có thể áp dụng{' '}
          <strong>phí trễ hạn</strong> tính theo tỷ lệ trên giá thuê gốc của kỳ và số ngày trễ (có
          làm tròn theo quy tắc nội bộ). Phí trễ chỉ gắn với đơn ở trạng thái <strong>Đã trả</strong>{' '}
          sau khi hoàn tất trả giày.
        </p>
      </section>

      <section className="space-y-3">
        <ContentH2>4. Hạng khách và giới hạn đang thuê</ContentH2>
        <p>
          Khách thuộc các <strong>hạng</strong> khác nhau (ví dụ: Đồng, Bạc, Vàng, Kim cương) với{' '}
          <strong>giới hạn số lượng món đang thuê</strong> (đơn RESERVED + ACTIVE). Hạng cao hơn có
          thể có giới hạn lớn hơn hoặc không giới hạn — cụ thể hiển thị trên hồ sơ khách.
        </p>
      </section>

      <section className="space-y-3">
        <ContentH2>5. Hủy đơn</ContentH2>
        <p>
          Hủy đơn trong luồng hệ thống thường áp dụng khi đơn còn ở trạng thái{' '}
          <strong>Đã giữ chỗ</strong>. Sau khi chuyển sang <strong>Đang thuê</strong>, việc điều chỉnh
          phụ thuộc chính sách cửa hàng (đổi kỳ, phí hủy, v.v.).
        </p>
      </section>

      <section className="space-y-3">
        <ContentH2>6. Bảo mật thông tin</ContentH2>
        <p>
          Thông tin khách (họ tên, email, …) được dùng để quản lý đơn thuê và liên hệ. Chủ cửa hàng
          chịu trách nhiệm tuân thủ quy định bảo vệ dữ liệu cá nhân tại địa phương.
        </p>
      </section>

      <p className="pt-2 text-sm text-slate-500">
        Cập nhật lần cuối: gắn với phiên bản ứng dụng hiện tại. Mọi điều khoản pháp lý ràng buộc
        doanh nghiệp cần được soạn thảo bổ sung.
      </p>

      <p className="pt-4">
        <Link to="/faq" className="text-primary font-semibold hover:underline">
          Xem FAQ
        </Link>
        {' · '}
        <Link to="/contact" className="text-primary font-semibold hover:underline">
          Liên hệ
        </Link>
      </p>
    </ContentPageShell>
  )
}
