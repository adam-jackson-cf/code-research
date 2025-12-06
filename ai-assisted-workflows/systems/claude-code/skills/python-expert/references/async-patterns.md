# Python Async Patterns Reference

Modern async/await patterns for Python 3.11+.

## TaskGroup (Python 3.11+)

### Basic TaskGroup

```python
import asyncio

async def fetch_url(url: str) -> str:
    await asyncio.sleep(0.1)  # Simulate network
    return f"Content from {url}"

async def fetch_all(urls: list[str]) -> list[str]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch_url(url)) for url in urls]
    return [task.result() for task in tasks]
```

### Error Handling with TaskGroup

```python
async def fetch_with_errors(urls: list[str]) -> dict[str, str | Exception]:
    results: dict[str, str | Exception] = {}

    async def fetch_one(url: str) -> None:
        try:
            results[url] = await fetch_url(url)
        except Exception as e:
            results[url] = e

    async with asyncio.TaskGroup() as tg:
        for url in urls:
            tg.create_task(fetch_one(url))

    return results
```

### Cancellation Handling

```python
async def cancellable_operation() -> str:
    try:
        await asyncio.sleep(10)
        return "completed"
    except asyncio.CancelledError:
        # Cleanup on cancellation
        print("Operation cancelled, cleaning up...")
        raise

async def with_timeout(coro, timeout: float):
    try:
        async with asyncio.timeout(timeout):
            return await coro
    except asyncio.TimeoutError:
        return None
```

## Semaphore Patterns

### Connection Pool

```python
from contextlib import asynccontextmanager

class ConnectionPool:
    def __init__(self, max_connections: int = 10):
        self._semaphore = asyncio.Semaphore(max_connections)
        self._connections: list = []

    @asynccontextmanager
    async def acquire(self):
        async with self._semaphore:
            conn = await self._create_connection()
            try:
                yield conn
            finally:
                await self._release_connection(conn)
```

### Rate Limiter

```python
import time

class RateLimiter:
    def __init__(self, calls_per_second: float):
        self._interval = 1.0 / calls_per_second
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            wait_time = self._last_call + self._interval - now
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            self._last_call = time.monotonic()
```

## Queue Patterns

### Producer-Consumer

```python
async def producer(queue: asyncio.Queue[str], items: list[str]) -> None:
    for item in items:
        await queue.put(item)
        await asyncio.sleep(0.1)

    # Signal completion
    await queue.put(None)

async def consumer(queue: asyncio.Queue[str | None]) -> list[str]:
    results = []
    while True:
        item = await queue.get()
        if item is None:
            break
        results.append(f"Processed: {item}")
        queue.task_done()
    return results

async def main():
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async with asyncio.TaskGroup() as tg:
        tg.create_task(producer(queue, ["a", "b", "c"]))
        consumer_task = tg.create_task(consumer(queue))

    return consumer_task.result()
```

### Worker Pool

```python
async def worker(
    name: str,
    queue: asyncio.Queue[tuple[str, asyncio.Future[str]]]
) -> None:
    while True:
        item, future = await queue.get()
        try:
            result = await process_item(item)
            future.set_result(result)
        except Exception as e:
            future.set_exception(e)
        finally:
            queue.task_done()

class WorkerPool:
    def __init__(self, num_workers: int = 4):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._workers: list[asyncio.Task] = []
        self._num_workers = num_workers

    async def start(self) -> None:
        for i in range(self._num_workers):
            task = asyncio.create_task(worker(f"worker-{i}", self._queue))
            self._workers.append(task)

    async def submit(self, item: str) -> str:
        future: asyncio.Future[str] = asyncio.Future()
        await self._queue.put((item, future))
        return await future

    async def stop(self) -> None:
        for worker in self._workers:
            worker.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
```

## Context Managers

### Async Context Manager

```python
from contextlib import asynccontextmanager
from typing import AsyncIterator

@asynccontextmanager
async def managed_resource() -> AsyncIterator[Resource]:
    resource = await Resource.create()
    try:
        yield resource
    finally:
        await resource.close()

# Class-based
class DatabaseSession:
    async def __aenter__(self) -> "DatabaseSession":
        await self._connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_type:
            await self._rollback()
        else:
            await self._commit()
        await self._close()
        return False  # Don't suppress exceptions
```

### Resource Stack

```python
from contextlib import AsyncExitStack

async def process_files(paths: list[str]) -> list[str]:
    async with AsyncExitStack() as stack:
        files = [
            await stack.enter_async_context(aiofiles.open(p))
            for p in paths
        ]
        return [await f.read() for f in files]
```

