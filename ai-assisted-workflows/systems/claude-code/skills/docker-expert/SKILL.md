---
name: docker-expert
description: Docker containerization, image optimization, security hardening, and orchestration planning
version: 0.2.0
allowed-tools:
  - Task
  - AskUserQuestion
  - Read
  - Bash
---

# Docker Containerization Expert

## What This Skill Does

Provides Docker containerization guidance: base image selection, multi-stage builds, security hardening, and orchestration platform integration.

**When to use**: Containerization strategy, Dockerfile optimization, container security, Docker Compose, Kubernetes deployments.

---

**Requirements**:

- Docker/Podman installed
- Target deployment platform identified

---

## Need to...? Read This

| Your Goal                             | Resource File                                                     |
| ------------------------------------- | ----------------------------------------------------------------- |
| Select base images, optimize builds   | [best-practices.md](references/best-practices.md)                 |
| Harden security, scan vulnerabilities | [security-hardening.md](references/security-hardening.md)         |
| Configure Compose/K8s/cloud platforms | [orchestration-patterns.md](references/orchestration-patterns.md) |

---

## Workflow Overview

### Stage 1: Requirements

**Purpose**: Gather application runtime, dependencies, and deployment target
**Details**: [best-practices.md](references/best-practices.md)

### Stage 2: Base Image Selection

**Purpose**: Choose minimal, secure base image for use case
**Details**: [best-practices.md](references/best-practices.md)

### Stage 3: Build Optimization

**Purpose**: Multi-stage builds, layer caching, BuildKit features
**Details**: [best-practices.md](references/best-practices.md)

### Stage 4: Security Hardening

**Purpose**: Non-root execution, read-only filesystem, vulnerability scanning
**Details**: [security-hardening.md](references/security-hardening.md)

### Stage 5: Orchestration

**Purpose**: Deploy to target platform with appropriate configuration
**Details**: [orchestration-patterns.md](references/orchestration-patterns.md)

---

**Version:** 0.2.0
