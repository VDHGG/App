# Tài liệu kiến trúc - Hệ thống thuê giày (Hexagonal Architecture)

## Tổng quan

Dự án áp dụng **Hexagonal Architecture** (Ports & Adapters) cho hệ thống thuê giày. Domain logic nằm ở trung tâm, các adapter (HTTP, persistence) kết nối qua các port (interface).

```
                    ┌─────────────────────────────────────────┐
                    │              HTTP / REST API             │
                    │  (CustomerController, RentalController,  │
                    │   ShoeController)                       │
                    └────────────────────┬────────────────────┘
                                         │
┌────────────────────────────────────────┼────────────────────────────────────────┐
│                                        ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         USE CASES (Application Services)                  │  │
│  │  RegisterCustomer | AddShoe | CreateRental | ActivateRental |            │  │
│  │  ReturnRental | CancelRental                                               │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                        │
│                                        ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         DOMAIN (Aggregates, VOs, Entities)               │  │
│  │  Customer | Rental | Shoe | RentalItem | RentalPeriod | ShoeVariant      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                        │
│  ┌─────────────────────────────────────┼─────────────────────────────────────┐  │
│  │              PORTS (Interfaces)     │                                     │  │
│  │  CustomerRepository | RentalRepository | ShoeRepository |                 │  │
│  │  RentalAvailabilityChecker | IdGenerator | TransactionManager             │  │
│  └─────────────────────────────────────┼─────────────────────────────────────┘  │
│                                        │                                        │
└────────────────────────────────────────┼────────────────────────────────────────┘
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │         PERSISTENCE ADAPTERS             │
                    │  MySQL (production) | InMemory (tests)   │
                    └─────────────────────────────────────────┘
```

---

## 1. Domain Layer (`src/domain/`)

### Aggregates

- **file:** `src/domain/Customer.aggregate.ts`
+ **mô tả:** Aggregate khách hàng: `id`, `fullName`, `email`, `rank`, `currentRentedItems`, `isActive`. Các phương thức: `registerRental(quantity)`, `completeRental(quantity)`, `canRent(quantity)`, `block()`, `unblock()`, `changeRank()`, `rename()`, `changeEmail()`.
+ **thể loại:** Domain Aggregate
+ **Work:** CustomerRank.enum.ts, ValidationError, BusinessRuleError

- **file:** `src/domain/Rental.aggregate.ts`
+ **mô tả:** Aggregate thuê: lifecycle `RESERVED → ACTIVE → RETURNED` hoặc `RESERVED → CANCELLED`. Các phương thức: `activate(at)`, `completeReturn(returnedAt, lateFee, note)`, `cancel(at, note)`. Tính `basePrice`, `totalAmount`, `isOverdue()`.
+ **thể loại:** Domain Aggregate
+ **Work:** RentalItem.vo.ts, RentalPeriod.vo.ts, RentalStatus.enum.ts

- **file:** `src/domain/Shoe.aggregate.ts`
+ **mô tả:** Aggregate giày: `variants`, `createRentalItem()`, `reserveVariant()`, `releaseVariant()`, `canRentVariant()`. Quản lý variants và giá thuê theo ngày.
+ **thể loại:** Domain Aggregate
+ **Work:** ShoeVariant.entity.ts, RentalItem.vo.ts, ValidationError, BusinessRuleError

### Value Objects

- **file:** `src/domain/RentalItem.vo.ts`
+ **mô tả:** Line item thuê: `shoeId`, `variantId`, `quantity`, `pricePerDay`, `subtotalFor(days)`.
+ **thể loại:** Domain Value Object
+ **Work:** (không phụ thuộc domain khác)

- **file:** `src/domain/RentalPeriod.vo.ts`
+ **mô tả:** Khoảng thời gian thuê: `startDate`, `endDate`, `durationInDays`, `overlaps()`, `contains()`.
+ **thể loại:** Domain Value Object
+ **Work:** (không phụ thuộc domain khác)

### Entities

