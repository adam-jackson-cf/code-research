"""
RAG Evaluation Framework.

Metrics and evaluation patterns for RAG systems.
"""

import math
from dataclasses import dataclass

# ============================================================
# Data Models
# ============================================================


@dataclass
class EvaluationQuery:
    query: str
    relevant_doc_ids: list[str]
    expected_answer: str | None = None


@dataclass
class RetrievalMetrics:
    precision_at_k: dict[int, float]
    recall_at_k: dict[int, float]
    mrr: float  # Mean Reciprocal Rank
    ndcg_at_k: dict[int, float]
    map_score: float  # Mean Average Precision


@dataclass
class GenerationMetrics:
    faithfulness: float  # Answer supported by context
    relevance: float  # Answer addresses query
    completeness: float  # All aspects covered


@dataclass
class RAGEvaluationResult:
    retrieval: RetrievalMetrics
    generation: GenerationMetrics
    latency_ms: float
    num_queries: int


# ============================================================
# Retrieval Metrics Calculator
# ============================================================


class RetrievalEvaluator:
    """Calculate retrieval quality metrics."""

    def precision_at_k(
        self,
        retrieved: list[str],
        relevant: set[str],
        k: int,
    ) -> float:
        """Precision at K: fraction of top-K results that are relevant."""
        if k == 0:
            return 0.0
        retrieved_k = retrieved[:k]
        hits = sum(1 for doc in retrieved_k if doc in relevant)
        return hits / k

    def recall_at_k(
        self,
        retrieved: list[str],
        relevant: set[str],
        k: int,
    ) -> float:
        """Recall at K: fraction of relevant docs found in top-K."""
        if not relevant:
            return 0.0
        retrieved_k = set(retrieved[:k])
        hits = len(retrieved_k & relevant)
        return hits / len(relevant)

    def reciprocal_rank(
        self,
        retrieved: list[str],
        relevant: set[str],
    ) -> float:
        """Reciprocal Rank: 1/position of first relevant result."""
        for i, doc in enumerate(retrieved):
            if doc in relevant:
                return 1.0 / (i + 1)
        return 0.0

    def dcg_at_k(
        self,
        retrieved: list[str],
        relevant: set[str],
        k: int,
    ) -> float:
        """Discounted Cumulative Gain at K."""
        dcg = 0.0
        for i, doc in enumerate(retrieved[:k]):
            rel = 1.0 if doc in relevant else 0.0
            dcg += rel / math.log2(i + 2)  # +2 because position starts at 1
        return dcg

    def ndcg_at_k(
        self,
        retrieved: list[str],
        relevant: set[str],
        k: int,
    ) -> float:
        """Calculate normalized DCG at K."""
        dcg = self.dcg_at_k(retrieved, relevant, k)

        # Ideal DCG: all relevant docs at top
        ideal_k = min(k, len(relevant))
        idcg = sum(1.0 / math.log2(i + 2) for i in range(ideal_k))

        return dcg / idcg if idcg > 0 else 0.0

    def average_precision(
        self,
        retrieved: list[str],
        relevant: set[str],
    ) -> float:
        """Average Precision: mean of precision at each relevant result."""
        if not relevant:
            return 0.0

        precisions = []
        hits = 0

        for i, doc in enumerate(retrieved):
            if doc in relevant:
                hits += 1
                precision = hits / (i + 1)
                precisions.append(precision)

        return sum(precisions) / len(relevant) if precisions else 0.0

    def evaluate(
        self,
        retrieved: list[str],
        relevant: list[str],
        k_values: list[int] = [1, 3, 5, 10],
    ) -> RetrievalMetrics:
        """Calculate all retrieval metrics."""
        relevant_set = set(relevant)

        precision_at_k = {
            k: self.precision_at_k(retrieved, relevant_set, k) for k in k_values
        }

        recall_at_k = {
            k: self.recall_at_k(retrieved, relevant_set, k) for k in k_values
        }

        ndcg_at_k = {k: self.ndcg_at_k(retrieved, relevant_set, k) for k in k_values}

        return RetrievalMetrics(
            precision_at_k=precision_at_k,
            recall_at_k=recall_at_k,
            mrr=self.reciprocal_rank(retrieved, relevant_set),
            ndcg_at_k=ndcg_at_k,
            map_score=self.average_precision(retrieved, relevant_set),
        )


# ============================================================
# Generation Evaluator
# ============================================================


