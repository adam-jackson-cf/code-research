# TypeScript Type Patterns Reference

Advanced type system patterns for modern TypeScript development.

## Branded Types

### Basic Branding

```typescript
// Create unique brand symbols
declare const UserId: unique symbol;
declare const OrderId: unique symbol;

type UserId = string & { readonly [UserId]: typeof UserId };
type OrderId = string & { readonly [OrderId]: typeof OrderId };

// Constructor functions
const createUserId = (id: string): UserId => id as UserId;
const createOrderId = (id: string): OrderId => id as OrderId;

// Type safety
function getUser(id: UserId): Promise<User> { ... }
function getOrder(id: OrderId): Promise<Order> { ... }

const userId = createUserId("user-123");
const orderId = createOrderId("order-456");

getUser(userId);   // OK
getUser(orderId);  // Type error!
```

### Validated Branded Types

```typescript
type Email = string & { readonly brand: "email" }
type PositiveInt = number & { readonly brand: "positiveInt" }

function createEmail(value: string): Email | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (emailRegex.test(value)) {
    return value as Email
  }
  return null
}

function createPositiveInt(value: number): PositiveInt | null {
  if (Number.isInteger(value) && value > 0) {
    return value as PositiveInt
  }
  return null
}
```

## Utility Types

### DeepReadonly

```typescript
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepReadonly<T[P]>
    : T[P]
}

interface Config {
  database: {
    host: string
    port: number
  }
}

type ImmutableConfig = DeepReadonly<Config>
```

### DeepPartial

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

interface User {
  name: string
  settings: {
    theme: string
    notifications: boolean
  }
}

type UserUpdate = DeepPartial<User>
// { name?: string; settings?: { theme?: string; notifications?: boolean } }
```

### NonNullableDeep

```typescript
type NonNullableDeep<T> = {
  [P in keyof T]: NonNullableDeep<NonNullable<T[P]>>
}

interface MaybeUser {
  name: string | null
  email: string | undefined
  profile: {
    bio: string | null
  } | null
}

type DefiniteUser = NonNullableDeep<MaybeUser>
```

## Template Literal Types

### Route Parameters

```typescript
type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never

type Params = ExtractParams<"/users/:userId/posts/:postId">
// "userId" | "postId"

function createRoute<T extends string>(
  pattern: T,
  params: Record<ExtractParams<T>, string>,
): string {
  return pattern.replace(/:(\w+)/g, (_, key) => params[key])
}

// Usage
const url = createRoute("/users/:userId/posts/:postId", {
  userId: "123",
  postId: "456",
})
```

### Event Types

```typescript
type EventName<T extends string> = `on${Capitalize<T>}`
type EventHandler<T extends string> = (event: `${T}Event`) => void

type ButtonEvents = "click" | "hover" | "focus"
type ButtonHandlers = {
  [K in ButtonEvents as EventName<K>]: EventHandler<K>
}
// { onClick: (event: "clickEvent") => void; ... }
```

## Conditional Types

### Extract and Exclude

```typescript
// Extract functions from object
type FunctionsOf<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K]
}

// Extract non-functions
type PropertiesOf<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K]
}

interface User {
  id: string
  name: string
  greet(): string
  save(): Promise<void>
}

type UserProps = PropertiesOf<User> // { id: string; name: string }
type UserMethods = FunctionsOf<User> // { greet: () => string; save: () => Promise<void> }
```

### Infer Return Types

```typescript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

type AsyncResult = Promise<{ data: string }>
type Result = UnwrapPromise<AsyncResult> // { data: string }

// Array unwrapping
type ElementOf<T> = T extends readonly (infer E)[] ? E : never

type Numbers = number[]
type Num = ElementOf<Numbers> // number
```

## Discriminated Unions

### Action Types

```typescript
type Action =
  | { type: "INCREMENT"; amount: number }
  | { type: "DECREMENT"; amount: number }
  | { type: "RESET" }

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case "INCREMENT":
      return state + action.amount
    case "DECREMENT":
      return state - action.amount
    case "RESET":
      return 0
  }
}
```

### Result Types

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err("Division by zero")
  }
  return ok(a / b)
}

const result = divide(10, 2)
if (result.ok) {
  console.log(result.value) // number
} else {
  console.log(result.error) // string
}
```

