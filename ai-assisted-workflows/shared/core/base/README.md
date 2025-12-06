# BaseAnalyzer/BaseProfiler Interface Documentation

## 🎯 **Purpose**

This document defines the interface contracts, field requirements, and implementation patterns for all analyzers extending BaseAnalyzer or BaseProfiler infrastructure.

## 📋 **Required Field Format**

### **Standard Finding Structure**

All findings returned by `analyze_target()` or `profile_target()` must include these **exact** fields:

```python
{
    "title": str,           # Human-readable finding title (NOT "type")
    "description": str,     # Detailed description (NOT "message")
    "severity": str,        # One of: "critical", "high", "medium", "low", "info"
    "file_path": str,       # Path to affected file (NOT "file")
    "line_number": int,     # Line number in file (NOT "line")
    "recommendation": str,  # Suggested fix or action (REQUIRED)
    "metadata": dict        # Additional context (optional, can use .get())
}
```

### **Field Validation Rules**

- ✅ **Required Fields**: All 6 fields above are mandatory (no `.get()` fallbacks)
- ✅ **Exact Names**: Field names must match exactly (case-sensitive)
- ✅ **No Placeholders**: Never use generic values like "Analysis issue detected"
- ✅ **Real Data**: All values must reflect actual analysis results

### **Common Field Mapping Errors**

```python
# WRONG → RIGHT
"type" → "title"
"message" → "description"
"file" → "file_path"
"line" → "line_number"

# Missing field (WRONG) → Required field (RIGHT)
# No recommendation → "recommendation": "Specific action to take"
```

## 📝 **Abstract Method Contracts**

### **BaseAnalyzer Implementation**

```python
class MyAnalyzer(BaseAnalyzer):
    def analyze_target(self, target_path: str) -> List[Dict[str, Any]]:
        """
        Analyze a single file and return findings.

        Args:
            target_path: Path to single file (BaseAnalyzer handles directory iteration)

        Returns:
            List of finding dictionaries with required fields
        """
        # Implementation must return properly formatted findings
        pass

    def get_analyzer_metadata(self) -> Dict[str, Any]:
        """
        Return analyzer-specific metadata for introspection.

        Returns:
            Dictionary with analyzer capabilities, supported languages, etc.
        """
        pass
```

### **BaseProfiler Implementation**

```python
class MyProfiler(BaseProfiler):
    def profile_target(self, target_path: str) -> List[Dict[str, Any]]:
        """
        Profile a single file and return performance findings.

        Args:
            target_path: Path to single file (BaseProfiler handles directory iteration)

        Returns:
            List of finding dictionaries with required fields
        """
        # Implementation must return properly formatted findings
        pass

    def get_profiler_metadata(self) -> Dict[str, Any]:
        """
        Return profiler-specific metadata for introspection.

        Returns:
            Dictionary with profiler capabilities, supported tools, etc.
        """
        pass
```

## 🔧 **Helper Functions**

### **Standard Finding Creator**

```python
def create_standard_finding(
    title: str,
    description: str,
    severity: str,
    file_path: str,
    line_number: int,
    recommendation: str,
    metadata: dict = None
) -> Dict[str, Any]:
    """
    Helper to create properly formatted findings for BaseAnalyzer/BaseProfiler.

    Args:
        title: Human-readable finding title
        description: Detailed description of the issue
        severity: One of "critical", "high", "medium", "low", "info"
        file_path: Path to the affected file
        line_number: Line number where issue occurs
        recommendation: Suggested action to take
        metadata: Additional context (optional)

    Returns:
        Properly formatted finding dictionary
    """
    return {
        "title": title,
        "description": description,
        "severity": severity,
        "file_path": file_path,
        "line_number": line_number,
        "recommendation": recommendation,
        "metadata": metadata or {}
    }
```

### **Finding Validator**

```python
def validate_finding(finding: Dict[str, Any]) -> bool:
    """
    Validate finding has all required fields before returning.

    Args:
        finding: Finding dictionary to validate

    Returns:
        True if valid, raises ValueError if invalid
    """
    required_fields = ["title", "description", "severity", "file_path", "line_number", "recommendation"]

    for field in required_fields:
        if field not in finding:
            raise ValueError(f"Missing required field: '{field}'. Available fields: {list(finding.keys())}")

    # Validate severity levels
    valid_severities = {"critical", "high", "medium", "low", "info"}
    if finding["severity"] not in valid_severities:
        raise ValueError(f"Invalid severity '{finding['severity']}'. Must be one of: {valid_severities}")

    return True
```

