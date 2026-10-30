import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import API_BASE_URL from '../config/api';
import { fmtTime, fmtDate } from '../utils/time';
import { copyToClipboard } from '../utils/clipboard';

function ChangeRequestReview({ userRole, isMobile = false }) {
  const { user } = useAuth();
  const isAdmin = userRole === 'admin';
  const [pendingRequests, setPendingRequests] = useState([]);
  const [paymentReviews, setPaymentReviews] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [rejectModal, setRejectModal] = useState({ show: false, id: null, reason: '', source: 'customer' });
  const [rejectErrors, setRejectErrors] = useState({});
  const [attachments, setAttachments] = useState({});
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [activeTab, setActiveTab] = useState('change');
  const [paymentRejectModal, setPaymentRejectModal] = useState({ show: false, id: null, reason: '' });
  const [paymentConfirmModal, setPaymentConfirmModal] = useState({ show: false, id: null });
  const [approveConfirmModal, setApproveConfirmModal] = useState({ show: false, id: null, source: 'customer' });

  useEffect(() => {
    if (isAdmin) {
      fetchPendingRequests();
      fetchPaymentReviews();
      fetchFeedbacks();
    }
  }, [isAdmin]);

  const fetchPendingRequests = async () => {
    try {
      const [customerRes, maintenanceRes] = await Promise.all([
        api.get('/change-requests/pending'),
        api.get('/maintenance/change-requests/pending')
      ]);
      
      const customerRequests = (customerRes.data.changeRequests || []).map(r => ({
        ...r,
        source: 'customer',
        displayId: r.订单编号 || r.id,
        displayName: r.登记人 || r.applicant_name || '-'
      }));
      
      const maintenanceRequests = (maintenanceRes.data.changeRequests || []).map(r => ({
        ...r,
        source: 'maintenance',
        displayId: r.maintenance_id || r.order_no || r.id,
        displayName: r.registrant || r.requested_by_name || '-'
      }));
      
      setPendingRequests([...customerRequests, ...maintenanceRequests]);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
      setLoading(false);
    }
  };

  const fetchPaymentReviews = async () => {
    try {
      const res = await api.get('/maintenance/payment-reviews/pending');
      setPaymentReviews(res.data.paymentReviews || []);
    } catch (error) {
      console.error('Failed to fetch payment reviews:', error);
    }
  };

  const fetchFeedbacks = async () => {
    setFeedbackLoading(true);
    try {
      const res = await api.get('/change-requests/feedback/admin');
      setFeedbacks(res.data.feedbacks || []);
    } catch (error) {
      console.error('Failed to fetch feedbacks:', error);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleFeedbackResolve = async (id) => {
    try {
      await api.put(`/change-requests/feedback/${id}/resolve`);
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, is_read: 1 } : f));
      alert('已标记为已处理');
    } catch (error) {
      alert('操作失败：' + (error.response?.data?.error || '未知错误'));
    }
  };

  const handleApprove = async (id, source = 'customer') => {
    try {
      if (source === 'maintenance') {
        await api.put(`/maintenance/change-requests/${id}`, {
          status: 'approved',
          processed_by: user?.id
        });
      } else {
        await api.post(`/change-requests/${id}/approve`);
      }
      alert('审核通过');
      fetchPendingRequests();
    } catch (error) {
      alert('审核失败：' + (error.response?.data?.error || '未知错误'));
    }
  };

  const handleCopyChangeRequest = (request) => {
    const changes = parseChanges(request.proposed_changes);
    const fields = [
      { key: '客户信息', label: '客户信息' },
      { key: '购买日期', label: '购买日期' },
      { key: '品牌', label: '品牌' },
      { key: '型号', label: '型号' },
      { key: '类型', label: '类型' },
      { key: '颜色', label: '颜色' },
      { key: '规格', label: '规格' },
      { key: '原因', label: '原因' },
      { key: '状态', label: '状态' },
      { key: '快递', label: '快递' },
      { key: '单号', label: '单号' },
      { key: '仓库', label: '仓库' },
      { key: '平台', label: '平台' },
      { key: '运费', label: '运费' },
      { key: '购买件数', label: '购买件数' },
      { key: '退货件数', label: '退货件数' },
      { key: '备注', label: '备注' }
    ];
    
    let text = fields
      .map(f => {
        const newValue = changes[f.key];
        if (newValue !== undefined) {
          const oldValue = request[f.key] || '';
          return `${f.label}：${oldValue} → ${newValue}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');
    
    if (request.settlement_new_status) {
      text += (text ? '\n' : '') + `结算：${request.settlement_old_status || '未结算'} → ${request.settlement_new_status}`;
    }
    
    copyToClipboard(text).then(() => {
      alert('已复制到剪贴板');
    }).catch(err => {
      console.error('复制失败:', err);
      alert('复制失败，请手动复制');
    });
  };

  const handleReject = async () => {
    if (!rejectModal.reason || rejectModal.reason.trim() === '') {
      setRejectErrors({ reason: '请填写拒绝原因' });
      return;
    }

    try {
      if (rejectModal.source === 'maintenance') {
        await api.put(`/maintenance/change-requests/${rejectModal.id}`, {
          status: 'rejected',
          processed_by: user?.id
        });
      } else {
        await api.post(`/change-requests/${rejectModal.id}/reject`, 
          { reason: rejectModal.reason }
        );
      }
      alert('已拒绝');
      setRejectModal({ show: false, id: null, reason: '', source: 'customer' });
      fetchPendingRequests();
    } catch (error) {
      alert('拒绝失败：' + (error.response?.data?.error || '未知错误'));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) {
      alert('请选择要审核的记录');
      return;
    }

    try {
      await api.post('/change-requests/batch-approve',
        { ids: selectedIds }
      );
      alert(`批量审核完成，已通过 ${selectedIds.length} 条`);
      setSelectedIds([]);
      fetchPendingRequests();
    } catch (error) {
      alert('批量审核失败：' + (error.response?.data?.error || '未知错误'));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // 支付凭证审核
  const handlePaymentApproveClick = (id) => {
    setPaymentConfirmModal({ show: true, id });
  };

  const handlePaymentApprove = async (id) => {
    try {
      await api.post(`/maintenance/${id}/payment-approve`, { action: 'approved' });
      setPaymentConfirmModal({ show: false, id: null });
      alert('审核通过');
      fetchPaymentReviews();
      fetchPendingRequests();
    } catch (error) {
      alert('审核失败：' + (error.response?.data?.error || '未知错误'));
    }
  };

  const handlePaymentReject = async () => {
    if (!paymentRejectModal.reason || paymentRejectModal.reason.trim() === '') {
      alert('请填写拒绝原因');
      return;
    }
    try {
      await api.post(`/maintenance/${paymentRejectModal.id}/payment-approve`, { action: 'rejected', rejectReason: paymentRejectModal.reason.trim() });
      alert('已驳回');
      setPaymentRejectModal({ show: false, id: null, reason: '' });
      fetchPaymentReviews();
      fetchPendingRequests();
    } catch (error) {
      alert('驳回失败：' + (error.response?.data?.error || '未知错误'));
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingRequests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingRequests.map(r => r.id));
    }
  };

  const parseChanges = (changesStr) => {
    try {
      const parsed = JSON.parse(changesStr);
      const result = {};
      Object.entries(parsed).forEach(([key, value]) => {
        if (key === 'ID') return;
        if (typeof value === 'object' && value !== null) {
          if (value.name) {
            result[key] = `文件: ${value.name}`;
          }
        } else {
          result[key] = value;
        }
      });
      return result;
    } catch {
      return {};
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return fmtTime(dateStr);
  };

  const getAttachmentType = (mimeType) => {
    if (!mimeType) return 'file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'file';
  };

  const getImageUrl = (filePath) => {
    if (!filePath) return '';
    let normalized = filePath.replace(/^\/+/, '');
    if (normalized.startsWith('app/')) {
      normalized = normalized.substring(4);
    }
    const path = normalized.startsWith('/') ? normalized : '/' + normalized;
    // Electron 使用 file:// 协议，需要完整 URL；浏览器通过 nginx 访问也使用完整 URL
    return API_BASE_URL + path;
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

  const fetchAttachments = async (customerId) => {
    try {
      const res = await api.get(`/customer/${customerId}/attachments`);
      setAttachments(prev => ({ ...prev, [customerId]: res.data.attachments || [] }));
    } catch (error) {
      console.error('获取附件失败:', error);
      setAttachments(prev => ({ ...prev, [customerId]: [] }));
    }
  };

  const fetchChangeRequestAttachments = async (changeRequestId, customerId) => {
    try {
      const res = await api.get(`/change-requests/${changeRequestId}/attachments`);
      let attachments = res.data.attachments || [];
      try {
        const customerRes = await api.get(`/customer/${customerId}/attachments`);
        const customerAttachments = customerRes.data.attachments || [];
        const pendingAttachments = customerAttachments.filter(att => att.status === 'pending');
        const existingPaths = new Set(attachments.map(att => att.file_path));
        const newAttachments = pendingAttachments.filter(att => !existingPaths.has(att.file_path));
        attachments = [...attachments, ...newAttachments];
      } catch (e) {
        console.error('获取客户附件失败:', e);
      }
      return attachments;
    } catch (error) {
      console.error('获取变更请求附件失败:', error);
      return [];
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { background: '#ff9800', color: '#fff' },
      approved: { background: '#4caf50', color: '#fff' },
      rejected: { background: '#f44336', color: '#fff' }
    };
    const labels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '3px',
        fontSize: '12px',
        ...styles[status] || styles.pending
      }}>
        {labels[status] || status}
      </span>
    );
  };

  const renderRequestDetail = (request) => (
    <div style={{ fontSize: '13px' }}>
      {request.source === 'maintenance' ? (
        <>
          {(() => {
            const changes = request.proposed_changes || {};
            const filteredChanges = { ...changes };
            delete filteredChanges.requested_by;
            const fieldLabels = {
              '联系人': '联系人', '联系电话': '联系电话', '品牌': '品牌', '型号': '型号',
              '类型': '类型', '颜色': '颜色', '设备条码': '设备条码', '购买日期': '购买日期',
              '购买平台': '购买平台', '保修状态': '保修状态', '返厂原因': '返厂原因',
              '故障描述': '故障描述', '返厂快递': '返厂快递', '返厂单号': '返厂单号',
              '寄回快递': '寄回快递', '寄回单号': '寄回单号', '状态': '状态',
              '报修平台': '报修平台', '支付凭证': '支付凭证',
              '省份': '省份', '城市': '城市', '区县': '区县', '镇街道': '镇街道',
              '详细地址': '详细地址', '订单编号': '订单编号', '电池要求': '电池要求'
            };

            const hasChanges = Object.keys(filteredChanges).length > 0;
            const maintenanceAttachments = attachments[request.id] || [];
            const hasAttachments = maintenanceAttachments.length > 0;

            if (!hasChanges && !hasAttachments) {
              return <div style={{ color: '#999', padding: '8px' }}>无变更内容</div>;
            }

            return (
              <>
                {hasChanges && (
                  <>
                    <strong style={{ marginBottom: '8px', display: 'block' }}>修改内容：</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {Object.entries(filteredChanges).map(([key, changeValue]) => {
                        const label = fieldLabels[key] || key;
                        let oldVal = '-';
                        let newVal = '-';
                        if (changeValue && typeof changeValue === 'object') {
                          if (changeValue.old !== undefined) oldVal = changeValue.old || '(空)';
                          if (changeValue.new !== undefined) newVal = changeValue.new || '(空)';
                        } else {
                          newVal = changeValue || '-';
                        }
                        return (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeeba' }}>
                            <span style={{ fontWeight: 'bold', minWidth: '80px', color: '#333' }}>{label}:</span>
                            <span style={{ color: '#666', textDecoration: 'line-through' }}>{oldVal}</span>
                            <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>→</span>
                            <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>{newVal}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {hasAttachments && (
                  <>
                    <strong style={{ marginTop: '16px', marginBottom: '8px', display: 'block' }}>上传的附件：</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {maintenanceAttachments.map(att => {
                        const attType = getAttachmentType(att.mime_type);
                        const url = getImageUrl(att.file_path);
                        return (
                          <div key={att.id} style={{ position: 'relative', width: '80px', height: '80px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                            {attType === 'image' && url && (
                              <img 
                                src={url} 
                                alt={att.original_name || '附件'} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                onClick={() => openPreview(url, 'image')}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            )}
                            {attType === 'video' && url && (
                              <div 
                                onClick={() => openPreview(url, 'video')}
                                style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative', background: '#000' }}
                              >
                                <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '24px', color: '#fff' }}>▶</div>
                              </div>
                            )}
                            {attType === 'file' && (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#666', padding: '4px', textAlign: 'center', wordBreak: 'break-all' }}>
                                {att.original_name || '文件'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </>
      ) : (
        <>
          {(() => {
            const changes = parseChanges(request.proposed_changes);
            const settlementChanges = { ...changes };
            delete settlementChanges['结算'];
            const hasFieldChanges = Object.keys(settlementChanges).length > 0;
            const hasSettlementChange = !!request.settlement_new_status;
            const requestAttachments = attachments[request.id] || [];
            const regularAttachments = requestAttachments.filter(att => att.file_path !== request.settlement_image_url);
            const pendingAttachments = regularAttachments.filter(att => att.status === 'pending');
            const approvedAttachments = regularAttachments.filter(att => att.status === 'approved');
            const allAttachments = regularAttachments;
            const hasPendingAttachments = pendingAttachments.length > 0;
            const hasApprovedAttachments = approvedAttachments.length > 0;
            const hasAnyAttachments = allAttachments.length > 0;

        if (!hasFieldChanges && !hasSettlementChange && !hasAnyAttachments) {
          return <div style={{ color: '#999', padding: '8px' }}>无变更内容</div>;
        }

        return (
          <>
            {hasFieldChanges && (
              <>
                <strong style={{ marginBottom: '8px', display: 'block' }}>修改内容：</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(settlementChanges).map(([key, newValue]) => {
                    const oldValue = request[key] || '-';
                    const label = {
                      订单编号: '订单编号', 客户信息: '客户信息', 购买日期: '购买日期',
                      品牌: '品牌', 型号: '型号', 类型: '类型', 颜色: '颜色', 规格: '规格',
                      原因: '原因', 状态: '状态', 快递: '快递', 单号: '单号', 备注: '备注',
                      价格: '价格', 仓库: '仓库', 平台: '平台', 运费: '运费',
                      购买件数: '购买件数', 退货件数: '退货件数'
                    }[key] || key;
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeeba' }}>
                        <span style={{ fontWeight: 'bold', minWidth: '70px', color: '#333' }}>{label}:</span>
                        <span style={{ color: '#666', textDecoration: 'line-through' }}>{oldValue}</span>
                        <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>→</span>
                        <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>{newValue || '-'}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {hasSettlementChange && (
              <>
                <strong style={{ marginTop: '16px', marginBottom: '8px', display: 'block' }}>结算变更：</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#e3f2fd', borderRadius: '4px', border: '1px solid #bbdefb' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '70px', color: '#333' }}>结算状态:</span>
                  <span style={{ color: '#666', textDecoration: 'line-through' }}>{request.settlement_old_status || '未结算'}</span>
                  <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>→</span>
                  <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>{request.settlement_new_status}</span>
                </div>
                {request.settlement_image_url && (
                  <>
                    <strong style={{ marginTop: '12px', marginBottom: '8px', display: 'block' }}>结算凭证：</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ position: 'relative', width: '80px', height: '80px', border: '1px solid #4caf50', borderRadius: '4px', overflow: 'hidden' }}>
                        <img 
                          src={getImageUrl(request.settlement_image_url)} 
                          alt="结算凭证" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => openPreview(getImageUrl(request.settlement_image_url), 'image')}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            {hasAnyAttachments && (
              <>
                <strong style={{ marginTop: '16px', marginBottom: '8px', display: 'block' }}>上传的附件：</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {allAttachments.map(att => {
                    const attType = getAttachmentType(att.mime_type);
                    const url = getImageUrl(att.file_path);
                    return (
                      <div key={att.id} style={{ position: 'relative', width: '80px', height: '80px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                        {attType === 'image' && url && (
                          <img 
                            src={url} 
                            alt={att.original_name || '附件'} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                            onClick={() => openPreview(url, 'image')}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        {attType === 'video' && url && (
                          <div 
                            onClick={() => openPreview(url, 'video')}
                            style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative', background: '#000' }}
                          >
                            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '24px', color: '#fff' }}>▶</div>
                          </div>
                        )}
                        {attType === 'file' && url && (
                          <div 
                            onClick={() => window.open(url, '_blank')}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              height: '100%', 
                              fontSize: '9px', 
                              color: '#666', 
                              padding: '2px', 
                              cursor: 'pointer'
                            }}
                          >
                            <span style={{ fontSize: '20px' }}>📄</span>
                            <span style={{ marginTop: '2px' }}>PDF</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        );
      })()}
        </>
      )}
    </div>
  );

  if (!isAdmin) {
    return null;
  }

  return (
    <div style={{ padding: isMobile ? '8px' : '16px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: isMobile ? '12px' : '16px', borderBottom: '2px solid #eee' }}>
        <button
          onClick={() => setActiveTab('change')}
          style={{
            padding: isMobile ? '8px 4px' : '10px 20px',
            flex: isMobile ? 1 : undefined,
            whiteSpace: isMobile ? 'nowrap' : undefined,
            textAlign: 'center',
            background: activeTab === 'change' ? '#fff' : '#f5f5f5',
            color: activeTab === 'change' ? '#1976d2' : '#666',
            border: 'none',
            borderBottom: activeTab === 'change' ? '2px solid #1976d2' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: isMobile ? '12px' : '14px',
            fontWeight: activeTab === 'change' ? '600' : '400',
            marginBottom: '-2px'
          }}
        >
          修改审核 {pendingRequests.length > 0 && `(${pendingRequests.length})`}
        </button>
        <button
          onClick={() => setActiveTab('payment')}
          style={{
            padding: isMobile ? '8px 4px' : '10px 20px',
            flex: isMobile ? 1 : undefined,
            whiteSpace: isMobile ? 'nowrap' : undefined,
            textAlign: 'center',
            background: activeTab === 'payment' ? '#fff' : '#f5f5f5',
            color: activeTab === 'payment' ? '#1976d2' : '#666',
            border: 'none',
            borderBottom: activeTab === 'payment' ? '2px solid #1976d2' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: isMobile ? '12px' : '14px',
            fontWeight: activeTab === 'payment' ? '600' : '400',
            marginBottom: '-2px'
          }}
        >
          支付凭证审核 {paymentReviews.length > 0 && `(${paymentReviews.length})`}
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          style={{
            padding: isMobile ? '8px 4px' : '10px 20px',
            flex: isMobile ? 1 : undefined,
            whiteSpace: isMobile ? 'nowrap' : undefined,
            textAlign: 'center',
            background: activeTab === 'feedback' ? '#fff' : '#f5f5f5',
            color: activeTab === 'feedback' ? '#1976d2' : '#666',
            border: 'none',
            borderBottom: activeTab === 'feedback' ? '2px solid #1976d2' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: isMobile ? '12px' : '14px',
            fontWeight: activeTab === 'feedback' ? '600' : '400',
            marginBottom: '-2px'
          }}
        >
          反馈审核 {feedbacks.length > 0 && `(${feedbacks.length})`}
        </button>
      </div>

      {activeTab === 'change' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>修改审核</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#666' }}>
                已选 {selectedIds.length} 项
              </span>
              <button
                onClick={handleBatchApprove}
                disabled={selectedIds.length === 0}
                style={{
                  padding: '6px 14px',
                  background: selectedIds.length > 0 ? '#4caf50' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed',
                  fontSize: '13px'
                }}
              >
                批量通过
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载中...</div>
          ) : pendingRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999', background: '#fff', borderRadius: '8px' }}>
              暂无待审核的修改申请
            </div>
          ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingRequests.map(request => (
              <div key={request.id} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #eee', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ background: request.source === 'maintenance' ? '#9c27b0' : '#2196f3', color: '#fff', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' }}>
                    {request.source === 'maintenance' ? '维修' : '退货'}
                  </span>
                  <input type="checkbox" checked={selectedIds.includes(request.id)} onChange={() => toggleSelect(request.id)} />
                </div>
                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div><strong>单号：</strong>{request.displayId || '-'}</div>
                  <div><strong>登记人：</strong>{request.displayName || '-'}</div>
                  <div><strong>申请人：</strong>{request.applicant_name || request.requested_by_name || '-'}</div>
                  <div><strong>申请时间：</strong>{formatDate(request.created_at || request.requested_at)}</div>
                  <div><strong>变更类型：</strong>{request.source === 'maintenance' ? '维修信息变更' : (request.settlement_new_status ? (request.settlement_old_status || '未结算') + ' → ' + request.settlement_new_status : '-')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><strong>状态：</strong>{getStatusBadge(request.status)}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    onClick={() => {
                      if (expandedRequest !== request.id) {
                        if (request.source === 'maintenance') {
                          api.get(`/maintenance/${request.maintenance_id}/attachments`).then(res => {
                            const allAttachments = res.data.attachments || [];
                            const pendingAttachments = allAttachments.filter(att => att.status === 'pending');
                            setAttachments(prev => ({ ...prev, [request.id]: pendingAttachments }));
                          }).catch(err => {
                            console.error('获取维修附件失败:', err);
                          });
                        } else {
                          fetchChangeRequestAttachments(request.id, request.registration_id).then(attaches => {
                            setAttachments(prev => ({ ...prev, [request.id]: attaches }));
                          });
                        }
                      }
                      setExpandedRequest(expandedRequest === request.id ? null : request.id);
                    }}
                    style={{ flex: 1, padding: '8px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    {expandedRequest === request.id ? '收起' : '查看'}
                  </button>
                  <button
                    onClick={() => setApproveConfirmModal({ show: true, id: request.id, source: request.source })}
                    style={{ flex: 1, padding: '8px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    通过
                  </button>
                  <button
                    onClick={() => setRejectModal({ show: true, id: request.id, reason: '', source: request.source })}
                    style={{ flex: 1, padding: '8px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    拒绝
                  </button>
                </div>
                {expandedRequest === request.id && (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#f9f9f9', borderRadius: '6px' }}>
                    {renderRequestDetail(request)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
        <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '8px', textAlign: 'center', width: '40px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length === pendingRequests.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th style={{ padding: '8px', textAlign: 'left' }}>来源</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>单号</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>登记人</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>申请人</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>申请时间</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>变更类型</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>状态</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map(request => (
                <React.Fragment key={request.id}>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(request.id)}
                        onChange={() => toggleSelect(request.id)}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{ 
                        background: request.source === 'maintenance' ? '#9c27b0' : '#2196f3', 
                        color: '#fff', 
                        padding: '2px 6px', 
                        borderRadius: '3px', 
                        fontSize: '11px' 
                      }}>
                        {request.source === 'maintenance' ? '维修' : '退货'}
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>{request.displayId || '-'}</td>
                    <td style={{ padding: '8px' }}>{request.displayName || '-'}</td>
                    <td style={{ padding: '8px' }}>{request.applicant_name || request.requested_by_name || '-'}</td>
                    <td style={{ padding: '8px' }}>{formatDate(request.created_at || request.requested_at)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {request.source === 'maintenance' ? (
                        <span style={{ 
                          background: '#ff9800', 
                          color: '#fff', 
                          padding: '2px 8px', 
                          borderRadius: '3px', 
                          fontSize: '11px' 
                        }}>
                          维修信息变更
                        </span>
                      ) : request.settlement_new_status ? (
                        <span style={{ 
                          background: '#2196f3', 
                          color: '#fff', 
                          padding: '2px 8px', 
                          borderRadius: '3px', 
                          fontSize: '11px' 
                        }}>
                          {request.settlement_old_status || '未结算'} → {request.settlement_new_status}
                        </span>
                      ) : (
                        <span style={{ color: '#999', fontSize: '12px' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {getStatusBadge(request.status)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          if (expandedRequest !== request.id) {
                            if (request.source === 'maintenance') {
                              api.get(`/maintenance/${request.maintenance_id}/attachments`).then(res => {
                                const allAttachments = res.data.attachments || [];
                                // 只显示待审核的新附件
                                const pendingAttachments = allAttachments.filter(att => att.status === 'pending');
                                setAttachments(prev => ({ ...prev, [request.id]: pendingAttachments }));
                              }).catch(err => {
                                console.error('获取维修附件失败:', err);
                              });
                            } else {
                              fetchChangeRequestAttachments(request.id, request.registration_id).then(attaches => {
                                setAttachments(prev => ({ ...prev, [request.id]: attaches }));
                              });
                            }
                          }
                          setExpandedRequest(expandedRequest === request.id ? null : request.id);
                        }}
                        style={{
                          padding: '4px 10px',
                          background: '#2196f3',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          marginRight: '8px'
                        }}
                      >
                        {expandedRequest === request.id ? '收起' : '查看'}
                      </button>
                      <button
                        onClick={() => setApproveConfirmModal({ show: true, id: request.id, source: request.source })}
                        style={{
                          padding: '4px 10px',
                          background: '#4caf50',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          marginRight: '8px'
                        }}
                      >
                        通过
                      </button>
                      <button
                        onClick={() => setRejectModal({ show: true, id: request.id, reason: '', source: request.source })}
                        style={{
                          padding: '4px 10px',
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
                  {expandedRequest === request.id && (
                    <tr style={{ background: '#f9f9f9' }}>
                                                <td colSpan="9" style={{ padding: '12px' }}>
                          {renderRequestDetail(request)}
                        </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      {activeTab === 'payment' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载中...</div>
          ) : paymentReviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999', background: '#fff', borderRadius: '8px' }}>
              暂无待审核的支付凭证
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {paymentReviews.map(review => (
                <div key={review.id} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #eee', padding: '12px' }}>
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div><strong>维修单号：</strong>{review.id || review.order_no || '-'}</div>
                    <div><strong>联系人：</strong>{review.contact || '-'}</div>
                    <div><strong>联系电话：</strong>{review.phone || '-'}</div>
                    <div><strong>品牌/型号：</strong>{review.brand} {review.model || ''}</div>
                    <div><strong>登记人：</strong>{review.registrant || '-'}</div>
                    <div><strong>提交时间：</strong>{formatDate(review.updated_at)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><strong>支付状态：</strong>
                      <span style={{ background: review.payment_status === '无费用' ? '#9c27b0' : '#4caf50', color: '#fff', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' }}>
                        {review.payment_status}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      onClick={() => setExpandedRequest(expandedRequest === review.id ? null : review.id)}
                      style={{ flex: 1, padding: '8px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      {expandedRequest === review.id ? '收起' : '查看'}
                    </button>
                    <button
                      onClick={() => handlePaymentApproveClick(review.id)}
                      style={{ flex: 1, padding: '8px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      通过
                    </button>
                    <button
                      onClick={() => setPaymentRejectModal({ show: true, id: review.id, reason: '' })}
                      style={{ flex: 1, padding: '8px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      驳回
                    </button>
                  </div>
                  {expandedRequest === review.id && (
                    <div style={{ marginTop: '10px', padding: '10px', background: '#f9f9f9', borderRadius: '6px' }}>
                      <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>支付凭证：</strong>
                      {review.payment_image ? (
                        <img
                          src={getImageUrl(review.payment_image)}
                          alt="支付凭证"
                          style={{ width: '100%', maxWidth: '280px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer' }}
                          onClick={() => openPreview(getImageUrl(review.payment_image), 'image')}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ color: '#999', fontSize: '13px' }}>无支付凭证图片</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>维修单号</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>联系人</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>联系电话</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>品牌/型号</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>支付状态</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>登记人</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>提交时间</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentReviews.map(review => (
                    <tr key={review.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>{review.id || review.order_no || '-'}</td>
                      <td style={{ padding: '8px' }}>{review.contact || '-'}</td>
                      <td style={{ padding: '8px' }}>{review.phone || '-'}</td>
                      <td style={{ padding: '8px' }}>{review.brand} {review.model || ''}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          background: review.payment_status === '无费用' ? '#9c27b0' : '#4caf50',
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          fontSize: '11px'
                        }}>
                          {review.payment_status}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>{review.registrant || '-'}</td>
                      <td style={{ padding: '8px' }}>{formatDate(review.updated_at)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={() => setExpandedRequest(expandedRequest === review.id ? null : review.id)}
                          style={{ padding: '4px 8px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', marginRight: '4px' }}
                        >
                          {expandedRequest === review.id ? '收起' : '查看'}
                        </button>
                        <button
                          onClick={() => handlePaymentApproveClick(review.id)}
                          style={{ padding: '4px 8px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', marginRight: '4px' }}
                        >
                          通过
                        </button>
                        <button
                          onClick={() => setPaymentRejectModal({ show: true, id: review.id, reason: '' })}
                          style={{ padding: '4px 8px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          驳回
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payment review detail expansion */}
                    {!isMobile && expandedRequest && paymentReviews.some(r => r.id === expandedRequest) && (
            <div style={{ marginTop: '16px', background: '#fff', borderRadius: '8px', padding: '16px' }}>
              {(() => {
                const review = paymentReviews.find(r => r.id === expandedRequest);
                if (!review) return null;
                return (
                  <>
                    <strong style={{ display: 'block', marginBottom: '12px', fontSize: '14px' }}>支付凭证：</strong>
                    {review.payment_image ? (
                      <img
                        src={getImageUrl(review.payment_image)}
                        alt="支付凭证"
                        style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer' }}
                        onClick={() => openPreview(getImageUrl(review.payment_image), 'image')}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{ color: '#999', fontSize: '13px' }}>无支付凭证图片</div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}

      {activeTab === 'feedback' && (
        <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
          {feedbackLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载中...</div>
          ) : feedbacks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999', background: '#fff', borderRadius: '8px' }}>
              暂无用户反馈
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {feedbacks.map(fb => (
                <div key={fb.id} style={{ background: fb.is_read ? '#fff' : '#fffbe6', borderRadius: '8px', border: '1px solid #eee', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '11px', background: fb.type === 'bug' ? '#f44336' : fb.type === 'suggestion' ? '#4caf50' : '#ff9800', color: '#fff' }}>
                      {fb.type === 'bug' ? 'BUG反馈' : fb.type === 'suggestion' ? '建议反馈' : '问题反馈'}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '12px', background: fb.is_read ? '#e0e0e0' : '#ff9800', color: fb.is_read ? '#666' : '#fff' }}>
                      {fb.is_read ? '已处理' : '待处理'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div><strong>标题：</strong>{fb.title || '-'}</div>
                    <div><strong>内容：</strong>{fb.content || '-'}</div>
                    <div><strong>提交人：</strong>{fb.submitter_name || '-'}</div>
                    <div><strong>电话：</strong>{fb.submitter_phone || '-'}</div>
                    <div><strong>提交时间：</strong>{formatDate(fb.created_at)}</div>
                  </div>
                  {!fb.is_read && (
                    <button
                      onClick={() => handleFeedbackResolve(fb.id)}
                      style={{ marginTop: '10px', padding: '8px', width: '100%', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      标记已处理
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>类型</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>标题</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>内容</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>提交人</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>电话</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>提交时间</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>状态</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map(fb => (
                  <tr key={fb.id} style={{ borderBottom: '1px solid #eee', background: fb.is_read ? 'inherit' : '#fffbe6' }}>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        background: fb.type === 'bug' ? '#f44336' : fb.type === 'suggestion' ? '#4caf50' : '#ff9800',
                        color: '#fff'
                      }}>
                        {fb.type === 'bug' ? 'BUG反馈' : fb.type === 'suggestion' ? '建议反馈' : '问题反馈'}
                      </span>
                    </td>
                    <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fb.title || '-'}</td>
                    <td style={{ padding: '8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fb.content || '-'}</td>
                    <td style={{ padding: '8px' }}>{fb.submitter_name || '-'}</td>
                    <td style={{ padding: '8px' }}>{fb.submitter_phone || '-'}</td>
                    <td style={{ padding: '8px' }}>{formatDate(fb.created_at)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        background: fb.is_read ? '#e0e0e0' : '#ff9800',
                        color: fb.is_read ? '#666' : '#fff'
                      }}>
                        {fb.is_read ? '已处理' : '待处理'}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {!fb.is_read && (
                        <button
                          onClick={() => handleFeedbackResolve(fb.id)}
                          style={{
                            padding: '4px 10px',
                            background: '#4caf50',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          标记已处理
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {rejectModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '400px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>拒绝申请</h4>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                拒绝原因 *
              </label>
              <textarea
                style={{
                  width: '100%',
                  padding: '8px',
                  border: rejectErrors.reason ? '2px solid #d32f2f' : '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px',
                  minHeight: '100px',
                  boxSizing: 'border-box'
                }}
                value={rejectModal.reason}
                onChange={e => {
                  setRejectModal({ ...rejectModal, reason: e.target.value });
                  setRejectErrors({});
                }}
                placeholder="请输入拒绝原因..."
              />
              {rejectErrors.reason && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{rejectErrors.reason}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setRejectModal({ show: false, id: null, reason: '' })}
                style={{ padding: '8px 20px', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleReject}
                style={{ padding: '8px 20px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentRejectModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '400px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>驳回支付凭证</h4>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                驳回原因 *
              </label>
              <textarea
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px',
                  minHeight: '100px',
                  boxSizing: 'border-box'
                }}
                value={paymentRejectModal.reason}
                onChange={e => setPaymentRejectModal({ ...paymentRejectModal, reason: e.target.value })}
                placeholder="请输入驳回原因..."
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setPaymentRejectModal({ show: false, id: null, reason: '' })}
                style={{ padding: '8px 20px', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handlePaymentReject}
                style={{ padding: '8px 20px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentConfirmModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '400px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>确认审核通过</h4>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>是否确认审核通过该支付凭证？审核通过后将通知用户。</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setPaymentConfirmModal({ show: false, id: null })}
                style={{ padding: '8px 20px', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={() => handlePaymentApprove(paymentConfirmModal.id)}
                style={{ padding: '8px 20px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                确认通过
              </button>
            </div>
          </div>
        </div>
      )}

      {approveConfirmModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '400px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>确认审核通过</h4>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>是否确认审核通过该修改申请？审核通过后将通知用户。</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setApproveConfirmModal({ show: false, id: null, source: 'customer' })}
                style={{ padding: '8px 20px', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={() => {
                  handleApprove(approveConfirmModal.id, approveConfirmModal.source);
                  setApproveConfirmModal({ show: false, id: null, source: 'customer' });
                }}
                style={{ padding: '8px 20px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                确认通过
              </button>
            </div>
          </div>
        </div>
      )}

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
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '24px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
            {previewType === 'image' && (
              <img 
                src={previewUrl} 
                alt="预览" 
                style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '4px' }}
              />
            )}
            {previewType === 'video' && (
              <video 
                src={previewUrl} 
                controls 
                autoPlay 
                style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '4px' }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChangeRequestReview;