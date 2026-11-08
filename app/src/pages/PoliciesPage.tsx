import { Link } from 'react-router-dom'
import {
  ContentH2,
  ContentList,
  ContentPageShell,
} from '../components/content/ContentPageShell'

export function PoliciesPage() {
  return (
    <ContentPageShell
      title="Chính sách & Điều khoản Thuê Giày"
      intro="Toàn bộ quy tắc nghiệp vụ dưới đây được áp dụng tự động và nhất quán trên hệ thống Rental Shoes Vietnam: từ công thức tính giá, ưu đãi cộng dồn, tiền đặt cọc bảo đảm đến quy trình kiểm định hoàn cọc."
    >
      <section className="space-y-3">
        <ContentH2>1. Giá thuê theo ngày & Ưu đãi cộng dồn (Hạng + Voucher)</ContentH2>
        <ContentList>
          <li>
            <strong>Đơn giá niêm yết:</strong> Tính theo đơn vị <strong>VND / ngày</strong> cho từng mẫu giày. Kỳ thuê được tính theo ngày lịch bao gồm cả ngày bắt đầu và ngày hẹn trả.
          </li>
          <li>
            <strong>Chiết khấu Hạng thành viên tự động:</strong> Hạng <strong>BRONZE (0%)</strong>, <strong>SILVER (-5%)</strong>, <strong>GOLD (-10%)</strong>, <strong>DIAMOND (-15%)</strong>.
          </li>
          <li>
            <strong>Cộng dồn mã Voucher khuyến mãi:</strong> Khách hàng được áp dụng thêm 01 mã Voucher hợp lệ trên mỗi đơn thuê. Tổng mức giảm cộng dồn (Hạng + Voucher) tối đa <strong>50%</strong> trên đơn giá ngày, với mức sàn tối thiểu <strong>1₫/ngày</strong>.
          </li>
        </ContentList>
      </section>

      <section className="space-y-3">
        <ContentH2>2. Tiền đặt cọc bảo đảm (500.000₫ / đôi)</ContentH2>
        <ContentList>
          <li>
            <strong>Mức cọc tiêu chuẩn:</strong> Hệ thống áp dụng mức đặt cọc bảo đảm cố định <strong>500.000₫ × tổng số lượng đôi</strong> trong đơn thuê.
          </li>
          <li>
            <strong>Hoàn trả 100% tiền cọc:</strong> Ngay khi khách trả giày đúng hạn và biên bản kiểm định xác nhận giày nguyên vẹn, toàn bộ 100% tiền đặt cọc được hoàn lại cho khách hàng.
          </li>
          <li>
            <strong>Đối soát cấn trừ tự động:</strong> Nếu phát sinh phí trả trễ hoặc phụ phí vệ sinh/hư hỏng, hệ thống tự động cấn trừ vào tiền cọc và hiển thị rõ số tiền hoàn lại hoặc cần thu thêm trên hóa đơn.
          </li>
        </ContentList>
      </section>

      <section className="space-y-3">
        <ContentH2>3. Chính sách trả trễ & Phí kiểm định tình trạng giày</ContentH2>
        <ContentList>
          <li>
            <strong>Phí trả trễ hạn (50% / ngày):</strong> Nếu ngày trả thực tế sau ngày hẹn trả dự kiến, phí phạt trễ hạn được tính bằng <strong>50% × đơn giá thuê trung bình/ngày × số ngày trễ</strong>.
          </li>
          <li>
            <strong>Biên bản kiểm định khi nhận lại giày (Damage / Cleaning Fee):</strong>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li><strong>Tốt / Nguyên vẹn:</strong> Không phụ phí (<strong>0₫</strong>).</li>
              <li><strong>Bẩn nhiều cần vệ sinh chuyên sâu:</strong> Phụ phí <strong>+50.000₫</strong>.</li>
              <li><strong>Trầy xước / Hư hỏng nhẹ:</strong> Phụ phí <strong>+150.000₫</strong>.</li>
              <li><strong>Hư hỏng nặng / Mất phụ kiện:</strong> Áp dụng mức bồi thường thực tế theo biên bản kiểm định tại quầy.</li>
            </ul>
          </li>
        </ContentList>
      </section>

      <section className="space-y-3">
        <ContentH2>4. Chính sách Gia hạn & Hủy đơn thuê</ContentH2>
        <ContentList>
          <li>
            <strong>Gia hạn đơn thuê (Extend Rental):</strong> Áp dụng cho đơn đang ở trạng thái <strong>RESERVED</strong> hoặc <strong>ACTIVE</strong>. Hệ thống kiểm tra lịch trống của các biến thể trong khoảng ngày gia hạn mới trước khi xác nhận và cộng thêm phí thuê tương ứng.
          </li>
          <li>
            <strong>Hủy đơn thuê (Cancel Rental):</strong> Khách hàng có thể tự hủy trực tuyến đối với đơn ở trạng thái <strong>RESERVED</strong> trước ngày bắt đầu thuê ít nhất <strong>01 ngày lịch</strong>. Khi hủy đơn hợp lệ, hệ thống tự động giải phóng tồn kho và <strong>hoàn lại lượt sử dụng mã Voucher</strong> (nếu đơn có áp mã).
          </li>
        </ContentList>
      </section>

      <section className="space-y-3">
        <ContentH2>5. Thanh toán Ví điện tử MoMo & Giữ chỗ 15 phút</ContentH2>
        <ContentList>
          <li>
            <strong>Cổng thanh toán MoMo:</strong> Hỗ trợ thanh toán trực tuyến tổng tiền thuê + tiền đặt cọc qua mã QR / Ví MoMo.
          </li>
          <li>
            <strong>Thời gian giữ chỗ 15 phút:</strong> Đơn chọn thanh toán MoMo ở trạng thái chờ thanh toán (PENDING) được giữ tồn kho trong tối đa <strong>15 phút</strong>. Quá 15 phút chưa hoàn tất thanh toán, hệ thống tự động thu hồi trạng thái hết hạn (EXPIRED) và hủy đơn giữ chỗ để giải phóng giày cho khách hàng khác.
          </li>
        </ContentList>
      </section>

      <section className="space-y-3">
        <ContentH2>6. Giới hạn an toàn & Bảo mật dữ liệu</ContentH2>
        <p>
          Mỗi khách hàng được thuê tối đa <strong>5 đôi giày cùng lúc</strong> (tính tổng trên các đơn RESERVED và ACTIVE). Trợ lý AI và toàn bộ hệ thống tuân thủ nghiêm ngặt quy tắc bảo mật dữ liệu cá nhân, chỉ truy xuất đúng hồ sơ của tài khoản đang đăng nhập.
        </p>
      </section>

      <div className="pt-4 flex flex-wrap items-center gap-4 text-sm font-semibold">
        <Link to="/how-it-works" className="text-primary hover:underline">
          ← Xem Bộ mô phỏng chi phí thuê
        </Link>
        <span className="text-slate-300">·</span>
        <Link to="/faq" className="text-primary hover:underline">
          Câu hỏi thường gặp (FAQ)
        </Link>
        <span className="text-slate-300">·</span>
        <Link to="/contact" className="text-primary hover:underline">
          Liên hệ hỗ trợ
        </Link>
      </div>
    </ContentPageShell>
  )
}
