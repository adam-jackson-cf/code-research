# analyze-ai-security Brief

## Purpose

Define the requirements for a new shared prompt, `analyze-ai-security`, that follows the same broad operating model as Enaible's `analyze-security` prompt but is specialized for LLM, agentic, and GenAI security review.

This document is a design brief for a prompt-generation skill. It is not the prompt implementation.

## Summary

`analyze-ai-security` should assess AI-enabled codebases and integrations by combining deterministic scanning, AI-surface discovery, AI-specific threat modeling, contextual gap analysis, and remediation planning.

It should reuse the strong parts of the existing `analyze-security` pattern:

- deterministic reconnaissance first
- automated analyzers second
- contextual gap analysis after automated evidence
- explicit artifacts
- risk prioritization and remediation roadmap

It should differ from `analyze-security` in one material way: the primary taxonomy and review flow must be AI-specific, not generic web application security with minor AI add-ons.

## Why This Should Be Separate

This should be a separate prompt, not an extension of `analyze-security`.

Reasons:

- AI systems have distinct exploit paths centered on prompt/control flow, tool permissions, and model-connected trust boundaries.
- Generic code scanning is necessary but insufficient for agentic systems.
- The report taxonomy needs AI threat categories, AI-specific evidence, and AI-specific remediation guidance.

## Primary Objective

Assess the security posture of AI-enabled repositories, services, and integrations by identifying:

- prompt injection risk
- excessive agency and unsafe tool execution
- model, prompt, and artifact supply-chain risk
- sensitive data disclosure through prompts, context, logs, evals, or retrieval layers
- unsafe output handling
- trust-boundary failures across users, retrieved content, models, tools, and downstream systems
- missing adversarial evaluation and weak runtime containment

## Existing Enaible Capabilities To Reuse

Based on the current `analyze-security` prompt and known Enaible install/dependency wiring, the new prompt should reuse existing baseline analyzers where they still provide value:

- `security:semgrep`
- `security:detect_secrets`
- `security:osv`

These remain useful for:

- insecure code patterns
- hardcoded secrets
- vulnerable dependencies

Constraint observed from current Enaible implementation:

- prompt dependency wiring currently includes `analyze-security` with Semgrep and Detect Secrets support in Enaible's installer/dependency map
- AI-specific analyzer support appears to require new dependency declarations and likely new analyzer integrations

## New Analyzer Slots / Tooling Expectations

The prompt should support AI-specific analyzer hooks, ideally as first-class analyzers if Enaible adds them.

Recommended tools:

- `security:garak`
  - LLM vulnerability probing
  - repeatable adversarial suites
  - regression tracking
- `security:pyrit`
  - adversarial prompt attacks
  - jailbreak and scenario testing
  - multi-turn attack workflows
- `security:promptfoo`
  - prompt-level security evals
  - red-team style policy and exploit tests
  - regression comparison across prompt/model changes
- `security:modelscan`
  - model artifact and ML supply-chain scanning
  - unsafe serialization / artifact integrity review

If these are not yet native Enaible analyzers, the prompt should still be designed around pluggable analyzer execution and artifact capture so they can be added without redesigning the workflow.

## What The Prompt Must Cover

### 1. AI Surface Discovery

The prompt should first determine whether the target actually contains AI attack surface.

It should inspect for:

- LLM provider SDKs and API calls
- agent frameworks and orchestration runtimes
- MCP or other tool-call integrations
- prompt templates, prompt registries, and hidden system prompts
- eval harnesses and benchmark fixtures
- vector stores, embedding pipelines, and RAG components
- model artifacts and serialized ML assets
- model gateways, routers, and proxy layers

If no meaningful AI surface is detected, the prompt should stop early and report that AI-specific analysis is not applicable.

### 2. AI Threat Matrix

The prompt should require explicit review of the following categories:

- Prompt Injection
- Excessive Agency
- Sensitive Data Disclosure
- Improper Output Handling
- Model / Prompt / Artifact Supply Chain
- System Prompt Leakage
- Vector / Embedding Weaknesses
- Unbounded Consumption

It should not rely only on generic OWASP Top 10 categories.

### 3. Trust Boundary Mapping

The prompt should require the agent to map flows between:

