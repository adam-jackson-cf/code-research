"""
Repository pattern example with Protocol-based interface.

Demonstrates dependency injection and async patterns.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Protocol, TypeVar

from sqlalchemy import delete, func, select

if TYPE_CHECKING:
    pass


# Stub for example - in real code this would be your SQLAlchemy model
class UserModel:
    """SQLAlchemy model stub for example purposes."""

    id: str
    email: str
    name: str
    created_at: datetime
    updated_at: datetime

    def __init__(self, **kwargs: object) -> None:
        for k, v in kwargs.items():
            setattr(self, k, v)


# Domain Models


@dataclass(frozen=True)
class User:
    id: str
    email: str
    name: str
    created_at: datetime
    updated_at: datetime


@dataclass
class UserCreate:
    email: str
    name: str


@dataclass
class UserUpdate:
    email: str | None = None
    name: str | None = None


# Generic Repository Protocol

T = TypeVar("T")
CreateT = TypeVar("CreateT")
UpdateT = TypeVar("UpdateT")


class Repository(Protocol[T, CreateT, UpdateT]):
    """Generic repository interface."""

    async def get(self, entity_id: str) -> T | None:
        """Get entity by ID."""
        ...

    async def list(self, *, offset: int = 0, limit: int = 100) -> tuple[list[T], int]:
        """List entities with pagination."""
        ...

    async def create(self, data: CreateT) -> T:
        """Create a new entity."""
        ...

    async def update(self, entity_id: str, data: UpdateT) -> T | None:
        """Update an existing entity."""
        ...

    async def delete(self, entity_id: str) -> bool:
        """Delete an entity."""
        ...


# In-Memory Implementation (for testing)


class InMemoryUserRepository:
    """In-memory implementation for testing."""

    def __init__(self) -> None:
        self._users: dict[str, User] = {}

    async def get(self, user_id: str) -> User | None:
        return self._users.get(user_id)

    async def list(
        self, *, offset: int = 0, limit: int = 100
    ) -> tuple[list[User], int]:
        users = list(self._users.values())
        total = len(users)
        return users[offset : offset + limit], total

    async def create(self, data: UserCreate) -> User:
        now = datetime.utcnow()
        user = User(
            id=str(uuid.uuid4()),
            email=data.email,
            name=data.name,
            created_at=now,
            updated_at=now,
        )
        self._users[user.id] = user
        return user

    async def update(self, user_id: str, data: UserUpdate) -> User | None:
        existing = self._users.get(user_id)
        if not existing:
            return None

        now = datetime.utcnow()
        updated = User(
            id=existing.id,
            email=data.email if data.email else existing.email,
            name=data.name if data.name else existing.name,
            created_at=existing.created_at,
            updated_at=now,
        )
        self._users[user_id] = updated
        return updated

    async def delete(self, user_id: str) -> bool:
        if user_id in self._users:
            del self._users[user_id]
            return True
        return False


# SQLAlchemy Implementation


class SQLAlchemyUserRepository:
    """SQLAlchemy-based repository implementation."""

    def __init__(self, session) -> None:
        self._session = session

    async def get(self, user_id: str) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user_id)
        )
        row = result.scalar_one_or_none()
        return self._to_domain(row) if row else None

    async def list(
        self, *, offset: int = 0, limit: int = 100
    ) -> tuple[list[User], int]:
        # Count total
        count_result = await self._session.execute(
            select(func.count()).select_from(UserModel)
        )
        total = count_result.scalar()

        # Get page
        result = await self._session.execute(
            select(UserModel).offset(offset).limit(limit)
        )
        rows = result.scalars().all()
        return [self._to_domain(row) for row in rows], total

    async def create(self, data: UserCreate) -> User:
        now = datetime.utcnow()
        model = UserModel(
            id=str(uuid.uuid4()),
            email=data.email,
            name=data.name,
            created_at=now,
            updated_at=now,
        )
        self._session.add(model)
        await self._session.flush()
        return self._to_domain(model)

    async def update(self, user_id: str, data: UserUpdate) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user_id)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None

        if data.email:
            model.email = data.email
        if data.name:
            model.name = data.name
        model.updated_at = datetime.utcnow()

        await self._session.flush()
        return self._to_domain(model)

    async def delete(self, user_id: str) -> bool:
        result = await self._session.execute(
            delete(UserModel).where(UserModel.id == user_id)
        )
        return result.rowcount > 0

    def _to_domain(self, model) -> User:
        return User(
            id=model.id,
            email=model.email,
            name=model.name,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


# Service using repository


class UserService:
    """Service layer that depends on repository protocol."""

    def __init__(self, repository: Repository[User, UserCreate, UserUpdate]) -> None:
        self._repository = repository

    async def get_user(self, user_id: str) -> User | None:
        return await self._repository.get(user_id)

    async def create_user(self, email: str, name: str) -> User:
        data = UserCreate(email=email, name=name)
        return await self._repository.create(data)

    async def update_user(
        self, user_id: str, email: str | None = None, name: str | None = None
    ) -> User | None:
        data = UserUpdate(email=email, name=name)
        return await self._repository.update(user_id, data)


# Usage example


async def main():
    # Use in-memory repository for testing
    repository = InMemoryUserRepository()
    service = UserService(repository)

    # Create user
    user = await service.create_user(
        email="test@example.com",
        name="Test User",
    )
    print(f"Created: {user}")

    # Update user
    updated = await service.update_user(user.id, name="Updated Name")
    print(f"Updated: {updated}")

    # Get user
    fetched = await service.get_user(user.id)
    print(f"Fetched: {fetched}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
