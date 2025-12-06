---
name: python-expert
description: Modern Python development with type system design, async patterns, FastAPI, and Pydantic
version: 0.2.0
allowed-tools:
  - Task
  - AskUserQuestion
  - Read
  - Bash
---

# Python Expert

## What This Skill Does

Provides modern Python development guidance: type system design, async/await patterns, data modeling with Pydantic, and API development with FastAPI.

**When to use**: Python architecture, type hints, async patterns, FastAPI/Pydantic, pytest setup, Python 3.11+ features.

---

**Requirements**:

- Python 3.11+ (ideally 3.13)
- uv package manager preferred

---

## Need to...? Read This

| Your Goal                                | Resource File                                       |
| ---------------------------------------- | --------------------------------------------------- |
| Design type-safe interfaces, Protocols   | [type-system.md](references/type-system.md)         |
| Implement async/await, TaskGroup, queues | [async-patterns.md](references/async-patterns.md)   |
| Build FastAPI services, Pydantic models  | [api-development.md](references/api-development.md) |

---

## Workflow Overview

### Stage 1: Project Analysis

**Purpose**: Understand existing patterns, Python version, dependencies
**Details**: [api-development.md](references/api-development.md)

### Stage 2: Type System Design

**Purpose**: Protocol-based interfaces, generics, type safety
**Details**: [type-system.md](references/type-system.md)

### Stage 3: Async Architecture

**Purpose**: TaskGroup, semaphores, queues, error handling
**Details**: [async-patterns.md](references/async-patterns.md)

### Stage 4: Data Modeling

**Purpose**: Pydantic models, validation, serialization
**Details**: [api-development.md](references/api-development.md)

### Stage 5: Testing Strategy

**Purpose**: pytest fixtures, async testing, mocking
**Details**: [async-patterns.md](references/async-patterns.md)

---

**Version:** 0.2.0
