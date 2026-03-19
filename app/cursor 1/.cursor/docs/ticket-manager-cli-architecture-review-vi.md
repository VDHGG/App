# Ticket Manager CLI - Review

**Ngày:** 2026-02-23  
**Dự án:** ticket-manager-cli (GitHub: gautrangg/ticket-manager-cli)  
**Chủ đề:** Kiểm tra tuân thủ Hexagonal Architecture

## Tóm tắt Tổng quan

Dự án này thể hiện sự hiểu biết vững chắc về các nguyên tắc Hexagonal Architecture với lớp domain được triển khai tốt. Tuy nhiên, có những vi phạm kiến trúc nghiêm trọng trong định nghĩa cổng (port) và luồng phụ thuộc (dependency flow) khiến không thể đạt được sự lỏng lẻo kết nối (loose coupling) và khả năng kiểm thử thích hợp.

**Điểm tổng thể: 6.5/10**

Ưu điểm: Lớp domain sạch, mẫu tiêm phụ thuộc thích hợp, xác thực thực thể tốt  
Vấn đề nghiêm trọng: CLI phụ thuộc vào service thay vì port, secondary ports bị đặt sai vị trí, không định nghĩa primary ports

---

## Các Vấn đề Kiến trúc Nghiêm trọng

### Vấn đề 1: CLI Phụ thuộc vào Service (không phải Port)

**Vị trí vấn đề:** `src/adapters/cli/TicketCLI.ts`

```typescript
export class TicketCLI {
  constructor(private ticketService: TicketService) {}
}
```

**Tại sao sai:** Adapter CLI trực tiếp import và phụ thuộc vào logic kinh doanh TicketService. Điều này vi phạm nguyên tắc Dependency Inversion.

**Quy tắc Kiến trúc:** Tất cả adapter phải phụ thuộc vào ports (interfaces), không bao giờ phụ thuộc vào các triển khai cụ thể (concrete).

**Tác động:**
- Không thể thay thế TicketService bằng triển khai khác mà không thay đổi CLI
- CLI bị ràng buộc chặt chẽ vào cấu trúc service
- Không thể kiểm thử CLI riêng lẻ với mock objects
- Vi phạm nguyên tắc "ports là hợp đồng"

**Cách sửa:** CLI nên phụ thuộc vào port ITicketUseCases primary thay vào đó:
```typescript
export class TicketCLI {
  constructor(private useCases: ITicketUseCases) {}
}
```

---

### Vấn đề 2: Vị trí Secondary Port (ĐÚNG - Giữ ở Ports)

**Vị trí:** `src/ports/secondary/ITicketRepository.ts`

**Phân tích:** ITicketRepository và TicketFilter đúng cách thuộc ports như một secondary port contract.

**Tại sao Đúng Giữ ở Ports:**
- ITicketRepository là một port (contract) mà adapters triển khai
- Adapters (JsonTicketRepository) nên có contracts của chúng được nhóm lại với nhau
- One-way dependency: `ports/secondary → domain/entities` (luồng sạch)
- TicketService import từ ports/secondary là chấp nhận được (services có thể phụ thuộc vào abstractions port)
- Query parameters (TicketFilter) nên thuộc repository port contract

**Lý do:**
- Secondary ports định nghĩa những gì domain cần từ infrastructure
- JsonTicketRepository (adapter) triển khai ITicketRepository (port)
- Có contracts adapters riêng biệt là mẫu kiến trúc hợp lệ
- Không có vấn đề circular dependency với cấu trúc hiện tại

**Cấu trúc Hiện tại Đúng:** Giữ `ITicketRepository.ts` trong `src/ports/secondary/ITicketRepository.ts`

---

### Vấn đề 3: Vị trí TicketFilter (ĐÚNG - Giữ ở Ports)

**Vị trí:** `src/ports/secondary/ITicketRepository.ts`

```typescript
export interface TicketFilter {
  status?: TicketStatus;
  priority?: TicketPriority;
  tags?: string[];
}
```

**Phân tích:** TicketFilter thực chất là **query contract** của repository port, không phải domain value object.

