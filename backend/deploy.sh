#!/bin/bash

# 后端部署脚本 - 在群晖上运行

# 1. 创建应用目录
mkdir -p /var/services/homes/kaifazhe/ledo-backend

# 2. 复制文件（需要手动将文件复制到群晖）
# 建议使用 File Station 或 SCP 上传

# 3. 安装依赖
cd /var/services/homes/kaifazhe/ledo-backend
npm install --registry=https://registry.npmmirror.com

# 4. 初始化数据库（需要先在群晖上运行）
# mysql -u kaifazhe -p'.xyPL615Be//ff-I' < init_db.sql

# 5. 启动服务
PORT=3003 node src/index.js