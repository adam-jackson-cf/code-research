# RAG Retrieval Patterns Reference

Advanced retrieval strategies and re-ranking techniques.

## Basic Retrieval

### Vector Search

```python
from qdrant_client import QdrantClient

client = QdrantClient(host="localhost", port=6333)

def vector_search(
    query: str,
    collection: str,
    limit: int = 10,
) -> list[dict]:
    query_embedding = get_embedding(query)

    results = client.search(
        collection_name=collection,
        query_vector=query_embedding,
        limit=limit,
    )

    return [
        {
            "text": hit.payload["text"],
            "score": hit.score,
            "metadata": hit.payload,
        }
        for hit in results
    ]
```

### Filtered Search

```python
from qdrant_client.models import Filter, FieldCondition, MatchValue, Range

def filtered_search(
    query: str,
    collection: str,
    filters: dict,
    limit: int = 10,
) -> list[dict]:
    conditions = []

    for key, value in filters.items():
        if isinstance(value, dict):
            # Range filter
            conditions.append(
                FieldCondition(key=key, range=Range(**value))
            )
        else:
            # Exact match
            conditions.append(
                FieldCondition(key=key, match=MatchValue(value=value))
            )

    results = client.search(
        collection_name=collection,
        query_vector=get_embedding(query),
        query_filter=Filter(must=conditions),
        limit=limit,
    )

    return [{"text": hit.payload["text"], "score": hit.score} for hit in results]

# Usage
results = filtered_search(
    query="machine learning",
    collection="docs",
    filters={
        "category": "technical",
        "date": {"gte": "2024-01-01"},
    },
)
```

## Hybrid Search

### Dense + Sparse Retrieval

```python
from qdrant_client.models import SparseVector
import numpy as np

def hybrid_search(
    query: str,
    collection: str,
    alpha: float = 0.5,  # Weight for dense vs sparse
    limit: int = 10,
) -> list[dict]:
    # Dense embedding
    dense_vector = get_embedding(query)

    # Sparse embedding (BM25-style)
    sparse_vector = get_sparse_embedding(query)

    # Hybrid query
    results = client.search(
        collection_name=collection,
        query_vector=dense_vector,
        sparse_vector=sparse_vector,
        limit=limit * 2,  # Over-retrieve for re-ranking
    )

    # Normalize and combine scores
    dense_scores = np.array([r.score for r in results])
    dense_scores = (dense_scores - dense_scores.min()) / (dense_scores.max() - dense_scores.min() + 1e-6)

    final_results = []
    for i, hit in enumerate(results):
        combined_score = alpha * dense_scores[i] + (1 - alpha) * hit.sparse_score
        final_results.append({
            "text": hit.payload["text"],
            "score": combined_score,
            "metadata": hit.payload,
        })

    return sorted(final_results, key=lambda x: x["score"], reverse=True)[:limit]
```

### BM25 Integration

```python
from rank_bm25 import BM25Okapi

class HybridRetriever:
    def __init__(self, documents: list[dict], client: QdrantClient):
        self.documents = documents
        self.client = client

        # Build BM25 index
        tokenized = [doc["text"].lower().split() for doc in documents]
        self.bm25 = BM25Okapi(tokenized)

    def search(
        self,
        query: str,
        k: int = 10,
        alpha: float = 0.5,
    ) -> list[dict]:
        # BM25 scores
        tokenized_query = query.lower().split()
        bm25_scores = self.bm25.get_scores(tokenized_query)

        # Vector scores
        vector_results = self.client.search(
            collection_name="docs",
            query_vector=get_embedding(query),
            limit=len(self.documents),
        )
        vector_scores = {r.id: r.score for r in vector_results}

        # Combine scores
        combined = []
        for i, doc in enumerate(self.documents):
            score = alpha * vector_scores.get(i, 0) + (1 - alpha) * bm25_scores[i]
            combined.append({"doc": doc, "score": score})

        return sorted(combined, key=lambda x: x["score"], reverse=True)[:k]
```

## Re-Ranking

