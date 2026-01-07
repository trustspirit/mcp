# Serena MCP Server

Model Context Protocol (MCP) server for semantic code analysis, inspired by [Serena](https://github.com/oraios/serena).

## Features

- **Symbol Analysis**: Extract and analyze functions, classes, interfaces, and more
- **Code Search**: Search for patterns across the codebase
- **Reference Finding**: Find all references to symbols
- **Code Structure**: Understand imports, exports, and dependencies
- **Code Editing**: Insert, delete, and replace code programmatically
- **Workspace Analysis**: Get workspace statistics and language detection

## Installation

```bash
pnpm install
pnpm build
```

## Port Configuration

Serena MCP uses port **3502** by default to avoid conflicts with other MCP servers:

| MCP Server | Default Port |
| ---------- | ------------ |
| openai-mcp | 3500         |
| gemini-mcp | 3501         |
| serena-mcp | 3502         |

## Configuration

Set your workspace path as an environment variable:

```bash
export SERENA_WORKSPACE=/path/to/your/project
```

Or it will default to the current working directory.

## Usage

### Option 1: Node.js (Recommended)

#### Step 1: Build the project

```bash
# From project root
pnpm --filter @mcp/serena build
```

#### Step 2: Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "serena": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/packages/serena-mcp/dist/index.js"],
      "env": {
        "SERENA_WORKSPACE": "/path/to/your/project"
      }
    }
  }
}
```

**Important**:

- Replace `/absolute/path/to/mcp` with your actual path
- Replace workspace path with your project path
- Restart Claude Desktop after configuration

### Option 2: Docker

#### Step 1: Build the Docker image

```bash
# From project root
docker build -t serena-mcp -f packages/serena-mcp/Dockerfile .
```

#### Step 2: Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "serena": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/path/to/your/project:/workspace:ro",
        "-e",
        "SERENA_WORKSPACE=/workspace",
        "serena-mcp"
      ]
    }
  }
}
```

**Important**:

- Replace `/path/to/your/project` with your actual project path
- The `:ro` flag mounts the volume as read-only for safety
- Restart Claude Desktop after configuration

### Option 3: HTTP Mode with mcp-remote (Recommended for Production)

이미 실행 중인 MCP 서버에 연결하는 방식입니다. 매번 새 컨테이너를 띄우지 않아 **빠르고 리소스 효율적**입니다.

#### Step 1: Start the server (once)

```bash
cd packages/serena-mcp

# Set workspace path
echo "WORKSPACE_PATH=/path/to/your/project" > .env

# Start server in background
docker-compose up --build -d

# Verify server is running
curl http://localhost:3502/health
```

#### Step 2: Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "serena": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3502/mcp"]
    }
  }
}
```

**장점:**

- ✅ 빠른 연결 (서버가 이미 실행 중)
- ✅ 리소스 절약 (매번 새 컨테이너를 띄우지 않음)
- ✅ 상태 유지
- ✅ 다중 클라이언트 연결 가능

### Standalone Usage

```bash
# stdio mode (default)
SERENA_WORKSPACE=/path/to/project node dist/index.js

# HTTP mode
MCP_MODE=http PORT=3502 SERENA_WORKSPACE=/path/to/project node dist/index.js
```

## Available Tools

### Symbol Analysis

#### get_symbols_overview

Get an overview of all symbols in a directory.

```json
{
  "directory": "src",
  "file_pattern": "**/*.ts",
  "include_private": false
}
```

#### find_symbol

Find a symbol by name across the codebase.

```json
{
  "symbol_name": "MyClass",
  "directory": "src",
  "exact_match": true
}
```

#### get_symbol_details

Get detailed information about a specific symbol.

```json
{
  "file_path": "src/index.ts",
  "symbol_name": "main",
  "include_references": true
}
```

### Code Search

#### search_code

Search for patterns across files.

```json
{
  "query": "TODO",
  "directory": "src",
  "case_sensitive": false,
  "max_results": 50
}
```

#### find_references

Find all references to a symbol.

```json
{
  "symbol_name": "handleRequest",
  "file_pattern": "**/*.ts"
}
```

### File Operations

#### get_file_content

Read file content with optional line range.

```json
{
  "file_path": "src/index.ts",
  "start_line": 1,
  "end_line": 50
}
```

#### get_directory_structure

Get the directory structure as a tree.

```json
{
  "directory": "src",
  "max_depth": 3,
  "include_hidden": false
}
```

### Module Analysis

#### get_imports

Get all import statements from a file.

```json
{
  "file_path": "src/index.ts"
}
```

#### get_exports

Get all exports from a file.

```json
{
  "file_path": "src/index.ts"
}
```

### Type Analysis

#### get_function_signature

Get the signature of a function.

```json
{
  "file_path": "src/utils.ts",
  "function_name": "processData"
}
```

#### get_class_info

Get detailed information about a class.

```json
{
  "file_path": "src/models.ts",
  "class_name": "User"
}
```

### Code Quality

#### analyze_code

Analyze a file for code quality metrics.

```json
{
  "file_path": "src/complex.ts",
  "analysis_type": "all"
}
```

Returns:

- **complexity**: Cyclomatic complexity and nesting depth
- **dependencies**: List of imports
- **issues**: Code quality issues (long lines, console.log, TODO, any types)

### Code Editing

#### search_and_replace

Search and replace text in a file.

```json
{
  "file_path": "src/index.ts",
  "search_pattern": "oldFunction",
  "replace_with": "newFunction",
  "is_regex": false,
  "preview_only": true
}
```

#### insert_code

Insert code at a specific line.

```json
{
  "file_path": "src/index.ts",
  "line_number": 10,
  "code": "// New comment\nconst x = 1;"
}
```

#### delete_lines

Delete a range of lines from a file.

```json
{
  "file_path": "src/index.ts",
  "start_line": 5,
  "end_line": 10
}
```

### Workspace Information

#### get_workspace_info

Get workspace statistics and detected languages.

```json
{
  "directory": "."
}
```

## Supported Languages

- **TypeScript/JavaScript**: Full support for functions, classes, interfaces, types, enums
- **Python**: Support for functions, classes, imports

More languages can be added by extending the symbol extraction logic.

## Docker

### Build

```bash
# 프로젝트 루트에서 실행
docker build -t serena-mcp -f packages/serena-mcp/Dockerfile .
```

### Run

```bash
# stdio 모드로 실행 (MCP 클라이언트 연결용)
docker run -i --rm \
  -v /path/to/project:/workspace:ro \
  -e SERENA_WORKSPACE=/workspace \
  serena-mcp
```

### Docker Compose

```bash
cd packages/serena-mcp

# .env 파일에 WORKSPACE_PATH 설정 후
echo "WORKSPACE_PATH=/path/to/project" > .env
docker-compose up --build
```

## Development

```bash
# Watch mode
pnpm dev

# Build
pnpm build

# Run
pnpm start
```

## Comparison with Original Serena

This MCP server is inspired by the [Serena project](https://github.com/oraios/serena) but implemented as a lightweight TypeScript solution:

| Feature          | Original Serena                  | Serena MCP                         |
| ---------------- | -------------------------------- | ---------------------------------- |
| Language Servers | Full LSP support (30+ languages) | Regex-based parsing (TS/JS/Python) |
| Platform         | Python + uv                      | Node.js + TypeScript               |
| Dependencies     | Language server binaries         | None (self-contained)              |
| Installation     | Complex                          | Simple npm package                 |
| Performance      | Very accurate                    | Fast, good for most cases          |

For production use with complex codebases requiring precise semantic analysis, consider the original Serena project.

## License

MIT
