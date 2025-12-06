# Python Type System Reference

Advanced typing patterns for modern Python development.

## Protocol-Based Interfaces

### Basic Protocol

```python
from typing import Protocol

class Serializable(Protocol):
    def to_dict(self) -> dict: ...

class JsonSerializable(Protocol):
    def to_json(self) -> str: ...
```

### Runtime Checkable Protocols

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class HasName(Protocol):
    name: str

def greet(obj: HasName) -> str:
    return f"Hello, {obj.name}"

# Runtime isinstance check works
class User:
    def __init__(self, name: str):
        self.name = name

user = User("Alice")
assert isinstance(user, HasName)  # True
```

### Generic Protocols

```python
from typing import Protocol, TypeVar

T = TypeVar("T")
T_co = TypeVar("T_co", covariant=True)

class Repository(Protocol[T]):
    async def get(self, id: str) -> T | None: ...
    async def save(self, entity: T) -> None: ...
    async def delete(self, id: str) -> bool: ...

class ReadOnlyRepository(Protocol[T_co]):
    async def get(self, id: str) -> T_co | None: ...
    async def list(self) -> list[T_co]: ...
```

## TypeVar and Generics

### Constrained TypeVars

```python
from typing import TypeVar

# Constrained to specific types
Number = TypeVar("Number", int, float)

def add(a: Number, b: Number) -> Number:
    return a + b

# Bounded TypeVar
from datetime import datetime

Temporal = TypeVar("Temporal", bound=datetime)

def get_latest(items: list[Temporal]) -> Temporal:
    return max(items)
```

### Generic Classes

```python
from typing import Generic, TypeVar

T = TypeVar("T")

class Result(Generic[T]):
    def __init__(self, value: T | None, error: str | None = None):
        self._value = value
        self._error = error

    @property
    def is_ok(self) -> bool:
        return self._error is None

    def unwrap(self) -> T:
        if self._error:
            raise ValueError(self._error)
        return self._value  # type: ignore

# Usage
def parse_int(s: str) -> Result[int]:
    try:
        return Result(int(s))
    except ValueError:
        return Result(None, f"Cannot parse '{s}' as int")
```

## Advanced Typing Features

### Literal Types

```python
from typing import Literal

Status = Literal["pending", "active", "completed"]

def update_status(id: str, status: Status) -> None:
    ...

# Type checker ensures only valid values
update_status("123", "pending")  # OK
update_status("123", "invalid")  # Error
```

### TypedDict

```python
from typing import TypedDict, Required, NotRequired

class UserDict(TypedDict):
    id: str
    name: str
    email: Required[str]
    phone: NotRequired[str]

# Partial TypedDict
class UserUpdate(TypedDict, total=False):
    name: str
    email: str
```

### NewType

```python
from typing import NewType

UserId = NewType("UserId", str)
OrderId = NewType("OrderId", str)

def get_user(user_id: UserId) -> dict:
    ...

def get_order(order_id: OrderId) -> dict:
    ...

# Type safety
user_id = UserId("user-123")
order_id = OrderId("order-456")

get_user(user_id)  # OK
get_user(order_id)  # Type error!
```

### ParamSpec and Concatenate

```python
from typing import ParamSpec, Concatenate, Callable, TypeVar

P = ParamSpec("P")
R = TypeVar("R")

def with_logging(
    func: Callable[P, R]
) -> Callable[P, R]:
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

# Adding parameters
def with_context(
    func: Callable[Concatenate[str, P], R]
) -> Callable[P, R]:
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        return func("default-context", *args, **kwargs)
    return wrapper
```

## Type Guards

### TypeGuard

```python
from typing import TypeGuard

def is_string_list(val: list[object]) -> TypeGuard[list[str]]:
    return all(isinstance(x, str) for x in val)

def process(items: list[object]) -> None:
    if is_string_list(items):
        # items is now list[str]
        for item in items:
            print(item.upper())