## Generic Constraints

### Object Constraints

```typescript
function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    result[key] = obj[key]
  }
  return result
}

const user = { id: 1, name: "John", email: "john@example.com" }
const partial = pick(user, ["id", "name"]) // { id: number; name: string }
```

### Function Constraints

```typescript
type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>

function withRetry<T extends AsyncFunction>(
  fn: T,
  retries: number,
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async (...args) => {
    let lastError: unknown
    for (let i = 0; i < retries; i++) {
      try {
        return await fn(...args)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError
  }
}
```

## Mapped Types

### Optional to Required

```typescript
type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>

interface Config {
  host?: string
  port?: number
  debug?: boolean
}

type RequiredConfig = RequiredKeys<Config, "host" | "port">
// { host: string; port: number; debug?: boolean }
```

### Rename Keys

```typescript
type RenameKeys<T, R extends Record<string, string>> = {
  [K in keyof T as K extends keyof R ? R[K] : K]: T[K]
}

interface User {
  firstName: string
  lastName: string
}

type ApiUser = RenameKeys<
  User,
  { firstName: "first_name"; lastName: "last_name" }
>
// { first_name: string; last_name: string }
```

## Type Guards

### Custom Type Guards

```typescript
interface Dog {
  kind: "dog"
  bark(): void
}

interface Cat {
  kind: "cat"
  meow(): void
}

type Animal = Dog | Cat

function isDog(animal: Animal): animal is Dog {
  return animal.kind === "dog"
}

function handleAnimal(animal: Animal) {
  if (isDog(animal)) {
    animal.bark() // TypeScript knows it's Dog
  } else {
    animal.meow() // TypeScript knows it's Cat
  }
}
```

### Assert Functions

```typescript
function assertDefined<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message ?? "Value is not defined")
  }
}

function process(value: string | null) {
  assertDefined(value, "Value is required")
  // value is now string
  console.log(value.toUpperCase())
}
```

## Variance Annotations

### Covariance

```typescript
interface Producer<out T> {
  produce(): T
}

let stringProducer: Producer<string>
let objectProducer: Producer<object>

// string extends object, so Producer<string> extends Producer<object>
objectProducer = stringProducer // OK with 'out' variance
```

### Contravariance

```typescript
interface Consumer<in T> {
  consume(value: T): void
}

let stringConsumer: Consumer<string>
let objectConsumer: Consumer<object>

// object is wider, so Consumer<object> extends Consumer<string>
stringConsumer = objectConsumer // OK with 'in' variance
```

## Const Type Parameters

```typescript
function createConfig<const T extends readonly string[]>(
  keys: T,
): { [K in T[number]]: string } {
  return {} as any
}

// Without const: string[]
// With const: readonly ["host", "port"]
const config = createConfig(["host", "port"])
// { host: string; port: string }
```

## Satisfies Operator

```typescript
type Colors = Record<string, string | number[]>

const palette = {
  red: "#ff0000",
  green: [0, 255, 0],
  blue: "#0000ff",
} satisfies Colors

// palette.red is inferred as string, not string | number[]
const hex = palette.red.toUpperCase() // OK
const rgb = palette.green.join(",") // OK
```

## Type-Safe Event Emitter

```typescript
type EventMap = {
  connect: { host: string; port: number }
  message: { content: string; from: string }
  disconnect: { reason: string }
}

class TypedEmitter<T extends Record<string, unknown>> {
  private listeners = new Map<keyof T, Set<(data: unknown) => void>>()

  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as (data: unknown) => void)
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.listeners.get(event)?.forEach((handler) => handler(data))
  }
}

const emitter = new TypedEmitter<EventMap>()

emitter.on("connect", ({ host, port }) => {
  console.log(`Connected to ${host}:${port}`)
})

emitter.emit("connect", { host: "localhost", port: 3000 }) // OK
emitter.emit("connect", { host: "localhost" }) // Error: missing port
```

## External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeScript 5.7 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-7/)
- [Type Challenges](https://github.com/type-challenges/type-challenges)
- [Total TypeScript](https://www.totaltypescript.com/)
