import { Link } from 'react-router-dom'
import {
  ContentH2,
  ContentList,
  ContentPageShell,
} from '../components/content/ContentPageShell'

export function HowItWorksPage() {
  return (
    <ContentPageShell
      title="Cách thuê hoạt động"
      intro="Quy trình trên cửa hàng điện tử này bám theo luồng nghiệp vụ trong hệ thống: chọn sản phẩm → đăng ký / chọn khách → chọn ngày → tạo đơn thuê ở trạng thái Đã giữ chỗ (RESERVED)."
    >
      <section className="space-y-3">
        <ContentH2>1. Chọn giày & biến thể</ContentH2>
        <p>
          Bạn duyệt danh mục, mở chi tiết sản phẩm và chọn <strong>size</strong> cùng{' '}
          <strong>màu</strong> (mỗi cặp size/màu là một biến thể có tồn kho riêng). Chỉ các biến
          thể còn đủ số lượng có sẵn mới có thể thuê trong khoảng thời gian bạn chọn.
        </p>
      </section>

      <section className="space-y-3">
        <ContentH2>2. Khách hàng</ContentH2>
        <p>
          Ở bước thanh toán / đặt thuê, bạn có thể <strong>đăng ký khách mới</strong> (họ tên, email)
          hoặc chọn <strong>khách đã có</strong> trong hệ thống. Email dùng để nhận thông tin liên
          quan đến đơn thuê.
        </p>
      </section>

      <section className="space-y-3">
        <ContentH2>3. Chọn kỳ thuê (ngày bắt đầu & ngày trả dự kiến)</ContentH2>
        <p>
          Bạn chọn <strong>ngày bắt đầu</strong> và <strong>ngày trả dự kiến</strong>. Hệ thống tính
          số <strong>ngày thuê</strong> theo lịch (bao gồm cả ngày đầu và ngày cuối). Giá hiển thị là{' '}
          <strong>giá mỗi ngày</strong> nhân với số ngày và số lượng trong đơn.
        </p>
        <p>
          Hệ thống kiểm tra <strong>trùng lịch</strong> với các đơn đang ở trạng thái Đã giữ chỗ hoặc
          Đang thuê để đảm bảo không vượt quá tồn kho biến thể.
        </p>
      </section>

      <section className="space-y-3">
        <ContentH2>4. Sau khi đặt: trạng thái đơn</ContentH2>
        <ContentList>
          <li>
            <strong>RESERVED (Đã giữ chỗ):</strong> đơn vừa được tạo; có thể kích hoạt khi giao giày
            hoặc hủy theo chính sách.
          </li>
          <li>
            <strong>ACTIVE (Đang thuê):</strong> đơn đã kích hoạt — khách đang sử dụng giày trong kỳ.
          </li>
          <li>
            <strong>RETURNED (Đã trả):</strong> giày đã trả; nếu trả trễ hạn, phí trễ hạn được tính
            theo quy tắc trong hệ thống (xem trang Chính sách).
          </li>
          <li>
            <strong>CANCELLED (Đã hủy):</strong> đơn không còn hiệu lực.
          </li>
        </ContentList>
      </section>

      <section className="space-y-3">
        <ContentH2>Hạng khách & giới hạn số món đang thuê</ContentH2>
        <p>
          Mỗi khách có <strong>hạng</strong> (Ví dụ: Đồng, Bạc, Vàng, Kim cương) với{' '}
          <strong>giới hạn số lượng món đang thuê</strong> cùng lúc (theo đơn RESERVED + ACTIVE). Khi
          vượt quá, hệ thống sẽ không cho tạo đơn mới cho đến khi trả bớt giày.
        </p>
      </section>

      <p className="pt-4">
        <Link to="/shoes" className="text-primary font-semibold hover:underline">
          ← Quay lại danh mục giày
        </Link>
      </p>
    </ContentPageShell>
  )
}
