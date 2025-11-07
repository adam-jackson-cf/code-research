# 🏗️ Oracle Architecture

Deep dive into Oracle's architecture and design decisions.

## System Overview

Oracle is built on the Claude Agent SDK with a multi-agent orchestration pattern designed for efficiency, scalability, and context management.

```
┌─────────────────────────────────────────────────────┐
│                   User Interface                     │
│  (CLI / Programmatic API / Voice Interface)          │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│            Research Orchestrator                     │
│  • Creates research plans                            │
│  • Delegates to subagents                            │
│  • Manages workflow and state                        │
│  • Synthesizes final output                          │
└──┬───────────────┬───────────────┬──────────────────┘
   │               │               │
   ▼               ▼               ▼
┌─────────┐  ┌─────────┐  ┌─────────────┐
│ Search  │  │Analysis │  │  Synthesis  │
│Specialist│  │ Expert  │  │   Master    │
└─────────┘  └─────────┘  └─────────────┘
   │               │               │
   │ WebSearch     │ Read          │ Write
   │ WebFetch      │ Grep          │ Read
   │               │               │
   └───────────────┴───────────────┘
                   │
        ┌──────────▼──────────┐
        │   Output Formatter   │
        │  • Console Display   │
        │  • File Generation   │
        │  • Progress Tracking │
        └─────────────────────┘
```

## Core Components

### 1. Research Orchestrator

**File:** `src/orchestrator.ts`

The main agent that coordinates the entire research workflow.

**Responsibilities:**
- Research planning and strategy
- Task delegation to subagents
- Progress tracking and state management
- Result synthesis and integration
- Error handling and recovery

**Design Patterns:**
- **State Machine**: Manages phases (planning → searching → analyzing → synthesizing → completed)
- **Delegation Pattern**: Offloads specialized tasks to subagents
- **Context Efficiency**: Maintains minimal context by delegating to subagents with separate context windows

**Key Methods:**
```typescript
conductResearch(request: ResearchRequest): Promise<ResearchReport>
createResearchPlan(request: ResearchRequest): Promise<ResearchPlan>
executeSearchPhase(plan: ResearchPlan): Promise<SearchResult[]>
executeAnalysisPhase(searchResults: SearchResult[]): Promise<AnalysisResult>
executeSynthesisPhase(...): Promise<ResearchReport>
```

### 2. Subagents

**Location:** `.claude/agents/`

Specialized agents with focused responsibilities and separate context windows.

#### Search Specialist
- **Purpose**: Multi-source web research
- **Tools**: WebSearch, WebFetch
- **Context**: Independent per search task
- **Output**: Structured search results with 10+ sources

#### Analysis Expert
- **Purpose**: Critical evaluation and pattern recognition
- **Tools**: Read, Grep (for data analysis)
- **Context**: Receives search results, analyzes independently
- **Output**: Findings, contradictions, patterns, confidence assessments

#### Synthesis Master
- **Purpose**: Report generation and narrative creation
- **Tools**: Read, Write
- **Context**: Receives search and analysis results
- **Output**: Coherent research report with citations

### 3. Voice Interface

**File:** `src/voice.ts`

Handles TTS and STT using OpenAI APIs.

**Features:**
- Interactive voice planning
- Phase announcements
- Summary narration
- Interaction logging

**Design Decisions:**
- Optional dependency (graceful degradation without OpenAI key)
- Audio file persistence for review
- Transcript logging for accountability

### 4. Output Formatter

**File:** `src/formatter.ts`

Handles all output formatting and display.

**Capabilities:**
- Rich console output (colors, boxes, tables, spinners)
- Multiple export formats (Markdown, JSON, HTML)
- Progress indicators
- Source visualization

**Design Patterns:**
- **Builder Pattern**: Constructs complex outputs incrementally
- **Strategy Pattern**: Different formatting strategies per output type

### 5. CLI Interface

**File:** `src/cli.ts`

Command-line interface built with Commander.js.

**Commands:**
- `research [query]`: Conduct research
- `interactive`: Interactive mode
- `config`: Show configuration

**Design:**
- Intuitive command structure
- Comprehensive option flags
- Clear help text
- Error handling with user-friendly messages

## Data Flow

### Research Request Flow

```
1. User Input
   ↓
2. Configuration Loading
   ↓
3. Voice Planning (optional)
   ↓
4. Research Plan Creation
   │ ├─ Query analysis
   │ ├─ Sub-topic identification
   │ └─ Search strategy formulation
   ↓
5. Search Phase (Parallel)
   │ ├─ Search Specialist Agent 1
   │ ├─ Search Specialist Agent 2
   │ └─ Search Specialist Agent N
   │     ↓
   │     WebSearch + WebFetch
   │     ↓
   │     10+ sources per topic
   ↓
6. Analysis Phase
   │ ├─ Analysis Expert receives all sources
   │ ├─ Cross-validation
   │ ├─ Pattern recognition
   │ └─ Confidence assessment
   ↓
7. Synthesis Phase
   │ ├─ Synthesis Master receives analysis
   │ ├─ Report structuring
   │ ├─ Narrative development
   │ └─ Citation management
   ↓
8. Output Generation
   │ ├─ Console display
   │ ├─ File writing (MD/JSON/HTML)
   │ └─ Voice summary (optional)
   ↓
9. Completion
```

## Context Management Strategy

### Problem
Claude has a context limit. Deep research involves large amounts of information that could exceed this limit.

### Solution: Subagent Delegation

**Strategy:**
1. **Main Agent (Orchestrator)**: Maintains high-level state and delegates tasks
2. **Subagents**: Each has separate context window for focused tasks
3. **Automatic Compaction**: SDK handles context summarization when needed

**Benefits:**
- Main agent never gets overwhelmed with raw data
- Subagents can process large amounts of information independently
- Results are condensed before returning to orchestrator
- Parallel execution without context conflicts

### Example:
```
Orchestrator Context (Small):
- Research plan
- Phase status
- Condensed results from subagents

Search Specialist Context (Large, Separate):
- 10+ web pages
- Extraction and analysis
- Returns: Condensed JSON summary

Analysis Expert Context (Large, Separate):
- All search results
- Cross-reference analysis
- Returns: Key findings and patterns
```

## Performance Optimizations

### 1. Parallel Execution
Subagents can run concurrently for independent tasks:
```typescript
// Multiple search specialists work in parallel
const results = await Promise.all([
  searchTopic1(),
  searchTopic2(),
  searchTopic3()
]);
```

### 2. Lazy Loading
Only load and process what's needed:
- Configuration on-demand
- Voice interface only when enabled
- Output formatter creates files only when needed

### 3. Caching
- SDK automatic prompt caching
- Reusable subagent definitions

### 4. Streaming (Future Enhancement)
Could add streaming responses for real-time updates.

## Extension Points

### Custom Subagents
Add new agents in `.claude/agents/`:
```markdown
---
name: fact-checker
description: Verify factual claims
tools: WebSearch, WebFetch
---
Your system prompt here.
```

### Custom Skills
Add reusable capabilities in `.claude/skills/`.

### Custom Output Formats
Extend `OutputFormatter` with new format methods.

### Integration Points
- `src/index.ts`: Programmatic API
- `src/cli.ts`: CLI commands
- Custom subagents: Drop-in via filesystem

## Design Principles

1. **Separation of Concerns**: Each component has one clear responsibility
2. **Context Efficiency**: Use subagents to manage large information sets
3. **Graceful Degradation**: Optional features (voice) don't block core functionality
4. **User Experience**: Rich feedback through formatted output and progress indicators
5. **Extensibility**: Easy to add new agents, skills, and output formats
6. **Type Safety**: Full TypeScript coverage for reliability

## Technology Stack

- **Core**: Claude Agent SDK (Anthropic)
- **Voice**: OpenAI Whisper (STT) and TTS-1 (TTS)
- **CLI**: Commander.js
- **Output**: Chalk, Boxen, Ora, cli-table3
- **Language**: TypeScript with ES2022 modules
- **Runtime**: Node.js

## Future Enhancements

1. **Streaming Responses**: Real-time output as research progresses
2. **Visualization Agent**: Generate charts and graphs
3. **Fact-Checking Agent**: Dedicated verification subagent
4. **Multi-Language Support**: Research in multiple languages
5. **Database Integration**: Store and query past research
6. **Collaborative Mode**: Multiple users, shared research sessions
7. **Custom Subagent Marketplace**: Share and discover agents

## Security Considerations

1. **API Key Management**: Environment variables, never committed
2. **Input Validation**: All user inputs validated
3. **Output Sanitization**: Safe file paths and names
4. **Rate Limiting**: Respect API rate limits
5. **Error Handling**: Graceful failure without exposing internals

## Testing Strategy (Future)

1. **Unit Tests**: Individual components
2. **Integration Tests**: Subagent interactions
3. **E2E Tests**: Full research workflows
4. **Mock APIs**: Test without actual API calls
5. **Performance Tests**: Context management efficiency

---

For implementation details, see the source code in `src/`.
