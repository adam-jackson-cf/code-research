"""
Pydantic v2 model patterns.

Demonstrates validation, serialization, and advanced features.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Generic, Self, TypeVar

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    computed_field,
    field_validator,
    model_validator,
)

T = TypeVar("T")

# --- Enums and Types ---


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"


class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


# --- Basic Models ---


class Address(BaseModel):
    """Address with validation."""

    street: str = Field(..., min_length=1, max_length=200)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=2, max_length=2)
    zip_code: str = Field(..., pattern=r"^\d{5}(-\d{4})?$")
    country: str = "US"

    @field_validator("state")
    @classmethod
    def uppercase_state(cls, v: str) -> str:
        return v.upper()


class User(BaseModel):
    """User model with comprehensive validation."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_default=True,
    )

    id: str | None = None
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)
    role: UserRole = UserRole.USER
    website: HttpUrl | None = None
    address: Address | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, v: str) -> str:
        return " ".join(v.split())  # Normalize whitespace

    @computed_field
    @property
    def display_name(self) -> str:
        return f"{self.name} ({self.email})"


# --- Immutable Models ---


class Money(BaseModel):
    """Immutable money representation."""

    model_config = ConfigDict(frozen=True)

    amount: Decimal = Field(..., decimal_places=2)
    currency: str = Field("USD", pattern=r"^[A-Z]{3}$")

    def __add__(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError("Cannot add different currencies")
        return Money(amount=self.amount + other.amount, currency=self.currency)

    def __mul__(self, factor: int | float) -> "Money":
        return Money(
            amount=self.amount * Decimal(str(factor)),
            currency=self.currency,
        )


# --- Nested Models ---


class OrderItem(BaseModel):
    """Order line item."""

    product_id: str
    name: str
    quantity: int = Field(..., gt=0)
    unit_price: Money

    @computed_field
    @property
    def total(self) -> Money:
        return self.unit_price * self.quantity


class Order(BaseModel):
    """Order with nested items and validation."""

    id: str | None = None
    customer_id: str
    items: list[OrderItem] = Field(..., min_length=1)
    status: OrderStatus = OrderStatus.PENDING
    shipping_address: Address
    notes: str | None = Field(None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @computed_field
    @property
    def subtotal(self) -> Money:
        if not self.items:
            return Money(amount=Decimal("0"), currency="USD")
        total = self.items[0].total
        for item in self.items[1:]:
            total = total + item.total
        return total

    @model_validator(mode="after")
    def validate_order(self) -> Self:
        # Check for duplicate products
        product_ids = [item.product_id for item in self.items]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("Duplicate products in order")
        return self


# --- Generic Response Models ---


class ApiError(BaseModel):
    """API error response."""

    code: str
    message: str
    details: dict | None = None


class ApiResponse(BaseModel, Generic[T]):
    """Generic API response wrapper."""

    success: bool = True
    data: T | None = None
    error: ApiError | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response wrapper."""

    items: list[T]
    total: int
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=100)

    @computed_field
    @property
    def total_pages(self) -> int:
        return (self.total + self.page_size - 1) // self.page_size

    @computed_field
    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages

    @computed_field
    @property
    def has_previous(self) -> bool:
        return self.page > 1


# --- Discriminated Unions ---


class EmailNotification(BaseModel):
    """Email notification."""

    type: str = "email"
    recipient: EmailStr
    subject: str
    body: str


class SMSNotification(BaseModel):
    """SMS notification."""

    type: str = "sms"
    phone: str = Field(..., pattern=r"^\+\d{10,15}$")
    message: str = Field(..., max_length=160)


class PushNotification(BaseModel):
    """Push notification."""

    type: str = "push"
    device_token: str
    title: str
    body: str
    data: dict | None = None


Notification = EmailNotification | SMSNotification | PushNotification


class NotificationRequest(BaseModel):
    """Request to send notification."""

    notification: Notification = Field(..., discriminator="type")


# --- Settings Pattern ---


class DatabaseSettings(BaseModel):
    """Database configuration."""

    host: str = "localhost"
    port: int = 5432
    name: str
    user: str
    password: str

    @computed_field
    @property
    def url(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"


class CacheSettings(BaseModel):
    """Cache configuration."""

    host: str = "localhost"
    port: int = 6379
    ttl: int = 3600


class AppSettings(BaseModel):
    """Application settings."""

    model_config = ConfigDict(env_prefix="APP_")

    debug: bool = False
    secret_key: str
    database: DatabaseSettings
    cache: CacheSettings


# --- Usage Examples ---

if __name__ == "__main__":
    # Create user
    user = User(
        email="john@example.com",
        name="  John   Doe  ",  # Will be normalized
        website="https://example.com",
        address=Address(
            street="123 Main St",
            city="New York",
            state="ny",  # Will be uppercased
            zip_code="10001",
        ),
    )
    print(f"User: {user.model_dump_json(indent=2)}")
    print(f"Display: {user.display_name}")

    # Create order
    order = Order(
        customer_id="cust-123",
        items=[
            OrderItem(
                product_id="prod-1",
                name="Widget",
                quantity=2,
                unit_price=Money(amount=Decimal("9.99")),
            ),
            OrderItem(
                product_id="prod-2",
                name="Gadget",
                quantity=1,
                unit_price=Money(amount=Decimal("19.99")),
            ),
        ],
        shipping_address=user.address,
    )
    print(f"\nOrder subtotal: {order.subtotal}")

    # Paginated response
    response = PaginatedResponse[User](
        items=[user],
        total=100,
        page=1,
        page_size=20,
    )
    print(f"\nPages: {response.total_pages}, Has next: {response.has_next}")

    # Discriminated union
    notification = NotificationRequest(
        notification=EmailNotification(
            recipient="user@example.com",
            subject="Hello",
            body="World",
        )
    )
    print(f"\nNotification type: {notification.notification.type}")
