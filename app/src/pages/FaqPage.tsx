import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ContentH2, ContentPageShell } from '../components/content/ContentPageShell'

function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-slate-900 dark:text-white">{q}</p>
      <div className="text-slate-600 dark:text-slate-300 pl-0 border-l-2 border-primary/30 pl-4">
        {children}
      </div>
    </div>
  )
}

export function FaqPage() {
  return (
    <ContentPageShell
      title="Câu hỏi thường gặp (FAQ)"
      intro="Các câu trả lời dưới đây phản ánh cách hệ thống xử lý trong mã nguồn (đơn thuê, phí trễ, hạng khách, hủy đơn)."
    >
      <div className="space-y-10">
        <FaqItem q="Giá thuê được tính thế nào?">
          <p>
            Giá hiển thị theo <strong>đơn vị / ngày</strong> cho từng sản phẩm. Tổng tạm tính phụ
            thuộc số ngày thuê (từ ngày bắt đầu đến ngày trả dự kiến, tính theo ngày lịch) và số
            lượng từng biến thể trong đơn.
          </p>
        </FaqItem>

        <FaqItem q="Tôi có thể hủy đơn sau khi đặt không?">
          <p>
            Trong nghiệp vụ hiện tại, thao tác hủy áp dụng cho đơn ở trạng thái{' '}
            <strong>Đã giữ chỗ (RESERVED)</strong>. Đơn đã kích hoạt (ACTIVE) hoặc đã trả / đã hủy sẽ
            xử lý theo quy định cửa hàng — xem thêm mục hủy trong trang Chính sách.
          </p>
        </FaqItem>

        <FaqItem q="Trễ hạn trả giày thì sao?">
          <p>
            Khi trả giày <strong>sau ngày trả dự kiến</strong>, hệ thống có thể tính{' '}
            <strong>phí trễ hạn</strong> dựa trên giá thuê gốc và số ngày trễ (theo quy tắc nội bộ:
            một phần giá thuê theo ngày cho mỗi ngày trễ). Chi tiết được mô tả trong trang Chính
            sách.
          </p>
        </FaqItem>

        <FaqItem q="“Hạng” khách là gì?">
          <p>
            Mỗi khách có một <strong>hạng</strong> (ví dụ Đồng → Bạc → Vàng → Kim cương) với{' '}
            <strong>giới hạn số đôi / món đang thuê</strong> cùng lúc. Nếu bạn đã đạt giới hạn, cần
            trả giày hoặc hoàn tất đơn trước khi thuê thêm.
          </p>
        </FaqItem>

        <FaqItem q="Tại sao tôi không chọn được một size / màu?">
          <p>
            Có thể biến thể đó <strong>hết số lượng khả dụng</strong> trong kỳ bạn chọn (đã được giữ
            bởi đơn khác đang RESERVED hoặc ACTIVE trùng ngày), hoặc sản phẩm đã ngừng kinh doanh.
          </p>
        </FaqItem>

        <FaqItem q="Ảnh sản phẩm không hiển thị?">
          <p>
            Một số mã có thể dùng ảnh mẫu hoặc placeholder khi chưa tải ảnh lên hệ thống lưu trữ — phần
            giá và thông tin vẫn áp dụng bình thường.
          </p>
        </FaqItem>
      </div>

      <ContentH2>Liên hệ thêm</ContentH2>
      <p>
        Thông tin liên hệ trực tiếp nằm tại trang{' '}
        <Link to="/contact" className="text-primary font-semibold hover:underline">
          Liên hệ
        </Link>
        .
      </p>
    </ContentPageShell>
  )
}
