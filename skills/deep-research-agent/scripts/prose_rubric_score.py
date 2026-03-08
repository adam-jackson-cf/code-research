#!/usr/bin/env python3
"""Score prose quality against deterministic rubric dimensions and gate thresholds."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from deterministic_contracts import SCHEMA_VERSION, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Score prose on clarity/evidence/counterpoint/implication/actionability "
            "and enforce threshold gates."
        )
    )
    parser.add_argument("--input-path", required=True, help="Path to prose text/markdown file")
    parser.add_argument("--output-path", help="Optional report JSON output path")
    parser.add_argument(
        "--min-dimension",
        type=float,
        default=3.0,
        help="Minimum score required for each rubric dimension",
    )
    parser.add_argument(
        "--min-overall",
        type=float,
        default=3.5,
        help="Minimum average score required across all dimensions",
    )
    return parser.parse_args()


def _split_sentences(text: str) -> list[str]:
    sentences = [segment.strip() for segment in re.split(r"[.!?]+", text) if segment.strip()]
    return sentences


def _word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9%'-]+", text))


def _score_clarity(text: str) -> tuple[int, str]:
    sentences = _split_sentences(text)
    paragraph_count = len([part for part in re.split(r"\n\s*\n", text) if part.strip()])
    total_words = _word_count(text)
    avg_sentence_len = total_words / len(sentences) if sentences else 0.0

    ambiguous_hits = len(
        re.findall(r"\b(maybe|might|possibly|various|some|many|stuff|things|etc)\b", text, re.I)
    )

    score = 0
    if len(sentences) >= 2:
        score += 1
    if 8 <= avg_sentence_len <= 28:
        score += 2
    elif 5 <= avg_sentence_len <= 35:
        score += 1
    if paragraph_count >= 2:
        score += 1
    if ambiguous_hits <= 2:
        score += 1

    score = min(score, 5)
    rationale = (
        f"sentences={len(sentences)}, avgSentenceLength={avg_sentence_len:.2f}, "
        f"paragraphs={paragraph_count}, ambiguousTerms={ambiguous_hits}"
    )
    return score, rationale


def _score_evidence(text: str) -> tuple[int, str]:
    citation_hits = len(re.findall(r"\[[0-9]+\]", text))
    url_hits = len(re.findall(r"https?://", text))
    numeric_hits = len(re.findall(r"\b\d+(?:\.\d+)?%?\b", text))
    attribution_hits = len(
        re.findall(
            r"\b(according to|data shows|study found|reported by|source indicates)\b",
            text,
            re.I,
        )
    )

    score = 0
    if citation_hits + url_hits >= 1:
        score += 2
    if numeric_hits >= 2:
        score += 2
    elif numeric_hits == 1:
        score += 1
    if attribution_hits >= 1:
        score += 1

    score = min(score, 5)
    rationale = (
        f"citations={citation_hits}, urls={url_hits}, numerics={numeric_hits}, "
        f"attributions={attribution_hits}"
    )
    return score, rationale


def _score_counterpoint(text: str) -> tuple[int, str]:
    counterpoint_hits = len(
        re.findall(
            r"\b(however|although|but|on the other hand|limitation|risk|caveat|trade-off)\b",
            text,
            re.I,
        )
    )
    mitigation_hits = len(re.findall(r"\b(mitigate|address|offset|while still|guardrail)\b", text, re.I))

    score = 0
    if counterpoint_hits >= 1:
        score += 3
    if counterpoint_hits >= 2:
        score += 1
    if mitigation_hits >= 1:
        score += 1

    score = min(score, 5)
    rationale = f"counterpointSignals={counterpoint_hits}, mitigationSignals={mitigation_hits}"
    return score, rationale


def _score_implication(text: str) -> tuple[int, str]:
    implication_hits = len(
        re.findall(
            r"\b(therefore|this means|implication|impact|consequence|as a result|leads to)\b",
            text,
            re.I,
        )
    )
    stakeholder_hits = len(
        re.findall(r"\b(team|customer|business|cost|timeline|risk|operations|revenue)\b", text, re.I)
    )

    score = 0
    if implication_hits >= 1:
        score += 3
    if implication_hits >= 2:
        score += 1
    if stakeholder_hits >= 1:
        score += 1

    score = min(score, 5)
    rationale = f"implicationSignals={implication_hits}, stakeholderSignals={stakeholder_hits}"
    return score, rationale


def _score_actionability(text: str) -> tuple[int, str]:
    action_hits = len(
        re.findall(
            r"\b(should|recommend|next step|implement|prioritize|assign|schedule|measure|track|ship)\b",
            text,
            re.I,
        )
    )
    timeline_hits = len(
        re.findall(
            r"\b(by\s+\w+|within\s+\d+\s+(day|days|week|weeks|month|months)|Q[1-4])\b",
            text,
            re.I,
        )
    )
    list_hits = len(re.findall(r"(^\s*[-*]\s+)|(^\s*\d+\.\s+)", text, re.M))

    score = 0
    if action_hits >= 1:
        score += 3
    if action_hits >= 3:
        score += 1
    if timeline_hits >= 1:
        score += 1
    if list_hits >= 1:
        score += 1

    score = min(score, 5)
    rationale = f"actionSignals={action_hits}, timelineSignals={timeline_hits}, listSignals={list_hits}"
    return score, rationale


def score_prose(text: str) -> dict[str, Any]:
    dimensions = {
        "clarity": _score_clarity(text),
        "evidence": _score_evidence(text),
        "counterpoint": _score_counterpoint(text),
        "implication": _score_implication(text),
        "actionability": _score_actionability(text),
    }

    scores = {dimension: payload[0] for dimension, payload in dimensions.items()}
    rationales = {dimension: payload[1] for dimension, payload in dimensions.items()}
    overall = round(sum(scores.values()) / len(scores), 3)

    return {
        "scores": scores,
        "rationales": rationales,
        "overallScore": overall,
    }


def evaluate_gate(text: str, min_dimension: float, min_overall: float) -> dict[str, Any]:
    scored = score_prose(text)
    scores = scored["scores"]

    failing_dimensions = sorted(
        [dimension for dimension, score in scores.items() if score < min_dimension]
    )
    passed = not failing_dimensions and scored["overallScore"] >= min_overall

    return {
        "schemaVersion": SCHEMA_VERSION,
        "status": "pass" if passed else "fail",
        "thresholds": {
            "minDimension": min_dimension,
            "minOverall": min_overall,
        },
        "scores": scores,
        "overallScore": scored["overallScore"],
        "failingDimensions": failing_dimensions,
        "rationales": scored["rationales"],
    }


def main() -> int:
    args = parse_args()
    input_path = Path(args.input_path)
    text = input_path.read_text(encoding="utf-8")

    report = evaluate_gate(text, args.min_dimension, args.min_overall)

    if args.output_path:
        write_json(Path(args.output_path), report)

    print(json.dumps(report, sort_keys=True))
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
