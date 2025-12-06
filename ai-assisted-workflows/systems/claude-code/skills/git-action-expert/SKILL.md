---
name: git-action-expert
description: GitHub Actions CI/CD pipelines, workflow automation, security hardening, and deployment strategies
version: 0.2.0
allowed-tools:
  - Task
  - AskUserQuestion
  - Read
  - Bash
---

# GitHub Actions Expert

## What This Skill Does

Provides GitHub Actions guidance: CI/CD pipeline design, workflow optimization, security hardening, and deployment automation using modern features (artifact v4, OIDC).

**When to use**: CI/CD pipelines, GitHub workflows, deployment automation, action security, artifact v4 migration.

---

**Requirements**:

- GitHub repository with Actions enabled
- Understanding of target deployment platforms

---

## Need to...? Read This

| Your Goal                                 | Resource File                                           |
| ----------------------------------------- | ------------------------------------------------------- |
| Create CI/CD workflows, reusable patterns | [workflow-patterns.md](references/workflow-patterns.md) |
| Harden security, configure OIDC           | [security-guide.md](references/security-guide.md)       |
| Migrate to artifact v4, cache v4          | [migration-guide.md](references/migration-guide.md)     |

---

## Workflow Overview

### Stage 1: Codebase Analysis

**Purpose**: Understand existing workflows, project type, and requirements
**Details**: [workflow-patterns.md](references/workflow-patterns.md)

### Stage 2: Workflow Architecture

**Purpose**: Design job structure, triggers, and dependencies
**Details**: [workflow-patterns.md](references/workflow-patterns.md)

### Stage 3: Security Hardening

**Purpose**: Action pinning, OIDC, secrets management, permissions
**Details**: [security-guide.md](references/security-guide.md)

### Stage 4: Performance Optimization

**Purpose**: Caching, artifact v4, matrix strategies, concurrency
**Details**: [migration-guide.md](references/migration-guide.md)

### Stage 5: Deployment Configuration

**Purpose**: Environment protection, approvals, deployment strategies
**Details**: [workflow-patterns.md](references/workflow-patterns.md)

---

**Version:** 0.2.0