## 🏗️ **Implementation Patterns**

### **Basic Analyzer Template**

```python
#!/usr/bin/env python3
"""
My Custom Analyzer
==================

PURPOSE: Describe what this analyzer detects

APPROACH: Explain the analysis approach

EXTENDS: BaseAnalyzer for common analyzer infrastructure
"""

import sys
from pathlib import Path
from typing import Dict, List, Any

# Import base analyzer infrastructure
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from shared.core.base.analyzer_base import BaseAnalyzer, AnalyzerConfig

class MyCustomAnalyzer(BaseAnalyzer):
    """Custom analyzer extending BaseAnalyzer infrastructure."""

    def __init__(self, config: Optional[AnalyzerConfig] = None):
        # Create analyzer-specific configuration
        custom_config = config or AnalyzerConfig(
            code_extensions={".py", ".js", ".ts"},  # Supported file types
            skip_patterns={"node_modules", "__pycache__"}  # Directories to skip
        )

        # Initialize base analyzer
        super().__init__("my_analyzer_type", custom_config)

    def analyze_target(self, target_path: str) -> List[Dict[str, Any]]:
        """
        Implement custom analysis logic for target file.

        Args:
            target_path: Path to analyze (single file)

        Returns:
            List of properly formatted findings
        """
        findings = []

        try:
            with open(target_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            # Implement your analysis logic here
            if "some_pattern" in content:
                findings.append({
                    "title": "Specific Issue Found",
                    "description": "Detailed description of what was found",
                    "severity": "medium",
                    "file_path": target_path,
                    "line_number": 1,  # Calculate actual line number
                    "recommendation": "Specific action to fix this issue",
                    "metadata": {"pattern_matched": "some_pattern"}
                })

        except Exception as e:
            findings.append({
                "title": "Analysis Error",
                "description": f"Failed to analyze file: {str(e)}",
                "severity": "low",
                "file_path": target_path,
                "line_number": 1,
                "recommendation": "Check file permissions and encoding",
                "metadata": {"error_type": type(e).__name__}
            })

        return findings

    def get_analyzer_metadata(self) -> Dict[str, Any]:
        """Get analyzer-specific metadata."""
        return {
            "analysis_type": "my_custom_analysis",
            "supported_languages": ["Python", "JavaScript", "TypeScript"],
            "capabilities": {
                "pattern_detection": "Description of what patterns are detected",
                "language_support": "Description of language-specific features"
            },
            "dependencies": ["List", "of", "required", "tools"],
            "use_cases": [
                "Primary use case description",
                "Secondary use case description"
            ]
        }

# Legacy function for backward compatibility
def analyze_my_custom_logic(target_path: str, **kwargs) -> Dict[str, Any]:
    """Legacy function wrapper for backward compatibility."""
    try:
        analyzer = MyCustomAnalyzer()
        results = analyzer.analyze()

        return {
            "success": True,
            "findings": results.findings if hasattr(results, "findings") else [],
            "metadata": results.metadata if hasattr(results, "metadata") else {}
        }
    except Exception as e:
        return {"success": False, "error": str(e), "findings": []}

# Agent-Orchestrated Usage (No CLI)
# Typical usage is via an orchestrator/agent that imports your analyzer and calls `analyze()`.
# Minimal dev harness example:
#
# from core.base.analyzer_base import create_analyzer_config
# cfg = create_analyzer_config(target_path="../some_repo", max_files=100)
# analyzer = MyCustomAnalyzer(config=cfg)
# result = analyzer.analyze()
# print(result.to_json())
```

## ⚠️ **Common Implementation Pitfalls**

### **1. Field Naming Issues**

```python
# WRONG - Using inconsistent field names
return {
    "type": "issue_type",        # Should be "title"
    "message": "description",    # Should be "description"
    "file": "path/to/file",      # Should be "file_path"
    "line": 42                   # Should be "line_number"
}

# RIGHT - Using required field names
return {
    "title": "issue_type",
    "description": "description",
    "file_path": "path/to/file",
    "line_number": 42,
    "recommendation": "How to fix this",
    "severity": "medium",
    "metadata": {}
}
```

### **2. Missing Required Fields**

```python
# WRONG - Missing recommendation field
return {
    "title": "Issue Found",
    "description": "Something wrong",
    "severity": "high",
    "file_path": "file.py",
    "line_number": 10
    # Missing "recommendation" - will cause KeyError
}

# RIGHT - All required fields present
return {
    "title": "Issue Found",
    "description": "Something wrong",
    "severity": "high",
    "file_path": "file.py",
    "line_number": 10,
    "recommendation": "Specific fix to apply",  # Required!
    "metadata": {}
}
```

