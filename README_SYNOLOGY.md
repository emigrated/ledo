# 群晖 Docker 部署指南

## 📋 部署前准备

### 1. 安装必要套件
- **Docker**（群晖套件中心 → 搜索 "Docker" → 安装）
- **Git**（可选，用于代码同步）

### 2. 创建项目目录
```bash
# SSH 登录群晖后执行
mkdir -p /volume1/docker/ledo
cd /volume1/docker/ledo
```

### 3. 上传项目文件
方式一：使用 Git
```bash
git clone <你的仓库地址> /volume1/docker/ledo
```

方式二：使用群晖 File Station
- 将整个项目文件夹拖拽到 `/volume1/docker/ledo`

## 🗄️ 数据持久化说明

### 数据存储位置（不会丢失）

| 数据类型 | 存储位置 | 群晖实际路径 | 重置系统后 |
|---------|---------|------------|----------|
| **数据库** | Docker Volume | `/volume1/@docker/volumes/ledo_db_data` | ⚠️ 会丢失 |
| **附件文件** | Bind Mount | `/volume1/docker/ledo/backend/uploads` | ✅ 保留 |
| **代码文件** | Bind Mount | `/volume1/docker/ledo` | ✅ 保留 |

### ⚠️ 重要：防止数据丢失

**方案 A：将数据库也改为文件挂载（推荐）**

修改 `docker-compose.yml`，将数据库 volume 改为文件挂载：

```yaml
services:
  db:
    volumes:
      - ./mysql_data:/var/lib/mysql  # 改为文件挂载
      - ./backend/init_db.sql:/docker-entrypoint-initdb.d/init_db.sql
```

这样数据库文件会保存在 `/volume1/docker/ledo/mysql_data`，系统重置也不会丢失。

**方案 B：定期备份数据库**

```bash
# 备份数据库
docker exec ledo-db mysqldump -uroot -proot kaifazhe > /volume1/docker/ledo/backup_$(date +%Y%m%d).sql

# 恢复数据库
docker exec -i ledo-db mysql -uroot -proot kaifazhe < /volume1/docker/ledo/backup_20260427.sql
```

## 🚀 部署步骤

### 步骤 1：修改 docker-compose.yml（可选）

如果要将数据库也持久化到文件，修改：

```yaml
volumes:
  db:
    image: docker.xuanyuan.run/library/mysql:8.0
    volumes:
      - ./mysql_data:/var/lib/mysql  # 改这行
```

### 步骤 2：构建并启动容器

```bash
cd /volume1/docker/ledo

# 构建后端镜像
docker build -t ledo-backend:latest ./backend

# 构建前端镜像（如果需要）
docker build -t ledo-frontend:latest ./frontend

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 步骤 3：访问应用

- 前端：`http://群晖 IP:5173`
- 后端 API：`http://群晖 IP:3003`

## 📁 目录结构

```
/volume1/docker/ledo/
├── docker-compose.yml          # Docker 编排文件
├── backend/
│   ├── src/                    # 后端代码
│   ├── uploads/                # 附件存储（持久化）
│   │   ├── image/
│   │   ├── video/
│   │   └── application/
│   └── init_db.sql            # 数据库初始化脚本
├── frontend/
│   └── src/                   # 前端代码
└── mysql_data/                # 数据库文件（如果修改配置）
```

## 🔧 常用命令

```bash
# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# 重启服务
docker-compose restart backend
docker-compose restart frontend

# 停止服务
docker-compose down

# 启动服务
docker-compose up -d

# 重新构建
docker-compose build --no-cache
docker-compose up -d
```

## 🛠️ 故障排查

### 1. 容器无法启动
```bash
# 查看详细日志
docker logs ledo-backend
docker logs ledo-frontend
docker logs ledo-db
```

### 2. 数据库连接失败
```bash
# 检查数据库是否运行
docker ps | grep ledo-db

# 测试数据库连接
docker exec ledo-db mysql -uroot -proot -e "SHOW DATABASES;"
```

### 3. 附件无法上传
```bash
# 检查 uploads 目录权限
ls -la /volume1/docker/ledo/backend/uploads

# 修复权限
chmod -R 755 /volume1/docker/ledo/backend/uploads
```

## 📊 系统重置后的恢复

### 如果群晖系统重置：

1. **重新安装 Docker 套件**

2. **恢复项目文件**（如果 `/volume1/docker/ledo` 还在）

3. **启动容器**
   ```bash
   cd /volume1/docker/ledo
   docker-compose up -d
   ```

4. **如果数据库丢失**（使用 volume 方式）：
   - 如果有备份：`docker exec -i ledo-db mysql -uroot -proot kaifazhe < backup.sql`
   - 如果没有备份且使用 `./mysql_data` 挂载，数据会自动恢复

## 💡 最佳实践

### 1. 定期备份
```bash
# 创建备份脚本
cat > /volume1/docker/ledo/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec ledo-db mysqldump -uroot -proot kaifazhe > /volume1/docker/ledo/backups/db_${DATE}.sql
# 保留最近 30 天的备份
find /volume1/docker/ledo/backups -name "db_*.sql" -mtime +30 -delete
EOF

chmod +x /volume1/docker/ledo/backup.sh

# 添加到群晖任务计划（每天凌晨 2 点）
```

### 2. 监控磁盘空间
```bash
# 定期检查
df -h
docker system df
```

### 3. 日志轮转
```bash
# 创建日志配置文件
mkdir -p /volume1/docker/ledo/config
cat > /volume1/docker/ledo/config/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
```

## 📞 常见问题

### Q: 附件存在哪里？
A: `/volume1/docker/ledo/backend/uploads`，按日期和类型分类：
- `uploads/image/2026/04/27/xxx.jpg`
- `uploads/video/2026/04/27/xxx.mp4`

### Q: 数据库会丢失吗？
A: 
- 使用默认配置（volume）：系统重置会丢失
- 修改为 `./mysql_data` 挂载：不会丢失

### Q: 如何迁移到另一台群晖？
A: 
1. 打包整个 `/volume1/docker/ledo` 目录
2. 在新群晖上解压到相同位置
3. 运行 `docker-compose up -d`

### Q: 如何更新代码？
A:
```bash
cd /volume1/docker/ledo
git pull  # 如果使用 Git
docker-compose build --no-cache
docker-compose up -d
```