**Tại sao Đúng Giữ ở Ports:**
- TicketFilter định nghĩa CÁCH mà adapters có thể truy vấn repository (query language)
- Repository interface định nghĩa `findAll(filter?: TicketFilter)`
- Query parameters nên thuộc port, không phải domain
- Filter là **infrastructure concern** (cách để truy vấn), không phải domain concept
- One-way dependency: `ports → domain types` (không có circular dependency)

**Lý do:**
- Domain định nghĩa business rules; adapters định nghĩa query mechanisms
- TicketFilter là cách adapters nói chuyện với repository, nên ở ports
- Domain services không định nghĩa hoặc sở hữu filters; chúng chỉ sử dụng repository port

**Cấu trúc Hiện tại Thực ra Đúng:** Giữ TicketFilter trong `src/ports/secondary/ITicketRepository.ts`

---

### Vấn đề 4: Không Định nghĩa Primary Ports Interface

**Vấn đề:** Không có interface định nghĩa "use cases" hoặc "commands" mà CLI cần.

**Tại sao Quan trọng:** CLI nên phụ thuộc vào một hợp đồng (primary port) định nghĩa những gì nó có thể yêu cầu hệ thống làm. Điều này tạo ra:
- Hệ thống có thể kiểm thử được (mock port)
- CLI có thể thay thế được (có thể là web adapter thay vào đó)
- Ý định rõ ràng (danh sách tường minh các hoạt động được hỗ trợ)

**Tệp bị thiếu:** `src/ports/primary/ITicketUseCases.ts`

```typescript
export interface ITicketUseCases {
  createTicket(dto: CreateTicketDTO): Promise<Ticket>;
  getTicketById(id: string): Promise<Ticket>;
  listTickets(filter?: TicketFilter): Promise<Ticket[]>;
  updateTicketStatus(id: string, newStatus: TicketStatus): Promise<Ticket>;
  addTagToTicket(id: string, tag: string): Promise<Ticket>;
  removeTagFromTicket(id: string, tag: string): Promise<Ticket>;
  deleteTicket(id: string): Promise<void>;
}
```

**Tác động của Thiếu:** CLI trực tiếp import TicketService (không nằm sau một hợp đồng). Không có tầng abstraction giữa adapter và logic kinh doanh.

---

### Vấn đề 5: Không Có Abstraction Xử lý Lỗi

**Vấn đề:** Không có hệ thống phân cấp exception tùy chỉnh cho domain.

**Hành vi Hiện tại:** Repository và service ném generic `Error`:
```typescript
throw new Error(`Ticket with id ${id} not found`);
```

**Tại sao sai:** Generic errors không phân biệt được các lỗi logic domain với các lỗi cơ sở hạ tầng. CLI không thể xử lý các loại lỗi khác nhau một cách thích hợp.

**Nguyên tắc Kiến trúc:** Domain nên định nghĩa các exceptions cụ thể của domain.

**Tệp bị thiếu:**
- `src/domain/exceptions/DomainError.ts` - Lớp cơ sở cho tất cả lỗi domain
- `src/domain/exceptions/TicketNotFoundError.ts` - Lỗi cụ thể khi không tìm thấy ticket
- `src/domain/exceptions/InvalidTicketError.ts` - Lỗi xác thực thất bại

**Tác động:** Không thể catch các lỗi cụ thể trong CLI hoặc các adapters khác. Xử lý lỗi dễ vỡ.

---

### Vấn đề 6: JSON Repository Thiếu Xử lý Lỗi

**Vị trí vấn đề:** `src/adapters/persistence/JsonTicketRepository.ts`

```typescript
const ticketsData: TicketProps[] = JSON.parse(data);  // Không có try-catch
```

**Rủi ro:** Nếu tệp JSON bị hỏng, JSON.parse ném generic SyntaxError với thông báo kém.

**Cách sửa:** Bọc trong try-catch và ném exception domain:
```typescript
try {
  const ticketsData = JSON.parse(data);
} catch (error) {
  throw new Error(`Corrupted tickets file: ${error.message}`);
}
```

---

## Điểm Số Chi Tiết

