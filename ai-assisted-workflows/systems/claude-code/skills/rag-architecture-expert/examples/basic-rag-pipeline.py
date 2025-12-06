"""
Basic RAG Pipeline Example.

Simple implementation demonstrating core RAG patterns.
"""

import asyncio
from dataclasses import dataclass
from typing import Protocol

# ============================================================
# Interfaces
# ============================================================


class EmbeddingProvider(Protocol):
    async def embed(self, text: str) -> list[float]:
        ...

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        ...


class VectorStore(Protocol):
    async def upsert(self, doc_id: str, vector: list[float], metadata: dict) -> None:
        ...

    async def search(self, vector: list[float], limit: int) -> list[dict]:
        ...


class LLMProvider(Protocol):
    async def generate(self, prompt: str) -> str:
        ...


# ============================================================
# Data Models
# ============================================================


@dataclass
class Document:
    id: str
    text: str
    metadata: dict


@dataclass
class RetrievalResult:
    document: Document
    score: float


@dataclass
class RAGResponse:
    answer: str
    sources: list[Document]
    retrieval_scores: list[float]


# ============================================================
# Text Chunking
# ============================================================


def chunk_text(
    text: str,
    chunk_size: int = 512,
    overlap: int = 50,
) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        # Try to break at sentence boundary
        if end < len(text):
            last_period = chunk.rfind(". ")
            if last_period > chunk_size // 2:
                chunk = chunk[: last_period + 1]
                end = start + last_period + 1

        chunks.append(chunk.strip())
        start = end - overlap

    return chunks


# ============================================================
# RAG Pipeline
# ============================================================


class BasicRAGPipeline:
    """Simple RAG pipeline for document Q&A."""

    def __init__(
        self,
        embedding_provider: EmbeddingProvider,
        vector_store: VectorStore,
        llm_provider: LLMProvider,
        top_k: int = 5,
    ):
        self.embedder = embedding_provider
        self.vector_store = vector_store
        self.llm = llm_provider
        self.top_k = top_k
        self._documents: dict[str, Document] = {}

    async def ingest_document(
        self,
        doc_id: str,
        text: str,
        metadata: dict | None = None,
    ) -> int:
        """Ingest a document into the RAG system."""
        metadata = metadata or {}

        # Chunk the document
        chunks = chunk_text(text)

        # Generate embeddings
        embeddings = await self.embedder.embed_batch(chunks)

        # Store each chunk
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings, strict=False)):
            chunk_id = f"{doc_id}_chunk_{i}"
            chunk_metadata = {
                **metadata,
                "doc_id": doc_id,
                "chunk_index": i,
                "total_chunks": len(chunks),
            }

            doc = Document(id=chunk_id, text=chunk, metadata=chunk_metadata)
            self._documents[chunk_id] = doc

            await self.vector_store.upsert(
                id=chunk_id,
                vector=embedding,
                metadata=chunk_metadata,
            )

        return len(chunks)

    async def retrieve(self, query: str) -> list[RetrievalResult]:
        """Retrieve relevant documents for a query."""
        # Embed query
        query_embedding = await self.embedder.embed(query)

        # Search vector store
        results = await self.vector_store.search(
            vector=query_embedding,
            limit=self.top_k,
        )

        # Map to documents
        retrieval_results = []
        for result in results:
            doc_id = result["id"]
            if doc_id in self._documents:
                retrieval_results.append(
                    RetrievalResult(
                        document=self._documents[doc_id],
                        score=result["score"],
                    )
                )

        return retrieval_results

    async def generate_response(
        self,
        query: str,
        context: list[RetrievalResult],
    ) -> str:
        """Generate response using retrieved context."""
        # Format context
        context_text = "\n\n".join(
            f"[Source {i+1}]: {r.document.text}" for i, r in enumerate(context)
        )

        # Create prompt
        prompt = f"""Answer the following question based on the provided context.
If the context doesn't contain enough information, say so.

Context:
{context_text}

Question: {query}

Answer:"""

        return await self.llm.generate(prompt)

    async def query(self, query: str) -> RAGResponse:
        """Execute full RAG pipeline."""
        # Retrieve relevant documents
        retrieval_results = await self.retrieve(query)

        # Generate response
        answer = await self.generate_response(query, retrieval_results)

        return RAGResponse(
            answer=answer,
            sources=[r.document for r in retrieval_results],
            retrieval_scores=[r.score for r in retrieval_results],
        )


