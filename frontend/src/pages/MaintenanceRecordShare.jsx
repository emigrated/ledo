import React, { useState, useEffect, useRef } from 'react';
import API_BASE_URL from '../config/api';
import { fmtTime, fmtDate } from '../utils/time';

function MaintenanceRecordShare() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState({});
  const [search, setSearch] = useState('');
  const [attachments, setAttachments] = useState({});
  const [options, setOptions] = useState({ couriers: [] });
  const [quickReturnEdit, setQuickReturnEdit] = useState({});
  
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [zoomState, setZoomState] = useState({ scale: 1, x: 0, y: 0 });

  const calcElapsed = (createdAt) => {
    if (!createdAt) return '';
    const created = new Date(createdAt.replace(' ', 'T') + '+08:00');
    const now = new Date();
    const diffMs = now - created;
    if (diffMs <= 0) return '';
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    return days > 0 ? '登记' + days + '天' + hours + '时' : '登记' + hours + '时';
  };

  const fetchOptions = async () => {
    try {
      const res = await fetch(API_BASE_URL + '/api/maintenance-public/options');
      const data = await res.json();
      setOptions({
        couriers: data.couriers || []
      });
    } catch (err) {
      console.error('获取选项失败', err);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE_URL + '/api/maintenance-public/records');
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.data ?? [];
      
      const statusOrder = { '待处理': 1, '待退回': 2, '待审核': 3, '维修中': 4, '已完成': 5 };
      const sortedList = list.sort((a, b) => {
        const statusA = a.状态 || '待处理';
        const statusB = b.状态 || '待处理';
        const orderA = statusOrder[statusA] || 99;
        const orderB = statusOrder[statusB] || 99;
        
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        const parseTime = (s) => new Date((s || '').replace(' ', 'T') + '+08:00').getTime();
        const timeA = parseTime(a.创建时间);
        const timeB = parseTime(b.创建时间);
        return timeB - timeA;
      });
      
      setRecords(sortedList);
    } catch (err) {
      console.error('获取维修记录失败', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async (maintenanceId) => {
    try {
      const res = await fetch(API_BASE_URL + `/api/maintenance-public/attachments/${maintenanceId}`);
      const data = await res.json();
      setAttachments(prev => ({ ...prev, [maintenanceId]: Array.isArray(data.attachments) ? data.attachments : [] }));
    } catch (error) {
      console.error('获取附件失败:', error);
      setAttachments(prev => ({ ...prev, [maintenanceId]: [] }));
    }
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const newState = { ...prev, [id]: !prev[id] };
      if (newState[id] && !attachments[id]) {
        fetchAttachments(id);
      }
      return newState;
    });
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
    setZoomState({ scale: 1, x: 0, y: 0 });
  };

  const previewTouchRef = useRef({ startDistance: 0, startScale: 1, startX: 0, startY: 0, startPanX: 0, startPanY: 0, lastTouch: null });

  const handlePreviewTouchStart = (e) => {
    const touches = e.touches;
    const ref = previewTouchRef.current;
    if (touches.length === 2) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      ref.startDistance = Math.hypot(dx, dy);
      ref.startScale = zoomState.scale;
      ref.startX = zoomState.x;
      ref.startY = zoomState.y;
    } else if (touches.length === 1) {
      ref.startPanX = zoomState.x;
      ref.startPanY = zoomState.y;
      ref.lastTouch = { x: touches[0].clientX, y: touches[0].clientY };
    }
  };

  const handlePreviewTouchMove = (e) => {
    const touches = e.touches;
    const ref = previewTouchRef.current;
    if (touches.length === 2) {
      e.preventDefault();
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / ref.startDistance;
      let newScale = ref.startScale * ratio;
      if (newScale < 0.5) newScale = 0.5;
      if (newScale > 8) newScale = 8;
      setZoomState({ scale: newScale, x: ref.startX, y: ref.startY });
    } else if (touches.length === 1 && zoomState.scale > 1) {
      const tx = touches[0].clientX - ref.lastTouch.x;
      const ty = touches[0].clientY - ref.lastTouch.y;
      ref.lastTouch = { x: touches[0].clientX, y: touches[0].clientY };
      setZoomState(prev => ({ ...prev, x: prev.x + tx, y: prev.y + ty }));
    }
  };

  const handlePreviewWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoomState(prev => {
      let s = prev.scale * delta;
      if (s < 0.5) s = 0.5;
      if (s > 8) s = 8;
      return { ...prev, scale: s };
    });
  };

  const handlePreviewDoubleClick = () => {
    setZoomState(prev => prev.scale !== 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 });
  };

  const getAttachmentType = (mimeType) => {
    if (mimeType && mimeType.startsWith('image/')) return 'image';
    if (mimeType && mimeType.startsWith('video/')) return 'video';
    return 'other';
  };

  const getImageUrl = (filePath) => {
    if (!filePath) return '';
    const normalized = filePath.replace(/^\/app/, '');
    const path = normalized.startsWith('/') ? normalized : '/' + normalized;
    return API_BASE_URL + path;
  };

  const filteredRecords = (() => {
    const now = new Date().getTime();
    const q = search.trim().toLowerCase();
    // 先过滤掉超过48小时的已完成记录
    const visibleRecords = records.filter((r) => {
      if (r.状态 === '已完成' && r.完成时间) {
        const completionTime = new Date(r.完成时间.replace(' ', 'T') + '+08:00').getTime();
        const hoursDiff = (now - completionTime) / (1000 * 60 * 60);
        if (hoursDiff > 48) {
          return false;
        }
      }
      return true;
    });
    
    if (!q) return visibleRecords;
    return visibleRecords.filter((r) => {
      const hay = [
        r.维修单号, r.省份, r.城市, r.区县, r.详细地址,
        r.联系人, r.联系电话, r.品牌, r.型号, r.类型, r.颜色,
        r.购买日期, r.购买平台, r.订单编号, r.故障描述,
        r.登记人, r.状态, r.报修平台, r.返厂单号
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  })();

  useEffect(() => {
    fetchOptions();
    fetchRecords();
  }, []);

  const statusColors = {
    '待处理': '#ff9800',
    '待退回': '#e64a19',
    '维修中': '#1976d2',
    '已完成': '#333'
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 0;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        @keyframes expandFadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .share-container { padding: 12px; max-width: 1200px; margin: 0 auto; }
        .share-header { margin-bottom: 12px; }
        .share-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
        .share-search { background: #1976d2; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .share-search label { font-size: 13px; font-weight: 500; color: #fff; white-space: nowrap; }
        .share-search-input-wrap { flex: 1; min-width: 150px; position: relative; }
        .share-search input { padding: 6px 30px 6px 10px; border: none; border-radius: 4px; font-size: 13px; height: 32px; width: 100%; }
        .share-search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 16px; color: #999; padding: 4px; line-height: 1; }
        .share-search-hint { font-size: 12px; color: rgba(255,255,255,0.9); width: 100%; }
        .share-card { background: #fff; border-radius: 8px; margin-bottom: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .share-card-header { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; padding: 12px; gap: 12px; cursor: pointer; }
        .share-card-name { font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .share-card-tracking { font-size: 12px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .share-card-status { padding: 2px 8px; border-radius: 4px; color: #fff; font-size: 11px; display: inline-block; text-align: center; min-width: 56px; }
        .share-card-toggle { cursor: pointer; color: #1976d2; font-weight: bold; font-size: 13px; padding: 4px 8px; user-select: none; text-align: center; min-width: 40px; }
        .share-card-elapsed { padding: 0 12px 8px; font-size: 12px; color: #e65100; font-weight: 600; line-height: 1.5; }
        .share-card-body { padding: 0 12px 12px; animation: expandFadeIn 0.3s ease-in-out; }
        .share-sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
        .share-section-title { font-weight: bold; margin-bottom: 6px; color: #1976d2; font-size: 14px; }
        .share-field { margin-bottom: 4px; font-size: 13px; line-height: 1.6; word-break: break-all; }
        .share-field-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .share-field-label { display: inline-block; min-width: 70px; font-weight: 600; }
        .share-attachments { margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee; }
        .share-attachments-title { font-weight: bold; margin-bottom: 8px; color: #1976d2; font-size: 14px; }
        .share-attachments-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .share-attachment-thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid #ddd; }
        .share-empty { text-align: center; padding: 40px 20px; color: #999; background: #fff; border-radius: 8px; }
        .share-return-select { padding: 4px 6px; border-radius: 4px; border: 1px solid #ddd; font-size: 12px; width: 100%; max-width: 160px; }
        .share-return-input { padding: 4px 6px; border-radius: 4px; border: 1px solid #ddd; font-size: 12px; width: 100%; max-width: 200px; }
        .share-return-btn { padding: 4px 14px; background: #4caf50; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 4px; }
        @media (max-width: 600px) {
          .share-container { padding: 8px; }
          .share-header h3 { font-size: 16px; }
          .share-search { padding: 8px 10px; }
          .share-search input { max-width: 100%; }
          .share-card-header { padding: 10px; }
          .share-card-name { font-size: 13px; }
          .share-card-tracking { font-size: 11px; width: 100%; }
          .share-card-body { padding: 0 10px 10px; }
          .share-sections { grid-template-columns: 1fr; gap: 10px; }
          .share-field { font-size: 12px; }
          .share-field-label { min-width: 65px; }
          .share-attachment-thumb { width: 50px; height: 50px; }
        }
        @media (min-width: 601px) and (max-width: 1024px) {
          .share-sections { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
      <div className="share-container">
        <div className="share-header">
          <h3>维修记录查询</h3>
        </div>

        <div className="share-search">
          <label>搜索：</label>
          <div className="share-search-input-wrap">
            <input
              type="text"
              placeholder="搜索：维修单号、联系人、地址等"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="share-search-clear" onClick={() => setSearch('')}>×</button>
            )}
          </div>
          {search && (
            <div className="share-search-hint">当前搜索: {search}</div>
          )}
        </div>

        {loading && <div className="share-empty">加载中...</div>}
        {!loading && filteredRecords.length === 0 && <div className="share-empty">暂无数据</div>}

        {!loading && filteredRecords.map((rec) => (
          <div className="share-card" key={rec.维修单号} style={(rec.备注 || rec.remark) ? { background: '#fff8e1', border: '1px solid #ffb300' } : undefined}>
            <div className="share-card-header" onClick={() => toggleRow(rec.维修单号)}>
              <span className="share-card-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.联系人 || '-'}</span>
                {(rec.备注 || rec.remark) && (
                  <span title={rec.备注 || rec.remark} style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '4px', background: '#ff9800', color: '#fff', fontSize: '10px', fontWeight: 'bold', cursor: 'help', whiteSpace: 'nowrap', flexShrink: 0 }}>📝 备注</span>
                )}
              </span>
              <span className="share-card-tracking">{rec.返厂快递 && rec.返厂单号 ? `${rec.返厂快递}：${rec.返厂单号}` : rec.返厂单号 || ''}</span>
              <span className="share-card-status" style={{ background: statusColors[(rec.支付凭证 === '拒维修' && rec.状态 !== '已完成') ? '待退回' : (rec.状态 || '待处理')] || '#999' }}>
                {(rec.支付凭证 === '拒维修' && rec.状态 !== '已完成') ? '待退回' : (rec.状态 || '待处理')}
              </span>
              <span className="share-card-toggle">
                {expandedRows[rec.维修单号] ? '收起' : '展开'}
              </span>
            </div>

            {rec['状态'] !== '已完成' && rec['创建时间'] && (
              <div className="share-card-elapsed">{calcElapsed(rec['创建时间'])}</div>
            )}

            {expandedRows[rec.维修单号] && (
              <div className="share-card-body">
                <div className="share-sections">
                  <div>
                    <div className="share-section-title">客户信息</div>
                    <div className="share-field"><span className="share-field-label">购买平台：</span>{rec.购买平台 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">订单编号：</span>{rec.订单编号 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">地址：</span>{[rec.省份, rec.城市, rec.区县, rec.镇街道, rec.详细地址].filter(Boolean).join(' ') || '-'}</div>
                    <div className="share-field"><span className="share-field-label">联系人：</span>{rec.联系人 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">联系电话：</span>{rec.联系电话 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">报修平台：</span>{rec.报修平台 || '-'}</div>
                  </div>
                  <div>
                    <div className="share-section-title">设备信息</div>
                    <div className="share-field"><span className="share-field-label">购买日期：</span>{rec.购买日期 ? rec.购买日期.split('T')[0] : '-'}</div>
                    <div className="share-field"><span className="share-field-label">品牌：</span>{rec.品牌 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">型号：</span>{rec.型号 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">类型：</span>{rec.类型 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">颜色：</span>{rec.颜色 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">条码：</span>
                      {(() => {
                        const barcodePhotos = attachments[rec.维修单号]?.filter(a => a.file_type === 'barcode_photo') || [];
                        if (barcodePhotos.length > 0) {
                          return (
                            <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', verticalAlign: 'top' }}>
                              {barcodePhotos.map((att, idx) => (
                                <span key={idx} style={{ display: 'inline-block', width: '30px', height: '30px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }}
                                  onClick={() => openPreview(getImageUrl(att.file_path), 'image')}>
                                  <img src={getImageUrl(att.file_path)} alt="设备条码" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </span>
                              ))}
                            </span>
                          );
                        }
                        return <span>{rec.设备条码 || '-'}</span>;
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="share-section-title">故障信息</div>
                    <div className="share-field"><span className="share-field-label">维修单号：</span>{rec.维修单号 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">保修状态：</span>{rec.保修状态 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">返厂原因：</span>{rec.返厂原因 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">故障描述：</span><span className="share-field-ellipsis" title={rec.故障描述 || ''}>{rec.故障描述 || '-'}</span></div>
                    {(rec.备注 || rec.remark) && (
                      <div className="share-field" style={{ background: '#fff3cd', borderRadius: '4px', padding: '6px 8px', margin: '4px 0' }}>
                        <span className="share-field-label">备注：</span>
                        <span style={{ color: '#e65100', fontWeight: 'bold' }}>{rec.备注 || rec.remark}</span>
                      </div>
                    )}
                    {/* 维修附件 */}
                    {attachments[rec.维修单号] && attachments[rec.维修单号].length > 0 && (
                      <div className="share-attachments" style={{ marginTop: '8px' }}>
                        <div className="share-attachments-title">维修附件</div>
                        <div className="share-attachments-grid">
                          {attachments[rec.维修单号]
                            .filter(att => att.file_type !== 'barcode_photo' && getAttachmentType(att.mime_type) === 'image')
                            .map((att, idx) => (
                              <img
                                key={idx}
                                src={getImageUrl(att.file_path)}
                                alt={`附件${idx + 1}`}
                                className="share-attachment-thumb"
                                onClick={() => openPreview(getImageUrl(att.file_path), 'image')}
                              />
                            ))
                          }
                          {attachments[rec.维修单号]
                            .filter(att => getAttachmentType(att.mime_type) === 'video')
                            .map((att, idx) => (
                              <div
                                key={`v-${idx}`}
                                style={{ position: 'relative', width: '60px', height: '60px', cursor: 'pointer' }}
                                onClick={() => openPreview(getImageUrl(att.file_path), 'video')}
                              >
                                <video src={getImageUrl(att.file_path)} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ color: '#fff', fontSize: '12px', marginLeft: '2px' }}>▶</span>
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="share-section-title">物流信息</div>
                    <div className="share-field"><span className="share-field-label">返厂快递：</span>{rec.返厂快递 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">返厂单号：</span>{rec.返厂单号 || '-'}</div>
                    <div className="share-field"><span className="share-field-label">登记时间：</span>{fmtTime(rec.创建时间)}</div>
                    {rec.状态 === '维修中' || (rec.支付凭证 === '拒维修' && rec.状态 !== '已完成') ? (
                      <>
                        <div className="share-field">
                          <span className="share-field-label">寄回快递：</span>
                          <select
                            className="share-return-select"
                            value={quickReturnEdit[rec.维修单号]?.寄回快递 || rec.寄回快递 || ''}
                            onChange={e => setQuickReturnEdit(prev => ({ ...prev, [rec.维修单号]: { ...(prev[rec.维修单号] || {}), 寄回快递: e.target.value } }))}
                          >
                            <option value="">请选择快递</option>
                            {options.couriers.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="share-field">
                          <span className="share-field-label">寄回单号：</span>
                          <input
                            type="text"
                            className="share-return-input"
                            value={quickReturnEdit[rec.维修单号]?.寄回单号 || rec.寄回单号 || ''}
                            onChange={e => setQuickReturnEdit(prev => ({ ...prev, [rec.维修单号]: { ...(prev[rec.维修单号] || {}), 寄回单号: e.target.value.replace(/[^a-zA-Z0-9]/g, '') } }))}
                            placeholder="请输入单号"
                          />
                        </div>
                        <div className="share-field">
                          <span className="share-field-label" />
                          <button
                            className="share-return-btn"
                            onClick={async () => {
                              const returnData = quickReturnEdit[rec.维修单号] || {};
                              if (!returnData.寄回快递 || !returnData.寄回单号) {
                                alert('请填写完整的快递和单号');
                                return;
                              }
                              try {
                                 const res = await fetch(API_BASE_URL + `/api/maintenance-public/update/${rec.维修单号}`, {
                                   method: 'PUT',
                                   headers: { 'Content-Type': 'application/json' },
                                   body: JSON.stringify({
                                     寄回快递: returnData.寄回快递,
                                     寄回单号: returnData.寄回单号,
                                     状态: '已完成'
                                   })
                                 });
                                if (res.ok) {
                                  alert('更新成功');
                                  setQuickReturnEdit(prev => {
                                    const next = { ...prev };
                                    delete next[rec.维修单号];
                                    return next;
                                  });
                                  fetchRecords();
                                } else {
                                  const err = await res.json();
                                  alert('更新失败：' + (err.error || '未知错误'));
                                }
                              } catch (err) {
                                alert('更新失败：' + err.message);
                              }
                            }}
                          >
                            提交
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="share-field"><span className="share-field-label">寄回快递：</span>{rec.寄回快递 || '-'}</div>
                        <div className="share-field"><span className="share-field-label">寄回单号：</span>{rec.寄回单号 || '-'}</div>
                        {rec.状态 === '已完成' && (
                          <>
                            <div className="share-field"><span className="share-field-label">完成时间：</span>{fmtTime(rec.完成时间)}</div>
                            <div className="share-field"><span className="share-field-label">操作人：</span>{rec.操作人 || '-'}</div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showPreviewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
          onClick={closePreview}
          onTouchStart={handlePreviewTouchStart}
          onTouchMove={handlePreviewTouchMove}
          onWheel={handlePreviewWheel}
          onDoubleClick={handlePreviewDoubleClick}>
          <div style={{ position: 'relative', maxWidth: '95%', maxHeight: '95%', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            {previewType === 'video' ? (
              <video src={previewUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />
            ) : (
              <img src={previewUrl} alt="预览"
                style={{ maxWidth: '100%', maxHeight: '90vh', transform: `scale(${zoomState.scale}) translate(${zoomState.x / zoomState.scale}px, ${zoomState.y / zoomState.scale}px)`, transformOrigin: 'center center', transition: zoomState.scale === 1 && zoomState.x === 0 && zoomState.y === 0 ? 'transform 0.2s ease' : 'none', cursor: zoomState.scale > 1 ? 'grab' : 'zoom-in', touchAction: 'none' }} />
            )}
            <button onClick={closePreview} style={{ position: 'absolute', top: '-40px', right: 0, background: 'none', border: 'none', color: '#fff', fontSize: '30px', cursor: 'pointer' }}>×</button>
            {zoomState.scale !== 1 && (
              <button onClick={(e) => { e.stopPropagation(); setZoomState({ scale: 1, x: 0, y: 0 }); }}
                style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                重置
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default MaintenanceRecordShare;
