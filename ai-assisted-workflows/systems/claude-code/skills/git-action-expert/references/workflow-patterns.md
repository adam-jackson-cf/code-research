# GitHub Actions Workflow Patterns Reference

Comprehensive CI/CD workflow templates and patterns for common use cases.

## Node.js Workflows

### Complete CI Workflow

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version: 22
          cache: "npm"

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      matrix:
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version: ${{ matrix.node }}
          cache: "npm"

      - run: npm ci
      - run: npm test -- --coverage

      - uses: actions/upload-artifact@5d5d22a31266ced268874388b861e4b58bb5c2f3 # v4.3.1
        if: matrix.node == 22
        with:
          name: coverage-report
          path: coverage/

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version: 22
          cache: "npm"

      - run: npm ci
      - run: npm run build

      - uses: actions/upload-artifact@5d5d22a31266ced268874388b861e4b58bb5c2f3 # v4.3.1
        with:
          name: build-output
          path: dist/
          retention-days: 7
```

### Bun Workflow

```yaml
name: CI (Bun)

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - uses: oven-sh/setup-bun@8f24390df009a496891208e5e36b8a1de1f45135 # v1.2.2
        with:
          bun-version: latest

      - run: bun install
      - run: bun test
      - run: bun run typecheck
      - run: bun run build
```

## Python Workflows

### Python CI with uv

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ["3.11", "3.12", "3.13"]
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - uses: astral-sh/setup-uv@c9aa747934b6867b18bf8f6420b0d82b0f48e024 # v4.2.0
        with:
          enable-cache: true

      - run: uv python install ${{ matrix.python }}
      - run: uv sync
      - run: uv run pytest --cov
      - run: uv run ruff check .
      - run: uv run mypy src

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - uses: astral-sh/setup-uv@c9aa747934b6867b18bf8f6420b0d82b0f48e024 # v4.2.0

      - run: uv build

      - uses: actions/upload-artifact@5d5d22a31266ced268874388b861e4b58bb5c2f3 # v4.3.1
        with:
          name: dist
          path: dist/
```

## Docker Workflows

### Build and Push

```yaml
name: Docker

on:
  push:
    branches: [main]
    tags: ["v*"]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - uses: docker/setup-buildx-action@f95db51fddba0c2d1ec667646a06c2ce06100226 # v3.0.0

      - uses: docker/login-action@343f7c4344506bcbf9b4de18042ae17996df046d # v3.0.0
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@8e5442c4ef9f78752691e2d8f8d19755c6f78e81 # v5.5.1
        id: meta
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha

      - uses: docker/build-push-action@4a13e500e55cf31b7a5d59a38ab2040ab0f42f56 # v5.1.0
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  scan:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: "sarif"
          output: "trivy-results.sarif"

      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: "trivy-results.sarif"
```

## Deployment Workflows

### Multi-Environment Deployment

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: "Environment to deploy"
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      artifact-id: ${{ steps.upload.outputs.artifact-id }}
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0
      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version: 22
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@5d5d22a31266ced268874388b861e4b58bb5c2f3 # v4.3.1
        id: upload
        with:
          name: app-${{ github.sha }}
          path: dist/

  deploy-staging:
    needs: build
    if: github.event_name == 'push' || github.event.inputs.environment == 'staging'
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: app-${{ github.sha }}
          path: dist/

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_STAGING }}
          aws-region: us-east-1

      - run: aws s3 sync dist/ s3://staging-bucket/

  deploy-production:
    needs: [build, deploy-staging]
    if: github.event.inputs.environment == 'production'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: app-${{ github.sha }}
          path: dist/

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_PRODUCTION }}
          aws-region: us-east-1

      - run: aws s3 sync dist/ s3://production-bucket/
```

## Reusable Workflows

### Reusable Test Workflow

```yaml
# .github/workflows/reusable-test.yml
name: Reusable Test

on:
  workflow_call:
    inputs:
      node-version:
        required: false
        type: string
        default: "22"
      test-command:
        required: false
        type: string
        default: "npm test"
    secrets:
      NPM_TOKEN:
        required: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version: ${{ inputs.node-version }}
          cache: "npm"
          registry-url: "https://npm.pkg.github.com"
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - run: npm ci
      - run: ${{ inputs.test-command }}
```

### Calling Reusable Workflow

```yaml
name: CI

on:
  push:
    branches: [main]

jobs:
  test:
    uses: ./.github/workflows/reusable-test.yml
    with:
      node-version: "22"
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Composite Actions

### Setup Project Action

```yaml
# .github/actions/setup-project/action.yml
name: Setup Project
description: Setup Node.js project with caching

inputs:
  node-version:
    description: Node.js version
    required: false
    default: "22"

runs:
  using: composite
  steps:
    - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
      with:
        node-version: ${{ inputs.node-version }}
        cache: "npm"

    - run: npm ci
      shell: bash
```

### Using Composite Action

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0
      - uses: ./.github/actions/setup-project
        with:
          node-version: "22"
      - run: npm run build
```

## Scheduled Workflows

### Dependency Updates

```yaml
name: Dependencies

on:
  schedule:
    - cron: "0 0 * * 1" # Weekly on Monday
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version: 22

      - run: npx npm-check-updates -u
      - run: npm install
      - run: npm test

      - uses: peter-evans/create-pull-request@v6
        with:
          commit-message: "chore: update dependencies"
          title: "chore: update dependencies"
          branch: deps/update
```

### Security Audit

```yaml
name: Security

on:
  schedule:
    - cron: "0 0 * * *" # Daily
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version: 22

      - run: npm audit --audit-level=high

      - uses: github/codeql-action/init@v3
        with:
          languages: javascript

      - uses: github/codeql-action/analyze@v3
```

## Job Dependencies and Outputs

### Complex Job Graph

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Linting..."

  test:
    runs-on: ubuntu-latest
    needs: lint
    outputs:
      coverage: ${{ steps.test.outputs.coverage }}
    steps:
      - id: test
        run: echo "coverage=85" >> $GITHUB_OUTPUT

  build:
    runs-on: ubuntu-latest
    needs: lint
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - id: version
        run: echo "version=1.0.0" >> $GITHUB_OUTPUT

  deploy:
    runs-on: ubuntu-latest
    needs: [test, build]
    if: needs.test.outputs.coverage >= 80
    steps:
      - run: echo "Deploying version ${{ needs.build.outputs.version }}"
```

## Implementation Plan Template

When creating workflow implementation plans, use this structure:

```markdown
# Workflow Implementation Plan: [Task Name]

## Overview

[CI/CD requirements and approach]

## Architecture Decisions

- **Trigger Strategy**: [Events that trigger workflows]
- **Job Structure**: [Organization and dependencies]
- **Security Model**: [Authentication and protection]

## Workflow Files

### New Files

- `.github/workflows/ci.yml`: [Purpose]

### Modified Files

- `.github/workflows/existing.yml`: [Changes]

## Marketplace Actions

[Actions with SHA pinning]

## Environment Configuration

[Secrets, protection rules, approvals]
```

## External Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- [Marketplace Actions](https://github.com/marketplace?type=actions)