- user inputs
- retrieved external content
- hidden/system prompts
- model inputs
- model outputs
- tool invocation inputs
- downstream APIs and internal services
- privileged side effects

This mapping should make clear where untrusted content crosses into privileged execution paths.

### 4. Agent Permission Review

The prompt should inspect:

- tool allowlists
- side-effectful tools
- shell/file/network access
- write and execute permissions
- human approval gates
- long-lived credentials
- whether model outputs can directly trigger actions

Prompt injection plus tool overreach should be treated as a default high-risk pattern whenever tools exist.

### 5. Prompt And Control Plane Security

The prompt should inspect:

- system prompts and hidden instructions
- prompt templating and variable interpolation
- whether untrusted text is merged into privileged prompts
- prompt ownership and review process
- prompt versioning and change control
- storage locations for prompts and prompt packs

### 6. Data Security

The prompt should inspect what sensitive data can reach:

- prompts
- context windows
- retrieval payloads
- logs
- eval traces
- caches
- external providers
- analytics sinks

It should flag unclear data handling as a security finding or manual verification requirement, not as an informational note.

### 7. Supply Chain Review

The prompt should extend supply-chain review beyond standard dependencies to include:

- model artifacts
- serialized ML assets
- prompt packs
- eval datasets
- embedding and retrieval assets
- remote model endpoints
- provider and gateway dependencies

### 8. Adversarial Verification

The prompt should require adversarial testing evidence where AI features exist.

Missing adversarial testing should be treated as a finding.

The intended verification model is:

- static analyzers for baseline signal
- AI-specific red-team/eval tooling for exploit simulation
- contextual review for trust boundaries and permission design

### 9. Runtime Containment

The prompt should inspect:

- sandboxing
- least privilege
- network egress restrictions
- secret scoping
- segmentation
- action confirmation for destructive or privileged operations
- safeguards on tool invocation and output execution

## Workflow Expectations

The future prompt should follow this high-level workflow:

1. Create `@ARTIFACT_ROOT` under `.enaible/artifacts/analyze-ai-security/<timestamp>`.
2. Run deterministic stack analysis.
3. Run AI-surface discovery and determine if AI-specific analysis applies.
4. Run baseline analyzers in parallel.
5. Run AI-specific analyzers in parallel when available.
6. Perform contextual gap analysis for risks deterministic analyzers cannot fully verify.
7. Score findings using AI-specific exploitability and impact criteria.
8. Produce final report, coverage gaps, and remediation roadmap.

## Expected Artifacts

The prompt should produce:

- `stack-analysis.json`
- `ai-surface-analysis.json`
- `threat-matrix.md`
- `semgrep.json`
- `detect-secrets.json`
- `osv.json`
- `garak.json` when available
- `pyrit.json` when available
- `promptfoo.json` when available
- `modelscan.json` when available
- `gap-analysis.md`
- `risk-summary.md`
- `final-analysis.md`

## Report Requirements

The output should not be limited to generic OWASP web findings.

The findings table should include AI-specific columns such as:

- `Severity`
- `AI Threat Category`
- `Location / Asset`
- `Exploit Path`
- `Required Capability`
- `Potential Impact`
- `Evidence Source`
- `Containment / Mitigation`

The report should also include:

- AI surface inventory
- trust-boundary map summary
- analyzer coverage vs uncovered risk classes
- explicit statement of missing adversarial validation
- remediation roadmap split into immediate containment, short-term hardening, and structural fixes

## Guardrails

- evidence only; do not modify repository files
- deterministic analyzers first, LLM reasoning second
- capture tool versions for all AI-specific analyzers
- abort on analyzer failure rather than degrading silently
- treat missing adversarial testing as a finding
- treat prompt injection plus excessive agency as a default high-risk area when tool use exists

## Non-Goals

- general model quality assessment
- product policy review unless it creates concrete security exposure
- duplicating the full generic remit of `analyze-security`

## Implementation Notes For The Prompt Skill

The generated prompt should preserve the structural pattern used by Enaible shared prompts:

- `Purpose`
- `Variables`
- `Instructions`
- `Workflow`
- `Output`

It should also preserve:

- artifact-first execution
- explicit analyzer outputs
- deterministic evidence collection before contextual reasoning
- no fallback behavior that hides missing tooling or missing evidence