| Thành phần | Điểm | Ghi chú |
|-----------|------|---------|
| Tách rời Mối quan tâm | 8/10 | Phân lớp tốt, nhưng ranh giới adapter mờ |
| Dependency Inversion | 5/10 | Service thiếu primary port; domain import ports |
| Khả năng Kiểm thử | 6/10 | Lớp domain có thể kiểm thử, nhưng CLI bị ràng buộc chặt |
| Xử lý Lỗi | 4/10 | Không có abstraction exception; generic errors |
| Định nghĩa Port | 4/10 | Không primary ports; secondary ports sai vị trí |
| Thiết kế Entity | 9/10 | Đóng gói tuyệt vời, xác thực, bất biến |
| Triển khai Repository | 8/10 | Mã sạch, logic filtering tốt |
| Triển khai Adapter | 7/10 | CLI commands tốt, nhưng phụ thuộc sai |
| Kiến trúc Tổng thể | 6.5/10 | Nền tảng tốt, nhưng vi phạm các nguyên tắc cốt lõi |

---

## So sánh Kiến trúc

### Luồng Phụ thuộc Hiện tại (SAI)

```
CLI Adapter → TicketService (direct import)
             ↓
         ITicketRepository (trong ports/)
             ↓
    JsonTicketRepository
```

Vấn đề: CLI phụ thuộc trực tiếp vào logic kinh doanh, không phải hợp đồng.

### Luồng Phụ thuộc Đúng

```
CLI Adapter → ITicketUseCases (primary port)
             ↓
         TicketService (implements primary port)
             ↓
         ITicketRepository (trong domain/ports)
             ↓
    JsonTicketRepository
```

Tất cả mũi tên chỉ vào trong hướng domain. Adapters phụ thuộc vào ports, không bao giờ vào adapters khác hoặc trực tiếp vào services.

---

## Cấu Trúc Tệp Được Sửa Chữa

```
src/
├── domain/
│   ├── entities/
│   │   ├── Ticket.ts
│   │   └── index.ts
│   ├── exceptions/              [THƯMỤC MỚI]
│   │   ├── DomainError.ts       [MỚI]
│   │   ├── TicketNotFoundError.ts [MỚI]
│   │   ├── InvalidTicketError.ts [MỚI]
│   │   └── index.ts             [MỚI]
│   ├── services/
│   │   ├── TicketService.ts     [SỬA ĐỔI - cập nhật imports]
│   │   └── index.ts
├── ports/
│   ├── secondary/
│   │   ├── ITicketRepository.ts [GIỮỮ NGUYÊN với TicketFilter]
│   │   └── index.ts
│   ├── primary/                 [THƯMỤC MỚI]
│   │   ├── ITicketUseCases.ts   [MỚI]
│   │   └── index.ts             [MỚI]
│   └── index.ts
└── adapters/
    ├── cli/
    │   ├── TicketCLI.ts         [SỬA ĐỔI - cập nhật phụ thuộc]
    │   └── index.ts
    └── persistence/
        ├── JsonTicketRepository.ts [SỬA ĐỔI - cập nhật imports]
        └── index.ts
```

**Điểm Chính:** ITicketRepository và TicketFilter ở `src/ports/secondary/`

**Lý do:**
- TicketFilter là query contract (infrastructure concern), thuộc ports
- One-way dependency: `ports/secondary → domain/entities` (sạch)
- Không có circular imports hoặc bidirectional dependencies

---

## Hướng dẫn Huấn luyện: Kế hoạch Refactor 14 Bước

### Bước 1: Hiểu Trạng thái Hiện tại (Xác thực)
- Xác nhận hiểu biết tại sao mỗi vấn đề vi phạm kiến trúc
- Bạn có thể giải thích: "Tại sao CLI không nên phụ thuộc vào TicketService?"
- Câu trả lời đúng: Adapters nên phụ thuộc vào ports (hợp đồng), không phải logic kinh doanh, vì vậy adapters có thể thay thế được

### Bước 2: Lập Kế hoạch Refactor (Tài liệu)
Tạo tệp: `docs/plans/2026-02-23/ticket-manager-cli-refactor.md`
- Liệt kê tệp cần TẠO, SỬA ĐỔI, XÓA
- Ánh xạ các thay đổi phụ thuộc trước/sau cho mỗi tệp
- Định nghĩa cấu trúc thư mục mới

### Bước 3: Tạo Domain Exceptions
Tạo tệp:
- `src/domain/exceptions/DomainError.ts` - Lớp lỗi cơ sở
- `src/domain/exceptions/TicketNotFoundError.ts` - Lỗi không tìm thấy
- `src/domain/exceptions/InvalidTicketError.ts` - Lỗi xác thực
- `src/domain/exceptions/index.ts` - Barrel export

