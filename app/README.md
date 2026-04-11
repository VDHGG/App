# Rental Shoe — Hệ thống quản lý & cho thuê giày

Ứng dụng web **full-stack** (React + Express + MySQL) phục vụ cửa hàng cho thuê giày: khách duyệt catalog, đặt thuê, thanh toán trực tuyến (MoMo), wishlist và tài khoản; quản trị viên quản lý giày, đơn thuê, khách hàng, người dùng hệ thống và danh mục. Phần server được tổ chức theo **Hexagonal Architecture (Ports & Adapters)** — domain và use case tách biệt khỏi HTTP và persistence, thuận tiện kiểm thử và thay adapter.

**Tài liệu kiến trúc chi tiết (module, file, endpoint):** [READMEE.md](./READMEE.md)  
**Khung báo cáo / mô tả đề tài (repo gốc):** [../ReportFinal.md](../ReportFinal.md)

---

## Tính năng chính

| Nhóm | Nội dung |
|------|----------|
| **Storefront** | Danh sách & chi tiết giày, biến thể (size/màu), checkout thuê theo ngày |
| **Tài khoản** | Đăng ký/đăng nhập (JWT), hồ sơ, đổi mật khẩu |
| **Wishlist** | Danh sách yêu thích theo khách |
| **Thanh toán** | MoMo (tạo giao dịch, IPN, job hết hạn thanh toán PENDING) |
| **Admin** | Giày + upload ảnh (Cloudinary), thuê (kích hoạt/trả/hủy/xóa), khách, system users, brands/categories |
| **Chat AI** | `POST /api/v1/chat` — Google Gemini + tools (đơn thuê, tìm giày); context tĩnh: `knowledge/gemini-context.md` |
| **Nội dung** | How it works, FAQ, policies, contact |

---

## Kiến trúc tổng quan

```
                    ┌─────────────────────────────────────────┐
                    │         HTTP / REST API (/api/v1)       │
                    │  Auth, Customer, Shoe, Rental, Payments │
                    │  Wishlist, Chat, Catalog admin, …       │
                    └────────────────────┬────────────────────┘
                                         │
┌────────────────────────────────────────┼────────────────────────────────────────┐
│                                        ▼                                        │
│  USE CASES — Register*, Login*, CreateRental, Activate/Return/CancelRental,    │
│  List*/Get*, Wishlist, ExpirePendingOnlinePayments, Admin*, UploadShoeImage, … │
│                                        │                                        │
│                                        ▼                                        │
│  DOMAIN — Customer | Rental | Shoe | RentalItem | RentalPeriod | ShoeVariant   │
│                                        │                                        │
│  PORTS — Repository*, TransactionManager, IdGenerator, RentalAvailability…   │
└────────────────────────────────────────┼────────────────────────────────────────┘
                                         ▼
              Persistence (MySQL) · InMemory (tests) · Cloudinary · JWT (jose)
```

- **Primary adapters:** `src/adapter/http/*Controller.adapter.ts`, `router.ts`, middleware, Zod schemas.  
- **Secondary adapters:** `src/adapter/persistence/Mysql*.ts`, `InMemory*`, `JoseAccessTokenService`, `CloudinaryShoeImageService`; MoMo/Gemini qua `src/infra/`.  
- **Composition root:** `src/infra/MysqlContainer.ts` — inject implementation vào use case; `src/infra/server.ts` khởi động Express và job hết hạn thanh toán.

---

## Công nghệ

| Lớp | Công nghệ |
|-----|-----------|
| Frontend | React 19, React Router 7, Vite 7, TypeScript, Tailwind CSS |
| Backend | Express 5, Zod 4, `vite-node` |
| Dữ liệu | MySQL 8 (`mysql2`), transaction + pool |
| Auth | JWT (`jose`), bcrypt (`bcryptjs`) |
| Tích hợp | MoMo, Cloudinary, Google Gemini (`@google/generative-ai`) |
| Kiểm thử | Vitest 4 |

---

## Yêu cầu

- **Node.js** (khuyến nghị LTS, tương thích Vite 7)  
- **npm**  
- **MySQL** — tạo database và import schema: `src/infra/db/schema.sql` (và seed/script bổ sung nếu có trong repo, ví dụ `ReCreateDB.sql` ở thư mục gốc project)

---

## Cài đặt & chạy nhanh

### 1. Cài dependency

```bash
cd app
npm install
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
```