# ============================================================
# Mock Implementations (for demonstration)
# ============================================================


class MockEmbeddingProvider:
    """Mock embedding provider for testing."""

    async def embed(self, text: str) -> list[float]:
        # Simple hash-based mock embedding
        import hashlib

        hash_bytes = hashlib.sha256(text.encode()).digest()
        return [b / 255.0 for b in hash_bytes[:128]]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed(text) for text in texts]


class MockVectorStore:
    """Mock vector store for testing."""

    def __init__(self):
        self._vectors: dict[str, tuple[list[float], dict]] = {}

    async def upsert(
        self,
        doc_id: str,
        vector: list[float],
        metadata: dict,
    ) -> None:
        self._vectors[doc_id] = (vector, metadata)

    async def search(
        self,
        vector: list[float],
        limit: int,
    ) -> list[dict]:
        # Simple cosine similarity
        import math

        def cosine_sim(a: list[float], b: list[float]) -> float:
            dot = sum(x * y for x, y in zip(a, b, strict=False))
            norm_a = math.sqrt(sum(x * x for x in a))
            norm_b = math.sqrt(sum(x * x for x in b))
            return dot / (norm_a * norm_b) if norm_a and norm_b else 0

        scores = [
            {"id": doc_id, "score": cosine_sim(vector, v), "metadata": m}
            for doc_id, (v, m) in self._vectors.items()
        ]

        return sorted(scores, key=lambda x: x["score"], reverse=True)[:limit]


class MockLLMProvider:
    """Mock LLM provider for testing."""

    async def generate(self, prompt: str) -> str:
        return (
            f"This is a mock response based on the provided context. {prompt[:50]}..."
        )


# ============================================================
# Usage Example
# ============================================================


async def main():
    # Initialize pipeline with mock providers
    pipeline = BasicRAGPipeline(
        embedding_provider=MockEmbeddingProvider(),
        vector_store=MockVectorStore(),
        llm_provider=MockLLMProvider(),
        top_k=3,
    )

    # Ingest sample documents
    documents = [
        {
            "id": "doc1",
            "text": """Python is a high-level programming language known for
            its clear syntax and readability. It supports multiple programming
            paradigms including procedural, object-oriented, and functional
            programming. Python is widely used in web development, data science,
            artificial intelligence, and automation.""",
            "metadata": {"topic": "programming", "language": "english"},
        },
        {
            "id": "doc2",
            "text": """Machine learning is a subset of artificial intelligence
            that enables systems to learn and improve from experience without
            being explicitly programmed. It focuses on developing algorithms
            that can access data and use it to learn for themselves.""",
            "metadata": {"topic": "AI", "language": "english"},
        },
    ]

    print("Ingesting documents...")
    for doc in documents:
        chunks = await pipeline.ingest_document(
            doc_id=doc["id"],
            text=doc["text"],
            metadata=doc["metadata"],
        )
        print(f"  Ingested {doc['id']}: {chunks} chunks")

    # Query the system
    queries = [
        "What is Python used for?",
        "How does machine learning work?",
    ]

    print("\nRunning queries...")
    for query in queries:
        print(f"\nQuery: {query}")
        response = await pipeline.query(query)
        print(f"Answer: {response.answer}")
        print(f"Sources: {len(response.sources)}")
        print(f"Top score: {response.retrieval_scores[0]:.4f}")


if __name__ == "__main__":
    asyncio.run(main())
