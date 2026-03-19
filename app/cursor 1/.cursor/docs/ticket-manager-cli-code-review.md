# Code Review: ticket-manager-cli

**Date:** 2026-02-23  
**Reviewer:** Architecture & Code Quality Assessment  
**Status:** Review Only (No Fixes Applied)  
**Project:** ticket-manager-cli (GitHub: gautrangg/ticket-manager-cli)

---

## Overview

Comprehensive review of ticket-manager-cli covering two areas:
1. **Hexagonal Architecture Issues** - Structural and design pattern violations
2. **Code Quality Issues** - Clean code, DRY, maintainability concerns

**Summary:** Good foundation with solid domain layer, but has critical architectural violations and code quality gaps.

---

## PART 1: HEXAGONAL ARCHITECTURE ISSUES

### Issue 1.1: CLI Adapter Tightly Coupled to Service (CRITICAL)

**Severity:** Critical  
**File:** `src/adapters/cli/TicketCLI.ts` (line 7-9)

**Current Code:**
```typescript
export class TicketCLI {
  constructor(private ticketService: TicketService) {}
  
  private setupCommands(): void {
    // ... uses this.ticketService directly
```

**Problem:**
CLI directly depends on concrete `TicketService` class instead of a port interface. Violates Dependency Inversion Principle.

**Why It's Wrong:**
- Adapters should depend on ports (contracts), not business logic
- Cannot mock/test CLI in isolation
- Cannot add alternative adapters (REST API, Web UI) without duplicating logic
- Tight coupling makes system inflexible

**Impact:**
- Testing: CLI cannot be unit tested without TicketService
- Extensibility: Adding new adapter means duplicating service calls
- Maintainability: Changes to service signature ripple to CLI

**Fix Required:**
Create `ITicketUseCases` primary port interface and inject that instead:
```typescript
export class TicketCLI {
  constructor(private useCases: ITicketUseCases) {}
```

---

### Issue 1.2: Domain Service Imports External Library (HIGH)

**Severity:** High  
**File:** `src/domain/services/TicketService.ts` (line 1)

**Current Code:**
```typescript
import { v4 as uuidv4 } from 'uuid';  // ← External library in domain!
```

**Problem:**
Domain layer imports external library (`uuid`). Domain should be framework/library independent.

**Why It's Wrong:**
- Domain should not depend on external libraries
- ID generation is infrastructure concern, not business logic
- Domain only knows "ticket needs ID", not HOW to generate it
- Violates dependency inversion (infrastructure should depend on domain ports)

**Impact:**
- Cannot swap uuid for other ID generation (nanoid, sequential, custom)
- Domain layer is coupled to specific library
- Harder to test (need uuid library in domain tests)
- Violates clean architecture principles

**Fix Required:**
Extract ID generation to port and adapter:
```typescript
// src/domain/ports/IIdGenerator.ts
export interface IIdGenerator {
  generate(): string;
}

// src/domain/services/TicketService.ts (no uuid import!)
export class TicketService {
  constructor(
    private readonly repository: ITicketRepository,
    private readonly idGenerator: IIdGenerator  // ← Inject interface
  ) {}
  
  async createTicket(dto: CreateTicketDTO): Promise<Ticket> {
    const ticket = new Ticket({
      id: this.idGenerator.generate(),  // ← Use interface
      // ...
    });
  }
}

// src/adapters/id-generation/UuidIdGenerator.ts
import { v4 as uuidv4 } from 'uuid';  // ← Library stays in adapter!

export class UuidIdGenerator implements IIdGenerator {
  generate(): string {
    return uuidv4();
  }
}
```

---

### Issue 1.3: Domain Service Imports from Ports (HIGH)

**Severity:** High  
**File:** `src/domain/services/TicketService.ts` (line 3)

**Current Code:**
```typescript
import { ITicketRepository, TicketFilter } from '../../ports/secondary/ITicketRepository';
```

**Problem:**
Domain service imports from `ports/secondary/` folder. Violates dependency inversion rule.

**Why It's Wrong:**
- Dependency rule: `adapters → ports → domain` (one direction only)
- Current: `domain → ports → domain entities` (violates rule)
- Ports should import domain types, NOT domain importing from ports
- Creates bidirectional dependency (risky)

**Impact:**
- Breaks clean architecture layering
- Makes dependency graph unclear
- Hard to enforce architectural constraints
- Risk of circular dependencies

**Correct Dependency Flow:**
```
Adapters
   ↓
Ports (import domain types)
   ↓
Domain (NO imports from ports!)
```

**Fix Required:**
Move secondary ports into domain layer:
```
BEFORE:
src/
├── domain/
│   ├── entities/
│   └── services/
└── ports/
    └── secondary/
        └── ITicketRepository.ts

AFTER:
src/
├── domain/
│   ├── entities/
│   ├── ports/                  ← NEW: Secondary ports inside domain
│   │   └── ITicketRepository.ts
│   └── services/
└── ports/
    └── primary/
        └── ITicketUseCases.ts
```