- **file:** `src/domain/ShoeVariant.entity.ts`
+ **mô tả:** Biến thể giày: `totalQuantity`, `availableQuantity`, `reserve()`, `release()`, `hasEnough()`, `addInventory()`.
+ **thể loại:** Domain Entity
+ **Work:** (không phụ thuộc domain khác)

### Enums

- **file:** `src/domain/RentalStatus.enum.ts`
+ **mô tả:** `RESERVED`, `ACTIVE`, `RETURNED`, `CANCELLED`.
+ **thể loại:** Domain Enum
+ **Work:** (không phụ thuộc)

- **file:** `src/domain/CustomerRank.enum.ts`
+ **mô tả:** `BRONZE` (5 items), `SILVER` (10), `GOLD` (15), `DIAMOND` (unlimited).
+ **thể loại:** Domain Enum
+ **Work:** (không phụ thuộc)

### Domain Errors (`src/domain/errors/`)

- **file:** `src/domain/errors/DomainError.ts`
+ **mô tả:** Base class cho domain errors.
+ **thể loại:** Domain Error
+ **Work:** (base class)

- **file:** `src/domain/errors/ValidationError.ts`
+ **mô tả:** Lỗi validation dữ liệu.
+ **thể loại:** Domain Error
+ **Work:** DomainError

- **file:** `src/domain/errors/BusinessRuleError.ts`
+ **mô tả:** Lỗi vi phạm business rule (code + message).
+ **thể loại:** Domain Error
+ **Work:** DomainError

- **file:** `src/domain/errors/NotFoundError.ts`
+ **mô tả:** Entity không tồn tại.
+ **thể loại:** Domain Error
+ **Work:** DomainError

- **file:** `src/domain/errors/ConflictError.ts`
+ **mô tả:** Xung đột (ví dụ: trùng email).
+ **thể loại:** Domain Error
+ **Work:** DomainError

---

## 2. Ports (`src/port/`)

- **file:** `src/port/CustomerRepository.port.ts`
+ **mô tả:** `findById(id)`, `findByEmail(email)`, `save(customer)`.
+ **thể loại:** Port driven (secondary port)
+ **Work:** Customer.aggregate.ts

- **file:** `src/port/RentalRepository.port.ts`
+ **mô tả:** `findById(id)`, `findByStatus(status)`, `save(rental)`.
+ **thể loại:** Port driven (secondary port)
+ **Work:** Rental.aggregate.ts

- **file:** `src/port/ShoeRepository.port.ts`
+ **mô tả:** `findByVariantId(variantId)`, `save(shoe)`.
+ **thể loại:** Port driven (secondary port)
+ **Work:** Shoe.aggregate.ts

- **file:** `src/port/RentalAvailabilityChecker.port.ts`
+ **mô tả:** `ensureVariantAvailable(variantId, quantity, period)` – ném lỗi nếu không đủ tồn kho.
+ **thể loại:** Port driven (secondary port)
+ **Work:** RentalPeriod.vo.ts

- **file:** `src/port/IdGenerator.port.ts`
+ **mô tả:** `next()` – sinh ID duy nhất.
+ **thể loại:** Port driven (secondary port)
+ **Work:** (không phụ thuộc domain)

- **file:** `src/port/TransactionManager.port.ts`
+ **mô tả:** `runInTransaction(work)` – chạy callback trong transaction.
+ **thể loại:** Port driven (secondary port)
+ **Work:** (không phụ thuộc domain)

---

## 3. Use Cases (`src/usecase/`)

### Services

- **file:** `src/usecase/RegisterCustomer.service.ts`
+ **mô tả:** Đăng ký khách hàng mới, kiểm tra email trùng.
+ **thể loại:** Application Service (Use Case)
+ **Work:** Customer.aggregate.ts, CustomerRepository.port, IdGenerator.port, RegisterCustomerRequest.dto, RegisterCustomerResponse.dto, RegisterCustomerUseCase.port, ConflictError