## Suggested Payload Schema

Use a payload that tells the prompt-generation skill what to build, what to reuse, and what new hooks are required.

```yaml
prompt_id: analyze-ai-security
title: Analyze AI Security
template_key: analyzer
purpose: >
  Assess AI-enabled codebases and integrations using deterministic analyzers,
  AI-surface discovery, AI-specific threat modeling, contextual gap analysis,
  and remediation planning.
use_existing_pattern_from:
  - analyze-security
separate_prompt: true
objective:
  - Review LLM, agentic, and GenAI security posture.
  - Combine baseline appsec analyzers with AI-specific analyzers.
  - Produce AI-specific findings, risk scoring, and remediation outputs.
baseline_analyzers:
  - security:semgrep
  - security:detect_secrets
  - security:osv
ai_analyzer_hooks:
  - security:garak
  - security:pyrit
  - security:promptfoo
  - security:modelscan
required_ai_review_areas:
  - prompt_injection
  - excessive_agency
  - sensitive_data_disclosure
  - improper_output_handling
  - model_prompt_artifact_supply_chain
  - system_prompt_leakage
  - vector_embedding_weaknesses
  - unbounded_consumption
required_artifacts:
  - stack-analysis.json
  - ai-surface-analysis.json
  - threat-matrix.md
  - semgrep.json
  - detect-secrets.json
  - osv.json
  - garak.json
  - pyrit.json
  - promptfoo.json
  - modelscan.json
  - gap-analysis.md
  - risk-summary.md
  - final-analysis.md
report_requirements:
  - ai_surface_inventory
  - trust_boundary_summary
  - ai_specific_findings_table
  - analyzer_coverage_gaps
  - remediation_roadmap
guardrails:
  - evidence_only
  - deterministic_first
  - record_tool_versions
  - abort_on_analyzer_failure
  - missing_adversarial_testing_is_a_finding
notes:
  - Existing Enaible analyzer support can be reused for Semgrep, Detect Secrets, and OSV.
  - AI-specific analyzers likely require new dependency and execution wiring in Enaible.
```

## Example Payload

```yaml
prompt_id: analyze-ai-security
title: analyze-ai-security v1.0
template_key: analyzer
purpose: >
  Execute a comprehensive AI security assessment for LLM, agentic, and GenAI
  systems by combining deterministic scanning, AI-specific adversarial tooling,
  trust-boundary review, and actionable remediation planning.
use_existing_pattern_from:
  - analyze-security
separate_prompt: true
baseline_analyzers:
  - security:semgrep
  - security:detect_secrets
  - security:osv
ai_analyzer_hooks:
  - security:garak
  - security:pyrit
  - security:promptfoo
  - security:modelscan
required_ai_review_areas:
  - prompt_injection
  - excessive_agency
  - sensitive_data_disclosure
  - improper_output_handling
  - model_prompt_artifact_supply_chain
  - system_prompt_leakage
  - vector_embedding_weaknesses
  - unbounded_consumption
required_artifacts:
  - stack-analysis.json
  - ai-surface-analysis.json
  - threat-matrix.md
  - semgrep.json
  - detect-secrets.json
  - osv.json
  - gap-analysis.md
  - risk-summary.md
  - final-analysis.md
report_requirements:
  - ai_surface_inventory
  - trust_boundary_summary
  - ai_specific_findings_table
  - analyzer_coverage_gaps
  - remediation_roadmap
guardrails:
  - evidence_only
  - deterministic_first
  - record_tool_versions
  - abort_on_analyzer_failure
  - missing_adversarial_testing_is_a_finding
implementation_notes:
  - Reuse the existing analyze-security control flow.
  - Replace generic security taxonomy with AI-specific threat categories.
  - Support pluggable AI analyzer outputs even if some hooks are not yet implemented in Enaible.
```

## Source Basis

This brief is based on the 2025-2026 research synthesis captured in:

- `/Users/adamjackson/Projects/code-research/.enaible/artifacts/deep-topic-research/20260210T001026Z/report.md`

Key themes carried forward into this brief:

- prompt injection plus excessive agency is the dominant exploit chain
- continuous adversarial evaluation is a production requirement
- model and artifact scanning belong in supply-chain review
- AI capability gains increase urgency for least privilege and containment