### **3. Generic Placeholder Values**

```python
# WRONG - Using generic placeholders
return {
    "title": "security finding",           # Generic placeholder
    "description": "Analysis issue detected",  # Generic placeholder
    "file_path": "unknown",                # Generic placeholder
    "line_number": 0,                      # Generic placeholder
    "recommendation": "Review issue"       # Generic placeholder
}

# RIGHT - Using real analysis results
return {
    "title": "SQL Injection Vulnerability",
    "description": "Unsanitized user input used in SQL query construction",
    "file_path": "models/user.py",
    "line_number": 42,
    "recommendation": "Use parameterized queries or ORM methods"
}
```

## 📊 **Validation Testing**

### **Test Your Implementation**

Use a quick REPL/script to construct the analyzer and call `analyze()`.

```python
# Quick dev check (Python REPL or script)
from core.base.analyzer_base import create_analyzer_config
from analyzers.category.your_analyzer import YourAnalyzer

cfg = create_analyzer_config(target_path="../test_codebase/monorepo", max_files=5)
analyzer = YourAnalyzer(config=cfg)
result = analyzer.analyze()
print(result.to_json())

# Look for these success indicators:
# ✅ No KeyError exceptions
# ✅ Real finding titles (not "security finding")
# ✅ Specific descriptions (not "Analysis issue detected")
# ✅ Actual file paths (not "unknown")
# ✅ Real line numbers (not 0)
# ✅ Actionable recommendations (not "Review issue")
```

### **Integration Testing**

```bash
# Test through integration runner (registry + in-process)
PYTHONPATH=shared NO_EXTERNAL=true python shared/tests/integration/test_all_analyzers.py test_codebase/juice-shop-monorepo --max-files 2
# Omit NO_EXTERNAL to include analyzers requiring external tools
```

## 🎯 **Success Criteria Checklist**

Before submitting your BaseAnalyzer/BaseProfiler implementation:

- [ ] **All required fields present** - title, description, severity, file_path, line_number, recommendation
- [ ] **No generic placeholders** - All findings reflect actual analysis results
- [ ] **Proper field names** - No "type", "message", "file", or "line" fields
- [ ] **Abstract methods implemented** - analyze_target() and get_analyzer_metadata()
- [ ] **Legacy compatibility** - Provides backward-compatible function wrapper
- [ ] **Error handling** - Graceful handling of file access/parsing errors
- [ ] **Validation testing** - Passes strict validation with real findings

## 📚 **Reference Examples**

### **Working Implementations**

- `shared/analyzers/security/semgrep_analyzer.py` - Comprehensive security analysis with semantic analysis
- `shared/analyzers/quality/complexity_lizard.py` - Code complexity analysis with Lizard integration
- `shared/analyzers/performance/profile_code.py` - Performance profiling with heuristics
- `shared/analyzers/quality/pattern_classifier.py` - Pattern classification with multiple detectors

### **Architecture Benefits**

- **Standardized Output**: Uniform finding format across all analysis types
- **Shared Infrastructure**: File scanning, error handling, timing, and logging
- **Configuration Management**: Centralized configuration with validation
- **Legacy Support**: Backward compatibility for existing integrations

## 🔄 **Migration Guide**

### **Converting Existing Analyzers**

1. **Extend BaseAnalyzer**: Change `class MyAnalyzer:` to `class MyAnalyzer(BaseAnalyzer):`
2. **Implement Abstract Methods**: Add `analyze_target()` and `get_analyzer_metadata()`
3. **Fix Field Names**: Change "type"→"title", "message"→"description", add "recommendation"
4. **Remove Boilerplate**: Delete manual sys.path, CLI parsing, utility imports
5. **Add Legacy Wrapper**: Maintain backward compatibility function
6. **Test Validation**: Verify with strict validation (no placeholder findings)

### **Development Workflow**

1. **Start with Template**: Use the basic analyzer template above
2. **Implement Logic**: Add your analysis logic to `analyze_target()`
3. **Test Early**: Test with strict validation during development
4. **Add Metadata**: Provide comprehensive metadata in `get_analyzer_metadata()`
5. **Legacy Support**: Add backward-compatible function wrapper
6. **Integration Test**: Verify CLI and programmatic interfaces work

---

**Created**: 2025-08-12
**BaseAnalyzer Version**: 2.0 (Strict Validation)
**Maintained By**: BaseAnalyzer Implementation Team
**Status**: Complete interface specification for 9/9 working analyzers
