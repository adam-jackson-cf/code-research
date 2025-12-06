# Prompt Files

> Create reusable prompt templates for common tasks, accessible via slash commands in GitHub Copilot Chat.

## Overview

Prompt files (`.prompt.md`) are reusable templates that encapsulate common development tasks. They allow you to define standardized prompts with variable inputs, specific tool access, and targeted AI models, making complex or repetitive requests simple to execute.

**Key Benefits**:

- **Reusability**: Define once, use repeatedly across your workspace
- **Consistency**: Standardize how common tasks are performed
- **Simplicity**: Complex prompts become simple slash commands
- **Collaboration**: Share prompts with your team via repository
- **Flexibility**: Accept dynamic inputs through variables

## Syntax

```
/<prompt-name> [arguments]
```

### Parameters

| Parameter       | Description                                                     |
| :-------------- | :-------------------------------------------------------------- |
| `<prompt-name>` | Name derived from the filename (without `.prompt.md` extension) |
| `[arguments]`   | Optional space-separated arguments passed to the prompt         |

## File Location

Prompt files must be stored in the `.github/prompts/` directory:

```
.github/
└── prompts/
    ├── review-pr.prompt.md
    ├── add-tests.prompt.md
    ├── refactor.prompt.md
    └── generate-docs.prompt.md
```

## File Structure

Prompt files are Markdown documents with optional YAML frontmatter:

```markdown
---
description: Brief description of what this prompt does
mode: ask | edit | agent
model: claude-sonnet-4-5-20250929
tools: ["tool1", "tool2"]
---

# Prompt Instructions

Your natural language instructions here...

Use ${variable} syntax for dynamic content.
```

## Frontmatter Properties

Configure prompt behavior with YAML frontmatter:

| Property      | Type   | Required    | Description                                   | Default                 |
| :------------ | :----- | :---------- | :-------------------------------------------- | :---------------------- |
| `description` | string | Recommended | Single-sentence summary shown in autocomplete | First line of prompt    |
| `agent`       | string | No          | Execution mode: `ask`, `edit`, or `agent`     | `ask`                   |
| `model`       | string | No          | Specific AI model to use                      | Current model selection |
| `tools`       | array  | No          | Available tool bundles for this prompt        | All available tools     |

### Mode Options

| Agent   | Behavior                                            | Best For                           |
| :------ | :-------------------------------------------------- | :--------------------------------- |
| `ask`   | Conversational responses without file modifications | Questions, explanations, advice    |
| `edit`  | Direct code modifications in specified files        | Targeted code changes, refactoring |
| `agent` | Autonomous task completion with tool usage          | Complex multi-step tasks, research |

### Tool Bundles

Limit tool access to only what's needed:

| Tool Bundle       | Capabilities                          | Use When                        |
| :---------------- | :------------------------------------ | :------------------------------ |
| `githubRepo`      | Access repository structure and files | Reading code, analyzing repos   |
| `search/codebase` | Search across all workspace files     | Finding code, patterns, symbols |
| `terminal`        | Execute shell commands                | Running tests, builds, scripts  |
| `edit`            | Modify files                          | Making code changes             |

**Example** - Minimal tool set:

```yaml
tools: ["githubRepo", "search/codebase"]
```

## Variables

Reference dynamic content using `${variableName}` syntax.

### Built-in Variables

Copilot provides several built-in variables that reference current context:

| Variable             | Description                       | Example Value               |
| :------------------- | :-------------------------------- | :-------------------------- |
| `${selection}`       | Currently selected text in editor | Selected code block         |
| `${file}`            | Current file path                 | `src/components/Button.tsx` |
| `${workspaceFolder}` | Root workspace directory path     | `/Users/dev/my-project`     |

**Example** - Using built-in variables:

`.github/prompts/explain.prompt.md`:

```markdown
---
description: Explain the selected code
mode: ask
---

Explain what this code does:
```

${selection}

```

Include:
1. Purpose and functionality
2. Key logic and algorithms
3. Potential edge cases or issues
4. Suggestions for improvement
```

### Input Variables

Accept user-provided values with `${input:variableName[:placeholder]}` syntax.

**Syntax**:

- `${input:varName}` - Required input (prompt will wait for value)
- `${input:varName:placeholder}` - Input with placeholder text

**Example** - Simple input variable:

`.github/prompts/create-component.prompt.md`:

