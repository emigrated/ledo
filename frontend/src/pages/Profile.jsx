import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatPhone, validatePhone } from '../utils/validation';
import { fmtTime, fmtDate } from '../utils/time';

function Profile({ isMobile = false }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneRequests, setPhoneRequests] = useState([]);
  const [submittingPhone, setSubmittingPhone] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchPhoneRequests();
  }, []);

  const fetchProfile = async () => {
    try {
      console.log('Fetching profile...');
      const response = await api.get('/users/me');
      console.log('Profile response:', response.data);
      setProfile(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      console.error('Error response:', error.response?.data);
      setLoading(false);
    }
  };

  const fetchPhoneRequests = async () => {
    try {
      const response = await api.get('/users/phone-change-request');
      setPhoneRequests(response.data.requests || []);
    } catch (error) {
      console.error('Failed to fetch phone requests:', error);
    }
  };

  const handlePhoneChange = async (e) => {
    e.preventDefault();
    if (newPhone.length !== 11) {
      setMessage('请输入11位手机号码');
      setMessageType('error');
      return;
    }
    
    setSubmittingPhone(true);
    setMessage('');
    
    try {
      await api.post('/users/phone-change-request', { new_phone: newPhone });
      setMessage('申请已提交，请等待管理员审核');
      setMessageType('success');
      setShowPhoneEdit(false);
      setNewPhone('');
      fetchPhoneRequests();
    } catch (error) {
      setMessage(error.response?.data?.error || '提交失败');
      setMessageType('error');
    } finally {
      setSubmittingPhone(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await api.put('/users/me', {
        bio: profile.bio
      });
      setMessage('保存成功');
      setMessageType('success');
      localStorage.setItem('user', JSON.stringify({ ...user, name: profile.name }));
    } catch (error) {
      console.error('Failed to save profile:', error);
      setMessage('保存失败');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>加载中...</div>;
  }

  const pendingRequest = phoneRequests.find(r => r.status === 'pending');

  return (
    <div style={{ padding: isMobile ? '8px' : '16px', maxWidth: '600px' }}>
      <h2 style={{ marginBottom: isMobile ? '16px' : '24px', fontSize: isMobile ? '18px' : '20px', fontWeight: '600' }}>个人中心</h2>

      <div style={{ background: '#fff', borderRadius: '8px', padding: isMobile ? '16px' : '24px' }}>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            background: '#1976d2', 
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            margin: '0 auto 12px'
          }}>
            {profile?.name?.charAt(0) || '用户'}
          </div>
          <div style={{ fontSize: '16px', fontWeight: '500' }}>{profile?.name}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            {profile?.role === 'admin' ? '管理员' : '普通用户'}
          </div>
        </div>

        {message && (
          <div style={{ 
            padding: '10px', 
            marginBottom: '16px', 
            borderRadius: '4px',
            background: messageType === 'success' ? '#e8f5e9' : '#ffebee',
            color: messageType === 'success' ? '#2e7d32' : '#c62828',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>姓名</label>
            <input
              type="text"
              value={profile?.name || ''}
              disabled
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                background: '#f5f5f5',
                color: '#666'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>身份证号</label>
            <input
              type="text"
              value={profile?.id_card || ''}
              disabled
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                background: '#f5f5f5',
                color: '#666'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>手机号码</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <input
                type="text"
                value={profile?.phone || ''}
                disabled
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  background: '#f5f5f5',
                  color: '#666'
                }}
              />
              {!showPhoneEdit && !pendingRequest && (
                <button
                  type="button"
                  onClick={() => setShowPhoneEdit(true)}
                  style={{
                    padding: '10px 16px',
                    background: '#1976d2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  修改
                </button>
              )}
            </div>
            
            {pendingRequest && (
              <div style={{ marginTop: '8px', padding: '10px', background: '#fff3cd', borderRadius: '4px', fontSize: '13px', color: '#856404' }}>
                等待审核中：新手机号 {pendingRequest.new_phone}
              </div>
            )}
            
            {showPhoneEdit && (
              <form onSubmit={handlePhoneChange} style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(formatPhone(e.target.value))} maxLength={11}
                    placeholder="请输入新手机号"
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={submittingPhone || newPhone.length !== 11}
                    style={{
                      padding: '10px 16px',
                      background: submittingPhone ? '#ccc' : '#4caf50',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      cursor: submittingPhone ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {submittingPhone ? '提交中...' : '提交申请'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPhoneEdit(false); setNewPhone(''); }}
                    style={{
                      padding: '10px 16px',
                      background: '#f44336',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    取消
                  </button>
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                  修改手机号需要管理员审核通过后才能生效
                </div>
              </form>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>个人简介</label>
            <textarea
              value={profile?.bio || ''}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="介绍一下自己吧..."
              rows={4}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>账号信息</div>
            <div style={{ fontSize: '13px', color: '#333' }}>
              <div>注册时间：{profile?.created_at ? fmtDate(profile.created_at) : '-'}</div>
              <div>上次登录：{profile?.last_login_at ? fmtTime(profile.last_login_at) : '-'}</div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px',
              background: saving ? '#ccc' : '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        </form>

        {phoneRequests.length > 0 && (
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #eee' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>手机号修改记录</h3>
            {phoneRequests.map(req => (
              <div key={req.id} style={{ 
                padding: '10px', 
                marginBottom: '8px', 
                background: req.status === 'pending' ? '#fff3cd' : req.status === 'approved' ? '#e8f5e9' : '#ffebee',
                borderRadius: '4px',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{req.old_phone} → {req.new_phone}</span>
                  <span style={{ 
                    color: req.status === 'pending' ? '#f57c00' : req.status === 'approved' ? '#2e7d32' : '#c62828'
                  }}>
                    {req.status === 'pending' ? '等待审核' : req.status === 'approved' ? '已通过' : '已拒绝'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  申请时间：{fmtTime(req.requested_at)}
                  {req.processed_at && `，处理时间：${fmtTime(req.processed_at)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
