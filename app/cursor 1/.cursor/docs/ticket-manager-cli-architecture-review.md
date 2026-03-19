# Ticket Manager CLI - Architecture Review & Coaching

**Date:** 2026-02-23  
**Project:** ticket-manager-cli (GitHub: gautrangg/ticket-manager-cli)  
**Topic:** Hexagonal Architecture Compliance Review

## Executive Summary

The project demonstrates solid understanding of Hexagonal Architecture principles with good domain layer implementation. However, critical architecture violations exist in port definition and dependency flow that prevent proper loose coupling and testability.

**Overall Score: 6.5/10**

Strengths: Clean domain layer, proper dependency injection pattern, good entity validation  
Critical Issues: CLI depends on service instead of port, secondary ports misplaced, no primary ports defined

---

## Critical Architecture Issues

### Issue 1: CLI Depends on Service (Not Port)

**Problem Location:** `src/adapters/cli/TicketCLI.ts`

```typescript
export class TicketCLI {
  constructor(private ticketService: TicketService) {}
}
```

**Why It's Wrong:** CLI adapter directly imports and depends on TicketService business logic. This violates dependency inversion principle.

**Architecture Rule:** All adapters must depend on ports (interfaces), not concrete implementations.

**Impact:** 
- Cannot swap TicketService with alternative implementation without changing CLI
- CLI is tightly coupled to service structure
- Cannot test CLI in isolation with mocks
- Violates "ports are contracts" principle

**Fix:** CLI should depend on ITicketUseCases primary port instead:
```typescript
export class TicketCLI {
  constructor(private useCases: ITicketUseCases) {}
}
```

---


### Issue 3: TicketFilter Location (VALID - Keep in Ports)

**Location:** `src/ports/secondary/ITicketRepository.ts`

```typescript
export interface TicketFilter {
  status?: TicketStatus;
  priority?: TicketPriority;
  tags?: string[];
}
```

**Analysis:** TicketFilter is actually a **query contract** of the repository port, not a domain value object.

**Why It's Correct to Keep in Ports:**
- TicketFilter defines HOW adapters can query the repository (query language)
- Repository interface defines `findAll(filter?: TicketFilter)`
- Query parameters belong with the port, not the domain
- Filter is an **infrastructure concern** (how to query), not a domain concept
- One-way dependency: `ports → domain types` (no circular dependency)

**Rationale:**
- Domain defines business rules; adapters define query mechanisms
- TicketFilter is adapter's way to speak to repository, should be in ports
- Domain services don't define or own filters; they just use the repository port

**Current Structure is Actually Correct:** Keep TicketFilter in `src/ports/secondary/ITicketRepository.ts`

---

### Issue 4: No Primary Ports Interface

**Problem:** No interface defining "use cases" or "commands" the CLI needs.

**Why It Matters:** CLI should depend on a contract (primary port) that defines what it can ask the system to do. This makes:
- System testable (mock the port)
- CLI replaceable (could be web adapter instead)
- Intentions clear (explicit list of supported operations)

**Missing File:** `src/ports/primary/ITicketUseCases.ts`

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

**Impact of Missing:** CLI directly imports TicketService (not behind a contract). No abstraction between adapter and business logic.

---

### Issue 5: No Error Handling Abstractions

**Problem:** No custom exception hierarchy for domain errors.

**Current Behavior:** Repository and service throw generic `Error`:
```typescript
throw new Error(`Ticket with id ${id} not found`);
```

**Why It's Wrong:** Generic errors don't distinguish domain logic failures from infrastructure failures. CLI cannot handle different error types appropriately.

**Architecture Principle:** Domain should define domain-specific exceptions.

**Missing Files:**
- `src/domain/exceptions/DomainError.ts` - Base class for all domain errors
- `src/domain/exceptions/TicketNotFoundError.ts` - Specific error for missing ticket
- `src/domain/exceptions/InvalidTicketError.ts` - Validation failures

**Impact:** Cannot catch specific errors in CLI or other adapters. Error handling is brittle.

---

### Issue 6: JSON Repository Missing Error Handling

**Problem Location:** `src/adapters/persistence/JsonTicketRepository.ts`

```typescript
const ticketsData: TicketProps[] = JSON.parse(data);  // No try-catch
```

**Risk:** If JSON file is corrupted, JSON.parse throws generic SyntaxError with poor messaging.

**Fix:** Wrap in try-catch and throw domain exception:
```typescript
try {
  const ticketsData = JSON.parse(data);
} catch (error) {
  throw new Error(`Corrupted tickets file: ${error.message}`);
}
```

---

## Detailed Scoring