```markdown
---
description: Create a new React component
mode: agent
tools: ["edit", "githubRepo"]
---

Create a new React component named ${input:componentName}.

Requirements:

- Use TypeScript with proper interfaces
- Include JSDoc comments
- Export as named export
- Place in src/components/${input:componentName}.tsx
```

**Usage**:

```
/create-component Button
```

**Example** - Multiple input variables with placeholders:

`.github/prompts/add-endpoint.prompt.md`:

```markdown
---
description: Add a new API endpoint
mode: agent
tools: ["edit", "githubRepo", "search/codebase"]
---

Create a new ${input:method:GET} endpoint at path ${input:path:/api/resource}.

The endpoint should:

- Handle ${input:method:GET} requests
- Return JSON responses
- Include error handling
- Add input validation
- Follow existing patterns in src/server/routes/
```

**Usage**:

```
/add-endpoint POST /api/users
```

## File References

Reference workspace files using Markdown link syntax.

**Example** - Referencing specific files:

`.github/prompts/compare-implementations.prompt.md`:

```markdown
---
description: Compare two implementations
mode: ask
---

Compare the implementations in [old version](src/old-version.ts)
with [new version](src/new-version.ts).

Analyze:

1. Functional differences
2. Performance implications
3. Maintainability improvements
4. Breaking changes
```

## Linking Prompts

Create hierarchical or composite prompts by referencing other `.prompt.md` files.

**Example** - Composite workflow:

`.github/prompts/full-review.prompt.md`:

```markdown
---
description: Complete code review workflow
mode: agent
---

Perform a comprehensive code review:

1. First, run [security scan](./security-check.prompt.md)
2. Then, run [performance analysis](./performance-check.prompt.md)
3. Finally, run [test coverage check](./coverage-check.prompt.md)

Summarize all findings in a single report.
```

## Examples

### Example 1: Code Review Prompt

`.github/prompts/review.prompt.md`:

```markdown
---
description: Review code for quality and best practices
mode: ask
tools: ["githubRepo"]
---

Review the selected code for:

**Code Quality**

- Readability and maintainability
- Adherence to DRY principles
- Appropriate abstraction levels

**Best Practices**

- Error handling
- Edge case coverage
- Performance considerations
- Security vulnerabilities

**Suggestions**

- Refactoring opportunities
- Alternative approaches
- Documentation improvements

Code to review:
```

${selection}

```

```

**Usage**:

1. Select code in editor
2. Type `/review` in Copilot Chat

### Example 2: Test Generation Prompt

`.github/prompts/add-tests.prompt.md`:

```markdown
---
description: Generate comprehensive tests for selected code
mode: agent
tools: ["edit", "githubRepo", "search/codebase"]
---

Generate comprehensive tests for:
```

${selection}

```

Requirements:
- Use Vitest framework
- Follow Arrange-Act-Assert pattern
- Test happy path and edge cases
- Include error scenarios
- Mock external dependencies
- Aim for 100% coverage of the selected code
- Place test file adjacent to source: ${file}.replace('.ts', '.test.ts')

Follow existing test patterns in the codebase.
```

**Usage**:

1. Select function/class to test
2. Type `/add-tests`

### Example 3: PR Review with Arguments

`.github/prompts/review-pr.prompt.md`:

```markdown
---
description: Review a pull request by number
mode: agent
tools: ["githubRepo", "search/codebase"]
---

Review pull request #${input:prNumber}.

Focus areas:

1. **Code quality**: Maintainability, readability, best practices
2. **Testing**: Coverage, test quality, edge cases
3. **Security**: Vulnerabilities, input validation, authentication
4. **Performance**: Efficiency, scalability concerns
5. **Documentation**: Code comments, README updates

Priority: ${input:priority:normal}

Provide:

- Summary of changes
- Issues found (if any)
- Suggestions for improvement
- Approval recommendation
```

**Usage**:

```
/review-pr 123 high
```

### Example 4: Refactoring Prompt

`.github/prompts/refactor.prompt.md`:

```markdown
---
description: Refactor code to improve quality
mode: edit
tools: ["edit", "githubRepo"]
---

Refactor the following code to improve:

- Readability
- Maintainability
- Performance
- Type safety

Code to refactor:
```

${selection}

```

Guidelines:
- Extract complex logic into named functions
- Reduce cyclomatic complexity to < 10
- Add TypeScript types if missing
- Improve variable and function names
- Add JSDoc comments for public APIs
- Preserve existing functionality (no behavior changes)
```

**Usage**:

1. Select code block
2. Type `/refactor`

### Example 5: Documentation Generator

