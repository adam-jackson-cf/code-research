# Development Guidelines

This file contains instructions for AI agents working on this project.

## Development Server

- **Always run** `npm run dev` when starting development
- **Never run** `npm run build` in interactive sessions
- Restart the dev server after installing new dependencies

## Code Standards

- Prefer TypeScript (.tsx/.ts) for new components
- Use single quotes for strings in JavaScript/TypeScript
- Co-locate component-specific styles with components
- Follow functional component patterns with hooks

## Testing

- Run `npm run test` before committing
- Run `npm run lint` to check code style
- Ensure all tests pass before pushing code

## Git Workflow

- Create feature branches from `main`
- Use conventional commit messages (feat:, fix:, docs:, etc.)
- Run `git status` before committing to review changes

## File Organization

- Place React components in `src/components/`
- Place utility functions in `src/utils/`
- Keep test files adjacent to source files with `.test.ts` extension

## Dependencies

- Use `npm install` to add dependencies
- Update `package-lock.json` after dependency changes
- Prefer well-maintained packages with active communities
