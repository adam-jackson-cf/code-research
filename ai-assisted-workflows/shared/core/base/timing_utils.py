#!/usr/bin/env python3
"""
Performance Timing Utilities for Continuous Improvement Framework.

Eliminates duplication of timing and performance measurement patterns.
"""

import functools
import threading
import time
from collections import defaultdict
from collections.abc import Callable
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any


@dataclass
class TimingResult:
    """Result of a timing operation."""

    operation: str
    duration_seconds: float
    start_time: float
    end_time: float
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def duration_ms(self) -> float:
        """Duration in milliseconds."""
        return self.duration_seconds * 1000

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "operation": self.operation,
            "duration_seconds": self.duration_seconds,
            "duration_ms": self.duration_ms,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "metadata": self.metadata,
        }


class PerformanceTracker:
    """Thread-safe performance tracking for operations."""

    def __init__(self):
        self._timings: dict[str, list[TimingResult]] = defaultdict(list)
        self._lock = threading.Lock()
        self._active_operations: dict[str, float] = {}

    def record_timing(self, result: TimingResult) -> None:
        """Record a timing result."""
        with self._lock:
            self._timings[result.operation].append(result)

    def get_timings(
        self, operation: str | None = None
    ) -> dict[str, list[TimingResult]]:
        """Get recorded timings."""
        with self._lock:
            if operation:
                return {operation: self._timings.get(operation, [])}
            return dict(self._timings)

    def get_statistics(self, operation: str) -> dict[str, float]:
        """Get timing statistics for an operation."""
        with self._lock:
            timings = self._timings.get(operation, [])

            if not timings:
                return {"count": 0}

            durations = [t.duration_seconds for t in timings]

            return {
                "count": len(durations),
                "total": sum(durations),
                "average": sum(durations) / len(durations),
                "min": min(durations),
                "max": max(durations),
                "latest": durations[-1] if durations else 0.0,
            }

    def get_summary(self) -> dict[str, dict[str, float]]:
        """Get summary statistics for all operations."""
        with self._lock:
            summary = {}
            for operation in self._timings:
                summary[operation] = self.get_statistics(operation)
            return summary

    def clear(self, operation: str | None = None) -> None:
        """Clear timing records."""
        with self._lock:
            if operation:
                self._timings.pop(operation, None)
            else:
                self._timings.clear()


# Global performance tracker instance
_global_tracker = PerformanceTracker()


def get_performance_tracker() -> PerformanceTracker:
    """Get the global performance tracker instance."""
    return _global_tracker