Xác thực: `npm run build`

### Bước 4: Cập nhật TicketService để Ném Domain Exceptions
Sửa đổi: `src/domain/services/TicketService.ts`
- Giữ import: `import { ITicketRepository } from '../../ports/secondary/ITicketRepository'` (không cần thay đổi)
- Cập nhật generic `Error` throws thành domain exceptions
- Ví dụ: Thay `throw new Error(...)` bằng `throw new TicketNotFoundError(id)`

Xác thực: `npm run build`

### Bước 5: Tạo Primary Port (Use Cases Interface)
Tạo tệp: `src/ports/primary/ITicketUseCases.ts`
- Import tất cả các loại cần thiết: Ticket, TicketStatus, CreateTicketDTO, TicketFilter, v.v.
- Định nghĩa interface với tất cả các phương thức công khai từ TicketService
- Tạo barrel export

Xác thực: `npm run build`

### Bước 6: Tạo TicketService Triển khai Primary Port
Sửa đổi: `src/domain/services/TicketService.ts`
- Thêm: `implements ITicketUseCases` vào khai báo lớp
- Không cần thay đổi mã, chỉ thêm type assertion

Xác thực: `npm run build`

### Bước 7: Cập nhật CLI để Phụ thuộc vào Primary Port
Sửa đổi: `src/adapters/cli/TicketCLI.ts`
- Import: `import { ITicketUseCases } from '../../ports/primary/...'`
- Thay constructor: `constructor(private useCases: ITicketUseCases)`
- Thay thế tất cả `this.ticketService` bằng `this.useCases`

Xác thực: `npm run build && npm run dev list`

### Bước 8: Thêm Xử lý Lỗi vào JsonTicketRepository
Sửa đổi: `src/adapters/persistence/JsonTicketRepository.ts`
- Bọc JSON.parse trong try-catch block
- Ném lỗi có ý nghĩa nếu JSON bị hỏng

Xác thực: `npm run build`

### Bước 9: Cập nhật Entry Point
Sửa đổi: `src/index.ts`
- Không cần thay đổi mã nếu tất cả imports được cập nhật trong các bước trước
- Xác minh nó vẫn đúng cách kết nối các phụ thuộc

Xác thực: `npm run build && npm run dev create -- -t "Test" -d "Test" -p HIGH`

### Bước 10: Chạy Bộ Kiểm thử Hoàn chỉnh
```bash
npm run build
npm test
npm run test:coverage
```

Tất cả các kiểm thử phải vượt qua không có lỗi TypeScript.

### Bước 11: Kiểm thử Thủ công End-to-End
Kiểm thử tất cả CLI commands:
```bash
npm run dev create -- -t "Test Ticket" -d "Test Description" -p HIGH --tags "test"
npm run dev list
npm run dev list -- --status OPEN
npm run dev show <ticket-id>
npm run dev update <ticket-id> -- --status IN_PROGRESS
```

Tất cả các lệnh nên hoạt động giống hệt như trước khi refactor.

---

## Tiêu chí Thành công

### Chất lượng Mã
- Không có circular imports
- Tất cả imports biên dịch sạch
- Không có cảnh báo hoặc lỗi TypeScript
- Domain exceptions được triển khai và sử dụng đúng cách
- JSON parsing có xử lý lỗi

### Kiến trúc
- CLI chỉ import từ ports/primary
- TicketService import từ ports/secondary (chấp nhận được cho services)
- JsonTicketRepository import từ ports/secondary
- ITicketRepository nằm trong ports/secondary (query contract)
- Tất cả các mũi tên phụ thuộc chỉ vào trong hướng domain

### Kiểm thử
- `npm run build` thành công
- `npm test` vượt qua 100%
- `npm run test:coverage` đáp ứng ngưỡng
- Kiểm thử CLI thủ công tất cả vượt qua
- Không có thay đổi hành vi từ góc độ người dùng cuối

