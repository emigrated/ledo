// 表单草稿：手机浏览器把后台标签页回收后，页面重载时据此恢复已填内容。
// 只存本机 localStorage，不上传服务器；附件（图片）无法序列化，不参与草稿。
export const DRAFT_TTL = 24 * 60 * 60 * 1000; // 超过 24 小时的草稿自动丢弃

export const currentUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.id || '';
  } catch (e) {
    return '';
  }
};

// 数字时间戳专用（utils/time 的 fmtTime 只处理字符串）
export const fmtDraftStamp = (ts) => {
  try {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  } catch (e) {
    return '';
  }
};

export const clearDraft = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    /* 隐私模式等场景忽略 */
  }
};

// 写入草稿，自动补 savedAt 与 userId（换账号不恢复别人的草稿）
export const saveDraft = (key, payload) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      ...payload,
      savedAt: Date.now(),
      userId: currentUserId()
    }));
    return true;
  } catch (e) {
    return false; // 存储已满或隐私模式下静默失败，不影响正常录入
  }
};

// 读取草稿：过期、换账号、结构不对都返回 null 并顺手清掉
export const readDraft = (key, ttl = DRAFT_TTL) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || !draft.formData) return null;

    const uid = currentUserId();
    if (draft.userId && uid && String(draft.userId) !== String(uid)) {
      clearDraft(key);
      return null;
    }
    if (!draft.savedAt || Date.now() - draft.savedAt > ttl) {
      clearDraft(key);
      return null;
    }
    return draft;
  } catch (e) {
    return null;
  }
};