| Component | Score | Notes |
|-----------|-------|-------|
| Separation of Concerns | 8/10 | Good layering, but adapter boundaries blur |
| Dependency Inversion | 5/10 | Service missing primary port; domain imports ports |
| Testability | 6/10 | Domain layer testable, but CLI tightly coupled to service |
| Error Handling | 4/10 | No exception abstractions; generic errors throughout |
| Port Definition | 4/10 | No primary ports; secondary ports misplaced in structure |
| Entity Design | 9/10 | Excellent encapsulation, validation, immutability |
| Repository Implementation | 8/10 | Clean code, good filtering logic |
| Adapter Implementation | 7/10 | CLI commands well-structured, but wrong dependency |
| Overall Architecture | 6.5/10 | Solid foundation, but core principles violated |

---

## Architecture Comparison

### Current (WRONG) Dependency Flow

```
CLI Adapter → TicketService (direct import)
             ↓
         ITicketRepository (in ports/)
             ↓
    JsonTicketRepository
```

Problem: CLI depends directly on business logic, not a contract.

### Correct Dependency Flow

```
CLI Adapter → ITicketUseCases (primary port)
             ↓
         TicketService (implements primary port)
             ↓
         ITicketRepository (in domain/ports)
             ↓
    JsonTicketRepository
```

All arrows point inward toward domain. Adapters depend on ports, never on other adapters or directly on services.

---

### Corrected File Structure

```
src/
├── domain/
│   ├── entities/
│   │   ├── Ticket.ts
│   │   └── index.ts
│   ├── exceptions/              [NEW FOLDER]
│   │   ├── DomainError.ts       [NEW]
│   │   ├── TicketNotFoundError.ts [NEW]
│   │   ├── InvalidTicketError.ts [NEW]
│   │   └── index.ts             [NEW]
│   ├── services/
│   │   ├── TicketService.ts     [MODIFIED - update imports]
│   │   └── index.ts
│   └── ports/                   [OPTIONAL - or keep in ports/secondary/]
│       ├── ITicketRepository.ts [MOVE HERE if preferred, or keep below]
│       └── index.ts             [NEW]
├── ports/
│   ├── secondary/
│   │   ├── ITicketRepository.ts [STAYS HERE with TicketFilter]
│   │   └── index.ts
│   ├── primary/                 [NEW FOLDER]
│   │   ├── ITicketUseCases.ts   [NEW]
│   │   └── index.ts             [NEW]
│   └── index.ts
└── adapters/
    ├── cli/
    │   ├── TicketCLI.ts         [MODIFIED - update dependency]
    │   └── index.ts
    └── persistence/
        ├── JsonTicketRepository.ts [MODIFIED - update imports]
        └── index.ts
```

**Key Point:** ITicketRepository and TicketFilter stay in `src/ports/secondary/`

**Rationale:**
- TicketFilter is a query contract (infrastructure concern), belongs in ports
- One-way dependency: `ports/secondary → domain/entities` (clean)
- No circular imports or bidirectional dependencies

---

## Coaching: 14-Step Refactor Plan

### Step 1: Understand Current State (Validation)
- Confirm understanding of why each issue violates architecture
- Can you explain: "Why shouldn't CLI depend on TicketService?"
- Correct answer: Adapters should depend on ports (contracts), not business logic, so adapters are interchangeable

### Step 2: Plan the Refactor (Documentation)
Create file: `docs/plans/2026-02-23/ticket-manager-cli-refactor.md`
- List files to CREATE, MODIFY, DELETE
- Map dependency changes before/after for each file
- Define new folder structure

### Step 3: Create Domain Exceptions
Create files:
- `src/domain/exceptions/DomainError.ts` - Base error class
- `src/domain/exceptions/TicketNotFoundError.ts` - Not found error
- `src/domain/exceptions/InvalidTicketError.ts` - Validation error
- `src/domain/exceptions/index.ts` - Barrel export

Validate: `npm run build`

### Step 3: Create Domain Exceptions
Create files:
- `src/domain/exceptions/DomainError.ts` - Base error class
- `src/domain/exceptions/TicketNotFoundError.ts` - Not found error
- `src/domain/exceptions/InvalidTicketError.ts` - Validation error
- `src/domain/exceptions/index.ts` - Barrel export

Validate: `npm run build`

### Step 4: Update TicketService to Throw Domain Exceptions
Modify: `src/domain/services/TicketService.ts`
- Keep import: `import { ITicketRepository } from '../../ports/secondary/ITicketRepository'` (no changes needed)
- Update generic `Error` throws to domain exceptions
- Example: Replace `throw new Error(...)` with `throw new TicketNotFoundError(id)`

Validate: `npm run build`

### Step 5: Create Primary Port (Use Cases Interface)
Create file: `src/ports/primary/ITicketUseCases.ts`
- Import all types needed: Ticket, TicketStatus, CreateTicketDTO, TicketFilter, etc.
- Define interface with all public methods from TicketService
- Create barrel export

Validate: `npm run build`

### Step 6: Make TicketService Implement Primary Port
Modify: `src/domain/services/TicketService.ts`
- Add: `implements ITicketUseCases` to class declaration
- No code changes needed, just adds type assertion

