# Exit Point Tracing - Example Analysis

## Example Code Being Analyzed

```typescript
// api/users.ts
async function createUser(req: Request, res: Response) {
  const userData = req.body;
  
  const validatedData = await validateUser(userData);
  if (!validatedData) {
    return res.status(400).json({ error: 'Invalid data' }); // EXIT POINT 1
  }
  
  const hashedPassword = await hashPassword(validatedData.password);
  const userWithHash = { ...validatedData, password: hashedPassword };
  
  const savedUser = await db.users.insert(userWithHash); // EXIT POINT 2
  
  await emailService.sendWelcome(savedUser.email); // EXIT POINT 3
  
  const response = { id: savedUser.id, email: savedUser.email };
  return res.json(response); // EXIT POINT 4
}
```

## What Exit Point Tracer Would Find

### Step 1: Identify Exit Points
```json
[
  {
    "type": "send",
    "location": { "file": "api/users.ts", "line": 6 },
    "value": "res.status(400).json({ error: 'Invalid data' })",
    "confidence": 0.95
  },
  {
    "type": "persist",
    "location": { "file": "api/users.ts", "line": 12 },
    "value": "db.users.insert(userWithHash)",
    "confidence": 0.9
  },
  {
    "type": "send",
    "location": { "file": "api/users.ts", "line": 14 },
    "value": "emailService.sendWelcome(savedUser.email)",
    "confidence": 0.85
  },
  {
    "type": "send",
    "location": { "file": "api/users.ts", "line": 17 },
    "value": "res.json(response)",
    "confidence": 0.95
  }
]
```

### Step 2: Trace Backward From Exit Point 2 (Database Insert)

Starting from: `db.users.insert(userWithHash)`

Tracing `userWithHash` backward:
- Line 10: `userWithHash = { ...validatedData, password: hashedPassword }`
- Line 9: `hashedPassword = await hashPassword(validatedData.password)`
- Line 4: `validatedData = await validateUser(userData)`
- Line 2: `userData = req.body`
- Line 1: `req` is a function parameter (ENTRY POINT!)

### Step 3: Build Flow Graph

```json
{
  "flow_id": "create_user_flow",
  "nodes": [
    {
      "id": "api/users.ts:1",
      "type": "source",
      "operation": "HTTP request parameter",
      "dataShape": "external input",
      "connections": { "from": [], "to": ["api/users.ts:2"] }
    },
    {
      "id": "api/users.ts:2",
      "type": "transform",
      "operation": "extract body",
      "dataShape": "object",
      "connections": { "from": ["api/users.ts:1"], "to": ["api/users.ts:4"] }
    },
    {
      "id": "api/users.ts:4",
      "type": "transform",
      "operation": "validation",
      "dataShape": "validated object",
      "connections": { "from": ["api/users.ts:2"], "to": ["api/users.ts:5", "api/users.ts:9"] }
    },
    {
      "id": "api/users.ts:5",
      "type": "branch",
      "operation": "validation check",
      "connections": { "from": ["api/users.ts:4"], "to": ["api/users.ts:6", "api/users.ts:9"] }
    },
    {
      "id": "api/users.ts:6",
      "type": "exit",
      "operation": "send: error response",
      "dataShape": "error object",
      "connections": { "from": ["api/users.ts:5"], "to": [] }
    },
    {
      "id": "api/users.ts:9",
      "type": "transform",
      "operation": "password hashing",
      "dataShape": "string",
      "connections": { "from": ["api/users.ts:5"], "to": ["api/users.ts:10"] }
    },
    {
      "id": "api/users.ts:10",
      "type": "merge",
      "operation": "object composition",
      "dataShape": "user object with hash",
      "connections": { "from": ["api/users.ts:4", "api/users.ts:9"], "to": ["api/users.ts:12"] }
    },
    {
      "id": "api/users.ts:12",
      "type": "exit",
      "operation": "persist: database insert",
      "dataShape": "saved user",
      "connections": { "from": ["api/users.ts:10"], "to": ["api/users.ts:14", "api/users.ts:16"] }
    }
  ]
}
```

## What This Gives Curator Claude

When asked "How do I add email verification to user registration?", Curator Claude can:

1. **See the complete flow**: Request → Validation → Password Hash → Save → Email → Response
2. **Identify insertion points**: Email verification would go between validation (node 4) and password hashing (node 9)
3. **Understand data availability**: At that point, we have `validatedData` with user email
4. **Match patterns**: Can see how other async operations (validation, hashing) are handled
5. **Know the exit points**: Would need to add error exit for failed verification

## Benefits Over Current Analyzers

Instead of:
- "This file imports 5 modules"
- "There are 2 async functions"
- "Framework: Express detected"

Curator gets:
- "User data flows: HTTP → validate → hash → save → email → response"
- "Error handling exits early at validation"
- "All transforms are async with await"
- "Data shape changes from raw → validated → with hash → saved"

This is **actionable intelligence** for guiding code additions!