Chỉnh các biến tối thiểu: **`JWT_SECRET`** (≥ 16 ký tự), **`DB_*`**, **`PORT`**. Các nhóm tùy chọn: MoMo, Gemini, Cloudinary — xem comment trong [`.env.example`](./.env.example).

### 3. Hai terminal (dev điển hình)

**Terminal A — API Express**

```bash
npm run server
```

Mặc định: `http://localhost:3000` — API base **`/api/v1`**, health check `GET /health`.

**Terminal B — SPA Vite**

```bash
npm run dev
```

Mặc định: `http://localhost:5173` — Vite **proxy** prefix `/api` → `API_PROXY_TARGET` (thường `http://localhost:3000`), xem [`vite.config.ts`](./vite.config.ts).

**Production build frontend**

```bash
npm run build
npm run preview   # xem bản build tĩnh
```

---

## Scripts npm

| Lệnh | Mô tả |
|------|--------|
| `npm run dev` | Dev server Vite (UI) |
| `npm run server` | Chạy API Express qua `vite-node src/infra/server.ts` |
| `npm run build` | `tsc -b` + bundle Vite |
| `npm run preview` | Preview build production |
| `npm run test` | Vitest (domain + use case) |
| `npm run test:watch` | Vitest watch mode |
| `npm run lint` | ESLint |
| `npm run demo` | Demo in-memory (không MySQL) |
| `npm run demo:mysql` | Demo với MySQL |
| `npm run hash-admin-password` | Tiện ích hash mật khẩu admin |

---

## Cấu trúc thư mục `src/`

```
src/
├── domain/           # Aggregates, VO, enum, lỗi domain
├── usecase/          # Application services, DTO, *UseCase.port.ts
├── port/             # Interfaces (repository, token, transaction, …)
├── adapter/
│   ├── http/         # Controllers, router, Zod, middleware
│   ├── persistence/  # MySQL & InMemory
│   ├── auth/         # JWT adapter
│   └── cloudinary/   # Upload ảnh giày
├── infra/            # server.ts, MysqlContainer, DB, MoMo, Gemini
├── pages/            # Màn hình React
├── components/       # UI
├── lib/              # Gọi API phía client (*.api.ts)
└── auth/             # AuthContext
```

---

## API (tóm tắt)

Danh sách đầy đủ có trong response **`GET /api/v1/`** (root router) hoặc mục HTTP trong [READMEE.md](./READMEE.md). Ví dụ:

- `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `GET/PATCH /api/v1/auth/me`  
- `GET /api/v1/shoes`, `GET /api/v1/shoes/:id`  
- `POST /api/v1/rentals` (Bearer), kích hoạt/trả/hủy theo route rental  
- `GET /api/v1/rentals/me` (khách) · `GET /api/v1/rentals` (admin)  
- `POST /api/v1/payments/momo/create`, `POST .../momo/ipn`  
- `POST /api/v1/chat`  
- Wishlist, customers, system-users, catalog admin, shoe-images (admin)

---

## Cơ sở dữ liệu

- Schema tham chiếu: [`src/infra/db/schema.sql`](./src/infra/db/schema.sql)  
- Các bảng chính: `customers`, `system_users`, `roles`, `shoes`, `shoe_variants`, `rentals`, `rental_items`, `rental_payments`, `customer_wishlist`, `brands`, `categories`, `colors`, `ranks`, …

---

## Kiểm thử

```bash
npm run test
```

Tests tập trung **domain** và **use case** (`src/__tests__/`), persistence **InMemory** / mock port — phù hợp kiến trúc Hexagonal.

---

## Ghi chú triển khai

- **MoMo IPN** cần URL công khai tới API (`API_PUBLIC_BASE_URL`) nếu MoMo không gọi được `localhost` — thường dùng ngrok khi dev.  
- **FRONTEND_ORIGIN** dùng cho redirect sau thanh toán MoMo.  
- Client có thể set **`VITE_API_URL`** khi build; dev thường để trống và dùng proxy `/api`.

---

## Tài liệu liên quan

| File | Mục đích |
|------|----------|
| [READMEE.md](./READMEE.md) | Bản đồ kiến trúc Hexagonal, domain, port, adapter, use case, endpoint |
| [../ReportFinal.md](../ReportFinal.md) | Khung báo cáo / mô tả đề tài (nếu có trong repo) |
| [`.env.example`](./.env.example) | Mẫu biến môi trường và gợi ý seed tài khoản |

---

Dự án **private** — chỉnh sửa và phân phối theo quy định nhóm của bạn.
