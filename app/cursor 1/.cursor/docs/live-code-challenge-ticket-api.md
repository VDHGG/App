# Live Code Challenge: Ticket Management REST API

**Duration:** 60 minutes (45 min code + 15 min review)  
**Difficulty:** Intermediate (Hexagonal Architecture + REST API + Storage)  
**Tech Stack:** TypeScript, Node.js, Express, Fetch API

---

## Challenge Goal

Build a Ticket Management REST API with:
1. REST endpoints (create, delete, update status, assign)
2. In-memory repository
3. Proper layering (Domain → Application → Adapters)
4. Domain validation rules

---

## Problem Statement

You need to build a Ticket Service that:
- Creates tickets with basic information
- Assigns tickets to handlers/team members
- Updates ticket status through workflow
- Deletes tickets
- Stores all data in memory
- Validates business rules

**Constraints:**
- Must follow Hexagonal Architecture
- In-memory storage (no database)
- REST API (not CLI)
- Must validate domain rules

---

## Requirements

### Data Model

**Ticket Entity:**
```
{
  id: string (UUID)
  title: string
  description: string
  author: string (email)
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  assignedTo: string | null (email of handler)
  createdAt: Date
  updatedAt: Date
}
```

### Functional Requirements

1. **Create Ticket**
   - Input: title, description, author
   - Output: Created ticket with ID
   - Validation: title required, description required, valid email

2. **List Tickets**
   - Return all tickets
   - Filter by status (optional)
   - Filter by assignedTo (optional)

3. **Get Ticket by ID**
   - Return ticket if exists
   - Throw error if not found

4. **Update Ticket Status**
   - Change status (open → in_progress → resolved → closed)
   - Cannot change status of deleted ticket
   - Status transitions must follow workflow

5. **Assign Ticket**
   - Assign to handler/team member (by email)
   - Can only assign if status is 'open' or 'in_progress'
   - Cannot assign to same person twice

6. **Delete Ticket**
   - Soft or hard delete (choose one)
   - Cannot reassign after delete
   - Cannot update status after delete

### Business Rules

1. Status workflow: `open` → `in_progress` → `resolved` → `closed`
   - Cannot skip steps (must go in order)
   - Cannot go backwards

2. Assignment rules:
   - Can only assign if ticket is `open` or `in_progress`
   - Cannot assign to author
   - Cannot unassign (must go through delete or resolve)

3. Deletion rules:
   - After deletion, cannot reassign or update status
   - Keep ticket in system (soft delete) or remove (hard delete)

4. Validation:
   - Title: required, max 200 chars
   - Description: required, max 2000 chars
   - Email: valid format
   - Status: only valid transitions allowed

---

## API Endpoints

```bash
# POST /tickets - Create ticket
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Login bug",
    "description": "Users cannot login with email",
    "author": "user@example.com"
  }'

# GET /tickets - List tickets (with optional filters)
curl "http://localhost:3000/tickets"
curl "http://localhost:3000/tickets?status=open"
curl "http://localhost:3000/tickets?assignedTo=handler@example.com"

# GET /tickets/:id - Get ticket by ID
curl http://localhost:3000/tickets/123e4567-e89b-12d3-a456-426614174000

# PATCH /tickets/:id/status - Update status
curl -X PATCH http://localhost:3000/tickets/123e4567-e89b-12d3-a456-426614174000/status \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'

# PATCH /tickets/:id/assign - Assign ticket
curl -X PATCH http://localhost:3000/tickets/123e4567-e89b-12d3-a456-426614174000/assign \
  -H "Content-Type: application/json" \
  -d '{"assignedTo": "handler@example.com"}'

# DELETE /tickets/:id - Delete ticket
curl -X DELETE http://localhost:3000/tickets/123e4567-e89b-12d3-a456-426614174000
```

---

## Architecture Structure

```
src/
├── domain/
│   ├── entities/
│   │   └── Ticket.ts              Ticket entity with validation + business logic
│   ├── value-objects/
│   │   └── TicketStatus.ts        Status enum with transition rules
│   └── ports/
│       └── TicketRepository.ts    Interface (repository contract)
├── application/
│   ├── use-cases/
│   │   ├── CreateTicketUseCase.ts
│   │   ├── ListTicketsUseCase.ts
│   │   ├── GetTicketUseCase.ts
│   │   ├── UpdateStatusUseCase.ts
│   │   ├── AssignTicketUseCase.ts
│   │   └── DeleteTicketUseCase.ts
│   └── dtos/
│       ├── CreateTicketInput.ts
│       ├── TicketOutput.ts
│       └── UpdateStatusInput.ts
├── adapters/
│   ├── primary/
│   │   └── http/
│   │       └── TicketController.ts Express routes + handlers
│   └── secondary/
│       └── persistence/
│           └── InMemoryTicketRepository.ts In-memory storage
└── __tests__/
    ├── domain/
    │   └── Ticket.test.ts
    ├── application/
    │   ├── CreateTicketUseCase.test.ts
    │   └── UpdateStatusUseCase.test.ts
    └── adapters/
        └── TicketController.test.ts
```

