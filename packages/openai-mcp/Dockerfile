FROM node:22-alpine AS builder

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 루트 패키지 파일 복사
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./

# openai-mcp 패키지 파일 복사
COPY packages/openai-mcp/package.json ./packages/openai-mcp/

# 의존성 설치
RUN pnpm install --frozen-lockfile

# 소스 코드 복사
COPY packages/openai-mcp/src ./packages/openai-mcp/src
COPY packages/openai-mcp/tsconfig.json ./packages/openai-mcp/

# 빌드
RUN pnpm --filter @mcp/openai build

# Production 이미지
FROM node:22-alpine AS runner

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 루트 패키지 파일 복사
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# openai-mcp 패키지 파일 복사
COPY packages/openai-mcp/package.json ./packages/openai-mcp/

# Production 의존성만 설치
RUN pnpm install --frozen-lockfile --prod

# 빌드된 파일 복사
COPY --from=builder /app/packages/openai-mcp/dist ./packages/openai-mcp/dist

# 실행
WORKDIR /app/packages/openai-mcp

ENV NODE_ENV=production

# MCP 서버는 stdio로 통신하므로 interactive 모드로 실행
CMD ["node", "dist/index.js"]