### Xác minh Khả năng Kiểm thử
- Bạn có thể tạo mock ITicketUseCases và chuyển nó tới TicketCLI?
- Bạn có thể thay JsonTicketRepository bằng PostgresTicketRepository mà không sửa đổi TicketService?
- Bạn có thể thêm adapter REST API mà không chạm vào domain hoặc CLI?

Nếu có cho tất cả ba: Kiến trúc là đúng.

---

## Rủi ro & Giảm thiểu

| Rủi ro | Tác động | Giảm thiểu |
|--------|---------|-----------|
| Làm hỏng các kiểm thử hiện có | Trung bình | Chạy `npm test` sau mỗi bước; khôi phục nếu cần |
| Bỏ qua tham chiếu import | Trung bình | Dùng `grep -r` để tìm đường dẫn cũ trước khi xóa |
| Circular imports | Cao | Kiểm tra đầu ra trình biên dịch cẩn thận; theo dõi đồ thị import |
| Thay đổi hành vi CLI | Cao | Kiểm thử thủ công tất cả lệnh sau bước 9 |
| Lỗi loại từ thay đổi port | Trung bình | TypeScript sẽ bắt; sửa khi trình biên dịch báo |

---

## Các Điểm Quyết định

### 1. Chiến lược Mã Lỗi
Nên DomainError bao gồm mã lỗi (ví dụ: ERR_TICKET_001)?
- **Có:** Thêm trường `code: string`, kích hoạt xử lý lỗi theo chương trình
- **Không:** Giữ đơn giản chỉ với tin nhắn, giảm độ phức tạp

Khuyến nghị: **Không** - bắt đầu đơn giản, thêm mã nếu cần sau

### 2. Tính Bất biến của TicketFilter
Nên TicketFilter là bất biến hoặc có thể thay đổi?
- **Bất biến:** Mẫu value object tốt hơn, ngăn chặn các đột biến tình cờ
- **Có thể thay đổi:** Đơn giản hơn, cho phép gán property tùy chọn

Khuyến nghị: **Bất biến** - tuân theo mẫu value object

### 3. Chiến lược Ném Exception
Nên ném exception ở đâu?
- **Lớp Domain:** TicketService và Ticket entity ném domain exceptions
- **Lớp Adapter:** JsonTicketRepository ném domain exceptions
- **CLI adapter:** Bắt exceptions và chuyển đổi thành tin nhắn người dùng

Khuyến nghị: **Cả hai lớp domain và adapter** - domain ném domain exceptions, repository bọc I/O errors thành domain exceptions

---

## Sau Khi Hoàn thành

### Tài liệu
Tạo: `docs/notes/2026-02-23/ticket-manager-cli-refactor.md`

Ghi chép:
- Những vấn đề kiến trúc nào được sửa chữa
- Tệp nào được tạo/sửa đổi/xóa
- Kết quả kiểm thử xác thực
- Bất kỳ vấn đề không lường trước nào và cách giải quyết

### Cải thiện Tiếp theo (Tùy chọn)
1. Thêm adapter REST API (tái sử dụng cùng service)
2. Thêm kiểm thử tích hợp cho repository
3. Thêm error boundary trong CLI (catch tất cả domain errors)
4. Thêm adapter logging
5. Thêm adapter persistence cho PostgreSQL

---

## Các Bài học Chính

1. **Ports là Hợp đồng:** Tất cả adapters phải phụ thuộc vào ports (interfaces), không bao giờ vào các triển khai cụ thể
2. **Domain Định nghĩa Ports:** Lớp domain định nghĩa những gì nó cần (ports); adapters triển khai chúng
3. **Phụ thuộc Chỉ vào Trong:** Tất cả các mũi tên nên chỉ vào lớp domain, không bao giờ ra ngoài
4. **Primary vs Secondary:**
   - Primary ports: Những gì hệ thống cung cấp (use cases)
   - Secondary ports: Những gì hệ thống cần (repositories, services)
5. **Quy tắc Hexagonal:** Adapters có thể phụ thuộc vào ports; domain/services có thể phụ thuộc vào secondary ports; không ai phụ thuộc vào adapters

---

**Trạng thái:** Sẵn sàng triển khai  
**Thời gian Ước tính:** 2-3 giờ  
**Độ Khó:** Trung bình (refactoring, không phải tính năng mới)  
**Bảo hiểm Kiểm thử:** Được duy trì hoặc cải thiện