- **file:** `src/usecase/AddShoe.service.ts`
+ **mô tả:** Thêm giày với các variants.
+ **thể loại:** Application Service (Use Case)
+ **Work:** Shoe.aggregate.ts, ShoeVariant.entity.ts, ShoeRepository.port, IdGenerator.port, AddShoeRequest.dto, AddShoeResponse.dto, AddShoeUseCase.port, ValidationError

- **file:** `src/usecase/CreateRental.service.ts`
+ **mô tả:** Tạo rental RESERVED, kiểm tra availability, cập nhật `currentRentedItems` của customer.
+ **thể loại:** Application Service (Use Case)
+ **Work:** Rental.aggregate.ts, RentalPeriod.vo.ts, CustomerRepository.port, ShoeRepository.port, RentalRepository.port, RentalAvailabilityChecker.port, IdGenerator.port, CreateRentalRequest.dto, CreateRentalResponse.dto, CreateRentalUseCase.port, ValidationError, NotFoundError

- **file:** `src/usecase/ActivateRental.service.ts`
+ **mô tả:** Chuyển rental từ RESERVED → ACTIVE.
+ **thể loại:** Application Service (Use Case)
+ **Work:** RentalRepository.port, ActivateRentalRequest.dto, ActivateRentalResponse.dto, ActivateRentalUseCase.port, ValidationError, NotFoundError

- **file:** `src/usecase/ReturnRental.service.ts`
+ **mô tả:** Chuyển RESERVED/ACTIVE → RETURNED, cập nhật customer.
+ **thể loại:** Application Service (Use Case)
+ **Work:** RentalRepository.port, CustomerRepository.port, ReturnRentalRequest.dto, ReturnRentalResponse.dto, ReturnRentalUseCase.port, ValidationError, NotFoundError

- **file:** `src/usecase/CancelRental.service.ts`
+ **mô tả:** Chuyển RESERVED → CANCELLED, cập nhật customer.
+ **thể loại:** Application Service (Use Case)
+ **Work:** RentalRepository.port, CustomerRepository.port, CancelRentalRequest.dto, CancelRentalResponse.dto, CancelRentalUseCase.port, ValidationError, NotFoundError

### DTOs (Request/Response)

- **file:** `src/usecase/RegisterCustomerRequest.dto.ts`
+ **mô tả:** `fullName`, `email`, `rank?`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/RegisterCustomerResponse.dto.ts`
+ **mô tả:** `customerId`, `fullName`, `email`, `rank`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/AddShoeRequest.dto.ts`
+ **mô tả:** `name`, `brand`, `category`, `pricePerDay`, `variants[]`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/AddShoeResponse.dto.ts`
+ **mô tả:** `shoeId`, `name`, `brand`, `category`, `pricePerDay`, `variantCount`, `variantIds[]`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/CreateRentalRequest.dto.ts`
+ **mô tả:** `customerId`, `items[]`, `startDate`, `endDate`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/CreateRentalResponse.dto.ts`
+ **mô tả:** `rentalId`, `customerId`, `status`, `totalItems`, `basePrice`, `totalAmount`, `startDate`, `endDate`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/ActivateRentalRequest.dto.ts`
+ **mô tả:** `rentalId`, `activatedAt?`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/ActivateRentalResponse.dto.ts`
+ **mô tả:** `rentalId`, `customerId`, `status`, `activatedAt`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/ReturnRentalRequest.dto.ts`
+ **mô tả:** `rentalId`, `returnedAt?`, `lateFee?`, `note?`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/ReturnRentalResponse.dto.ts`
+ **mô tả:** `rentalId`, `customerId`, `status`, `totalItems`, `basePrice`, `lateFee`, `totalAmount`, `returnedAt`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/CancelRentalRequest.dto.ts`
+ **mô tả:** `rentalId`, `cancelledAt?`, `note?`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

- **file:** `src/usecase/CancelRentalResponse.dto.ts`
+ **mô tả:** `rentalId`, `customerId`, `status`, `totalItems`, `cancelledAt`
+ **thể loại:** DTO
+ **Work:** (không phụ thuộc)

### Use Case Ports (Interfaces - Driving Ports)