Validate: `npm run build`

### Step 7: Update CLI to Depend on Primary Port
Modify: `src/adapters/cli/TicketCLI.ts`
- Import: `import { ITicketUseCases } from '../../ports/primary/...'`
- Change constructor: `constructor(private useCases: ITicketUseCases)`
- Replace all `this.ticketService` with `this.useCases`

Validate: `npm run build && npm run dev list`

### Step 8: Add Error Handling to JsonTicketRepository
Modify: `src/adapters/persistence/JsonTicketRepository.ts`
- Wrap JSON.parse in try-catch block
- Throw meaningful error if JSON is corrupted

Validate: `npm run build`

### Step 9: Update Entry Point
Modify: `src/index.ts`
- No code changes needed if all imports are updated in previous steps
- Verify it still properly wires dependencies

Validate: `npm run build && npm run dev create -- -t "Test" -d "Test" -p HIGH`

### Step 10: Run Full Test Suite
```bash
npm run build
npm test
npm run test:coverage
```

All tests must pass with no TypeScript errors.

### Step 11: Manual End-to-End Testing
Test all CLI commands:
```bash
npm run dev create -- -t "Test Ticket" -d "Test Description" -p HIGH --tags "test"
npm run dev list
npm run dev list -- --status OPEN
npm run dev show <ticket-id>
npm run dev update <ticket-id> -- --status IN_PROGRESS
```

All commands should work identically to before refactor.

---

## Success Criteria

### Code Quality
- No circular imports
- All imports compile cleanly
- No TypeScript warnings or errors
- Domain exceptions properly implemented and used
- JSON parsing has error handling

### Architecture
- CLI imports only from ports/primary
- TicketService imports from ports/secondary (acceptable for services)
- JsonTicketRepository imports from ports/secondary
- ITicketRepository lives in ports/secondary (query contract)
- All dependency arrows point inward toward domain

### Testing
- `npm run build` succeeds
- `npm test` passes 100%
- `npm run test:coverage` meets threshold
- Manual CLI tests all pass
- No behavioral changes from end user perspective

### Testability Verification
- Can you create a mock ITicketUseCases and pass it to TicketCLI?
- Can you swap JsonTicketRepository with a PostgresTicketRepository without modifying TicketService?
- Can you add a REST API adapter without touching domain or CLI?

If yes to all three: Architecture is correct.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Broke existing tests | Medium | Run `npm test` after each step; revert if needed |
| Missed import reference | Medium | Use `grep -r` to find old paths before deleting |
| Circular imports | High | Check compiler output carefully; trace import graph |
| CLI behavior changed | High | Manual test all commands after step 9 |
| Type errors from port changes | Medium | TypeScript will catch; fix as compiler indicates |

---

## Decision Points

### 1. Error Code Strategy
Should DomainError include error codes (e.g., ERR_TICKET_001)?
- **Yes:** Add `code: string` field, enables programmatic error handling
- **No:** Keep simple with just message, reduces complexity

Recommendation: **No** - start simple, add codes if needed later

### 2. TicketFilter Mutability
Should TicketFilter be mutable or immutable?
- **Immutable:** Better value object pattern, prevents accidental mutations
- **Mutable:** Simpler, allows optional property assignment

Recommendation: **Immutable** - follow value object pattern

### 3. Exception Throwing Strategy
Where should exceptions be thrown?
- **Domain layer:** TicketService and Ticket entity throw domain exceptions
- **Adapter layer:** JsonTicketRepository throws domain exceptions
- **CLI adapter:** Catches exceptions and converts to user messages

Recommendation: **Both domain and adapter layers** - domain throws domain exceptions, repository wraps I/O errors into domain exceptions

---

## After Completion

### Documentation
Create: `docs/notes/2026-02-23/ticket-manager-cli-refactor.md`

Record:
- What architecture issues were fixed
- Which files were created/modified/deleted
- Validation test results
- Any unforeseen issues and how they were resolved

### Next Improvements (Optional)
1. Add REST API adapter (reuse same service)
2. Add integration tests for repository
3. Add error boundary in CLI (catch all domain errors)
4. Add logging adapter
5. Add persistence adapter for PostgreSQL

---

## Key Takeaways

1. **Ports are Contracts:** All adapters must depend on ports (interfaces), not concrete implementations
2. **Domain Defines Ports:** Domain layer defines its needs (ports); adapters implement them
3. **Dependencies Point Inward:** All arrows should point toward domain layer, never outward
4. **Primary vs Secondary:**
   - Primary ports: What system provides (use cases)
   - Secondary ports: What system needs (repositories, services)
5. **Hexagonal Rule:** Adapters can depend on ports; domain/services can depend on secondary ports; nothing depends on adapters

---

**Status:** Ready for implementation  
**Estimated Time:** 2-3 hours  
**Difficulty:** Medium (refactoring, not new features)  
**Test Coverage:** Maintained or improved
