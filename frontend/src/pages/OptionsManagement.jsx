import React, { useState, useEffect } from 'react';
import api from '../utils/api';

function OptionsManagement({ isMobile = false }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'reason',
    value: ''
  });

  const CATEGORIES = [
    { value: 'reason', label: '原因' },
    { value: 'status', label: '状态' },
    { value: 'courier', label: '快递' },
    { value: 'warehouse', label: '仓库' },
    { value: 'platform', label: '平台' },
    { value: 'battery_require', label: '电池要求' },
    { value: 'repair_platform', label: '报修平台' },
    { value: 'return_reason', label: '返厂原因' }
  ];

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const response = await api.get('/options');
      setRecords(response.data.records);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/options', formData);
      setFormData({ ...formData, value: '' });
      fetchRecords();
    } catch (error) {
      alert('创建失败：' + (error.response?.data?.error || '未知错误'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除该记录吗？')) return;
    try {
      await api.delete(`/options/${id}`);
      fetchRecords();
    } catch (error) {
      alert('删除失败');
    }
  };

  const getCategoryLabel = (category) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  const groupedRecords = records.reduce((acc, record) => {
    if (!acc[record.category]) {
      acc[record.category] = [];
    }
    acc[record.category].push(record);
    return acc;
  }, {});

  const inputStyle = {
    width: '100%',
    padding: '4px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    height: '28px',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '4px',
    fontWeight: 'bold',
    fontSize: '12px',
    color: '#333'
  };

  return (
    <div style={{ padding: isMobile ? '8px' : '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '12px' : '16px' }}>
        <h3 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: '600' }}>选项数据管理</h3>
        <button
          onClick={() => setShowForm(!showForm)}
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
          {showForm ? '关闭表单' : '新增选项'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxWidth: '400px' }}>
            <div>
              <label style={labelStyle}>类别 *</label>
              <select 
                style={inputStyle} 
                value={formData.category} 
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>选项值 *</label>
              <input 
                style={inputStyle} 
                value={formData.value} 
                onChange={e => setFormData({...formData, value: e.target.value})} 
                placeholder="请输入选项值"
                required 
              />
            </div>
          </div>
          <button type="submit" style={{ marginTop: '16px', padding: '8px 24px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
            提交
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载中...</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', padding: '16px' }}>
          {CATEGORIES.map(cat => (
            <div key={cat.value} style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', color: '#333' }}>
                {cat.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {groupedRecords[cat.value]?.map(record => (
                  <span
                    key={record.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      background: '#e3f2fd',
                      borderRadius: '4px',
                      fontSize: '13px',
                      color: '#1976d2'
                    }}
                  >
                    {record.value}
                    <button
                      onClick={() => handleDelete(record.id)}
                      style={{
                        marginLeft: '6px',
                        background: 'none',
                        border: 'none',
                        color: '#1976d2',
                        cursor: 'pointer',
                        fontSize: '14px',
                        lineHeight: 1,
                        padding: '0 2px'
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {(!groupedRecords[cat.value] || groupedRecords[cat.value].length === 0) && (
                  <span style={{ color: '#999', fontSize: '13px' }}>暂无数据</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OptionsManagement;
