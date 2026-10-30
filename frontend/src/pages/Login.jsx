import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../config/api';
import http from '../utils/http';

function Login() {
  const [loginType, setLoginType] = useState('user');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [resetData, setResetData] = useState({ phone: '', name: '', idCard: '', newPassword: '' });
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedPhone = localStorage.getItem('remembered_phone');
    const savedPassword = localStorage.getItem('remembered_password');
    if (savedPhone && savedPassword) {
      setPhone(savedPhone);
      setPassword(savedPassword);
      setRemember(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = loginType === 'admin' ? '/api/auth/admin/login' : '/api/auth/login';
      const url = `${API_BASE_URL}${endpoint}`;
      
      const response = await http.post(url, { phone, password });

      if (!response.ok) {
        if (response.status === 401) {
          setError('手机号或密码错误');
          setLoading(false);
          return;
        }
        if (response.status === 403) {
          setError('账号已被禁用，请联系管理员');
          setLoading(false);
          return;
        }
        setError(response.data?.error || '登录失败');
        setLoading(false);
        return;
      }

      const data = response.data;
      login(data.user, data.token, data.refreshToken);
      localStorage.setItem('loginAs', loginType);
      if (remember) {
        localStorage.setItem('remembered_phone', phone);
        localStorage.setItem('remembered_password', password);
      } else {
        localStorage.removeItem('remembered_phone');
        localStorage.removeItem('remembered_password');
      }
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('无法连接服务器，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIdentity = async (e) => {
    e.preventDefault();
    setResetError('');

    try {
      const endpoint = loginType === 'admin' ? '/api/auth/admin/reset-password' : '/api/auth/reset-password';
      const url = `${API_BASE_URL}${endpoint}`;
      
      const response = await http.post(url, {
        phone: resetData.phone,
        name: resetData.name,
        id_card: resetData.idCard
      });
      
      if (!response.ok) {
        setResetError(response.data?.error || '身份验证失败');
        return;
      }
      
      setForgotStep(2);
    } catch (err) {
      console.error('Verify identity error:', err);
      setResetError('身份验证失败');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');

    if (resetData.newPassword.length < 6) {
      setResetError('密码长度至少6位');
      return;
    }

    try {
      const endpoint = loginType === 'admin' ? '/api/auth/admin/reset-password/confirm' : '/api/auth/reset-password/confirm';
      const url = `${API_BASE_URL}${endpoint}`;
      
      const response = await http.post(url, {
        phone: resetData.phone,
        new_password: resetData.newPassword
      });
      
      if (!response.ok) {
        setResetError(response.data?.error || '密码重置失败');
        return;
      }
      
      setResetSuccess('密码重置成功！请使用新密码登录');
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotStep(1);
        setResetData({ phone: '', name: '', idCard: '', newPassword: '' });
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      setResetError('密码重置失败');
    }
  };

  const tabStyle = (type) => ({
    padding: '12px 24px',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    fontSize: '16px',
    color: loginType === type ? '#333' : '#999',
    position: 'relative',
    transition: 'color 0.3s ease'
  });

  const underlineStyle = {
    position: 'absolute',
    bottom: '0',
    left: loginType === 'user' ? '0' : '50%',
    width: '50%',
    height: '2px',
    backgroundColor: '#1976d2',
    transition: 'left 0.3s ease, width 0.3s ease'
  };

  if (showForgotPassword) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            {forgotStep === 1 ? '验证身份' : '重置密码'}
          </h2>
          
          {resetSuccess && <div style={{ color: 'green', marginBottom: '1rem', textAlign: 'center' }}>{resetSuccess}</div>}
          {resetError && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{resetError}</div>}
          
          {forgotStep === 1 ? (
            <form onSubmit={handleVerifyIdentity}>
              <div className="form-group">
                <label>手机号码</label>
                <input
                  type="text"
                  value={resetData.phone}
                  onChange={(e) => setResetData({...resetData, phone: e.target.value})}
                  placeholder="请输入手机号码"
                  required
                />
              </div>
              <div className="form-group">
                <label>姓名</label>
                <input
                  type="text"
                  value={resetData.name}
                  onChange={(e) => setResetData({...resetData, name: e.target.value})}
                  placeholder="请输入姓名"
                  required
                />
              </div>
              <div className="form-group">
                <label>身份证号码</label>
                <input
                  type="text"
                  value={resetData.idCard}
                  onChange={(e) => setResetData({...resetData, idCard: e.target.value})}
                  placeholder="请输入身份证号码"
                  required
                />
              </div>
              <button type="submit" className="btn" style={{ width: '100%', marginTop: '1rem' }}>验证</button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>新密码</label>
                <input
                  type="password"
                  value={resetData.newPassword}
                  onChange={(e) => setResetData({...resetData, newPassword: e.target.value})}
                  placeholder="请输入新密码（至少6位）"
                  minLength={6}
                  required
                />
              </div>
              <button type="submit" className="btn" style={{ width: '100%', marginTop: '1rem' }}>确认重置</button>
            </form>
          )}
          
          <p style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="#" onClick={() => { setShowForgotPassword(false); setForgotStep(1); }}>返回登录</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '1px solid #eee', position: 'relative' }}>
            <button style={tabStyle('user')} onClick={() => setLoginType('user')}>
              用户登录
            </button>
            <button style={tabStyle('admin')} onClick={() => setLoginType('admin')}>
              管理员登录
            </button>
            <div style={underlineStyle} />
          </div>
        </div>
        
        {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>手机号码</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入11位手机号码"
              required
            />
          </div>
          
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ marginRight: '8px', cursor: 'pointer' }}
            />
            <label htmlFor="remember" style={{ cursor: 'pointer', fontSize: '14px', color: '#666' }}>
              记住账号密码
            </label>
          </div>
          
          <button type="submit" className="btn" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        
        <div style={{ marginTop: '1rem', textAlign: 'center', display: 'flex', justifyContent: 'space-between' }}>
          {loginType === 'user' ? (
            <>
              <span>没有账号？<Link to="/register">立即注册</Link></span>
              <Link to="#" onClick={() => setShowForgotPassword(true)}>忘记密码？</Link>
            </>
          ) : (
            <Link to="#" onClick={() => setShowForgotPassword(true)}>忘记密码？</Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
