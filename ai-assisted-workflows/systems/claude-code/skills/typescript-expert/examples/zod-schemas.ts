/**
 * Zod Schema Patterns
 * Comprehensive validation schema examples.
 */

import { z } from "zod";

// ============================================================
// Basic Schemas
// ============================================================

export const EmailSchema = z.string().email();
export const UuidSchema = z.string().uuid();
export const UrlSchema = z.string().url();
export const DateStringSchema = z.string().datetime();

// ============================================================
// User Schemas
// ============================================================

export const UserRoleSchema = z.enum(["admin", "user", "guest"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserCreateSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain uppercase letter")
    .regex(/[a-z]/, "Password must contain lowercase letter")
    .regex(/[0-9]/, "Password must contain number"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  role: UserRoleSchema.default("user"),
});

export type UserCreate = z.infer<typeof UserCreateSchema>;

export const UserUpdateSchema = UserCreateSchema.partial().omit({
  password: true,
});
export type UserUpdate = z.infer<typeof UserUpdateSchema>;

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

// ============================================================
// Pagination Schemas
// ============================================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  });

// ============================================================
// Product Schemas
// ============================================================

export const PriceSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
});

export type Price = z.infer<typeof PriceSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: PriceSchema,
  category: z.string(),
  tags: z.array(z.string()).default([]),
  inStock: z.boolean().default(true),
  quantity: z.number().int().nonnegative().default(0),
});

export type Product = z.infer<typeof ProductSchema>;

// ============================================================
// Order Schemas (Discriminated Union)
// ============================================================

const BaseOrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      unitPrice: PriceSchema,
    })
  ),
  createdAt: z.string().datetime(),
});

export const OrderSchema = z.discriminatedUnion("status", [
  BaseOrderSchema.extend({
    status: z.literal("pending"),
  }),
  BaseOrderSchema.extend({
    status: z.literal("confirmed"),
    confirmedAt: z.string().datetime(),
  }),
  BaseOrderSchema.extend({
    status: z.literal("shipped"),
    confirmedAt: z.string().datetime(),
    shippedAt: z.string().datetime(),
    trackingNumber: z.string(),
  }),
  BaseOrderSchema.extend({
    status: z.literal("delivered"),
    confirmedAt: z.string().datetime(),
    shippedAt: z.string().datetime(),
    deliveredAt: z.string().datetime(),
    trackingNumber: z.string(),
  }),
  BaseOrderSchema.extend({
    status: z.literal("cancelled"),
    cancelledAt: z.string().datetime(),
    reason: z.string().optional(),
  }),
]);

export type Order = z.infer<typeof OrderSchema>;

// ============================================================
// Address Schema with Transforms
// ============================================================

export const AddressSchema = z
  .object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().length(2),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
    country: z.string().length(2).default("US"),
  })
  .transform((data) => ({
    ...data,
    state: data.state.toUpperCase(),
    country: data.country.toUpperCase(),
  }));

export type Address = z.infer<typeof AddressSchema>;

// ============================================================
// API Response Schemas
// ============================================================

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().default(() => new Date().toISOString()),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const createApiResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) =>
  z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      data: dataSchema,
    }),
    z.object({
      success: z.literal(false),
      error: ApiErrorSchema,
    }),
  ]);

// ============================================================
// Environment Variables
// ============================================================

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  API_KEY: z.string().min(32),
  JWT_SECRET: z.string().min(64),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENABLE_METRICS: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof EnvSchema>;

// ============================================================
// Form Validation with Refinements
// ============================================================

export const RegistrationFormSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
    dateOfBirth: z.coerce.date().refine(
      (date) => {
        const age = Math.floor(
          (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );
        return age >= 18;
      },
      { message: "Must be at least 18 years old" }
    ),
    terms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type RegistrationForm = z.infer<typeof RegistrationFormSchema>;

// ============================================================
// Utility Functions
// ============================================================

export function safeParse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  for (const issue of error.errors) {
    const path = issue.path.join(".");
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }
  return formatted;
}

// ============================================================
// Usage Examples
// ============================================================

// Parse user input
const userResult = UserCreateSchema.safeParse({
  email: "test@example.com",
  password: "SecurePass123",
  name: "John Doe",
});

if (userResult.success) {
  console.log("Valid user:", userResult.data);
} else {
  console.log("Errors:", formatZodErrors(userResult.error));
}

// Parse environment
const env = EnvSchema.parse(process.env);
console.log(`Running in ${env.NODE_ENV} on port ${env.PORT}`);

// Parse query parameters
const query = PaginationQuerySchema.parse({
  page: "2",
  pageSize: "50",
});
console.log(`Page ${query.page}, size ${query.pageSize}`);