- **file:** `src/usecase/RegisterCustomerUseCase.port.ts`
+ **mô tả:** Interface cho RegisterCustomer.
+ **thể loại:** Port driving (primary port)
+ **Work:** RegisterCustomerRequest.dto, RegisterCustomerResponse.dto

- **file:** `src/usecase/AddShoeUseCase.port.ts`
+ **mô tả:** Interface cho AddShoe.
+ **thể loại:** Port driving (primary port)
+ **Work:** AddShoeRequest.dto, AddShoeResponse.dto

- **file:** `src/usecase/CreateRentalUseCase.port.ts`
+ **mô tả:** Interface cho CreateRental.
+ **thể loại:** Port driving (primary port)
+ **Work:** CreateRentalRequest.dto, CreateRentalResponse.dto

- **file:** `src/usecase/ActivateRentalUseCase.port.ts`
+ **mô tả:** Interface cho ActivateRental.
+ **thể loại:** Port driving (primary port)
+ **Work:** ActivateRentalRequest.dto, ActivateRentalResponse.dto

- **file:** `src/usecase/ReturnRentalUseCase.port.ts`
+ **mô tả:** Interface cho ReturnRental.
+ **thể loại:** Port driving (primary port)
+ **Work:** ReturnRentalRequest.dto, ReturnRentalResponse.dto

- **file:** `src/usecase/CancelRentalUseCase.port.ts`
+ **mô tả:** Interface cho CancelRental.
+ **thể loại:** Port driving (primary port)
+ **Work:** CancelRentalRequest.dto, CancelRentalResponse.dto

---

## 4. Adapters

### HTTP Adapters (`src/adapter/http/`)

- **file:** `src/adapter/http/CustomerController.adapter.ts`
+ **mô tả:** `POST /customers` – đăng ký khách hàng.
+ **thể loại:** Adapter driving (primary adapter)
+ **Work:** RegisterCustomerUseCase.port, TransactionManager.port, customer.schema.ts

- **file:** `src/adapter/http/RentalController.adapter.ts`
+ **mô tả:** `POST /rentals` (create), `PATCH /:id/activate`, `PATCH /:id/return`, `PATCH /:id/cancel`.
+ **thể loại:** Adapter driving (primary adapter)
+ **Work:** CreateRentalUseCase.port, ActivateRentalUseCase.port, ReturnRentalUseCase.port, CancelRentalUseCase.port, TransactionManager.port

- **file:** `src/adapter/http/ShoeController.adapter.ts`
+ **mô tả:** `POST /shoes` – thêm giày.
+ **thể loại:** Adapter driving (primary adapter)
+ **Work:** AddShoeUseCase.port, TransactionManager.port, shoe.schema.ts

- **file:** `src/adapter/http/router.ts`
+ **mô tả:** Mount controllers dưới `/api/v1`.
+ **thể loại:** HTTP Router
+ **Work:** MysqlContainer, CustomerController.adapter, ShoeController.adapter, RentalController.adapter

- **file:** `src/adapter/http/customer.schema.ts`
+ **mô tả:** Zod schema cho request đăng ký customer.
+ **thể loại:** Validation Schema
+ **Work:** zod

- **file:** `src/adapter/http/rental.schema.ts`
+ **mô tả:** Zod schema cho CreateRental, ReturnRental, CancelRental.
+ **thể loại:** Validation Schema
+ **Work:** zod

- **file:** `src/adapter/http/shoe.schema.ts`
+ **mô tả:** Zod schema cho AddShoe.
+ **thể loại:** Validation Schema
+ **Work:** zod

- **file:** `src/adapter/http/middleware/errorHandler.ts`
+ **mô tả:** Map DomainError, ZodError → HTTP status (400, 404, 409, 500).
+ **thể loại:** HTTP Middleware
+ **Work:** DomainError, ValidationError, NotFoundError, ConflictError, BusinessRuleError, ZodError

### Persistence Adapters (`src/adapter/persistence/`)

