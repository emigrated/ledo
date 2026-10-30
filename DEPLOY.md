# Ledo 群晖 Docker 部署指南

## 📋 修复的问题

1. ✅ 添加数据库健康检查，确保后端在数据库就绪后才启动
2. ✅ 移除后端开发模式的 volume 挂载（生产环境不需要）
3. ✅ 前端改为生产构建模式（使用 Vite build）
4. ✅ 使用 `serve` 包部署静态文件
5. ✅ 添加 `NODE_ENV=production` 环境变量

## 🚀 快速部署

### 方法 1：使用部署脚本（推荐）

```bash
# 赋予执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

### 方法 2：手动部署

```bash
# 1. 停止旧容器
docker-compose down

# 2. 构建镜像
docker build -t ledo-backend:latest ./backend
docker build -t ledo-frontend:latest ./frontend

# 3. 启动服务
docker-compose up -d

# 4. 查看状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f
```

## 🌐 访问地址

- **前端**: http://你的群晖 IP:5173
- **后端 API**: http://你的群晖 IP:3003
- **数据库**: 你的群晖 IP:3306

## ⚙️ 配置说明

### docker-compose.yml 主要修改：

1. **数据库健康检查**
   - 确保 MySQL 完全启动后再启动后端
   - 避免后端启动时数据库未就绪导致的错误

2. **后端配置**
   - 移除了开发模式的源码挂载
   - 只保留 `uploads` 目录用于文件上传
   - 添加 `NODE_ENV=production`

3. **前端配置**
   - 使用多阶段构建（builder + production）
   - 构建静态文件到 `dist` 目录
   - 使用 `serve` 包提供 HTTP 服务

## 📁 数据持久化

数据库数据保存在 Docker volume 中：
- Volume 名称：`ledo_db_data`
- 位置：`/var/lib/docker/volumes/ledo_db_data/_data`

即使删除容器，数据也不会丢失。

## 🔧 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 停止并删除数据（危险！）
docker-compose down -v

# 进入容器
docker exec -it ledo-backend sh
docker exec -it ledo-db mysql -uroot -p

# 重新构建并启动
docker-compose up -d --build
```

## 🌍 外网访问配置

### 方法 1：端口转发

1. 群晖控制面板 → 外部访问 → 路由器配置
2. 添加端口转发：
   - 5173 → 前端
   - 3003 → 后端

### 方法 2：反向代理（推荐）

1. 群晖控制面板 → 登录门户 → 反向代理
2. 新增规则：
   - 域名：`ledo.你的域名.com`
   - 端口：443 (HTTPS)
   - 目标：`http://localhost:5173`

### 方法 3：修改 docker-compose.yml

如果需要自定义域名，修改 `docker-compose.yml`：

```yaml
environment:
  - VITE_API_URL=https://ledo.你的域名.com
```

## 🔐 安全建议

1. **修改默认密码**
   - 数据库密码：`MYSQL_ROOT_PASSWORD`
   - JWT 密钥：`JWT_SECRET` 和 `JWT_REFRESH_SECRET`

2. **限制数据库访问**
   - 生产环境不要暴露 3306 端口
   - 只在内部网络访问

3. **使用 HTTPS**
   - 配置 SSL 证书
   - 使用反向代理启用 HTTPS

## 🐛 故障排查

### 后端启动失败

```bash
# 查看后端日志
docker-compose logs backend

# 检查数据库是否就绪
docker exec ledo-db mysqladmin ping -uroot -proot
```

### 前端无法连接后端

```bash
# 检查后端是否运行
docker-compose ps backend

# 测试后端 API
curl http://localhost:3003/api/health
```

### 数据库初始化失败

```bash
# 查看数据库日志
docker-compose logs db

# 手动执行初始化脚本
docker exec -i ledo-db mysql -uroot -pkaifazhe < backend/init_db.sql
```

## 📝 更新应用

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建并启动
docker-compose up -d --build

# 3. 查看日志
docker-compose logs -f
```

## 💡 性能优化

1. **增加数据库内存**
   ```yaml
   db:
     deploy:
       resources:
         limits:
           memory: 1G
   ```

2. **使用 Docker 网络**
   - 已配置 `ledo-network` 隔离网络
   - 容器间通过容器名通信

3. **日志轮转**
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

## 📞 技术支持

如有问题，请查看：
- Docker 日志：`docker-compose logs -f`
- 容器状态：`docker-compose ps`
- 系统资源：`docker stats`
