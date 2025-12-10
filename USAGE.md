# MCP Server Usage Guide

## Quick Start

### 1. Setup Environment

Create `.env` files for each server:

```bash
# OpenAI
echo "OPENAI_API_KEY=sk-your-key" > packages/openai-mcp/.env

# Gemini
echo "GEMINI_API_KEY=your-key" > packages/gemini-mcp/.env
```

### 2. Start Servers

```bash
# Start OpenAI server on port 3500
./mcp -m openai

# Start Gemini server on port 3501
./mcp -m gemini

# Or start all servers
./mcp -m all
```

### 3. Verify Servers

```bash
# Check OpenAI server
curl http://localhost:3500/health

# Check Gemini server
curl http://localhost:3501/health
```

## CLI Commands

### Start Server
```bash
./mcp -m openai           # Start in background
./mcp -m gemini
./mcp -m all              # Start all servers
```

### Stop Server
```bash
./mcp -m openai -d        # or --down
./mcp -m gemini -d
./mcp -m all -d           # Stop all servers
```

### Restart Server
```bash
./mcp -m openai -r        # or --restart
./mcp -m gemini -r
```

### View Logs
```bash
./mcp -m openai -l        # or --logs
./mcp -m gemini -l
```

## Using with Claude Desktop

### stdio Mode (Default)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openai": {
      "command": "node",
      "args": ["/path/to/mcp/packages/openai-mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-your-key"
      }
    },
    "gemini": {
      "command": "node",
      "args": ["/path/to/mcp/packages/gemini-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-key"
      }
    }
  }
}
```

### HTTP Mode (Docker)

```json
{
  "mcpServers": {
    "openai": {
      "command": "docker",
      "args": ["run", "-i", "--rm", 
               "-e", "OPENAI_API_KEY=sk-your-key",
               "-e", "MCP_MODE=http",
               "-p", "3500:3500",
               "openai-mcp"]
    }
  }
}
```

## API Examples

### List Available Tools

```bash
# OpenAI tools
curl -X POST http://localhost:3500/sse \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list", "params": {}}'

# Gemini tools
curl -X POST http://localhost:3501/sse \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list", "params": {}}'
```

### Call a Tool

```bash
# Generate image with DALL-E
curl -X POST http://localhost:3500/sse \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_image",
      "arguments": {
        "prompt": "A beautiful sunset over mountains",
        "model": "dall-e-3"
      }
    }
  }'

# Generate text with Gemini
curl -X POST http://localhost:3501/sse \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "generate_content",
      "arguments": {
        "prompt": "Explain quantum computing",
        "model": "gemini-3.0-pro"
      }
    }
  }'
```

## Troubleshooting

### Server won't start

1. Check if port is already in use:
   ```bash
   lsof -i :3500  # OpenAI
   lsof -i :3501  # Gemini
   ```

2. Check Docker is running:
   ```bash
   docker ps
   ```

3. Check logs:
   ```bash
   ./mcp -m openai -l
   ```

### API Key Issues

1. Verify `.env` file exists in package directory
2. Check API key format:
   - OpenAI: `sk-...`
   - Gemini: Get from https://aistudio.google.com/apikey

### Docker Build Issues

```bash
# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Development

### Local Development (without Docker)

```bash
# Terminal 1: Start OpenAI server
cd packages/openai-mcp
export OPENAI_API_KEY=sk-xxx
export MCP_MODE=http
export PORT=3500
node dist/index.js

# Terminal 2: Start Gemini server
cd packages/gemini-mcp
export GEMINI_API_KEY=xxx
export MCP_MODE=http
export PORT=3501
node dist/index.js
```

### Watch Mode

```bash
# Auto-rebuild on file changes
pnpm dev
```

## Port Configuration

| Server | Default Port | Environment Variable |
|--------|--------------|---------------------|
| OpenAI | 3500 | `PORT=3500` |
| Gemini | 3501 | `PORT=3501` |

To change ports:

1. Update `docker-compose.yml`
2. Update `mcp` CLI script
3. Set `PORT` environment variable

