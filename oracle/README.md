# 🔮 Oracle Research Assistant

A powerful deep research assistant powered by the Claude Agent SDK, featuring multi-agent orchestration, voice interaction, and beautiful output formatting.

## ✨ Features

- **🤖 Multi-Agent Architecture**: Specialized subagents for search, analysis, and synthesis
- **🔍 Deep Multi-Source Research**: Minimum 10 sources per topic with comprehensive coverage
- **🎤 Voice Interface**: TTS and STT for natural interaction (powered by OpenAI)
- **📊 Beautiful Output**: Custom-formatted reports in Markdown, JSON, or HTML
- **⚡ Efficient Context Management**: Automatic compaction and subagent delegation
- **🎯 Research Orchestration**: Intelligent planning and task coordination
- **📈 Progress Tracking**: Real-time status updates and progress indicators

## 🏗️ Architecture

```
Oracle Research Assistant
│
├── Research Orchestrator (Main Agent)
│   ├── Planning Phase: Creates comprehensive research plan
│   ├── Coordination: Delegates to specialized subagents
│   └── Synthesis: Combines results into final report
│
├── Specialized Subagents
│   ├── Search Specialist: Multi-source web search (10+ sources)
│   ├── Analysis Expert: Critical evaluation and fact-checking
│   └── Synthesis Master: Report generation and insight extraction
│
├── Voice Interface
│   ├── TTS: Text-to-Speech for announcements
│   └── STT: Speech-to-Text for voice planning
│
└── Output Formatter
    ├── Console: Beautiful CLI output with colors and progress
    ├── Markdown: Structured research reports
    ├── JSON: Machine-readable format
    └── HTML: Web-ready formatted reports
```

## 📦 Installation

```bash
cd oracle
npm install
```

## ⚙️ Configuration

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# Required
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional (for voice features)
OPENAI_API_KEY=your_openai_api_key_here

# Optional configuration
MIN_SOURCES_PER_TOPIC=10
MAX_SEARCH_DEPTH=3
ENABLE_VOICE=true
OUTPUT_DIR=./output
OUTPUT_FORMAT=markdown
```

## 🚀 Usage

### CLI Commands

#### Basic Research

```bash
npm run research "impact of artificial intelligence on healthcare"
```

#### With Voice Planning

```bash
npm run research -- --voice
```

#### Specify Scope and Depth

```bash
npm run research "quantum computing applications" --scope broad --depth deep
```

#### Interactive Mode

```bash
npm run research interactive
# or
npm run research i
```

#### Check Configuration

```bash
npm run research config
```

### Programmatic Usage

```typescript
import { research } from 'oracle-research-assistant';

const report = await research(
  'The future of renewable energy',
  {
    anthropicApiKey: 'your-key',
    scope: 'broad',
    depth: 'deep',
    minSources: 15,
    outputFormat: 'markdown'
  }
);

console.log(report.executiveSummary);
```

### Advanced Usage

```typescript
import {
  ResearchOrchestrator,
  VoiceInterface,
  OutputFormatter
} from 'oracle-research-assistant';

const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY,
  minSourcesPerTopic: 10,
  maxSearchDepth: 3,
  enableVoice: true,
  outputDir: './research-output',
  outputFormat: 'html' as const
};

// Create orchestrator
const orchestrator = new ResearchOrchestrator(config);

// Optional: Use voice interface
const voice = new VoiceInterface(config);
const voicePlan = await voice.conductVoicePlanning();

// Conduct research
const report = await orchestrator.conductResearch({
  query: voicePlan.query,
  scope: 'broad',
  depth: 'deep',
  useVoice: true
});

// Custom output handling
const formatter = new OutputFormatter(config);
formatter.displayReportSummary(report);
```

## 📚 Subagents

Oracle uses specialized subagents defined in `.claude/agents/`:

### Search Specialist
- Multi-source web search
- Minimum 10 sources per topic
- Source credibility assessment
- Diverse perspective coverage

### Analysis Expert
- Critical evaluation of findings
- Pattern recognition
- Fact-checking across sources
- Bias detection

### Synthesis Master
- Information integration
- Narrative development
- Insight generation
- Report structuring

## 🎤 Voice Features

When OpenAI API key is configured, Oracle supports:

### Voice Planning
Interactive voice session to define research parameters:
- Research query via speech
- Scope and depth selection
- Additional context

### Voice Announcements
- Phase transitions
- Progress updates
- Research summary

### Interaction Logging
All voice interactions are logged with:
- Transcriptions
- Audio files
- Timestamps

## 📊 Output Formats

### Markdown
Structured research report with:
- Executive summary
- Introduction
- Findings by theme
- Conclusions
- Complete bibliography

### JSON
Machine-readable format with:
- Full metadata
- Structured findings
- Source information
- Citations

### HTML
Web-ready report with:
- Professional styling
- Responsive design
- Clickable sources
- Print-friendly layout

## 🎯 Research Options

### Scope
- **narrow**: Focused on specific aspects
- **medium**: Balanced coverage (default)
- **broad**: Comprehensive exploration

### Depth
- **shallow**: Quick overview
- **medium**: Standard analysis
- **deep**: Comprehensive investigation (default)

## 📈 Progress Tracking

Oracle provides real-time feedback:

```
╔═══════════════════════════════════════╗
║   🔮  ORACLE RESEARCH ASSISTANT  🔮   ║
╚═══════════════════════════════════════╝

📋 Research Plan
─────────────────────────────────────────
🎯 Main Topic: [Your Topic]
🔍 Sub-Topics: [List of sub-topics]
...

🔍 Searching... (30%)
🧠 Analyzing... (60%)
✨ Synthesizing... (80%)
✅ Complete! (100%)
```

## 🔧 Development

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Project Structure

```
oracle/
├── .claude/
│   ├── agents/           # Subagent definitions
│   │   ├── search-specialist.md
│   │   ├── analysis-expert.md
│   │   └── synthesis-master.md
│   └── skills/           # Reusable skills (extensible)
├── src/
│   ├── types.ts          # TypeScript interfaces
│   ├── orchestrator.ts   # Main orchestration logic
│   ├── voice.ts          # TTS/STT interface
│   ├── formatter.ts      # Output formatting
│   ├── cli.ts            # CLI interface
│   └── index.ts          # Programmatic API
├── config/               # Configuration files
├── output/               # Generated reports
├── package.json
├── tsconfig.json
└── README.md
```

## 🎓 Examples

See the `examples/` directory for:
- Basic usage examples
- Advanced orchestration
- Custom subagent integration
- Voice interaction demos

## 🤝 Contributing

Contributions welcome! Areas for enhancement:
- Additional subagents (fact-checking, visualization, etc.)
- Enhanced voice features
- Custom output templates
- Integration with other APIs
- Performance optimizations

## 📄 License

MIT License

## 🙏 Acknowledgments

Built with:
- [Claude Agent SDK](https://docs.anthropic.com/en/api/agent-sdk) by Anthropic
- [OpenAI APIs](https://platform.openai.com/) for voice features
- Chalk, Boxen, Ora for beautiful CLI output

## 📞 Support

For issues and questions:
- GitHub Issues: [Report a bug]
- Documentation: [See docs]
- Examples: [View examples]

---

**🔮 Oracle Research Assistant** - Deep research powered by Claude Agent SDK