class GenerationEvaluator:
    """Evaluate generation quality using LLM-as-judge."""

    def __init__(self, llm):
        self.llm = llm

    async def evaluate_faithfulness(
        self,
        answer: str,
        context: list[str],
    ) -> float:
        """Check if answer is faithful to the provided context."""
        context_text = "\n".join(context)

        prompt = f"""Evaluate if the answer is fully supported by the context.
Score from 0 to 10, where:
0 = Answer completely contradicts or is unrelated to context
5 = Answer partially supported, some claims not in context
10 = Answer fully supported by context

Context:
{context_text}

Answer:
{answer}

Score (0-10):"""

        response = await self.llm.generate(prompt)
        try:
            score = int(response.strip().split()[0])
            return min(max(score / 10, 0), 1)
        except Exception:
            return 0.5

    async def evaluate_relevance(
        self,
        query: str,
        answer: str,
    ) -> float:
        """Check if answer addresses the query."""
        prompt = f"""Evaluate if the answer directly addresses the question.
Score from 0 to 10, where:
0 = Answer completely off-topic
5 = Answer partially addresses the question
10 = Answer fully and directly addresses the question

Question:
{query}

Answer:
{answer}

Score (0-10):"""

        response = await self.llm.generate(prompt)
        try:
            score = int(response.strip().split()[0])
            return min(max(score / 10, 0), 1)
        except Exception:
            return 0.5

    async def evaluate_completeness(
        self,
        query: str,
        answer: str,
        expected_aspects: list[str] | None = None,
    ) -> float:
        """Check if answer covers all expected aspects."""
        aspects_text = ""
        if expected_aspects:
            aspects_text = f"Expected aspects: {', '.join(expected_aspects)}\n"

        prompt = f"""Evaluate the completeness of the answer.
Score from 0 to 10, where:
0 = Answer is empty or minimal
5 = Answer covers some but not all aspects
10 = Answer is comprehensive and complete

Question:
{query}

{aspects_text}
Answer:
{answer}

Score (0-10):"""

        response = await self.llm.generate(prompt)
        try:
            score = int(response.strip().split()[0])
            return min(max(score / 10, 0), 1)
        except Exception:
            return 0.5

    async def evaluate(
        self,
        query: str,
        answer: str,
        context: list[str],
    ) -> GenerationMetrics:
        """Calculate all generation metrics."""
        faithfulness = await self.evaluate_faithfulness(answer, context)
        relevance = await self.evaluate_relevance(query, answer)
        completeness = await self.evaluate_completeness(query, answer)

        return GenerationMetrics(
            faithfulness=faithfulness,
            relevance=relevance,
            completeness=completeness,
        )


# ============================================================
# Full RAG Evaluator
# ============================================================


class RAGEvaluator:
    """Comprehensive RAG system evaluation."""

    def __init__(
        self,
        retrieval_evaluator: RetrievalEvaluator,
        generation_evaluator: GenerationEvaluator,
    ):
        self.retrieval_eval = retrieval_evaluator
        self.generation_eval = generation_evaluator

    async def evaluate_single(
        self,
        query: str,
        retrieved_docs: list[str],
        relevant_docs: list[str],
        answer: str,
        context: list[str],
    ) -> tuple[RetrievalMetrics, GenerationMetrics]:
        """Evaluate a single query."""
        retrieval_metrics = self.retrieval_eval.evaluate(retrieved_docs, relevant_docs)
        generation_metrics = await self.generation_eval.evaluate(query, answer, context)
        return retrieval_metrics, generation_metrics

    async def evaluate_batch(
        self,
        evaluations: list[dict],
    ) -> dict:
        """Evaluate a batch of queries and aggregate results."""
        all_retrieval = []
        all_generation = []

        for eval_data in evaluations:
            retrieval, generation = await self.evaluate_single(
                query=eval_data["query"],
                retrieved_docs=eval_data["retrieved_docs"],
                relevant_docs=eval_data["relevant_docs"],
                answer=eval_data["answer"],
                context=eval_data["context"],
            )
            all_retrieval.append(retrieval)
            all_generation.append(generation)

        # Aggregate retrieval metrics
        avg_retrieval = {
            "precision@5": sum(r.precision_at_k.get(5, 0) for r in all_retrieval)
            / len(all_retrieval),
            "recall@5": sum(r.recall_at_k.get(5, 0) for r in all_retrieval)
            / len(all_retrieval),
            "mrr": sum(r.mrr for r in all_retrieval) / len(all_retrieval),
            "ndcg@5": sum(r.ndcg_at_k.get(5, 0) for r in all_retrieval)
            / len(all_retrieval),
            "map": sum(r.map_score for r in all_retrieval) / len(all_retrieval),
        }

        # Aggregate generation metrics
        avg_generation = {
            "faithfulness": sum(g.faithfulness for g in all_generation)
            / len(all_generation),
            "relevance": sum(g.relevance for g in all_generation) / len(all_generation),
            "completeness": sum(g.completeness for g in all_generation)
            / len(all_generation),
        }

        return {
            "retrieval": avg_retrieval,
            "generation": avg_generation,
            "num_queries": len(evaluations),
        }


