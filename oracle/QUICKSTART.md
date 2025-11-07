# 🚀 Quick Start Guide

Get started with Oracle Research Assistant in 5 minutes!

## Step 1: Installation

```bash
cd oracle
npm install
```

## Step 2: Configuration

Create `.env` file:

```bash
cp .env.example .env
```

Add your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Optional - Add OpenAI key for voice features:

```env
OPENAI_API_KEY=sk-...
```

## Step 3: Run Your First Research

```bash
npm run research "latest developments in artificial intelligence"
```

That's it! Oracle will:
1. 📋 Create a research plan
2. 🔍 Search for 10+ sources
3. 🧠 Analyze findings
4. ✨ Generate a comprehensive report
5. 💾 Save to `./output/`

## Try These Commands

### Interactive Mode
```bash
npm run research interactive
```

### Voice Planning
```bash
npm run research -- --voice
```

### Custom Output
```bash
npm run research "climate change" --format html --output ./my-reports
```

### Check Config
```bash
npm run research config
```

## Example Output

```
╔═══════════════════════════════════════╗
║   🔮  ORACLE RESEARCH ASSISTANT  🔮   ║
╚═══════════════════════════════════════╝

📋 Research Plan
─────────────────────────────────────────
🎯 Main Topic: Latest Developments in AI
🔍 Sub-Topics:
  1. Large Language Models
  2. Computer Vision
  3. Ethical AI
  ...

🔍 Searching... (30%)
🧠 Analyzing... (60%)
✨ Synthesizing... (80%)

✨ Research Complete!
═════════════════════════════════════════

💾 Report saved: ./output/2025-11-07_latest-developments-in-ai.md
```

## Programmatic Usage

```typescript
import { research } from 'oracle-research-assistant';

const report = await research('quantum computing', {
  anthropicApiKey: 'your-key',
  minSources: 15
});

console.log(report.executiveSummary);
```

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [examples/](examples/) for advanced usage
- Explore [.claude/agents/](.claude/agents/) to customize subagents

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
Make sure your `.env` file exists and contains a valid API key.

### Voice features not working
Voice requires an OpenAI API key. Add `OPENAI_API_KEY` to your `.env` file.

### Build errors
```bash
npm install
npm run build
```

## Support

- 📖 Documentation: [README.md](README.md)
- 💡 Examples: [examples/](examples/)
- 🐛 Issues: GitHub Issues

Happy researching! 🔮
