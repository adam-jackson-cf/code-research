# GitHub Actions Security Guide

Comprehensive security hardening patterns for GitHub Actions workflows.

## Supply Chain Security

### Action Pinning

**Always pin to specific commit SHAs:**

```yaml
# Good - pinned to SHA
- uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0

# Bad - version tags can be moved
- uses: actions/checkout@v4
```

**Finding SHAs for actions:**

```bash
# Get SHA for a specific version
git ls-remote --tags https://github.com/actions/checkout | grep v4.1.0
```

### Automated SHA Updates

Use Dependabot for action updates:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "ci"
```

### Third-Party Action Vetting

Before using third-party actions:

1. Check repository stars and activity
2. Review source code for suspicious behavior
3. Verify the action is maintained
4. Check for security advisories
5. Consider forking critical actions

## OIDC Authentication

### AWS OIDC Setup

**GitHub Side:**

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions
          aws-region: us-east-1
```

**AWS IAM Role Trust Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:org/repo:*"
        }
      }
    }
  ]
}
```

### Azure OIDC Setup

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

### GCP OIDC Setup

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: "projects/123456789/locations/global/workloadIdentityPools/github/providers/github"
          service_account: "github-actions@project.iam.gserviceaccount.com"
```

## Secrets Management

### Secret Scoping

```yaml
# Repository secret - available to all workflows
${{ secrets.REPO_SECRET }}

# Environment secret - only available in specific environment
jobs:
  deploy:
    environment: production
    steps:
      - run: echo "${{ secrets.PROD_API_KEY }}"

# Organization secret - available across repos
${{ secrets.ORG_SECRET }}
```

### Secret Masking

```yaml
steps:
  - run: |
      echo "::add-mask::$SENSITIVE_VALUE"
      # SENSITIVE_VALUE will be masked in logs
```

### Preventing Secret Exposure

```yaml
# Don't echo secrets
- run: echo ${{ secrets.API_KEY }} # BAD

# Use environment variables
- run: ./script.sh
  env:
    API_KEY: ${{ secrets.API_KEY }}

# Check for secret leaks
- uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    extra_args: --only-verified
```

## Token Permissions

### Principle of Least Privilege

```yaml
# Set minimal permissions at workflow level
permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

  deploy:
    runs-on: ubuntu-latest
    # Override with additional permissions only where needed
    permissions:
      contents: read
      id-token: write
      deployments: write
```

### Common Permission Patterns

```yaml
# Read-only for CI
permissions:
  contents: read

# Package publishing
permissions:
  contents: read
  packages: write

# Release creation
permissions:
  contents: write

# PR comments
permissions:
  contents: read
  pull-requests: write

# Security scanning with SARIF upload
permissions:
  contents: read
  security-events: write
```

## Environment Protection

### Manual Approvals

Configure in repository settings:

1. Settings → Environments → New environment
2. Add required reviewers
3. Enable "Required reviewers" protection rule

```yaml
jobs:
  deploy:
    environment:
      name: production
      url: https://example.com
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying to production"
```

### Branch Protection

```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
```

### Deployment Protection Rules

Custom protection rules for advanced logic:

```yaml
# Custom deployment protection using deployment_status
on:
  deployment_status:

jobs:
  post-deploy:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deployment successful"
```

## Workflow Security Patterns

### Preventing Script Injection

```yaml
# Bad - vulnerable to injection
- run: echo "${{ github.event.issue.title }}"

# Good - use environment variable
- run: echo "$TITLE"
  env:
    TITLE: ${{ github.event.issue.title }}
```

### Restricting Workflow Triggers

```yaml
# Only allow specific actors
on:
  workflow_dispatch:

jobs:
  sensitive-operation:
    if: github.actor == 'trusted-user'
    runs-on: ubuntu-latest
```

### Fork Safety

```yaml
# Don't run on forks with secrets
on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    # This won't have access to secrets from forks
    steps:
      - run: npm test

  deploy-preview:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    # Only runs for PRs from the same repo
    steps:
      - run: deploy-preview
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

## Audit and Compliance

### Workflow Logging

```yaml
steps:
  - run: |
      echo "Workflow: ${{ github.workflow }}"
      echo "Actor: ${{ github.actor }}"
      echo "Event: ${{ github.event_name }}"
      echo "Ref: ${{ github.ref }}"
      echo "SHA: ${{ github.sha }}"
```

### Artifact Attestation

```yaml
- uses: actions/attest-build-provenance@v1
  with:
    subject-path: "dist/*"
```

### SBOM Generation

```yaml
- uses: anchore/sbom-action@v0
  with:
    path: ./
    format: spdx-json
    output-file: sbom.spdx.json

- uses: actions/upload-artifact@v4
  with:
    name: sbom
    path: sbom.spdx.json
```

## Security Scanning

### CodeQL Analysis

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 0 * * 0"

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - uses: github/codeql-action/init@v3
        with:
          languages: javascript

      - uses: github/codeql-action/autobuild@v3

      - uses: github/codeql-action/analyze@v3
```

### Dependency Scanning

```yaml
- uses: actions/dependency-review-action@v4
  if: github.event_name == 'pull_request'
```

### Container Scanning

```yaml
- uses: aquasecurity/trivy-action@master
  with:
    image-ref: "app:${{ github.sha }}"
    format: "sarif"
    output: "trivy-results.sarif"
    severity: "CRITICAL,HIGH"

- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: "trivy-results.sarif"
```

## Incident Response

### Revoking Compromised Secrets

1. Rotate the secret immediately
2. Update repository/organization secrets
3. Review workflow run history for unauthorized access
4. Check for any data exfiltration

### Workflow Audit

```bash
# Review recent workflow runs
gh run list --limit 50

# Check workflow file changes
git log --oneline -- .github/workflows/
```

### Security Alerts

Enable security alerts in repository settings:

- Dependabot alerts
- Secret scanning
- Code scanning
- Push protection

## External Resources

- [Security Hardening Guide](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [OIDC Configuration](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Secret Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Token Permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
