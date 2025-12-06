# RAG Embedding Strategies Reference

Comprehensive guide to embedding models, chunking strategies, and indexing.

## Embedding Models

### OpenAI Embeddings

```python
from openai import OpenAI

client = OpenAI()

def get_embedding(text: str, model: str = "text-embedding-3-large") -> list[float]:
    response = client.embeddings.create(
        input=text,
        model=model,
    )
    return response.data[0].embedding

# Model options
# text-embedding-3-small: 1536 dims, cheaper
# text-embedding-3-large: 3072 dims, better quality
# text-embedding-ada-002: 1536 dims, legacy
```

### Cohere Embeddings

```python
import cohere

co = cohere.Client(api_key="your-key")

def get_embedding(text: str, input_type: str = "search_document") -> list[float]:
    response = co.embed(
        texts=[text],
        model="embed-english-v3.0",
        input_type=input_type,  # search_document, search_query
    )
    return response.embeddings[0]
```

### Open Source Embeddings

```python
from sentence_transformers import SentenceTransformer

# BGE embeddings (top open source)
model = SentenceTransformer("BAAI/bge-large-en-v1.5")

def get_embedding(text: str) -> list[float]:
    return model.encode(text, normalize_embeddings=True).tolist()

# Other popular models:
# - sentence-transformers/all-mpnet-base-v2
# - intfloat/e5-large-v2
# - BAAI/bge-m3 (multilingual)
```

### Model Selection Guide

| Model                  | Dimensions | Quality   | Cost | Best For     |
| ---------------------- | ---------- | --------- | ---- | ------------ |
| text-embedding-3-large | 3072       | Excellent | $$$  | Production   |
| text-embedding-3-small | 1536       | Good      | $$   | Budget       |
| Cohere embed-v3        | 1024       | Excellent | $$$  | Multilingual |
| BGE-large              | 1024       | Very Good | Free | Self-hosted  |
| E5-large               | 1024       | Very Good | Free | Self-hosted  |

## Chunking Strategies

### Fixed-Size Chunking

```python
def fixed_size_chunk(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
    return chunks
```

### Recursive Text Splitting

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)

chunks = splitter.split_text(document)
```

### Semantic Chunking

```python
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai.embeddings import OpenAIEmbeddings

text_splitter = SemanticChunker(
    OpenAIEmbeddings(),
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=95,
)

chunks = text_splitter.split_text(document)
```

### Document-Aware Chunking

```python
from langchain.text_splitter import MarkdownHeaderTextSplitter

headers_to_split_on = [
    ("#", "header1"),
    ("##", "header2"),
    ("###", "header3"),
]

splitter = MarkdownHeaderTextSplitter(headers_to_split_on)
chunks = splitter.split_text(markdown_document)
```

### Chunking Best Practices

**Chunk Size Guidelines:**

- Small chunks (256-512): Better precision, more API calls
- Medium chunks (512-1024): Good balance
- Large chunks (1024-2048): More context, may dilute relevance

**Overlap Guidelines:**

- 10-20% overlap prevents context loss at boundaries
- Higher overlap for narrative content
- Lower overlap for structured data

## Metadata Enrichment

### Document Metadata

```python
@dataclass
class ChunkMetadata:
    source: str
    page_number: int | None
    section: str | None
    created_at: datetime
    chunk_index: int
    total_chunks: int
    doc_type: str

def enrich_chunk(
    chunk: str,
    doc_path: str,
    chunk_idx: int,
    total: int,
    **extra
) -> dict:
    return {
        "text": chunk,
        "metadata": {
            "source": doc_path,
            "chunk_index": chunk_idx,
            "total_chunks": total,
            "char_count": len(chunk),
            "word_count": len(chunk.split()),
            **extra,
        }
    }
```

### Hierarchical Metadata

```python
def extract_hierarchy(doc_path: str) -> dict:
    """Extract document hierarchy for filtering."""
    parts = doc_path.split("/")
    return {
        "department": parts[0] if len(parts) > 0 else None,
        "category": parts[1] if len(parts) > 1 else None,
        "doc_name": parts[-1],
    }
```

## Indexing Patterns

### Basic Indexing

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

client = QdrantClient(host="localhost", port=6333)

# Create collection
client.create_collection(
    collection_name="documents",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

# Index documents
points = [
    PointStruct(
        id=i,
        vector=get_embedding(chunk["text"]),
        payload=chunk["metadata"],
    )
    for i, chunk in enumerate(chunks)
]

client.upsert(collection_name="documents", points=points)
```

### Batch Indexing

