# 后端部署文档

## 本地开发模式（当前激活）

后端已在本地运行，连接群晖数据库进行开发调试。

### 本地启动后端

```bash
cd /Users/laijiehong/Downloads/ledo/backend

# 确保依赖已安装
npm install

# 启动后端服务
npm start
# 或
npm run dev
```

### 本地测试

- 健康检查：`http://localhost:3003/health`
- API 端点：`http://localhost:3003/api/*`

### 前端连接本地后端

前端已配置连接 `http://localhost:3003`，请确保前端开发服务器运行：

```bash
cd /Users/laijiehong/Downloads/ledo/frontend
npm run dev
```

---

## 部署到群晖（生产模式）

### 方式一：使用 Docker Compose（推荐）

#### 1. 打包后端文件
将以下文件压缩成 zip 上传到群晖：
- `backend/` 文件夹（包含 Dockerfile, docker-compose.yml, src/, package.json, .env）

#### 2. 在群晖上部署

通过 SSH 连接到群晖后：

```bash
# 进入上传的目录
cd /你的上传路径/ledo-backend

# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

---

### 方式二：直接运行（如果群晖有 Node.js）

```bash
cd /你的上传路径/ledo-backend
npm install
PORT=3003 node src/index.js
```

---

## 注意事项

1. **端口映射**：群晖 Docker 默认需要手动设置端口转发
2. **数据库连接**：已配置连接群晖 MariaDB (192.168.1.254:3306)
3. **防火墙**：确保群晖防火墙允许 3003 端口
4. **CORS**：生产环境需要修改 .env 中的 CORS_ORIGIN

---

## 环境配置切换

| 文件 | 开发模式 | 生产模式 |
|------|---------|---------|
| `frontend/src/config/api.js` | `http://localhost:3003` | `http://192.168.1.254:3003` |
| `backend/.env` | `CORS_ORIGIN=http://localhost:5173` | `CORS_ORIGIN=*` |

---

## 测试

部署成功后访问：`http://<群晖IP>:3003/health