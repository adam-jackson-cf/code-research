---
name: rag-architecture-expert
description: RAG system architecture, embedding strategies, retrieval patterns, and production deployment
version: 0.2.0
allowed-tools:
  - Task
  - AskUserQuestion
  - Read
  - Bash
---

# RAG Architecture Expert

## What This Skill Does

Provides RAG system design guidance: embedding model selection, chunking strategies, retrieval patterns (hybrid search, re-ranking), and production deployment with caching and monitoring.

**When to use**: RAG architecture, embedding strategies, vector search, hybrid retrieval, re-ranking, RAG production deployment.

---

**Requirements**:

- Vector database (Qdrant, Pinecone, Chroma)
- Embedding API (OpenAI, Cohere, or self-hosted)
- LLM API for generation

---

## Need to...? Read This

| Your Goal                                      | Resource File                                                   |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Select embeddings, chunking, indexing          | [embedding-strategies.md](references/embedding-strategies.md)   |
| Implement retrieval, re-ranking, hybrid search | [retrieval-patterns.md](references/retrieval-patterns.md)       |
| Scale to production, cache, monitor            | [production-deployment.md](references/production-deployment.md) |

---

## Workflow Overview

### Stage 1: Requirements Analysis

**Purpose**: Understand use case, data volume, latency requirements
**Details**: [production-deployment.md](references/production-deployment.md)

### Stage 2: Embedding Strategy

**Purpose**: Model selection, chunking approach, metadata enrichment
**Details**: [embedding-strategies.md](references/embedding-strategies.md)

### Stage 3: Retrieval Design

**Purpose**: Hybrid search, re-ranking, query enhancement
**Details**: [retrieval-patterns.md](references/retrieval-patterns.md)

### Stage 4: Production Setup

**Purpose**: Caching, rate limiting, monitoring, cost optimization
**Details**: [production-deployment.md](references/production-deployment.md)

### Stage 5: Evaluation

**Purpose**: Retrieval metrics, response validation, A/B testing
**Details**: [retrieval-patterns.md](references/retrieval-patterns.md)

---

**Version:** 0.2.0