```python
from concurrent.futures import ThreadPoolExecutor
from itertools import batched

def batch_embed(texts: list[str], batch_size: int = 100) -> list[list[float]]:
    embeddings = []
    for batch in batched(texts, batch_size):
        response = client.embeddings.create(
            input=list(batch),
            model="text-embedding-3-small",
        )
        embeddings.extend([e.embedding for e in response.data])
    return embeddings

def parallel_embed(texts: list[str], workers: int = 4) -> list[list[float]]:
    batches = list(batched(texts, len(texts) // workers))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        results = list(executor.map(batch_embed, batches))
    return [emb for batch in results for emb in batch]
```

### Incremental Indexing

```python
from hashlib import sha256

def doc_hash(text: str) -> str:
    return sha256(text.encode()).hexdigest()

def incremental_index(
    new_chunks: list[dict],
    collection: str,
    client: QdrantClient,
) -> int:
    """Only index new or modified chunks."""
    indexed = 0

    for chunk in new_chunks:
        chunk_hash = doc_hash(chunk["text"])

        # Check if already indexed
        existing = client.scroll(
            collection_name=collection,
            scroll_filter={"must": [{"key": "hash", "match": {"value": chunk_hash}}]},
            limit=1,
        )

        if not existing[0]:
            point = PointStruct(
                id=str(uuid4()),
                vector=get_embedding(chunk["text"]),
                payload={**chunk["metadata"], "hash": chunk_hash},
            )
            client.upsert(collection_name=collection, points=[point])
            indexed += 1

    return indexed
```

## Embedding Optimization

### Dimension Reduction

```python
from openai import OpenAI

def get_reduced_embedding(
    text: str,
    dimensions: int = 256,
) -> list[float]:
    """Use OpenAI's built-in dimension reduction."""
    response = client.embeddings.create(
        input=text,
        model="text-embedding-3-small",
        dimensions=dimensions,  # Reduce from 1536
    )
    return response.data[0].embedding
```

### Caching Embeddings

```python
import redis
import json
from hashlib import sha256

redis_client = redis.Redis(host="localhost", port=6379)

def get_cached_embedding(text: str) -> list[float]:
    cache_key = f"emb:{sha256(text.encode()).hexdigest()}"

    # Check cache
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Generate and cache
    embedding = get_embedding(text)
    redis_client.setex(cache_key, 86400, json.dumps(embedding))  # 24h TTL
    return embedding
```

### Async Embedding

```python
import asyncio
from openai import AsyncOpenAI

async_client = AsyncOpenAI()

async def get_embedding_async(text: str) -> list[float]:
    response = await async_client.embeddings.create(
        input=text,
        model="text-embedding-3-small",
    )
    return response.data[0].embedding

async def batch_embed_async(texts: list[str]) -> list[list[float]]:
    tasks = [get_embedding_async(text) for text in texts]
    return await asyncio.gather(*tasks)
```

## Hybrid Embedding

### Late Interaction (ColBERT)

```python
from colbert import Indexer, Searcher
from colbert.infra import Run, RunConfig

# Index with ColBERT for late interaction
with Run().context(RunConfig(nranks=1)):
    indexer = Indexer(checkpoint="colbert-ir/colbertv2.0")
    indexer.index(name="my_index", collection=documents)

# Search with late interaction
with Run().context(RunConfig(nranks=1)):
    searcher = Searcher(index="my_index")
    results = searcher.search(query, k=10)
```

### Multi-Vector Representation

```python
def multi_vector_embed(text: str) -> dict:
    """Create multiple embeddings for different aspects."""
    return {
        "dense": get_embedding(text, model="text-embedding-3-small"),
        "summary": get_embedding(summarize(text), model="text-embedding-3-small"),
        "keywords": get_embedding(extract_keywords(text), model="text-embedding-3-small"),
    }
```

## Quality Evaluation

### Embedding Quality Metrics

```python
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

def embedding_quality_check(
    queries: list[str],
    relevant_docs: list[list[str]],
) -> dict:
    """Evaluate embedding quality on test set."""

    results = {"mrr": [], "recall@5": [], "recall@10": []}

    for query, docs in zip(queries, relevant_docs):
        query_emb = get_embedding(query)
        doc_embs = [get_embedding(doc) for doc in docs]

        # Calculate similarities
        similarities = cosine_similarity([query_emb], doc_embs)[0]

        # Calculate metrics
        sorted_indices = np.argsort(similarities)[::-1]

        # MRR
        for rank, idx in enumerate(sorted_indices):
            if idx == 0:  # First doc is relevant
                results["mrr"].append(1.0 / (rank + 1))
                break

        # Recall
        results["recall@5"].append(0 in sorted_indices[:5])
        results["recall@10"].append(0 in sorted_indices[:10])

    return {k: np.mean(v) for k, v in results.items()}
```

## External Resources

- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Sentence Transformers](https://www.sbert.net/)
- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard)
- [LangChain Text Splitters](https://python.langchain.com/docs/modules/data_connection/document_transformers/)
