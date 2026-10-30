FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install
RUN npm install -g nodemon

COPY . .

ENV PORT=3003
ENV DB_HOST=db
ENV DB_PORT=3306
ENV DB_USER=root
ENV DB_PASSWORD=root
ENV DB_NAME=kaifazhe

EXPOSE 3003

CMD ["nodemon", "--legacy-watch", "--delay", "1", "src/index.js"]
