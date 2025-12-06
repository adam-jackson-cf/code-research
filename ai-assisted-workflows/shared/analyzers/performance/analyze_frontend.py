#!/usr/bin/env python3
"""
Frontend Performance Analyzer - Web Performance and Optimization Analysis.

PURPOSE: Analyzes frontend code for performance issues, bundle size, and optimization opportunities.
Part of the shared/analyzers/performance suite using BaseAnalyzer infrastructure.

APPROACH:
- Bundle size and import analysis
- React performance patterns detection
- CSS performance optimization
- JavaScript efficiency patterns
- Image and asset optimization
- Memory leak detection
- DOM query optimization

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements performance-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns
"""

import contextlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


@register_analyzer("performance:frontend")
class FrontendPerformanceAnalyzer(BaseAnalyzer):
    """Analyzes frontend performance issues and optimization opportunities."""

    def __init__(self, config: AnalyzerConfig | None = None):
        # Create frontend-specific configuration
        frontend_config = config or AnalyzerConfig(
            code_extensions={
                ".js",
                ".jsx",
                ".ts",
                ".tsx",
                ".vue",
                ".svelte",
                ".css",
                ".scss",
                ".sass",
                ".less",
                ".styl",
                ".html",
                ".htm",
                ".xml",
                ".json",
                ".yaml",
                ".yml",
                ".md",
                ".mdx",
                ".astro",
                ".solid",
                ".qwik",
            },
            skip_patterns={
                "node_modules",
                ".git",
                "__pycache__",
                ".next",
                "dist",
                "build",
                "public",
                ".nuxt",
                ".output",
                ".vercel",
                ".netlify",
                "coverage",
                ".nyc_output",
                "storybook-static",
                "*.min.js",
                "*.min.css",
                "*.bundle.js",
                "*.chunk.js",
                "*.d.ts",
                "vendor",
            },
        )

        # Initialize base analyzer
        super().__init__("performance", frontend_config)

        # Check for ESLint availability - required for accurate analysis
        self._check_eslint_availability()

        # Initialize performance patterns
        self._init_bundle_patterns()
        self._init_react_patterns()
        self._init_css_patterns()
        self._init_js_patterns()
        self._init_asset_patterns()

        # Compile patterns for performance
        self._compiled_patterns = {}
        self._compile_all_patterns()

        # Cache for batch ESLint results
        self._eslint_results_cache = {}
        self._eslint_config_path = None

    def _check_eslint_availability(self):
        """Check if ESLint is available. Exit if not found."""
        try:
            # Check if ESLint is available via npx
            result = subprocess.run(
                ["npx", "eslint", "--version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode != 0:
                print(
                    "ERROR: ESLint is required for accurate frontend analysis but not found.",
                    file=sys.stderr,
                )
                print(
                    "Install with: npm install -g eslint @typescript-eslint/parser eslint-plugin-react eslint-plugin-vue",
                    file=sys.stderr,
                )
                sys.exit(1)

            # Check for required plugins
            required_plugins = [
                "@typescript-eslint/parser",
                "eslint-plugin-react",
                "eslint-plugin-import",
                "eslint-plugin-vue",
            ]

            for plugin in required_plugins:
                try:
                    # Try to verify plugin is available
                    plugin_check = subprocess.run(
                        ["npm", "list", "-g", plugin],
                        capture_output=True,
                        text=True,
                        timeout=5,
                    )
                    if plugin_check.returncode != 0:
                        print(
                            f"WARNING: ESLint plugin {plugin} not found globally. Analysis may be limited.",
                            file=sys.stderr,
                        )
                except (subprocess.TimeoutExpired, FileNotFoundError):
                    pass  # npm might not be available, continue anyway

        except (subprocess.TimeoutExpired, FileNotFoundError):
            print("ERROR: ESLint is required but not available.", file=sys.stderr)
            print("Ensure Node.js and npm are installed, then run:", file=sys.stderr)
            print(
                "  npm install -g eslint @typescript-eslint/parser eslint-plugin-react eslint-plugin-vue eslint-plugin-import",
                file=sys.stderr,
            )
            sys.exit(1)

    def _init_bundle_patterns(self):
        """Initialize bundle size and import patterns."""
        self.bundle_patterns = {
            "large_imports": {
                "indicators": [
                    r'import\s+\*\s+from\s+[\'"][^\'"]*[\'"]',
                    r'import.*from\s+[\'"]lodash[\'"]',
                    r'import.*from\s+[\'"]moment[\'"]',
                    r'import.*from\s+[\'"]rxjs[\'"]',
                    r'import.*from\s+[\'"]@material-ui/core[\'"]',
                    r'import.*from\s+[\'"]antd[\'"]',
                    r'const.*=.*require\([\'"].*entire.*[\'"]',
                ],
                "severity": "low",
                "description": "Large library imports affecting bundle size",
                "recommendation": "Use tree-shaking, import specific modules, or consider lighter alternatives.",
            },
            "dynamic_imports_missing": {
                "indicators": [
                    r'import.*[\'"].*(Page|Route|Modal|Dialog).*[\'"]',
                    r'import.*[\'"].*/(pages?|routes?).*[\'"]',
                    r'import.*[\'"].*(Chart|Dashboard|Editor).*[\'"]',
                    r'(?:const|var|let).*=.*import\([\'"].*\)',
                ],
                "severity": "low",
                "description": "Missing dynamic imports for code splitting",
                "recommendation": "Use dynamic imports for large components and routes to enable code splitting.",
            },
            # unused_dependencies pattern removed - now handled by ESLint
        }

    def _init_react_patterns(self):
        """Initialize React performance patterns."""
        self.react_patterns = {
            "missing_memo": {
                "indicators": [
                    r"(?:function|const)\s+\w+.*=.*\{.*\.map\((?!.*React\.memo|.*memo\()",
                    r"export.*function.*\{.*\.map\((?!.*React\.memo)",
                    r"const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{.*\.map\(",
                    r"React\.Component.*render.*\.map\(",
                ],
                "severity": "low",
                "description": "Component with expensive operations missing memoization",
                "recommendation": "Wrap components in React.memo() or use useMemo() for expensive calculations.",
            },
            "inline_object_creation": {
                "indicators": [
                    r"style=\{\{[^}]*\}\}",
                    r"onClick=\{[^}]*=>\s*\{",
                    r"onChange=\{[^}]*=>\s*\{",
                    r"onSubmit=\{[^}]*=>\s*\{",
                    r"<\w+[^>]*\{\{[^}]*\}\}",
                ],
                "severity": "low",
                "description": "Inline object/function creation causing re-renders",
                "recommendation": "Extract inline objects and functions to avoid unnecessary re-renders.",
            },
            "missing_key_prop": {
                "indicators": [
                    r"\.map\([^)]*=>\s*<[^>]*(?!.*key=)[^>]*>",
                    r"\.map\([^)]*function[^)]*\)[^{]*\{[^}]*<[^>]*(?!.*key=)",
                    r"for.*in.*<[^>]*(?!.*key=)",
                ],
                "severity": "low",
                "description": "Missing key prop in list rendering",
                "recommendation": "Always provide unique key prop when rendering lists.",
            },
            "unnecessary_rerenders": {
                "indicators": [
                    r"useState\([^)]*\{\}[^)]*\)",
                    r"useState\([^)]*\[\][^)]*\)",
                    r"useEffect\([^,]*,[^)]*\[\][^)]*\)",
                    r"new\s+(?:Date|Array|Object)\s*\([^)]*\).*render",
                ],
                "severity": "low",
                "description": "Patterns causing unnecessary re-renders",
                "recommendation": "Use useCallback, useMemo, or stable object references.",
            },
            "inefficient_state_updates": {
                "indicators": [
                    r"setState\([^)]*\{\.\.\..*,.*\}",
                    r"useState.*\[[^,]*,\s*set\w+\].*set\w+\([^)]*\.\.\..*\)",
                    r"dispatch\([^)]*\.\.\.state",
                ],
                "severity": "low",
                "description": "Inefficient state update patterns",
                "recommendation": "Use functional state updates and avoid spreading large state objects.",
            },
        }

    def _init_css_patterns(self):
        """Initialize CSS performance patterns."""
        self.css_patterns = {
            "expensive_selectors": {
                "indicators": [
                    r"\*\s*\{",  # Universal selector
                    r"\[.*\*=.*\]",  # Attribute contains selector
                    r":nth-child\(",
                    r":not\([^)]*:not\(",  # Nested :not selectors
                    r"[a-zA-Z-]+\s+[a-zA-Z-]+\s+[a-zA-Z-]+\s+[a-zA-Z-]+",  # Deep descendant
                ],
                "severity": "low",
                "description": "Expensive CSS selectors affecting render performance",
                "recommendation": "Use class selectors instead of complex descendant selectors.",
            },
            "unused_css": {
                "indicators": [
                    r'@import\s+[\'"][^\'"]*.css[\'"];?',
                    r"\.(?:unused|deprecated|old)-[a-zA-Z-]+\s*\{",
                    r"#(?:unused|deprecated|old)-[a-zA-Z-]+\s*\{",
                ],
                "severity": "low",
                "description": "Potentially unused CSS rules",
                "recommendation": "Remove unused CSS rules to reduce stylesheet size.",
            },
            "inefficient_animations": {
                "indicators": [
                    r"animation.*(?:left|top|right|bottom|width|height)",
                    r"transition.*(?:left|top|right|bottom|width|height)",
                    r"@keyframes.*\{.*(?:left|top|right|bottom|width|height)",
                ],
                "severity": "low",
                "description": "Animations causing layout thrashing",
                "recommendation": "Use transform and opacity for animations to avoid layout recalculation.",
            },
            "blocking_css": {
                "indicators": [
                    r'<link[^>]*rel=[\'"]stylesheet[\'"][^>]*>',
                    r"@import\s+url\(",
                    r"<style[^>]*>[\s\S]*</style>",
                ],
                "severity": "low",
                "description": "Render-blocking CSS",
                "recommendation": "Inline critical CSS and load non-critical CSS asynchronously.",
            },
        }

    def _init_js_patterns(self):
        """Initialize JavaScript performance patterns."""
        self.js_patterns = {
            "inefficient_dom_queries": {
                "indicators": [
                    r"document\.querySelector.*(?:for|while)\s*\(",
                    r"document\.getElementById.*(?:for|while)\s*\(",
                    r"getElementsBy.*(?:for|while)\s*\(",
                    r"querySelectorAll.*map\(",
                ],
                "severity": "low",
                "description": "Inefficient DOM queries in loops",
                "recommendation": "Cache DOM query results outside loops.",
            },
            "blocking_operations": {
                "indicators": [
                    r"for\s*\([^)]*\)\s*\{[^}]*(?:fetch|await)",
                    r"while\s*\([^)]*\)\s*\{[^}]*(?:fetch|await)",
                    r"forEach\([^)]*(?:fetch|await)",
                    r"\.map\([^)]*(?:fetch|await)",
                ],
                "severity": "high",
                "description": "Blocking operations on main thread",
                "recommendation": "Use Promise.all() for parallel operations or web workers for heavy computation.",
            },
            "memory_leaks": {
                "indicators": [
                    r"setInterval\([^)]*\)(?![^;]*clearInterval)",
                    r"setTimeout\([^)]*\)(?![^;]*clearTimeout)",
                    r"addEventListener\([^)]*\)(?![^;]*removeEventListener)",
                    r"new\s+(?:MutationObserver|IntersectionObserver|ResizeObserver)(?![^;]*disconnect)",
                ],
                "severity": "high",
                "description": "Potential memory leaks from uncleaned resources",
                "recommendation": "Always clean up timers, event listeners, and observers.",
            },
            "inefficient_loops": {
                "indicators": [
                    r"for\s*\([^)]*\.length[^)]*\)",
                    r"for.*in.*(?:document|window)",
                    r"while\s*\([^)]*\.length",
                    r"do\s*\{[^}]*\}\s*while\s*\([^)]*\.length",
                ],
                "severity": "low",
                "description": "Inefficient loop patterns",
                "recommendation": "Cache array length and avoid DOM operations in loop conditions.",
            },
            "large_data_processing": {
                "indicators": [
                    r"JSON\.(?:parse|stringify)\([^)]*(?:large|big|huge)",
                    r"\.(?:sort|filter|map|reduce)\([^)]*\)\.(?:sort|filter|map|reduce)",
                    r"new Array\([0-9]{4,}\)",
                ],
                "severity": "low",
                "description": "Large data processing on main thread",
                "recommendation": "Use web workers for heavy data processing or implement virtual scrolling.",
            },
        }

    def _init_asset_patterns(self):
        """Initialize asset optimization patterns."""
        self.asset_patterns = {
            "unoptimized_images": {
                "indicators": [
                    r'<img[^>]*src=[\'"][^\'"]*\.(?:jpg|jpeg|png|gif)[\'"]',
                    r"background-image:[^;]*url\([^)]*\.(?:jpg|jpeg|png|gif)",
                    r"import[^;]*\.(?:jpg|jpeg|png|gif)",
                    r"require\([^)]*\.(?:jpg|jpeg|png|gif)",
                ],
                "severity": "low",
                "description": "Unoptimized image formats",
                "recommendation": "Use modern formats like WebP or AVIF for better compression.",
            },
            "missing_lazy_loading": {
                "indicators": [
                    r"<img[^>]*src=[^>]*(?!.*loading=)",
                    r"<iframe[^>]*src=[^>]*(?!.*loading=)",
                    r"<video[^>]*src=[^>]*(?!.*loading=)",
                ],
                "severity": "low",
                "description": "Missing lazy loading for media",
                "recommendation": "Add loading='lazy' attribute to images and iframes below the fold.",
            },
            "large_bundle_assets": {
                "indicators": [
                    r"import[^;]*\.(?:mp4|webm|mov|avi)",
                    r"require\([^)]*\.(?:mp4|webm|mov|avi)",
                    r'src=[\'"][^\'"]*\.(?:mp4|webm|mov|avi)[\'"]',
                ],
                "severity": "low",
                "description": "Large media assets bundled with application",
                "recommendation": "Host large media files externally or use streaming services.",
            },
            "missing_preload": {
                "indicators": [
                    r'<link[^>]*href=[\'"][^\'"]*\.(?:woff2|woff|ttf)[\'"][^>]*>',
                    r"@font-face[^}]*url\([^)]*\.(?:woff2|woff|ttf)",
                    r'<img[^>]*src=[\'"][^\'"]*hero[^\'"]*[\'"]',
                ],
                "severity": "low",
                "description": "Missing preload for critical resources",
                "recommendation": "Preload critical fonts, hero images, and other important assets.",
            },
        }

    def _compile_all_patterns(self):
        """Compile all regex patterns for performance."""
        pattern_groups = [
            self.bundle_patterns,
            self.react_patterns,
            self.css_patterns,
            self.js_patterns,
            self.asset_patterns,
        ]

        for patterns in pattern_groups:
            for perf_type, config in patterns.items():
                self._compiled_patterns[perf_type] = [
                    re.compile(pattern, re.MULTILINE | re.IGNORECASE)
                    for pattern in config["indicators"]
                ]

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Frontend Performance Analyzer",
            "version": "2.0.0",
            "description": "Analyzes frontend performance and optimization opportunities",
            "category": "performance",
            "priority": "high",
            "capabilities": [
                "Bundle size analysis",
                "React performance patterns",
                "CSS optimization detection",
                "JavaScript efficiency analysis",
                "Asset optimization checks",
                "Memory leak detection",
                "DOM query optimization",
                "Animation performance analysis",
            ],
            "supported_formats": list(self.config.code_extensions),
            "patterns_checked": len(self._compiled_patterns),
        }

    def _scan_file_for_issues(self, file_path: Path) -> list[dict[str, Any]]:
        """Scan a single file for frontend performance issues."""
        findings = []

        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
                lines = content.split("\n")

                # Get file extension for type-specific pattern filtering
                file_ext = file_path.suffix.lower()

                # Filter pattern groups based on file type for better performance
                pattern_groups = []

                # CSS patterns only for CSS files
                if file_ext in {".css", ".scss", ".sass", ".less", ".styl"}:
                    pattern_groups.append(("css", self.css_patterns))
                    pattern_groups.append(("asset", self.asset_patterns))

                # React patterns only for JS/TS files
                elif file_ext in {".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte"}:
                    pattern_groups.append(("bundle", self.bundle_patterns))
                    pattern_groups.append(("react", self.react_patterns))
                    pattern_groups.append(("javascript", self.js_patterns))
                    pattern_groups.append(("asset", self.asset_patterns))

                # HTML files - asset and bundle patterns only
                elif file_ext in {".html", ".htm"}:
                    pattern_groups.append(("asset", self.asset_patterns))

                # Other files get minimal pattern checking
                else:
                    pattern_groups.append(("asset", self.asset_patterns))

                for category, patterns in pattern_groups:
                    for perf_type, config in patterns.items():
                        compiled_patterns = self._compiled_patterns.get(perf_type, [])

                        for pattern in compiled_patterns:
                            for match in pattern.finditer(content):
                                # Calculate line number
                                line_number = content[: match.start()].count("\n") + 1

                                # Get the matched line
                                line_content = (
                                    lines[line_number - 1].strip()
                                    if line_number <= len(lines)
                                    else ""
                                )

                                # Skip false positives
                                if self._is_false_positive(
                                    line_content, perf_type, category
                                ):
                                    continue

                                findings.append(
                                    {
                                        "perf_type": perf_type,
                                        "category": category,
                                        "file_path": str(file_path),
                                        "line_number": line_number,
                                        "line_content": line_content[
                                            :150
                                        ],  # Truncate long lines
                                        "severity": config["severity"],
                                        "description": config["description"],
                                        "recommendation": config["recommendation"],
                                        "pattern_matched": pattern.pattern[:80],
                                    }
                                )

        except Exception as e:
            # Log but continue - file might be binary or inaccessible
            if hasattr(self, "verbose") and self.verbose:
                print(f"Warning: Could not scan {file_path}: {e}", file=sys.stderr)

        # Use ESLint for JavaScript/TypeScript files
        if str(file_path).endswith((".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte")):
            eslint_findings = self._run_eslint_analysis(str(file_path))
            findings.extend(eslint_findings)

        return findings

    def _process_batch(self, batch: list[Path]) -> list[dict[str, Any]]:
        """
        Override BaseAnalyzer batch processing to run ESLint once per batch.

        This dramatically improves performance vs per-file ESLint calls.
        """
        # First run ESLint on all JS/TS files in the batch at once
        js_files = [
            f
            for f in batch
            if str(f).endswith((".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte"))
        ]

        if js_files:
            print(
                f"Running batch ESLint analysis on {len(js_files)} files...",
                file=sys.stderr,
            )
            self._run_batch_eslint_analysis(js_files)

        # Now process individual files with cached ESLint results
        batch_findings = []
        for i, file_path in enumerate(batch):
            try:
                if i > 0 and i % 10 == 0:
                    print(
                        f"Processed {i}/{len(batch)} files in batch...", file=sys.stderr
                    )

                file_findings = self.analyze_target(str(file_path))
                batch_findings.extend(file_findings)
                self.files_processed += 1
            except Exception as e:
                self.processing_errors += 1
                self.logger.warning(f"Error processing {file_path}: {e}")

        if len(batch) > 1:
            print(
                f"Completed batch: {len(batch)} files, {len(batch_findings)} findings",
                file=sys.stderr,
            )

        return batch_findings

    def _run_batch_eslint_analysis(self, js_files: list[Path]) -> None:
        """Run ESLint on a batch of JS/TS files and cache results."""
        if not js_files:
            return

        # Create temporary ESLint config once
        if self._eslint_config_path is None:
            self._create_eslint_config()

        try:
            # Run ESLint on all files at once
            cmd = [
                "npx",
                "eslint",
                "--config",
                self._eslint_config_path,
                "--format",
                "json",
                "--no-ignore",
            ]
            cmd.extend(str(f) for f in js_files)

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

            # Parse and cache results
            if result.stdout:
                eslint_results = json.loads(result.stdout)
                for file_result in eslint_results:
                    file_path = file_result.get("filePath", "")
                    if file_path:
                        self._eslint_results_cache[file_path] = file_result.get(
                            "messages", []
                        )

        except (
            subprocess.TimeoutExpired,
            subprocess.CalledProcessError,
            json.JSONDecodeError,
        ) as e:
            print(f"Batch ESLint analysis failed: {e}", file=sys.stderr)

    def _create_eslint_config(self) -> None:
        """Create temporary ESLint config file."""
        eslint_config = {
            "env": {"browser": True, "node": True, "es2022": True},
            "extends": ["eslint:recommended"],
            "plugins": ["import", "react", "react-hooks"],
            "parser": "@typescript-eslint/parser",
            "parserOptions": {
                "ecmaVersion": 2022,
                "sourceType": "module",
                "ecmaFeatures": {"jsx": True},
            },
            "rules": {
                "no-unused-vars": "error",
                "import/no-unused-modules": "error",
                "react/jsx-no-bind": "warn",
                "react/jsx-key": "error",
                "react-hooks/exhaustive-deps": "warn",
            },
            "overrides": [
                {"files": ["*.vue"], "processor": "vue/.vue"},
                {"files": ["*.svelte"], "processor": "svelte3/svelte3"},
            ],
        }

        try:
            import tempfile

            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False
            ) as config_file:
                json.dump(eslint_config, config_file, indent=2)
                self._eslint_config_path = config_file.name
        except Exception as e:
            print(f"Failed to create ESLint config: {e}", file=sys.stderr)

    def _run_eslint_analysis(self, file_path: str) -> list[dict[str, Any]]:
        """Get ESLint analysis results from cache (populated by batch processing)."""
        findings = []

        # Get cached results for this file
        cached_messages = self._eslint_results_cache.get(
            str(Path(file_path).resolve()), []
        )

        for message in cached_messages:
            # Convert ESLint findings to our format
            severity_map = {
                2: "high",  # error
                1: "medium",  # warning
                0: "info",  # info
            }

            finding = {
                "perf_type": self._map_eslint_rule_to_type(
                    message.get("ruleId", "unknown")
                ),
                "category": "bundle"
                if "import" in message.get("ruleId", "")
                else "react",
                "file_path": file_path,
                "line_number": message.get("line", 0),
                "line_content": message.get("source", "")[:150],
                "severity": severity_map.get(message.get("severity", 1), "medium"),
                "description": message.get("message", "ESLint issue detected"),
                "recommendation": self._get_eslint_recommendation(
                    message.get("ruleId", "unknown")
                ),
                "pattern_matched": f"ESLint: {message.get('ruleId', 'unknown')}",
            }
            findings.append(finding)

        return findings

    def _map_eslint_rule_to_type(self, rule_id: str) -> str:
        """Map ESLint rule IDs to our performance types."""
        rule_mapping = {
            "no-unused-vars": "unused_dependencies",
            "import/no-unused-modules": "unused_dependencies",
            "react/jsx-no-bind": "inline_object_creation",
            "react/jsx-key": "missing_key_prop",
            "react-hooks/exhaustive-deps": "unnecessary_rerenders",
        }
        return rule_mapping.get(rule_id, "performance_issue")

    def _get_eslint_recommendation(self, rule_id: str) -> str:
        """Get recommendation for ESLint rule violations."""
        recommendations = {
            "no-unused-vars": "Remove unused variables and imports to reduce bundle size.",
            "import/no-unused-modules": "Remove unused imports to reduce bundle size.",
            "react/jsx-no-bind": "Extract inline functions to prevent unnecessary re-renders.",
            "react/jsx-key": "Add unique key prop to list items.",
            "react-hooks/exhaustive-deps": "Fix hook dependencies to prevent stale closures.",
        }
        return recommendations.get(
            rule_id, "Fix this performance issue detected by ESLint."
        )

    def _is_false_positive(
        self, line_content: str, perf_type: str, category: str
    ) -> bool:
        """Check if a detected issue is likely a false positive."""
        line_lower = line_content.lower()
        line_stripped = line_content.strip()

        # Skip comments and documentation
        comment_indicators = [
            "//",
            "#",
            "/*",
            "*",
            "<!--",
            "'''",
            '"""',
            "* @",
            "/**",
            "*/",
        ]
        for indicator in comment_indicators:
            if line_stripped.startswith(indicator):
                return True

        # Skip test files, specs, mocks, and config files
        test_indicators = [
            "test",
            "spec",
            "mock",
            "fixture",
            "storybook",
            "config",
            "example",
            ".d.ts",
            "jest",
            "vitest",
            "mocha",
            "cypress",
            "playwright",
            "setup",
            "teardown",
            "beforeeach",
            "aftereach",
        ]
        if any(indicator in line_lower for indicator in test_indicators):
            return True

        # Skip documentation and metadata
        doc_indicators = [
            "@example",
            "@param",
            "@returns",
            "@type",
            "@description",
            "docstring",
            "readme",
            "documentation",
            "license",
            "copyright",
        ]
        if any(indicator in line_lower for indicator in doc_indicators):
            return True

        # Skip package files and build artifacts
        package_indicators = [
            "package.json",
            "package-lock.json",
            "yarn.lock",
            "node_modules",
            ".min.",
            "bundle.",
            "chunk.",
            "vendor.",
            "polyfill.",
            "shim.",
        ]
        if any(indicator in line_lower for indicator in package_indicators):
            return True

        # Skip very short lines or lines with minimal content
        if len(line_stripped) < 10 or line_stripped in [
            "",
            "{",
            "}",
            "(",
            ")",
            "[",
            "]",
        ]:
            return True

        # Skip lines that are mostly punctuation (generated code)
        if len([c for c in line_stripped if c.isalnum()]) < len(line_stripped) * 0.3:
            return True

        # Category-specific false positive checks with more context
        if category == "react":
            react_optimized = [
                "memo(",
                "usememo(",
                "usecallback(",
                "react.memo",
                "usememo",
                "usecallback",
                "useoptimistic",
                "usetransition",
            ]
            if any(opt in line_lower for opt in react_optimized):
                return True

            # Skip React library internals
            if any(
                internal in line_lower
                for internal in ["react-dom", "__react", "_react"]
            ):
                return True

        if category == "bundle":
            bundle_optimized = [
                "dynamic",
                "lazy",
                "import(",
                "loadable",
                "loadasync",
                "code-splitting",
                "webpack:",
                "rollup:",
            ]
            if any(opt in line_lower for opt in bundle_optimized):
                return True

        if category == "css":
            css_optimized = [
                "transform",
                "opacity",
                "will-change",
                "contain:",
                "gpu",
                "hardware",
                "accelerated",
            ]
            if any(opt in line_lower for opt in css_optimized):
                return True

        # Skip JavaScript engine/browser internals
        browser_internals = [
            "__proto__",
            "__defineGetter__",
            "__defineSetter__",
            "Object.defineProperty",
            "Object.create",
            "JSON.stringify",
        ]
        if any(internal in line_content for internal in browser_internals):
            return True

        # Skip common library method chains that are not performance issues
        safe_patterns = ["console.", "Math.", "Date.", "Array.", "Object.", "String."]
        if any(pattern in line_content for pattern in safe_patterns) and not any(
            loop in line_lower
            for loop in ["for ", "while ", "foreach", ".map(", ".filter("]
        ):
            return True

        # Skip TypeScript/JavaScript type definitions and interfaces
        return bool(
            any(
                ts_pattern in line_lower
                for ts_pattern in ["interface ", "type ", "declare "]
            )
        )

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze a single file for frontend performance issues.

        Args:
            target_path: Path to file to analyze

        Returns
        -------
            List of findings with standardized structure
        """
        all_findings = []
        file_path = Path(target_path)

        # File size check is already handled by BaseAnalyzer.should_scan_file()
        findings = self._scan_file_for_issues(file_path)

        # Convert to standardized finding format
        for finding in findings:
            # Create detailed title
            title = f"{finding['description']} ({finding['perf_type'].replace('_', ' ').title()})"

            # Create comprehensive description
            description = (
                f"{finding['description']} detected in {file_path.name} at line {finding['line_number']}. "
                f"Category: {finding['category'].replace('_', ' ').title()}. "
                f"This could impact frontend performance, user experience, or bundle size."
            )

            standardized = {
                "title": title,
                "description": description,
                "severity": finding["severity"],
                "file_path": finding["file_path"],
                "line_number": finding["line_number"],
                "recommendation": finding["recommendation"],
                "metadata": {
                    "perf_type": finding["perf_type"],
                    "category": finding["category"],
                    "line_content": finding["line_content"],
                    "pattern_matched": finding["pattern_matched"],
                    "confidence": "medium",
                },
            }
            all_findings.append(standardized)

        return all_findings

    def __del__(self):
        """Clean up temporary ESLint config file."""
        if self._eslint_config_path:
            with contextlib.suppress(Exception):
                Path(self._eslint_config_path).unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(0)
