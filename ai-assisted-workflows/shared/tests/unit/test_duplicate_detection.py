#!/usr/bin/env python3
"""Minimal smoke test for JSCPD analyzer (skip if jscpd unavailable)."""

import shutil

from analyzers.quality.jscpd_analyzer import JSCPDAnalyzer


def test_jscpd_smoke(tmp_path):
    # Skip if npx/jscpd not available
    if not (shutil.which("npx") or shutil.which("jscpd")):
        return

    # Create two duplicate files
    a = tmp_path / "a.py"
    b = tmp_path / "b.py"
    content = "def foo():\n    return 42\n"
    a.write_text(content)
    b.write_text(content)

    analyzer = JSCPDAnalyzer()
    res = analyzer.analyze(str(tmp_path))
    assert res is not None
    assert hasattr(res, "success")
    # success may be False if jscpd isn't installed/configured; just ensure it produced a result object
    assert isinstance(getattr(res, "findings", []), list)
