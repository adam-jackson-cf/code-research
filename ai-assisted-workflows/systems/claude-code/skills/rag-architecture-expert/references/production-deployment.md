# RAG Production Deployment Reference

Scaling, monitoring, and optimization for production RAG systems.

## Architecture Patterns

### Basic Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Layer  │────▶│  RAG Service│
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
              ┌───────────┐           ┌───────────┐           ┌───────────┐
              │ Vector DB │           │  LLM API  │           │   Cache   │
              └───────────┘           └───────────┘           └───────────┘
```

### Scalable Architecture

```
                        ┌──────────────┐
                        │ Load Balancer│
                        └──────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       ┌───────────┐    ┌───────────┐    ┌───────────┐
       │ API Pod 1 │    │ API Pod 2 │    │ API Pod N │
       └───────────┘    └───────────┘    └───────────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ Vector DB   │         │ Redis Cache │         │ LLM Service │
│ (Pinecone)  │         │  Cluster    │         │  (Gateway)  │
└─────────────┘         └─────────────┘         └─────────────┘
```

## Caching Strategies

### Query Cache

```python
import redis
import hashlib
import json
from datetime import timedelta

class QueryCache:
    def __init__(self, redis_url: str, ttl: int = 3600):
        self.redis = redis.from_url(redis_url)
        self.ttl = ttl

    def _cache_key(self, query: str, params: dict) -> str:
        content = f"{query}:{json.dumps(params, sort_keys=True)}"
        return f"rag:query:{hashlib.sha256(content.encode()).hexdigest()}"

    async def get(self, query: str, params: dict) -> dict | None:
        key = self._cache_key(query, params)
        cached = self.redis.get(key)
        return json.loads(cached) if cached else None

    async def set(self, query: str, params: dict, result: dict) -> None:
        key = self._cache_key(query, params)
        self.redis.setex(key, self.ttl, json.dumps(result))
```

### Embedding Cache

```python
class EmbeddingCache:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    def _cache_key(self, text: str) -> str:
        return f"rag:emb:{hashlib.sha256(text.encode()).hexdigest()}"

    async def get_embedding(
        self,
        text: str,
        embed_fn,
    ) -> list[float]:
        key = self._cache_key(text)

        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)

        embedding = await embed_fn(text)
        self.redis.setex(key, 86400, json.dumps(embedding))  # 24h TTL
        return embedding
```

### Semantic Cache

```python
class SemanticCache:
    """Cache similar queries to avoid redundant LLM calls."""

    def __init__(
        self,
        vector_client,
        similarity_threshold: float = 0.95,
    ):
        self.client = vector_client
        self.threshold = similarity_threshold
        self.collection = "query_cache"

    async def get(self, query: str) -> dict | None:
        query_embedding = get_embedding(query)

        results = self.client.search(
            collection_name=self.collection,
            query_vector=query_embedding,
            limit=1,
        )

        if results and results[0].score >= self.threshold:
            return results[0].payload["response"]
        return None

    async def set(self, query: str, response: dict) -> None:
        self.client.upsert(
            collection_name=self.collection,
            points=[{
                "id": str(uuid4()),
                "vector": get_embedding(query),
                "payload": {"query": query, "response": response},
            }],
        )
```

## Rate Limiting

### Token Bucket

```python
import asyncio
from dataclasses import dataclass
from time import monotonic

@dataclass
class TokenBucket:
    capacity: int
    refill_rate: float  # tokens per second
    tokens: float = None
    last_refill: float = None

    def __post_init__(self):
        self.tokens = self.capacity
        self.last_refill = monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: int = 1) -> bool:
        async with self._lock:
            now = monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(
                self.capacity,
                self.tokens + elapsed * self.refill_rate
            )
            self.last_refill = now

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    async def wait_and_acquire(self, tokens: int = 1) -> None:
        while not await self.acquire(tokens):
            await asyncio.sleep(0.1)
```

### Per-User Rate Limiting

```python
from collections import defaultdict

class RateLimiter:
    def __init__(
        self,
        requests_per_minute: int = 60,
        tokens_per_minute: int = 100000,
    ):
        self.rpm = requests_per_minute
        self.tpm = tokens_per_minute
        self.request_buckets = defaultdict(
            lambda: TokenBucket(requests_per_minute, requests_per_minute / 60)
        )
        self.token_buckets = defaultdict(
            lambda: TokenBucket(tokens_per_minute, tokens_per_minute / 60)
        )

    async def check_limit(
        self,
        user_id: str,
        estimated_tokens: int,
    ) -> bool:
        request_ok = await self.request_buckets[user_id].acquire()
        token_ok = await self.token_buckets[user_id].acquire(estimated_tokens)
        return request_ok and token_ok
