import { useEffect } from 'react';

function FontSizeManager() {
  useEffect(() => {
    // 从 localStorage 读取字体大小设置
    const savedSettings = localStorage.getItem('userSettings');
    let fontSize = 100; // 默认 100%
    
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        fontSize = parsed.font_size || 100;
      } catch (e) {
        console.error('Failed to parse userSettings:', e);
      }
    }
    
    // 应用字体大小（作为页面切换时的备用方案）
    const baseFontSize = 14;
    const scale = fontSize / 100;
    const newBaseSize = baseFontSize * scale;
    
    // 总是应用字体大小，覆盖之前的设置
    document.documentElement.style.fontSize = `${newBaseSize}px`;
    document.body.style.fontSize = `${newBaseSize}px`;
  }, []);

  return null;
}

export default FontSizeManager;
