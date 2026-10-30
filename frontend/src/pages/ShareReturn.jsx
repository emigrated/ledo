import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import API_BASE_URL from '../config/api';
import { fmtTime, fmtDate } from '../utils/time';

const ShareReturn = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const res = await api.get(`/share/return/${token}`);
        if (res.data.success) {
          setRecord(res.data.record);
          const expiresAt = new Date(res.data.expiresAt);
          const now = new Date();
          const left = expiresAt - now;
          
          if (left <= 0) {
            setExpired(true);
          } else {
            setTimeLeft(left);
          }
        }
        setLoading(false);
      } catch (err) {
        console.error('获取分享记录失败:', err);
        if (err.response?.status === 403 || err.response?.data?.expired) {
          setExpired(true);
          setError('分享链接已过期');
        } else if (err.response?.status === 404) {
          setError('分享链接无效或不存在');
        } else {
          setError('加载失败，请稍后重试');
        }
        setLoading(false);
      }
    };

    fetchRecord();
  }, [token]);

  // 倒计时
  useEffect(() => {
    if (!timeLeft || expired) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          setExpired(true);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, expired]);

  const formatTimeLeft = (ms) => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (days > 0) {
      return `${days}天 ${hours}小时 ${minutes}分 ${seconds}秒`;
    } else if (hours > 0) {
      return `${hours}小时 ${minutes}分 ${seconds}秒`;
    } else if (minutes > 0) {
      return `${minutes}分 ${seconds}秒`;
    } else {
      return `${seconds}秒`;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      '待审核': '#ff9800',
      '审核通过': '#4caf50',
      '审核拒绝': '#f44336',
      '已处理': '#2196f3',
      '已关闭': '#9e9e9e'
    };
    return colors[status] || '#666';
  };

  const getReasonColor = (reason) => {
    if (['无理由', '中途拦截'].includes(reason)) {
      return '#999';
    }
    return '#d32f2f';
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center', color: '#999' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <div>加载中...</div>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{ 
          background: 'white', 
          padding: '40px', 
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
          <h2 style={{ color: '#f44336', marginBottom: '12px' }}>分享链接已过期</h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            该分享链接的有效期为 7 天，现已过期无法查看。
          </p>
          <p style={{ color: '#999', fontSize: '14px' }}>
            请联系分享者重新分享
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              marginTop: '24px',
              padding: '10px 24px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{ 
          background: 'white', 
          padding: '40px', 
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <h2 style={{ color: '#f44336', marginBottom: '12px' }}>加载失败</h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>{error}</p>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '10px 24px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 顶部有效期提示 */}
      <div style={{
        background: timeLeft && timeLeft < 1000 * 60 * 60 * 24 ? '#ff9800' : '#2196f3',
        color: 'white',
        padding: '12px 0',
        textAlign: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>
          <span style={{ fontSize: '16px', fontWeight: '500' }}>📅 分享链接有效期：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px' }}>
            {formatTimeLeft(timeLeft)}
          </span>
          <span style={{ marginLeft: '16px', opacity: 0.9, fontSize: '14px' }}>
            (7 天后过期)
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
        {/* 返回按钮 */}
        <button
          onClick={() => navigate('/login')}
          style={{
            marginBottom: '16px',
            padding: '8px 16px',
            background: 'white',
            color: '#1976d2',
            border: '1px solid #1976d2',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← 返回首页
        </button>

        {/* 记录详情 */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '24px', color: '#333' }}>
            退货登记详情
          </h1>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', width: '120px', background: '#f5f5f5', fontWeight: 'bold' }}>
                  订单编号
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.order_number || '-'}
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', width: '120px', background: '#f5f5f5', fontWeight: 'bold' }}>
                  客户信息
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.customer_info || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  购买日期
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.purchase_date ? fmtDate(record.purchase_date) : '-'}
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  品牌
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.brand || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  型号
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.model || '-'}
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  类型
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.type || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  颜色
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.color || '-'}
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  规格
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.spec || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  原因
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    background: getReasonColor(record.reason),
                    color: record.reason && !['无理由', '中途拦截'].includes(record.reason) ? 'white' : '#666'
                  }}>
                    {record.reason || '-'}
                  </span>
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  状态
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    background: getStatusColor(record.status),
                    color: 'white'
                  }}>
                    {record.status || '-'}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  快递
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.courier || '-'}
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  单号
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.tracking_number || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  价格
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  ¥{record.price || '0.00'}
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  仓库
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.warehouse || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  平台
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.platform || '-'}
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  运费
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  ¥{record.shipping_fee || '0.00'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  购买件数
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.quantity || '-'}
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  退货件数
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.return_quantity || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  备注
                </td>
                <td colSpan="3" style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {record.remarks || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                  创建时间
                </td>
                <td colSpan="3" style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                  {fmtTime(record.created_at)}
                </td>
              </tr>
              {record.attachments && record.attachments.length > 0 && (
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #e0e0e0', background: '#f5f5f5', fontWeight: 'bold' }}>
                    附件
                  </td>
                  <td colSpan="3" style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {record.attachments.map(att => {
                        // 处理文件路径：去掉 Docker 容器内 /app 前缀
                        let filePath = (att.file_path || '').replace(/^\/app/, '');
                        if (!filePath.startsWith('/')) {
                          filePath = '/' + filePath;
                        }
                        const fileUrl = filePath.startsWith('http') ? filePath : `${API_BASE_URL}${filePath}`;
                        const isImage = att.mime_type && att.mime_type.startsWith('image/');
                        const isVideo = att.mime_type && att.mime_type.startsWith('video/');
                        
                        return (
                          <div key={att.id} style={{ position: 'relative', width: '80px', height: '80px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                            {isImage ? (
                              <img 
                                src={fileUrl} 
                                alt={att.original_name || '附件'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                onClick={() => window.open(fileUrl, '_blank')}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : isVideo ? (
                              <video 
                                src={fileUrl} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                onClick={() => window.open(fileUrl, '_blank')}
                                controls
                              />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f5f5f5', fontSize: '10px', color: '#666', textAlign: 'center', padding: '4px' }}>
                                📄 {att.original_name ? att.original_name.substring(0, 10) : '文件'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ShareReturn;
