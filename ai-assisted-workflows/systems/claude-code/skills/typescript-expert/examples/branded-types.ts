/**
 * Branded Types Example
 * Type-safe domain identifiers using branded/tagged types.
 */

// Brand symbols for type safety
declare const UserIdBrand: unique symbol;
declare const OrderIdBrand: unique symbol;
declare const ProductIdBrand: unique symbol;

// Branded type definitions
type UserId = string & { readonly [UserIdBrand]: typeof UserIdBrand };
type OrderId = string & { readonly [OrderIdBrand]: typeof OrderIdBrand };
type ProductId = string & { readonly [ProductIdBrand]: typeof ProductIdBrand };

// Constructor functions with validation
function createUserId(id: string): UserId {
  if (!id.startsWith("user-")) {
    throw new Error("User ID must start with 'user-'");
  }
  return id as UserId;
}

function createOrderId(id: string): OrderId {
  if (!id.startsWith("order-")) {
    throw new Error("Order ID must start with 'order-'");
  }
  return id as OrderId;
}

function createProductId(id: string): ProductId {
  if (!id.startsWith("prod-")) {
    throw new Error("Product ID must start with 'prod-'");
  }
  return id as ProductId;
}

// Domain models using branded types
interface User {
  id: UserId;
  email: string;
  name: string;
}

interface Order {
  id: OrderId;
  userId: UserId;
  products: Array<{
    productId: ProductId;
    quantity: number;
  }>;
  total: number;
}

interface Product {
  id: ProductId;
  name: string;
  price: number;
}

// Functions that require specific branded types
async function getUser(id: UserId): Promise<User> {
  // Implementation
  return {
    id,
    email: "user@example.com",
    name: "John Doe",
  };
}

async function getOrder(id: OrderId): Promise<Order> {
  // Implementation
  return {
    id,
    userId: createUserId("user-123"),
    products: [],
    total: 0,
  };
}

async function getProduct(id: ProductId): Promise<Product> {
  // Implementation
  return {
    id,
    name: "Widget",
    price: 9.99,
  };
}

// Type-safe operations
async function getUserOrders(userId: UserId): Promise<Order[]> {
  // TypeScript ensures we're passing the correct type
  const user = await getUser(userId);
  console.log(`Getting orders for ${user.name}`);
  return [];
}

// Example usage demonstrating type safety
async function main() {
  const userId = createUserId("user-123");
  const orderId = createOrderId("order-456");
  const productId = createProductId("prod-789");

  // Type-safe operations
  const user = await getUser(userId);
  const order = await getOrder(orderId);
  const product = await getProduct(productId);

  console.log({ user, order, product });

  // These would be compile-time errors:
  // await getUser(orderId);     // Error: Argument of type 'OrderId' is not assignable to 'UserId'
  // await getOrder(userId);     // Error: Argument of type 'UserId' is not assignable to 'OrderId'
  // await getProduct(userId);   // Error: Argument of type 'UserId' is not assignable to 'ProductId'
}

// Validated branded types
type Email = string & { readonly brand: "email" };
type PositiveNumber = number & { readonly brand: "positive" };
type NonEmptyString = string & { readonly brand: "nonEmpty" };

function createEmail(value: string): Email | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? (value as Email) : null;
}

function createPositiveNumber(value: number): PositiveNumber | null {
  return value > 0 ? (value as PositiveNumber) : null;
}

function createNonEmptyString(value: string): NonEmptyString | null {
  return value.trim().length > 0 ? (value.trim() as NonEmptyString) : null;
}

// Result type for better error handling
type Result<T, E = string> =
  | { success: true; value: T }
  | { success: false; error: E };

function createEmailResult(value: string): Result<Email> {
  const email = createEmail(value);
  if (email) {
    return { success: true, value: email };
  }
  return { success: false, error: `Invalid email: ${value}` };
}

// Usage with validation
const emailResult = createEmailResult("test@example.com");
if (emailResult.success) {
  // emailResult.value is typed as Email
  sendEmail(emailResult.value);
}

function sendEmail(to: Email): void {
  console.log(`Sending email to ${to}`);
}

export {
  UserId,
  OrderId,
  ProductId,
  createUserId,
  createOrderId,
  createProductId,
  Email,
  PositiveNumber,
  NonEmptyString,
  createEmail,
  createPositiveNumber,
  createNonEmptyString,
};
