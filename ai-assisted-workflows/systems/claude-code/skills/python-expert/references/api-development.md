# Python API Development Reference

FastAPI best practices and production patterns.

## Project Structure

```
project/
├── src/
│   └── app/
│       ├── __init__.py
│       ├── main.py           # FastAPI app entry
│       ├── config.py         # Settings
│       ├── dependencies.py   # Dependency injection
│       ├── api/
│       │   ├── __init__.py
│       │   ├── routes/
│       │   │   ├── __init__.py
│       │   │   ├── users.py
│       │   │   └── items.py
│       │   └── middleware/
│       │       └── auth.py
│       ├── models/
│       │   ├── __init__.py
│       │   ├── user.py
│       │   └── item.py
│       ├── services/
│       │   ├── __init__.py
│       │   └── user_service.py
│       └── repositories/
│           ├── __init__.py
│           └── user_repository.py
├── tests/
├── pyproject.toml
└── Dockerfile
```

## FastAPI Application

### Main Application

```python
# src/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import users, items

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_database()
    await init_cache()
    yield
    # Shutdown
    await close_database()
    await close_cache()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(items.router, prefix="/api/v1/items", tags=["items"])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

### Configuration

```python
# src/app/config.py
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "My API"
    debug: bool = False
    database_url: str
    redis_url: str
    secret_key: str
    allowed_origins: list[str] = ["http://localhost:3000"]

    # Computed properties
    @property
    def async_database_url(self) -> str:
        return self.database_url.replace("postgresql://", "postgresql+asyncpg://")

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

## Pydantic Models

### Request/Response Models

```python
# src/app/models/user.py
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, field_validator

class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain digit")
        return v

class UserUpdate(BaseModel):
    email: EmailStr | None = None
    name: str | None = Field(None, min_length=1, max_length=100)

class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int
```

### Pagination

```python
from pydantic import BaseModel, Field

class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

class PaginatedResponse[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int
```

## Route Handlers

### CRUD Routes

```python
# src/app/api/routes/users.py
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.models.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.services.user_service import UserService
from app.dependencies import get_user_service, get_current_user

router = APIRouter()

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    service: UserService = Depends(get_user_service),
):
    """Create a new user."""
    return await service.create(data)

@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    service: UserService = Depends(get_user_service),
):
    """List all users with pagination."""
    return await service.list(page=page, page_size=page_size)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    service: UserService = Depends(get_user_service),
):
    """Get a specific user by ID."""
    user = await service.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    service: UserService = Depends(get_user_service),
    current_user = Depends(get_current_user),
):
    """Update a user."""
    user = await service.update(user_id, data)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    service: UserService = Depends(get_user_service),
    current_user = Depends(get_current_user),
):
    """Delete a user."""
    deleted = await service.delete(user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
```

## Dependency Injection

```python
# src/app/dependencies.py
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings
from app.services.user_service import UserService
from app.repositories.user_repository import UserRepository
from app.database import get_session

security = HTTPBearer()

async def get_user_repository(
    session = Depends(get_session),
) -> UserRepository:
    return UserRepository(session)

async def get_user_service(
    repository: UserRepository = Depends(get_user_repository),
) -> UserService:
    return UserService(repository)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    service: UserService = Depends(get_user_service),
):
    token = credentials.credentials
    user = await service.verify_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication",
        )
    return user

# Type aliases for cleaner annotations
UserServiceDep = Annotated[UserService, Depends(get_user_service)]
CurrentUserDep = Annotated[dict, Depends(get_current_user)]
```

## Service Layer

```python
# src/app/services/user_service.py
from typing import Protocol

from app.models.user import UserCreate, UserUpdate, UserResponse, UserListResponse

class UserRepositoryProtocol(Protocol):
    async def get(self, id: str) -> dict | None: ...
    async def list(self, offset: int, limit: int) -> tuple[list[dict], int]: ...
    async def create(self, data: dict) -> dict: ...
    async def update(self, id: str, data: dict) -> dict | None: ...
    async def delete(self, id: str) -> bool: ...

class UserService:
    def __init__(self, repository: UserRepositoryProtocol):
        self._repository = repository

    async def get(self, id: str) -> UserResponse | None:
        user = await self._repository.get(id)
        return UserResponse.model_validate(user) if user else None

    async def list(self, page: int, page_size: int) -> UserListResponse:
        offset = (page - 1) * page_size
        users, total = await self._repository.list(offset, page_size)
        return UserListResponse(
            items=[UserResponse.model_validate(u) for u in users],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def create(self, data: UserCreate) -> UserResponse:
        user_data = data.model_dump()
        user_data["password"] = hash_password(user_data["password"])
        user = await self._repository.create(user_data)
        return UserResponse.model_validate(user)

    async def update(self, id: str, data: UserUpdate) -> UserResponse | None:
        update_data = data.model_dump(exclude_unset=True)
        user = await self._repository.update(id, update_data)
        return UserResponse.model_validate(user) if user else None

    async def delete(self, id: str) -> bool:
        return await self._repository.delete(id)
```

## Error Handling

### Exception Handlers

```python
# src/app/api/middleware/errors.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

class AppException(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code

def register_exception_handlers(app: FastAPI):
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                }
            },
        )

    @app.exception_handler(ValidationError)
    async def validation_exception_handler(request: Request, exc: ValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Validation failed",
                    "details": exc.errors(),
                }
            },
        )
```

## Testing

### Test Setup

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.main import app
from app.database import get_session

@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(engine) as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(db_session):
    async def override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()
```

### Route Tests

```python
# tests/test_users.py
import pytest

@pytest.mark.asyncio
async def test_create_user(client):
    response = await client.post(
        "/api/v1/users",
        json={
            "email": "test@example.com",
            "name": "Test User",
            "password": "SecurePass123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data

@pytest.mark.asyncio
async def test_get_user_not_found(client):
    response = await client.get("/api/v1/users/nonexistent")
    assert response.status_code == 404
```

## OpenAPI Documentation

### Custom Schema

```python
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="My API",
        version="1.0.0",
        description="API documentation",
        routes=app.routes,
    )

    openapi_schema["info"]["x-logo"] = {
        "url": "https://example.com/logo.png"
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi
```

## Implementation Plan Template

When creating Python implementation plans, use this structure:

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

- `path/to/file.py`: [Purpose]

### Modified Files

- `path/to/existing.py`: [Changes]

## Dependencies

[project.dependencies]
package = "^version"

## Type Definitions

[Protocol interfaces and models]

## Testing Plan

[Test cases and validation]
```

## External Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Pydantic v2 Documentation](https://docs.pydantic.dev/latest/)
- [SQLAlchemy 2.0 Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Python 3.13 What's New](https://docs.python.org/3/whatsnew/3.13.html)