### Cross-Encoder Re-ranking

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank_results(
    query: str,
    results: list[dict],
    top_k: int = 5,
) -> list[dict]:
    # Prepare pairs
    pairs = [(query, r["text"]) for r in results]

    # Get rerank scores
    scores = reranker.predict(pairs)

    # Sort by rerank score
    for i, result in enumerate(results):
        result["rerank_score"] = scores[i]

    return sorted(results, key=lambda x: x["rerank_score"], reverse=True)[:top_k]
```

### Cohere Rerank

```python
import cohere

co = cohere.Client(api_key="your-key")

def cohere_rerank(
    query: str,
    documents: list[str],
    top_n: int = 5,
) -> list[dict]:
    response = co.rerank(
        query=query,
        documents=documents,
        model="rerank-english-v3.0",
        top_n=top_n,
    )

    return [
        {
            "text": documents[r.index],
            "score": r.relevance_score,
            "index": r.index,
        }
        for r in response.results
    ]
```

### Multi-Stage Pipeline

```python
class MultiStageRetriever:
    def __init__(
        self,
        vector_client,
        reranker: CrossEncoder,
        initial_k: int = 100,
        rerank_k: int = 20,
        final_k: int = 5,
    ):
        self.client = vector_client
        self.reranker = reranker
        self.initial_k = initial_k
        self.rerank_k = rerank_k
        self.final_k = final_k

    def retrieve(self, query: str) -> list[dict]:
        # Stage 1: Initial retrieval (fast, broad)
        initial_results = self.client.search(
            collection_name="docs",
            query_vector=get_embedding(query),
            limit=self.initial_k,
        )

        # Stage 2: Re-ranking (slower, accurate)
        texts = [r.payload["text"] for r in initial_results]
        pairs = [(query, text) for text in texts]
        rerank_scores = self.reranker.predict(pairs)

        # Combine and sort
        results = [
            {
                "text": initial_results[i].payload["text"],
                "initial_score": initial_results[i].score,
                "rerank_score": rerank_scores[i],
                "metadata": initial_results[i].payload,
            }
            for i in range(len(initial_results))
        ]

        # Sort by rerank score, take top
        results = sorted(results, key=lambda x: x["rerank_score"], reverse=True)
        return results[:self.final_k]
```

## Query Enhancement

### Query Expansion

```python
def expand_query(query: str, llm) -> list[str]:
    """Generate multiple query variations."""
    prompt = f"""Generate 3 alternative phrasings of this search query.
Return only the queries, one per line.

Original query: {query}

Alternative queries:"""

    response = llm.generate(prompt)
    alternatives = response.strip().split("\n")

    return [query] + alternatives[:3]

def multi_query_retrieve(
    query: str,
    collection: str,
    llm,
    k: int = 10,
) -> list[dict]:
    """Retrieve using multiple query variations."""
    queries = expand_query(query, llm)

    all_results = {}
    for q in queries:
        results = vector_search(q, collection, limit=k)
        for r in results:
            doc_id = hash(r["text"])
            if doc_id not in all_results or r["score"] > all_results[doc_id]["score"]:
                all_results[doc_id] = r

    return sorted(all_results.values(), key=lambda x: x["score"], reverse=True)[:k]
```

### HyDE (Hypothetical Document Embeddings)

```python
def hyde_retrieve(
    query: str,
    collection: str,
    llm,
    k: int = 10,
) -> list[dict]:
    """Generate hypothetical answer, then retrieve similar docs."""

    # Generate hypothetical answer
    prompt = f"""Write a detailed answer to this question as if you were
writing a document that would be a good search result.

Question: {query}

Answer:"""

    hypothetical_doc = llm.generate(prompt)

    # Use hypothetical doc for retrieval
    return vector_search(hypothetical_doc, collection, limit=k)
```

## Diversity and Relevance

### Maximal Marginal Relevance (MMR)

```python
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

