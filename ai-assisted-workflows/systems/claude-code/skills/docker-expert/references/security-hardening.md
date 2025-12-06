# Docker Security Hardening Reference

Comprehensive security patterns for container hardening and compliance.

## Non-Root Execution

### Creating Dedicated Users

**Standard Pattern:**

```dockerfile
FROM node:22-alpine

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app
COPY --chown=appuser:appgroup . .

USER appuser
CMD ["node", "index.js"]
```

**Distroless Pattern:**

```dockerfile
FROM gcr.io/distroless/nodejs22-debian12
COPY --chown=nonroot:nonroot ./dist /app
USER nonroot
CMD ["/app/index.js"]
```

### Numeric User IDs

Prefer numeric IDs for Kubernetes compatibility:

```dockerfile
USER 1001:1001
```

## Read-Only Filesystems

### Docker Run

```bash
docker run --read-only --tmpfs /tmp:rw,noexec,nosuid app:latest
```

### Docker Compose

```yaml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid
      - /var/run:rw
```

### Application Considerations

Ensure application writes only to:

- Mounted volumes
- tmpfs directories
- External services (databases, object storage)

## Linux Capabilities

### Dropping All Capabilities

```bash
docker run --cap-drop=ALL app:latest
```

### Adding Specific Capabilities

Only add what's absolutely required:

```bash
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE app:latest
```

### Common Capability Requirements

| Capability       | Use Case                        |
| ---------------- | ------------------------------- |
| NET_BIND_SERVICE | Bind ports below 1024           |
| CHOWN            | Change file ownership           |
| SETUID/SETGID    | Change user/group ID            |
| SYS_PTRACE       | Debugging (avoid in production) |

### Docker Compose

```yaml
services:
  app:
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

## Secret Management

### BuildKit Secrets

**During Build:**

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=api_key \
    API_KEY=$(cat /run/secrets/api_key) npm run build
```

Build command:

```bash
docker build --secret id=api_key,src=./api_key.txt .
```

### Runtime Secrets

**Docker Swarm:**

```yaml
services:
  app:
    secrets:
      - db_password
secrets:
  db_password:
    external: true
```

**Kubernetes:**

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: app
      volumeMounts:
        - name: secrets
          mountPath: /run/secrets
          readOnly: true
  volumes:
    - name: secrets
      secret:
        secretName: app-secrets
```

### External Secret Managers

**HashiCorp Vault Integration:**

```dockerfile
COPY --from=vault:latest /bin/vault /usr/local/bin/vault

ENTRYPOINT ["/entrypoint.sh"]
```

entrypoint.sh:

```bash
#!/bin/sh
export DB_PASSWORD=$(vault kv get -field=password secret/db)
exec "$@"
```

### Anti-Patterns to Avoid

```dockerfile
# NEVER do this
ENV API_KEY=secret123
ARG PASSWORD=secret456
COPY .env .
```

## Vulnerability Scanning

### Trivy Integration

**CLI Scan:**

```bash
trivy image --severity HIGH,CRITICAL app:latest
```

**CI/CD Integration:**

```yaml
- name: Scan image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: "app:latest"
    format: "sarif"
    output: "trivy-results.sarif"
    severity: "CRITICAL,HIGH"
    exit-code: "1"
```

### Docker Scout

```bash
docker scout cves app:latest
docker scout recommendations app:latest
```

### Snyk Container

```bash
snyk container test app:latest --severity-threshold=high
```

### Scan Automation

```yaml
# .github/workflows/security.yml
name: Security Scan
on:
  push:
  schedule:
    - cron: "0 0 * * *" # Daily scan

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t app:${{ github.sha }} .
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: "app:${{ github.sha }}"
          exit-code: "1"
          severity: "CRITICAL"
```

## Supply Chain Security

### SBOM Generation

**Syft:**

```bash
syft app:latest -o spdx-json > sbom.json
```

**Docker BuildKit:**

```bash
docker buildx build --sbom=true -t app:latest .
```

### Provenance Attestation

```bash
docker buildx build --provenance=true -t app:latest .
```

### Image Signing

**Cosign:**

```bash
# Sign image
cosign sign --key cosign.key ghcr.io/org/app:latest

# Verify image
cosign verify --key cosign.pub ghcr.io/org/app:latest
```

### Base Image Verification

```dockerfile
# Pin to digest for reproducibility
FROM node:22-alpine@sha256:abc123...
```

## Network Security

### Network Isolation

```yaml
services:
  app:
    networks:
      - frontend
  db:
    networks:
      - backend
  api:
    networks:
      - frontend
      - backend

networks:
  frontend:
  backend:
    internal: true # No external access
```

### Port Restrictions

```yaml
services:
  app:
    ports:
      - "127.0.0.1:8080:8080" # Localhost only
```

## Security Benchmarks

### CIS Docker Benchmark

Key recommendations:

1. Keep Docker updated
2. Avoid privileged containers
3. Limit container resources
4. Use read-only root filesystem
5. Enable content trust
6. Use secure registries
7. Configure logging
8. Implement network segmentation

### Running Benchmark

```bash
docker run --rm --net host --pid host \
  --userns host --cap-add audit_control \
  -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
  -v /etc:/etc:ro \
  -v /usr/bin/containerd:/usr/bin/containerd:ro \
  -v /usr/bin/runc:/usr/bin/runc:ro \
  -v /var/lib:/var/lib:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  docker/docker-bench-security
```

## Compliance Considerations

### NIST SP 800-190

Application container security guidelines:

- Use minimal base images
- Scan images for vulnerabilities
- Run containers as non-root
- Use read-only filesystems
- Implement network segmentation
- Maintain image provenance

### SOC 2 Requirements

- Vulnerability scanning in CI/CD
- Access controls for registries
- Audit logging for container operations
- Secret management practices
- Incident response procedures

### PCI DSS

- Network segmentation
- Encryption in transit
- Access control
- Vulnerability management
- Logging and monitoring

## External Resources

- [Trivy Scanner](https://trivy.dev/)
- [Docker Scout](https://docs.docker.com/scout/)
- [Cosign Image Signing](https://docs.sigstore.dev/cosign/overview/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [NIST SP 800-190](https://csrc.nist.gov/publications/detail/sp/800-190/final)
