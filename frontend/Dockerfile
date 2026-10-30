FROM node:22-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 配置 npm 镜像源并安装依赖（跳过 Electron 二进制下载）
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm config set registry https://registry.npmmirror.com && npm install

# 复制源代码
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
