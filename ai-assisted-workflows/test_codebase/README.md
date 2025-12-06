# Test Codebase Documentation

This directory contains test applications used for validating the AI-Assisted Workflows analysis tools.

## Directory Structure

### Primary Test Target

**`juice-shop-monorepo/`** - OWASP Juice Shop

- **Purpose**: Main test target for comprehensive analysis
- **Technology**: Full-stack TypeScript/JavaScript application (Node.js, Express, Angular)
- **Content**: Intentionally vulnerable e-commerce application with documented security issues
- **Use Cases**:
  - Architecture analysis (poor separation of concerns, mixed responsibilities)
  - Performance testing (inefficient queries, memory leaks, frontend bottlenecks)
  - Security analysis (OWASP Top 10 vulnerabilities)
  - Code quality analysis (complex functions, duplication, maintainability issues)

### Specialized Test Applications

**`vulnerable-apps/`** - Language-specific vulnerable applications

- Individual applications for testing security analyzers
- Covers: Python, JavaScript, Java, C#, Go, PHP, Rust, SQL
- Each contains documented vulnerabilities for validation

**`clean-apps/`** - Clean code examples

- Well-written applications for false positive testing
- Ensures analyzers don't flag clean code as problematic

**`code-quality-issues/`** - Code quality test cases

- Applications with specific quality issues (duplication, complexity)
- Used for testing quality analyzers

## Usage

### Running Analysis on Primary Target

```bash
# From repo root (registry-based, in-process)
PYTHONPATH=shared NO_EXTERNAL=true python shared/tests/integration/test_all_analyzers.py test_codebase/juice-shop-monorepo --max-files 2
# Omit NO_EXTERNAL to include analyzers requiring external tools
```

### Expected Findings in Juice Shop

The OWASP Juice Shop contains intentionally vulnerable and poorly designed code that should be detected by our analyzers:

#### Security Issues

- SQL injection vulnerabilities
- Cross-site scripting (XSS)
- Authentication bypasses
- Insecure cryptographic storage
- Sensitive data exposure

#### Architecture Problems

- Mixed concerns (business logic in routes)
- Tight coupling between components
- Inconsistent error handling
- Poor separation of data access

#### Performance Issues

- Inefficient database queries
- Memory leaks in Node.js code
- Large bundle sizes in frontend
- Blocking operations

#### Code Quality Issues

- Complex functions (high cyclomatic complexity)
- Code duplication across modules
- Long parameter lists
- Inconsistent naming conventions

## Validation Approach

The test codebase directory serves multiple validation purposes:

1. **Functional Testing**: Verify analyzers correctly identify known issues
2. **False Positive Testing**: Ensure clean code doesn't trigger false alarms
3. **Performance Testing**: Validate analyzers can handle real-world codebases
4. **Integration Testing**: Test complete analysis pipeline with realistic projects

## Maintenance

- Juice Shop is updated periodically to include new vulnerability patterns
- Vulnerable apps are maintained with documented issues for regression testing
- Clean apps serve as negative test cases to prevent false positives
