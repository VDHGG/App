# Code Review: Hexagonal Architecture - huyvd Submission

**Date:** 2026-02-23  
**Project:** Ticket Manager CLI - Hexagonal Architecture  
**Tests:** 69 passing

---

## HEXAGONAL ARCHITECTURE

### 1.1 Architecture Structure - CORRECT

Domain layer is pure business logic with no external dependencies. Application layer contains use cases. Adapters properly separated (CLI and File Storage). Dependency flow correct: Adapters → Application → Domain.

### 1.2 Use Cases Layer - PATTERN IS GOOD

Application layer uses proper use case pattern. Each use case handles: validation, domain object creation, persistence, DTO conversion. This acts as primary port that CLI depends on.

### 1.3 Dependency Inversion - CORRECT

FileTicketRepository implements TicketRepository interface. Domain defines the port, adapters implement it. No domain imports from ports folder. All dependency arrows point inward.

### 1.4 Domain Independence - CORRECT

Domain does not import external libraries. ID generation (crypto.randomUUID) happens in use case, not domain. Domain is framework-agnostic.

---

## CODE QUALITY ISSUES

### 2.1 DRY Violation - Output Formatting

File: `src/adapters/primary/cli/TicketsCommand.ts` (lines 43-51, 69-76, 94-105)

Output formatting logic repeated in create, list, and show commands. Same field mappings appear multiple times. If format needs to change, must update 3+ places.

Extract to helper method:
```typescript
private formatTicketTable(ticket: TicketOutput): void {
  console.table({
    'ID': ticket.id,
    'Title': ticket.title,
    'Email': ticket.userEmail,
    // ...
  });
}
```

---

### 2.2 Type `any` in Error Handling

File: `src/adapters/primary/cli/TicketsCommand.ts` (lines 52, 77, 106, 122)

Using `catch (e: any)` loses type safety. Error object might not have `message` property.

Fix:
```typescript
catch (error) {  // Let TypeScript infer Error type
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error:', message);
}
```

---

### 2.3 Repeated Validation Logic

File: `src/domain/entities/Ticket.ts` and `src/application/use-cases/CreateTicketUseCase.ts`

Validation rules (email, phone) defined in Ticket entity as static methods, but also checked in use case with hardcoded error messages. If validation changes, must update both places.

Create validator class to centralize:
```typescript
export class TicketValidator {
  static validateEmail(email: string): { valid: boolean; error?: string } {
    if (!email.toLowerCase().endsWith("@gmail.com")) {
      return { valid: false, error: "Email must end with @gmail.com" };
    }
    return { valid: true };
  }
}
```

---

### 2.4 Hardcoded Data Directory Path

File: `src/adapters/secondary/file/FileTicketRepository.ts` (line 8)

Path hardcoded as `path.join(process.cwd(), 'data')`. Cannot configure for different environments. Testing uses real file system instead of mock.

Make configurable:
```typescript
constructor(dataDir: string = path.join(process.cwd(), 'data')) {
  this.dataDir = dataDir;
  this.filePath = path.join(this.dataDir, 'tickets.json');
}
```

---

### 2.5 Type `any` in JSON Parsing

File: `src/adapters/secondary/file/FileTicketRepository.ts` (line 26)

`raw.map((item: any) => ...)` - no type checking on parsed JSON. Could cause runtime errors.

Define interface for type-safe parsing:
```typescript
interface RawTicket {
  id: string;
  title: string;
  userEmail: string;
  // ...
}

return raw.map((item: RawTicket) => new Ticket(...));
```

---

### 2.6 Missing JSON Error Handling

File: `src/adapters/secondary/file/FileTicketRepository.ts` (line 24)

`JSON.parse(data || '[]')` has no try-catch. If JSON corrupted, crashes with unclear error message.

Add error handling:
```typescript
try {
  const raw = JSON.parse(data || '[]');
  return this.mapRawToTickets(raw);
} catch (error) {
  throw new Error(`Failed to parse tickets.json: ${error.message}`);
}
```

---

## COMPARISON

| Aspect | huyvd | ticket-manager-cli |
|--------|-------|-------------------|
| Architecture | Correct | Has violations |
| Domain Independence | Yes | No (imports uuid) |
| Use Cases Layer | Yes | Missing |
| Dependency Flow | Correct | Bidirectional |

huyvd has better architecture. ticket-manager-cli has dependency violations at domain layer.

---

## PRIORITY

1. Extract output formatting (DRY)
2. Centralize validation logic
3. Fix type `any` issues
4. Add JSON error handling
5. Make file path configurable

