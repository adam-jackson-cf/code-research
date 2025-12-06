"""
Complete FastAPI service example.

Demonstrates modern patterns: dependency injection, Pydantic v2, async.
"""

from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

# --- Models ---


class ItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    price: float = Field(..., gt=0)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, v: str) -> str:
        return v.strip()


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    price: float | None = Field(None, gt=0)


class ItemResponse(ItemBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ItemListResponse(BaseModel):
    items: list[ItemResponse]
    total: int
    page: int
    page_size: int


# --- Repository ---


class ItemRepository:
    """In-memory repository for demonstration."""

    def __init__(self) -> None:
        self._items: dict[str, dict] = {}
        self._counter = 0

    async def get(self, item_id: str) -> dict | None:
        return self._items.get(item_id)

    async def list(self, offset: int = 0, limit: int = 20) -> tuple[list[dict], int]:
        items = list(self._items.values())
        return items[offset : offset + limit], len(items)

    async def create(self, data: dict) -> dict:
        self._counter += 1
        item_id = f"item-{self._counter}"
        now = datetime.utcnow()
        item = {
            "id": item_id,
            **data,
            "created_at": now,
            "updated_at": now,
        }
        self._items[item_id] = item
        return item

    async def update(self, item_id: str, data: dict) -> dict | None:
        if item_id not in self._items:
            return None
        self._items[item_id].update(data)
        self._items[item_id]["updated_at"] = datetime.utcnow()
        return self._items[item_id]

    async def delete(self, item_id: str) -> bool:
        if item_id in self._items:
            del self._items[item_id]
            return True
        return False


# --- Service ---


class ItemService:
    def __init__(self, repository: ItemRepository) -> None:
        self._repository = repository

    async def get(self, item_id: str) -> ItemResponse | None:
        item = await self._repository.get(item_id)
        return ItemResponse.model_validate(item) if item else None

    async def list(self, page: int, page_size: int) -> ItemListResponse:
        offset = (page - 1) * page_size
        items, total = await self._repository.list(offset, page_size)
        return ItemListResponse(
            items=[ItemResponse.model_validate(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def create(self, data: ItemCreate) -> ItemResponse:
        item = await self._repository.create(data.model_dump())
        return ItemResponse.model_validate(item)

    async def update(self, item_id: str, data: ItemUpdate) -> ItemResponse | None:
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await self.get(item_id)
        item = await self._repository.update(item_id, update_data)
        return ItemResponse.model_validate(item) if item else None

    async def delete(self, item_id: str) -> bool:
        return await self._repository.delete(item_id)


# --- Dependencies ---

# Singleton repository (in production, use proper DI container)
_repository: ItemRepository | None = None


def get_repository() -> ItemRepository:
    global _repository
    if _repository is None:
        _repository = ItemRepository()
    return _repository


def get_service(
    repository: ItemRepository = Depends(get_repository),
) -> ItemService:
    return ItemService(repository)


# Type alias for cleaner annotations
ServiceDep = Annotated[ItemService, Depends(get_service)]


# --- Application ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up...")
    yield
    # Shutdown
    print("Shutting down...")


app = FastAPI(
    title="Items API",
    version="1.0.0",
    lifespan=lifespan,
)


# --- Routes ---


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post(
    "/api/items",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_item(data: ItemCreate, service: ServiceDep):
    """Create a new item."""
    return await service.create(data)


@app.get("/api/items", response_model=ItemListResponse)
async def list_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    service: ServiceDep = None,
):
    """List all items with pagination."""
    return await service.list(page, page_size)


@app.get("/api/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str, service: ServiceDep):
    """Get a specific item."""
    item = await service.get(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    return item


@app.patch("/api/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: str, data: ItemUpdate, service: ServiceDep):
    """Update an item."""
    item = await service.update(item_id, data)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    return item


@app.delete("/api/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: str, service: ServiceDep):
    """Delete an item."""
    deleted = await service.delete(item_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )


# --- Run ---

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
