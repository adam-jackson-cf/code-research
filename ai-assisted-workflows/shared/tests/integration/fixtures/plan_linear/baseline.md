# Juice Shop Security Hardening

## Features

- Sanitize product search query (SQLi)
- Enforce CSRF token on checkout
- Password policy upgrade (min length 12 + zxcvbn score)
- Dependency audit and upgrade (OWASP flagged libs)
- Centralized security event logging
- Add rate limiter to auth endpoints

## Constraints

- No breaking changes to existing API contracts
- Must support existing database schema
- No downtime during deployment

## Assumptions

- Juice Shop monorepo is the target codebase `./test_codebase/juice-shop-monorepo`
- OWASP dependency check baseline exists
- Existing auth flow supports token injection

## Risks

- Third-party dependency upgrades may introduce regressions
- Rate limiting may impact legitimate user traffic
- Logging volume may increase storage costs

## Success Criteria

- All OWASP Top 10 vulnerabilities in juice-shop-monorepo are addressed
- Automated security scans pass with zero high findings
- Performance regression < 5% for authenticated flows

## Open Questions

- Which OWASP dependency check tool version to use?
- Should rate limiting be per-IP or per-user?
