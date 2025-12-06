# Juice Shop Security Hardening Sprint 1

## Features

- Sanitize product search query (SQLi)
- Enforce CSRF token on checkout
- Password policy upgrade (min length 12 + zxcvbn score)
- Dependency inventory baseline
- Upgrade vulnerable dependencies
- Centralized security event logging
- Add rate limiter to auth endpoints

## Constraints

- No breaking changes to existing API contracts
- Must support existing database schema
- No downtime during deployment
- No downtime during rollout

## Assumptions

- Juice Shop monorepo is the target codebase
- OWASP dependency check baseline exists
- Existing auth flow supports token injection

## Risks

- Third-party dependency upgrades may introduce regressions
- Rate limiting may impact legitimate user traffic
- Logging volume may increase storage costs

## Success Criteria

- All OWASP Top 10 vulnerabilities in test_codebase/juice-shop-monorepo are addressed
- Automated security scans pass with zero high findings
- Performance regression < 5% for authenticated flows

## Open Questions

- Which OWASP dependency check tool version to use?
- Should rate limiting be per-IP or per-user?