def timed_operation(
    operation_name: str | None = None,
    metadata: dict[str, Any] | None = None,
    tracker: PerformanceTracker | None = None,
):
    """
    Decorate a function to time its execution.

    Args:
        operation_name: Name of the operation (defaults to function name)
        metadata: Additional metadata to record with timing
        tracker: Performance tracker to use (defaults to global tracker)
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            op_name = operation_name or func.__name__
            op_metadata = metadata or {}
            op_tracker = tracker or _global_tracker

            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                end_time = time.time()
                timing_result = TimingResult(
                    operation=op_name,
                    duration_seconds=end_time - start_time,
                    start_time=start_time,
                    end_time=end_time,
                    metadata=op_metadata.copy(),
                )
                op_tracker.record_timing(timing_result)

        return wrapper

    return decorator


@contextmanager
def time_operation(
    operation_name: str,
    metadata: dict[str, Any] | None = None,
    tracker: PerformanceTracker | None = None,
):
    """
    Context manager to time operations.

    Args:
        operation_name: Name of the operation
        metadata: Additional metadata to record with timing
        tracker: Performance tracker to use (defaults to global tracker)

    Yields
    ------
        TimingResult that will be populated with timing data
    """
    op_tracker = tracker or _global_tracker
    op_metadata = metadata or {}

    start_time = time.time()
    timing_result = TimingResult(
        operation=operation_name,
        duration_seconds=0.0,
        start_time=start_time,
        end_time=0.0,
        metadata=op_metadata.copy(),
    )

    try:
        yield timing_result
    finally:
        end_time = time.time()
        timing_result.end_time = end_time
        timing_result.duration_seconds = end_time - start_time
        op_tracker.record_timing(timing_result)


class OperationTimer:
    """Manual timer for operations with start/stop control."""

    def __init__(
        self,
        operation_name: str,
        metadata: dict[str, Any] | None = None,
        tracker: PerformanceTracker | None = None,
    ):
        self.operation_name = operation_name
        self.metadata = metadata or {}
        self.tracker = tracker or _global_tracker
        self.start_time: float | None = None
        self.end_time: float | None = None
        self._paused_duration: float = 0.0
        self._pause_start: float | None = None

    def start(self) -> "OperationTimer":
        """Start timing."""
        self.start_time = time.time()
        self.end_time = None
        self._paused_duration = 0.0
        self._pause_start = None
        return self

    def stop(self) -> TimingResult:
        """Stop timing and return result."""
        if self.start_time is None:
            raise RuntimeError("Timer not started")

        if self._pause_start is not None:
            # Account for any active pause
            self._paused_duration += time.time() - self._pause_start
            self._pause_start = None

        self.end_time = time.time()

        # Calculate effective duration (excluding paused time)
        total_duration = self.end_time - self.start_time
        effective_duration = total_duration - self._paused_duration

        result = TimingResult(
            operation=self.operation_name,
            duration_seconds=effective_duration,
            start_time=self.start_time,
            end_time=self.end_time,
            metadata={
                **self.metadata,
                "total_duration": total_duration,
                "paused_duration": self._paused_duration,
            },
        )

        self.tracker.record_timing(result)
        return result

    def pause(self) -> "OperationTimer":
        """Pause timing."""
        if self.start_time is None:
            raise RuntimeError("Timer not started")
        if self._pause_start is not None:
            raise RuntimeError("Timer already paused")

        self._pause_start = time.time()
        return self

    def resume(self) -> "OperationTimer":
        """Resume timing."""
        if self._pause_start is None:
            raise RuntimeError("Timer not paused")

        self._paused_duration += time.time() - self._pause_start
        self._pause_start = None
        return self

    def elapsed(self) -> float:
        """Get current elapsed time (excluding paused time)."""
        if self.start_time is None:
            return 0.0

        current_time = time.time()
        total_duration = current_time - self.start_time

        # Account for paused time
        paused_duration = self._paused_duration
        if self._pause_start is not None:
            paused_duration += current_time - self._pause_start

        return total_duration - paused_duration


class BatchTimer:
    """Timer for batched operations with statistics."""

    def __init__(self, operation_name: str, tracker: PerformanceTracker | None = None):
        self.operation_name = operation_name
        self.tracker = tracker or _global_tracker
        self.batch_timings: list[float] = []
        self.current_timer: OperationTimer | None = None

    def start_item(self, item_metadata: dict[str, Any] | None = None) -> "BatchTimer":
        """Start timing an individual item in the batch."""
        if self.current_timer is not None:
            raise RuntimeError("Item timer already active")

        metadata = {"batch_operation": self.operation_name}
        if item_metadata:
            metadata.update(item_metadata)

        self.current_timer = OperationTimer(
            f"{self.operation_name}_item", metadata=metadata, tracker=self.tracker
        )
        self.current_timer.start()
        return self

    def end_item(self) -> float:
        """End timing current item and return duration."""
        if self.current_timer is None:
            raise RuntimeError("No active item timer")

        result = self.current_timer.stop()
        duration = result.duration_seconds
        self.batch_timings.append(duration)
        self.current_timer = None
        return duration

    def complete_batch(self) -> TimingResult:
        """Complete the batch and record summary statistics."""
        if self.current_timer is not None:
            # Auto-complete any active item
            self.end_item()

        total_duration = 0.0 if not self.batch_timings else sum(self.batch_timings)

        metadata = {
            "batch_size": len(self.batch_timings),
            "individual_timings": self.batch_timings,
            "average_item_duration": sum(self.batch_timings) / len(self.batch_timings)
            if self.batch_timings
            else 0.0,
            "min_item_duration": min(self.batch_timings) if self.batch_timings else 0.0,
            "max_item_duration": max(self.batch_timings) if self.batch_timings else 0.0,
        }

        result = TimingResult(
            operation=self.operation_name,
            duration_seconds=total_duration,
            start_time=0.0,  # Not meaningful for batch
            end_time=0.0,  # Not meaningful for batch
            metadata=metadata,
        )

        self.tracker.record_timing(result)
        return result


def create_performance_report(
    tracker: PerformanceTracker | None = None, format_type: str = "summary"
) -> str | dict[str, Any]:
    """
    Create a performance report from recorded timings.

    Args:
        tracker: Performance tracker to use (defaults to global tracker)
        format_type: Report format ('summary', 'detailed', 'json')

    Returns
    -------
        Performance report in requested format
    """
    op_tracker = tracker or _global_tracker
    summary = op_tracker.get_summary()

    if format_type == "json":
        return summary
    elif format_type == "detailed":
        return _format_detailed_report(op_tracker, summary)
    else:  # summary
        return _format_summary_report(summary)


def _format_summary_report(summary: dict[str, dict[str, float]]) -> str:
    """Format summary performance report."""
    lines = ["Performance Summary:", "=" * 50]

    for operation, stats in summary.items():
        lines.append(f"\n{operation}:")
        lines.append(f"  Count: {int(stats['count'])}")
        lines.append(f"  Total: {stats['total']:.3f}s")
        lines.append(f"  Average: {stats['average']:.3f}s")
        lines.append(f"  Min: {stats['min']:.3f}s")
        lines.append(f"  Max: {stats['max']:.3f}s")

    return "\n".join(lines)


def _format_detailed_report(
    tracker: PerformanceTracker, summary: dict[str, dict[str, float]]
) -> str:
    """Format detailed performance report."""
    lines = ["Detailed Performance Report:", "=" * 50]

    for operation, stats in summary.items():
        lines.append(f"\n{operation} Statistics:")
        lines.append(f"  Count: {int(stats['count'])}")
        lines.append(f"  Total Duration: {stats['total']:.3f}s")
        lines.append(f"  Average Duration: {stats['average']:.3f}s")
        lines.append(f"  Min Duration: {stats['min']:.3f}s")
        lines.append(f"  Max Duration: {stats['max']:.3f}s")

        # Show recent timings
        timings = tracker.get_timings(operation)[operation]
        if timings:
            lines.append("  Recent Timings:")
            for timing in timings[-5:]:  # Last 5 timings
                lines.append(f"    {timing.duration_seconds:.3f}s")

    return "\n".join(lines)
