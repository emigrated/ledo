import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import Pagination from '../components/Pagination';
import { fmtTime } from '../utils/time';
import { applyTableLabels } from '../utils/responsiveTable';
const PAGE_SIZE = 20;

function AdminUserManagement({ isMobile = false }) {
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [phoneRequests, setPhoneRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchUsers = async (p) => {
    const currentPage = p || page;
    try {
      console.log('Fetching users from /auth/admin/users');
      const response = await api.get(`/auth/admin/users?page=${currentPage}&limit=${PAGE_SIZE}`);
      console.log('Users response:', response);
      if (response.ok) {
        setUsers(response.data.users);
        setTotal(response.data.total || 0);
      } else {
        setError('获取用户列表失败: ' + (response.data?.error || ''));
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      setError('获取用户列表失败');
    }
  };

  const fetchAdmins = async () => {
    try {
      console.log('Fetching admins from /auth/admin/admins');
      const response = await api.get('/auth/admin/admins');
      console.log('Admins response:', response);
      if (response.ok) {
        setAdmins(response.data.admins || []);
      }
    } catch (err) {
      console.error('Fetch admins error:', err);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchUsers(newPage);
  };

  const fetchPhoneRequests = async () => {
    try {
      const response = await api.get('/admin/phone-change-requests');
      setPhoneRequests(response.data.requests || []);
    } catch (err) {
      console.error('Failed to fetch phone requests:', err);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get(`/auth/admin/users?page=1&limit=${PAGE_SIZE}`),
      api.get('/auth/admin/admins'),
      api.get('/admin/phone-change-requests')
    ]).then(([usersRes, adminsRes, phoneRes]) => {
      if (usersRes.ok) {
        setUsers(usersRes.data.users);
        setTotal(usersRes.data.total || 0);
      } else {
        setError('获取用户列表失败: ' + (usersRes.data?.error || ''));
      }
      if (adminsRes.ok) {
        setAdmins(adminsRes.data.admins || []);
      }
      if (phoneRes.ok) {
        setPhoneRequests(phoneRes.data.requests || []);
      }
      setLoading(false);
    }).catch(err => {
      console.error('Initial fetch error:', err);
      setError('获取数据失败');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isMobile) setTimeout(() => applyTableLabels(), 100);
  }, [isMobile, users]);

  const handleActivate = async (userId) => {
    try {
      const res = await api.post(`/auth/admin/user/${userId}/activate`);
      if (!res.ok) {
        alert('操作失败: ' + (res.data?.error || ''));
        return;
      }
      setPage(1);
      fetchUsers(1);
    } catch (err) {
      alert('操作失败');
    }
  };

  const handleDeactivate = async (userId) => {
    try {
      const res = await api.post(`/auth/admin/user/${userId}/deactivate`);
      if (!res.ok) {
        alert('操作失败: ' + (res.data?.error || ''));
        return;
      }
      setPage(1);
      fetchUsers(1);
    } catch (err) {
      alert('操作失败');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('确定要删除该用户吗？此操作不可恢复。')) return;
    try {
      console.log('Deleting user:', userId);
      const response = await api.delete(`/auth/admin/user/${userId}`);
      console.log('Delete response:', response);
      if (response.ok) {
        alert('删除成功');
        setPage(1);
        fetchUsers(1);
      } else {
        alert('删除失败: ' + (response.data?.error || '未知错误'));
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('删除失败: ' + err.message);
    }
  };

  const handleApprovePhone = async (requestId) => {
    try {
      await api.post(`/admin/phone-change-requests/${requestId}/approve`);
      alert('已通过');
      fetchPhoneRequests();
      setPage(1);
      fetchUsers(1);
    } catch (err) {
      alert('操作失败');
    }
  };

  const handleRejectPhone = async (requestId) => {
    try {
      await api.post(`/admin/phone-change-requests/${requestId}/reject`);
      alert('已拒绝');
      fetchPhoneRequests();
    } catch (err) {
      alert('操作失败');
    }
  };

  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', id_card: '' });

  const handleAdminDeactivate = async (adminId) => {
    try {
      const res = await api.post(`/auth/admin/admin/${adminId}/deactivate`);
      if (res.ok) {
        fetchAdmins();
      } else {
        alert('操作失败: ' + (res.data?.error || ''));
      }
    } catch (err) {
      alert('操作失败');
    }
  };

  const handleAdminDelete = async (adminId) => {
    if (!window.confirm('确定要删除该管理员吗？此操作不可恢复。')) return;
    try {
      const res = await api.delete(`/auth/admin/admin/${adminId}`);
      if (res.ok) {
        alert('删除成功');
        fetchAdmins();
      } else {
        alert('删除失败: ' + (res.data?.error || ''));
      }
    } catch (err) {
      alert('删除失败');
    }
  };

  const handleAdminEdit = (admin) => {
    setEditForm({ name: admin.name || '', phone: admin.phone || '', id_card: admin.id_card || '' });
    setEditingAdmin(admin);
  };

  const handleAdminUpdate = async () => {
    if (!editingAdmin) return;
    try {
      const res = await api.put(`/auth/admin/admin/${editingAdmin.id}`, editForm);
      if (res.ok) {
        alert('修改成功');
        setEditingAdmin(null);
        fetchAdmins();
      } else {
        alert('修改失败: ' + (res.data?.error || ''));
      }
    } catch (err) {
      alert('修改失败');
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>加载中...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  const pendingRequests = phoneRequests.filter(r => r.status === 'pending');
  const processedRequests = phoneRequests.filter(r => r.status !== 'pending');

  return (
    <div style={{ padding: isMobile ? '8px' : '20px', fontSize: '13px' }}>
      <h2 style={{ marginBottom: isMobile ? '12px' : '20px', fontSize: isMobile ? '16px' : '18px' }}>用户管理</h2>
      
      {pendingRequests.length > 0 && (
        <div style={{ marginBottom: '24px', background: '#fff', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#f57c00' }}>
            待处理手机号修改申请 ({pendingRequests.length})
          </h3>
          {!isMobile && (
          <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '12px' }}>用户</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '12px' }}>原手机号</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '12px' }}>新手机号</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '12px' }}>申请时间</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '12px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map(req => (
                <tr key={req.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>
                    <div>{req.user_name}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>ID: {req.user_id}</div>
                  </td>
                  <td style={{ padding: '8px' }}>{req.old_phone}</td>
                  <td style={{ padding: '8px', fontWeight: '600', color: '#1976d2' }}>{req.new_phone}</td>
                  <td style={{ padding: '8px', fontSize: '12px', color: '#666' }}>
                    {fmtTime(req.requested_at)}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <button
                      onClick={() => handleApprovePhone(req.id)}
                      style={{
                        padding: '4px 12px',
                        marginRight: '8px',
                        background: '#4caf50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      通过
                    </button>
                    <button
                      onClick={() => handleRejectPhone(req.id)}
                      style={{
                        padding: '4px 12px',
                        background: '#f44336',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      拒绝
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingRequests.map(req => (
                <div key={req.id} style={{ background: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{req.user_name}</span>
                    <span style={{ fontSize: '11px', color: '#666' }}>ID: {req.user_id}</span>
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: '1.8', marginBottom: '8px' }}>
                    <div>原手机号：{req.old_phone}</div>
                    <div>新手机号：<span style={{ fontWeight: 600, color: '#1976d2' }}>{req.new_phone}</span></div>
                    <div style={{ color: '#666' }}>申请时间：{fmtTime(req.requested_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleApprovePhone(req.id)} style={{ flex: 1, padding: '8px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>通过</button>
                    <button onClick={() => handleRejectPhone(req.id)} style={{ flex: 1, padding: '8px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>拒绝</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '10px', color: '#333' }}>
          管理员 ({admins.length})
        </h3>
        {!isMobile && (
        <table className="table-card" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', background: '#fff', fontSize: '13px', wordBreak: 'break-word' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ width:'8%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>ID</th>
              <th style={{ width:'12%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>姓名</th>
              <th style={{ width:'12%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>手机号</th>
              <th style={{ width:'18%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>身份证</th>
              <th style={{ width:'8%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>状态</th>
              <th style={{ width:'12%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>注册时间</th>
              <th style={{ width:'12%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>最后登录</th>
              <th style={{ width:'18%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(admin => (
              <tr key={admin.id} style={{ borderBottom: '1px solid #eee', fontSize: '13px' }}>
                <td style={{ padding: '8px', fontSize: '13px' }}>{admin.id}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>{admin.name}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>{admin.phone}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>{admin.id_card}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: admin.is_active ? '#4caf50' : '#f44336',
                    color: '#fff',
                    fontSize: '12px'
                  }}>
                    {admin.is_active ? '已开通' : '未开通'}
                  </span>
                </td>
                <td style={{ padding: '8px', fontSize: '13px' }}>{fmtTime(admin.created_at)}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>
                  {admin.last_login_at ? fmtTime(admin.last_login_at) : '-'}
                </td>
                <td style={{ padding: '8px', fontSize: '13px' }}>
                  <button
                    onClick={() => handleAdminDeactivate(admin.id)}
                    style={{
                      padding: '2px 6px',
                      marginRight: '4px',
                      background: admin.is_active ? '#ff9800' : '#4caf50',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {admin.is_active ? '禁用' : '启用'}
                  </button>
                  <button
                    onClick={() => handleAdminEdit(admin)}
                    style={{
                      padding: '2px 6px',
                      marginRight: '4px',
                      background: '#1976d2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    修改
                  </button>
                  <button
                    onClick={() => handleAdminDelete(admin.id)}
                    style={{
                      padding: '2px 6px',
                      background: '#f44336',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {admins.map(admin => (
              <div key={admin.id} style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{admin.name}</span>
                    <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>#{admin.id}</span>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: admin.is_active ? '#4caf50' : '#f44336', color: '#fff', fontSize: '11px' }}>
                    {admin.is_active ? '已开通' : '未开通'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.8', color: '#333' }}>
                  <div><span style={{ color: '#666' }}>手机号：</span>{admin.phone}</div>
                  <div><span style={{ color: '#666' }}>身份证：</span>{admin.id_card}</div>
                  <div><span style={{ color: '#666' }}>注册时间：</span>{fmtTime(admin.created_at)}</div>
                  <div><span style={{ color: '#666' }}>最后登录：</span>{admin.last_login_at ? fmtTime(admin.last_login_at) : '-'}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                  <button onClick={() => handleAdminDeactivate(admin.id)} style={{ flex: 1, padding: '6px', background: admin.is_active ? '#ff9800' : '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{admin.is_active ? '禁用' : '启用'}</button>
                  <button onClick={() => handleAdminEdit(admin)} style={{ flex: 1, padding: '6px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>修改</button>
                  <button onClick={() => handleAdminDelete(admin.id)} style={{ flex: 1, padding: '6px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>删除</button>
                </div>
              </div>
            ))}
            {admins.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无数据</div>}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '10px', color: '#333' }}>
          用户 ({total})
        </h3>
        {!isMobile && (
        <table className="table-card" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', background: '#fff', fontSize: '13px', wordBreak: 'break-word' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ width:'8%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>ID</th>
              <th style={{ width:'12%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>姓名</th>
              <th style={{ width:'12%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>手机号</th>
              <th style={{ width:'18%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>身份证</th>
              <th style={{ width:'8%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>状态</th>
              <th style={{ width:'12%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>注册时间</th>
              <th style={{ width:'12%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>最后登录</th>
              <th style={{ width:'18%', padding:'8px', textAlign:'left', borderBottom:'1px solid #ddd', fontSize:'12px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #eee', fontSize: '13px' }}>
                <td style={{ padding: '8px', fontSize: '13px' }}>{user.id}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>{user.name}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>{user.phone}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>{user.id_card}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: user.is_active ? '#4caf50' : '#f44336',
                    color: '#fff',
                    fontSize: '12px'
                  }}>
                    {user.is_active ? '已开通' : '未开通'}
                  </span>
                </td>
                <td style={{ padding: '8px', fontSize: '13px' }}>{fmtTime(user.created_at)}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>
                  {user.last_login_at ? fmtTime(user.last_login_at) : '-'}
                </td>
                <td style={{ padding: '8px', fontSize: '13px' }}>
                  {user.is_active ? (
                    <button
                      onClick={() => handleDeactivate(user.id)}
                      style={{
                        padding: '2px 6px',
                        marginRight: '4px',
                        background: '#ff9800',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      禁用
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivate(user.id)}
                      style={{
                        padding: '2px 6px',
                        marginRight: '4px',
                        background: '#4caf50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      开通
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(user.id)}
                    style={{
                      padding: '2px 6px',
                      background: '#f44336',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {users.map(user => (
              <div key={user.id} style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{user.name}</span>
                    <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>#{user.id}</span>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: user.is_active ? '#4caf50' : '#f44336', color: '#fff', fontSize: '11px' }}>
                    {user.is_active ? '已开通' : '未开通'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.8', color: '#333' }}>
                  <div><span style={{ color: '#666' }}>手机号：</span>{user.phone}</div>
                  <div><span style={{ color: '#666' }}>身份证：</span>{user.id_card}</div>
                  <div><span style={{ color: '#666' }}>注册时间：</span>{fmtTime(user.created_at)}</div>
                  <div><span style={{ color: '#666' }}>最后登录：</span>{user.last_login_at ? fmtTime(user.last_login_at) : '-'}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                  {user.is_active ? (
                    <button onClick={() => handleDeactivate(user.id)} style={{ flex: 1, padding: '6px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>禁用</button>
                  ) : (
                    <button onClick={() => handleActivate(user.id)} style={{ flex: 1, padding: '6px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>开通</button>
                  )}
                  <button onClick={() => handleDelete(user.id)} style={{ flex: 1, padding: '6px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>删除</button>
                </div>
              </div>
            ))}
            {users.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无数据</div>}
          </div>
        )}
        <Pagination page={page} total={total} limit={PAGE_SIZE} onPageChange={handlePageChange} />
      </div>

      {editingAdmin && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', width: '400px', maxWidth: '90vw' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>修改管理员信息</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#333' }}>姓名</label>
              <input
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#333' }}>手机号</label>
              <input
                value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#333' }}>身份证</label>
              <input
                value={editForm.id_card}
                onChange={e => setEditForm({ ...editForm, id_card: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setEditingAdmin(null)}
                style={{ padding: '8px 16px', background: '#e0e0e0', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
              >
                取消
              </button>
              <button
                onClick={handleAdminUpdate}
                style={{ padding: '8px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUserManagement;
