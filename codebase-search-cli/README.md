# Codebase Search CLI

A powerful command-line tool for semantic codebase search using Google's Gemini API. This tool enables developers to index their codebase and perform intelligent searches based on both intent and specific phrases, powered by Retrieval Augmented Generation (RAG).

## Features

- **Semantic Search**: Search your codebase by intent or specific phrases using AI-powered semantic understanding
- **File Search Integration**: Leverages Google Gemini's File Search API for fast, accurate retrieval
- **Flexible Indexing**: Index entire directories or specific files with customizable patterns
- **Metadata Filtering**: Filter search results by file extension or custom metadata
- **Easy Configuration**: Simple environment-based configuration
- **Rich CLI Interface**: Beautiful, user-friendly command-line interface powered by Typer and Rich

## Installation

### Prerequisites

- Python 3.9 or higher
- Google API key with Gemini API access ([Get one here](https://aistudio.google.com/app/apikey))

### Install from Source

```bash
# Clone or navigate to the project directory
cd codebase-search-cli

# Create a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install the package
pip install -e .
```

### For Development

```bash
# Install with development dependencies
pip install -e ".[dev]"
```

## Configuration

1. Create a `.env` file in your project directory:

```bash
cp .env.example .env
```

2. Add your Google API key to the `.env` file:

```env
GOOGLE_API_KEY=your_google_api_key_here
```

### Optional Configuration

You can customize the following settings in your `.env` file:

```env
# Model to use (default: gemini-2.0-flash-exp)
MODEL_NAME=gemini-2.0-flash-exp

# Chunking configuration for indexing
MAX_TOKENS_PER_CHUNK=500
MAX_OVERLAP_TOKENS=50
```

## Usage

### Initialize a File Search Store

Before indexing files, you need to create a file search store:

```bash
codebase-search init --name "my-project"
```

Options:
- `--name, -n`: Name for the file search store (required)
- `--force, -f`: Force recreate if a store already exists

### Index Your Codebase

Index files from your codebase directory:

```bash
# Index a directory (recursively by default)
codebase-search index /path/to/codebase

# Index specific file patterns
codebase-search index /path/to/codebase --pattern "*.py" --pattern "*.js"

# Exclude specific directories
codebase-search index /path/to/codebase --exclude "node_modules" --exclude ".git"

# Index a single file
codebase-search index /path/to/file.py

# Non-recursive indexing
codebase-search index /path/to/codebase --no-recursive
```

**Default file patterns** (when no patterns specified):
- Python: `*.py`
- JavaScript/TypeScript: `*.js`, `*.ts`, `*.jsx`, `*.tsx`
- Java: `*.java`
- Go: `*.go`
- Rust: `*.rs`
- C/C++: `*.c`, `*.cpp`, `*.h`, `*.hpp`
- C#: `*.cs`
- Ruby: `*.rb`
- PHP: `*.php`
- Swift: `*.swift`
- Kotlin: `*.kt`
- Scala: `*.scala`
- Documentation: `*.md`, `*.txt`

**Default excluded directories**:
- `.git`, `node_modules`, `__pycache__`, `.venv`, `venv`, `dist`, `build`

### Search Your Codebase

Perform semantic searches on your indexed codebase:

```bash
# Search by intent
codebase-search search "find authentication logic"

# Search by specific phrase
codebase-search search "how to connect to database"

# Filter by file extension
codebase-search search "find API endpoints" --filter-ext ".py"

# Control number of results
codebase-search search "error handling" --top-k 10

# Hide sources in output
codebase-search search "logging implementation" --no-sources
```

### List Indexed Files

View all files in your file search store:

```bash
codebase-search list-files
```

### View Configuration

Display your current configuration:

```bash
codebase-search info
```

### Clear File Search Store

Delete the current file search store:

```bash
# With confirmation prompt
codebase-search clear

# Skip confirmation
codebase-search clear --yes
```

## Examples

### Example Workflow

```bash
# 1. Initialize a store for your project
codebase-search init --name "my-awesome-project"

# 2. Index your Python codebase
codebase-search index ./src --pattern "*.py"

# 3. Search for authentication code
codebase-search search "how does user authentication work?"

# 4. Find all database query functions
codebase-search search "functions that query the database" --filter-ext ".py"

# 5. List all indexed files
codebase-search list-files
```

### Intent-Based Search Examples

```bash
# Find specific functionality
codebase-search search "where is the payment processing logic?"

# Understand implementation
codebase-search search "how are errors handled in API requests?"

# Locate patterns
codebase-search search "find all async functions"

# Discover dependencies
codebase-search search "what libraries are used for database connections?"
```

### Phrase-Based Search Examples

```bash
# Find specific code patterns
codebase-search search "def authenticate"

# Locate imports
codebase-search search "import requests"

# Find class definitions
codebase-search search "class UserModel"
```

## Development

### Running Tests

```bash
# Run unit tests only (no API key required)
pytest tests/ --ignore=tests/test_integration.py

# Run all tests including integration tests (requires API key)
export GOOGLE_API_KEY=your_api_key
pytest tests/

# Run with coverage
pytest tests/ --cov=src/codebase_search_cli --cov-report=html
```

### Code Formatting

```bash
# Format code with black
black src/ tests/

# Lint with ruff
ruff check src/ tests/
```

### Type Checking

```bash
mypy src/
```

## Architecture

The tool is built with the following components:

- **`config.py`**: Configuration management using Pydantic Settings
- **`gemini_client.py`**: Wrapper around Google Gemini API for file search operations
- **`main.py`**: Typer-based CLI interface with Rich formatting

### How It Works

1. **Initialization**: Creates a File Search store in Google's infrastructure
2. **Indexing**:
   - Files are uploaded to the File Search store
   - Content is automatically chunked and embedded using `gemini-embedding-001`
   - Metadata (file path, extension) is attached for filtering
3. **Searching**:
   - Query is converted to embeddings
   - Semantic search finds most relevant chunks
   - Results are returned with grounding metadata showing sources

## API Costs

Google Gemini API pricing (as of documentation):

- **Indexing**: $0.15 per 1M tokens
- **Storage**: Free
- **Query embeddings**: Free
- **Retrieved tokens**: Charged as context tokens

Free tier includes 1 GB of total storage.

## Troubleshooting

### "No file search store initialized"

Run `codebase-search init --name "my-store"` to create a store first.

### API Key Issues

- Ensure your `.env` file is in the directory where you run the command
- Verify your API key is valid and has Gemini API access enabled
- Check that the key is correctly set: `codebase-search info`

### No Results Found

- Verify files are indexed: `codebase-search list-files`
- Try broader search queries
- Check if metadata filters are too restrictive
- Re-index your codebase if files were recently added

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development Setup

1. Fork the repository
2. Clone your fork
3. Install development dependencies: `pip install -e ".[dev]"`
4. Make your changes
5. Run tests: `pytest tests/`
6. Submit a pull request

## License

This project is open source. See LICENSE file for details.

## Acknowledgments

- Built with [Typer](https://typer.tiangolo.com/) for the CLI interface
- Uses [Rich](https://rich.readthedocs.io/) for beautiful terminal output
- Powered by [Google Gemini API](https://ai.google.dev/gemini-api/docs/file-search) for semantic search
