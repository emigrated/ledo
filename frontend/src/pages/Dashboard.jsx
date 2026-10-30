import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import useResponsive from '../hooks/useResponsive';
import AdminUserManagement from './AdminUserManagement';
import ProductDataManagement from './ProductDataManagement';
import OptionsManagement from './OptionsManagement';
import OrderEntry from './OrderEntry';
import ReturnRegistration from './ReturnRegistration';
import MaintenanceRegistration from './MaintenanceRegistration';
import ChangeRequestReview from './ChangeRequestReview';
import Notifications from './Notifications';
import Settings from './Settings';
import Profile from './Profile';
import DashboardStats from './DashboardStats';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loginAs = localStorage.getItem('loginAs');
  const isAdmin = loginAs === 'admin' || user?.role === 'admin';
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [userSettings, setUserSettings] = useState(() => {
    const saved = localStorage.getItem('userSettings');
    return saved ? JSON.parse(saved) : { font_size: 90, theme: 'light', notifications_enabled: true };
  });
  const toggleCollapsed = () => setCollapsed((c) => !c);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isMobile } = useResponsive();

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed);
  }, [collapsed]);

  const FONT_SIZE_OPTIONS = [
    { value: 75, label: '75%' },
    { value: 80, label: '80%' },
    { value: 85, label: '85%' },
    { value: 90, label: '90%' },
    { value: 95, label: '95%' },
    { value: 100, label: '100%' },
    { value: 105, label: '105%' },
    { value: 110, label: '110%' },
    { value: 115, label: '115%' },
    { value: 120, label: '120%' },
    { value: 125, label: '125%' },
    { value: 130, label: '130%' },
    { value: 135, label: '135%' },
    { value: 140, label: '140%' },
    { value: 145, label: '145%' },
    { value: 150, label: '150%' }
  ];

  // 只在组件挂载时应用一次字体大小（由 index.html 预先设置，这里作为备用）
  useEffect(() => {
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        const fontSize = parsed.font_size || 100;
        const baseFontSize = 14;
        const scale = fontSize / 100;
        const newBaseSize = baseFontSize * scale;
        
        // 只设置 html 和 body，其他元素由 CSS 继承
        document.documentElement.style.fontSize = `${newBaseSize}px`;
        document.body.style.fontSize = `${newBaseSize}px`;
        
        // 保存 scale 供后续使用
        sessionStorage.setItem('fontSizeScale', scale.toString());
      } catch (e) {
        console.error('Failed to apply font size:', e);
      }
    }
  }, []);

  // 当字体设置改变时更新
  useEffect(() => {
    if (userSettings?.font_size) {
      const baseFontSize = 14;
      const scale = userSettings.font_size / 100;
      const newBaseSize = baseFontSize * scale;
      
      document.documentElement.style.fontSize = `${newBaseSize}px`;
      document.body.style.fontSize = `${newBaseSize}px`;
      sessionStorage.setItem('fontSizeScale', scale.toString());
    }
  }, [userSettings?.font_size]);

  const handleSettingsChange = (newSettings) => {
    setUserSettings(newSettings);
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
  };

  useEffect(() => {
    fetchUnreadCount();
  }, [activeTab]);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/change-requests/notifications/unread-count');
      if (response.ok && response.data) {
        setUnreadCount(response.data.unreadCount || 0);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      setUnreadCount(0);
    }
  };

  const fetchPendingReviewCount = async () => {
    if (user?.role !== 'admin') return;
    try {
      const [changeRes, paymentRes] = await Promise.all([
        api.get('/change-requests?status=pending&limit=1'),
        api.get('/maintenance/payment-reviews/pending')
      ]);
      const changeCount = (changeRes.ok && changeRes.data) ? (changeRes.data.total || 0) : 0;
      const paymentCount = (paymentRes.ok && paymentRes.data) ? (paymentRes.data.paymentReviews || []).length : 0;
      setPendingReviewCount(changeCount + paymentCount);
    } catch (error) {
      console.error('Failed to fetch pending review count:', error);
      setPendingReviewCount(0);
    }
  };

  useEffect(() => {
    fetchPendingReviewCount();
    const interval = setInterval(fetchPendingReviewCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // --- Shared render functions (nav items + bottom items + main content) ---

  const renderNavItems = (showLabels, isMobileMenu) => {
    const handleClick = (tab) => {
      setActiveTab(tab);
      if (isMobileMenu) setMenuOpen(false);
    };

    const badgeStyle = isMobileMenu
      ? { position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: '#f44336', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '10px', minWidth: '18px', textAlign: 'center' }
      : showLabels
        ? { position: 'absolute', left: '100px', transform: 'translateX(-100%)', top: '2px', background: '#f44336', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '10px', minWidth: '18px', textAlign: 'center' }
        : { position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '-4px', background: '#f44336', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '10px', minWidth: '18px', textAlign: 'center' };

    return (
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div
          onClick={() => handleClick('dashboard')}
          title="控制台"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px',
            cursor: 'pointer',
            background: activeTab === 'dashboard' ? 'rgba(255,255,255,0.2)' : 'transparent',
            borderRadius: '4px',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            height: '40px',
            flexShrink: 0
          }}
        >
          <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '24px', opacity: 0.9, flexShrink: 0 }}>⌂</span>
          {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>控制台</span>}
        </div>
        {isAdmin && (
          <div
            onClick={() => handleClick('admin')}
            title="用户管理"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              cursor: 'pointer',
              background: activeTab === 'admin' ? 'rgba(255,255,255,0.2)' : 'transparent',
              borderRadius: '4px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              height: '40px',
              flexShrink: 0
            }}
          >
            <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>👤</span>
            {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>用户管理</span>}
          </div>
        )}
        {isAdmin && (
          <div
            onClick={() => handleClick('product')}
            title="产品数据"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              cursor: 'pointer',
              background: activeTab === 'product' ? 'rgba(255,255,255,0.2)' : 'transparent',
              borderRadius: '4px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              height: '40px',
              flexShrink: 0
            }}
          >
            <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>📋</span>
            {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>产品数据</span>}
          </div>
        )}
        {isAdmin && (
          <div
            onClick={() => handleClick('options')}
            title="选项数据"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              cursor: 'pointer',
              background: activeTab === 'options' ? 'rgba(255,255,255,0.2)' : 'transparent',
              borderRadius: '4px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              height: '40px',
              flexShrink: 0
            }}
          >
            <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>☑</span>
            {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>选项数据</span>}
          </div>
        )}
        {isAdmin && (
          <div
            onClick={() => handleClick('orderEntry')}
            title="订单录入"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              cursor: 'pointer',
              background: activeTab === 'orderEntry' ? 'rgba(255,255,255,0.2)' : 'transparent',
              borderRadius: '4px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              height: '40px',
              flexShrink: 0
            }}
          >
            <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>📦</span>
            {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>订单录入</span>}
          </div>
        )}
        <div
          onClick={() => handleClick('returns')}
          title="退货登记"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px',
            cursor: 'pointer',
            background: activeTab === 'returns' ? 'rgba(255,255,255,0.2)' : 'transparent',
            borderRadius: '4px',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            height: '40px',
            flexShrink: 0
          }}
        >
          <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>📝</span>
          {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>退货登记</span>}
        </div>
        <div
          onClick={() => handleClick('maintenance')}
          title="维修登记"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px',
            cursor: 'pointer',
            background: activeTab === 'maintenance' ? 'rgba(255,255,255,0.2)' : 'transparent',
            borderRadius: '4px',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            height: '40px',
            flexShrink: 0
          }}
        >
          <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>🔧</span>
          {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>维修登记</span>}
        </div>
        {isAdmin && (
          <div
            onClick={() => { handleClick('review'); fetchPendingReviewCount(); }}
            title="审核管理"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              cursor: 'pointer',
              background: activeTab === 'review' ? 'rgba(255,255,255,0.2)' : 'transparent',
              borderRadius: '4px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              height: '40px',
              flexShrink: 0,
              position: 'relative'
            }}
          >
            <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>✓</span>
            {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>审核管理</span>}
            {pendingReviewCount > 0 && (
              <span style={badgeStyle}>
                {pendingReviewCount > 99 ? '99+' : pendingReviewCount}
              </span>
            )}
          </div>
        )}
        {user?.role !== 'admin' && (
        <div
          onClick={() => handleClick('notifications')}
          title="通知中心"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px',
            cursor: 'pointer',
            background: activeTab === 'notifications' ? 'rgba(255,255,255,0.2)' : 'transparent',
            borderRadius: '4px',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            height: '40px',
            flexShrink: 0,
            position: 'relative'
          }}
        >
          <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>🔔</span>
          {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>通知中心</span>}
          {unreadCount > 0 && (
            <span style={badgeStyle}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        )}
      </nav>
    );
  };

  const renderBottomItems = (showLabels, isMobileMenu) => {
    const handleClick = (tab) => {
      setActiveTab(tab);
      if (isMobileMenu) setMenuOpen(false);
    };

    return (
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div
          onClick={() => handleClick('profile')}
          title="个人中心"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px',
            cursor: 'pointer',
            background: activeTab === 'profile' ? 'rgba(255,255,255,0.2)' : 'transparent',
            borderRadius: '4px',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            height: '40px',
            flexShrink: 0
          }}
        >
          <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>👤</span>
          {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>个人中心</span>}
        </div>
        <div
          onClick={() => handleClick('settings')}
          title="设置"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px',
            cursor: 'pointer',
            background: activeTab === 'settings' ? 'rgba(255,255,255,0.2)' : 'transparent',
            borderRadius: '4px',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            height: '40px',
            flexShrink: 0
          }}
        >
          <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>⚙</span>
          {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>设置</span>}
        </div>
        <div
          onClick={() => {
            if (window.confirm('确定要退出登录吗？')) {
              // 保留用户偏好设置和记住的账号，清除其他所有缓存
              const userSettings = localStorage.getItem('userSettings');
              const rememberedPhone = localStorage.getItem('remembered_phone');
              const rememberedPwd = localStorage.getItem('remembered_password');
              localStorage.clear();
              if (userSettings) localStorage.setItem('userSettings', userSettings);
              if (rememberedPhone) localStorage.setItem('remembered_phone', rememberedPhone);
              if (rememberedPwd) localStorage.setItem('remembered_password', rememberedPwd);
              logout();
              navigate('/login');
            }
          }}
          title="退出登录"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px',
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            width: '100%',
            borderRadius: '4px',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            height: '40px',
            flexShrink: 0
          }}
        >
          <span style={{ display: 'flex', width: '24px', justifyContent: 'center', fontSize: '16px', opacity: 0.9, flexShrink: 0 }}>🚪</span>
          {showLabels && <span style={{ marginLeft: '10px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>退出登录</span>}
        </div>
      </div>
    );
  };

  const renderMainContent = () => (
    <main style={{ flex: 1, padding: isMobile ? '0.75rem' : '2rem', background: '#f5f5f5', overflow: 'auto' }}>
      {activeTab === 'dashboard' && (
        <DashboardStats user={user} isMobile={isMobile} />
      )}

      {activeTab === 'admin' && isAdmin && (
        <AdminUserManagement isMobile={isMobile} />
      )}

      {activeTab === 'product' && isAdmin && (
        <ProductDataManagement isMobile={isMobile} />
      )}

      {activeTab === 'options' && isAdmin && (
        <OptionsManagement isMobile={isMobile} />
      )}

      {activeTab === 'orderEntry' && isAdmin && (
        <OrderEntry isMobile={isMobile} />
      )}

      {activeTab === 'returns' && (
        <ReturnRegistration userRole={user?.role} isMobile={isMobile} />
      )}

      {activeTab === 'maintenance' && (
        <MaintenanceRegistration userRole={user?.role} isMobile={isMobile} />
      )}

      {activeTab === 'review' && isAdmin && (
        <ChangeRequestReview userRole={user?.role} isMobile={isMobile} />
      )}

      {activeTab === 'notifications' && (
        <Notifications userRole={user?.role} isMobile={isMobile} />
      )}

      {activeTab === 'profile' && (
        <Profile isMobile={isMobile} />
      )}

      {activeTab === 'settings' && (
        <Settings onSettingsChange={handleSettingsChange} isMobile={isMobile} />
      )}
    </main>
  );

  // --- Render ---

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile header */}
        <header style={{
          background: '#1976d2',
          color: 'white',
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '48px',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>企业内部系统</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ opacity: 0.9 }}>{user?.name}</span>
          </div>
        </header>

        {/* Mobile nav overlay */}
        {menuOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: 'fixed',
                top: '48px',
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.3)',
                zIndex: 999
              }}
            />
            {/* Navigation panel */}
            <div style={{
              position: 'fixed',
              top: '48px',
              left: 0,
              width: '240px',
              bottom: 0,
              background: '#1976d2',
              color: 'white',
              padding: '0.75rem',
              overflowY: 'auto',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {renderNavItems(true, true)}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                {renderBottomItems(true, true)}
              </div>
            </div>
          </>
        )}

        {/* Main content */}
        {renderMainContent()}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: collapsed ? '60px' : '180px',
          background: '#1976d2',
          color: 'white',
          padding: '1rem 0.5rem',
          transition: 'width 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflowY: 'auto',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.25rem 0', marginBottom: '1rem' }}>
          <button
            onClick={toggleCollapsed}
            aria-label="Toggle sidebar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>
        {renderNavItems(!collapsed, false)}
        {renderBottomItems(!collapsed, false)}
      </aside>

      {renderMainContent()}
    </div>
  );
}

export default Dashboard;
