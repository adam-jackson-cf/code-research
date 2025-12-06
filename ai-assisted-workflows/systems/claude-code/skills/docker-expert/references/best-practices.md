# Docker Best Practices Reference

Comprehensive guide to Docker containerization patterns and optimization techniques.

## Base Image Selection Strategies

### Official Images

Docker Hub official images receive regular security updates and are maintained by Docker.

**Language-Specific Recommendations:**

| Language | Production                                   | Development                        |
| -------- | -------------------------------------------- | ---------------------------------- |
| Node.js  | `node:22-alpine`                             | `node:22-bookworm`                 |
| Python   | `python:3.13-alpine`                         | `python:3.13-bookworm`             |
| Java     | `eclipse-temurin:21-jre-alpine`              | `eclipse-temurin:21-jdk`           |
| Go       | `scratch` or `distroless`                    | `golang:1.23-alpine`               |
| .NET     | `mcr.microsoft.com/dotnet/aspnet:9.0-alpine` | `mcr.microsoft.com/dotnet/sdk:9.0` |

### Minimal Images

**Alpine Linux (~5MB):**

- Pros: Small size, active security updates
- Cons: Uses musl libc (potential compatibility issues)
- Best for: General production workloads

**Distroless (2-20MB):**

- Pros: No shell, no package manager, minimal attack surface
- Cons: Difficult to debug, limited tooling
- Best for: Security-critical production deployments

**Scratch:**

- Pros: Absolute minimum (no OS layer)
- Cons: Requires statically compiled binaries
- Best for: Go applications, single binary deployments

### Security-Focused Images

**Chainguard Images:**

- Zero or minimal CVEs
- Daily rebuilds
- SBOM included
- Enterprise support available

**Iron Bank (DoD):**

- Hardened for government compliance
- Extensive security scanning
- Audit trail and provenance

### Multi-Architecture Support

Build for multiple architectures to support modern cloud infrastructure:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t app:latest .
```

ARM64 compatibility important for:

- AWS Graviton instances (cost savings)
- Apple Silicon development machines
- Azure ARM-based VMs

## Build Optimization Techniques

### Multi-Stage Build Patterns

**Basic Pattern:**

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

**Advanced Pattern with Test Stage:**

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS deps
RUN npm ci

FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm test

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs22-debian12
COPY --from=build /app/dist /app
CMD ["/app/index.js"]
```

### Layer Caching Optimization

**Order layers by change frequency (least to most):**

1. Base image and system packages
2. Application dependencies
3. Application code

**Example with proper ordering:**

```dockerfile
FROM python:3.13-alpine

# System dependencies (rarely change)
RUN apk add --no-cache gcc musl-dev

# Python dependencies (change occasionally)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code (changes frequently)
COPY . .
CMD ["python", "app.py"]
```

### BuildKit Features

**Cache Mounts for Package Managers:**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
```

**Secret Mounts:**

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

Build command:

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc .
```

**SSH Forwarding:**

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=ssh git clone git@github.com:private/repo.git
```

### Build Context Optimization

**Comprehensive .dockerignore:**

```
# Version control
.git
.gitignore

# Dependencies
node_modules
__pycache__
*.pyc
.venv

# Build artifacts
dist
build
*.egg-info

# Development files
.env*
*.log
.DS_Store
Thumbs.db

# Documentation
docs
*.md
!README.md

# Testing
coverage
.pytest_cache
.nyc_output

# IDE
.vscode
.idea
*.swp
```

## Resource Management

### CPU and Memory Limits

**Docker Run:**

```bash
docker run --cpus=2 --memory=512m --memory-swap=512m app:latest
```

**Docker Compose:**

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 256M
```

### Health Checks

**HTTP Health Check:**

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1
```

**TCP Health Check:**

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD nc -z localhost 8080 || exit 1
```

**Custom Script:**

```dockerfile
COPY healthcheck.sh /healthcheck.sh
HEALTHCHECK --interval=30s --timeout=10s \
  CMD /healthcheck.sh
```

## CI/CD Integration Patterns

### GitHub Actions

```yaml
name: Build and Push
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Registry Management

**Tagging Strategy:**

```bash
# Semantic versioning
docker tag app:latest registry/app:1.2.3
docker tag app:latest registry/app:1.2
docker tag app:latest registry/app:1
docker tag app:latest registry/app:latest

# Git-based
docker tag app:latest registry/app:${GIT_SHA:0:7}
docker tag app:latest registry/app:${BRANCH_NAME}
```

**Image Cleanup:**

```bash
# Remove dangling images
docker image prune -f

# Remove images older than 24h
docker image prune -a --filter "until=24h"
```

## Performance Monitoring

### Container Metrics

**Real-time stats:**

```bash
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
```

**Prometheus Integration:**

```yaml
services:
  app:
    labels:
      - "prometheus.io/scrape=true"
      - "prometheus.io/port=9090"
```

### Logging Best Practices

**JSON Logging:**

```dockerfile
ENV LOG_FORMAT=json
```

**Log Driver Configuration:**

```yaml
services:
  app:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

## Implementation Plan Template

When creating Docker implementation plans, use this structure:

```markdown
# Docker Implementation Plan: [Application Name]

## Requirements Summary

- **Application**: [Description]
- **Runtime**: [Language, framework, dependencies]
- **Infrastructure**: [Platform, constraints]
- **Performance**: [Build/image/startup targets]

## Technology Stack

- **Base Image**: [Selection with rationale]
- **Build Strategy**: [Multi-stage approach]
- **Security Measures**: [Hardening techniques]
- **Orchestration**: [Platform choice]

## Implementation Phases

1. Basic Containerization
2. Optimization and Security
3. Production Deployment
```

## Troubleshooting

### Common Issues

**Image Won't Start:**

1. Check CMD/ENTRYPOINT syntax
2. Verify file permissions
3. Check for missing dependencies
4. Review health check configuration

**Build Failures:**

1. Verify base image exists
2. Check network connectivity
3. Review cache invalidation
4. Inspect build context size

**Performance Issues:**

1. Review resource limits
2. Check I/O operations
3. Analyze layer sizes
4. Profile application startup

### Debugging Commands

```bash
# Interactive shell in running container
docker exec -it <container> /bin/sh

# View container logs
docker logs -f --tail 100 <container>

# Inspect container configuration
docker inspect <container>

# View image layers
docker history <image>

# Analyze image size
docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}"
```

## External Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [BuildKit Documentation](https://docs.docker.com/build/buildkit/)
- [Distroless Images](https://github.com/GoogleContainerTools/distroless)
- [Chainguard Images](https://www.chainguard.dev/chainguard-images)
