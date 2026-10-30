import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import Pagination from '../components/Pagination';
import { applyTableLabels } from '../utils/responsiveTable';
const PAGE_SIZE = 20;

function ProductDataManagement({ isMobile = false }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [formData, setFormData] = useState({ brand: '', model: '', type: '', color: '', spec: '', price: '' });
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [types, setTypes] = useState([]);
  const [colors, setColors] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [inputMode, setInputMode] = useState({
    brand: 'select', model: 'select', type: 'select', color: 'select', spec: 'select'
  });
  const [filters, setFilters] = useState({ brand: '', model: '', type: '', color: '', spec: '' });
  const [filterOptions, setFilterOptions] = useState({ models: [], types: [], colors: [], specs: [] });
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    const manualField = Object.entries(inputMode).find(([, mode]) => mode === 'manual');
    if (manualField) {
      const el = document.getElementById(`field-${manualField[0]}`);
      if (el && el.tagName === 'INPUT') el.focus();
    }
  }, [inputMode]);

  useEffect(() => {
    fetchOptions();
    fetchRecords();
  }, []);

  useEffect(() => {
    if (isMobile) setTimeout(() => applyTableLabels(), 100);
  }, [isMobile, records]);

  const fetchOptions = async () => {
    try {
      const res = await api.get('/product-data/options');
      setBrands(res.data.brands || []);
      setModels(res.data.models || []);
      setTypes(res.data.types || []);
      setColors(res.data.colors || []);
      setSpecs(res.data.specs || []);
    } catch (e) {
      console.error('获取选项列表失败:', e);
    }
  };

  const autoFillPrice = async (brand, model, type, color, spec) => {
    if (!brand || !model || !type || !color || !spec) return;
    try {
      const res = await api.get(`/product-data/price/${encodeURIComponent(brand)}/${encodeURIComponent(model)}/${encodeURIComponent(type)}/${encodeURIComponent(color)}/${encodeURIComponent(spec)}`);
      if (res.data.price != null) {
        setFormData(prev => ({ ...prev, price: String(res.data.price) }));
      }
    } catch (e) { /* silent */ }
  };

  const handleFormChange = (field, value) => {
    const upd = { ...formData, [field]: value };

    if (field === 'spec' && value && upd.brand && upd.model && upd.type && upd.color) {
      autoFillPrice(upd.brand, upd.model, upd.type, upd.color, value);
    }

    setFormData(upd);
  };

  const toggleInputMode = (field) => {
    setInputMode(prev => {
      const next = prev[field] === 'select' ? 'manual' : 'select';
      return { ...prev, [field]: next };
    });
  };

  const fetchRecords = async (p, filterOverride) => {
    const currentPage = p || page;
    const f = filterOverride || filters;
    const params = new URLSearchParams({ page: currentPage, limit: PAGE_SIZE });
    ['brand', 'model', 'type', 'color', 'spec'].forEach(k => {
      if (f[k]) params.set(k, f[k]);
    });
    try {
      const response = await api.get(`/product-data?${params.toString()}`);
      setRecords(response.data.records);
      setTotal(response.data.total || 0);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      setLoading(false);
    }
  };

  const clearFilterLevels = (fromIndex) => {
    const order = ['brand', 'model', 'type', 'color', 'spec'];
    const cleared = {};
    order.slice(fromIndex).forEach(k => { cleared[k] = ''; });
    return cleared;
  };

  const fetchFilterCascade = async (field, value, next) => {
    try {
      if (field === 'brand') {
        if (value) {
          const res = await api.get(`/product-data/models?brand=${encodeURIComponent(value)}`);
          setFilterOptions(p => ({ ...p, models: res.data.models || [] }));
        } else {
          setFilterOptions({ models: [], types: [], colors: [], specs: [] });
        }
      } else if (field === 'model') {
        if (value) {
          const res = await api.get(`/product-data/types?brand=${encodeURIComponent(next.brand)}&model=${encodeURIComponent(value)}`);
          setFilterOptions(p => ({ ...p, types: res.data.types || [] }));
        } else {
          setFilterOptions(p => ({ ...p, types: [], colors: [], specs: [] }));
        }
      } else if (field === 'type') {
        if (value) {
          const res = await api.get(`/product-data/colors?brand=${encodeURIComponent(next.brand)}&model=${encodeURIComponent(next.model)}&type=${encodeURIComponent(value)}`);
          setFilterOptions(p => ({ ...p, colors: res.data.colors || [] }));
        } else {
          setFilterOptions(p => ({ ...p, colors: [], specs: [] }));
        }
      } else if (field === 'color') {
        if (value) {
          const res = await api.get(`/product-data/specs?brand=${encodeURIComponent(next.brand)}&model=${encodeURIComponent(next.model)}&type=${encodeURIComponent(next.type)}&color=${encodeURIComponent(value)}`);
          setFilterOptions(p => ({ ...p, specs: res.data.specs || [] }));
        } else {
          setFilterOptions(p => ({ ...p, specs: [] }));
        }
      }
    } catch (e) {
      console.error('获取级联筛选选项失败:', e);
    }
  };

  const handleFilterChange = (field, value) => {
    const order = ['brand', 'model', 'type', 'color', 'spec'];
    const idx = order.indexOf(field);
    const next = { ...filters, [field]: value, ...clearFilterLevels(idx + 1) };
    setFilters(next);
    fetchFilterCascade(field, value, next);
    setPage(1);
    fetchRecords(1, next);
  };

  const clearFilters = () => {
    const empty = { brand: '', model: '', type: '', color: '', spec: '' };
    setFilters(empty);
    setFilterOptions({ models: [], types: [], colors: [], specs: [] });
    setPage(1);
    fetchRecords(1, empty);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchRecords(newPage);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData, price: formData.price ? parseFloat(formData.price) : null };
      if (editingId) {
        await api.put(`/product-data/${editingId}`, data);
        setShowForm(false);
        resetForm();
        showToast('数据更新成功！');
      } else {
        await api.post('/product-data', data);
        showToast('数据创建成功！');
      }
      fetchOptions();
      fetchRecords(page);
    } catch (error) {
      showToast('操作失败：' + (error.response?.data?.error || '未知错误'), 'error');
    }
  };

  const handleEdit = async (record) => {
    const vals = {
      brand: record.brand || '',
      model: record.model || '',
      type: record.type || '',
      color: record.color || '',
      spec: record.spec || '',
      price: record.price != null ? String(record.price) : ''
    };
    setFormData(vals);
    setEditingId(record.id);
    setInputMode({ brand: 'select', model: 'select', type: 'select', color: 'select', spec: 'select' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/product-data/${id}`);
      const resp = await api.get(`/product-data?page=${page}&limit=${PAGE_SIZE}`);
      if (resp.data.records.length === 0 && page > 1) {
        const prevPage = page - 1;
        setPage(prevPage);
        fetchRecords(prevPage);
      } else {
        setRecords(resp.data.records);
        setTotal(resp.data.total || 0);
      }
      fetchOptions();
      showToast('删除成功');
    } catch (error) {
      showToast('删除失败', 'error');
    }
  };

  const resetForm = () => {
    setFormData({ brand: '', model: '', type: '', color: '', spec: '', price: '' });
    setEditingId(null);
    setInputMode({ brand: 'select', model: 'select', type: 'select', color: 'select', spec: 'select' });
  };

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
    display: 'flex',
    alignItems: 'center',
    marginBottom: '4px',
    fontWeight: 'bold',
    fontSize: '12px',
    color: '#333',
    gap: '6px'
  };

  const modeToggleStyle = {
    cursor: 'pointer',
    fontSize: '11px',
    color: '#1976d2',
    textDecoration: 'none',
    fontWeight: 'normal',
    userSelect: 'none'
  };

  const renderCascadeField = (label, field, options, required) => {
    const isSelect = inputMode[field] === 'select';
    return (
      <div>
        <label style={labelStyle} htmlFor={`field-${field}`}>
          <span>{label} {required && '*'}</span>
          <span style={modeToggleStyle} onClick={() => toggleInputMode(field)}>
            [{isSelect ? '手动输入' : '选择'}]
          </span>
        </label>
        {isSelect ? (
          <select
            id={`field-${field}`}
            value={formData[field]}
            onChange={e => handleFormChange(field, e.target.value)}
            style={inputStyle}
            required={required}
          >
            <option value="">-- 请选择 --</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            id={`field-${field}`}
            style={inputStyle}
            value={formData[field]}
            onChange={e => handleFormChange(field, e.target.value)}
            required={required}
            placeholder="手动输入"
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: isMobile ? '8px' : '16px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#d32f2f' : '#4caf50', color: '#fff',
          padding: '10px 24px', borderRadius: '6px', fontSize: '14px', zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          {toast.msg}
        </div>
      )}

      {confirmDelete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9998
        }} onClick={() => setConfirmDelete(null)}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', minWidth: '300px', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '15px', marginBottom: '20px' }}>确定要删除该记录吗？</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ padding: '6px 20px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '13px' }}>
                取消
              </button>
              <button onClick={() => { const id = confirmDelete; setConfirmDelete(null); handleDelete(id); }}
                style={{ padding: '6px 20px', border: 'none', borderRadius: '4px', background: '#f44336', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>
                删除
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '12px' : '16px' }}>
        <h3 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: '600' }}>产品数据管理</h3>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
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
          {showForm ? '关闭表单' : '新增数据'}
        </button>
      </div>

      {/* ===== 实时筛选区 ===== */}
      <div style={{ background: '#fff', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '10px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}><span>品牌</span></label>
            <select style={inputStyle} value={filters.brand} onChange={e => handleFilterChange('brand', e.target.value)}>
              <option value="">全部</option>
              {brands.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}><span>型号</span></label>
            <select style={inputStyle} value={filters.model} onChange={e => handleFilterChange('model', e.target.value)} disabled={!filters.brand}>
              <option value="">全部</option>
              {filterOptions.models.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}><span>类型</span></label>
            <select style={inputStyle} value={filters.type} onChange={e => handleFilterChange('type', e.target.value)} disabled={!filters.model}>
              <option value="">全部</option>
              {filterOptions.types.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}><span>颜色</span></label>
            <select style={inputStyle} value={filters.color} onChange={e => handleFilterChange('color', e.target.value)} disabled={!filters.type}>
              <option value="">全部</option>
              {filterOptions.colors.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}><span>规格</span></label>
            <select style={inputStyle} value={filters.spec} onChange={e => handleFilterChange('spec', e.target.value)} disabled={!filters.color}>
              <option value="">全部</option>
              {filterOptions.specs.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={clearFilters}
            style={{ padding: '5px 14px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
            清除筛选
          </button>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {Object.values(filters).some(Boolean) ? `当前筛选结果：共 ${total} 条` : `共 ${total} 条`}
          </span>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px' }}>
            {renderCascadeField('品牌', 'brand', brands, true)}
            {renderCascadeField('型号', 'model', models)}
            {renderCascadeField('类型', 'type', types)}
            {renderCascadeField('颜色', 'color', colors)}
            {renderCascadeField('规格', 'spec', specs)}
            <div>
              <label style={labelStyle}><span>价格</span></label>
              <input style={inputStyle} type="number" step="0.01" value={formData.price}
                onChange={e => setFormData(p => ({ ...p, price: e.target.value }))} />
            </div>
          </div>
          <button type="submit" style={{ marginTop: '16px', padding: '8px 24px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
            {editingId ? '更新数据' : '提交数据'}
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载中...</div>
      ) : (
        <>
        {!isMobile && (
        <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
          <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', width: '50px' }}>ID</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', width: '12%' }}>品牌</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', width: '10%' }}>型号</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', width: '10%' }}>类型</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', width: '10%' }}>颜色</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', width: '15%' }}>规格</th>
                <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', width: '10%' }}>价格</th>
                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', width: '100px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px' }}>{record.id}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.brand || '-'}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.model || '-'}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.type || '-'}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.color || '-'}</td>
                  <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.spec || '-'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{record.price || '-'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleEdit(record)}
                      style={{
                        padding: '3px 8px',
                        background: '#2196f3',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginRight: '4px'
                      }}
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setConfirmDelete(record.id)}
                      style={{
                        padding: '3px 8px',
                        background: '#f44336',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
        {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {records.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>暂无数据</div>}
          {records.map(record => (
            <div key={record.id} style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee', padding: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>{record.brand || '-'} {record.model || '-'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '13px', lineHeight: '2' }}>
                <div><span style={{ color: '#666' }}>类型：</span>{record.type || '-'}</div>
                <div><span style={{ color: '#666' }}>颜色：</span>{record.color || '-'}</div>
                <div><span style={{ color: '#666' }}>规格：</span>{record.spec || '-'}</div>
                <div><span style={{ color: '#666' }}>价格：</span><span style={{ fontWeight: 600, color: '#d32f2f' }}>{record.price || '-'}</span></div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #eee' }}>
                <button onClick={() => handleEdit(record)} style={{ padding: '4px 12px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>编辑</button>
                <button onClick={() => setConfirmDelete(record.id)} style={{ padding: '4px 12px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>删除</button>
              </div>
            </div>
          ))}
        </div>
        )}
        </>
      )}
      <Pagination page={page} total={total} limit={PAGE_SIZE} onPageChange={handlePageChange} />
    </div>
  );
}

export default ProductDataManagement;
