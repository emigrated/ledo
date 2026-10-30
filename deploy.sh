#!/bin/bash

# 群晖 Docker 部署脚本
# 使用方法：sudo ./deploy.sh

set -e

echo "🚀 开始部署 Ledo 应用..."

# 1. 停止并清理旧容器
echo "📦 停止旧容器..."
docker-compose down || true

# 2. 构建镜像
echo "🔨 构建后端镜像..."
docker build -t ledo-backend:latest ./backend

echo "🔨 构建前端镜像..."
docker build -t ledo-frontend:latest ./frontend

# 3. 启动服务
echo "▶️  启动服务..."
docker-compose up -d

# 4. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 5. 检查状态
echo "📊 服务状态:"
docker-compose ps

echo ""
echo "✅ 部署完成！"
echo ""
echo "访问地址:"
echo "  前端：http://localhost:5173"
echo "  后端：http://localhost:3003"
echo ""
echo "查看日志:"
echo "  docker-compose logs -f backend"
echo "  docker-compose logs -f frontend"
echo ""
echo "停止服务:"
echo "  docker-compose down"
echo ""