`.github/prompts/document.prompt.md`:

```markdown
---
description: Generate documentation for selected code
mode: edit
tools: ["edit"]
---

Generate comprehensive JSDoc documentation for:
```

${selection}

```

Include:
- Function/class description
- @param tags with types and descriptions
- @returns tag with type and description
- @throws tag for error cases
- @example tag with usage example
- @see tags for related functions

Follow JSDoc best practices and existing documentation style in the project.
```

**Usage**:

1. Select function/class
2. Type `/document`

### Example 6: Multi-Model Configuration

`.github/prompts/quick-fix.prompt.md`:

```markdown
---
description: Quick fix for simple issues (uses faster model)
mode: edit
model: claude-3-5-haiku-20241022
tools: ["edit"]
---

Fix the following issue: ${input:issue}

In file: ${file}

Requirements:

- Make minimal changes
- Preserve existing functionality
- Follow project code style
- Add inline comment explaining the fix
```

**Usage**:

```
/quick-fix "Remove unused import"
```

### Example 7: Complex Agent Task

`.github/prompts/feature.prompt.md`:

```markdown
---
description: Implement a new feature end-to-end
mode: agent
tools: ["edit", "githubRepo", "search/codebase", "terminal"]
---

Implement the following feature: ${input:featureDescription}

**Implementation Steps**:

1. **Research**: Analyze existing codebase to understand patterns
2. **Plan**: Identify files to create/modify
3. **Implement**: Write production code following project standards
4. **Test**: Create comprehensive tests
5. **Verify**: Run tests and ensure they pass
6. **Document**: Update relevant documentation

**Quality Standards**:

- Follow existing architectural patterns
- Maintain type safety (TypeScript strict mode)
- Include error handling
- Write tests (minimum 80% coverage)
- Add JSDoc comments
- Follow code style guidelines

**Deliverables**:

- Implementation code
- Unit tests
- Integration tests (if applicable)
- Updated documentation
- Test run results
```

**Usage**:

```
/feature "Add user profile edit functionality"
```

## Best Practices

### Keep Prompts Focused

```markdown
❌ Bad: One mega-prompt that does everything
✅ Good: Separate prompts for distinct tasks (test, review, refactor, etc.)
```

### Provide Clear Context

```markdown
❌ Bad: "Fix the code"
✅ Good: "Fix the following code by addressing type errors while preserving functionality"
```

### Use Appropriate Modes

```markdown
✅ Use 'ask' for: Questions, explanations, advice
✅ Use 'edit' for: Direct code modifications, formatting
✅ Use 'agent' for: Multi-step tasks, research + implementation
```

### Limit Tool Access

```markdown
❌ Bad: Leave all tools available when only reading is needed
✅ Good: Specify minimal tool set: tools: ["githubRepo"]
```

### Test Your Prompts

```markdown
1. Create prompt file
2. Test with various inputs
3. Refine based on results
4. Document expected usage
5. Share with team
```

### Version Control

```markdown
✅ Commit prompt files to repository
✅ Review changes in PRs
✅ Document breaking changes
✅ Tag versions for stable prompts
```

## Troubleshooting

### Prompt Not Appearing

**Issue**: `/my-prompt` doesn't autocomplete

**Solutions**:

- Verify file is in `.github/prompts/` directory
- Check filename ends with `.prompt.md`
- Restart VS Code or reload window
- Ensure Copilot extension is updated

### Variables Not Replacing

**Issue**: `${variable}` appears literally in output

**Solutions**:

- Check variable name spelling
- Verify variable is defined (built-in or input)
- Use correct syntax: `${input:varName}` for user inputs
- Test with selection made for `${selection}`

### Tool Access Denied

**Issue**: Prompt can't perform expected actions

**Solutions**:

- Add required tools to frontmatter `tools` array
- Check tool names are correct
- Verify mode supports tool usage
- Use `mode: agent` for complex tool chains

## Prompt Discovery

**List available prompts**: Type `/` in Copilot Chat to see all available slash commands, including custom prompts.

**Autocomplete**: Start typing `/` followed by letters to filter and find prompts.

**Documentation**: Use `description` frontmatter to provide helpful autocomplete hints.

## See Also

- [Instructions](./instructions.md) - Custom instructions for Copilot
- [Agents](./agents.md) - Custom AI agent personas
- [Chat Reference](./chat-reference.md) - Built-in commands and variables
- [VS Code Docs: Prompt Files](https://code.visualstudio.com/docs/copilot/customization/prompt-files)
