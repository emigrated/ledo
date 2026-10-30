import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import API_BASE_URL from '../config/api';
import Pagination from '../components/Pagination';
const PAGE_SIZE = 20;
import { formatOrderNo, getValidationError } from '../utils/validation';
import { fmtTime, fmtDate, toChinaDate } from '../utils/time';
import { copyToClipboard } from '../utils/clipboard';
import { applyTableLabels } from '../utils/responsiveTable';

function ReturnRegistration({ userRole, isMobile = false }) {
  const { user } = useAuth();
  const isAdmin = userRole === 'admin' || user?.role === 'admin';
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
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
    platforms: []
  });
  const [duplicateError, setDuplicateError] = useState('');
  const [courierError, setCourierError] = useState('');
  const [errors, setErrors] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [attachments, setAttachments] = useState({});
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [originalRecord, setOriginalRecord] = useState({});
  const [editOptions, setEditOptions] = useState({
    platforms: [],
    warehouses: [],
    brands: [],
    models: [],
    types: [],
    colors: [],
    specs: [],
    reasons: [],
    statuses: []
  });
  const [editErrors, setEditErrors] = useState({});
  const [editSelectedFiles, setEditSelectedFiles] = useState([]);
  const [editFilePreviews, setEditFilePreviews] = useState([]);
  const [changeHistory, setChangeHistory] = useState({});
  const [expandedChangeHistory, setExpandedChangeHistory] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementRecord, setSettlementRecord] = useState(null);
  const [settlementImage, setSettlementImage] = useState(null);
  const [settlementImagePreview, setSettlementImagePreview] = useState(null);
  // 批量结算：已录入金额、等待分发凭证的记录（含订单号与金额，便于页面汇总核对）
  const [pendingBatch, setPendingBatch] = useState(() => {
    try {
      const saved = localStorage.getItem('pendingSettlementBatch');
      const arr = saved ? JSON.parse(saved) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  });
  const [batchProofFile, setBatchProofFile] = useState(null);
  const [batchProofPreview, setBatchProofPreview] = useState(null);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [showBatchDetail, setShowBatchDetail] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shippingAmount, setShippingAmount] = useState('');
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [pendingSettlementRequests, setPendingSettlementRequests] = useState({});
  const [rejectedSettlementIds, setRejectedSettlementIds] = useState(new Set());
  const [rejectedData, setRejectedData] = useState({});
  const [unitPrice, setUnitPrice] = useState(0);
  const [editUnitPrice, setEditUnitPrice] = useState(0);
  const [shareRecordId, setShareRecordId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareModalData, setShareModalData] = useState(null);
  const [shareModalUrl, setShareModalUrl] = useState('');
  const [formData, setFormData] = useState({
    订单编号: '',
    客户信息: '',
    购买日期: '',
    品牌: '',
    型号: '',
    类型: '',
    颜色: '',
    规格: '',
    原因: '',
    状态: '',
    快递: '',
    单号: '',
    备注: '',
    价格: '',
    仓库: '',
    平台: '',
    运费: '',
    登记人: user?.name || '',
    购买件数: '',
    退货件数: ''
  });
  const [searchPlatform, setSearchPlatform] = useState('');
  const [searchOrderNo, setSearchOrderNo] = useState('');
  const [searchOrderOptions, setSearchOrderOptions] = useState([]);

  const IMMUTABLE_FIELDS = ['订单编号', '登记人', 'ID', '创建时间', '文件路径', '价格'];
  const HIDDEN_FIELDS = ['ID'];
  const EDIT_FIELD_ORDER = [
    '平台', '订单编号', '仓库', '购买日期', '客户信息',
    '品牌', '型号', '类型', '颜色', '规格', '价格',
    '原因', '状态', '购买件数', '退货件数',
    '快递', '单号', '运费', '登记人', '创建时间', '备注'
  ];

  useEffect(() => {
    fetchRecords();
    fetchOptions();
    fetchPendingSettlementRequests();
    fetchRejectedSettlementIds();
  }, []);

  useEffect(() => {
    if (isMobile) {
      setTimeout(() => applyTableLabels(), 100);
    }
  }, [isMobile, records]);

  const fetchRecords = async (p) => {
    const currentPage = p || page;
    try {
      const params = new URLSearchParams();
      if (searchPlatform) params.append('平台', searchPlatform);
      if (searchOrderNo) params.append('订单编号', searchOrderNo);
      params.append('page', currentPage);
      params.append('limit', PAGE_SIZE);
      
      const response = await api.get(`/customer?${params.toString()}`);
      
      // 检查 token 是否过期
      if (response.status === 401) {
        console.error('Token 已过期，请重新登录');
        alert('登录已过期，请重新登录');
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      
      if (!response.ok) {
        console.error('获取退货记录失败:', response.status, response.data);
        // 不设置空数组，保持原数据
        setLoading(false);
        return;
      }
      
      setRecords(response.data?.records || []);
      setTotal(response.data?.total || 0);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      // 不设置空数组，保持原数据
      setLoading(false);
    }
  };

  const fetchSearchOrderOptions = async (platform) => {
    try {
      const params = new URLSearchParams();
      if (platform) params.append('平台', platform);
      const response = await api.get(`/customer/search-options?${params.toString()}`);
      setSearchOrderOptions(response.data.orderNumbers || []);
    } catch (error) {
      console.error('Failed to fetch search order options:', error);
      setSearchOrderOptions([]);
    }
  };

  const fetchOptions = async () => {
    try {
      const [productRes, optionsRes] = await Promise.all([
        api.get(`/product-data/options`),
        api.get(`/options/all`)
      ]);
      setOptions(prev => ({
        ...productRes.data,
        reasons: optionsRes.data.reasons || [],
        statuses: optionsRes.data.statuses || [],
        couriers: optionsRes.data.couriers || [],
        warehouses: optionsRes.data.warehouses || [],
        platforms: optionsRes.data.platforms || []
      }));
    } catch (error) {
      console.error('Failed to fetch options:', error);
    }
  };

  const fetchPendingSettlementRequests = async () => {
    try {
      const response = await api.get(`/change-requests/pending`);
      const settlementRequests = response.data.changeRequests || [];
      const pendingMap = {};
      settlementRequests.forEach(req => {
        if (req.settlement_new_status) {
          pendingMap[req.registration_id] = req;
        }
      });
      setPendingSettlementRequests(pendingMap);
    } catch (error) {
      console.error('Failed to fetch pending settlement requests:', error);
    }
  };

  const fetchRejectedSettlementIds = async () => {
    try {
      const response = await api.get('/change-requests/settlement-rejected');
      const ids = response.data.rejectedIds || [];
      setRejectedSettlementIds(new Set(ids));
    } catch (error) {
      console.error('Failed to fetch rejected settlement IDs:', error);
    }
  };

  const handleSearchPlatformChange = (value) => {
    setSearchPlatform(value);
    setSearchOrderNo('');
    setSearchOrderOptions([]);
    if (value) {
      fetchSearchOrderOptions(value);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchRecords(newPage);
  };

  const handleSearch = () => {
    setPage(1);
    fetchRecords(1);
  };

  const handleClearSearch = () => {
    setSearchPlatform('');
    setSearchOrderNo('');
    setSearchOrderOptions([]);
    setPage(1);
    fetchRecords(1);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRecords = [...records].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    const comparison = String(aVal).localeCompare(String(bVal), 'zh-CN');
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const fetchCascadeOptions = async (field, value) => {
    try {
      if (field === '品牌' && value) {
        const res = await api.get(`/product-data/models?brand=${encodeURIComponent(value)}`);
        setOptions(prev => ({ 
          ...(prev || {}), 
          models: res?.data?.models || [] 
        }));
      }
      if (field === '型号' && formData.品牌 && value) {
        const res = await api.get(`/product-data/types?brand=${encodeURIComponent(formData.品牌)}&model=${encodeURIComponent(value)}`);
        setOptions(prev => ({ 
          ...(prev || {}), 
          types: res?.data?.types || [] 
        }));
      }
      if (field === '类型' && formData.品牌 && formData.型号 && value) {
        const res = await api.get(`/product-data/colors?brand=${encodeURIComponent(formData.品牌)}&model=${encodeURIComponent(formData.型号)}&type=${encodeURIComponent(value)}`);
        setOptions(prev => ({ 
          ...(prev || {}), 
          colors: res?.data?.colors || [] 
        }));
      }
      if (field === '颜色' && formData.品牌 && formData.型号 && formData.类型 && value) {
        const res = await api.get(`/product-data/specs?brand=${encodeURIComponent(formData.品牌)}&model=${encodeURIComponent(formData.型号)}&type=${encodeURIComponent(formData.类型)}&color=${encodeURIComponent(value)}`);
        setOptions(prev => ({ 
          ...(prev || {}), 
          specs: res?.data?.specs || [] 
        }));
      }
      if (field === '规格' && formData.品牌 && formData.型号 && formData.类型 && formData.颜色 && value) {
        const res = await api.get(`/product-data/price?brand=${encodeURIComponent(formData.品牌)}&model=${encodeURIComponent(formData.型号)}&type=${encodeURIComponent(formData.类型)}&color=${encodeURIComponent(formData.颜色)}&spec=${encodeURIComponent(value)}`);
        if (res?.data?.price) {
          const qty = parseFloat(formData.购买件数) || 1;
          const unitP = parseFloat(res.data.price);
          const totalPrice = unitP * qty;
          setUnitPrice(unitP);
          setFormData(prev => ({ ...prev, 价格: totalPrice.toString() }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch cascade options:', error);
    }
  };

  const handleFormChange = (field, value) => {
    let newData = { ...formData, [field]: value };
    if (field === '品牌') {
      newData = { ...newData, 型号: '', 类型: '', 颜色: '', 规格: '', 价格: '' };
      setOptions(prev => ({ 
        ...(prev || {}), 
        models: [], 
        types: [], 
        colors: [], 
        specs: [] 
      }));
      setUnitPrice(0);
    } else if (field === '型号') {
      newData = { ...newData, 类型: '', 颜色: '', 规格: '', 价格: '' };
      setOptions(prev => ({ 
        ...(prev || {}), 
        types: [], 
        colors: [], 
        specs: [] 
      }));
      setUnitPrice(0);
    } else if (field === '类型') {
      newData = { ...newData, 颜色: '', 规格: '', 价格: '' };
      setOptions(prev => ({ 
        ...(prev || {}), 
        colors: [], 
        specs: [] 
      }));
      setUnitPrice(0);
    } else if (field === '颜色') {
      newData = { ...newData, 规格: '', 价格: '' };
      setOptions(prev => ({ 
        ...(prev || {}), 
        specs: [] 
      }));
      setUnitPrice(0);
    } else if (field === '购买件数') {
      const qty = parseFloat(value) || 0;
      const up = unitPrice || parseFloat(formData.价格) || 0;
      newData = { ...newData, 价格: (qty * up).toString() };
    }
    
    // Clear error when user fills the field
    if (value) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    setFormData(newData);
    fetchCascadeOptions(field, value);
    
    // 实时查重检查
    if (field === '平台' || field === '订单编号') {
      const currentPlatform = newData.平台 || formData.平台;
      const currentOrderNo = newData.订单编号 || formData.订单编号;
      checkOrderDuplicate(currentPlatform, currentOrderNo);
      
      // 自动填充订单录入数据
      if (currentPlatform && currentOrderNo) {
        fetchOrderEntryData(currentPlatform, currentOrderNo);
      }
    }
    if (field === '快递' || field === '单号') {
      checkCourierDuplicate(newData.快递 || formData.快递, newData.单号 || formData.单号);
    }
  };

  // 从订单录入表拉取数据
  const fetchOrderEntryData = async (平台, 订单编号) => {
    if (!平台 || !订单编号) return;
    
    try {
      const res = await api.get(`/orders/find-by-order?平台=${encodeURIComponent(平台)}&订单编号=${encodeURIComponent(订单编号)}`);
      
      if (res.data.found) {
        const order = res.data.order;
        console.log('订单录入数据:', order);
        // 自动填充订单录入的数据到退货登记表
        setFormData(prev => ({
          ...prev,
          客户信息: order.客户信息 || prev.客户信息,
          品牌: order.品牌 || prev.品牌,
          型号: order.型号 || prev.型号,
          类型: order.类型 || prev.类型,
          颜色: order.颜色 || prev.颜色,
          规格: order.规格 || prev.规格,
          价格: order.价格 ? order.价格.toString() : prev.价格,
          购买件数: order.购买件数 ? order.购买件数.toString() : prev.购买件数,
           购买日期: toChinaDate(order.创建时间) || prev.购买日期
        }));
        
        // 设置单价以便计算
        if (order.价格) {
          setUnitPrice(parseFloat(order.价格));
        }
        
        // 触发级联选项加载
        if (order.品牌) {
          await fetchCascadeOptions('品牌', order.品牌);
          if (order.型号) {
            await fetchCascadeOptions('型号', order.型号);
            if (order.类型) {
              await fetchCascadeOptions('类型', order.类型);
              if (order.颜色) {
                await fetchCascadeOptions('颜色', order.颜色);
                if (order.规格) {
                  await fetchCascadeOptions('规格', order.规格);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('查询订单录入数据失败:', error);
    }
  };

  // 平台+订单编号查重
  const checkOrderDuplicate = async (平台, 订单编号) => {
    if (!平台 || !订单编号) {
      setDuplicateError('');
      return;
    }
    try {
      const res = await api.get(
        `/customer/check-duplicate?平台=${encodeURIComponent(平台)}&订单编号=${encodeURIComponent(订单编号)}`
      );
      if (res.data.exists) {
        setDuplicateError(`该订单已被${res.data.登记人}登记过了，无需再次登记`);
      } else {
        setDuplicateError('');
      }
    } catch (error) {
      console.error('查重检查失败:', error);
    }
  };

  const checkCourierDuplicate = async (快递, 单号) => {
    if (!快递 || !单号) {
      setCourierError('');
      return;
    }
    try {
      const res = await api.get(
        `/customer/check-courier?快递=${encodeURIComponent(快递)}&单号=${encodeURIComponent(单号)}`
      );
      if (res.data.exists) {
        setCourierError('请注意，该快递单号已登记，客户虚假退货，请立即反馈');
      } else {
        setCourierError('');
      }
    } catch (error) {
      console.error('快递查重检查失败:', error);
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

  const handleEditFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    const allFiles = [...editSelectedFiles, ...newFiles];
    setEditSelectedFiles(allFiles);
    
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
    setEditFilePreviews([...editFilePreviews, ...previews]);
  };

  /** 从 clipboard 提取图片 */
  const handleContainerPaste = async (e, onFile) => {
    // 方案1：从 paste event 的 items 中提取图片（浏览器 + 部分 Electron 场景）
    const items = e.clipboardData?.items || e.clipboardData?.files || [];
    for (const item of items) {
      if (item.type?.startsWith('image/')) {
        const blob = item.getAsFile ? item.getAsFile() : (item.kind === 'file' ? item : null);
        if (blob) {
          e.preventDefault();
          const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type || 'image/png' });
          onFile(file);
          return true;
        }
      }
    }
    // 方案2：Electron 环境下，clipboardData 可能不包含图片（如 input[type=text]），
    // 回退到 Electron 原生剪贴板 API 读取
    if (window.electronClipboard?.readImage) {
      try {
        const dataUrl = await window.electronClipboard.readImage();
        if (dataUrl) {
          e.preventDefault();
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: 'image/png' });
          onFile(file);
          return true;
        }
      } catch (err) {
        console.warn('Electron clipboard readImage failed:', err);
      }
    }
    return false;
  };

  const uploadAttachments = async (customerId) => {
    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await api.post(`/customer/${customerId}/attachments`, formData);
      } catch (error) {
        console.error('文件上传失败:', error);
      }
    }
  };

  const uploadEditAttachments = async (customerId) => {
    for (const file of editSelectedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('status', 'pending');
      try {
        await api.post(`/customer/${customerId}/attachments`, formData);
      } catch (error) {
        const msg = error.response?.data?.error || error.message || '未知错误';
        console.error('文件上传失败:', msg);
        alert(`文件 "${file.name}" 上传失败: ${msg}`);
        throw error;
      }
    }
  };

  const fetchAttachments = async (customerId) => {
    try {
      const res = await api.get(`/customer/${customerId}/attachments`);
      const data = res.data.attachments;
      setAttachments(prev => ({ ...prev, [customerId]: Array.isArray(data) ? data : [] }));
    } catch (error) {
      console.error('获取附件失败:', error);
      setAttachments(prev => ({ ...prev, [customerId]: [] }));
    }
  };

  const handleDeleteAttachment = async (customerId, attachmentId) => {
    try {
      await api.delete(`/customer/attachments/${attachmentId}`);
      setAttachments(prev => ({
        ...prev,
        [customerId]: prev[customerId].filter(a => a.id !== attachmentId)
      }));
    } catch (error) {
      console.error('删除附件失败:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation: check all required fields except 备注 and 价格 (auto-filled)
    const requiredFields = [
      '平台', '订单编号', '仓库', '购买日期', '客户信息',
      '品牌', '型号', '类型', '颜色', '规格',
      '原因', '状态', '购买件数', '退货件数',
      '快递', '单号', '运费', '登记人'
    ];
    
    const newErrors = {};
    let hasError = false;
    
    requiredFields.forEach(field => {
      const value = formData[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        newErrors[field] = `${field}为必填项`;
        hasError = true;
      }
    });
    
    if (hasError) {
      setErrors(newErrors);
      alert('请填写所有必填项');
      return;
    }
    
    try {
      const res = await api.post(`/customer`, formData);
      
      if (selectedFiles.length > 0) {
        await uploadAttachments(res.data.id);
      }
      
      copyToClipboardWithAlert(getCopyText(formData), false);
      alert('登记成功,已复制记录到剪贴板！');
      setShowForm(false);
      setSelectedFiles([]);
      setFilePreviews([]);
      setFormData({
        订单编号: '',
        客户信息: '',
        购买日期: '',
        品牌: '',
        型号: '',
        类型: '',
        颜色: '',
        规格: '',
        原因: '',
        状态: '',
        快递: '',
        单号: '',
        备注: '',
        价格: '',
        仓库: '',
        平台: '',
        运费: '',
        登记人: user?.name || '',
        购买件数: '',
        退货件数: ''
      });
      setErrors({});
      setDuplicateError('');
      setCourierError('');
      setPage(1);
      fetchRecords(1);
    } catch (error) {
      alert('登记失败：' + (error.response?.data?.error || '未知错误'));
    }
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const newState = { ...prev, [id]: !prev[id] };
      if (newState[id]) {
        fetchAttachments(id);
        if (!changeHistory[id]) {
          fetchChangeHistory(id);
        }
      }
      return newState;
    });
  };

  // 获取展开行的动画样式
  const getExpandedRowStyle = (isExpanded) => {
    if (!isExpanded) {
      return {
        display: 'none'
      };
    }
    return {
      background: '#f9f9f9',
      animation: 'expandFadeIn 0.3s ease-in-out'
    };
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/customer/${id}`);
      alert('删除成功');
      setPage(1);
      fetchRecords(1);
    } catch (error) {
      alert('删除失败：' + (error.response?.data?.error || '未知错误'));
    }
  };

  const fetchChangeHistory = async (customerId) => {
    try {
      const res = await api.get(`/customer/${customerId}/change-requests`);
      const data = res.data.changeRequests;
      setChangeHistory(prev => ({ ...prev, [customerId]: Array.isArray(data) ? data : [] }));
    } catch (error) {
      console.error('获取修改历史失败:', error);
      setChangeHistory(prev => ({ ...prev, [customerId]: [] }));
    }
  };

  const handleEdit = (record) => {
    setShowEditModal(true);
    setEditingRecord(record);
    const formattedRecord = { ...record };
    if (formattedRecord.购买日期) {
      formattedRecord.购买日期 = formattedRecord.购买日期.split('T')[0];
    }
    const recordCopy = { ...record };
    if (recordCopy.购买日期) {
      recordCopy.购买日期 = recordCopy.购买日期.split('T')[0];
    }
    setOriginalRecord(recordCopy);
    setEditFormData(formattedRecord);
    setEditErrors({});
    setEditSelectedFiles([]);
    setEditFilePreviews([]);
    setEditUnitPrice(parseFloat(record.价格) || 0);
    setEditOptions({
      platforms: options.platforms || [],
      warehouses: options.warehouses || [],
      brands: options.brands || [],
      models: [],
      types: [],
      colors: [],
      specs: [],
      reasons: options.reasons || [],
      statuses: options.statuses || []
    });
    fetchAttachments(record.ID);
    loadExistingCascadeOptions(record);
  };

  const getCopyText = (data) => {
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
    
    return fields
      .map(f => {
        let value = data[f.key] || '';
        if (f.key === '购买日期' && value) {
          value = value.split('T')[0];
        }
        return `${f.label}：${value}`;
      })
      .join('\n');
  };

  const copyToClipboardWithAlert = (text, showAlert = true) => {
    copyToClipboard(text).then(() => {
      if (showAlert) alert('已复制到剪贴板');
    }).catch(err => {
      console.error('复制失败:', err);
      if (showAlert) alert('复制失败，请手动复制');
    });
  };

  const handleCopyRecord = (record) => {
    copyToClipboardWithAlert(getCopyText(record));
  };

  const handleShareRecord = async (record) => {
    console.log('分享记录被点击，记录 ID:', record.ID);
    try {
      console.log('开始调用 API 创建分享链接...');
      const res = await api.post(`/share/return/${record.ID}`);
      console.log('API 响应:', res);
      if (res.data.success) {
        // Electron 中 window.location.origin = file://，使用 API_BASE_URL 构造正确链接
        const baseUrl = window.location.origin.startsWith('file://')
          ? API_BASE_URL
          : window.location.origin;
        const shareUrl = `${baseUrl}/#/share/return/${res.data.token}`;
        console.log('分享 URL:', shareUrl);
        setShareModalData(record);
        setShareModalUrl(shareUrl);
        setShowShareModal(true);
        setShareRecordId(record.ID);
      }
    } catch (error) {
      console.error('创建分享链接失败:', error);
      alert('创建分享链接失败，请重试');
    }
  };

  const loadExistingCascadeOptions = async (record) => {
    const brand = record.品牌;
    const model = record.型号;
    const type = record.类型;
    const color = record.颜色;
      
      if (brand) {
        try {
          const res = await api.get(`/product-data/models?brand=${encodeURIComponent(brand)}`);
          setEditOptions(prev => ({ ...prev, models: res.data.models || [] }));
        } catch (e) { console.error(e); }
      }
      
      if (brand && model) {
        try {
          const res = await api.get(`/product-data/types?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`);
          setEditOptions(prev => ({ ...prev, types: res.data.types || [] }));
        } catch (e) { console.error(e); }
      }
      
      if (brand && model && type) {
        try {
          const res = await api.get(`/product-data/colors?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&type=${encodeURIComponent(type)}`);
          setEditOptions(prev => ({ ...prev, colors: res.data.colors || [] }));
        } catch (e) { console.error(e); }
      }
      
      if (brand && model && type && color) {
        try {
          const res = await api.get(`/product-data/specs?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&type=${encodeURIComponent(type)}&color=${encodeURIComponent(color)}`);
          setEditOptions(prev => ({ ...prev, specs: res.data.specs || [] }));
        } catch (e) { console.error(e); }
      }
  };

  const handleEditFormChange = (field, value) => {
    if (IMMUTABLE_FIELDS.includes(field)) return;
    
    setEditFormData(prev => {
      const newData = { ...prev, [field]: value };
      // Reset downstream fields when a parent changes
      if (field === '品牌') {
        newData.型号 = '';
        newData.类型 = '';
        newData.颜色 = '';
        newData.规格 = '';
        newData.价格 = '';
        setEditUnitPrice(0);
      } else if (field === '型号') {
        newData.类型 = '';
        newData.颜色 = '';
        newData.规格 = '';
        newData.价格 = '';
        setEditUnitPrice(0);
      } else if (field === '类型') {
        newData.颜色 = '';
        newData.规格 = '';
        // 不清空价格，让用户可以保留原价格
      } else if (field === '颜色') {
        newData.规格 = '';
        newData.价格 = '';
        setEditUnitPrice(0);
      } else if (field === '购买件数') {
        const qty = parseFloat(value) || 0;
        const up = editUnitPrice || parseFloat(prev.价格) || 0;
        newData.价格 = (qty * up).toString();
      }
      return newData;
    });
  
    if (value) {
      setEditErrors(prev => ({ ...prev, [field]: '' }));
    }
  
    // Fetch cascade options
    fetchEditCascadeOptions(field, value);
  };

  const fetchEditCascadeOptions = async (field, value) => {
    try {
      let url = `${API_BASE_URL}/api/product-data/`;
      
      if (field === '品牌' && value) {
        url += `models/${encodeURIComponent(value)}`;
      } else if (field === '型号' && value && editFormData.品牌) {
        url += `types/${encodeURIComponent(editFormData.品牌)}/${encodeURIComponent(value)}`;
      } else if (field === '类型' && value && editFormData.品牌 && editFormData.型号) {
        url += `colors/${encodeURIComponent(editFormData.品牌)}/${encodeURIComponent(editFormData.型号)}/${encodeURIComponent(value)}`;
      } else if (field === '颜色' && value && editFormData.品牌 && editFormData.型号 && editFormData.类型) {
        url += `specs/${encodeURIComponent(editFormData.品牌)}/${encodeURIComponent(editFormData.型号)}/${encodeURIComponent(editFormData.类型)}/${encodeURIComponent(value)}`;
      } else if (field === '规格' && value && editFormData.品牌 && editFormData.型号 && editFormData.类型 && editFormData.颜色) {
        url += `price/${encodeURIComponent(editFormData.品牌)}/${encodeURIComponent(editFormData.型号)}/${encodeURIComponent(editFormData.类型)}/${encodeURIComponent(editFormData.颜色)}/${encodeURIComponent(value)}`;
      } else {
        return;
      }
      
      const response = await api.get(url);
      
      let data = response.data;
      if (data && data.models) data = data.models;
      if (data && data.types) data = data.types;
      if (data && data.colors) data = data.colors;
      if (data && data.specs) data = data.specs;
      if (data && data.prices) data = data.prices;
      if (data && data.price !== undefined) data = [data.price];
      if (data && data.length === undefined) data = [];
      
      setEditOptions(prev => {
        const newOptions = { ...prev };
        if (field === '品牌') newOptions.models = data || [];
        else if (field === '型号') newOptions.types = data || [];
        else if (field === '类型') newOptions.colors = data || [];
        else if (field === '颜色') newOptions.specs = data || [];
        else if (field === '规格') {
          newOptions.prices = data || [];
          if (data && data.length > 0) {
            const unitP = parseFloat(data[0]);
            setEditUnitPrice(unitP);
            const qty = parseFloat(editFormData.购买件数) || 1;
            setEditFormData(prev => ({ ...prev, 价格: (unitP * qty).toString() }));
          }
        }
        return newOptions;
      });
    } catch (error) {
      console.error('获取选项失败:', error);
    }
  };

  const handleEditSubmit = async () => {
    // 只验证可编辑的字段，并且只验证原本就有值的字段（不是空白的）
    const editableFields = Object.keys(editFormData).filter(f => !IMMUTABLE_FIELDS.includes(f));
    const newErrors = {};
    let hasError = false;
    
    // 只验证原本就有值的必填字段
    const requiredFields = editableFields.filter(f => {
      // 如果原始记录中该字段有值，或者 editFormData 中有值，则需要验证
      return f !== '备注' && (originalRecord[f] || editFormData[f]);
    });
    
    requiredFields.forEach(field => {
      const value = editFormData[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        newErrors[field] = `${field}为必填项`;
        hasError = true;
      }
    });
    
    if (hasError) {
      setEditErrors(newErrors);
      alert('请填写所有必填项');
      return;
    }

    try {
      const changedFields = {};
      for (const key of Object.keys(editFormData)) {
        const originalValue = originalRecord[key];
        const newValue = editFormData[key];
        
        const orig = originalValue === undefined || originalValue === null ? '' : String(originalValue).trim();
        const curr = newValue === undefined || newValue === null ? '' : String(newValue).trim();
        
        if (orig !== curr) {
          changedFields[key] = newValue;
        }
      }
      
      console.log('Original record:', originalRecord);
      console.log('Edit form data:', editFormData);
      console.log('Changed fields:', changedFields);
      
      if (Object.keys(changedFields).length === 0 && editSelectedFiles.length === 0) {
        alert('没有修改任何内容');
        return;
      }
      
      if (Object.keys(changedFields).length > 0 || editSelectedFiles.length > 0) {
        await api.post(`/customer/${editingRecord.ID}/change-request`, changedFields);
      }
      
      if (editSelectedFiles.length > 0) {
        await uploadEditAttachments(editingRecord.ID);
      }
      
      alert('修改申请已提交，等待管理员审核');
      setShowEditModal(false);
      setEditSelectedFiles([]);
      setEditFilePreviews([]);
      setPage(1);
      fetchRecords(1);
    } catch (error) {
      alert('提交失败：' + (error.response?.data?.error || '未知错误'));
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

  // 结算徽标：红=已录金额待分发凭证，绿=金额与凭证齐全，橙=未结算
  const hasSettleAmount = (r) => !!(r && r.结算金额 !== null && r.结算金额 !== undefined && r.结算金额 !== '' && Number(r.结算金额) > 0);
  const hasSettleProof = (r) => !!(r && r.settlement_proof_url && String(r.settlement_proof_url).trim());
  const settlementBadgeBg = (r) => {
    if (hasSettleAmount(r)) return hasSettleProof(r) ? '#4caf50' : '#f44336';
    return (r && r.结算 === '已结算') ? '#4caf50' : '#ff9800';
  };

  // 累计列表持久化，刷新页面不丢
  useEffect(() => {
    try {
      localStorage.setItem('pendingSettlementBatch', JSON.stringify(pendingBatch));
    } catch (e) { /* 忽略存储异常 */ }
  }, [pendingBatch]);

  const pendingBatchTotal = pendingBatch.reduce((s, p) => s + Number(p.amount || 0), 0);

  const handleSettlementClick = (record) => {
    if (hasSettleAmount(record)) {
      setSettlementRecord(record);
      setProofImageUrl(hasSettleProof(record) ? record.settlement_proof_url : '');
      setShowProofModal(true);
      return;
    }
    if (record.结算 === '已结算') return;
    setSettlementRecord(record);
    setShippingAmount('');
    setShowShippingModal(true);
  };




  const handleSettlementImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSettlementImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSettlementImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAdminClearSettlement = async (id) => {
    try {
      await api.post(`/customer/${id}/settlement-cancel`);
      setShowProofModal(false);
      setSettlementRecord(null);
      setPage(1);
      fetchRecords(1);
    } catch (error) {
      alert('清除失败：' + (error.response?.data?.error || '未知错误'));
    }
  };
  const handleDeleteSettlementProof = async (id) => {
    try {
      const res = await api.delete(`/customer/${id}/settlement-proof`);
      if (!res.ok) {
        alert('清除凭证失败：' + (res.data?.error || res.data?.message || '未知错误'));
        return;
      }
      setShowProofModal(false);
      setSettlementRecord(null);
      setPage(1);
      fetchRecords(1);
    } catch (error) {
      alert('清除凭证失败：' + (error.response?.data?.error || '未知错误'));
    }
  };
  const handleDeleteChangeRequest = async (id, registrationId) => {
    try {
      const res = await api.delete(`/change-requests/${id}`);
      if (!res.ok) {
        alert('删除失败：' + (res.data?.error || res.data?.message || '未知错误'));
        return;
      }
      setPage(1);
      fetchRecords(1);
    } catch (error) {
      alert('删除失败：' + (error.response?.data?.error || '未知错误'));
    }
  };
  const handleShippingAmountSubmit = async () => {
    if (!settlementRecord) return;
    const amount = parseFloat(shippingAmount);
    if (isNaN(amount) || amount < 0) {
      alert('请输入有效金额');
      return;
    }
    // 凭证不再随金额提交，改为页面顶部统一上传后分发
    const rounded = Number(amount.toFixed(2));
    const target = settlementRecord;
    try {
      const formData = new FormData();
      formData.append('amount', rounded.toString());
      const res = await api.post(`/customer/${target.ID}/settlement-amount`, formData);
      if (!res || !res.ok) {
        alert('提交失败：' + (res?.data?.error || res?.data?.message || ('HTTP ' + (res?.status ?? ''))));
        return;
      }
      setShowShippingModal(false);
      setSettlementRecord(null);
      setShippingAmount('');
      if (isAdmin) {
        // 金额已入库（行内变红底），登记到累计区等待统一上传凭证
        setPendingBatch(prev => prev.some(p => p.id === target.ID)
          ? prev.map(p => p.id === target.ID ? { ...p, amount: rounded } : p)
          : [...prev, { id: target.ID, orderNo: target.订单编号 || '', amount: rounded }]);
      }
      setPage(1);
      fetchRecords(1);
      fetchPendingSettlementRequests();
      fetchRejectedSettlementIds();
    } catch (error) {
      alert('提交失败：' + (error?.data?.error || error?.message || '网络异常'));
    }
  };

  const handleBatchProofChange = (file) => {
    if (!file) return;
    setBatchProofFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setBatchProofPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removePendingBatchItem = (id) => {
    setPendingBatch(prev => prev.filter(p => p.id !== id));
  };

  const clearPendingBatch = () => {
    if (pendingBatch.length === 0) return;
    if (!window.confirm('确定清空累计列表吗？\n\n已录入的金额不会从记录中删除，只是不再等待批量分发凭证。')) return;
    setPendingBatch([]);
    setBatchProofFile(null);
    setBatchProofPreview(null);
    setShowBatchDetail(false);
  };

  const handleConfirmBatchDistribute = async () => {
    if (pendingBatch.length === 0) { alert('没有待分发的记录'); return; }
    if (!batchProofFile) { alert('请先上传结算凭证'); return; }
    const ids = pendingBatch.map(p => p.id);
    if (!window.confirm(`确认将这张凭证分发给 ${ids.length} 条记录，合计 ¥${pendingBatchTotal.toFixed(2)}？\n\n分发后这些记录的结算标记会变成绿色。`)) return;
    setBatchSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('settlement_image', batchProofFile);
      formData.append('ids', JSON.stringify(ids));
      const res = await api.post('/customer/batch-settlement-proof', formData);
      if (!res || !res.ok) {
        alert('分发失败：' + (res?.data?.error || res?.data?.message || ('HTTP ' + (res?.status ?? ''))));
        return;
      }
      alert(`已分发到 ${res.data?.count ?? ids.length} 条记录`);
      setPendingBatch([]);
      setBatchProofFile(null);
      setBatchProofPreview(null);
      setShowBatchDetail(false);
      setPage(1);
      fetchRecords(1);
    } catch (error) {
      alert('分发失败：' + (error?.data?.error || error?.message || '网络异常'));
    } finally {
      setBatchSubmitting(false);
    }
  };
  
  const getAttachmentType = (mimeType) => {
    if (mimeType && mimeType.startsWith('image/')) return 'image';
    if (mimeType && mimeType.startsWith('video/')) return 'video';
    return 'file';
  };

  const getImageUrl = (filePath) => {
    if (!filePath) return '';
    const normalized = filePath.replace(/^\.\//, '').replace(/^\/app/, '');
    const path = normalized.startsWith('/') ? normalized : '/' + normalized;
    return API_BASE_URL + path;
  };

  const truncateText = (text, maxLength = 15) => {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
    boxSizing: 'border-box',
    ...(fieldName === '购买日期' ? { appearance: 'none', WebkitAppearance: 'none', lineHeight: 'normal' } : {})
  });

  return (
    <React.Fragment>
      <style>{`
        @keyframes expandFadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div style={{ padding: isMobile ? '8px' : '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '12px' : '16px' }}>
        <h3 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: '600' }}>退货登记</h3>
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
          {showForm ? '关闭表单' : '新增登记'}
        </button>
      </div>

      <div style={{ background: '#fff', padding: isMobile ? '10px' : '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {!isMobile && (
        <span style={{ fontSize: '13px', fontWeight: '500', width: isMobile ? '100%' : 'auto', marginBottom: isMobile ? '4px' : 0 }}>搜索：</span>
        )}
        <select
          value={searchPlatform}
          onChange={e => handleSearchPlatformChange(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minWidth: isMobile ? 0 : '120px', flex: isMobile ? '1 1 calc(30% - 4px)' : '0 0 auto', height: '32px', boxSizing: 'border-box' }}
        >
          <option value="">全部平台</option>
          {options.platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input
          type="text"
          placeholder="请输入订单编号"
          value={searchOrderNo}
          onChange={e => setSearchOrderNo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          list="search-order-list"
          style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', width: isMobile ? 'auto' : '180px', flex: isMobile ? '1 1 calc(70% - 4px)' : '0 0 auto', height: '32px', boxSizing: 'border-box' }}
        />
        <datalist id="search-order-list">
          {searchOrderOptions.map(no => <option key={no} value={no} />)}
        </datalist>
        <div style={{ display: 'flex', gap: '8px', flex: isMobile ? '1 1 100%' : '0 0 auto', justifyContent: isMobile ? 'center' : 'flex-start' }}>
          <button
            onClick={handleSearch}
            style={{ padding: '6px 16px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
          >
            搜索
          </button>
          <button
            onClick={handleClearSearch}
            style={{ padding: '6px 16px', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
          >
            清空
          </button>
        </div>
        {isAdmin && pendingBatch.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#fff5f5', border: '1px solid #f44336', borderRadius: '6px', flexWrap: 'wrap', flex: isMobile ? '1 1 100%' : '0 0 auto', marginLeft: isMobile ? 0 : 'auto' }}>
            <span style={{ fontSize: '12px', color: '#c62828', fontWeight: '500', whiteSpace: 'nowrap' }}>待分发</span>
            <label
              title={batchProofFile ? '点击重新选择凭证' : '上传结算凭证（多笔共用一张）'}
              style={{ width: '28px', height: '28px', border: batchProofPreview ? '1px solid #f44336' : '1px dashed #f44336', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: '#f44336', background: '#fff', overflow: 'hidden', flexShrink: 0 }}
            >
              {batchProofPreview ? <img src={batchProofPreview} alt="凭证" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '+'}
              <input type="file" accept="image/jpeg,image/jpg,image/png,image/gif" onChange={e => handleBatchProofChange(e.target.files[0])} style={{ display: 'none' }} />
            </label>
            <input
              type="text"
              placeholder="📋右键粘贴"
              onPaste={(e) => { handleContainerPaste(e, (f) => handleBatchProofChange(f)); }}
              style={{ width: '76px', height: '28px', fontSize: '11px', border: '1px dashed #1976d2', borderRadius: '4px', padding: '0 4px', outline: 'none', cursor: 'default', background: '#f0f7ff', color: '#1976d2', boxSizing: 'border-box' }}
            />
            <span onClick={() => setShowBatchDetail(v => !v)} style={{ fontSize: '12px', color: '#c62828', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline' }}>
              {pendingBatch.length} 笔 ¥{pendingBatchTotal.toFixed(2)}
            </span>
            <button
              onClick={handleConfirmBatchDistribute}
              disabled={batchSubmitting}
              style={{ padding: '4px 12px', background: batchSubmitting ? '#bdbdbd' : '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: batchSubmitting ? 'default' : 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
            >
              {batchSubmitting ? '分发中…' : '确认'}
            </button>
            <button onClick={clearPendingBatch} style={{ padding: '4px 8px', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>清空</button>
            {showBatchDetail && (
              <div style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                {pendingBatch.map(p => (
                  <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: '#fff', border: '1px solid #ffcdd2', borderRadius: '3px', fontSize: '11px', color: '#c62828' }}>
                    {p.orderNo || ('#' + p.id)} ¥{Number(p.amount).toFixed(2)}
                    <span title="移除" onClick={() => removePendingBatchItem(p.id)} style={{ cursor: 'pointer', color: '#f44336', fontWeight: 'bold' }}>×</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px' }}>
            <div>
              <label style={labelStyle('平台')}>平台 *</label>
              <select style={inputStyle('平台')} value={formData.平台} onChange={e => handleFormChange('平台', e.target.value)}>
                <option value="">请选择平台</option>
                {options.platforms.map(p => <option key={p} value={p}>{p}</option>)}
                {formData.平台 && !options.platforms.includes(formData.平台) && <option value={formData.平台}>{formData.平台}</option>}
              </select>
              {errors['平台'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['平台']}</div>}
            </div>
            <div>
              <label style={labelStyle('订单编号')}>订单编号 *</label>
              <input style={inputStyle('订单编号')} value={formData.订单编号} onChange={e => handleFormChange('订单编号', formatOrderNo(e.target.value))} placeholder="只能输入字母和数字" />
              {errors['订单编号'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['订单编号']}</div>}
              {duplicateError && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{duplicateError}</div>}
            </div>
            <div>
              <label style={labelStyle('仓库')}>仓库 *</label>
              <select style={inputStyle('仓库')} value={formData.仓库} onChange={e => { setFormData({...formData, 仓库: e.target.value}); if (e.target.value) setErrors(prev => ({...prev, '仓库': ''})); }}>
                <option value="">请选择仓库</option>
                {options.warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                {formData.仓库 && !options.warehouses.includes(formData.仓库) && <option value={formData.仓库}>{formData.仓库}</option>}
              </select>
              {errors['仓库'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['仓库']}</div>}
            </div>
            <div>
              <label style={labelStyle('购买日期')}>购买日期 *</label>
              <input style={inputStyle('购买日期')} type="date" max={new Date().toISOString().split('T')[0]} value={formData.购买日期} onChange={e => { setFormData({...formData, 购买日期: e.target.value}); if (e.target.value) setErrors(prev => ({...prev, '购买日期': ''})); }} />
              {errors['购买日期'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['购买日期']}</div>}
            </div>
            <div style={{ gridColumn: isMobile ? 'span 2' : 'span 4' }}>
              <label style={labelStyle('客户信息')}>客户信息 *</label>
              {isMobile ? (
                <textarea
                  style={{...inputStyle('客户信息'), resize: 'none', minHeight: '60px', height: 'auto', overflow: 'hidden'}}
                  value={formData.客户信息}
                  onChange={e => { setFormData({...formData, 客户信息: e.target.value}); if (e.target.value) setErrors(prev => ({...prev, '客户信息': ''})); }}
                  onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                />
              ) : (
              <input style={inputStyle('客户信息')} value={formData.客户信息} onChange={e => { setFormData({...formData, 客户信息: e.target.value}); if (e.target.value) setErrors(prev => ({...prev, '客户信息': ''})); }} />
              )}
              {errors['客户信息'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['客户信息']}</div>}
            </div>
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
            <div>
              <label style={labelStyle('规格')}>规格 *</label>
              <select style={inputStyle('规格')} value={formData.规格} onChange={e => handleFormChange('规格', e.target.value)} disabled={!formData.颜色}>
                <option value="">请选择规格</option>
                {options.specs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors['规格'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['规格']}</div>}
            </div>
            <div>
              <label style={labelStyle('价格')}>价格 *</label>
              <input style={{...inputStyle('价格'), background: '#f5f5f5', color: '#666'}} type="number" step="0.01" value={formData.价格} readOnly />
            </div>
            <div>
              <label style={labelStyle('原因')}>原因 *</label>
              <select style={inputStyle('原因')} value={formData.原因} onChange={e => { setFormData({...formData, 原因: e.target.value}); if (e.target.value) setErrors(prev => ({...prev, '原因': ''})); }}>
                <option value="">请选择原因</option>
                {options.reasons.map(r => <option key={r} value={r}>{r}</option>)}
                {formData.原因 && !options.reasons.includes(formData.原因) && <option value={formData.原因}>{formData.原因}</option>}
              </select>
              {errors['原因'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['原因']}</div>}
            </div>
            <div>
              <label style={labelStyle('状态')}>状态 *</label>
              <select style={inputStyle('状态')} value={formData.状态} onChange={e => { setFormData({...formData, 状态: e.target.value}); if (e.target.value) setErrors(prev => ({...prev, '状态': ''})); }}>
                <option value="">请选择状态</option>
                {options.statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors['状态'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['状态']}</div>}
            </div>
            <div>
              <label style={labelStyle('购买件数')}>购买件数 *</label>
              <input style={inputStyle('购买件数')} type="number" value={formData.购买件数} onChange={e => handleFormChange('购买件数', e.target.value)} />
              {errors['购买件数'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['购买件数']}</div>}
            </div>
            <div>
              <label style={labelStyle('退货件数')}>退货件数 *</label>
              <input style={inputStyle('退货件数')} type="number" value={formData.退货件数} onChange={e => { setFormData({...formData, 退货件数: e.target.value}); if (e.target.value) setErrors(prev => ({...prev, '退货件数': ''})); }} />
              {errors['退货件数'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['退货件数']}</div>}
            </div>
            <div>
              <label style={labelStyle('快递')}>快递 *</label>
              <select style={inputStyle('快递')} value={formData.快递} onChange={e => handleFormChange('快递', e.target.value)}>
                <option value="">请选择快递</option>
                {options.couriers.map(c => <option key={c} value={c}>{c}</option>)}
                {formData.快递 && !options.couriers.includes(formData.快递) && <option value={formData.快递}>{formData.快递}</option>}
              </select>
              {errors['快递'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['快递']}</div>}
            </div>
            <div>
              <label style={labelStyle('单号')}>单号 *</label>
              <input style={inputStyle('单号')} value={formData.单号} onChange={e => handleFormChange('单号', formatOrderNo(e.target.value))} placeholder="只能输入字母和数字" />
              {errors['单号'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['单号']}</div>}
              {courierError && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{courierError}</div>}
            </div>
            <div>
              <label style={labelStyle('运费')}>运费 *</label>
              <input style={inputStyle('运费')} type="number" step="0.01" value={formData.运费} onChange={e => { setFormData({...formData, 运费: e.target.value}); if (e.target.value) setErrors(prev => ({...prev, '运费': ''})); }} />
              {errors['运费'] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{errors['运费']}</div>}
            </div>
            </div>
            <React.Fragment>
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>备注：</label>
                <textarea style={{ width: '100%', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minHeight: '50px', boxSizing: 'border-box' }} value={formData.备注} onChange={e => setFormData({...formData, 备注: e.target.value})} />
              </div>
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>附件上传</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {filePreviews.map((item, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
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
                        <span style={{ position: 'absolute', bottom: '2px', left: '2px', right: '2px', fontSize: '9px', color: '#fff', background: 'rgba(0,0,0,0.5)', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.name}</span>
                      )}
                      <button 
                        onClick={() => {
                          const newFiles = selectedFiles.filter((_, i) => i !== idx);
                          const newPreviews = filePreviews.filter((_, i) => i !== idx);
                          setSelectedFiles(newFiles);
                          setFilePreviews(newPreviews);
                        }}
                        style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', padding: '0', fontSize: '12px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', lineHeight: '1', zIndex: 1 }}
                      >×</button>
                    </div>
                  ))}
                  <label style={{ 
                    width: '80px', 
                    height: '80px', 
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
                  <input
                    type="text"
                    placeholder="📋 右键粘贴"
                    onPaste={(e) => {
                      handleContainerPaste(e, (f) => { setSelectedFiles(prev => [...prev, f]); setFilePreviews(prev => [...prev, { file: f, preview: URL.createObjectURL(f), name: f.name, type: f.type }]); });
                    }}
                    
                    style={{ width: '85px', height: '28px', fontSize: '11px', border: '1px dashed #1976d2', borderRadius: '4px', padding: '0 4px', outline: 'none', cursor: 'default', background: '#f0f7ff', color: '#1976d2', boxSizing: 'border-box', alignSelf: 'center' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                <button type="submit" style={{ padding: '8px 24px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
                  提交登记
                </button>
              </div>
            </React.Fragment>
          </form>
        )}
      </div>

      <div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载中...</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
{!isMobile && (
            <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '140px' }}>订单编号 <span style={{ color: sortConfig.key === '订单编号' ? '#1976d2' : '#ccc', cursor: 'pointer', fontSize: '12px', marginLeft: '2px' }} onClick={(e) => { e.stopPropagation(); handleSort('订单编号'); }}>{sortConfig.key === '订单编号' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '120px' }}>客户信息 <span style={{ color: sortConfig.key === '客户信息' ? '#1976d2' : '#ccc', cursor: 'pointer', fontSize: '12px', marginLeft: '2px' }} onClick={(e) => { e.stopPropagation(); handleSort('客户信息'); }}>{sortConfig.key === '客户信息' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '70px' }}>品牌 <span style={{ color: sortConfig.key === '品牌' ? '#1976d2' : '#ccc', cursor: 'pointer', fontSize: '12px', marginLeft: '2px' }} onClick={(e) => { e.stopPropagation(); handleSort('品牌'); }}>{sortConfig.key === '品牌' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></th>
<th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '50px' }}>型号 <span style={{ color: sortConfig.key === '型号' ? '#1976d2' : '#ccc', cursor: 'pointer', fontSize: '12px', marginLeft: '2px' }} onClick={(e) => { e.stopPropagation(); handleSort('型号'); }}>{sortConfig.key === '型号' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></th>
<th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '50px' }}>原因 <span style={{ color: sortConfig.key === '原因' ? '#1976d2' : '#ccc', cursor: 'pointer', fontSize: '12px', marginLeft: '2px' }} onClick={(e) => { e.stopPropagation(); handleSort('原因'); }}>{sortConfig.key === '原因' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></th>
                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '60px' }}>状态 <span style={{ color: sortConfig.key === '状态' ? '#1976d2' : '#ccc', cursor: 'pointer', fontSize: '12px', marginLeft: '2px' }} onClick={(e) => { e.stopPropagation(); handleSort('状态'); }}>{sortConfig.key === '状态' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></th>
                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '50px' }}>购买 <span style={{ color: sortConfig.key === '购买件数' ? '#1976d2' : '#ccc', cursor: 'pointer', fontSize: '12px', marginLeft: '2px' }} onClick={(e) => { e.stopPropagation(); handleSort('购买件数'); }}>{sortConfig.key === '购买件数' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></th>
                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '50px' }}>退货 <span style={{ color: sortConfig.key === '退货件数' ? '#1976d2' : '#ccc', cursor: 'pointer', fontSize: '12px', marginLeft: '2px' }} onClick={(e) => { e.stopPropagation(); handleSort('退货件数'); }}>{sortConfig.key === '退货件数' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '50px' }}>快递 <span style={{ color: sortConfig.key === '快递' ? '#1976d2' : '#ccc', cursor: 'pointer', fontSize: '12px', marginLeft: '2px' }} onClick={(e) => { e.stopPropagation(); handleSort('快递'); }}>{sortConfig.key === '快递' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '50px' }}>登记人 <span style={{ color: sortConfig.key === '登记人' ? '#1976d2' : '#ccc', cursor: 'pointer', fontSize: '12px', marginLeft: '2px' }} onClick={(e) => { e.stopPropagation(); handleSort('登记人'); }}>{sortConfig.key === '登记人' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></th>
                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '60px' }}>结算</th>
                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px', width: '40px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map(record => (
                <React.Fragment key={record.ID}>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{record.订单编号 || '-'}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={record.客户信息}>{truncateText(record.客户信息, 15)}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={record.品牌}>{truncateText(record.品牌, 8)}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }} title={record.型号}>{truncateText(record.型号, 6)}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }} title={record.原因}>
                      {['无理由', '中途拦截'].includes(record.原因) ? (
                        truncateText(record.原因, 6)
                      ) : (
                        <span style={{ background: '#d32f2f', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' }}>
                          {truncateText(record.原因, 6)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span style={{
                        ...(record.状态 === '已使用' ? {
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          background: '#ff9800',
                          color: '#fff'
                        } : {})
                      }}>
                        {record.状态}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{record.购买件数 || '-'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{record.退货件数 || '-'}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }} title={record.快递}>{record.快递 || '-'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'left' }}>{record.登记人 || '-'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      {(() => { const u = JSON.parse(localStorage.getItem('user') || '{}'); return u?.role === 'admin' || !['无理由', '中途拦截'].includes(record.原因) ? (
                        <>
                          {pendingSettlementRequests[record.ID] ? (
                            <span style={{ background: '#2196f3', color: '#fff', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' }}>
                              待审核
                            </span>
                          ) : rejectedSettlementIds.has(record.ID) ? (
                            <span 
                              onClick={() => handleSettlementClick(record)}
                              style={{ 
                                cursor: 'pointer', 
                                padding: '2px 8px', 
                                borderRadius: '3px', 
                                fontSize: '11px',
                                background: '#f44336',
                                color: '#fff',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              已驳回
                            </span>
                          ) : (
                            <span 
                              onClick={() => handleSettlementClick(record)}
                              style={{ 
                                cursor: 'pointer', 
                                padding: '2px 8px', 
                                borderRadius: '3px', 
                                fontSize: '11px',
                                background: settlementBadgeBg(record),
                                color: '#fff',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {record.结算金额 ? Number(record.结算金额).toFixed(2) : (record.结算 === '已结算' ? '已结算' : '未结算')}
                            </span>
                          )}
                        </>
                      ) : <span style={{ color: '#999' }}>-</span>; })()}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span 
                        onClick={() => toggleRow(record.ID)}
                        style={{ cursor: 'pointer', color: '#1976d2', fontWeight: 'bold', fontSize: '12px' }}
                      >
                        {expandedRows[record.ID] ? '收起' : '展开'}
                      </span>
                    </td>
                  </tr>
                  {expandedRows[record.ID] && (
                    <tr style={getExpandedRowStyle(expandedRows[record.ID])}>
                      <td colSpan="12" style={{ padding: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>订单编号</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }} title={record.订单编号}>{record.订单编号 || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>客户信息</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }} title={record.客户信息}>{record.客户信息 || '-'}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>购买日期</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{fmtDate(record.购买日期) || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>品牌</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.品牌 || '-'}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>型号</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.型号 || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>类型</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.类型 || '-'}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>颜色</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.颜色 || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>规格</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.规格 || '-'}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>原因</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>
                                {['无理由', '中途拦截'].includes(record.原因) ? (
                                  record.原因 || '-'
                                ) : (
                                  <span style={{ background: '#d32f2f', color: '#fff', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' }}>
                                    {record.原因 || '-'}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>状态</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.状态 || '-'}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>快递</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.快递 || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>单号</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.单号 || '-'}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>价格</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.价格 || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>仓库</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.仓库 || '-'}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>平台</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.平台 || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>运费</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.运费 || '-'}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>购买件数</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.购买件数 || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>退货件数</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.退货件数 || '-'}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>登记人</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>{record.登记人 || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>结算</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }}>
                                {(() => { const u = JSON.parse(localStorage.getItem('user') || '{}'); return u?.role === 'admin' || !['无理由', '中途拦截'].includes(record.原因) ? (
                                  <>
                                    {pendingSettlementRequests[record.ID] ? (
                                      <span style={{ background: '#2196f3', color: '#fff', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' }}>
                                        待审核
                                      </span>
                                    ) : rejectedSettlementIds.has(record.ID) ? (
                                      <span 
                                        onClick={() => handleSettlementClick(record)}
                                        style={{ 
                                          cursor: 'pointer', 
                                          padding: '2px 8px', 
                                          borderRadius: '3px', 
                                          fontSize: '11px',
                                          background: '#f44336',
                                          color: '#fff',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        已驳回
                                      </span>
                                    ) : (
                                      <span 
                                        onClick={() => handleSettlementClick(record)}
                                        style={{ 
                                          cursor: 'pointer', 
                                          padding: '2px 8px', 
                                          borderRadius: '3px', 
                                          fontSize: '11px',
                                          background: settlementBadgeBg(record),
                                          color: '#fff',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        {record.结算金额 ? Number(record.结算金额).toFixed(2) : (record.结算 === '已结算' ? '已结算' : '未结算')}
                                      </span>
                                    )}
                                  </>
                                ) : <span style={{ color: '#999' }}>-</span>; })()}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>创建时间</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }} colSpan="3">{fmtTime(record.创建时间)}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', width: '80px', background: '#f0f0f0', textAlign: 'center' }}><strong>备注</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }} colSpan="3">{record.备注 || '-'}</td>
                            </tr>
                            {attachments[record.ID] && Array.isArray(attachments[record.ID]) && attachments[record.ID].length > 0 && (
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', background: '#f0f0f0', textAlign: 'center' }}><strong>附件</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }} colSpan="3">
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {attachments[record.ID].map(att => {
                                    const attType = getAttachmentType(att.mime_type);
                                    const url = getImageUrl(att.file_path);
                                    const isPending = att.status === 'pending';
                                    const canView = !isPending || isAdmin;
                                    return (
                                    <div key={att.id} style={{ position: 'relative', width: '60px', height: '60px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                                      {attType === 'image' && url && (
                                        <img 
                                          src={url} 
                                          alt={att.original_name || '附件'} 
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: canView ? 'pointer' : 'default', opacity: isPending && !isAdmin ? 0.6 : 1 }}
                                          onClick={() => {
                                            if (canView) {
                                              openPreview(url, 'image');
                                            }
                                          }}
                                          onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                      )}
                                      {attType === 'image' && (!url || !att.file_path) && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f5f5f5', fontSize: '9px', color: '#999' }}>无图</div>
                                      )}
                                      {attType === 'video' && url && (
                                        <div 
                                          onClick={() => {
                                            if (canView) {
                                              openPreview(url, 'video');
                                            }
                                          }}
                                          style={{ width: '100%', height: '100%', cursor: canView ? 'pointer' : 'default', position: 'relative', background: '#000', opacity: isPending && !isAdmin ? 0.6 : 1 }}
                                        >
                                          <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '18px', color: '#fff', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>▶</div>
                                        </div>
                                      )}
                                      {attType === 'file' && url && (
                                        <div 
                                          onClick={() => {
                                            if (canView) {
                                              window.open(url, '_blank');
                                            }
                                          }}
                                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '9px', color: canView ? '#666' : '#999', padding: '2px', cursor: canView ? 'pointer' : 'default', opacity: isPending && !isAdmin ? 0.6 : 1 }}
                                          title={att.original_name || (canView ? '点击打开' : '审核中不可查看')}
                                        >
                                          <span style={{ fontSize: '20px' }}>📄</span>
                                          <span style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>PDF</span>
                                        </div>
                                      )}
                                      {isPending && !isAdmin && (
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255, 152, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>审核中</span>
                                        </div>
                                      )}
                                      {isAdmin && (
                                        <button onClick={(e) => { e.stopPropagation(); if (window.confirm('确定要删除该附件吗？')) { handleDeleteAttachment(record.ID, att.id); } }} style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', padding: '0', fontSize: '10px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer', lineHeight: '1' }}>×</button>
                                      )}
                                    </div>
                                  );})}
                                </div>
                              </td>
                            </tr>
                            )}
                            {(() => {
                              const pendingSettlementReq = changeHistory[record.ID]?.find(cr => cr.settlement_new_status && cr.status === 'pending' && cr.settlement_image_url);
                              const settlementProofUrl = record.settlement_proof_url || pendingSettlementReq?.settlement_image_url;
                              return settlementProofUrl && (isAdmin || !['无理由', '中途拦截'].includes(record.原因)) ? (
                                <tr>
                                  <td style={{ padding: '4px 8px', border: '1px solid #ddd', background: '#e8f5e9', textAlign: 'center' }}><strong>结算凭证</strong></td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }} colSpan="3">
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ position: 'relative', width: '60px', height: '60px', border: '2px solid #4caf50', borderRadius: '4px', overflow: 'hidden' }}>
                                        <img 
                                          src={getImageUrl(settlementProofUrl)} 
                                          alt="结算凭证" 
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                          onClick={() => { setPreviewUrl(getImageUrl(settlementProofUrl)); setPreviewType('image'); setShowPreviewModal(true); }}
                                          onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                        {(() => { const u = JSON.parse(localStorage.getItem('user') || '{}'); return u?.role === 'admin' ? (
                                          <span
                                            onClick={(e) => { e.stopPropagation(); if (window.confirm('确定要删除结算凭证吗？（仅删除凭证图片，保留金额）')) { handleDeleteSettlementProof(record.ID); } }}
                                            style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', lineHeight: '1' }}
                                          >×</span>
                                        ) : null; })()}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null;
                            })()}
                            {changeHistory[record.ID] && Array.isArray(changeHistory[record.ID]) && changeHistory[record.ID].length > 0 ? (
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', background: '#f0f0f0', textAlign: 'center' }}><strong>修改记录</strong></td>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'left' }} colSpan="3">
                                <div>
                                {(changeHistory[record.ID].length > 1 && !expandedChangeHistory[record.ID] ? [...changeHistory[record.ID]].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 1) : [...changeHistory[record.ID]].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))).map((cr, idx) => {
                                  const isFirstRecord = idx === 0;
                                  let changes = [];
                                  try {
                                    const parsed = typeof cr.proposed_changes === 'string' ? JSON.parse(cr.proposed_changes) : cr.proposed_changes;
                                    if (parsed && typeof parsed === 'object') {
                                      changes = Object.entries(parsed)
                                        .filter(([k]) => k !== 'ID')
                                        .filter(([k, v]) => {
                                          if (typeof v === 'object' && v !== null) {
                                            return false;
                                          }
                                          return true;
                                        });
                                    }
                                  } catch (e) {
                                    changes = [];
                                  }
                                  const statusColor = cr.status === 'approved' ? '#4caf50' : cr.status === 'rejected' ? '#f44336' : '#ff9800';
                                  const statusText = cr.status === 'approved' ? '已通过' : cr.status === 'rejected' ? '已拒绝' : '待审核';
                                  const createdAt = cr.created_at ? fmtTime(cr.created_at) : '未知时间';
                                  let originalData = {};
                                  try {
                                    originalData = typeof cr.original_data === 'string' ? JSON.parse(cr.original_data) : (cr.original_data || {});
                                  } catch (e) {
                                    originalData = {};
                                  }
                                  const fieldLabels = {
                                    订单编号: '订单编号', 客户信息: '客户信息', 购买日期: '购买日期',
                                    品牌: '品牌', 型号: '型号', 类型: '类型', 颜色: '颜色', 规格: '规格',
                                    原因: '原因', 状态: '状态', 快递: '快递', 单号: '单号', 备注: '备注',
                                    价格: '价格', 仓库: '仓库', 平台: '平台', 运费: '运费',
                                    购买件数: '购买件数', 退货件数: '退货件数'
                                  };
                                  return (
                                    <div key={cr.id || Math.random()} style={{ padding: '8px', background: '#f9f9f9', borderRadius: '4px', fontSize: '12px', marginBottom: '8px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ color: '#666' }}>申请人: {cr.applicant_name || '未知'} | {createdAt}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <span style={{ color: statusColor, fontWeight: 'bold' }}>{statusText}</span>
                                          {(() => { const u = JSON.parse(localStorage.getItem('user') || '{}'); return u?.role === 'admin' ? (
                                            <span
                                              onClick={() => { if (window.confirm('确定要删除此修改记录吗？')) { handleDeleteChangeRequest(cr.id, record.ID); } }}
                                              style={{ cursor: 'pointer', fontSize: '12px', color: '#f44336', marginLeft: '4px' }}
                                            >
                                              删除
                                            </span>
                                          ) : null; })()}
                                          {changeHistory[record.ID].length > 1 && isFirstRecord && (
                                            <span 
                                              onClick={() => setExpandedChangeHistory(prev => ({ ...prev, [record.ID]: !prev[record.ID] }))}
                                              style={{ cursor: 'pointer', fontSize: '12px', color: '#1976d2' }}
                                            >
                                              {expandedChangeHistory[record.ID] ? '▼ 收起' : '▶ 展开'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                        <div style={{ color: '#333' }}>
                                          {changes.length > 0 ? changes.map(([key, newValue]) => {
                                            const oldValue = originalData[key] || '-';
                                            const label = fieldLabels[key] || key;
                                            let displayNewValue = newValue === null || newValue === '' ? '(空)' : newValue;
                                            if (typeof newValue === 'object' && newValue !== null) {
                                              if (newValue.name) {
                                                displayNewValue = `文件: ${newValue.name}`;
                                              } else {
                                                displayNewValue = JSON.stringify(newValue);
                                              }
                                            }
                                            return (
                                              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', padding: '4px 8px', background: '#fff3cd', borderRadius: '3px' }}>
                                                <span style={{ fontWeight: 'bold', minWidth: '60px' }}>{label}:</span>
                                                <span style={{ color: '#666', textDecoration: 'line-through', fontSize: '11px' }}>{oldValue}</span>
                                                <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>→</span>
                                                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>{displayNewValue}</span>
                                              </div>
                                            );
                                          }) : <span style={{ color: '#999' }}>无变更内容（仅上传了附件）</span>}
                                        </div>
                                    </div>
                                  );
                                })}
                                </div>
                              </td>
                            </tr>
                            ) : null}
                            <tr>
                              <td style={{ padding: '4px 8px', border: '1px solid #ddd', background: '#f0f0f0', textAlign: 'center' }} colSpan="4">
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  {isAdmin ? (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const hasPending = changeHistory[record.ID] && changeHistory[record.ID].some(cr => cr.status === 'pending');
                                          if (hasPending) {
                                            alert('您有待审核的修改申请，请等待审核完成后再提交新的修改');
                                            return;
                                          }
                                          handleEdit(record);
                                        }}
                                        style={{
                                          padding: '4px 12px',
                                          background: '#ff9800',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '12px'
                                        }}
                                      >
                                        修改记录
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyRecord(record);
                                        }}
                                        style={{
                                          padding: '4px 12px',
                                          background: '#9c27b0',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '12px',
                                          marginLeft: '8px'
                                        }}
                                      >
                                        复制记录
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleShareRecord(record);
                                        }}
                                        style={{
                                          padding: '4px 12px',
                                          background: '#ff9800',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '12px',
                                          marginLeft: '8px'
                                        }}
                                      >
                                        分享记录
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm('确定要删除该记录吗？')) {
                                            handleDelete(record.ID);
                                          }
                                        }}
                                        style={{
                                          padding: '4px 12px',
                                          background: '#f44336',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '12px',
                                          marginLeft: '8px'
                                        }}
                                      >
                                        删除记录
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const hasPending = changeHistory[record.ID] && changeHistory[record.ID].some(cr => cr.status === 'pending');
                                          if (hasPending) {
                                            alert('您有待审核的修改申请，请等待审核完成后再提交新的修改');
                                            return;
                                          }
                                          handleEdit(record);
                                        }}
                                        style={{
                                          padding: '4px 12px',
                                          background: '#2196f3',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '12px'
                                        }}
                                      >
                                        修改记录
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyRecord(record);
                                        }}
                                        style={{
                                          padding: '4px 12px',
                                          background: '#9c27b0',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '12px',
                                          marginLeft: '8px'
                                        }}
                                      >
                                        复制记录
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleShareRecord(record);
                                        }}
                                        style={{
                                          padding: '4px 12px',
                                          background: '#ff9800',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '12px',
                                          marginLeft: '8px'
                                        }}
                                      >
                                        分享记录
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan="11" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                    暂无登记记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
{isMobile && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    {sortedRecords.map(record => (
      <div key={record.ID} style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee', overflow: 'hidden' }}>
        <div onClick={() => toggleRow(record.ID)} style={{ padding: '10px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, fontSize: '12px', lineHeight: '2', color: '#333' }}><span style={{ color: '#999', display: 'inline-block', width: '4.5em' }}>单号：</span>{record.单号 || '-'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {(() => { const u = JSON.parse(localStorage.getItem('user') || '{}'); return u?.role === 'admin' || !['无理由', '中途拦截'].includes(record.原因) ? (
                <>
                  {pendingSettlementRequests[record.ID] ? (
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', background: '#2196f3', color: '#fff' }}>待审核</span>
                  ) : rejectedSettlementIds.has(record.ID) ? (
                    <span onClick={(e) => { e.stopPropagation(); handleSettlementClick(record); }} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', cursor: 'pointer', background: '#f44336', color: '#fff' }}>
                      已驳回
                    </span>
                  ) : (
                    <span onClick={(e) => { e.stopPropagation(); handleSettlementClick(record); }} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', cursor: 'pointer', background: settlementBadgeBg(record), color: '#fff' }}>
                      {record.结算金额 ? Number(record.结算金额).toFixed(2) : (record.结算 === '已结算' ? '已结算' : '未结算')}
                    </span>
                  )}
                </>
              ) : <span style={{ color: '#999' }}>-</span>; })()}
              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', background: record.原因 && !['无理由', '中途拦截'].includes(record.原因) ? '#d32f2f' : '#4caf50', color: '#fff' }}>{record.原因 || '-'}</span>
              <span style={{ fontSize: '11px', color: '#1976d2', fontWeight: 'bold' }}>{expandedRows[record.ID] ? '收起' : '展开'}</span>
            </div>
          </div>
          <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#333', display: 'flex' }}><span style={{ color: '#999', flexShrink: 0 }}>客户信息：</span><span style={{ flex: 1, wordBreak: 'break-word' }}>{record.客户信息 || '-'}</span></div>
        </div>

        {expandedRows[record.ID] && (
          <div style={{ padding: '0 10px 10px', borderTop: '1px solid #eee', fontSize: '12px', lineHeight: '1.8', color: '#333' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', paddingTop: '8px' }}>
              <div style={{ gridColumn: 'span 2' }}><span style={{ color: '#999' }}>订单编号：</span>{record.订单编号 || '-'}</div>
              <div><span style={{ color: '#999' }}>品牌：</span>{record.品牌 || '-'}</div>
              <div><span style={{ color: '#999' }}>型号：</span>{record.型号 || '-'}</div>
              <div><span style={{ color: '#999' }}>状态：</span><span style={record.状态 === '已使用' ? { padding: '1px 4px', borderRadius: '2px', fontSize: '10px', background: '#ff9800', color: '#fff' } : {}}>{record.状态 || '-'}</span></div>
              <div><span style={{ color: '#999' }}>购买：</span>{record.购买件数 || '-'}</div>
              <div><span style={{ color: '#999' }}>退货：</span>{record.退货件数 || '-'}</div>
              <div><span style={{ color: '#999' }}>快递：</span>{record.快递 || '-'}</div>
              <div><span style={{ color: '#999' }}>登记人：</span>{record.登记人 || '-'}</div>
              <div><span style={{ color: '#999' }}>购买日期：</span>{fmtDate(record.购买日期) || '-'}</div>
              <div><span style={{ color: '#999' }}>类型：</span>{record.类型 || '-'}</div>
              <div><span style={{ color: '#999' }}>颜色：</span>{record.颜色 || '-'}</div>
              <div><span style={{ color: '#999' }}>规格：</span>{record.规格 || '-'}</div>
              <div><span style={{ color: '#999' }}>价格：</span>{record.价格 || '-'}</div>
              <div><span style={{ color: '#999' }}>仓库：</span>{record.仓库 || '-'}</div>
              <div><span style={{ color: '#999' }}>平台：</span>{record.平台 || '-'}</div>
              <div><span style={{ color: '#999' }}>运费：</span>{record.运费 || '-'}</div>
              <div><span style={{ color: '#999' }}>创建时间：</span>{fmtTime(record.创建时间)}</div>
              <div style={{ gridColumn: 'span 2' }}><span style={{ color: '#999' }}>备注：</span>{record.备注 || '-'}</div>
            </div>
            {attachments[record.ID] && Array.isArray(attachments[record.ID]) && attachments[record.ID].length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#666', marginBottom: '4px' }}>附件：</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {attachments[record.ID].map(att => {
                    const attType = getAttachmentType(att.mime_type);
                    const url = getImageUrl(att.file_path);
                    const isPending = att.status === 'pending';
                    const canView = !isPending || isAdmin;
                    return (
                      <div key={att.id} style={{ width: '50px', height: '50px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                        {attType === 'image' && url ? (
                          <img src={url} alt={att.original_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: canView ? 'pointer' : 'default', opacity: isPending && !isAdmin ? 0.6 : 1 }} onClick={() => { if (canView) openPreview(url, 'image'); }} onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : attType === 'video' && url ? (
                          <div onClick={() => { if (canView) openPreview(url, 'video'); }} style={{ width: '100%', height: '100%', cursor: canView ? 'pointer' : 'default', background: '#000', opacity: isPending && !isAdmin ? 0.6 : 1 }}>
                            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '16px', color: '#fff' }}>▶</div>
                          </div>
                        ) : url ? (
                          <div onClick={() => { if (canView) window.open(url, '_blank'); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '8px', color: canView ? '#666' : '#999', cursor: canView ? 'pointer' : 'default', opacity: isPending && !isAdmin ? 0.6 : 1 }} title={att.original_name || (canView ? '点击打开' : '审核中不可查看')}>
                            <span style={{ fontSize: '18px' }}>📄</span>
                          </div>
                        ) : null}
                        {isPending && !isAdmin && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,152,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff', fontSize: '8px', fontWeight: 'bold' }}>审核中</span></div>}
                        {isAdmin && <button onClick={(e) => { e.stopPropagation(); if (window.confirm('确定要删除该附件吗？')) { handleDeleteAttachment(record.ID, att.id); } }} style={{ position: 'absolute', top: '1px', right: '1px', width: '14px', height: '14px', padding: '0', fontSize: '8px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer', lineHeight: '1' }}>×</button>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
              {isAdmin ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); const hasPending = changeHistory[record.ID] && changeHistory[record.ID].some(cr => cr.status === 'pending'); if (hasPending) { alert('您有待审核的修改申请，请等待审核完成后再提交新的修改'); return; } handleEdit(record); }} style={{ flex: 1, padding: '6px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>修改</button>
                  <button onClick={(e) => { e.stopPropagation(); handleCopyRecord(record); }} style={{ flex: 1, padding: '6px', background: '#9c27b0', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>复制</button>
                  <button onClick={(e) => { e.stopPropagation(); handleShareRecord(record); }} style={{ flex: 1, padding: '6px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>分享</button>
                  <button onClick={(e) => { e.stopPropagation(); if (window.confirm('确定要删除该记录吗？')) { handleDelete(record.ID); } }} style={{ flex: 1, padding: '6px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>删除</button>
                </>
              ) : (
                <>
                  <button onClick={(e) => { e.stopPropagation(); const hasPending = changeHistory[record.ID] && changeHistory[record.ID].some(cr => cr.status === 'pending'); if (hasPending) { alert('您有待审核的修改申请，请等待审核完成后再提交新的修改'); return; } handleEdit(record); }} style={{ flex: 1, padding: '6px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>修改</button>
                  <button onClick={(e) => { e.stopPropagation(); handleCopyRecord(record); }} style={{ flex: 1, padding: '6px', background: '#9c27b0', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>复制</button>
                  <button onClick={(e) => { e.stopPropagation(); handleShareRecord(record); }} style={{ flex: 1, padding: '6px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>分享</button>
                </>
              )}
            </div>
            {(() => {
              const pendingSettlementReq = changeHistory[record.ID]?.find(cr => cr.settlement_new_status && cr.status === 'pending' && cr.settlement_image_url);
              const settlementProofUrl = record.settlement_proof_url || pendingSettlementReq?.settlement_image_url;
              return settlementProofUrl && (isAdmin || !['无理由', '中途拦截'].includes(record.原因)) ? (
                <div style={{ marginTop: '8px', padding: '8px', background: '#e8f5e9', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 600, fontSize: '12px', color: '#4caf50', marginBottom: '4px' }}>结算凭证：</div>
                  <div style={{ position: 'relative', width: '60px', height: '60px', display: 'inline-block' }}>
                    <img src={getImageUrl(settlementProofUrl)} alt="结算凭证" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #4caf50', cursor: 'pointer' }} onClick={() => { setPreviewUrl(getImageUrl(settlementProofUrl)); setPreviewType('image'); setShowPreviewModal(true); }} onError={(e) => { e.target.style.display = 'none'; }} />
                    {(() => { const u = JSON.parse(localStorage.getItem('user') || '{}'); return u?.role === 'admin' ? (
                      <span
                        onClick={(e) => { e.stopPropagation(); if (window.confirm('确定要删除结算凭证吗？（仅删除凭证图片，保留金额）')) { handleDeleteSettlementProof(record.ID); } }}
                        style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', lineHeight: '1' }}
                      >×</span>
                    ) : null; })()}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>
    ))}
    {records.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无登记记录</div>}
        </div>
      )}
      </div>
    )}
      <Pagination page={page} total={total} limit={PAGE_SIZE} onPageChange={handlePageChange} />
      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '900px', maxHeight: '90vh', overflow: 'auto', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>修改记录 - {editingRecord?.订单编号}</h4>
              <button onClick={() => { setShowEditModal(false); setEditSelectedFiles([]); setEditFilePreviews([]); }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
              <span style={{ color: '#f44336' }}>*</span> 为必填项，备注为选填
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px' }}>
              {EDIT_FIELD_ORDER.filter(f => editFormData.hasOwnProperty(f) && !HIDDEN_FIELDS.includes(f)).map(field => {
                const isImmutable = IMMUTABLE_FIELDS.includes(field);
                const isWideField = field === '客户信息' || field === '备注';
                return (
                  <div key={field} style={isWideField ? { gridColumn: isMobile ? 'span 2' : 'span 4' } : {}}>
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      color: isImmutable ? '#999' : (editErrors[field] ? '#d32f2f' : '#333')
                    }}>
                      {field === '备注' ? '备注：' : field + ' *'}
                    </label>
                    {field === '平台' ? (
                      <select style={inputStyle('平台')} value={editFormData.平台 || ''} onChange={e => handleEditFormChange('平台', e.target.value)}>
                        <option value="">请选择平台</option>
                        {options.platforms.map(p => <option key={p} value={p}>{p}</option>)}
                        {editFormData.平台 && !options.platforms.includes(editFormData.平台) && <option value={editFormData.平台}>{editFormData.平台}</option>}
                      </select>
                    ) : field === '仓库' ? (
                      <select style={inputStyle('仓库')} value={editFormData.仓库 || ''} onChange={e => handleEditFormChange('仓库', e.target.value)}>
                        <option value="">请选择仓库</option>
                        {options.warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                        {editFormData.仓库 && !options.warehouses.includes(editFormData.仓库) && <option value={editFormData.仓库}>{editFormData.仓库}</option>}
                      </select>
                    ) : field === '购买日期' ? (
                      <input style={inputStyle('购买日期')} type="date" max={new Date().toISOString().split('T')[0]} value={editFormData.购买日期 || ''} onChange={e => handleEditFormChange('购买日期', e.target.value)} readOnly={isImmutable} />
                    ) : field === '品牌' ? (
                      <select style={inputStyle('品牌')} value={editFormData.品牌 || ''} onChange={e => handleEditFormChange('品牌', e.target.value)}>
                        <option value="">请选择品牌</option>
                        {options.brands.map(b => <option key={b} value={b}>{b}</option>)}
                        {editFormData.品牌 && !options.brands.includes(editFormData.品牌) && <option value={editFormData.品牌}>{editFormData.品牌}</option>}
                      </select>
                    ) : field === '型号' ? (
                      <select style={inputStyle('型号')} value={editFormData.型号 || ''} onChange={e => handleEditFormChange('型号', e.target.value)} disabled={!editFormData.品牌}>
                        <option value="">请选择型号</option>
                        {editOptions.models.map(m => <option key={m} value={m}>{m}</option>)}
                        {editFormData.型号 && !editOptions.models.includes(editFormData.型号) && <option value={editFormData.型号}>{editFormData.型号}</option>}
                      </select>
                    ) : field === '类型' ? (
                      <select style={inputStyle('类型')} value={editFormData.类型 || ''} onChange={e => handleEditFormChange('类型', e.target.value)} disabled={!editFormData.型号}>
                        <option value="">请选择类型</option>
                        {editOptions.types.map(t => <option key={t} value={t}>{t}</option>)}
                        {editFormData.类型 && !editOptions.types.includes(editFormData.类型) && <option value={editFormData.类型}>{editFormData.类型}</option>}
                      </select>
                    ) : field === '颜色' ? (
                      <select style={inputStyle('颜色')} value={editFormData.颜色 || ''} onChange={e => handleEditFormChange('颜色', e.target.value)} disabled={!editFormData.类型}>
                        <option value="">请选择颜色</option>
                        {editOptions.colors.map(c => <option key={c} value={c}>{c}</option>)}
                        {editFormData.颜色 && !editOptions.colors.includes(editFormData.颜色) && <option value={editFormData.颜色}>{editFormData.颜色}</option>}
                      </select>
                    ) : field === '规格' ? (
                      <select style={inputStyle('规格')} value={editFormData.规格 || ''} onChange={e => handleEditFormChange('规格', e.target.value)} disabled={!editFormData.颜色}>
                        <option value="">请选择规格</option>
                        {editOptions.specs.map(s => <option key={s} value={s}>{s}</option>)}
                        {editFormData.规格 && !editOptions.specs.includes(editFormData.规格) && <option value={editFormData.规格}>{editFormData.规格}</option>}
                      </select>
                    ) : field === '原因' ? (
                      <select style={inputStyle('原因')} value={editFormData.原因 || ''} onChange={e => handleEditFormChange('原因', e.target.value)}>
                        <option value="">请选择原因</option>
                        {options.reasons.map(r => <option key={r} value={r}>{r}</option>)}
                        {editFormData.原因 && !options.reasons.includes(editFormData.原因) && <option value={editFormData.原因}>{editFormData.原因}</option>}
                      </select>
) : field === '状态' ? (
                      <select style={inputStyle('状态')} value={editFormData.状态 || ''} onChange={e => handleEditFormChange('状态', e.target.value)}>
                        <option value="">请选择状态</option>
                        {(editOptions.statuses || options.statuses).map(s => <option key={s} value={s}>{s}</option>)}
                        {editFormData.状态 && !(editOptions.statuses || options.statuses).includes(editFormData.状态) && <option value={editFormData.状态}>{editFormData.状态}</option>}
                      </select>
                    ) : field === '备注' ? (
                      <textarea style={{ width: '100%', padding: '4px 8px', border: editErrors[field] ? '2px solid #d32f2f' : '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minHeight: '60px', boxSizing: 'border-box' }} value={editFormData[field] || ''} onChange={e => handleEditFormChange(field, e.target.value)} readOnly={isImmutable} />
                    ) : field === '创建时间' ? (
                      <div style={{ padding: '4px 8px', background: '#f5f5f5', borderRadius: '4px', fontSize: '13px', color: '#999', height: '28px', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
                        {fmtTime(editFormData.创建时间)}
                      </div>
                    ) : field === '客户信息' && isMobile ? (
                      <textarea style={{ width: '100%', padding: '4px 8px', border: editErrors[field] ? '2px solid #d32f2f' : '1px solid #ddd', borderRadius: '4px', fontSize: '13px', height: 'auto', minHeight: '60px', boxSizing: 'border-box', background: isImmutable ? '#f5f5f5' : '#fff', color: isImmutable ? '#999' : '#333', resize: 'none', overflow: 'hidden' }} value={editFormData[field] || ''} onChange={e => handleEditFormChange(field, e.target.value)} readOnly={isImmutable} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} />
                    ) : (
                      <input style={{ width: '100%', padding: '4px 8px', border: editErrors[field] ? '2px solid #d32f2f' : '1px solid #ddd', borderRadius: '4px', fontSize: '13px', height: '28px', boxSizing: 'border-box', background: isImmutable ? '#f5f5f5' : '#fff', color: isImmutable ? '#999' : '#333' }} type="text" value={editFormData[field] || ''} onChange={e => handleEditFormChange(field, e.target.value)} readOnly={isImmutable} />
                    )}
                    {editErrors[field] && <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{editErrors[field]}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>附件</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {attachments[editingRecord?.ID] && attachments[editingRecord.ID].map(att => {
                  const attType = getAttachmentType(att.mime_type);
                  const url = getImageUrl(att.file_path);
                  return (
                    <div key={att.id} style={{ position: 'relative', width: '60px', height: '60px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                      {attType === 'image' && url && (
                        <img 
                          src={url} 
                          alt={att.original_name || '附件'} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => { setPreviewUrl(url); setPreviewType('image'); setShowPreviewModal(true); }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      {attType === 'video' && url && (
                        <div 
                          onClick={() => { setPreviewUrl(url); setPreviewType('video'); setShowPreviewModal(true); }}
                          style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative', background: '#000' }}
                        >
                          <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '18px', color: '#fff', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>▶</div>
                        </div>
                      )}
                      {attType === 'file' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '9px', color: '#666', padding: '2px', textAlign: 'center', wordBreak: 'break-all' }}>{att.original_name || '文件'}</div>
                      )}
                      {isAdmin && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (window.confirm('确定要删除该附件吗？')) {
                              handleDeleteAttachment(editingRecord.ID, att.id); 
                            }
                          }} 
                          style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', padding: '0', fontSize: '10px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer', lineHeight: '1' }}
                        >×</button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {editFilePreviews.map((preview, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '60px', height: '60px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                    {preview.preview ? (
                      preview.type?.startsWith('image/') ? (
                        <img src={preview.preview} alt={preview.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : preview.type?.startsWith('video/') ? (
                        <video src={preview.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '8px', color: '#666', padding: '2px', textAlign: 'center', wordBreak: 'break-all' }}>{preview.name}</div>
                      )
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '8px', color: '#666', padding: '2px', textAlign: 'center', wordBreak: 'break-all' }}>{preview.name}</div>
                    )}
                    <button 
                      onClick={() => {
                        const newFiles = editSelectedFiles.filter((_, i) => i !== idx);
                        const newPreviews = editFilePreviews.filter((_, i) => i !== idx);
                        setEditSelectedFiles(newFiles);
                        setEditFilePreviews(newPreviews);
                      }}
                      style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', padding: '0', fontSize: '10px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer', lineHeight: '1' }}
                    >×</button>
                  </div>
                ))}
                <label style={{ width: '60px', height: '60px', border: '2px dashed #4caf50', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '32px', color: '#4caf50', background: '#f9f9f9' }}>
                  +
                  <input type="file" multiple onChange={handleEditFileChange} style={{ display: 'none' }} accept="image/*,video/*" />
                </label>
                <input
                  type="text"
                  placeholder="📋 右键粘贴"
                  onPaste={(e) => {
                    handleContainerPaste(e, (f) => { setEditSelectedFiles(prev => [...prev, f]); setEditFilePreviews(prev => [...prev, { file: f, preview: URL.createObjectURL(f), name: f.name, type: f.type }]); });
                  }}
                  
                  style={{ width: '85px', height: '28px', fontSize: '11px', border: '1px dashed #1976d2', borderRadius: '4px', padding: '0 4px', outline: 'none', cursor: 'default', background: '#f0f7ff', color: '#1976d2', boxSizing: 'border-box', alignSelf: 'center' }}
                />
              </div>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => { setShowEditModal(false); setEditSelectedFiles([]); setEditFilePreviews([]); }} style={{ padding: '8px 20px', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
                取消
              </button>
              <button onClick={handleEditSubmit} style={{ padding: '8px 20px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
                提交修改申请
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
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); closePreview(); }}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '30px',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ×
            </button>
            {previewType === 'image' && (
              <img 
                src={previewUrl} 
                alt="预览" 
                style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '4px' }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {previewType === 'video' && (
              <video 
                src={previewUrl} 
                controls 
                autoPlay 
                style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '4px' }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>
      )}
      {showShippingModal && settlementRecord && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => { setShowShippingModal(false); setSettlementImage(null); setSettlementImagePreview(null); }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', maxWidth: '360px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>结算录入</h3>
              <button onClick={() => setShowShippingModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#333' }}>
                订单编号: <strong>{settlementRecord?.订单编号}</strong>
              </p>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#333' }}>
                运费金额: <span style={{ color: '#f44336' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="请输入金额"
                value={shippingAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d+(\.\d{0,2})?$/.test(val)) {
                    setShippingAmount(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleShippingAmountSubmit();
                  if (e.key === 'Escape') setShowShippingModal(false);
                }}
                style={{ width: '100%', padding: '8px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', outline: 'none' }}
                autoFocus
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#999' }}>只能输入数字，保留两位小数</p>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#999', lineHeight: '1.6' }}>
              这里只录金额。提交后该行会变红，并累计到搜索栏左侧；等多笔录完，在左侧统一上传一张凭证点「确认」分发即可。
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowShippingModal(false); setSettlementImage(null); setSettlementImagePreview(null); }} style={{ padding: '8px 16px', border: '1px solid #ddd', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>取消</button>
              <button onClick={handleShippingAmountSubmit} style={{ padding: '8px 16px', border: 'none', background: '#4caf50', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>提交</button>
            </div>
          </div>
        </div>
      )}

      {showProofModal && settlementRecord && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowProofModal(false)}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', maxWidth: '420px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>结算详情</h3>
              <button onClick={() => setShowProofModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#333' }}>
                订单编号: <strong>{settlementRecord?.订单编号}</strong>
              </p>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#333' }}>
                运费金额: <strong style={{ color: '#4caf50' }}>{Number(settlementRecord?.结算金额).toFixed(2)}</strong>
              </p>
            </div>
            {proofImageUrl && (
              <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <img src={getImageUrl(proofImageUrl)} alt="结算凭证" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px', border: '1px solid #ddd' }} onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            )}
            {!proofImageUrl && (
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 6px 0', color: '#f44336', fontSize: '13px' }}>
                  该单金额已录入，等待上传结算凭证
                </p>
                <p style={{ margin: 0, color: '#999', fontSize: '12px', lineHeight: '1.6' }}>
                  在搜索栏左侧统一上传凭证后点「确认」，即可批量分发
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {(() => { const u = JSON.parse(localStorage.getItem('user') || '{}'); return u?.role === 'admin' ? (
                <>
                  <button onClick={() => { if (window.confirm('确定要清除结算，改为未结算吗？')) { handleAdminClearSettlement(settlementRecord.ID); } }} style={{ padding: '4px 10px', border: 'none', background: '#f44336', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>清除结算</button>
                  <button onClick={() => { if (window.confirm('确定要删除结算凭证吗？（仅删除凭证图片，保留金额）')) { handleDeleteSettlementProof(settlementRecord.ID); } }} style={{ padding: '4px 10px', border: 'none', background: '#ff9800', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>删除凭证</button>
                </>
              ) : null; })()}
            </div>
          </div>
        </div>
      )}
      {showShareModal && shareModalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#4caf50' }}>分享记录</h3>
            <div style={{ fontSize: '14px', lineHeight: '1.8', marginBottom: '20px' }}>
              <div><strong>客户信息：</strong>{shareModalData.客户信息 || '-'}</div>
              <div><strong>购买日期：</strong>{shareModalData.购买日期 || '-'}</div>
              <div><strong>品牌：</strong>{shareModalData.品牌 || '-'}</div>
              <div><strong>型号：</strong>{shareModalData.型号 || '-'}</div>
              <div><strong>类型：</strong>{shareModalData.类型 || '-'}</div>
              <div><strong>颜色：</strong>{shareModalData.颜色 || '-'}</div>
              <div><strong>规格：</strong>{shareModalData.规格 || '-'}</div>
              <div><strong>原因：</strong>{shareModalData.原因 || '-'}</div>
              <div><strong>状态：</strong>{shareModalData.状态 || '-'}</div>
              <div><strong>快递：</strong>{shareModalData.快递 || '-'}</div>
              <div><strong>单号：</strong>{shareModalData.单号 || '-'}</div>
              <div><strong>仓库：</strong>{shareModalData.仓库 || '-'}</div>
              <div><strong>平台：</strong>{shareModalData.平台 || '-'}</div>
              <div><strong>运费：</strong>{shareModalData.运费 || '-'}</div>
              <div><strong>购买件数：</strong>{shareModalData.购买件数 || '-'}</div>
              <div><strong>退货件数：</strong>{shareModalData.退货件数 || '-'}</div>
              <div><strong>备注：</strong>{shareModalData.备注 || '-'}</div>
              <div><strong>链接：</strong><a href={shareModalUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'none', wordBreak: 'break-all' }}>{shareModalUrl}</a></div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  const text = `客户信息：${shareModalData.客户信息 || '-'}
购买日期：${shareModalData.购买日期 || '-'}
品牌：${shareModalData.品牌 || '-'}
型号：${shareModalData.型号 || '-'}
类型：${shareModalData.类型 || '-'}
颜色：${shareModalData.颜色 || '-'}
规格：${shareModalData.规格 || '-'}
原因：${shareModalData.原因 || '-'}
状态：${shareModalData.状态 || '-'}
快递：${shareModalData.快递 || '-'}
单号：${shareModalData.单号 || '-'}
仓库：${shareModalData.仓库 || '-'}
平台：${shareModalData.平台 || '-'}
运费：${shareModalData.运费 || '-'}
购买件数：${shareModalData.购买件数 || '-'}
退货件数：${shareModalData.退货件数 || '-'}
备注：${shareModalData.备注 || '-'}
链接：${shareModalUrl}`;
                  copyToClipboard(text).then(() => {
                    alert('已复制到剪贴板');
                  }).catch(() => {
                    alert('复制失败，请手动复制');
                  });
                }}
                style={{ padding: '8px 20px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
              >
                复制信息
              </button>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setShareModalData(null);
                  setShareModalUrl('');
                }}
                style={{ padding: '8px 20px', background: '#757575', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      </div>
    </React.Fragment>
  );
}

export default ReturnRegistration;
