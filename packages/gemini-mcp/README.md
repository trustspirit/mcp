# Gemini MCP Server

Model Context Protocol (MCP) server for Google Gemini API integration.

## Features

- **Generate Content**: Generate text using Gemini models
- **Chat**: Multi-turn conversations with history support
- **Web Search**: Search the web and get AI-generated answers using Gemini models
- **Embeddings**: Generate text embeddings for semantic search
- **Count Tokens**: Count tokens in text
- **Analyze Image**: Vision capabilities for image analysis
- **Generate Image**: Create images with Imagen 3 (experimental)
- **Create Video**: Create videos with Veo 2 (experimental)
- **List Models**: List available Gemini models

## Installation

```bash
pnpm install
pnpm build
```

## Configuration

Set your Gemini API key as an environment variable:

```bash
export GEMINI_API_KEY=your-api-key-here
```

Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

Or create a `.env` file in `packages/gemini-mcp/`:

```bash
GEMINI_API_KEY=your-api-key-here
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": ["/path/to/mcp/packages/gemini-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Standalone

```bash
GEMINI_API_KEY=xxx node dist/index.js
```

## Available Tools

### generate_content

Generate text content from a prompt.

```json
{
  "prompt": "Explain quantum computing in simple terms",
  "model": "gemini-2.0-flash-exp",
  "temperature": 0.7,
  "maxOutputTokens": 1000
}
```

### chat

Multi-turn conversation with history.

```json
{
  "messages": [
    { "role": "user", "content": "Hello, who are you?" },
    { "role": "model", "content": "I'm Gemini, an AI assistant." },
    { "role": "user", "content": "What can you help me with?" }
  ],
  "model": "gemini-2.0-flash-exp",
  "systemInstruction": "You are a helpful coding assistant"
}
```

### embed_content

Generate embeddings for text.

```json
{
  "content": "Hello, world!",
  "model": "text-embedding-004",
  "taskType": "SEMANTIC_SIMILARITY"
}
```

### count_tokens

Count tokens in text.

```json
{
  "content": "How many tokens is this sentence?",
  "model": "gemini-2.0-flash-exp"
}
```

### analyze_image

Analyze an image with vision capabilities.

```json
{
  "imageUrl": "https://example.com/image.jpg",
  "prompt": "What objects are in this image?",
  "model": "gemini-2.0-flash-exp"
}
```

### web_search

Search the web and get AI-generated answers using Gemini's **Google Search Grounding**. This feature uses Google's built-in search capabilities - no external API keys required!

```json
{
  "query": "What are the latest developments in AI?",
  "model": "gemini-2.0-flash-exp"
}
```

**Parameters:**
- `query` (required): The search query
- `model` (optional): Gemini model to use (default: "gemini-2.0-flash-exp")

**Note:** This uses Google Search Grounding built into Gemini API - no additional API keys needed!

### list_models

List available Gemini models (no parameters required).

## Docker

### Build

```bash
# 프로젝트 루트에서 실행
docker build -t gemini-mcp -f packages/gemini-mcp/Dockerfile .
```

### Run

```bash
docker run -i --rm \
  -e GEMINI_API_KEY=your-api-key \
  gemini-mcp
```

### Docker Compose

```bash
cd packages/gemini-mcp

# .env 파일에 GEMINI_API_KEY 설정 후
docker-compose up --build
```

### Claude Desktop with Docker

```json
{
  "mcpServers": {
    "gemini": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GEMINI_API_KEY=your-api-key", "gemini-mcp"]
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

