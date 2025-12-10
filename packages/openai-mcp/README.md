# OpenAI MCP Server

Model Context Protocol (MCP) server for OpenAI API integration.

## Features

- **Chat Completion**: Generate responses using GPT models
- **Image Generation**: Create images with DALL-E
- **Embeddings**: Generate text embeddings for semantic search
- **Text-to-Speech**: Convert text to audio
- **Video Generation**: Create videos with Sora 2 (experimental)
- **List Models**: Retrieve available OpenAI models

## Installation

```bash
pnpm install
pnpm build
```

## Configuration

Set your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY=sk-your-api-key-here
```

Or create a `.env` file in `packages/openai-mcp/`:

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

## Usage

### Option 1: Node.js (Recommended)

#### Step 1: Build the project

```bash
# From project root
pnpm --filter @mcp/openai build
```

#### Step 2: Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openai": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/packages/openai-mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-your-actual-api-key"
      }
    }
  }
}
```

**Important**: 
- Replace `/absolute/path/to/mcp` with your actual path
- Replace API key with your actual key
- Restart Claude Desktop after configuration

### Option 2: Docker

#### Step 1: Build the Docker image

```bash
# From project root
docker build -t openai-mcp -f packages/openai-mcp/Dockerfile .
```

#### Step 2: Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openai": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "OPENAI_API_KEY=sk-your-actual-api-key",
        "openai-mcp"
      ]
    }
  }
}
```

**Important**: 
- Replace API key with your actual key
- The `--rm` flag automatically removes the container after use
- Restart Claude Desktop after configuration

### Option 3: Docker Compose (HTTP Mode)

For running as a standalone HTTP server:

```bash
cd packages/openai-mcp

# Create .env file
echo "OPENAI_API_KEY=sk-your-key" > .env

# Start server
docker-compose up --build -d

# Check health
curl http://localhost:3500/health
```

### Standalone Usage

```bash
# stdio mode (default)
OPENAI_API_KEY=sk-xxx node dist/index.js

# HTTP mode
MCP_MODE=http PORT=3500 OPENAI_API_KEY=sk-xxx node dist/index.js
```

## Available Tools

### chat_completion

Generate chat completions with conversation history.

```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "model": "gpt-5-1",
  "temperature": 0.7
}
```

### create_image

Generate images using DALL-E.

```json
{
  "prompt": "A beautiful sunset over mountains",
  "model": "dall-e-3",
  "size": "1024x1024"
}
```

### create_embedding

Create vector embeddings for text.

```json
{
  "input": "Hello, world!",
  "model": "text-embedding-3-large"
}
```

### text_to_speech

Convert text to audio.

```json
{
  "input": "Hello, this is a test.",
  "voice": "nova",
  "model": "tts-1"
}
```

### list_models

List all available OpenAI models (no parameters required).

## Docker

### Build

```bash
# 프로젝트 루트에서 실행
docker build -t openai-mcp -f packages/openai-mcp/Dockerfile .
```

### Run

```bash
# stdio 모드로 실행 (MCP 클라이언트 연결용)
docker run -i --rm \
  -e OPENAI_API_KEY=sk-your-api-key \
  openai-mcp
```

### Docker Compose

```bash
cd packages/openai-mcp

# .env 파일에 OPENAI_API_KEY 설정 후
docker-compose up --build
```

### Claude Desktop with Docker

```json
{
  "mcpServers": {
    "openai": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "OPENAI_API_KEY=sk-your-api-key", "openai-mcp"]
    }
  }
}
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

## License

MIT