- **file:** `src/adapter/persistence/MysqlCustomerRepository.adapter.ts`
+ **mô tả:** Lưu/đọc customer từ MySQL. `currentRentedItems` tính từ rentals.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** CustomerRepository.port, Customer.aggregate.ts, CustomerRank.enum, mysql2, transactionContext

- **file:** `src/adapter/persistence/MysqlRentalRepository.adapter.ts`
+ **mô tả:** Lưu rentals + rental_items.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** RentalRepository.port, Rental.aggregate.ts, RentalItem.vo.ts, RentalPeriod.vo.ts, RentalStatus.enum, transactionContext

- **file:** `src/adapter/persistence/MysqlShoeRepository.adapter.ts`
+ **mô tả:** Lưu shoes + shoe_variants. `availableQuantity` tính từ rentals khi đọc.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** ShoeRepository.port, Shoe.aggregate.ts, ShoeVariant.entity.ts, transactionContext

- **file:** `src/adapter/persistence/MysqlRentalAvailabilityChecker.adapter.ts`
+ **mô tả:** Kiểm tra tồn kho bằng overlap rentals, dùng `FOR UPDATE` để lock.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** RentalAvailabilityChecker.port, RentalPeriod.vo.ts, transactionContext, NotFoundError, BusinessRuleError

- **file:** `src/adapter/persistence/MysqlTransactionManager.adapter.ts`
+ **mô tả:** Dùng connection pool + AsyncLocalStorage để share connection trong transaction.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** TransactionManager.port, transactionContext

- **file:** `src/adapter/persistence/InMemoryCustomerRepository.adapter.ts`
+ **mô tả:** In-memory cho tests/demo.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** CustomerRepository.port, Customer.aggregate.ts

- **file:** `src/adapter/persistence/InMemoryRentalRepository.adapter.ts`
+ **mô tả:** In-memory cho tests/demo.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** RentalRepository.port, Rental.aggregate.ts

- **file:** `src/adapter/persistence/InMemoryShoeRepository.adapter.ts`
+ **mô tả:** In-memory cho tests/demo.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** ShoeRepository.port, Shoe.aggregate.ts

- **file:** `src/adapter/persistence/InMemoryRentalAvailabilityChecker.adapter.ts`
+ **mô tả:** Kiểm tra overlap qua rentals in-memory.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** RentalAvailabilityChecker.port

- **file:** `src/adapter/persistence/NoopTransactionManager.adapter.ts`
+ **mô tả:** No-op cho in-memory.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** TransactionManager.port

- **file:** `src/adapter/persistence/UuidGenerator.adapter.ts`
+ **mô tả:** Sinh UUID với prefix.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** IdGenerator.port

- **file:** `src/adapter/persistence/ShortIdGenerator.adapter.ts`
+ **mô tả:** Sinh short ID (R1, R2, …) cho demo/tests.
+ **thể loại:** Adapter driven (secondary adapter)
+ **Work:** IdGenerator.port

---

## 5. Infrastructure (`src/infra/`)

- **file:** `src/infra/Container.ts`
+ **mô tả:** DI container in-memory: dùng InMemory* adapters, ShortIdGenerator, NoopTransactionManager. Dùng cho demo và tests.
+ **thể loại:** DI Container
+ **Work:** InMemory* adapters, ShortIdGenerator, NoopTransactionManager, tất cả UseCase services

- **file:** `src/infra/MysqlContainer.ts`
+ **mô tả:** DI container MySQL: dùng Mysql* adapters, UuidGenerator. Dùng cho production.
+ **thể loại:** DI Container
+ **Work:** Mysql* adapters, UuidGenerator, tất cả UseCase services, MysqlConnection

- **file:** `src/infra/server.ts`
+ **mô tả:** Express app, mount router, error handler, dùng MysqlContainer.
+ **thể loại:** Application Bootstrap
+ **Work:** MysqlContainer, router.ts, errorHandler

- **file:** `src/infra/db/MysqlConnection.ts`
+ **mô tả:** Tạo connection pool MySQL.
+ **thể loại:** Infrastructure
+ **Work:** mysql2