Then update imports:
```typescript
// OLD (WRONG)
import { ITicketRepository } from '../../ports/secondary/ITicketRepository';

// NEW (CORRECT)
import { ITicketRepository } from '../ports/ITicketRepository';
```

---

### Issue 1.4: No Primary Port Interface (CRITICAL)

**Severity:** Critical  
**File:** Missing - should be `src/ports/primary/ITicketUseCases.ts`

**Problem:**
No interface defining the contract between CLI and business logic. Services don't implement a port.

**Why It's Wrong:**
- CLI has no abstraction layer
- Cannot swap implementations
- No explicit use case contract
- Violates hexagonal pattern (adapters should depend on ports)

**Impact:**
- Blocks adding REST API, Web UI, or other adapters
- No clear interface for what system provides
- Tests cannot easily mock business logic

**Fix Required:**
Create `src/ports/primary/ITicketUseCases.ts` with interface matching TicketService public methods, then make TicketService implement it.

---

### Issue 1.5: Missing Domain Exception Hierarchy (HIGH)

**Severity:** High  
**Files:** 
- `src/domain/services/TicketService.ts` (multiple lines with `throw new Error`)
- `src/adapters/persistence/JsonTicketRepository.ts` (missing error handling)

**Current Code (TicketService.ts, line ~45):**
```typescript
if (!ticket) {
  throw new Error(`Ticket with id ${id} not found`);
}
```

**Problem:**
Generic `Error` thrown throughout - no domain-specific exception hierarchy.

**Why It's Wrong:**
- Cannot distinguish domain errors from infrastructure errors
- CLI cannot handle different error types appropriately
- No semantic meaning to errors
- Hard to test error conditions

**Impact:**
- Error handling is brittle
- Users get generic error messages
- No recovery strategies per error type

**Fix Required:**
Create exception hierarchy:
```typescript
// src/domain/exceptions/
- DomainError (base class)
- TicketNotFoundError
- InvalidTicketError
```

Then throw specific exceptions instead of generic Error.

---

## PART 2: CODE QUALITY ISSUES

### Issue 2.1: Violation of DRY Principle - Repeated Filter Logic

**Severity:** Medium  
**File:** `src/adapters/cli/TicketCLI.ts` (lines 68-80, 95-107)

**Pattern:**
```typescript
// Lines 68-80 (list command)
if (options.status) {
  const status = options.status.toUpperCase() as TicketStatus;
  if (!Object.values(TicketStatus).includes(status)) {
    console.error(`Invalid status: ${options.status}`);
    process.exit(1);
  }
  filter.status = status;
}

// Lines 95-107 (same logic repeats)
if (options.priority) {
  const priority = options.priority.toUpperCase() as TicketPriority;
  if (!Object.values(TicketPriority).includes(priority)) {
    console.error(`Invalid priority: ${options.priority}`);
    process.exit(1);
  }
  filter.priority = priority;
}
```

**Problem:**
Validation logic repeated for status and priority. If validation rules change, must update multiple places.

