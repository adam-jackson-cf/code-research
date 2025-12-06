# Codex SDK

**Source:** https://github.com/openai/codex/blob/main/sdk/typescript/README.md
**Scraped:** 2025-10-06

Embed the Codex agent in your workflows and apps.
The TypeScript SDK wraps the bundled `codex` binary. It spawns the CLI and exchanges JSONL events over stdin/stdout.

## Installation

```shell
npm install @openai/codex-sdk
```

Requires Node.js 18+.

## Quickstart

```ts
import { Codex } from "@openai/codex-sdk"

const codex = new Codex()
const thread = codex.startThread()
const turn = await thread.run("Diagnose the test failure and propose a fix")

console.log(turn.finalResponse)
console.log(turn.items)
```

Call `run()` repeatedly on the same `Thread` instance to continue that conversation.

```ts
const nextTurn = await thread.run("Implement the fix")
```

### Streaming responses

`run()` buffers events until the turn finishes. To react to intermediate progress—tool calls, streaming responses, and file diffs—use `runStreamed()` instead, which returns an async generator of structured events.

```ts
const { events } = await thread.runStreamed(
  "Diagnose the test failure and propose a fix",
)

for await (const event of events) {
  switch (event.type) {
    case "item.completed":
      console.log("item", event.item)
      break
    case "turn.completed":
      console.log("usage", event.usage)
      break
  }
}
```

### Resuming an existing thread

Threads are persisted in `~/.codex/sessions`. If you lose the in-memory `Thread` object, reconstruct it with `resumeThread()` and keep going.

```ts
const savedThreadId = process.env.CODEX_THREAD_ID!
const thread = codex.resumeThread(savedThreadId)
await thread.run("Implement the fix")
```

### Working directory controls

Codex runs in the current working directory by default. To avoid unrecoverable errors, Codex requires the working directory to be a Git repository. You can skip the Git repository check by passing the `skipGitRepoCheck` option when creating a thread.

```ts
const thread = codex.startThread({
  workingDirectory: "/path/to/project",
  skipGitRepoCheck: true,
})
```