## Event Patterns

### Event Coordination

```python
class Coordinator:
    def __init__(self):
        self._ready = asyncio.Event()
        self._shutdown = asyncio.Event()

    async def wait_ready(self) -> None:
        await self._ready.wait()

    def signal_ready(self) -> None:
        self._ready.set()

    async def wait_shutdown(self) -> None:
        await self._shutdown.wait()

    def signal_shutdown(self) -> None:
        self._shutdown.set()
```

### Condition Variable

```python
class Buffer:
    def __init__(self, max_size: int):
        self._items: list = []
        self._max_size = max_size
        self._condition = asyncio.Condition()

    async def put(self, item) -> None:
        async with self._condition:
            while len(self._items) >= self._max_size:
                await self._condition.wait()
            self._items.append(item)
            self._condition.notify()

    async def get(self):
        async with self._condition:
            while not self._items:
                await self._condition.wait()
            item = self._items.pop(0)
            self._condition.notify()
            return item
```

## Streaming Patterns

### Async Generator

```python
from typing import AsyncIterator

async def stream_data(url: str) -> AsyncIterator[bytes]:
    async with httpx.AsyncClient() as client:
        async with client.stream("GET", url) as response:
            async for chunk in response.aiter_bytes():
                yield chunk

async def process_stream(url: str) -> int:
    total = 0
    async for chunk in stream_data(url):
        total += len(chunk)
    return total
```

### Async Iterator

```python
class AsyncPaginator:
    def __init__(self, client, endpoint: str):
        self._client = client
        self._endpoint = endpoint
        self._page = 0
        self._done = False

    def __aiter__(self):
        return self

    async def __anext__(self) -> list[dict]:
        if self._done:
            raise StopAsyncIteration

        response = await self._client.get(
            self._endpoint,
            params={"page": self._page}
        )
        data = response.json()

        if not data["items"]:
            self._done = True
            raise StopAsyncIteration

        self._page += 1
        return data["items"]
```

## Error Handling

### Exception Groups (Python 3.11+)

```python
async def fetch_multiple(urls: list[str]) -> list[str]:
    try:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(fetch_url(url)) for url in urls]
        return [t.result() for t in tasks]
    except* ValueError as eg:
        # Handle ValueError exceptions
        print(f"Value errors: {eg.exceptions}")
        raise
    except* ConnectionError as eg:
        # Handle ConnectionError exceptions
        print(f"Connection errors: {eg.exceptions}")
        raise
```

### Retry Pattern

```python
import random
from typing import TypeVar, Callable, Awaitable

T = TypeVar("T")

async def retry(
    func: Callable[[], Awaitable[T]],
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
) -> T:
    for attempt in range(max_attempts):
        try:
            return await func()
        except Exception as e:
            if attempt == max_attempts - 1:
                raise

            delay = min(base_delay * (2 ** attempt), max_delay)
            jitter = random.uniform(0, delay * 0.1)
            await asyncio.sleep(delay + jitter)

    raise RuntimeError("Should not reach here")
```

## Testing Async Code

### pytest-asyncio

```python
import pytest

@pytest.fixture
async def client():
    async with AsyncClient() as client:
        yield client

@pytest.mark.asyncio
async def test_fetch(client):
    result = await client.get("/api/data")
    assert result.status_code == 200

@pytest.mark.asyncio
async def test_timeout():
    with pytest.raises(asyncio.TimeoutError):
        async with asyncio.timeout(0.001):
            await asyncio.sleep(1)
```

### Mock Async Functions

```python
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_with_mock():
    mock_fetch = AsyncMock(return_value={"data": "test"})

    with patch("module.fetch", mock_fetch):
        result = await process_data()
        assert result == "test"
        mock_fetch.assert_awaited_once()
```

## Performance Tips

### Avoid Blocking Calls

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)

async def run_blocking(func, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, func, *args)

# Usage
result = await run_blocking(cpu_intensive_function, data)
```

### Batch Operations

```python
async def batch_insert(items: list[dict], batch_size: int = 100) -> None:
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        await db.insert_many(batch)
```

### Connection Reuse

```python
# Good - reuse client
async with httpx.AsyncClient() as client:
    for url in urls:
        await client.get(url)

# Bad - create client per request
for url in urls:
    async with httpx.AsyncClient() as client:
        await client.get(url)
```

## External Resources

- [asyncio Documentation](https://docs.python.org/3/library/asyncio.html)
- [Python 3.11 TaskGroup](https://docs.python.org/3.11/library/asyncio-task.html#task-groups)
- [httpx Async Client](https://www.python-httpx.org/async/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