**Why It's Wrong:**
- Violates DRY (Don't Repeat Yourself)
- Maintenance burden: changes in one place might miss another
- Harder to test validation logic
- More error-prone

**Fix Required:**
Extract to helper function:
```typescript
private validateEnum(value: string, enumType: object, fieldName: string): string | null {
  const upper = value.toUpperCase();
  if (!Object.values(enumType).includes(upper)) {
    console.error(`Invalid ${fieldName}: ${value}`);
    process.exit(1);
  }
  return upper;
}
```

**Impact:** Low-medium (cosmetic but affects maintainability)

---

### Issue 2.2: Magic Exit Codes and Inconsistent Error Handling

**Severity:** Medium  
**File:** `src/adapters/cli/TicketCLI.ts` (lines 38, 47, 66, 77, 107, 140, 169)

**Pattern:**
```typescript
// Scattered throughout
process.exit(1);  // Whenever error occurs
```

**Problem:**
- Uses hardcoded exit code 1 everywhere
- No distinction between error types (validation, not found, infrastructure)
- No error context/logging
- Same exit code for different failures

**Why It's Wrong:**
- Makes error differentiation impossible for consumers
- CLI cannot signal different failure modes
- No way to distinguish validation errors from system errors
- Inconsistent error handling strategy

**Fix Required:**
Define exit code constants and use consistently:
```typescript
const EXIT_CODES = {
  VALIDATION_ERROR: 1,
  NOT_FOUND: 2,
  SYSTEM_ERROR: 3,
  SUCCESS: 0
};

// Then use:
process.exit(EXIT_CODES.VALIDATION_ERROR);
```

**Impact:** Low-medium (affects CLI usability and automation)

---

### Issue 2.3: Type Assertions with `any` (MEDIUM)

**Severity:** Medium  
**File:** `src/adapters/cli/TicketCLI.ts` (lines 87, 100)

**Current Code:**
```typescript
const filter: any = {};  // ← Using 'any' type

if (options.status) {
  filter.status = status;
}
// ... more assignments to filter
```

**Problem:**
Uses `any` type instead of proper typing. Loses type safety benefits.

**Why It's Wrong:**
- `any` defeats TypeScript's type checking
- No autocomplete/IDE support
- Errors caught at runtime, not compile time
- Inconsistent with rest of codebase

**Fix Required:**
Use proper typing:
```typescript
import { TicketFilter } from '../../ports/secondary/ITicketRepository';

const filter: Partial<TicketFilter> = {};
```

**Impact:** Medium (affects code safety and maintainability)

---

### Issue 2.4: Missing JSON Error Handling

**Severity:** Medium  
**File:** `src/adapters/persistence/JsonTicketRepository.ts` (line ~23)

**Current Code:**
```typescript
const ticketsData: TicketProps[] = JSON.parse(data);  // No try-catch
```

**Problem:**
If JSON file is corrupted, throws unhandled SyntaxError with unclear message.

**Why It's Wrong:**
- Unexpected crashes when data is malformed
- No recovery mechanism
- Error message won't be user-friendly

**Fix Required:**
```typescript
try {
  const ticketsData = JSON.parse(data);
  return ticketsData.map(ticketData => Ticket.fromJSON(ticketData));
} catch (error) {
  throw new Error(`Failed to parse tickets file: ${error.message}`);
}
```

**Impact:** Medium (affects reliability and robustness)

---

### Issue 2.5: Missing Input Validation in Entity

**Severity:** Medium  
**File:** `src/domain/entities/Ticket.ts` (line ~50-70)

**Current Validation:**
```typescript
private validate(props: TicketProps): void {
  if (!props.title || props.title.trim().length === 0) {
    throw new Error('Title cannot be empty');
  }
  if (props.title.length > 200) {
    throw new Error('Title cannot exceed 200 characters');
  }
  // Missing: description length check
  // Missing: invalid tag validation
}
```

**Problem:**
Incomplete validation - description has no length limit, no tag validation.

**Why It's Wrong:**
- Inconsistent validation rules
- Description could be arbitrarily large (DoS risk)
- Invalid tags could cause issues

**Fix Required:**
Add comprehensive validation:
```typescript
if (props.description.length > 5000) {
  throw new Error('Description cannot exceed 5000 characters');
}

for (const tag of props.tags) {
  if (!/^[a-z0-9-]+$/.test(tag)) {
    throw new Error(`Invalid tag format: ${tag}`);
  }
}
```

**Impact:** Medium (affects data integrity)

---

## SUMMARY TABLE

### All Issues by Severity

| # | Issue | Severity | Type | Fix Effort |
|---|-------|----------|------|-----------|
| 1.1 | CLI depends on Service | CRITICAL | Architecture | 2-3 hrs |
| 1.4 | No Primary Port | CRITICAL | Architecture | 1-2 hrs |
| 1.2 | Domain imports external lib | HIGH | Layering | 1-2 hrs |
| 1.3 | Domain imports from ports | HIGH | Dependency | 1-2 hrs |
| 1.5 | No exception hierarchy | HIGH | Design | 1-2 hrs |
| 2.1 | DRY Violation (Filters) | MEDIUM | Code | 30 min |
| 2.2 | Magic Exit Codes | MEDIUM | Consistency | 30 min |
| 2.3 | Type `any` Usage | MEDIUM | Type Safety | 30 min |
| 2.4 | JSON Error Handling | MEDIUM | Robustness | 20 min |
| 2.5 | Incomplete Validation | MEDIUM | Integrity | 30 min |

---

## Priority Roadmap

### Phase 1: Critical Architecture (4-5 hours)
1. Move ITicketRepository to `src/domain/ports/`
2. Create `IIdGenerator` port, extract uuid to adapter
3. Fix domain imports (don't import from ports/)
4. Create `ITicketUseCases` primary port
5. Update CLI to depend on primary port

### Phase 2: Error Handling & Robustness (1-2 hours)
6. Create domain exception hierarchy
7. Add error handling to JSON parsing
8. Complete entity validation

### Phase 3: Code Quality (1-2 hours)
9. Extract filter validation helper
10. Define and use exit code constants
11. Replace `any` types with proper typing

---

## Validation Checklist

After fixes:
- ✓ `npm run build` succeeds
- ✓ `npm test` passes 100%
- ✓ All CLI commands work
- ✓ No TypeScript errors/warnings
- ✓ No `any` types
- ✓ No circular imports
- ✓ Error handling works for edge cases

---

**End of Review**

This is a review-only document. No changes have been applied to the codebase.