# ============================================================
# RAGAS-Style Metrics
# ============================================================


class RAGASEvaluator:
    """
    Evaluate RAG systems using RAGAS-style metrics.

    Based on: https://arxiv.org/abs/2309.15217
    """

    def __init__(self, llm):
        self.llm = llm

    async def context_precision(
        self,
        query: str,
        contexts: list[str],
    ) -> float:
        """Measure how much of the context is relevant to the query."""
        relevant_count = 0

        for context in contexts:
            prompt = f"""Is this context relevant to the question?
Answer only YES or NO.

Question: {query}
Context: {context[:500]}

Answer:"""
            response = await self.llm.generate(prompt)
            if "YES" in response.upper():
                relevant_count += 1

        return relevant_count / len(contexts) if contexts else 0

    async def answer_relevancy(
        self,
        query: str,
        answer: str,
    ) -> float:
        """Generate questions from answer and compare to original query."""
        prompt = f"""Generate 3 questions that this answer would be a good response to.
Return only the questions, one per line.

Answer: {answer}

Questions:"""

        response = await self.llm.generate(prompt)
        generated_questions = response.strip().split("\n")[:3]

        # Simple similarity check (in practice, use embeddings)
        query_words = set(query.lower().split())
        similarities = []

        for q in generated_questions:
            q_words = set(q.lower().split())
            overlap = len(query_words & q_words)
            similarity = overlap / max(len(query_words), len(q_words), 1)
            similarities.append(similarity)

        return sum(similarities) / len(similarities) if similarities else 0

    async def context_recall(
        self,
        answer: str,
        contexts: list[str],
        ground_truth: str,
    ) -> float:
        """Measure if ground truth information is present in contexts."""
        prompt = f"""Check if the key information from the ground truth is covered in the contexts.
Score from 0 to 10.

Ground Truth: {ground_truth}

Contexts:
{chr(10).join(contexts)}

Score (0-10):"""

        response = await self.llm.generate(prompt)
        try:
            score = int(response.strip().split()[0])
            return min(max(score / 10, 0), 1)
        except Exception:
            return 0.5


# ============================================================
# Usage Example
# ============================================================


async def main():
    # Mock LLM for demonstration
    class MockLLM:
        async def generate(self, prompt: str) -> str:
            return "7"  # Mock score

    llm = MockLLM()

    # Initialize evaluators
    retrieval_eval = RetrievalEvaluator()
    generation_eval = GenerationEvaluator(llm)

    # Example evaluation data
    retrieved = ["doc1", "doc2", "doc3", "doc4", "doc5"]
    relevant = ["doc1", "doc3", "doc7"]

    # Calculate retrieval metrics
    print("Retrieval Metrics:")
    print("=" * 40)
    metrics = retrieval_eval.evaluate(retrieved, relevant)
    print(f"Precision@5: {metrics.precision_at_k[5]:.4f}")
    print(f"Recall@5: {metrics.recall_at_k[5]:.4f}")
    print(f"MRR: {metrics.mrr:.4f}")
    print(f"NDCG@5: {metrics.ndcg_at_k[5]:.4f}")
    print(f"MAP: {metrics.map_score:.4f}")

    # Calculate generation metrics
    print("\nGeneration Metrics:")
    print("=" * 40)
    gen_metrics = await generation_eval.evaluate(
        query="What is machine learning?",
        answer="Machine learning is a type of AI that learns from data.",
        context=["ML is a subset of AI.", "It learns patterns from data."],
    )
    print(f"Faithfulness: {gen_metrics.faithfulness:.4f}")
    print(f"Relevance: {gen_metrics.relevance:.4f}")
    print(f"Completeness: {gen_metrics.completeness:.4f}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
