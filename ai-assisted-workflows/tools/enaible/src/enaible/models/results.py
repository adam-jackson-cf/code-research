"""Domain models for normalized Enaible analyzer responses."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any


@dataclass(slots=True)
class FindingPayload:
    """Normalized representation of a single analyzer finding."""

    id: str
    title: str
    description: str
    severity: str
    recommendation: str | None
    file_path: str | None = None
    line_number: int | None = None
    evidence: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_core(cls, payload: dict[str, Any]) -> FindingPayload:
        return cls(
            id=str(payload.get("id", "")),
            title=str(payload.get("title", "")),
            description=str(payload.get("description", "")),
            severity=str(payload.get("severity", "info")),
            recommendation=payload.get("recommendation"),
            file_path=payload.get("file_path"),
            line_number=payload.get("line_number"),
            evidence=payload.get("evidence", {}) or {},
        )


@dataclass(slots=True)
class AnalysisResultContext:
    """Context object for creating AnalyzerRunResponse from analysis results."""

    tool: str
    result: Any
    started_at: float
    finished_at: float
    summary_mode: bool
    min_severity: str


@dataclass(slots=True)
class AnalyzerRunResponse:
    """Normalized payload returned from `enaible analyzers run`."""

    tool: str
    analyzer_type: str
    success: bool
    exit_code: int
    started_at: str
    completed_at: str
    duration_ms: int
    target: str
    findings: list[FindingPayload] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    stats: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "tool": self.tool,
            "analyzer_type": self.analyzer_type,
            "success": self.success,
            "exit_code": self.exit_code,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_ms": self.duration_ms,
            "target": self.target,
            "findings": [asdict(finding) for finding in self.findings],
            "summary": self.summary,
            "metadata": self.metadata,
            "stats": self.stats,
            "errors": self.errors,
            "raw": self.raw,
        }

    @classmethod
    def from_analysis_result(cls, ctx: AnalysisResultContext) -> AnalyzerRunResponse:
        """Create AnalyzerRunResponse from analysis result context."""
        duration_ms = int((ctx.finished_at - ctx.started_at) * 1000)
        started_iso = datetime.fromtimestamp(ctx.started_at, UTC).isoformat()
        finished_iso = datetime.fromtimestamp(ctx.finished_at, UTC).isoformat()

        raw_dict = ctx.result.to_dict(
            summary_mode=ctx.summary_mode, min_severity=ctx.min_severity
        )
        findings = [
            FindingPayload.from_core(item) for item in raw_dict.get("findings", [])
        ]

        exit_code = 0 if ctx.result.success else 1
        errors: list[str] = []
        if not ctx.result.success and getattr(ctx.result, "error_message", None):
            errors.append(str(ctx.result.error_message))

        stats = {
            "execution_time_seconds": getattr(ctx.result, "execution_time", None),
            "files_processed": getattr(ctx.result, "files_processed", None),
            "processing_errors": getattr(ctx.result, "processing_errors", None),
        }

        summary = raw_dict.get(
            "summary",
            ctx.result.get_summary() if hasattr(ctx.result, "get_summary") else {},
        )

        metadata = raw_dict.get("metadata", {})
        if (
            isinstance(metadata, dict)
            and "info" in metadata
            and not raw_dict.get("findings")
        ):
            stats.setdefault("notes", metadata["info"])

        return cls(
            tool=ctx.tool,
            analyzer_type=getattr(
                ctx.result.analysis_type, "value", str(ctx.result.analysis_type)
            ),
            success=bool(ctx.result.success),
            exit_code=exit_code,
            started_at=started_iso,
            completed_at=finished_iso,
            duration_ms=duration_ms,
            target=getattr(ctx.result, "target_path", ""),
            findings=findings,
            summary=summary,
            metadata=metadata,
            stats={k: v for k, v in stats.items() if v is not None},
            errors=errors,
            raw=raw_dict,
        )