def mmr_search(
    query: str,
    collection: str,
    k: int = 10,
    lambda_mult: float = 0.5,
    fetch_k: int = 50,
) -> list[dict]:
    """Select diverse and relevant results using MMR."""

    query_embedding = get_embedding(query)

    # Get initial candidates
    candidates = client.search(
        collection_name=collection,
        query_vector=query_embedding,
        limit=fetch_k,
    )

    candidate_embeddings = np.array([
        get_embedding(c.payload["text"]) for c in candidates
    ])

    # MMR selection
    selected_indices = []
    candidate_indices = list(range(len(candidates)))

    for _ in range(min(k, len(candidates))):
        if not candidate_indices:
            break

        mmr_scores = []
        for idx in candidate_indices:
            # Relevance to query
            relevance = cosine_similarity(
                [query_embedding],
                [candidate_embeddings[idx]]
            )[0][0]

            # Max similarity to selected
            if selected_indices:
                selected_sims = cosine_similarity(
                    [candidate_embeddings[idx]],
                    candidate_embeddings[selected_indices]
                )[0]
                max_sim = max(selected_sims)
            else:
                max_sim = 0

            mmr = lambda_mult * relevance - (1 - lambda_mult) * max_sim
            mmr_scores.append((idx, mmr))

        best_idx = max(mmr_scores, key=lambda x: x[1])[0]
        selected_indices.append(best_idx)
        candidate_indices.remove(best_idx)

    return [
        {
            "text": candidates[i].payload["text"],
            "score": candidates[i].score,
            "metadata": candidates[i].payload,
        }
        for i in selected_indices
    ]
```

## Context Assembly

### Context Window Management

```python
def assemble_context(
    results: list[dict],
    max_tokens: int = 4000,
    tokenizer = None,
) -> str:
    """Assemble context within token limit."""

    context_parts = []
    current_tokens = 0

    for i, result in enumerate(results):
        text = result["text"]
        tokens = len(tokenizer.encode(text)) if tokenizer else len(text) // 4

        if current_tokens + tokens > max_tokens:
            break

        context_parts.append(f"[Document {i+1}]\n{text}")
        current_tokens += tokens

    return "\n\n".join(context_parts)
```

### Recursive Summarization

```python
async def recursive_summarize(
    documents: list[str],
    llm,
    max_context: int = 4000,
) -> str:
    """Recursively summarize if documents exceed context."""

    combined = "\n\n".join(documents)

    if len(combined) <= max_context:
        return combined

    # Split into groups and summarize each
    chunk_size = len(documents) // 2
    chunks = [
        documents[:chunk_size],
        documents[chunk_size:],
    ]

    summaries = []
    for chunk in chunks:
        combined_chunk = "\n\n".join(chunk)
        summary = await llm.generate(
            f"Summarize these documents:\n\n{combined_chunk}"
        )
        summaries.append(summary)

    return await recursive_summarize(summaries, llm, max_context)
```

## Evaluation Metrics

### Retrieval Metrics

```python
def calculate_retrieval_metrics(
    queries: list[str],
    retrieved: list[list[str]],
    relevant: list[list[str]],
) -> dict:
    """Calculate standard retrieval metrics."""

    metrics = {
        "precision@5": [],
        "recall@5": [],
        "mrr": [],
        "ndcg@5": [],
    }

    for q_retrieved, q_relevant in zip(retrieved, relevant):
        relevant_set = set(q_relevant)

        # Precision@5
        hits_at_5 = sum(1 for d in q_retrieved[:5] if d in relevant_set)
        metrics["precision@5"].append(hits_at_5 / 5)

        # Recall@5
        metrics["recall@5"].append(hits_at_5 / len(relevant_set) if relevant_set else 0)

        # MRR
        for i, doc in enumerate(q_retrieved):
            if doc in relevant_set:
                metrics["mrr"].append(1 / (i + 1))
                break
        else:
            metrics["mrr"].append(0)

        # NDCG@5
        dcg = sum(
            (1 if doc in relevant_set else 0) / np.log2(i + 2)
            for i, doc in enumerate(q_retrieved[:5])
        )
        idcg = sum(1 / np.log2(i + 2) for i in range(min(5, len(relevant_set))))
        metrics["ndcg@5"].append(dcg / idcg if idcg > 0 else 0)

    return {k: np.mean(v) for k, v in metrics.items()}
```

## External Resources

- [RAG Survey Paper](https://arxiv.org/abs/2312.10997)
- [Cohere Rerank](https://docs.cohere.com/docs/reranking)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [HyDE Paper](https://arxiv.org/abs/2212.10496)