- **file:** `src/infra/db/transactionContext.ts`
+ **mô tả:** AsyncLocalStorage để lưu connection trong transaction.
+ **thể loại:** Infrastructure
+ **Work:** (AsyncLocalStorage)

---

## 6. Demo & Scripts

- **file:** `src/demo.ts`
+ **mô tả:** Demo in-memory: seed data, tạo rental, test các trường hợp reject (inactive customer, insufficient stock, overlap, rank limit).
+ **thể loại:** Demo Script
+ **Work:** Container, domain aggregates, use cases

- **file:** `src/demo.mysql.ts`
+ **mô tả:** Demo với MySQL (nếu có DB).
+ **thể loại:** Demo Script
+ **Work:** MysqlContainer, domain aggregates, use cases

---

## 7. Luồng xử lý chính

### CreateRental

1. Validate request (customerId, items, startDate, endDate).
2. Load customer → NotFound nếu không có.
3. Với mỗi item: load shoe → `ensureVariantAvailable` → `createRentalItem`.
4. Tạo aggregate `Rental`.
5. `customer.registerRental(totalItems)`.
6. Save customer và rental.

### ReturnRental / CancelRental

1. Load rental → NotFound nếu không có.
2. Gọi `completeReturn` / `cancel` trên aggregate.
3. Load customer, gọi `customer.completeRental(totalItems)` nếu có.
4. Save customer và rental.

### Transaction

- Controllers wrap use case trong `TransactionManager.runInTransaction`.
- MySQL adapters dùng `transactionContext.getStore()` để share connection.
- `MysqlRentalAvailabilityChecker` dùng `FOR UPDATE` để lock row.

---

## 8. Các vấn đề logic đã phát hiện

- **#1** – **reserveVariant / releaseVariant** trong `Shoe.aggregate.ts` không được gọi bởi use case nào | Thấp | Availability được tính từ rentals (RESERVED/ACTIVE) trong `RentalAvailabilityChecker`. Có thể xóa hoặc ghi chú là dead code.
- **#2** – **Demo output** dòng "V001 after reserve" hiển thị `availableQuantity/totalQuantity` sai | Thấp | Vì không gọi `reserveVariant`, `availableQuantity` vẫn bằng `totalQuantity`. Nên sửa message hoặc tính available từ rentals.
- **#3** – **Activate endpoint** không đọc body `activatedAt` | Thấp | `ActivateRentalRequest` có `activatedAt?` nhưng controller chỉ truyền `rentalId`. Client không thể truyền `activatedAt` qua API.
- **#4** – **Return/Cancel khi customer không tồn tại** | Trung bình | Rental vẫn được cập nhật nhưng customer không. Có thể dẫn tới `currentRentedItems` không khớp nếu customer bị xóa. Cần quyết định: cho phép return orphan rental hay bắt buộc có customer.
- **#5** – **AddShoe.service.test.ts** dùng `shoeRepo['store']` (private) | Thấp | Nên dùng API công khai: `findByVariantId(result.variantIds[0])`.
- **#6** – **MysqlShoeRepository** không persist `availableQuantity` | Thiết kế | `availableQuantity` luôn tính khi đọc từ rentals. Đúng với thiết kế hiện tại.

---

## 9. Test Coverage

- **Domain** – Rental.aggregate.test.ts | 19 tests
- **Use case** – AddShoe.service.test.ts | 8 tests
- **Use case** – RegisterCustomer.service.test.ts | 7 tests
- **Use case** – ActivateRental.service.test.ts | 7 tests
- **Use case** – ReturnRental.service.test.ts | 9 tests
- **Use case** – CancelRental.service.test.ts | 9 tests

**Thiếu:** CreateRental.service.test.ts

---

## 10. Scripts npm

- `npm run dev` – Chạy Vite dev server.
- `npm run build` – Build production.
- `npm run demo` – Chạy demo in-memory.
- `npm run demo:mysql` – Chạy demo với MySQL.
- `npm run server` – Chạy Express API server.
- `npm run test` – Chạy Vitest.
- `npm run test:watch` – Chạy Vitest watch mode.