---

## Technical Details

### Ticket Entity Implementation Goals

```typescript
// src/domain/entities/Ticket.ts
export class Ticket {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly description: string,
    readonly author: string,
    private _status: TicketStatus,
    private _assignedTo: string | null,
    readonly createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validate();
  }

  // Getters for immutability
  get status(): TicketStatus { ... }
  get assignedTo(): string | null { ... }
  get updatedAt(): Date { ... }

  // Business methods
  updateStatus(newStatus: TicketStatus): void { ... }
  assignTo(email: string): void { ... }
  canDelete(): boolean { ... }

  // Validation
  private validate(): void { ... }
  private static validateEmail(email: string): boolean { ... }
}
```

### Status Transitions

```typescript
// src/domain/value-objects/TicketStatus.ts
export class TicketStatus {
  static readonly OPEN = new TicketStatus('open');
  static readonly IN_PROGRESS = new TicketStatus('in_progress');
  static readonly RESOLVED = new TicketStatus('resolved');
  static readonly CLOSED = new TicketStatus('closed');

  canTransitionTo(newStatus: TicketStatus): boolean {
    // open → in_progress → resolved → closed
    // No backwards, no skipping
    const workflow = ['open', 'in_progress', 'resolved', 'closed'];
    const currentIndex = workflow.indexOf(this.value);
    const nextIndex = workflow.indexOf(newStatus.value);
    return nextIndex === currentIndex + 1;
  }
}
```

### Use Case Example

```typescript
// src/application/use-cases/AssignTicketUseCase.ts
export class AssignTicketUseCase {
  constructor(private repository: TicketRepository) {}

  async execute(id: string, assignedTo: string): Promise<TicketOutput> {
    const ticket = await this.repository.findById(id);
    if (!ticket) throw new Error('Ticket not found');

    ticket.assignTo(assignedTo); // Business rule check happens here
    await this.repository.save(ticket);

    return this.toOutput(ticket);
  }
}
```

### In-Memory Repository

```typescript
// src/adapters/secondary/persistence/InMemoryTicketRepository.ts
export class InMemoryTicketRepository implements TicketRepository {
  private tickets = new Map<string, Ticket>();
  private deleted = new Set<string>(); // Track deleted IDs

  async save(ticket: Ticket): Promise<void> {
    this.tickets.set(ticket.id, ticket);
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.tickets.get(id) || null;
  }

  async findAll(filters?: { status?: string; assignedTo?: string }): Promise<Ticket[]> {
    let results = Array.from(this.tickets.values());
    if (filters?.status) {
      results = results.filter(t => t.status.toString() === filters.status);
    }
    if (filters?.assignedTo) {
      results = results.filter(t => t.assignedTo === filters.assignedTo);
    }
    return results;
  }

  async delete(id: string): Promise<void> {
    this.tickets.delete(id);
    this.deleted.add(id);
  }
}
```

---

## REST Controller Implementation

```typescript
// src/adapters/primary/http/TicketController.ts
export class TicketController {
  constructor(
    private createUseCase: CreateTicketUseCase,
    private listUseCase: ListTicketsUseCase,
    private getUseCase: GetTicketUseCase,
    private updateStatusUseCase: UpdateStatusUseCase,
    private assignUseCase: AssignTicketUseCase,
    private deleteUseCase: DeleteTicketUseCase
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.createUseCase.execute(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    const filters = {
      status: req.query.status as string | undefined,
      assignedTo: req.query.assignedTo as string | undefined
    };
    const result = await this.listUseCase.execute(filters);
    res.json(result);
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.updateStatusUseCase.execute(req.params.id, req.body.status);
      res.json(result);
    } catch (error) {
      res.status(409).json({ error: error.message }); // 409 for business rule
    }
  }

  async assign(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.assignUseCase.execute(req.params.id, req.body.assignedTo);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await this.deleteUseCase.execute(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}
```

---

## Acceptance Criteria

### Architecture Validation
- Domain has NO HTTP, NO storage, NO external calls
- Use cases orchestrate domain + ports
- Adapters implement ports (not reverse)
- No business logic in adapters

### Functional Validation
- All 6 endpoints respond correctly (201/200/204/400/409)
- Status transitions enforced
- Assignment rules enforced
- Cannot update deleted tickets
- Filtering works (by status, assignedTo)

### Business Rules Validation
- Can only assign if status is open/in_progress
- Cannot assign to author
- Cannot reassign same person
- Status transitions follow workflow
- Cannot delete already deleted

### Error Handling
- 400: Validation errors (title too long, invalid email)
- 404: Ticket not found
- 409: Business rule violation (wrong status transition)
- 201: Create successful
- 204: Delete successful

### Code Quality
- No `any` types
- Proper error classes
- Use case tests with mock repository
- Domain entity tests

