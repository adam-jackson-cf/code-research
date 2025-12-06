"""
Hybrid Search Example.

Combines dense (semantic) and sparse (keyword) retrieval.
"""

import math
import re
from collections import Counter
from dataclasses import dataclass

# ============================================================
# Data Models
# ============================================================


@dataclass
class SearchResult:
    doc_id: str
    text: str
    dense_score: float
    sparse_score: float
    combined_score: float
    metadata: dict


# ============================================================
# BM25 Implementation
# ============================================================


class BM25:
    """BM25 sparse retrieval implementation."""

    def __init__(
        self,
        k1: float = 1.5,
        b: float = 0.75,
    ):
        self.k1 = k1
        self.b = b
        self.doc_freqs: dict[str, int] = {}
        self.doc_lengths: dict[str, int] = {}
        self.avg_doc_length: float = 0
        self.doc_tokens: dict[str, list[str]] = {}
        self.num_docs: int = 0

    def tokenize(self, text: str) -> list[str]:
        """Tokenize text using simple word extraction."""
        text = text.lower()
        tokens = re.findall(r"\b\w+\b", text)
        return tokens

    def add_document(self, doc_id: str, text: str) -> None:
        """Add document to BM25 index."""
        tokens = self.tokenize(text)
        self.doc_tokens[doc_id] = tokens
        self.doc_lengths[doc_id] = len(tokens)

        # Update document frequencies
        unique_tokens = set(tokens)
        for token in unique_tokens:
            self.doc_freqs[token] = self.doc_freqs.get(token, 0) + 1

        self.num_docs += 1
        self.avg_doc_length = sum(self.doc_lengths.values()) / self.num_docs

    def score(self, query: str, doc_id: str) -> float:
        """Calculate BM25 score for a document."""
        query_tokens = self.tokenize(query)
        doc_tokens = self.doc_tokens.get(doc_id, [])

        if not doc_tokens:
            return 0.0

        doc_length = self.doc_lengths[doc_id]
        token_counts = Counter(doc_tokens)

        score = 0.0
        for token in query_tokens:
            if token not in token_counts:
                continue

            tf = token_counts[token]
            df = self.doc_freqs.get(token, 0)

            if df == 0:
                continue

            # IDF component
            idf = math.log((self.num_docs - df + 0.5) / (df + 0.5) + 1)

            # TF component with length normalization
            tf_norm = (tf * (self.k1 + 1)) / (
                tf + self.k1 * (1 - self.b + self.b * doc_length / self.avg_doc_length)
            )

            score += idf * tf_norm

        return score

    def search(self, query: str, limit: int = 10) -> list[tuple[str, float]]:
        """Search documents by BM25 score."""
        scores = [(doc_id, self.score(query, doc_id)) for doc_id in self.doc_tokens]
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:limit]


# ============================================================
# Hybrid Retriever
# ============================================================


class HybridRetriever:
    """Combines dense and sparse retrieval with score fusion."""

    def __init__(
        self,
        dense_weight: float = 0.5,
        normalize_scores: bool = True,
    ):
        self.dense_weight = dense_weight
        self.sparse_weight = 1.0 - dense_weight
        self.normalize_scores = normalize_scores

        self.bm25 = BM25()
        self.documents: dict[str, dict] = {}
        self.embeddings: dict[str, list[float]] = {}

    def add_document(
        self,
        doc_id: str,
        text: str,
        embedding: list[float],
        metadata: dict | None = None,
    ) -> None:
        """Add document to both dense and sparse indices."""
        self.documents[doc_id] = {
            "text": text,
            "metadata": metadata or {},
        }
        self.embeddings[doc_id] = embedding
        self.bm25.add_document(doc_id, text)

    def _normalize(self, scores: list[float]) -> list[float]:
        """Min-max normalization."""
        if not scores:
            return scores

        min_score = min(scores)
        max_score = max(scores)
        range_score = max_score - min_score

        if range_score == 0:
            return [0.5] * len(scores)

        return [(s - min_score) / range_score for s in scores]

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        dot = sum(x * y for x, y in zip(a, b, strict=False))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        return dot / (norm_a * norm_b) if norm_a and norm_b else 0

    def search(
        self,
        query: str,
        query_embedding: list[float],
        limit: int = 10,
    ) -> list[SearchResult]:
        """Perform hybrid search combining dense and sparse retrieval."""
        # Get dense scores (vector similarity)
        dense_scores = {}
        for doc_id, doc_embedding in self.embeddings.items():
            dense_scores[doc_id] = self._cosine_similarity(
                query_embedding, doc_embedding
            )

        # Get sparse scores (BM25)
        sparse_results = self.bm25.search(query, limit=len(self.documents))
        sparse_scores = dict(sparse_results)

        # Normalize scores if requested
        if self.normalize_scores:
            dense_values = list(dense_scores.values())
            sparse_values = list(sparse_scores.values())

            dense_norm = dict(
                zip(dense_scores.keys(), self._normalize(dense_values), strict=False)
            )
            sparse_norm = dict(
                zip(sparse_scores.keys(), self._normalize(sparse_values), strict=False)
            )
        else:
            dense_norm = dense_scores
            sparse_norm = sparse_scores

        # Combine scores
        results = []
        for doc_id in self.documents:
            dense = dense_norm.get(doc_id, 0)
            sparse = sparse_norm.get(doc_id, 0)
            combined = self.dense_weight * dense + self.sparse_weight * sparse

            results.append(
                SearchResult(
                    doc_id=doc_id,
                    text=self.documents[doc_id]["text"],
                    dense_score=dense_scores.get(doc_id, 0),
                    sparse_score=sparse_scores.get(doc_id, 0),
                    combined_score=combined,
                    metadata=self.documents[doc_id]["metadata"],
                )
            )

        # Sort by combined score
        results.sort(key=lambda x: x.combined_score, reverse=True)
        return results[:limit]