```

### TypeIs (Python 3.13+)

```python
from typing import TypeIs

class Dog:
    def bark(self) -> str:
        return "Woof!"

class Cat:
    def meow(self) -> str:
        return "Meow!"

def is_dog(animal: Dog | Cat) -> TypeIs[Dog]:
    return isinstance(animal, Dog)

def handle_animal(animal: Dog | Cat) -> str:
    if is_dog(animal):
        return animal.bark()  # animal is Dog
    return animal.meow()  # animal is Cat
```

## Overloads

```python
from typing import overload

@overload
def get(key: str, default: None = None) -> str | None: ...

@overload
def get(key: str, default: str) -> str: ...

def get(key: str, default: str | None = None) -> str | None:
    value = fetch_value(key)
    return value if value is not None else default
```

## Callable Types

### Simple Callable

```python
from typing import Callable

Handler = Callable[[str, int], bool]

def process(handler: Handler) -> None:
    result = handler("test", 42)
```

### Async Callable

```python
from typing import Callable, Coroutine, Any

AsyncHandler = Callable[[str], Coroutine[Any, Any, dict]]

async def fetch_data(url: str) -> dict:
    ...

def register_handler(handler: AsyncHandler) -> None:
    ...
```

## Self Type

```python
from typing import Self

class Builder:
    def with_name(self, name: str) -> Self:
        self._name = name
        return self

    def with_value(self, value: int) -> Self:
        self._value = value
        return self

class AdvancedBuilder(Builder):
    def with_extra(self, extra: str) -> Self:
        self._extra = extra
        return self

# Method chaining preserves type
builder = AdvancedBuilder()
result = builder.with_name("test").with_extra("data")  # AdvancedBuilder
```

## Type Aliases

### Modern Type Alias Syntax (3.12+)

```python
# Python 3.12+ syntax
type Point = tuple[float, float]
type Vector[T] = list[T]
type Callback[**P, R] = Callable[P, R]

# Generic type alias
type Handler[T] = Callable[[T], Awaitable[None]]
```

### Traditional Type Alias

```python
from typing import TypeAlias

Point: TypeAlias = tuple[float, float]
JsonValue: TypeAlias = dict[str, "JsonValue"] | list["JsonValue"] | str | int | float | bool | None
```

## Dataclass Patterns

### Frozen Dataclasses

```python
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float

    def distance_to(self, other: "Point") -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5
```

### Dataclass with Validation

```python
from dataclasses import dataclass, field

@dataclass
class User:
    name: str
    email: str
    age: int = field(default=0)

    def __post_init__(self) -> None:
        if self.age < 0:
            raise ValueError("Age must be non-negative")
        if "@" not in self.email:
            raise ValueError("Invalid email format")
```

## Type Narrowing

### Match Statement (3.10+)

```python
from dataclasses import dataclass

@dataclass
class Success:
    value: str

@dataclass
class Error:
    message: str

Result = Success | Error

def handle_result(result: Result) -> str:
    match result:
        case Success(value=v):
            return f"Got: {v}"
        case Error(message=m):
            return f"Error: {m}"
```

### Assert Type

```python
from typing import assert_type

def process(data: str | int) -> None:
    if isinstance(data, str):
        assert_type(data, str)  # Verified by type checker
        print(data.upper())
```

## Mypy Configuration

```toml
# pyproject.toml
[tool.mypy]
python_version = "3.13"
strict = true
warn_return_any = true
warn_unused_ignores = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
disallow_any_generics = true
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_configs = true

[[tool.mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false
```

## External Resources

- [Typing Best Practices](https://typing.readthedocs.io/en/latest/)
- [PEP 484 - Type Hints](https://peps.python.org/pep-0484/)
- [mypy Documentation](https://mypy.readthedocs.io/)
- [Python 3.13 Type System](https://docs.python.org/3.13/library/typing.html)
