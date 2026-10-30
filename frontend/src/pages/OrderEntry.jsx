import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import Pagination from '../components/Pagination';
import { fmtTime, fmtDate } from '../utils/time';
import { copyToClipboard } from '../utils/clipboard';
const PAGE_SIZE = 20;

// 一键录单草稿：手机浏览器切到其他 APP 时，后台标签页可能被系统回收，
// 切回来浏览器会重新加载页面、React 状态全丢。这里把已填内容落盘，回来自动恢复。
const ORDER_DRAFT_KEY = 'orderEntryDraft';
const ORDER_DRAFT_TTL = 24 * 60 * 60 * 1000; // 超过 24 小时的草稿自动丢弃

const emptyOrderForm = () => ({
  客户信息: '', 平台: '', 订单编号: '', 品牌: '', 型号: '',
  类型: '', 颜色: '', 规格: '', 价格: '', 购买件数: '', 备注: ''
});

// 数字时间戳专用（utils 里的 fmtTime 只处理字符串）
const fmtStamp = (ts) => {
  try {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  } catch {
    return '';
  }
};

const currentUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.id || '';
  } catch {
    return '';
  }
};

function OrderEntry({ isMobile = false }) {
  const [showModal, setShowModal] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(emptyOrderForm);
  const [options, setOptions] = useState({
    brands: [],
    models: [],
    types: [],
    colors: [],
    specs: [],
    platforms: []
  });
  const [unitPrice, setUnitPrice] = useState(0);
  
  // 操作模态框状态
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionRecord, setActionRecord] = useState(null);
  
  // 编辑模态框状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editUnitPrice, setEditUnitPrice] = useState(0);
  const [editOptions, setEditOptions] = useState({
    brands: [],
    models: [],
    types: [],
    colors: [],
    specs: [],
    platforms: []
  });
  
  // 成功提示模态框状态
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successRecord, setSuccessRecord] = useState(null);
  
  // 重复检查状态
  const [duplicateError, setDuplicateError] = useState('');
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const duplicateTimerRef = useRef(null);

  // 草稿相关：draftMeta 有值表示本次是「恢复出来的」，用于顶部提示
  const [draftMeta, setDraftMeta] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 顺序很重要：先把品牌等基础选项取回来，再恢复草稿里的级联选项，
    // 否则 fetchOptions 的 setOptions 会把恢复的 models/types/colors/specs 覆盖成空。
    (async () => {
      try {
        await fetchOptions();
      } catch (e) {
        console.error('加载选项失败:', e);
      }
      if (!cancelled) await tryRestoreDraft();
    })();
    fetchRecords();

    // 清理定时器
    return () => {
      cancelled = true;
      if (duplicateTimerRef.current) {
        clearTimeout(duplicateTimerRef.current);
      }
    };
  }, []);

  // 草稿自动保存：输入变化 300ms 后落盘（同时记录窗口是否开着）
  useEffect(() => {
    if (!draftReady) return;
    const timer = setTimeout(() => {
      const hasContent = Object.values(formData).some(v => String(v ?? '').trim() !== '');
      if (!hasContent) {
        localStorage.removeItem(ORDER_DRAFT_KEY);
        setHasDraft(false);
        return;
      }
      try {
        localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify({
          formData,
          unitPrice,
          modalOpen: showModal,
          savedAt: Date.now(),
          userId: currentUserId()
        }));
        setHasDraft(true);
      } catch (e) {
        // 隐私模式或存储已满时忽略，不影响正常录入
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [formData, unitPrice, showModal, draftReady]);

  const fetchOptions = async () => {
    try {
      const [productRes, optionsRes] = await Promise.all([
        api.get('/product-data/options'),
        api.get('/options/all')
      ]);
      setOptions({
        brands: productRes.data.brands || [],
        models: [],
        types: [],
        colors: [],
        specs: [],
        platforms: optionsRes.data.platforms || []
      });
    } catch (error) {
      console.error('获取选项失败:', error);
    }
  };

  const fetchRecords = async (p) => {
    const currentPage = p || page;
    try {
      const res = await api.get(`/orders?page=${currentPage}&limit=${PAGE_SIZE}`);
      setRecords(res.data.orders || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      console.error('获取订单列表失败:', error);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchRecords(newPage);
  };

  // 恢复草稿的级联下拉选项：品牌→型号→类型→颜色→规格 逐级补回来，
  // 否则表单值在、下拉是空的，用户一改就丢值。
  const restoreCascadeOptions = async (d) => {
    try {
      if (!d.品牌) return;
      const modelsRes = await api.get(`/product-data/models?brand=${encodeURIComponent(d.品牌)}`);
      setOptions(prev => ({ ...prev, models: modelsRes.data?.models || [] }));
      if (!d.型号) return;

      const typesRes = await api.get(`/product-data/types?brand=${encodeURIComponent(d.品牌)}&model=${encodeURIComponent(d.型号)}`);
      setOptions(prev => ({ ...prev, types: typesRes.data?.types || [] }));
      if (!d.类型) return;

      const colorsRes = await api.get(`/product-data/colors?brand=${encodeURIComponent(d.品牌)}&model=${encodeURIComponent(d.型号)}&type=${encodeURIComponent(d.类型)}`);
      setOptions(prev => ({ ...prev, colors: colorsRes.data?.colors || [] }));
      if (!d.颜色) return;

      const specsRes = await api.get(`/product-data/specs?brand=${encodeURIComponent(d.品牌)}&model=${encodeURIComponent(d.型号)}&type=${encodeURIComponent(d.类型)}&color=${encodeURIComponent(d.颜色)}`);
      setOptions(prev => ({ ...prev, specs: specsRes.data?.specs || [] }));
    } catch (e) {
      console.error('恢复草稿选项失败:', e);
    }
  };

  // 页面加载时尝试恢复上次未提交的录单内容
  const tryRestoreDraft = async () => {
    try {
      const raw = localStorage.getItem(ORDER_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || !draft.formData) return;

      // 换账号登录时不恢复别人的草稿
      const uid = currentUserId();
      if (draft.userId && uid && String(draft.userId) !== String(uid)) {
        localStorage.removeItem(ORDER_DRAFT_KEY);
        return;
      }
      // 太旧的草稿直接丢弃
      if (!draft.savedAt || Date.now() - draft.savedAt > ORDER_DRAFT_TTL) {
        localStorage.removeItem(ORDER_DRAFT_KEY);
        return;
      }

      const data = { ...emptyOrderForm(), ...draft.formData };
      const hasContent = Object.values(data).some(v => String(v ?? '').trim() !== '');
      if (!hasContent) {
        localStorage.removeItem(ORDER_DRAFT_KEY);
        return;
      }

      setFormData(data);
      setUnitPrice(Number(draft.unitPrice) || 0);
      setDraftMeta({ savedAt: draft.savedAt });
      setHasDraft(true);
      // 只有刷新前窗口是开着的才自动弹回来；用户自己点过取消的，只在页面上留个入口
      if (draft.modalOpen) setShowModal(true);

      await restoreCascadeOptions(data);
    } catch (e) {
      console.error('恢复录单草稿失败:', e);
    } finally {
      setDraftReady(true);
    }
  };

  const clearOrderDraft = () => {
    try {
      localStorage.removeItem(ORDER_DRAFT_KEY);
    } catch (e) { /* 忽略 */ }
    setHasDraft(false);
    setDraftMeta(null);
  };

  const handleResumeDraft = () => {
    setShowModal(true);
  };

  const handleDiscardDraft = () => {
    if (!window.confirm('确定放弃未提交的录单内容吗？放弃后不可恢复。')) return;
    clearOrderDraft();
    setFormData(emptyOrderForm());
    setUnitPrice(0);
    setOptions(prev => ({ ...prev, models: [], types: [], colors: [], specs: [] }));
  };

  const handleOpenModal = () => {
    setShowModal(true);
    setUnitPrice(0);
    setDraftMeta(null);
    setFormData(emptyOrderForm());
    setOptions(prev => ({
      ...prev,
      models: [],
      types: [],
      colors: [],
      specs: []
    }));
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setDuplicateError('');
  };

  // 实时查重检查（防抖）
  const checkDuplicate = async (平台, 订单编号) => {
    if (!平台 || !订单编号) {
      setDuplicateError('');
      return;
    }

    setCheckingDuplicate(true);
    try {
      const res = await api.get(`/orders/check-duplicate?平台=${encodeURIComponent(平台)}&订单编号=${encodeURIComponent(订单编号)}`);
      if (res.data.exists) {
        setDuplicateError(res.data.message);
      } else {
        setDuplicateError('');
      }
    } catch (error) {
      console.error('查重失败:', error);
      setDuplicateError('');
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleFormChange = async (field, value) => {
    let newData = { ...formData, [field]: value };

    // 清空下游字段
    if (field === '品牌') {
      newData = { ...newData, 型号: '', 类型: '', 颜色: '', 规格: '', 价格: '' };
      setOptions(prev => ({ ...prev, models: [], types: [], colors: [], specs: [] }));
    } else if (field === '型号') {
      newData = { ...newData, 类型: '', 颜色: '', 规格: '', 价格: '' };
      setOptions(prev => ({ ...prev, types: [], colors: [], specs: [] }));
    } else if (field === '类型') {
      newData = { ...newData, 颜色: '', 规格: '', 价格: '' };
      setOptions(prev => ({ ...prev, colors: [], specs: [] }));
    } else if (field === '颜色') {
      newData = { ...newData, 规格: '', 价格: '' };
      setOptions(prev => ({ ...prev, specs: [] }));
    } else if (field === '规格') {
      newData = { ...newData, 价格: '' };
    }

    // 购买件数变化时重新计算价格
    if (field === '购买件数' && value && unitPrice) {
      const qty = parseInt(value) || 0;
      newData.价格 = (qty * unitPrice).toString();
    }

    setFormData(newData);

    // 实时查重：当平台或订单编号变化时触发（添加防抖）
    if (field === '平台' || field === '订单编号') {
      const checkPlatform = field === '平台' ? value : newData.平台;
      const checkOrderNo = field === '订单编号' ? value : newData.订单编号;
      
      // 清除之前的定时器
      if (duplicateTimerRef.current) {
        clearTimeout(duplicateTimerRef.current);
      }
      
      // 设置新的定时器，500ms 后执行查重
      duplicateTimerRef.current = setTimeout(() => {
        checkDuplicate(checkPlatform, checkOrderNo);
      }, 500);
    }

    // 联动获取下一级选项
    try {
      let url = '';
      if (field === '品牌' && value) {
        url = `/product-data/models?brand=${encodeURIComponent(value)}`;
      } else if (field === '型号' && value && formData.品牌) {
        url = `/product-data/types?brand=${encodeURIComponent(formData.品牌)}&model=${encodeURIComponent(value)}`;
      } else if (field === '类型' && value && formData.品牌 && formData.型号) {
        url = `/product-data/colors?brand=${encodeURIComponent(formData.品牌)}&model=${encodeURIComponent(formData.型号)}&type=${encodeURIComponent(value)}`;
      } else if (field === '颜色' && value && formData.品牌 && formData.型号 && formData.类型) {
        url = `/product-data/specs?brand=${encodeURIComponent(formData.品牌)}&model=${encodeURIComponent(formData.型号)}&type=${encodeURIComponent(formData.类型)}&color=${encodeURIComponent(value)}`;
      } else if (field === '规格' && value && formData.品牌 && formData.型号 && formData.类型 && formData.颜色) {
        url = `/product-data/price?brand=${encodeURIComponent(formData.品牌)}&model=${encodeURIComponent(formData.型号)}&type=${encodeURIComponent(formData.类型)}&color=${encodeURIComponent(formData.颜色)}&spec=${encodeURIComponent(value)}`;
      }

      if (url) {
        const res = await api.get(url);
        const data = res.data;

        if (field === '品牌') {
          setOptions(prev => ({ ...prev, models: data.models || [] }));
        } else if (field === '型号') {
          setOptions(prev => ({ ...prev, types: data.types || [] }));
        } else if (field === '类型') {
          setOptions(prev => ({ ...prev, colors: data.colors || [] }));
        } else if (field === '颜色') {
          setOptions(prev => ({ ...prev, specs: data.specs || [] }));
        } else if (field === '规格') {
          const unitP = parseFloat(data?.price) || 0;
          setUnitPrice(unitP);
          const qty = parseInt(formData.购买件数) || 0;
          if (unitP && qty) {
            setFormData(prev => ({ ...prev, 价格: (unitP * qty).toString() }));
          } else if (unitP) {
            setFormData(prev => ({ ...prev, 价格: unitP.toString() }));
          }
        }
      }
    } catch (error) {
      console.error('联动获取选项失败:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // 除备注外所有字段都是必填
    if (!formData.客户信息 || !formData.平台 || !formData.订单编号 || !formData.品牌 || !formData.型号 || !formData.类型 || !formData.颜色 || !formData.规格 || !formData.价格 || !formData.购买件数) {
      alert('除备注外所有字段均为必填项');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/orders', formData);
      setShowModal(false);
      setPage(1);
      fetchRecords(1);
      
      // 显示成功模态框
      setSuccessRecord({
        ...formData,
        id: response.data.id
      });
      setShowSuccessModal(true);

      // 提交成功：清掉草稿并复位表单，避免下次打开又带出旧内容
      clearOrderDraft();
      setFormData(emptyOrderForm());
      setUnitPrice(0);
      setOptions(prev => ({ ...prev, models: [], types: [], colors: [], specs: [] }));
    } catch (error) {
      console.error('订单录入失败:', error);
      alert('订单录入失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 打开操作模态框
  const handleOpenActionModal = (record) => {
    setActionRecord(record);
    setShowActionModal(true);
  };

  const handleCloseActionModal = () => {
    setShowActionModal(false);
    setActionRecord(null);
  };

  // 删除记录
  const handleDelete = async () => {
    if (!actionRecord) return;
    if (!confirm('确定要删除这条记录吗？')) return;
    
    try {
      await api.delete(`/orders/${actionRecord.id}`);
      alert('删除成功');
      setShowActionModal(false);
      setActionRecord(null);
      setPage(1);
      fetchRecords(1);
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败: ' + (error.response?.data?.error || error.message));
    }
  };

  // 复制记录（复制到剪贴板）
  const handleCopy = async () => {
    if (!actionRecord) return;
    const text = `客户信息：${actionRecord.客户信息}
品牌：${actionRecord.品牌}
型号：${actionRecord.型号}
类型：${actionRecord.类型}
颜色：${actionRecord.颜色}
规格：${actionRecord.规格}
价格：${actionRecord.价格}
购买件数：${actionRecord.购买件数}
${actionRecord.备注 ? `备注：${actionRecord.备注}\n` : ''}
平台：${actionRecord.平台}
订单编号：${actionRecord.订单编号}`;
    
    try {
      await copyToClipboard(text);
      alert('已复制到剪贴板');
    } catch (err) {
      console.error('复制失败:', err);
      alert('复制失败，请手动复制');
    }
  };

  // 复制时加载联动选项
  const loadOptionsForCopy = async (record) => {
    try {
      const opts = { ...options };
      
      if (record.品牌) {
        const res = await api.get(`/product-data/models?brand=${encodeURIComponent(record.品牌)}`);
        opts.models = res.data.models || [];
      }
      if (record.品牌 && record.型号) {
        const res = await api.get(`/product-data/types?brand=${encodeURIComponent(record.品牌)}&model=${encodeURIComponent(record.型号)}`);
        opts.types = res.data.types || [];
      }
      if (record.品牌 && record.型号 && record.类型) {
        const res = await api.get(`/product-data/colors?brand=${encodeURIComponent(record.品牌)}&model=${encodeURIComponent(record.型号)}&type=${encodeURIComponent(record.类型)}`);
        opts.colors = res.data.colors || [];
      }
      if (record.品牌 && record.型号 && record.类型 && record.颜色) {
        const res = await api.get(`/product-data/specs?brand=${encodeURIComponent(record.品牌)}&model=${encodeURIComponent(record.型号)}&type=${encodeURIComponent(record.类型)}&color=${encodeURIComponent(record.颜色)}`);
        opts.specs = res.data.specs || [];
      }
      
      setOptions(opts);
    } catch (error) {
      console.error('加载联动选项失败:', error);
    }
  };

  // 编辑记录
  const handleEdit = async () => {
    if (!actionRecord) return;
    
    // 先关闭操作模态框
    setShowActionModal(false);
    
    // 设置表单数据
    // 品牌名大小写规范化：匹配 options.brands 中已有的品牌名（忽略大小写）
    const recordBrand = actionRecord.品牌 || '';
    const brandOptions = (options.brands || []);
    const matchedBrandStr = brandOptions.find(b => b.toLowerCase() === recordBrand.toLowerCase()) || recordBrand;

    setEditFormData({
      id: actionRecord.id,
      客户信息: actionRecord.客户信息 || '',
      平台: actionRecord.平台 || '',
      订单编号: actionRecord.订单编号 || '',
      品牌: matchedBrandStr,
      型号: actionRecord.型号 || '',
      类型: actionRecord.类型 || '',
      颜色: actionRecord.颜色 || '',
      规格: actionRecord.规格 || '',
      价格: actionRecord.价格 || '',
      购买件数: actionRecord.购买件数 || '',
      备注: actionRecord.备注 || ''
    });
    setEditUnitPrice(parseFloat(actionRecord.价格) || 0);
    setEditOptions({
      brands: options.brands || [],
      platforms: options.platforms || []
    });
    
    // 先加载联动选项，再打开编辑窗口（这样下拉框才能显示原始数据）
    await loadOptionsForEdit(actionRecord);
    
    setActionRecord(null);
    setShowEditModal(true);
  };

  // 编辑时加载联动选项
  const loadOptionsForEdit = async (record) => {
    try {
      const opts = { brands: options.brands || [], platforms: options.platforms || [] };
      
      if (record.品牌) {
        const res = await api.get(`/product-data/models?brand=${encodeURIComponent(record.品牌)}`);
        opts.models = res.data.models || [];
      }
      if (record.品牌 && record.型号) {
        const res = await api.get(`/product-data/types?brand=${encodeURIComponent(record.品牌)}&model=${encodeURIComponent(record.型号)}`);
        opts.types = res.data.types || [];
      }
      if (record.品牌 && record.型号 && record.类型) {
        const res = await api.get(`/product-data/colors?brand=${encodeURIComponent(record.品牌)}&model=${encodeURIComponent(record.型号)}&type=${encodeURIComponent(record.类型)}`);
        opts.colors = res.data.colors || [];
      }
      if (record.品牌 && record.型号 && record.类型 && record.颜色) {
        const res = await api.get(`/product-data/specs?brand=${encodeURIComponent(record.品牌)}&model=${encodeURIComponent(record.型号)}&type=${encodeURIComponent(record.类型)}&color=${encodeURIComponent(record.颜色)}`);
        opts.specs = res.data.specs || [];
      }
      
      setEditOptions(opts);
    } catch (error) {
      console.error('加载联动选项失败:', error);
    }
  };

  // 编辑表单变化
  const handleEditFormChange = async (field, value) => {
    let newData = { ...editFormData, [field]: value };

    // 清空下游字段
    if (field === '品牌') {
      newData = { ...newData, 型号: '', 类型: '', 颜色: '', 规格: '', 价格: '' };
      setEditOptions(prev => ({ ...prev, models: [], types: [], colors: [], specs: [] }));
    } else if (field === '型号') {
      newData = { ...newData, 类型: '', 颜色: '', 规格: '', 价格: '' };
      setEditOptions(prev => ({ ...prev, types: [], colors: [], specs: [] }));
    } else if (field === '类型') {
      newData = { ...newData, 颜色: '', 规格: '', 价格: '' };
      setEditOptions(prev => ({ ...prev, colors: [], specs: [] }));
    } else if (field === '颜色') {
      newData = { ...newData, 规格: '', 价格: '' };
      setEditOptions(prev => ({ ...prev, specs: [] }));
    } else if (field === '规格') {
      newData = { ...newData, 价格: '' };
    }

    // 购买件数变化时重新计算价格
    if (field === '购买件数' && value && editUnitPrice) {
      const qty = parseInt(value) || 0;
      newData.价格 = (qty * editUnitPrice).toString();
    }

    setEditFormData(newData);

    // 联动获取下一级选项
    try {
      let url = '';
      if (field === '品牌' && value) {
        url = `/product-data/models?brand=${encodeURIComponent(value)}`;
      } else if (field === '型号' && value && editFormData.品牌) {
        url = `/product-data/types?brand=${encodeURIComponent(editFormData.品牌)}&model=${encodeURIComponent(value)}`;
      } else if (field === '类型' && value && editFormData.品牌 && editFormData.型号) {
        url = `/product-data/colors?brand=${encodeURIComponent(editFormData.品牌)}&model=${encodeURIComponent(editFormData.型号)}&type=${encodeURIComponent(value)}`;
      } else if (field === '颜色' && value && editFormData.品牌 && editFormData.型号 && editFormData.类型) {
        url = `/product-data/specs?brand=${encodeURIComponent(editFormData.品牌)}&model=${encodeURIComponent(editFormData.型号)}&type=${encodeURIComponent(editFormData.类型)}&color=${encodeURIComponent(value)}`;
      } else if (field === '规格' && value && editFormData.品牌 && editFormData.型号 && editFormData.类型 && editFormData.颜色) {
        url = `/product-data/price?brand=${encodeURIComponent(editFormData.品牌)}&model=${encodeURIComponent(editFormData.型号)}&type=${encodeURIComponent(editFormData.类型)}&color=${encodeURIComponent(editFormData.颜色)}&spec=${encodeURIComponent(value)}`;
      }

      if (url) {
        const res = await api.get(url);
        const data = res.data;

        if (field === '品牌') {
          setEditOptions(prev => ({ ...prev, models: data.models || [] }));
        } else if (field === '型号') {
          setEditOptions(prev => ({ ...prev, types: data.types || [] }));
        } else if (field === '类型') {
          setEditOptions(prev => ({ ...prev, colors: data.colors || [] }));
        } else if (field === '颜色') {
          setEditOptions(prev => ({ ...prev, specs: data.specs || [] }));
        } else if (field === '规格') {
          const unitP = parseFloat(data?.price) || 0;
          setEditUnitPrice(unitP);
          const qty = parseInt(editFormData.购买件数) || 0;
          if (unitP && qty) {
            setEditFormData(prev => ({ ...prev, 价格: (unitP * qty).toString() }));
          } else if (unitP) {
            setEditFormData(prev => ({ ...prev, 价格: unitP.toString() }));
          }
        }
      }
    } catch (error) {
      console.error('联动获取选项失败:', error);
    }
  };

  // 提交编辑
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    // 除备注外所有字段都是必填
    if (!editFormData.客户信息 || !editFormData.平台 || !editFormData.订单编号 || !editFormData.品牌 || !editFormData.型号 || !editFormData.类型 || !editFormData.颜色 || !editFormData.规格 || !editFormData.价格 || !editFormData.购买件数) {
      alert('除备注外所有字段均为必填项');
      return;
    }

    setLoading(true);
    try {
      await api.put(`/orders/${editFormData.id}`, {
        客户信息: editFormData.客户信息,
        平台: editFormData.平台,
        订单编号: editFormData.订单编号,
        品牌: editFormData.品牌,
        型号: editFormData.型号,
        类型: editFormData.类型,
        颜色: editFormData.颜色,
        规格: editFormData.规格,
        价格: editFormData.价格,
        购买件数: editFormData.购买件数,
        备注: editFormData.备注
      });
      alert('更新成功');
      setShowEditModal(false);
      setPage(1);
      fetchRecords(1);
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '4px',
    fontWeight: 'bold',
    fontSize: '13px',
    color: '#333'
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

  const selectStyle = (disabled) => ({
    ...inputStyle,
    background: disabled ? '#f5f5f5' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer'
  });

  return (
    <div style={{ padding: isMobile ? '8px' : '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '12px' : '16px' }}>
        <h3 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: '600' }}>订单录入</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasDraft && !showModal && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff8e1', border: '1px solid #ffb300', borderRadius: '4px', padding: '3px 6px' }}>
              <span onClick={handleResumeDraft} style={{ fontSize: '12px', color: '#e65100', cursor: 'pointer', whiteSpace: 'nowrap' }}>继续填写草稿</span>
              <span onClick={handleDiscardDraft} title="放弃草稿" style={{ fontSize: '14px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</span>
            </div>
          )}
          <button
            onClick={handleOpenModal}
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
            一键录单
          </button>
        </div>
      </div>

      {/* 订单记录列表 */}
      {!isMobile && (
      <div style={{ background: '#fff', borderRadius: '8px', overflowX: 'auto' }}>
        <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>客户信息</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>平台</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>订单编号</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>品牌</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>型号</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>类型</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>颜色</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>规格</th>
              <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>价格</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', whiteSpace: 'nowrap' }}>购买件数</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>创建时间</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', whiteSpace: 'nowrap' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                  暂无订单记录
                </td>
              </tr>
            ) : (
              records.map((record, index) => (
                <tr key={record.id || index} style={{ borderBottom: '1px solid #eee' }}>
                  <td data-label="客户信息" style={{ padding: '10px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={record.客户信息}>{record.客户信息}</td>
                  <td data-label="平台" style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{record.平台 || '-'}</td>
                  <td data-label="订单编号" style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{record.订单编号}</td>
                  <td data-label="品牌" style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{record.品牌 || '-'}</td>
                  <td data-label="型号" style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{record.型号 || '-'}</td>
                  <td data-label="类型" style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{record.类型 || '-'}</td>
                  <td data-label="颜色" style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{record.颜色 || '-'}</td>
                  <td data-label="规格" style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{record.规格 || '-'}</td>
                  <td data-label="价格" style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {record.价格 ? `¥${parseFloat(record.价格).toFixed(2)}` : '-'}
                  </td>
                  <td data-label="购买件数" style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{record.购买件数 || '-'}</td>
                  <td data-label="创建时间" style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                    {fmtTime(record.创建时间)}
                  </td>
                  <td data-label="操作" style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => handleOpenActionModal(record)}
                      style={{
                        padding: '4px 12px',
                        background: '#ff9800',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      操作
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无订单记录</div>
          ) : (
            records.map((record, index) => (
              <div key={record.id || index} style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee', padding: '12px' }}>
                <div style={{ fontSize: '12px', lineHeight: '1.8', color: '#333' }}>
                  <div><span style={{ color: '#999' }}>客户信息：</span>{record.客户信息}</div>
                  <div><span style={{ color: '#999' }}>订单编号：</span>{record.订单编号}</div>
                  <div><span style={{ color: '#999' }}>品牌：</span>{record.品牌 || '-'}</div>
                  <div><span style={{ color: '#999' }}>型号：</span>{record.型号 || '-'}</div>
                  <div><span style={{ color: '#999' }}>类型：</span>{record.类型 || '-'}</div>
                  <div><span style={{ color: '#999' }}>颜色：</span>{record.颜色 || '-'}</div>
                  <div><span style={{ color: '#999' }}>规格：</span>{record.规格 || '-'}</div>
                  <div><span style={{ color: '#999' }}>价格：</span>{record.价格 ? `¥${parseFloat(record.价格).toFixed(2)}` : '-'}</div>
                  <div><span style={{ color: '#999' }}>购买件数：</span>{record.购买件数 || '-'}</div>
                  <div><span style={{ color: '#999' }}>创建时间：</span>{fmtTime(record.创建时间)}</div>
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee', display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleOpenActionModal(record)} style={{ flex: 1, padding: '6px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>操作</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Pagination page={page} total={total} limit={PAGE_SIZE} onPageChange={handlePageChange} />

      {/* 录入订单模态框 */}
      {showModal && (
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
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '900px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>录入订单</h3>

            {draftMeta && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', marginBottom: '12px', background: '#e8f5e9', border: '1px solid #81c784', borderRadius: '6px', fontSize: '13px', color: '#2e7d32', lineHeight: '1.5' }}>
                <span>✅ 已恢复上次未提交的内容（{fmtStamp(draftMeta.savedAt)}）。核对无误后直接提交即可，提交后草稿自动清除。</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ gridColumn: isMobile ? 'span 2' : 'span 2' }}>
                  <label style={labelStyle}>客户信息 *</label>
                  {isMobile ? (
                    <textarea
                      value={formData.客户信息}
                      onChange={(e) => handleFormChange('客户信息', e.target.value)}
                      style={{...inputStyle, resize: 'none', minHeight: '60px', height: 'auto', overflow: 'hidden'}}
                      placeholder="请输入客户信息"
                      onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData.客户信息}
                      onChange={(e) => handleFormChange('客户信息', e.target.value)}
                      style={inputStyle}
                      placeholder="请输入客户信息"
                    />
                  )}
                </div>

                <div>
                  <label style={labelStyle}>平台 *</label>
                  <select value={formData.平台} onChange={(e) => handleFormChange('平台', e.target.value)} style={selectStyle(false)}>
                    <option value="">请选择平台</option>
                    {options.platforms.map(platform => (
                      <option key={platform} value={platform}>{platform}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>订单编号 *</label>
                  <input
                    type="text"
                    value={formData.订单编号}
                    onChange={(e) => handleFormChange('订单编号', e.target.value)}
                    style={{...inputStyle, borderColor: duplicateError ? '#d32f2f' : undefined}}
                    placeholder="请输入订单编号"
                  />
                  {checkingDuplicate && (
                    <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>检查中...</div>
                  )}
                  {duplicateError && (
                    <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>{duplicateError}</div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>品牌 *</label>
                  <select value={formData.品牌} onChange={(e) => handleFormChange('品牌', e.target.value)} style={selectStyle(false)}>
                    <option value="">请选择品牌</option>
                    {options.brands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>型号 *</label>
                  <select value={formData.型号} onChange={(e) => handleFormChange('型号', e.target.value)} style={selectStyle(!formData.品牌)} disabled={!formData.品牌}>
                    <option value="">请选择型号</option>
                    {options.models.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>类型 *</label>
                  <select value={formData.类型} onChange={(e) => handleFormChange('类型', e.target.value)} style={selectStyle(!formData.型号)} disabled={!formData.型号}>
                    <option value="">请选择类型</option>
                    {options.types.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>颜色 *</label>
                  <select value={formData.颜色} onChange={(e) => handleFormChange('颜色', e.target.value)} style={selectStyle(!formData.类型)} disabled={!formData.类型}>
                    <option value="">请选择颜色</option>
                    {options.colors.map(color => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>规格 *</label>
                  <select value={formData.规格} onChange={(e) => handleFormChange('规格', e.target.value)} style={selectStyle(!formData.颜色)} disabled={!formData.颜色}>
                    <option value="">请选择规格</option>
                    {options.specs.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>价格 *</label>
                  <input
                    type="number"
                    value={formData.价格}
                    onChange={(e) => handleFormChange('价格', e.target.value)}
                    style={{...inputStyle, background: '#f5f5f5', color: '#666'}}
                    placeholder="自动计算"
                    step="0.01"
                    readOnly
                  />
                </div>

                <div>
                  <label style={labelStyle}>购买件数 *</label>
                  <input
                    type="number"
                    value={formData.购买件数}
                    onChange={(e) => handleFormChange('购买件数', e.target.value)}
                    style={inputStyle}
                    placeholder="请输入购买件数"
                  />
                </div>

                <div style={{ gridColumn: isMobile ? 'span 2' : 'span 4' }}>
                  <label style={labelStyle}>备注</label>
                  <textarea
                    value={formData.备注}
                    onChange={(e) => handleFormChange('备注', e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minHeight: '50px', boxSizing: 'border-box' }}
                    placeholder="请输入备注"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: '6px 16px',
                    background: '#9e9e9e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '6px 16px',
                    background: loading ? '#ccc' : '#4caf50',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {loading ? '提交中...' : '提交'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 操作模态框 */}
      {showActionModal && actionRecord && (
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
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>操作选项</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleEdit}
                style={{
                  padding: '10px',
                  background: '#2196f3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                修改记录
              </button>
              <button
                onClick={handleDelete}
                style={{
                  padding: '10px',
                  background: '#f44336',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                删除记录
              </button>
              <button
                onClick={handleCopy}
                style={{
                  padding: '10px',
                  background: '#4caf50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                复制记录
              </button>
              <button
                onClick={handleCloseActionModal}
                style={{
                  padding: '10px',
                  background: '#9e9e9e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑模态框 */}
      {showEditModal && (
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
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '900px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>编辑订单</h3>
            
            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ gridColumn: isMobile ? 'span 2' : 'span 2' }}>
                  <label style={labelStyle}>客户信息 *</label>
                  {isMobile ? (
                    <textarea
                      value={editFormData.客户信息 || ''}
                      onChange={(e) => handleEditFormChange('客户信息', e.target.value)}
                      style={{...inputStyle, resize: 'none', minHeight: '60px', height: 'auto', overflow: 'hidden'}}
                      placeholder="请输入客户信息"
                      onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={editFormData.客户信息 || ''}
                      onChange={(e) => handleEditFormChange('客户信息', e.target.value)}
                      style={inputStyle}
                      placeholder="请输入客户信息"
                    />
                  )}
                </div>

                <div>
                  <label style={labelStyle}>平台 *</label>
                  <select value={editFormData.平台 || ''} onChange={(e) => handleEditFormChange('平台', e.target.value)} style={selectStyle(false)}>
                    <option value="">请选择平台</option>
                    {((editOptions.platforms && editOptions.platforms.length ? editOptions.platforms : options.platforms) || []).map(platform => (
                      <option key={platform} value={platform}>{platform}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>订单编号 *</label>
                  <input
                    type="text"
                    value={editFormData.订单编号 || ''}
                    onChange={(e) => handleEditFormChange('订单编号', e.target.value)}
                    style={inputStyle}
                    placeholder="请输入订单编号"
                  />
                </div>

                <div>
                  <label style={labelStyle}>品牌 *</label>
                  <select value={editFormData.品牌 || ''} onChange={(e) => handleEditFormChange('品牌', e.target.value)} style={selectStyle(false)}>
                    <option value="">请选择品牌</option>
                    {((editOptions.brands && editOptions.brands.length ? editOptions.brands : options.brands) || []).map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>型号 *</label>
                  <select value={editFormData.型号 || ''} onChange={(e) => handleEditFormChange('型号', e.target.value)} style={selectStyle(!editFormData.品牌)} disabled={!editFormData.品牌}>
                    <option value="">请选择型号</option>
                    {(editOptions.models || []).map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>类型 *</label>
                  <select value={editFormData.类型 || ''} onChange={(e) => handleEditFormChange('类型', e.target.value)} style={selectStyle(!editFormData.型号)} disabled={!editFormData.型号}>
                    <option value="">请选择类型</option>
                    {(editOptions.types || []).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>颜色 *</label>
                  <select value={editFormData.颜色 || ''} onChange={(e) => handleEditFormChange('颜色', e.target.value)} style={selectStyle(!editFormData.类型)} disabled={!editFormData.类型}>
                    <option value="">请选择颜色</option>
                    {(editOptions.colors || []).map(color => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>规格 *</label>
                  <select value={editFormData.规格 || ''} onChange={(e) => handleEditFormChange('规格', e.target.value)} style={selectStyle(!editFormData.颜色)} disabled={!editFormData.颜色}>
                    <option value="">请选择规格</option>
                    {(editOptions.specs || []).map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>价格 *</label>
                  <input
                    type="number"
                    value={editFormData.价格 || ''}
                    onChange={(e) => handleEditFormChange('价格', e.target.value)}
                    style={{...inputStyle, background: '#f5f5f5', color: '#666'}}
                    placeholder="自动计算"
                    step="0.01"
                    readOnly
                  />
                </div>

                <div>
                  <label style={labelStyle}>购买件数 *</label>
                  <input
                    type="number"
                    value={editFormData.购买件数 || ''}
                    onChange={(e) => handleEditFormChange('购买件数', e.target.value)}
                    style={inputStyle}
                    placeholder="请输入购买件数"
                  />
                </div>

                <div style={{ gridColumn: isMobile ? 'span 2' : 'span 4' }}>
                  <label style={labelStyle}>备注</label>
                  <textarea
                    value={editFormData.备注 || ''}
                    onChange={(e) => handleEditFormChange('备注', e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minHeight: '50px', boxSizing: 'border-box' }}
                    placeholder="请输入备注"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    padding: '6px 16px',
                    background: '#9e9e9e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '6px 16px',
                    background: loading ? '#ccc' : '#4caf50',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {loading ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 录入成功模态框 */}
      {showSuccessModal && successRecord && (
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
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#4caf50' }}>
              ✓ 订单录入成功
            </h3>
            
            <div style={{ 
              background: '#f5f5f5', 
              borderRadius: '4px', 
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '14px' }}>
                <div>
                  <strong>客户信息：</strong>{successRecord.客户信息}
                </div>
                <div>
                  <strong>平台：</strong>{successRecord.平台}
                </div>
                <div>
                  <strong>品牌：</strong>{successRecord.品牌}
                </div>
                <div>
                  <strong>型号：</strong>{successRecord.型号}
                </div>
                <div>
                  <strong>类型：</strong>{successRecord.类型}
                </div>
                <div>
                  <strong>颜色：</strong>{successRecord.颜色}
                </div>
                <div>
                  <strong>规格：</strong>{successRecord.规格}
                </div>
                <div>
                  <strong>价格：</strong>¥{successRecord.价格}
                </div>
                <div>
                  <strong>购买件数：</strong>{successRecord.购买件数}
                </div>
                {successRecord.备注 && (
                  <div>
                    <strong>备注：</strong>{successRecord.备注}
                  </div>
                )}
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>订单编号：</strong>{successRecord.订单编号}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={async () => {
                  // 复制记录到剪贴板
                  const text = `客户信息：${successRecord.客户信息}
品牌：${successRecord.品牌}
型号：${successRecord.型号}
类型：${successRecord.类型}
颜色：${successRecord.颜色}
规格：${successRecord.规格}
价格：${successRecord.价格}
购买件数：${successRecord.购买件数}
${successRecord.备注 ? `备注：${successRecord.备注}\n` : ''}
平台：${successRecord.平台}
订单编号：${successRecord.订单编号}`;
                  
                  try {
                    await copyToClipboard(text);
                    // 显示复制成功反馈
                    const btn = event.target;
                    const originalText = btn.textContent;
                    btn.textContent = '已复制！';
                    btn.style.background = '#4caf50';
                    setTimeout(() => {
                      btn.textContent = originalText;
                      btn.style.background = '#1976d2';
                    }, 1500);
                  } catch (err) {
                    console.error('复制失败:', err);
                    alert('复制失败，请手动复制');
                  }
                }}
                style={{
                  padding: '8px 20px',
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                复制记录
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessRecord(null);
                }}
                style={{
                  padding: '8px 20px',
                  background: '#9e9e9e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderEntry;
