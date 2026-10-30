# 端口映射说明

## 架构

```
用户访问
  https://emigrated.i234.me:5443/login
       │
       ▼
Synology 反向代理 (Nginx)
  listen 5443 ssl
  proxy_pass → http://localhost:8080
       │
       ▼
Docker 主机端口 8080
       │
       ▼
Docker port mapping: 8080 → 5173
       │
       ▼
前端容器 (ledo-frontend)
  Vite 开发服务器 @ 5173
  代理 /api → ledo-backend:3003
```

## 端口速查

| 端口 | 在哪监听 | 谁在用 | 备注 |
|------|---------|--------|------|
| **5443** | NAS 主机 | Synology Reverse Proxy | **用户访问入口**，统一 HTTPS |
| **8080** | NAS 主机 | Docker port mapping | 主机 → 容器 5173，**反向代理目标** |
| **5173** | 容器内部 | Vite dev server | 主机不可达，只能通过 8080 进入 |
| **3003** | NAS 主机 + 容器 | ledo-backend | 后端 API，容器内外都可访问 |
| **13306** | NAS 主机 | MySQL port mapping | 主机 → 容器 3306，仅管理连接 |

## 原则

1. **对外**只用 5443（HTTPS 反向代理）
2. **反向代理目标**写 `localhost:8080`（不要写 5173）
3. **调试时区分**：
   - 在 NAS 上 curl → 用 `127.0.0.1:8080`（主机端口）
   - 在容器内 curl → 用 `localhost:5173`（容器端口）
   - 从外部浏览器 → 用 `emigrated.i234.me:5443`（唯一入口）

## Nginx 配置位置

```
Synology 反向代理 (5443 → 8080):
  /usr/local/etc/nginx/sites-available/518cf2c1-...w3conf

Synology Web Station (备用):
  /usr/local/etc/nginx/conf.d-available/28e5c810-...w3conf
```
