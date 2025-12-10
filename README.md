# MCP Servers Monorepo

A collection of Model Context Protocol (MCP) servers managed with pnpm and Turborepo.

## Structure

```
mcp/
├── packages/
│   └── openai-mcp/     # OpenAI API MCP Server
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 9.0
- Docker & Docker Compose (for running servers)

### Installation

```bash
pnpm install
pnpm build
```

## 🚀 Quick Start with CLI

### Using the MCP CLI

The project includes a CLI tool for easy server management:

```bash
# Start OpenAI MCP server (port 3500)
./mcp -m openai

# Start Gemini MCP server (port 3501)
./mcp -m gemini

# Start all servers
./mcp -m all

# Stop a server
./mcp -m openai --down

# Restart a server
./mcp -m openai --restart

# View server logs
./mcp -m openai --logs

# Show help
./mcp --help
```

Or using pnpm:

```bash
pnpm mcp -m openai
```

### Server Endpoints

| Server | Port | Health Check | SSE Endpoint |
|--------|------|--------------|--------------|
| OpenAI | 3500 | http://localhost:3500/health | http://localhost:3500/sse |
| Gemini | 3501 | http://localhost:3501/health | http://localhost:3501/sse |

### Configuration

Each server requires its API key. Create a `.env` file in each package directory:

**packages/openai-mcp/.env**
```bash
OPENAI_API_KEY=sk-your-api-key-here
```

**packages/gemini-mcp/.env**
```bash
GEMINI_API_KEY=your-api-key-here
```

### Development Mode

```bash
# Watch mode for local development
pnpm dev

# Build all packages
pnpm build
```

## Packages

| Package | Description |
|---------|-------------|
| [@mcp/openai](./packages/openai-mcp) | OpenAI API integration (GPT, DALL-E, Embeddings, TTS) |
| [@mcp/gemini](./packages/gemini-mcp) | Google Gemini API integration (Text, Chat, Vision, Embeddings) |

## 🏗️ Architecture

### Dual Mode Support

All MCP servers support two modes:

1. **stdio mode** (default): For Claude Desktop integration
2. **HTTP/SSE mode**: For external access via REST API

Set `MCP_MODE=http` environment variable to enable HTTP mode.

### Adding New MCP Servers

1. Create a new directory under `packages/`
2. Add the required `package.json` and `tsconfig.json`
3. Implement your MCP server using `@modelcontextprotocol/sdk`
4. Add HTTP/SSE support with Express
5. Create Dockerfile and docker-compose.yml
6. Update the `mcp` CLI script to include the new server

## 📚 API Documentation

### Health Check

```bash
curl http://localhost:3500/health
```

Response:
```json
{
  "status": "ok",
  "server": "openai-mcp"
}
```

### Using MCP Tools

Connect to the SSE endpoint using an MCP client or test with:

```bash
curl -X POST http://localhost:3500/sse \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'
```

## License

MIT

