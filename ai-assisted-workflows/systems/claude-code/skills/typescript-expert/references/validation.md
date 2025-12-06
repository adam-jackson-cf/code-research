# TypeScript Validation Reference

Runtime validation patterns with Zod and alternatives.

## Zod Basics

### Schema Definition

```typescript
import { z } from "zod"

// Primitives
const stringSchema = z.string()
const numberSchema = z.number()
const booleanSchema = z.boolean()
const dateSchema = z.date()

// With constraints
const emailSchema = z.string().email()
const ageSchema = z.number().int().min(0).max(150)
const uuidSchema = z.string().uuid()
const urlSchema = z.string().url()
```

### Object Schemas

```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().positive().optional(),
  role: z.enum(["admin", "user", "guest"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
})

type User = z.infer<typeof UserSchema>
```

### Parsing and Validation

```typescript
// Parse (throws on error)
try {
  const user = UserSchema.parse(unknownData)
  // user is typed as User
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(error.errors)
  }
}

// Safe parse (returns result)
const result = UserSchema.safeParse(unknownData)
if (result.success) {
  const user = result.data // User
} else {
  const errors = result.error.errors
}
```

## Advanced Schemas

### Arrays and Tuples

```typescript
// Arrays
const StringArraySchema = z.array(z.string())
const NonEmptyArraySchema = z.array(z.string()).nonempty()
const BoundedArraySchema = z.array(z.number()).min(1).max(10)

// Tuples
const PointSchema = z.tuple([z.number(), z.number()])
const NamedPointSchema = z.tuple([z.number(), z.number(), z.string()])

// Rest elements
const ArgsSchema = z.tuple([z.string()]).rest(z.number())
// [string, ...number[]]
```

### Unions and Discriminated Unions

```typescript
// Simple union
const StringOrNumber = z.union([z.string(), z.number()])

// Discriminated union (more efficient)
const EventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("click"),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal("keypress"),
    key: z.string(),
  }),
  z.object({
    type: z.literal("scroll"),
    direction: z.enum(["up", "down"]),
  }),
])

type Event = z.infer<typeof EventSchema>
```

### Transforms

```typescript
// Transform during parsing
const LowercaseEmail = z
  .string()
  .email()
  .transform((s) => s.toLowerCase())

// Complex transforms
const UserInput = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
  })
  .transform((data) => ({
    ...data,
    fullName: `${data.firstName} ${data.lastName}`,
  }))

// Coercion
const CoercedNumber = z.coerce.number() // "123" -> 123
const CoercedDate = z.coerce.date() // "2024-01-01" -> Date
```

### Refinements

```typescript
// Simple refinement
const Password = z
  .string()
  .min(8)
  .refine((val) => /[A-Z]/.test(val), {
    message: "Must contain uppercase letter",
  })
  .refine((val) => /[0-9]/.test(val), {
    message: "Must contain number",
  })

// Super refinement (multiple errors)
const Form = z
  .object({
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords don't match",
        path: ["confirmPassword"],
      })
    }
  })
```

### Default Values

```typescript
const ConfigSchema = z.object({
  host: z.string().default("localhost"),
  port: z.number().default(3000),
  debug: z.boolean().default(false),
  timeout: z.number().optional().default(5000),
})

// Parsing empty object gives defaults
const config = ConfigSchema.parse({})
// { host: "localhost", port: 3000, debug: false, timeout: 5000 }
```

## API Schema Patterns

### Request/Response Schemas

```typescript
// Request body
const CreateUserRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
})

// Response
const UserResponse = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string().datetime(),
})

// List response
const UserListResponse = z.object({
  items: z.array(UserResponse),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
})
```

### Query Parameters

```typescript
const PaginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
})

// Usage with query string
const query = new URLSearchParams(window.location.search)
const params = PaginationQuery.parse(Object.fromEntries(query))
```

### Form Validation

```typescript
const LoginForm = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
})

const RegistrationForm = z
  .object({
    email: z.string().email(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase")
      .regex(/[0-9]/, "Must contain number"),
    confirmPassword: z.string(),
    terms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
```

## Error Handling

### Custom Error Messages

```typescript
const UserSchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
      invalid_type_error: "Email must be a string",
    })
    .email("Invalid email format"),

  age: z
    .number({
      required_error: "Age is required",
    })
    .min(18, "Must be at least 18 years old"),
})
```

### Error Formatting

```typescript
const result = UserSchema.safeParse(data)

if (!result.success) {
  // Flat errors
  const flatErrors = result.error.flatten()
  // { formErrors: [], fieldErrors: { email: ["Invalid email"] } }

  // Formatted errors
  const formatted = result.error.format()
  // { email: { _errors: ["Invalid email"] } }

  // Custom formatting
  const custom = result.error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }))
}
```

## Schema Composition

### Extend and Merge

```typescript
const BaseEntity = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

const User = BaseEntity.extend({
  email: z.string().email(),
  name: z.string(),
})

const Admin = User.extend({
  permissions: z.array(z.string()),
})

// Merge (combines two schemas)
const Combined = z.object({ a: z.string() }).merge(z.object({ b: z.number() }))
```

### Pick and Omit

```typescript
const FullUser = z.object({
  id: z.string(),
  email: z.string(),
  password: z.string(),
  name: z.string(),
})

const PublicUser = FullUser.omit({ password: true })
const Credentials = FullUser.pick({ email: true, password: true })
```

### Partial and Required

```typescript
const User = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
})

const UpdateUser = User.partial() // All optional
const CreateUser = User.required() // All required

// Deep partial
const DeepPartialUser = User.deepPartial()
```

## Async Validation

```typescript
const UniqueEmail = z
  .string()
  .email()
  .refine(
    async (email) => {
      const exists = await checkEmailExists(email)
      return !exists
    },
    { message: "Email already exists" },
  )

// Must use parseAsync for async refinements
const result = await UniqueEmail.safeParseAsync("test@example.com")
```

## Valibot Alternative

```typescript
import * as v from "valibot"

// Smaller bundle, similar API
const UserSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  age: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
})

type User = v.InferOutput<typeof UserSchema>

const result = v.safeParse(UserSchema, data)
```

## Integration Patterns

### With Fetch

```typescript
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`)
  const data = await response.json()
  return UserSchema.parse(data)
}

async function createUser(input: z.infer<typeof CreateUserRequest>) {
  const validated = CreateUserRequest.parse(input)
  const response = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(validated),
  })
  return UserResponse.parse(await response.json())
}
```

### With React Hook Form

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = handleSubmit((data) => {
    // data is fully typed
    console.log(data.email);
  });

  return (
    <form onSubmit={onSubmit}>
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}
    </form>
  );
}
```

### Environment Variables

```typescript
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  DEBUG: z.coerce.boolean().default(false),
})

export const env = EnvSchema.parse(process.env)
```

## Implementation Plan Template

When creating TypeScript implementation plans, use this structure:

```markdown
# Task Implementation Plan: [Task Name]

## Overview

[Brief description and approach]

## Architecture Decisions

- **Library Choice**: [Selection with rationale]
- **Pattern**: [Design pattern and fit]
- **Integration**: [How it fits existing code]

## File Changes

### New Files

- `path/to/file.ts`: [Purpose]

### Modified Files

- `path/to/existing.ts`: [Changes]

## Dependencies

bun add package-name

## Type Definitions

[Interfaces and type utilities]

## Testing Plan

[Test cases and validation]
```

## External Resources

- [Zod Documentation](https://zod.dev/)
- [Valibot Documentation](https://valibot.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
