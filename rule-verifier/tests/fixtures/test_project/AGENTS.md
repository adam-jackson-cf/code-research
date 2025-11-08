# Project Guidelines

This is a test project for verifying rule compliance.

## Code Style

- **Use ES6 imports** instead of require() for module loading
- **Use const/let** for variable declarations, never use var
- **Prefer async/await** over promise chains for async operations

## Testing

- **Run tests with pytest** before committing changes
- **All test files must end with** `_test.py` suffix
- Test coverage must be above 80%

## File Organization

- **Place all source code in** `src/` directory
- **Place all utility functions in** `lib/utils.py`
- Keep files under 200 lines of code

## Documentation

- **Add docstrings to all public functions**
- Use Google-style docstring format
- Include examples in docstrings for complex functions
