FROM node:22-alpine AS builder

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 루트 패키지 파일 복사
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./

# serena-mcp 패키지 파일 복사
COPY packages/serena-mcp/package.json ./packages/serena-mcp/

# 의존성 설치
RUN pnpm install --frozen-lockfile

# 소스 코드 복사
COPY packages/serena-mcp/src ./packages/serena-mcp/src
COPY packages/serena-mcp/tsconfig.json ./packages/serena-mcp/

# 빌드
RUN pnpm --filter @mcp/serena build

# Production 이미지
FROM node:22-alpine AS runner

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 루트 패키지 파일 복사
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# serena-mcp 패키지 파일 복사
COPY packages/serena-mcp/package.json ./packages/serena-mcp/

# Production 의존성만 설치
RUN pnpm install --frozen-lockfile --prod

# 빌드된 파일 복사
COPY --from=builder /app/packages/serena-mcp/dist ./packages/serena-mcp/dist

# 실행
WORKDIR /app/packages/serena-mcp

ENV NODE_ENV=production

# 워크스페이스 마운트 포인트
VOLUME ["/workspace"]
ENV SERENA_WORKSPACE=/workspace

# MCP 서버는 stdio로 통신하므로 interactive 모드로 실행
CMD ["node", "dist/index.js"]

