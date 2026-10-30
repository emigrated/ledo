// 支持环境变量配置，默认使用 localhost
let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3003';

// Electron 环境检测（contextIsolation=true 时 window.process 不可用，用 userAgent）
if (typeof window !== 'undefined' && (
  navigator.userAgent.includes('Electron') || (window.process && window.process.type)
)) {
  // Electron 桌面版：连接群晖 NAS 上的后端
  // 如有自定义服务器地址，可通过 localStorage 设置 serverUrl
  API_BASE_URL = localStorage.getItem('serverUrl') || 'https://emigrated.i234.me:5443';
}

// Docker 环境检测 - 但从浏览器访问始终使用 localhost
// 这个配置主要用于区分开发环境和生产环境
if (typeof window !== 'undefined') {
  try {
    const host = window.location?.hostname;
    // 如果不是本地开发环境，使用配置的 Docker API 地址
    if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') {
      // 检查是否有明确的环境变量配置
      const dockerApiUrl = import.meta.env.VITE_API_BASE_URL_DOCKER;
      if (dockerApiUrl) {
        API_BASE_URL = dockerApiUrl;
      } else {
        // 动态根据当前页面地址推断后端地址
        // 前端端口 5443 -> 后端端口 3443
        const protocol = window.location.protocol;
        const port = window.location.port;
        let apiPort = port;
        if (port === '5443' || port === '8080') {
          // 使用 nginx 代理，API 请求走同端口
          apiPort = port;
        }
        API_BASE_URL = `${protocol}//${host}:${apiPort}`;
      }
    }
  } catch (e) {}
}

export default API_BASE_URL;