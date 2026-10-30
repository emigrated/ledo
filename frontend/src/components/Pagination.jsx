import React from 'react';

const PAGE_SIZE = 20;

export default function Pagination({ page, total, limit, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / (limit || PAGE_SIZE)));

  if (total <= 0) return null;

  const btnStyle = (disabled) => ({
    padding: '4px 12px',
    margin: '0 4px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: disabled ? '#f5f5f5' : '#fff',
    color: disabled ? '#ccc' : '#333',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px',
    userSelect: 'none'
  });

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16px 0',
      gap: '4px',
      fontSize: '13px',
      color: '#666'
    }}>
      <button
        style={btnStyle(page <= 1)}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        上一页
      </button>
      <span style={{ margin: '0 8px' }}>
        第 {page} / {totalPages} 页 (共 {total} 条)
      </span>
      <button
        style={btnStyle(page >= totalPages)}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
