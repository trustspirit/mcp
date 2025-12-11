FROM node:22-alpine AS builder

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 루트 패키지 파일 복사
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./

# gemini-mcp 패키지 파일 복사
COPY packages/gemini-mcp/package.json ./packages/gemini-mcp/

# 의존성 설치
RUN pnpm install --frozen-lockfile

# 소스 코드 복사
COPY packages/gemini-mcp/src ./packages/gemini-mcp/src
COPY packages/gemini-mcp/tsconfig.json ./packages/gemini-mcp/

# 빌드
RUN pnpm --filter @mcp/gemini build

# Production 이미지
FROM node:22-alpine AS runner

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 루트 패키지 파일 복사
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# gemini-mcp 패키지 파일 복사
COPY packages/gemini-mcp/package.json ./packages/gemini-mcp/

# Production 의존성만 설치
RUN pnpm install --frozen-lockfile --prod

# 빌드된 파일 복사
COPY --from=builder /app/packages/gemini-mcp/dist ./packages/gemini-mcp/dist

# 실행
WORKDIR /app/packages/gemini-mcp

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]


