import React, { useState, useEffect } from 'react';
import { formatOrderNo } from '../utils/validation';
import API_BASE_URL from '../config/api';

function MaintenanceRegistrationShare() {
  const [showForm, setShowForm] = useState(true);
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  
  const [options, setOptions] = useState({
    brands: [],
    models: [],
    types: [],
    colors: [],
    specs: [],
    reasons: [],
    statuses: [],
    couriers: [],
    warehouses: [],
    platforms: [],
    battery_requires: [],
    repair_platforms: [],
    return_reasons: []
  });

  const [addressOptions, setAddressOptions] = useState({
    provinces: [],
    cities: [],
    districts: [],
    towns: []
  });

  const [formData, setFormData] = useState({
    维修单号: '',
    省份: '', 省份adcode: '', 城市: '', 城市adcode: '', 区县: '', 区县adcode: '', 镇街道: '', 镇街道adcode: '', 详细地址: '',
    联系人: '', 联系电话: '',
    品牌: '', 型号: '', 类型: '', 颜色: '',
    电池要求: '', 设备条码: '', 购买日期: '', 购买平台: '',
    订单编号: '', 保修状态: '', 返厂原因: '', 故障描述: '',
    返厂快递: '', 返厂单号: '', 寄回快递: '', 寄回单号: '',
    登记人: '', 状态: '', 报修平台: ''
  });

  const [errors, setErrors] = useState({});

  const generateMaintenanceNo = () => {
    const d = new Date();
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const ts = d.getTime().toString().slice(-6);
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `WX${y}${m}${day}${ts}${rand}`;
  };

  const fetchOptions = async () => {
    try {
      const res = await fetch(API_BASE_URL + '/api/maintenance-public/options');
      const data = await res.json();
      setOptions({
        brands: data.brands || [],
        models: data.models || [],
        types: data.types || [],
        colors: data.colors || [],
        specs: data.specs || [],
        platforms: data.platforms || [],
        warehouses: data.warehouses || [],
        reasons: data.reasons || [],
        statuses: data.statuses || [],
        couriers: data.couriers || [],
        battery_requires: data.battery_requires || [],
        repair_platforms: data.repair_platforms || [],
        return_reasons: data.return_reasons || []
      });
    } catch (err) {
      console.error('获取选项失败', err);
    }
  };

  const fetchProvinces = async () => {
    try {
      const res = await fetch(API_BASE_URL + '/api/districts');
      const data = await res.json();
      if (data.status === '1' && data.districts) {
        setAddressOptions(prev => ({ ...prev, provinces: data.districts }));
      }
    } catch (err) {
      console.error('获取省份失败', err);
    }
  };

  const fetchCities = async (adcode) => {
    try {
      const res = await fetch(API_BASE_URL + `/api/districts?adcode=${adcode}`);
      const data = await res.json();
      if (data.status === '1' && data.districts) {
        setAddressOptions(prev => ({ ...prev, cities: data.districts }));
      }
    } catch (err) {
      console.error('获取城市失败', err);
    }
  };

  const isDirectControlledCity = (items) => {
    return items.length > 0 && items[0].level === 'street';
  };

  const fetchDistricts = async (adcode) => {
    try {
      const res = await fetch(API_BASE_URL + `/api/districts?adcode=${adcode}`);
      const data = await res.json();
      if (data.status === '1' && data.districts) {
        const items = data.districts;
        if (isDirectControlledCity(items)) {
          setAddressOptions(prev => ({ ...prev, districts: [], towns: items }));
        } else {
          setAddressOptions(prev => ({ ...prev, districts: items, towns: [] }));
        }
      }
    } catch (err) {
      console.error('获取区县失败', err);
    }
  };

  const fetchTowns = async (adcode) => {
    try {
      const res = await fetch(API_BASE_URL + `/api/districts?adcode=${adcode}`);
      const data = await res.json();
      if (data.status === '1' && data.districts) {
        setAddressOptions(prev => ({ ...prev, towns: data.districts }));
      }
    } catch (err) {
      console.error('获取街道失败', err);
    }
  };

  const handleProvinceChange = (e) => {
    const adcode = e.target.value;
    const name = e.target.options[e.target.selectedIndex]?.text || '';
    setFormData(prev => ({ 
      ...prev, 
      省份: name, 
      省份adcode: adcode,
      城市: '', 城市adcode: '', 
      区县: '', 区县adcode: '', 
      镇街道: '', 镇街道adcode: '' 
    }));
    setAddressOptions(prev => ({ ...prev, cities: [], districts: [], towns: [] }));
    if (adcode) {
      fetchCities(adcode);
    }
  };

  const handleCityChange = (e) => {
    const adcode = e.target.value;
    const name = e.target.options[e.target.selectedIndex]?.text || '';
    setFormData(prev => ({ 
      ...prev, 
      城市: name, 
      城市adcode: adcode,
      区县: '', 区县adcode: '', 
      镇街道: '', 镇街道adcode: '' 
    }));
    setAddressOptions(prev => ({ ...prev, districts: [], towns: [] }));
    if (adcode) {
      fetchDistricts(adcode);
    }
  };

  const handleDistrictChange = (e) => {
    const name = e.target.value;
    const district = addressOptions.districts.find(d => d.name === name);
    const adcode = district?.adcode || '';
    setFormData(prev => ({ 
      ...prev, 
      区县: name, 
      区县adcode: adcode,
      镇街道: '', 镇街道adcode: '' 
    }));
    setAddressOptions(prev => ({ ...prev, towns: [] }));
    if (adcode) {
      fetchTowns(adcode);
    }
  };

  const handleTownChange = (e) => {
    const name = e.target.value;
    const town = addressOptions.towns.find(t => t.name === name);
    const adcode = town?.adcode || '';
    setFormData(prev => ({ ...prev, 镇街道: name, 镇街道adcode: adcode }));
  };

  const openAddForm = () => {
    const newNo = generateMaintenanceNo();
    setFormData({
      维修单号: newNo,
      省份: '', 省份adcode: '', 城市: '', 城市adcode: '', 区县: '', 区县adcode: '', 镇街道: '', 镇街道adcode: '', 详细地址: '',
      联系人: '', 联系电话: '',
      品牌: '', 型号: '', 类型: '', 颜色: '',
      电池要求: '', 设备条码: '', 购买日期: '', 购买平台: '',
      订单编号: '', 保修状态: '', 返厂原因: '', 故障描述: '',
      返厂快递: '', 返厂单号: '', 寄回快递: '', 寄回单号: '',
      登记人: '访客', 状态: '待处理', 报修平台: ''
    });
    setErrors({});
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const requiredFields = ['维修单号', '联系人', '联系电话', '品牌', '型号', '类型', '颜色'];
    const newErrors = {};
    let hasError = false;
    requiredFields.forEach(field => {
      const value = formData[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        newErrors[field] = `${field}为必填项`;
        hasError = true;
      }
    });
    
    if (formData.联系电话 && !/^\d{11}$/.test(formData.联系电话)) {
      newErrors['联系电话'] = '联系电话必须是 11 位数字';
      hasError = true;
    }
    
    if (hasError) {
      setErrors(newErrors);
      alert('请填写所有必填项');
      return;
    }
    try {
      const res = await fetch(API_BASE_URL + '/api/maintenance-public/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      const maintenanceId = result.维修单号 || result.id;
      
      if (selectedFiles.length > 0 && maintenanceId) {
        for (const file of selectedFiles) {
          const formDataUpload = new FormData();
          formDataUpload.append('file', file);
          formDataUpload.append('maintenance_id', maintenanceId);
          formDataUpload.append('status', 'pending');
          await fetch(API_BASE_URL + `/api/maintenance-public/attachments/${maintenanceId}`, {
            method: 'POST',
            body: formDataUpload
          });
        }
      }
      
      alert('登记成功！感谢您的提交。');
      setShowForm(false);
      setSelectedFiles([]);
      setFilePreviews([]);
      // 重新打开表单准备下一次提交
      setTimeout(() => openAddForm(), 1000);
    } catch (e) {
      console.error('保存记录失败', e);
      alert('保存失败: ' + (e.message || '未知错误'));
    }
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    const allFiles = [...selectedFiles, ...newFiles];
    setSelectedFiles(allFiles);
    
    const previews = newFiles.map(file => {
      const fileType = file.type || '';
      const isImage = fileType.startsWith('image/');
      const isVideo = fileType.startsWith('video/');
      return {
        file,
        preview: isImage || isVideo ? URL.createObjectURL(file) : null,
        name: file.name,
        type: fileType
      };
    });
    setFilePreviews([...filePreviews, ...previews]);
  };

  const fetchCascadeOptions = async (field, value) => {
    const { 品牌, 型号, 类型, 颜色 } = formData;
    
    try {
      if (field === '品牌' && value) {
        const res = await fetch(API_BASE_URL + `/api/product-data/models/${encodeURIComponent(value)}`);
        const data = await res.json();
        setOptions(prev => ({ ...prev, models: data.models || [] }));
        setFormData(prev => ({ ...prev, 型号: '', 类型: '', 颜色: '' }));
      } else if (field === '型号' && 品牌 && value) {
        const res = await fetch(API_BASE_URL + `/api/product-data/types/${encodeURIComponent(品牌)}/${encodeURIComponent(value)}`);
        const data = await res.json();
        setOptions(prev => ({ ...prev, types: data.types || [] }));
        setFormData(prev => ({ ...prev, 类型: '', 颜色: '' }));
      } else if (field === '类型' && 品牌 && 型号 && value) {
        const res = await fetch(API_BASE_URL + `/api/product-data/colors/${encodeURIComponent(品牌)}/${encodeURIComponent(型号)}/${encodeURIComponent(value)}`);
        const data = await res.json();
        setOptions(prev => ({ ...prev, colors: data.colors || [] }));
        setFormData(prev => ({ ...prev, 颜色: '' }));
      } else if (field === '颜色' && 品牌 && 型号 && 类型 && value) {
        const res = await fetch(API_BASE_URL + `/api/product-data/specs/${encodeURIComponent(品牌)}/${encodeURIComponent(型号)}/${encodeURIComponent(类型)}/${encodeURIComponent(value)}`);
        const data = await res.json();
        setOptions(prev => ({ ...prev, specs: data.specs || [] }));
      }
    } catch (err) {
      console.error('获取级联选项失败', err);
    }
  };

  const handleFormChange = (field, value) => {
    if (field === '联系电话') {
      const numericValue = value.replace(/\D/g, '').slice(0, 11);
      value = numericValue;
    }
    
    let newData = { ...formData, [field]: value };
    if (field === '品牌') {
      newData = { ...newData, 型号: '', 类型: '', 颜色: '' };
      setOptions(prev => ({ ...prev, models: [], types: [], colors: [] }));
    } else if (field === '型号') {
      newData = { ...newData, 类型: '', 颜色: '' };
      setOptions(prev => ({ ...prev, types: [], colors: [] }));
    } else if (field === '类型') {
      newData = { ...newData, 颜色: '' };
      setOptions(prev => ({ ...prev, colors: [] }));
    }
    setFormData(newData);
    if (value) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    fetchCascadeOptions(field, value);
    if (field === '购买日期') {
      const warrantyStatus = calculateWarrantyStatus(value);
      setFormData(prev => ({ ...prev, 保修状态: warrantyStatus }));
    }
  };

  const calculateWarrantyStatus = (purchaseDate) => {
    if (!purchaseDate) return '';
    const purchase = new Date(purchaseDate);
    const now = new Date();
    const diffTime = now - purchase;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays > 365) {
      return '已过质保期';
    } else {
      return '未过质保期';
    }
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

  const labelStyle = (fieldName) => ({
    display: 'block',
    marginBottom: '4px',
    fontWeight: 'bold',
    fontSize: '13px',
    color: errors[fieldName] ? '#d32f2f' : '#333'
  });

  const inputStyle = (fieldName) => ({
    width: '100%',
    padding: '4px 8px',
    border: errors[fieldName] ? '2px solid #d32f2f' : '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    height: '28px',
    boxSizing: 'border-box'
  });

  useEffect(() => {
    fetchOptions();
    fetchProvinces();
    openAddForm();
  }, []);

  return (
    <>
      <style>{`
        body {
          margin: 0;
          padding: 0;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
      `}</style>
      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>维修登记</h3>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {/* 第一行：维修单号 */}
              <div>
                <label style={labelStyle('维修单号')}>维修单号</label>
                <input style={{...inputStyle('维修单号'), background: '#f5f5f5', color: '#666'}} value={formData.维修单号 || ''} readOnly />
              </div>
              <div>
                <label style={labelStyle('购买日期')}>购买日期</label>
                <input style={inputStyle('购买日期')} type="date" max={new Date().toISOString().split('T')[0]} value={formData.购买日期} onChange={e => handleFormChange('购买日期', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle('购买平台')}>购买平台</label>
                <select style={inputStyle('购买平台')} value={formData.购买平台} onChange={e => handleFormChange('购买平台', e.target.value)}>
                  <option value="">请选择购买平台</option>
                  {options.platforms.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle('订单编号')}>订单编号</label>
                <input style={inputStyle('订单编号')} value={formData.订单编号} onChange={e => handleFormChange('订单编号', formatOrderNo(e.target.value))} placeholder="只能输入字母和数字" />
              </div>

              {/* 第二行：品牌 型号 类型 颜色 */}
              <div>
                <label style={labelStyle('品牌')}>品牌 *</label>
                <select style={inputStyle('品牌')} value={formData.品牌} onChange={e => handleFormChange('品牌', e.target.value)}>
                  <option value="">请选择品牌</option>
                  {options.brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {errors['品牌'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['品牌']}</div>}
              </div>
              <div>
                <label style={labelStyle('型号')}>型号 *</label>
                <select style={inputStyle('型号')} value={formData.型号} onChange={e => handleFormChange('型号', e.target.value)} disabled={!formData.品牌}>
                  <option value="">请选择型号</option>
                  {options.models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {errors['型号'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['型号']}</div>}
              </div>
              <div>
                <label style={labelStyle('类型')}>类型 *</label>
                <select style={inputStyle('类型')} value={formData.类型} onChange={e => handleFormChange('类型', e.target.value)} disabled={!formData.型号}>
                  <option value="">请选择类型</option>
                  {options.types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors['类型'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['类型']}</div>}
              </div>
              <div>
                <label style={labelStyle('颜色')}>颜色 *</label>
                <select style={inputStyle('颜色')} value={formData.颜色} onChange={e => handleFormChange('颜色', e.target.value)} disabled={!formData.类型}>
                  <option value="">请选择颜色</option>
                  {options.colors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors['颜色'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['颜色']}</div>}
              </div>

              {/* 第三行：电池要求 设备条码 保修状态 报修平台 */}
              <div>
                <label style={labelStyle('电池要求')}>电池要求</label>
                <select style={inputStyle('电池要求')} value={formData.电池要求} onChange={e => handleFormChange('电池要求', e.target.value)}>
                  <option value="">请选择电池要求</option>
                  {options.battery_requires.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle('设备条码')}>设备条码</label>
                <input style={inputStyle('设备条码')} value={formData.设备条码} onChange={e => handleFormChange('设备条码', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle('保修状态')}>保修状态</label>
                <input 
                  style={{ ...inputStyle('保修状态'), backgroundColor: '#f5f5f5', color: formData.保修状态 === '已过质保期' ? '#d32f2f' : '#388e3c', fontWeight: 'bold' }} 
                  value={formData.保修状态 || '请先选择购买日期'} 
                  readOnly 
                />
              </div>
              <div>
                <label style={labelStyle('报修平台')}>报修平台</label>
                <select style={inputStyle('报修平台')} value={formData.报修平台} onChange={e => handleFormChange('报修平台', e.target.value)}>
                  <option value="">请选择报修平台</option>
                  {options.repair_platforms.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* 第四行：省份 城市 区县 镇街道 */}
              <div>
                <label style={labelStyle('省份')}>省份</label>
                <select style={inputStyle('省份')} value={formData.省份adcode || ''} onChange={handleProvinceChange}>
                  <option value="">请选择省份</option>
                  {addressOptions.provinces.map(p => <option key={p.adcode} value={p.adcode}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle('城市')}>城市</label>
                <select style={inputStyle('城市')} value={formData.城市adcode || ''} onChange={handleCityChange} disabled={!addressOptions.cities.length}>
                  <option value="">请选择城市</option>
                  {addressOptions.cities.map(c => <option key={`${c.adcode}-${c.name}`} value={c.adcode}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle('区县')}>区县</label>
                <select style={inputStyle('区县')} value={formData.区县 || ''} onChange={handleDistrictChange} disabled={!addressOptions.districts.length}>
                  <option value="">请选择区县</option>
                  {addressOptions.districts.map(d => <option key={`${d.adcode}-${d.name}`} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle('镇街道')}>镇街道</label>
                <select style={inputStyle('镇街道')} value={formData.镇街道 || ''} onChange={handleTownChange} disabled={!addressOptions.towns.length}>
                  <option value="">请选择镇街道</option>
                  {addressOptions.towns.map(t => <option key={`${t.adcode}-${t.name}`} value={t.name}>{t.name}</option>)}
                </select>
              </div>

              {/* 第五行：详细地址 */}
              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle('详细地址')}>详细地址</label>
                <input style={{...inputStyle('详细地址'), width: '100%'}} value={formData.详细地址} onChange={e => handleFormChange('详细地址', e.target.value)} />
              </div>

              {/* 第六行：联系人 联系电话 */}
              <div>
                <label style={labelStyle('联系人')}>联系人 *</label>
                <input style={inputStyle('联系人')} value={formData.联系人} onChange={e => handleFormChange('联系人', e.target.value)} />
                {errors['联系人'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['联系人']}</div>}
              </div>
              <div>
                <label style={labelStyle('联系电话')}>联系电话 *</label>
                <input style={inputStyle('联系电话')} value={formData.联系电话} onChange={e => handleFormChange('联系电话', e.target.value)} />
                {errors['联系电话'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['联系电话']}</div>}
              </div>
              <div>
                <label style={labelStyle('返厂原因')}>返厂原因</label>
                <select style={inputStyle('返厂原因')} value={formData.返厂原因} onChange={e => handleFormChange('返厂原因', e.target.value)}>
                  <option value="">请选择返厂原因</option>
                  {options.return_reasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle('故障描述')}>故障描述</label>
                <input style={inputStyle('故障描述')} value={formData.故障描述} onChange={e => handleFormChange('故障描述', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle('返厂快递')}>返厂快递</label>
                <select style={inputStyle('返厂快递')} value={formData.返厂快递} onChange={e => handleFormChange('返厂快递', e.target.value)}>
                  <option value="">请选择快递</option>
                  {options.couriers.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle('返厂单号')}>返厂单号</label>
                <input style={inputStyle('返厂单号')} value={formData.返厂单号} onChange={e => handleFormChange('返厂单号', formatOrderNo(e.target.value))} placeholder="只能输入字母和数字" />
              </div>

              {/* 第七行：登记人 */}
              <div>
                <label style={labelStyle('登记人')}>登记人</label>
                <input style={{...inputStyle('登记人'), background: '#f5f5f5', color: '#666'}} value={formData.登记人 || ''} readOnly />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>附件上传</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {filePreviews.map((item, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '60px', height: '60px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                    {item.preview ? (
                      item.type.startsWith('video/') ? (
                        <div 
                          onClick={() => openPreview(item.preview, 'video')}
                          style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative' }}
                        >
                          <video src={item.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '24px', color: '#fff', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>▶</div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => openPreview(item.preview, 'image')}
                          style={{ width: '100%', height: '100%', cursor: 'pointer' }}
                        >
                          <img 
                            src={item.preview} 
                            alt={item.name} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      )
                    ) : (
                      <>
                        <span style={{ position: 'absolute', bottom: '2px', left: '2px', right: '2px', fontSize: '9px', color: '#fff', background: 'rgba(0,0,0,0.5)', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.name}</span>
                        <button 
                          onClick={() => {
                            const newFiles = selectedFiles.filter((_, i) => i !== idx);
                            const newPreviews = filePreviews.filter((_, i) => i !== idx);
                            setSelectedFiles(newFiles);
                            setFilePreviews(newPreviews);
                          }}
                          style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', padding: '0', fontSize: '12px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', lineHeight: '1' }}
                        >×</button>
                      </>
                    )}
                  </div>
                ))}
                <label style={{ 
                  width: '60px', 
                  height: '60px', 
                  border: '2px dashed #4caf50', 
                  borderRadius: '4px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  fontSize: '32px',
                  color: '#4caf50',
                  background: '#f9f9f9'
                }}>
                  +
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*,video/*,.pdf" 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }} 
                  />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button type="submit" style={{ padding: '8px 24px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
                提交登记
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 预览模态框 */}
      {showPreviewModal && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.8)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 2000 
          }}
          onClick={closePreview}
        >
          <div 
            style={{ 
              maxWidth: '90%', 
              maxHeight: '90%', 
              position: 'relative' 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={closePreview}
              style={{ 
                position: 'absolute', 
                top: '-40px', 
                right: '0', 
                background: 'transparent', 
                border: 'none', 
                color: '#fff', 
                fontSize: '32px', 
                cursor: 'pointer' 
              }}
            >
              ×
            </button>
            {previewType === 'image' && (
              <img src={previewUrl} alt="预览" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} />
            )}
            {previewType === 'video' && (
              <video src={previewUrl} controls style={{ maxWidth: '100%', maxHeight: '90vh' }} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default MaintenanceRegistrationShare;