```

## Monitoring

### Metrics Collection

```python
from prometheus_client import Counter, Histogram, Gauge
import time

# Define metrics
QUERY_COUNTER = Counter(
    "rag_queries_total",
    "Total RAG queries",
    ["status"],
)

QUERY_LATENCY = Histogram(
    "rag_query_latency_seconds",
    "Query latency in seconds",
    ["stage"],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

RETRIEVAL_RESULTS = Histogram(
    "rag_retrieval_results",
    "Number of retrieved documents",
    buckets=[1, 5, 10, 20, 50, 100],
)

CACHE_HITS = Counter(
    "rag_cache_hits_total",
    "Cache hit count",
    ["cache_type"],
)

class MetricsCollector:
    @contextmanager
    def track_latency(self, stage: str):
        start = time.perf_counter()
        try:
            yield
        finally:
            QUERY_LATENCY.labels(stage=stage).observe(
                time.perf_counter() - start
            )

    def record_query(self, status: str):
        QUERY_COUNTER.labels(status=status).inc()

    def record_retrieval(self, num_results: int):
        RETRIEVAL_RESULTS.observe(num_results)

    def record_cache_hit(self, cache_type: str):
        CACHE_HITS.labels(cache_type=cache_type).inc()
```

### Logging

```python
import structlog
from datetime import datetime

logger = structlog.get_logger()

class RAGLogger:
    def log_query(
        self,
        query: str,
        user_id: str,
        retrieval_count: int,
        latency_ms: float,
        cache_hit: bool,
    ):
        logger.info(
            "rag_query",
            query=query[:100],  # Truncate for logging
            user_id=user_id,
            retrieval_count=retrieval_count,
            latency_ms=latency_ms,
            cache_hit=cache_hit,
            timestamp=datetime.utcnow().isoformat(),
        )

    def log_error(
        self,
        error: Exception,
        query: str,
        stage: str,
    ):
        logger.error(
            "rag_error",
            error=str(error),
            error_type=type(error).__name__,
            query=query[:100],
            stage=stage,
            timestamp=datetime.utcnow().isoformat(),
        )
```

## Quality Assurance

### Response Validation

```python
from pydantic import BaseModel, Field

class RAGResponse(BaseModel):
    answer: str
    sources: list[str]
    confidence: float = Field(ge=0, le=1)
    retrieval_count: int

class ResponseValidator:
    def __init__(self, llm):
        self.llm = llm

    async def validate_factuality(
        self,
        answer: str,
        sources: list[str],
    ) -> tuple[bool, str]:
        """Check if answer is supported by sources."""

        prompt = f"""Given these source documents:

{chr(10).join(sources)}

Determine if this answer is factually supported:
"{answer}"

Respond with SUPPORTED or NOT_SUPPORTED, followed by explanation."""

        response = await self.llm.generate(prompt)
        is_supported = response.startswith("SUPPORTED")
        explanation = response.split("\n", 1)[1] if "\n" in response else ""

        return is_supported, explanation

    async def detect_hallucination(
        self,
        answer: str,
        sources: list[str],
    ) -> float:
        """Return hallucination probability (0-1)."""

        prompt = f"""Rate how much of this answer goes beyond the provided sources.
Sources: {chr(10).join(sources[:3])}
Answer: {answer}

Rate from 0 (fully supported) to 10 (completely fabricated):"""

        response = await self.llm.generate(prompt)
        try:
            score = int(response.strip().split()[0])
            return min(max(score / 10, 0), 1)
        except:
            return 0.5
```

### A/B Testing

```python
import random
from dataclasses import dataclass

@dataclass
class Experiment:
    name: str
    variants: list[str]
    weights: list[float]

class ABTester:
    def __init__(self):
        self.experiments: dict[str, Experiment] = {}
        self.results: dict[str, dict] = {}

    def create_experiment(
        self,
        name: str,
        variants: list[str],
        weights: list[float] | None = None,
    ):
        if weights is None:
            weights = [1.0 / len(variants)] * len(variants)

        self.experiments[name] = Experiment(name, variants, weights)
        self.results[name] = {v: {"count": 0, "success": 0} for v in variants}

    def get_variant(self, experiment_name: str, user_id: str) -> str:
        exp = self.experiments[experiment_name]
        # Deterministic assignment based on user_id
        hash_val = hash(f"{experiment_name}:{user_id}") % 100

        cumulative = 0
        for variant, weight in zip(exp.variants, exp.weights):
            cumulative += weight * 100
            if hash_val < cumulative:
                return variant
        return exp.variants[-1]

    def record_result(
        self,
        experiment_name: str,
        variant: str,
        success: bool,
    ):
        self.results[experiment_name][variant]["count"] += 1
        if success:
            self.results[experiment_name][variant]["success"] += 1
```

## Deployment Configurations

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rag-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rag-service
  template:
    metadata:
      labels:
        app: rag-service
    spec:
      containers:
        - name: rag-service
          image: rag-service:latest
          ports:
            - containerPort: 8000
          env:
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: rag-secrets
                  key: openai-api-key
            - name: VECTOR_DB_URL
              valueFrom:
                configMapKeyRef:
                  name: rag-config
                  key: vector-db-url
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: rag-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rag-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Environment Configuration

```python
from pydantic_settings import BaseSettings

class RAGSettings(BaseSettings):
    # API Keys
    openai_api_key: str
    cohere_api_key: str | None = None

    # Vector Database
    vector_db_url: str
    vector_db_api_key: str | None = None
    collection_name: str = "documents"

    # Retrieval Settings
    retrieval_top_k: int = 10
    rerank_top_k: int = 5
    similarity_threshold: float = 0.7

    # LLM Settings
    llm_model: str = "gpt-4o"
    llm_temperature: float = 0.0
    max_tokens: int = 1000

    # Caching
    redis_url: str | None = None
    cache_ttl: int = 3600

    # Rate Limiting
    requests_per_minute: int = 60
    tokens_per_minute: int = 100000

    # Monitoring
    enable_metrics: bool = True
    log_level: str = "INFO"

    class Config:
        env_prefix = "RAG_"
```

## Cost Optimization

### Token Usage Tracking

```python
class TokenTracker:
    def __init__(self):
        self.usage = defaultdict(lambda: {"input": 0, "output": 0})

    def track(
        self,
        user_id: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ):
        self.usage[user_id]["input"] += input_tokens
        self.usage[user_id]["output"] += output_tokens

        # Calculate cost (example pricing)
        costs = {
            "gpt-4o": {"input": 0.005, "output": 0.015},
            "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        }

        if model in costs:
            cost = (
                input_tokens * costs[model]["input"] / 1000 +
                output_tokens * costs[model]["output"] / 1000
            )
            self.usage[user_id]["cost"] = self.usage[user_id].get("cost", 0) + cost
```

### Smart Model Selection

```python
class ModelSelector:
    """Select model based on query complexity."""

    def __init__(self, llm_for_classification):
        self.llm = llm_for_classification

    async def select_model(self, query: str, context: str) -> str:
        prompt = f"""Classify this query complexity:
Query: {query}
Context length: {len(context)} chars

Respond with:
- SIMPLE: Factual lookup, short answer
- MEDIUM: Requires some reasoning
- COMPLEX: Multi-step reasoning, long answer"""

        response = await self.llm.generate(prompt)

        if "SIMPLE" in response:
            return "gpt-4o-mini"
        elif "COMPLEX" in response:
            return "gpt-4o"
        else:
            return "gpt-4o-mini"
```

## Implementation Plan Template

When creating RAG implementation plans, use this structure:

```markdown
# RAG Implementation Plan: [Use Case]

## Requirements Summary

- **Use Case**: [Description]
- **Data**: [Volume, format, domain]
- **Performance**: [Latency, accuracy, scale]

## Architecture Overview

[High-level system design]

## Technology Stack

- **Framework**: [Selection with rationale]
- **Embedding**: [Model choice]
- **Vector DB**: [Database selection]
- **LLM**: [Generation model]

## Implementation Phases

1. MVP - Basic retrieval
2. Enhancement - Advanced retrieval
3. Production - Scale and monitoring

## Evaluation Strategy

[Metrics and benchmarks]
```

## External Resources

- [LangChain Documentation](https://python.langchain.com/docs/)
- [LlamaIndex Documentation](https://docs.llamaindex.ai/)
- [Haystack Documentation](https://docs.haystack.deepset.ai/)
- [Pinecone Documentation](https://docs.pinecone.io/)
