#!/bin/bash

# 打包后端部署文件
cd /Users/laijiehong/Downloads/ledo/backend

# 创建部署目录
mkdir -p /Users/laijiehong/Downloads/ledo-deploy
rm -rf /Users/laijiehong/Downloads/ledo-deploy/*

# 复制必要文件
cp Dockerfile docker-compose.yml package.json package-lock.json .env src /Users/laijiehong/Downloads/ledo-deploy/

echo "部署文件已准备好在: /Users/laijiehong/Downloads/ledo-deploy/"
echo ""
echo "将 ledo-deploy 文件夹上传到群晖，然后执行:"
echo "  docker-compose up -d"