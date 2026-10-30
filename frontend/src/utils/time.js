/**
 * Display a China-timezone date string stored without timezone info.
 * Backend stores all timestamps in Asia/Shanghai (UTC+8) as "YYYY-MM-DD HH:MM:SS".
 */
export function fmtTime(dateStr) {
  if (!dateStr) return '-';
  try {
    let d;
    // Check if string already has timezone info (Z, +HH:MM, -HH:MM)
    if (/[Z+-]\d{2}:\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {
      d = new Date(dateStr);
    } else {
      // Assume China time (UTC+8) with no timezone info
      const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
      d = new Date(normalized + '+08:00');
    }
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return dateStr;
  }
}

export function fmtDate(dateStr) {
  if (!dateStr) return '-';
  return dateStr.slice(0, 10);
}

export function fmtDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    let d;
    if (/[Z+-]\d{2}:\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {
      d = new Date(dateStr);
    } else {
      const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
      d = new Date(normalized + '+08:00');
    }
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return dateStr;
  }
}

/**
 * China-timezone calendar date "YYYY-MM-DD" from ISO/space-form strings or Date.
 */
export function toChinaDate(dateStr) {
  if (!dateStr) return '';
  try {
    let d;
    if (dateStr instanceof Date) {
      d = dateStr;
    } else if (typeof dateStr === 'string') {
      if (/[Z+-]\d{2}:\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {
        d = new Date(dateStr);
      } else {
        const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
        d = new Date(normalized + '+08:00');
      }
    }
    if (!d || isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
    return parts;
  } catch {
    return '';
  }
}
