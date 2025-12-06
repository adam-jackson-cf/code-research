# GitHub Copilot Chat Reference

> Quick reference for built-in slash commands, chat participants, and context variables in GitHub Copilot Chat.

## Overview

GitHub Copilot Chat provides built-in commands, participants, and variables that help you communicate more effectively with the AI. These features allow you to:

- Execute common tasks quickly with slash commands
- Access domain-specific expertise with chat participants
- Provide precise context with variables

## Slash Commands

Slash commands are predefined shortcuts for common development tasks. To use a slash command, type `/` in the chat prompt box, followed by the command name.

### Syntax

```
/<command-name> [optional arguments]
```

### Built-in Commands

| Command           | Purpose                          | Example                           |
| :---------------- | :------------------------------- | :-------------------------------- |
| `/clear`          | Clear chat history               | `/clear`                          |
| `/doc`            | Add documentation comments       | `/doc` (with code selected)       |
| `/explain`        | Explain selected code            | `/explain`                        |
| `/feedback`       | Provide feedback on Copilot      | `/feedback`                       |
| `/fix`            | Suggest fixes for errors         | `/fix` (with error selected)      |
| `/fixTestFailure` | Find and fix failing tests       | `/fixTestFailure`                 |
| `/generate`       | Generate new code                | `/generate a login form`          |
| `/help`           | Get help using Copilot Chat      | `/help`                           |
| `/new`            | Scaffold a new project/workspace | `/new React app with TypeScript`  |
| `/newNotebook`    | Create a new Jupyter notebook    | `/newNotebook data analysis`      |
| `/optimize`       | Improve code performance         | `/optimize` (with code selected)  |
| `/simplify`       | Simplify complex code            | `/simplify` (with code selected)  |
| `/tests`          | Generate unit tests              | `/tests` (with function selected) |

### Command Details

#### `/clear`

Clear the current chat conversation history.

**Usage**:

```
/clear
```

**Effect**: Removes all previous messages from chat, starting fresh.

#### `/doc`

Generate documentation for selected code.

**Usage**:

1. Select a function, class, or code block
2. Type `/doc` in chat

**Output**: JSDoc or language-appropriate documentation comments.

**Example**:

```typescript
// Before (selected)
function calculateTotal(items: Item[], taxRate: number) {
  return items.reduce((sum, item) => sum + item.price, 0) * (1 + taxRate)
}

// After /doc
/**
 * Calculates the total price of items including tax.
 *
 * @param items - Array of items to calculate total for
 * @param taxRate - Tax rate as a decimal (e.g., 0.08 for 8%)
 * @returns Total price including tax
 */
function calculateTotal(items: Item[], taxRate: number) {
  return items.reduce((sum, item) => sum + item.price, 0) * (1 + taxRate)
}
```

#### `/explain`

Get a detailed explanation of selected code.

**Usage**:

1. Select code to explain
2. Type `/explain` in chat

**Output**: Explanation covering:

- What the code does
- How it works
- Key concepts or patterns used
- Potential issues or improvements

#### `/fix`

Suggest fixes for code errors or issues.

**Usage**:

1. Select code with errors (or error messages)
2. Type `/fix` in chat

**Output**: Proposed fixes with explanations.

**Example**:

```typescript
// Code with error
const data = await fetchData()
console.log(data.name)
// Error: 'data' is possibly 'null'

// After /fix suggestion
const data = await fetchData()
if (data) {
  console.log(data.name)
} else {
  console.error("Failed to fetch data")
}
```

#### `/fixTestFailure`

Analyze and fix failing tests.

**Usage**:

1. Run tests and observe failures
2. Type `/fixTestFailure` with test output or selected failing test

**Output**: Analysis of why tests fail and suggested fixes.

#### `/generate`

Generate new code based on description.

**Usage**:

```
/generate [description of what to create]
```

**Examples**:

```
/generate a React component for a user profile card
/generate a utility function to debounce events
/generate a SQL query to find top 10 customers by revenue
```

#### `/new`

Scaffold a new project or workspace.

**Usage**:

```
/new [project description]
```

**Examples**:

```
/new Express API with TypeScript and MongoDB
/new React app with Vite and TailwindCSS
/new Python FastAPI project with SQLAlchemy
```

**Output**: Complete project structure with configuration files, dependencies, and starter code.

#### `/optimize`

Analyze and improve code performance.

**Usage**:

