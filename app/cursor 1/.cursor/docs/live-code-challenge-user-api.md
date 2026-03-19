# Live Code Challenge: User API with HTTP Calls & In-Memory Repository

**Duration:** 60 minutes (45 min code + 15 min review)  
**Difficulty:** Intermediate (Hexagonal Architecture + HTTP + Storage)  
**Tech Stack:** TypeScript, Node.js, Fetch API / Axios

---

## Challenge Goal

Build a User Management API with:
1. External HTTP calls (GET user from external API)
2. In-memory repository (store enriched user data)
3. Proper layering (Domain → Application → Adapters)
4. Domain validation rules

---

## Problem Statement

You need to build a User Service that:
- Fetches user data from an external API (https://jsonplaceholder.typicode.com/users/:id)
- Enriches data with custom business rules
- Stores enriched users in memory
- Provides API endpoints to list/get/update users

**Constraints:**
- Must follow Hexagonal Architecture
- In-memory storage (no database)
- External API calls (cannot mock)
- Must validate domain rules

---

## Requirements

### Functional Requirements

1. **Create User (from external API)**
   - Input: User ID
   - Action: Fetch from external API, validate, store locally
   - Output: Enriched user object

2. **List Users**
   - Return all stored users
   - Filter by status (active, inactive)

3. **Get User by ID**
   - Return user if exists
   - Throw error if not found

4. **Update User Status**
   - Change status (active ↔ inactive)
   - Cannot deactivate user with active subscriptions (business rule)
   - Update timestamp

5. **Error Handling**
   - Handle external API failures
   - Validate data integrity
   - Provide meaningful error messages

### Technical Requirements

```
src/
├── domain/
│   ├── entities/           User entity with validation
│   ├── value-objects/      Status enum
│   └── ports/              UserRepository interface
├── application/
│   └── use-cases/          CreateUser, ListUsers, GetUser, UpdateStatus
├── adapters/
│   ├── http/               Express server
│   ├── external/           External API client
│   └── persistence/        In-memory repository
└── __tests__/              Unit tests
```

---

## Data Model

### User Entity
```
{
  id: string (UUID)
  externalId: number (from external API)
  name: string
  email: string
  phone: string
  status: 'active' | 'inactive'
  subscriptionCount: number
  synced: boolean
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}
```

### Business Rules
1. Cannot deactivate user with `subscriptionCount > 0`
2. Status change triggers timestamp update
3. User synced at timestamp on creation from external API
4. Email must be valid format
5. Cannot create user if external API returns error

---

## API Endpoints (Implementation Target)

```bash
# POST /users - Create user from external API
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"externalId": 1}'

# GET /users - List all users
curl http://localhost:3000/users

# GET /users/:id - Get user by ID
curl http://localhost:3000/users/123e4567-e89b-12d3-a456-426614174000

# PATCH /users/:id/status - Update user status
curl -X PATCH http://localhost:3000/users/123e4567-e89b-12d3-a456-426614174000/status \
  -H "Content-Type: application/json" \
  -d '{"status": "inactive"}'

# GET /users/external/:externalId - Get user by external API ID
curl http://localhost:3000/users/external/1
```

---

## Acceptance Criteria

### Architecture Validation
- Domain layer has NO external dependencies (no HTTP, no storage)
- Use cases orchestrate domain + ports
- Adapters implement ports (not the reverse)
- No business logic in adapters

### Functional Validation
- All 5 endpoints respond with 200/201 on success
- Validation errors return 400 with error message
- Business rule violations return 409
- External API failures return 503

### Code Quality
- No `any` types
- Proper error handling (try-catch)
- Use cases testable with mock repository
- Repository interface clearly defined

### Testing
- 15+ unit tests minimum
- Domain entity validation tests
- Use case tests with mock repository
- HTTP adapter tests (mock external API)

---

## Decision Points (Before You Start)

**Answer these before coding:**

1. **HTTP Library?**
   - Node.js `fetch` (built-in v18+)
   - Or Axios (need to npm install)

2. **Server Framework?**
   - Express.js (lightweight)
   - Or Fastify (faster, modern)

3. **Error Handling Strategy?**
   - Custom exception classes (DomainError, ValidationError, ExternalServiceError)
   - Or generic Error with types field

4. **In-Memory Storage Sync?**
   - Map<string, User> for ID lookup
   - Plus Array<User> for listings

5. **Testing Strategy?**
   - Jest (unit tests only)
   - Or with Supertest (integration tests with HTTP)

---

## Success Metrics

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Architecture | Hexagonal pattern correct | Domain imports nothing; adapter imports domain |
| Functionality | All 5 endpoints work | Manual curl tests |
| Validation | Business rules enforced | Cannot deactivate user with subscriptions |
| Code Quality | No `any` types | `npm run build` succeeds, no TypeScript errors |
| Testing | 15+ tests passing | `npm test` shows all green |
| Error Handling | Meaningful errors | 400/409/503 responses with messages |

---

## Difficulty Progression

**Level 1 (Easy):** Just create, list, get (no external API)
**Level 2 (Medium):** Add external API calls + in-memory storage
**Level 3 (Hard):** Add business rules + proper error handling + full tests

Start with Level 1, upgrade to Level 2, then Level 3 if time permits.

---

## Constraints & Assumptions

**Time Budget:**
- 15 min: Setup + architecture planning
- 25 min: Implementation (domain + use cases)
- 15 min: HTTP adapter
- 10 min: Testing + debugging
- 5 min: Buffer

**Assumptions:**
- External API (jsonplaceholder) is always available
- In-memory storage is sufficient (no persistence)
- Single-threaded execution (no concurrency issues)
- Tests don't need to hit real external API (mock it)

**Risks:**
- External API slow → timeout handling needed
- In-memory storage lost on restart → acceptable
- Time runs out → prioritize MVP (create, list, get)

---

## Example Live Code Execution

### Phase 1: Domain (5 min)
```typescript
// src/domain/entities/User.ts
export class User {
  constructor(
    readonly id: string,
    readonly externalId: number,
    readonly name: string,
    readonly email: string,
    readonly status: 'active' | 'inactive',
    readonly subscriptionCount: number
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.email.includes('@')) throw new Error('Invalid email');
    if (this.subscriptionCount < 0) throw new Error('Invalid subscription count');
  }

  deactivate(): void {
    if (this.subscriptionCount > 0) {
      throw new Error('Cannot deactivate user with active subscriptions');
    }
    this.status = 'inactive';
  }
}
```

### Phase 2: Use Cases (10 min)
```typescript
// src/application/use-cases/CreateUserUseCase.ts
export class CreateUserUseCase {
  constructor(
    private externalAPI: ExternalUserAPI,
    private repository: UserRepository
  ) {}

  async execute(externalId: number): Promise<User> {
    const externalUser = await this.externalAPI.getUser(externalId);
    const user = new User(
      crypto.randomUUID(),
      externalId,
      externalUser.name,
      externalUser.email,
      'active',
      0
    );
    await this.repository.save(user);
    return user;
  }
}
```

### Phase 3: Adapters (15 min)
```typescript
// src/adapters/http/server.ts
const app = express();
app.post('/users', async (req, res) => {
  try {
    const user = await createUserUseCase.execute(req.body.externalId);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// src/adapters/external/JSONPlaceholderAPI.ts
export class JSONPlaceholderAPI implements ExternalUserAPI {
  async getUser(id: number): Promise<any> {
    const response = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  }
}

// src/adapters/persistence/InMemoryUserRepository.ts
export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
}
```

### Phase 4: Testing (5 min)
```typescript
// src/__tests__/application/CreateUserUseCase.test.ts
describe('CreateUserUseCase', () => {
  test('should create user from external API', async () => {
    const mockAPI = { getUser: jest.fn().mockResolvedValue({ name: 'John', email: 'john@example.com' }) };
    const mockRepo = { save: jest.fn() };
    const useCase = new CreateUserUseCase(mockAPI, mockRepo);

    const user = await useCase.execute(1);

    expect(user.externalId).toBe(1);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  test('should throw error if deactivate user with subscriptions', () => {
    const user = new User('123', 1, 'John', 'john@example.com', 'active', 1);
    expect(() => user.deactivate()).toThrow();
  });
});
```

---

## Evaluation Rubric

| Criteria | Excellent | Good | Needs Work |
|----------|-----------|------|-----------|
| **Architecture** | Hexagonal pattern perfect; all layers separated | Mostly separated; one minor violation | Multiple violations |
| **Functionality** | All 5 endpoints work | 3-4 endpoints work | <3 endpoints |
| **Business Rules** | Correctly enforced | Partially enforced | Not enforced |
| **Error Handling** | Custom exceptions; proper status codes | Generic errors; some status codes | No error handling |
| **Code Quality** | No `any`; clean; DRY | Minimal `any`; mostly clean | Multiple `any`; repetition |
| **Testing** | 15+ tests; all pass | 10-14 tests; mostly pass | <10 tests; some fail |

---

## Hints (If Stuck)

1. **Domain shouldn't know about HTTP:** Move fetch logic to adapter
2. **Can't deactivate with subscriptions:** Check this in domain, not adapter
3. **In-memory storage:** Use Map<string, User> for fast lookups
4. **External API calls:** Mock in tests, use real in development
5. **Type safety:** Define interfaces for external API responses
6. **Status codes:** 201 for create, 400 for validation, 409 for business rule
7. **Error messages:** Be specific ("Cannot deactivate: user has 2 subscriptions")

---

## Delivery (At End of Session)

Organize code as:
```
src/
├── domain/entities/User.ts
├── domain/value-objects/UserStatus.ts
├── domain/ports/UserRepository.ts
├── domain/ports/ExternalUserAPI.ts
├── application/use-cases/*.ts
├── adapters/http/server.ts
├── adapters/external/JSONPlaceholderAPI.ts
├── adapters/persistence/InMemoryUserRepository.ts
└── __tests__/*.test.ts

npm test       # Should pass 15+ tests
npm start      # Server runs on localhost:3000
npm run build  # TypeScript compiles cleanly
```

---

**Estimated Time:** 60 minutes  
**Start with:** Architecture planning (5 min) before coding

Good luck!
