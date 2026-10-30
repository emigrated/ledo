export function copyToClipboard(text) {
  // 方案1：同步 execCommand（不依赖权限、安全上下文，不丢失用户手势）
  // 在所有异步操作之前执行，确保在用户手势上下文中
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    try { document.body.removeChild(textarea); } catch (_) {} // 清理失败不影响复制结果
    return Promise.resolve(); // execCommand 有时返回 false 但实际已复制，不依赖返回值
  } catch (_e) {
    // 失败则继续尝试下一种方案
  }

  // 方案2：Electron 预加载脚本暴露的剪贴板 API
  if (window.electronClipboard && window.electronClipboard.writeText) {
    try {
      return Promise.resolve(window.electronClipboard.writeText(text));
    } catch (_e) {
      // 失败则继续尝试下一种方案
    }
  }

  // 方案3：navigator.clipboard API（需要安全上下文 HTTPS）
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return Promise.reject(new Error('No clipboard method available'));
}