1. Select code to optimize
2. Type `/optimize` in chat

**Output**: Performance improvements with explanations of:

- What was optimized
- Expected performance impact
- Trade-offs (if any)

#### `/simplify`

Refactor complex code to be simpler and more readable.

**Usage**:

1. Select complex code
2. Type `/simplify` in chat

**Output**: Simplified version maintaining the same functionality.

**Example**:

```typescript
// Before (complex)
function processData(data) {
  let result = []
  for (let i = 0; i < data.length; i++) {
    if (data[i].active) {
      if (data[i].score > 50) {
        result.push({ name: data[i].name, score: data[i].score })
      }
    }
  }
  return result
}

// After /simplify
function processData(data) {
  return data
    .filter((item) => item.active && item.score > 50)
    .map(({ name, score }) => ({ name, score }))
}
```

#### `/tests`

Generate comprehensive tests for selected code.

**Usage**:

1. Select function, class, or module to test
2. Type `/tests` in chat

**Output**: Test suite covering:

- Happy path scenarios
- Edge cases
- Error conditions
- Mocked dependencies (if applicable)

## Chat Participants

Chat participants are specialized AI assistants accessed by prefixing `@` to the participant name. Each participant has domain-specific knowledge and capabilities.

### Syntax

```
@<participant> [your question or request]
```

### Built-in Participants

| Participant  | Expertise                        | Use When                                                                 |
| :----------- | :------------------------------- | :----------------------------------------------------------------------- |
| `@workspace` | Your open workspace and codebase | Asking about project structure, finding code, understanding architecture |
| `@terminal`  | Integrated terminal and shell    | Getting help with terminal commands, debugging shell scripts             |
| `@vscode`    | VS Code editor and features      | Learning VS Code features, configuring settings, finding commands        |

### Participant Details

#### `@workspace`

Expert in your currently open workspace, with knowledge of all files, structure, and code patterns.

**Capabilities**:

- Search across all workspace files
- Understand project architecture
- Find specific functions, classes, or patterns
- Analyze dependencies and relationships
- Suggest refactorings based on codebase patterns

**Examples**:

```
@workspace where is user authentication handled?
@workspace how do we handle database connections?
@workspace find all React components that use useEffect
@workspace what's the architecture of the API layer?
@workspace show me examples of error handling patterns
```

**Best For**:

- Codebase exploration
- Finding implementations
- Understanding project patterns
- Discovering related code

#### `@terminal`

Expert in terminal commands, shell scripting, and command-line tools.

**Capabilities**:

- Explain terminal commands
- Generate shell scripts
- Debug command errors
- Suggest command-line workflows
- Provide command alternatives

**Examples**:

```
@terminal how do I find all TypeScript files modified today?
@terminal explain this command: find . -name "*.js" -exec grep -l "TODO" {} \;
@terminal create a script to backup my database
@terminal what's the difference between && and || in bash?
@terminal how do I kill all node processes?
```

**Best For**:

- Command-line help
- Shell scripting
- Terminal troubleshooting
- DevOps tasks

#### `@vscode`

Expert in Visual Studio Code features, settings, and capabilities.

**Capabilities**:

- Explain VS Code features
- Help configure settings
- Find keyboard shortcuts
- Suggest extensions
- Troubleshoot editor issues

**Examples**:

```
@vscode how do I enable auto-save?
@vscode what's the keyboard shortcut for multi-cursor editing?
@vscode recommend extensions for Python development
@vscode how do I configure custom tasks?
@vscode why isn't my debugger working?
```

**Best For**:

- Learning VS Code
- Editor configuration
- Productivity tips
- Troubleshooting editor issues

## Context Variables

Context variables (prefixed with `#`) allow you to precisely specify what code or files to reference in your prompts.

### Syntax

```
#<variable> [your question or request]
```

### Built-in Variables

| Variable     | References                | Example                                 |
| :----------- | :------------------------ | :-------------------------------------- |
| `#file`      | Currently active file     | `#file explain this file`               |
| `#selection` | Currently selected code   | `#selection why is this inefficient?`   |
| `#editor`    | Content of active editor  | `#editor find potential bugs`           |
| `#codebase`  | Entire workspace/codebase | `#codebase how is logging implemented?` |
| `#git`       | Git repository info       | `#git what changed in the last commit?` |

### Variable Details

#### `#file`

Reference the currently active file.

**Examples**:

```
#file what does this file do?
#file are there any security issues?
#file suggest improvements
#file add error handling
```

#### `#selection`

Reference the currently selected code in the editor.

**Examples**:

```
#selection explain what this does
#selection how can I optimize this?
#selection generate tests for this
#selection refactor to use async/await
```

**Note**: Most slash commands implicitly use `#selection` when code is selected.

#### `#editor`

Reference the full content of the active editor.

**Examples**:

```
#editor summarize this file
#editor find all TODOs
#editor check for best practice violations
```

#### `#codebase`

Reference the entire workspace/codebase for broader searches.

**Examples**:

```
#codebase find all API endpoints
#codebase how is authentication implemented?
#codebase show me the database schema
#codebase what testing frameworks are used?
```

**Note**: Similar to `@workspace` but explicitly searches code rather than invoking the workspace participant.

#### `#git`

Reference Git repository information.

**Examples**:

```
#git what changed recently?
#git explain the last commit
#git who modified this file?
#git show recent branches
```

### Filename References

You can also reference specific files or folders by name:

```
#filename explain src/utils/helpers.ts
#foldername what's in the components/ directory?
```

**Examples**:

```
#file:src/App.tsx what does the main component do?
#folder:src/features/auth/ explain the authentication flow
```

## Combining Features

Combine commands, participants, and variables for powerful queries.

### Examples

**Using participant + variable**:

```
@workspace #file where is this component used?
@workspace #selection find similar code patterns
@terminal #git what command shows the diff for this commit?
```

**Using command + variable**:

```
/explain #file
/tests #selection
/optimize #editor
```

**Using participant + file reference**:

```
@workspace compare src/old.ts with src/new.ts
@workspace how does components/Button.tsx relate to components/Input.tsx?
```

## Quick Reference: Common Tasks

| Task                       | Command                          |
| :------------------------- | :------------------------------- |
| Understand unfamiliar code | `/explain` (with code selected)  |
| Fix an error               | `/fix` (with error selected)     |
| Add documentation          | `/doc` (with function selected)  |
| Generate tests             | `/tests` (with code selected)    |
| Improve performance        | `/optimize` (with code selected) |
| Simplify complex code      | `/simplify` (with code selected) |
| Find code in workspace     | `@workspace where is [feature]?` |
| Learn VS Code feature      | `@vscode how do I [task]?`       |
| Get terminal help          | `@terminal how do I [task]?`     |
| Create new project         | `/new [description]`             |
| Generate new code          | `/generate [description]`        |
| Start fresh conversation   | `/clear`                         |

## Prompt Engineering Tips

### Be Specific with Context

```markdown
❌ Vague: "Fix this"
✅ Specific: "/fix prevent null reference error"

❌ Vague: "@workspace find users"
✅ Specific: "@workspace where is user authentication logic?"
```

### Use Appropriate Participants

```markdown
✅ Code questions: @workspace
✅ Terminal help: @terminal
✅ Editor help: @vscode
```

### Combine Variables for Precision

```markdown
✅ "@workspace #file where is this imported?"
✅ "@workspace #selection find usages"
```

### Iterate and Refine

```markdown
1. Start broad: "@workspace how does auth work?"
2. Drill down: "#file:src/auth/login.ts explain the login flow"
3. Get specific: "#selection why is this validation needed?"
```

## IDE Compatibility

| Feature                 | VS Code | GitHub.com | JetBrains | Visual Studio |
| :---------------------- | :------ | :--------- | :-------- | :------------ |
| Slash commands          | ✅      | ✅         | ✅        | ✅            |
| `@workspace`            | ✅      | ✅         | ✅        | ✅            |
| `@terminal`             | ✅      | ❌         | ✅        | ✅            |
| `@vscode`               | ✅      | ❌         | ❌        | ❌            |
| Context variables (`#`) | ✅      | ✅         | ✅        | ✅            |
| File references         | ✅      | ✅         | ✅        | ✅            |

## See Also

- [Instructions](./instructions.md) - Custom instructions for Copilot
- [Prompts](./prompts.md) - Reusable prompt templates
- [Agents](./agents.md) - Custom AI agent personas
- [GitHub Docs: Copilot Chat Cheat Sheet](https://docs.github.com/en/copilot/reference/cheat-sheet)
- [VS Code Docs: Copilot Chat](https://code.visualstudio.com/docs/copilot/copilot-chat)
