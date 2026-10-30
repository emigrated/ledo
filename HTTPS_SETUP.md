# 群晖 HTTPS 访问配置指南

## 🎯 问题说明
群晖 DSM 默认会自动将 HTTP 请求跳转到 HTTPS，导致 Docker 容器内的 HTTP 服务无法正常访问。

## ✅ 解决方案

### 方案一：使用群晖反向代理（推荐）

#### 1️⃣ 配置前端反向代理

1. 打开 **群晖控制面板** → **登录门户** → **反向代理**
2. 点击 **新增** → **反向代理**
3. 配置如下：

**基本设置：**
```
来源：
  - 协议：HTTPS
  - 主机名：emigrated.i234.me
  - 端口：5443（443 已被占用，使用 5443）

目标：
  - 协议：HTTP
  - 主机名：localhost
  - 端口：5173
```

**高级设置：**
- 取消勾选 **强制 HSTS**
- 点击 **自定义标头** → **新增** → **WebSocket**（勾选）

4. 点击 **保存**

#### 2️⃣ 配置后端反向代理（可选）

如果需要从外网访问后端 API，也需要配置后端反向代理：

```
来源：
  - 协议：HTTPS
  - 主机名：emigrated.i234.me
  - 端口：3443（3003 已被占用，使用 3443）

目标：
  - 协议：HTTP
  - 主机名：localhost
  - 端口：3003
```

#### 3️⃣ 修改前端配置

编辑 `docker-compose.yml`，将 API URL 改为反向代理地址：

```yaml
environment:
  - VITE_API_URL=https://你的群晖 IP:3443
```

然后重启前端服务：
```bash
sudo docker-compose restart frontend
```

#### 4️⃣ 访问应用

- 前端：`https://emigrated.i234.me:5443`
- 后端 API：`https://emigrated.i234.me:3443`
- 数据库：`你的群晖 IP:13306`（内部使用）

---

### 方案二：使用 Nginx Proxy Manager（更灵活）

#### 1️⃣ 安装 Nginx Proxy Manager

在群晖 Docker 中安装 Nginx Proxy Manager：

```bash
docker run -d \
  --name=nginx-proxy-manager \
  -p 80:80 \
  -p 81:81 \
  -p 443:443 \
  -v /volume1/docker/npm-data:/data \
  -v /volume1/docker/npm-letsencrypt:/etc/letsencrypt \
  --restart=unless-stopped \
  jc21/nginx-proxy-manager:latest
```

#### 2️⃣ 配置反向代理

1. 访问 `http://你的群晖 IP:81`
2. 登录（默认邮箱：admin@example.com，密码：changeme）
3. 添加 Proxy Host：
   - **Domain Names**: `ledo.yourdomain.com`
   - **Scheme**: `http`
   - **Forward Hostname/IP**: `你的群晖内网 IP`
   - **Forward Port**: `5173`
   - 勾选 **Block Common Exploits**
   - 勾选 **Websockets Support**

#### 3️⃣ 配置 SSL 证书

在 Nginx Proxy Manager 中申请 Let's Encrypt 证书。

---

### 方案三：直接使用 HTTP（仅内网）

如果只在内网使用，可以：

1. **关闭群晖的 HTTPS 强制跳转**
   - 控制面板 → 登录门户 → 高级
   - 取消勾选 **自动将 HTTP 连接重定向到 HTTPS**

2. **直接访问**
   - 前端：`http://你的群晖 IP:5173`
   - 后端：`http://你的群晖 IP:3003`

⚠️ **注意**：此方案不适合外网访问，存在安全风险。

---

## 🔧 快速测试配置

配置完成后，测试反向代理是否工作：

```bash
# 测试前端
curl -k https://你的群晖 IP:5443

# 测试后端
curl -k https://你的群晖 IP:3443/api/health
```

## 📝 常用命令

```bash
# 查看服务状态
sudo docker-compose ps

# 重启服务
sudo docker-compose restart

# 查看日志
sudo docker-compose logs -f frontend
sudo docker-compose logs -f backend

# 重新构建并启动
sudo docker-compose up -d --build
```

## 💡 故障排查

### 1. 反向代理配置后仍然无法访问

- 检查防火墙设置，确保端口已开放
- 检查群晖 DSM 的端口转发规则
- 尝试使用 `curl -k https://你的群晖 IP:5443` 测试

### 2. 前端无法连接后端 API

- 检查 `VITE_API_URL` 配置是否正确
- 确保后端反向代理端口配置正确
- 查看浏览器控制台的网络请求错误信息

### 3. SSL 证书问题

- 如果使用自签名证书，浏览器会显示警告，点击"继续访问"即可
- 建议使用 Let's Encrypt 或购买正式 SSL 证书

## 🔐 安全建议

1. **修改默认密码**
   - 数据库密码
   - JWT 密钥

2. **使用强密码**
   - 至少 12 位，包含大小写字母、数字和特殊字符

3. **定期更新**
   - 定期更新 Docker 镜像
   - 定期更新 SSL 证书

4. **限制访问**
   - 使用防火墙限制访问 IP
   - 使用反向代理的访问控制功能
