# Claude Instructions

## Command Preferences

- Use `pnpm` as the package manager instead of npm
- Run `pnpm dev` to start the development server
- Run `pnpm test` to execute tests
- Never use `yarn` or `npm` commands

## Documentation

- Add JSDoc comments to all public functions
- Include TypeScript type annotations for all parameters
- Document complex algorithms with inline comments

## Error Handling

- Always use try-catch blocks for async operations
- Log errors with descriptive messages
- Never suppress errors silently

## API Development

- Use RESTful conventions for API endpoints
- Return proper HTTP status codes (200, 400, 404, 500)
- Validate all input data before processing

## Security

- Never commit API keys or secrets
- Sanitize user input to prevent XSS attacks
- Use parameterized queries to prevent SQL injection
