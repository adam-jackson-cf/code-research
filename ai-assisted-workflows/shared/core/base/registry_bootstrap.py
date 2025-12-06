#!/usr/bin/env python3
"""Bootstrap module to register all analyzers via decorators.

Import this module once at startup to ensure registry population.
"""

# Security analyzers
# Architecture analyzers
from analyzers.architecture import (
    coupling_analysis as _ac,  # noqa: F401
    dependency_analysis as _ad,  # noqa: F401
    pattern_evaluation as _ap,  # noqa: F401
    scalability_check as _as,  # noqa: F401
)

# Performance analyzers
from analyzers.performance import (
    analyze_frontend as _pf,  # noqa: F401
    performance_baseline as _pb,  # noqa: F401
    profile_code as _pc,  # noqa: F401
    ruff_analyzer as _pr,  # noqa: F401
    semgrep_analyzer as _pm,  # noqa: F401
    sqlglot_analyzer as _pg,  # noqa: F401
)

# Quality analyzers
from analyzers.quality import (
    complexity_lizard as _ql,  # noqa: F401
    coverage_analysis as _qc,  # noqa: F401
    jscpd_analyzer as _qj,  # noqa: F401
    pattern_classifier as _qp,  # noqa: F401
    result_aggregator as _qa,  # noqa: F401
)

# Root cause analyzers
from analyzers.root_cause import (
    error_patterns as _re,  # noqa: F401
    recent_changes as _rr,  # noqa: F401
    trace_execution as _rt,  # noqa: F401
)
from analyzers.security import (
    detect_secrets_analyzer as _ds,  # noqa: F401
    semgrep_analyzer as _sg,  # noqa: F401
)
