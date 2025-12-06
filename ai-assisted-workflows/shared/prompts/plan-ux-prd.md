# plan-ux-prd v0.3

## Purpose

Produce a comprehensive UX-focused Product Requirements Document (PRD) that defines personas, scope, screen architecture, flows, and acceptance criteria based on @USER_PROMPT.

## Variables

### Required

- @USER_PROMPT = $1 — UX-focused product brief provided by the user

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)

### Derived (internal)

- (none)

## Instructions

- Lead with detailed discovery; gather product foundation, user insights, UX requirements, screen architecture, and onboarding details.
- Assign stable IDs (F-001, S-001, FL-001) for features, screens, and flows; reuse consistently across sections.
- Respect STOP confirmations unless @AUTO is provided; when auto is active, treat checkpoints as approved without altering other behavior.
- Ensure MoSCoW scope ties directly to screen architecture and flows.
- Document design principles, accessibility requirements (WCAG), interaction patterns, and content tone explicitly.

## Workflow

1. Information gathering

   - Review @USER_PROMPT and clarify missing areas (product concept, target users, platforms, UX/UI requirements, screens).
   - Conduct targeted question sequence covering:
     - Product foundation
     - User & market
     - UX/UI specifics
     - Screen architecture
     - Design standards
     - Onboarding experience
   - Summarize understanding and confirm key requirements with user.
   - **STOP (skip when @AUTO):** “Ready to generate the PRD? (y/n)”
     - When @AUTO is present, continue immediately and record internally that the confirmation was auto-applied.

2. PRD generation

   - Generate the complete PRD using the Output Contract below. Populate all required sections using the Phase 1 answers. Use stable IDs for cross‑references.

   - Feature IDs: `F-001`, `F-002`, ...
   - Screen IDs: `S-001`, `S-002`, ...
   - Flow IDs: `FL-001`, `FL-002`, ...

   **Output Contract (exact order and headings):**

   ```markdown
   # Product Requirements Document (PRD): <Product Name>

   ## 1. Overview

   - Brief: <one-paragraph description>
   - Goals: <3–5 bullet goals>
   - Non‑Goals: <2–4 bullets>

   ## 2. Personas

   - <Name> — <Role>
     - Goals: [...]
     - Pain Points: [...]
     - Screen Patterns: { primary: [...], secondary: [...], admin: [...] }

   ## 3. Scope (MoSCoW)

   ### Must Have

   - [F-001] <Name> — <1–2 sentence description>

   ### Should Have

   - [F-00X] ...

   ### Could Have

   - [F-00X] ...

   ### Won't Have

   - [F-00X] ...

   ## 4. Screen Architecture

   - Primary Screens: [S-001 <Name>, S-002 <Name>, ...]
   - Secondary Screens: [...]
   - Admin/Settings: [...]
   - Navigation Model: <global nav, local nav, search>

   ## 5. Key User Flows

   - [FL-001] <Flow Name>
     - Trigger
     - Preconditions
     - Steps (numbered)
     - Alternate Paths
     - Postconditions

   ## 6. UX/UI Requirements

   - Design Principles: [...]
   - Accessibility (WCAG): <levels, color contrast, focus, ARIA>
   - Interaction Patterns: <inputs, validation, empty states, errors>
   - Content & Tone: <voice, microcopy rules>

   ## 7. Data & Analytics

   - Core Entities: <list>
   - Events to Track: <event:name, properties>
   - KPIs: <metrics>

   ## 8. Non‑Functional Requirements

   - Performance, Reliability, Privacy, Security

   ## 9. Acceptance Criteria (per feature)

   - [F-001] <Name>
     - Given/When/Then cases (3–6 lines)

   ## 10. Risks & Assumptions

   - Risks: [...]
   - Assumptions: [...]
   ```

   - Ensure cross-references (features ↔ screens ↔ flows) are consistent.

3. Quality validation
   - Verify checklist:
     - All MoSCoW features map to screens and flows.
     - Personas include screen usage patterns.
     - Screen architecture reflects user journeys.
     - UX specifications actionable for design.
     - Acceptance criteria cover each feature.
   - **STOP (skip when @AUTO):** “PRD generated with quality validation complete.”
     - When @AUTO is present, continue immediately and record internally that the confirmation was auto-applied.

## Output

```md
# RESULT

- Summary: UX PRD generated for "<@USER_PROMPT>".
- Personas: <count>
- Features: <count> (Must: <n>, Should: <n>, Could: <n>, Won't: <n>)

## DELIVERABLE

- Saved PRD: <path-to-document>
```
