#!/usr/bin/env bash
set -e

echo "Starting local development environment (Docker Compose)..."

if command -v docker-compose >/dev/null 2>&1; then
  DC_CMD="docker-compose"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  DC_CMD="docker compose"
else
  echo "错误：未检测到 docker-compose 或 docker compose 命令。" >&2
  exit 1
fi

# Check if images exist locally
BACKEND_EXISTS=$(docker images -q ledo-backend:latest 2>/dev/null)
FRONTEND_EXISTS=$(docker images -q ledo-frontend:latest 2>/dev/null)
MYSQL_EXISTS=$(docker images -q mysql:8.0 2>/dev/null)

if [ -z "$BACKEND_EXISTS" ] || [ -z "$FRONTEND_EXISTS" ] || [ -z "$MYSQL_EXISTS" ]; then
  echo "警告：本地镜像不存在，无法启动。请先在有网络的机器上构建镜像并导出。"
  echo "或者手动运行: docker build -t ledo-backend:latest ./backend"
  echo "             docker build -t ledo-frontend:latest ./frontend"
  echo "             docker pull mysql:8.0"
  exit 1
fi

echo "使用命令: ${DC_CMD} up -d"
${DC_CMD} up -d

echo "等待后端启动..."
sleep 5
curl -sS http://localhost:3003/health || echo "后端健康检查失败。请检查后端日志。"
echo "前端可访问 http://localhost:5173"