### Testing
- 20+ unit tests minimum
- Ticket entity tests (validation, transitions)
- Use case tests (all 6 use cases)
- Status transition tests

---

## Decision Points (Answer Before Coding)

1. **Soft or Hard Delete?**
   - Soft: Keep in memory but mark deleted
   - Hard: Remove completely from storage

2. **Error Classes?**
   - Custom (TicketNotFoundError, InvalidStatusTransition)
   - Or generic with type field

3. **DTO Required?**
   - Yes: Separate input/output models
   - Minimal: Direct entity response

4. **Testing Library?**
   - Jest only (unit tests)
   - Jest + Supertest (integration with HTTP)

---

## Success Metrics

| Metric | Target | Verify |
|--------|--------|--------|
| Architecture | Hexagonal correct | Domain imports nothing |
| All 6 Endpoints | Working | Manual curl tests |
| Business Rules | All enforced | Cannot violate rules |
| Status Workflow | Enforced | Cannot skip steps |
| Assignment Rules | Enforced | Cannot assign to author |
| Error Codes | Correct | 400/404/409 used right |
| Code Quality | No `any` | Build succeeds |
| Tests | 20+ passing | All green |

---

## Difficulty Progression

**Level 1 (Easy):** Create, List, Get (basic CRUD)
**Level 2 (Medium):** Add Delete + Update Status with workflow
**Level 3 (Hard):** Add Assign + full business rules + 20+ tests

---

## Time Breakdown

- 5 min: Architecture planning
- 10 min: Domain layer (Ticket + TicketStatus)
- 10 min: Use cases (all 6)
- 15 min: HTTP adapter (routes + controller)
- 10 min: In-memory repository
- 7 min: Testing
- 3 min: Manual verification

---

## Example Workflow

```bash
# 1. Create ticket
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{"title": "Login bug", "description": "Cannot login", "author": "user@example.com"}'
# Response: 201 with ticket ID

# 2. List open tickets
curl "http://localhost:3000/tickets?status=open"

# 3. Assign to handler
curl -X PATCH http://localhost:3000/tickets/[ID]/assign \
  -H "Content-Type: application/json" \
  -d '{"assignedTo": "handler@example.com"}'
# Response: 200 with updated ticket

# 4. Update status
curl -X PATCH http://localhost:3000/tickets/[ID]/status \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
# Response: 200 with updated ticket

# 5. Try invalid transition (should fail)
curl -X PATCH http://localhost:3000/tickets/[ID]/status \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
# Response: 409 Conflict (skipped step)

# 6. Delete ticket
curl -X DELETE http://localhost:3000/tickets/[ID]
# Response: 204 No Content
```

---

## Evaluation Rubric

| Criteria | Excellent | Good | Needs Work |
|----------|-----------|------|-----------|
| **Architecture** | Perfect Hexagonal; all layers separated | Mostly correct; 1 minor issue | Multiple violations |
| **Endpoints** | All 6 working | 5 working | <5 working |
| **Business Rules** | All enforced correctly | Most enforced | <50% enforced |
| **Status Workflow** | Cannot skip/go backward | Mostly enforced | Not enforced |
| **Assignment Rules** | Author + transition checks | Some checks | Missing checks |
| **Error Codes** | Correct 400/404/409 usage | Mostly correct | Wrong codes |
| **Code Quality** | No `any`; clean code | Minimal `any`; acceptable | Multiple `any` |
| **Tests** | 20+ passing; good coverage | 15-19 passing | <15 passing |

---

## Hints (If Stuck)

1. Status transition logic belongs in domain, not adapter
2. Assignment validation happens in Ticket entity
3. Cannot assign if author → check in entity
4. Use Map<string, Ticket> for O(1) lookups
5. Mock repository in use case tests
6. Soft delete: Keep in Map but track in Set
7. 409 Conflict for business rule violations
8. DTOs separate domain from HTTP layer
9. Use case should be 10-15 lines max
10. Each validator method in entity → separate test

---

## Delivery

Final structure:
```
src/
├── domain/
│   ├── entities/Ticket.ts
│   ├── value-objects/TicketStatus.ts
│   └── ports/TicketRepository.ts
├── application/use-cases/
│   ├── CreateTicketUseCase.ts
│   ├── ListTicketsUseCase.ts
│   ├── GetTicketUseCase.ts
│   ├── UpdateStatusUseCase.ts
│   ├── AssignTicketUseCase.ts
│   └── DeleteTicketUseCase.ts
├── adapters/primary/http/TicketController.ts
├── adapters/secondary/persistence/InMemoryTicketRepository.ts
└── __tests__/*.test.ts (20+ tests)

npm test       # All tests pass
npm start      # Server runs on :3000
npm run build  # TypeScript clean
```

---

**Estimated Time:** 60 minutes  
**Difficulty:** Intermediate (good for candidates with some experience)  
**Use Case:** Hiring, teaching Hexagonal + REST API patterns

Good luck! 🚀
