FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# 운영 이미지
FROM node:20-alpine

WORKDIR /app

# 보안: non-root 유저 생성
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001

# entrypoint: named volume이 비어 있거나 package.json 변경 시 npm install 실행
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 필요한 파일만 복사
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/build ./build
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/src/shared/lib/i18n/locales ./build/shared/lib/i18n/locales
COPY --from=builder --chown=nodejs:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=nodejs:nodejs /app/src/scripts/data ./build/scripts/data  

# Create uploads directory with correct permissions
RUN mkdir -p /app/uploads && chown nodejs:nodejs /app/uploads

# 포트 설정
EXPOSE 3000

# non-root 유저로 전환
USER nodejs

# TS_NODE_BASEURL 설정 (build 경로 기준)
ENV TS_NODE_BASEURL=./build

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# 앱 시작 (path alias 해결)
# Worker process can be started by overriding CMD with ["npm", "run", "worker"]
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "-r", "tsconfig-paths/register", "build/index.js"]
