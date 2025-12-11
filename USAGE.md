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

### 방법 1: stdio Mode (간단한 설정)

매번 새 프로세스를 실행하는 방식입니다.

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

### 방법 2: HTTP Mode + mcp-remote (권장 - 프로덕션용)

이미 실행 중인 MCP 서버에 연결하는 방식입니다. **빠르고 리소스 효율적**입니다.

#### Step 1: 서버 시작 (한 번만)

```bash
# 환경 변수 설정
echo "OPENAI_API_KEY=sk-your-key" > packages/openai-mcp/.env
echo "GEMINI_API_KEY=your-key" > packages/gemini-mcp/.env

# 서버 시작
./mcp -m all

# 또는 개별 시작
./mcp -m openai
./mcp -m gemini
```

#### Step 2: 서버 상태 확인

```bash
curl http://localhost:3500/health  # OpenAI
curl http://localhost:3501/health  # Gemini
```

#### Step 3: Claude Desktop 설정

```json
{
  "mcpServers": {
    "openai": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3500/mcp"]
    },
    "gemini": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3501/mcp"]
    }
  }
}
```

**장점:**
- ✅ 빠른 연결 (서버가 이미 실행 중)
- ✅ 리소스 절약 (매번 새 컨테이너를 띄우지 않음)
- ✅ 상태 유지
- ✅ 다중 클라이언트 연결 가능

### 방법 3: Docker (매번 새 컨테이너)

매번 새 Docker 컨테이너를 실행합니다.

```json
{
  "mcpServers": {
    "openai": {
      "command": "docker",
      "args": ["run", "-i", "--rm", 
               "-e", "OPENAI_API_KEY=sk-your-key",
               "openai-mcp"]
    }
  }
}
```

### 비교표

| 방법 | 장점 | 단점 |
|-----|-----|-----|
| **stdio (Node.js)** | 설정 간단 | 매번 새 프로세스 |
| **HTTP + mcp-remote** | 빠름, 리소스 절약 | 서버를 미리 띄워야 함 |
| **Docker (매번 실행)** | 독립 환경 | 느린 시작, 리소스 사용 |

## API Examples

### List Available Tools

```bash
# OpenAI tools
curl -X POST http://localhost:3500/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'

# Gemini tools
curl -X POST http://localhost:3501/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

### Call a Tool

```bash
# Generate image with GPT Image 1
curl -X POST http://localhost:3500/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_image",
      "arguments": {
        "prompt": "A beautiful sunset over mountains",
        "model": "gpt-image-1"
      }
    }
  }'

# Generate text with Gemini
curl -X POST http://localhost:3501/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "generate_content",
      "arguments": {
        "prompt": "Explain quantum computing",
        "model": "gemini-2.0-flash-exp"
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