# ============================================================
# Reciprocal Rank Fusion
# ============================================================


def reciprocal_rank_fusion(
    rankings: list[list[str]],
    k: int = 60,
) -> list[tuple[str, float]]:
    """
    Combine multiple rankings using Reciprocal Rank Fusion (RRF).

    RRF score = sum(1 / (k + rank_i)) for each ranking list
    """
    scores: dict[str, float] = {}

    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            if doc_id not in scores:
                scores[doc_id] = 0
            scores[doc_id] += 1 / (k + rank + 1)

    results = list(scores.items())
    results.sort(key=lambda x: x[1], reverse=True)
    return results


class RRFRetriever:
    """Retriever using Reciprocal Rank Fusion."""

    def __init__(self, rrf_k: int = 60):
        self.rrf_k = rrf_k
        self.bm25 = BM25()
        self.documents: dict[str, dict] = {}
        self.embeddings: dict[str, list[float]] = {}

    def add_document(
        self,
        doc_id: str,
        text: str,
        embedding: list[float],
        metadata: dict | None = None,
    ) -> None:
        self.documents[doc_id] = {
            "text": text,
            "metadata": metadata or {},
        }
        self.embeddings[doc_id] = embedding
        self.bm25.add_document(doc_id, text)

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b, strict=False))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        return dot / (norm_a * norm_b) if norm_a and norm_b else 0

    def search(
        self,
        query: str,
        query_embedding: list[float],
        limit: int = 10,
    ) -> list[dict]:
        """Perform RRF-based hybrid search."""
        # Get dense ranking
        dense_scores = [
            (doc_id, self._cosine_similarity(query_embedding, emb))
            for doc_id, emb in self.embeddings.items()
        ]
        dense_scores.sort(key=lambda x: x[1], reverse=True)
        dense_ranking = [doc_id for doc_id, _ in dense_scores]

        # Get sparse ranking
        sparse_results = self.bm25.search(query, limit=len(self.documents))
        sparse_ranking = [doc_id for doc_id, _ in sparse_results]

        # Apply RRF
        rrf_results = reciprocal_rank_fusion(
            [dense_ranking, sparse_ranking],
            k=self.rrf_k,
        )

        # Build results
        return [
            {
                "doc_id": doc_id,
                "text": self.documents[doc_id]["text"],
                "rrf_score": score,
                "metadata": self.documents[doc_id]["metadata"],
            }
            for doc_id, score in rrf_results[:limit]
        ]


# ============================================================
# Usage Example
# ============================================================


def mock_embedding(text: str) -> list[float]:
    """Generate mock embedding from text hash."""
    import hashlib

    hash_bytes = hashlib.sha256(text.encode()).digest()
    return [b / 255.0 for b in hash_bytes[:128]]


def main():
    # Initialize hybrid retriever
    retriever = HybridRetriever(dense_weight=0.6)

    # Sample documents
    documents = [
        (
            "doc1",
            "Python is a programming language for web development and data science.",
        ),
        ("doc2", "Machine learning uses algorithms to learn from data automatically."),
        ("doc3", "Python libraries like TensorFlow enable deep learning applications."),
        ("doc4", "Data science involves statistical analysis and machine learning."),
        ("doc5", "Web development frameworks include Django and Flask for Python."),
    ]

    # Add documents
    print("Adding documents...")
    for doc_id, text in documents:
        embedding = mock_embedding(text)
        retriever.add_document(doc_id, text, embedding, {"source": "example"})

    # Test queries
    queries = [
        "Python programming web",
        "machine learning data",
        "deep learning TensorFlow",
    ]

    print("\nHybrid Search Results:")
    print("=" * 60)

    for query in queries:
        print(f"\nQuery: '{query}'")
        query_embedding = mock_embedding(query)
        results = retriever.search(query, query_embedding, limit=3)

        for i, result in enumerate(results, 1):
            print(f"\n  {i}. {result.doc_id}")
            print(f"     Text: {result.text[:50]}...")
            print(f"     Dense: {result.dense_score:.4f}")
            print(f"     Sparse: {result.sparse_score:.4f}")
            print(f"     Combined: {result.combined_score:.4f}")

    # Test RRF retriever
    print("\n\nRRF Search Results:")
    print("=" * 60)

    rrf_retriever = RRFRetriever()
    for doc_id, text in documents:
        embedding = mock_embedding(text)
        rrf_retriever.add_document(doc_id, text, embedding)

    for query in queries:
        print(f"\nQuery: '{query}'")
        query_embedding = mock_embedding(query)
        results = rrf_retriever.search(query, query_embedding, limit=3)

        for i, result in enumerate(results, 1):
            print(f"  {i}. {result['doc_id']} (RRF: {result['rrf_score']:.4f})")


if __name__ == "__main__":
    main()
