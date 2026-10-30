import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import API_BASE_URL from '../config/api';
import { fmtTime, fmtDate } from '../utils/time';

function Notifications({ userRole, isMobile = false }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/change-requests/notifications');
      setNotifications(response.data.notifications || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/change-requests/notifications/unread-count');
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/change-requests/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/change-requests/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setFeedbackLoading(true);
    try {
      await api.post('/change-requests/feedback', {
        title: feedbackTitle,
        content: feedbackContent,
        type: feedbackType
      });
      setFeedbackSuccess(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSuccess(false);
        setFeedbackTitle('');
        setFeedbackContent('');
        setFeedbackType('bug');
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setFeedbackLoading(false);
    }
  };

   const formatDate = (dateStr) => {
     if (!dateStr) return '-';
     const date = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + '+08:00');
     const now = new Date();
     const diff = now - date;
     
     if (diff < 60000) return '刚刚';
     if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
     if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
     if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
     
     return fmtTime(dateStr);
   };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'approval':
        return '✅';
      case 'rejection':
        return '❌';
      case 'info':
        return 'ℹ️';
      case 'bug':
        return '🐛';
      case 'issue':
        return '❓';
      case 'suggestion':
        return '💡';
      default:
        return '📢';
    }
  };

  const getTypeStyle = (type) => {
    switch (type) {
      case 'approval':
        return { background: '#e8f5e9', borderColor: '#4caf50', color: '#2e7d32' };
      case 'rejection':
        return { background: '#ffebee', borderColor: '#f44336', color: '#c62828' };
      case 'bug':
        return { background: '#fff3e0', borderColor: '#ff9800', color: '#e65100' };
      case 'issue':
        return { background: '#e3f2fd', borderColor: '#2196f3', color: '#1565c0' };
      case 'suggestion':
        return { background: '#f3e5f5', borderColor: '#9c27b0', color: '#6a1b9a' };
      default:
        return { background: '#e3f2fd', borderColor: '#2196f3', color: '#1565c0' };
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'approval':
        return '审核通过';
      case 'rejection':
        return '审核拒绝';
      case 'info':
        return '通知';
      case 'bug':
        return 'BUG反馈';
      case 'issue':
        return '问题反馈';
      case 'suggestion':
        return '建议反馈';
      default:
        return '消息';
    }
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return API_BASE_URL + path;
  };

  const getAttachmentType = (mimeType) => {
    if (!mimeType) return 'other';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'other';
  };

  const openPreview = (url, type) => {
    setPreviewUrl(url);
    setPreviewType(type);
    setShowPreviewModal(true);
  };

  const closePreview = () => {
    setShowPreviewModal(false);
    setPreviewUrl('');
    setPreviewType('');
  };

  return (
    <div style={{ padding: isMobile ? '8px' : '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '12px' : '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: '600' }}>通知中心</h3>
          {unreadCount > 0 && (
            <span style={{ 
              background: '#f44336', 
              color: '#fff', 
              padding: '2px 8px', 
              borderRadius: '10px', 
              fontSize: '12px' 
            }}>
              {unreadCount} 条未读
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowFeedbackModal(true)}
            style={{
              padding: '6px 14px',
              background: '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            提交反馈
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              style={{
                padding: '6px 14px',
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              全部已读
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>加载中...</div>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999', background: '#fff', borderRadius: '8px' }}>
          暂无消息
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map(notification => {
            const isFeedback = ['bug', 'issue', 'suggestion'].includes(notification.type);
            return (
            <div
              key={notification.id}
              onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
              style={{
                background: notification.is_read ? '#fff' : '#f0f7ff',
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderLeft: notification.is_read ? '3px solid #ddd' : '3px solid #1976d2'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{getTypeIcon(notification.type)}</span>
                  <span style={{ 
                    fontSize: '12px', 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    ...getTypeStyle(notification.type)
                  }}>
                    {getTypeLabel(notification.type)}
                  </span>
                  <span style={{ fontWeight: notification.is_read ? 'normal' : 'bold' }}>
                    {notification.title}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#999' }}>
                  {formatDate(notification.created_at)}
                </span>
              </div>
              {isFeedback && (
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ color: '#999' }}>反馈用户：</span>
                    {notification.from_user_name || '未知'} 
                    {notification.from_user_phone && ` (${notification.from_user_phone})`}
                  </div>
                  <div>
                    <span style={{ color: '#999' }}>反馈时间：</span>
                    {notification.created_at ? fmtTime(notification.created_at) : '-'}
                  </div>
                </div>
              )}
              <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.5' }}>
                {notification.content}
              </div>
              {notification.attachment_count > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <strong style={{ fontSize: '13px', color: '#666' }}>相关附件 ({notification.attachment_count})：</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {notification.attachments.map(att => {
                      const attType = getAttachmentType(att.mime_type);
                      const url = getImageUrl(att.file_path);
                      return (
                        <div key={att.id} style={{ position: 'relative', width: '60px', height: '60px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                          {attType === 'image' && url && (
                            <img 
                              src={url} 
                              alt={att.original_name || '附件'} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); openPreview(url, 'image'); }}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          {attType === 'video' && url && (
                            <div 
                              onClick={(e) => { e.stopPropagation(); openPreview(url, 'video'); }}
                              style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative', background: '#000' }}
                            >
                              <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '18px', color: '#fff', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>▶</div>
                            </div>
                          )}
                          {attType === 'other' && (
                            <div 
                              onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '9px', color: '#666', padding: '2px', cursor: 'pointer' }}
                              title={att.original_name || '点击打开'}
                            >
                              <span style={{ fontSize: '20px' }}>📄</span>
                              <span style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>文件</span>
                            </div>
                          )}
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255, 152, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>审核中</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {notification.is_read && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                  ✓ 已读
                </div>
              )}
            </div>
          )})}
        </div>
      )}

      {showFeedbackModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowFeedbackModal(false)}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '480px'
          }} onClick={e => e.stopPropagation()}>
            {feedbackSuccess ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <div style={{ fontSize: '18px', color: '#333', marginBottom: '8px' }}>提交成功</div>
                <div style={{ fontSize: '14px', color: '#666' }}>感谢您的反馈，我们会尽快处理</div>
              </div>
            ) : (
              <>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>提交反馈</h3>
                <form onSubmit={handleSubmitFeedback}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#333' }}>反馈类型</label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="bug">🐛 BUG反馈</option>
                      <option value="issue">❓ 问题反馈</option>
                      <option value="suggestion">💡 建议反馈</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#333' }}>标题</label>
                    <input
                      type="text"
                      value={feedbackTitle}
                      onChange={(e) => setFeedbackTitle(e.target.value)}
                      required
                      placeholder="请简要描述问题"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#333' }}>详细描述</label>
                    <textarea
                      value={feedbackContent}
                      onChange={(e) => setFeedbackContent(e.target.value)}
                      required
                      rows={5}
                      placeholder="请详细描述您遇到的问题或建议"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowFeedbackModal(false)}
                      style={{
                        padding: '10px 20px',
                        background: '#fff',
                        color: '#333',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={feedbackLoading}
                      style={{
                        padding: '10px 20px',
                        background: feedbackLoading ? '#ccc' : '#4caf50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: feedbackLoading ? 'not-allowed' : 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {feedbackLoading ? '提交中...' : '提交'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {showPreviewModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }} onClick={closePreview}>
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            {previewType === 'image' && (
              <img src={previewUrl} alt="预览" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} />
            )}
            {previewType === 'video' && (
              <video src={previewUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />
            )}
            <button onClick={closePreview} style={{ position: 'absolute', top: '-40px', right: 0, background: 'none', border: 'none', color: '#fff', fontSize: '30px', cursor: 'pointer' }}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notifications;