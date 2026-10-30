import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import { formatPhone, formatIdCard, validatePhone, validateIdCard } from '../utils/validation';

function Register() {
  const [name, setName] = useState('');
  const [idCard, setIdCard] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('两次密码输入不一致');
      setLoading(false);
      return;
    }

    if (phone.length !== 11) {
      setError('请输入11位手机号码');
      setLoading(false);
      return;
    }

if (!validateIdCard(idCard)) {
      setError('请输入正确的18位身份证号码（最后一位可以是X）');
      setLoading(false);
      return;
    }

    if (!validatePhone(phone)) {
      setError('请输入11位手机号码');
      setLoading(false);
      return;
    }

    try {
      const url = `${API_BASE_URL}/api/auth/register`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          id_card: idCard,
          phone,
          password
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { response: { status: response.status, data: errorData } };
      }

      const data = await response.json();

      alert('注册成功！请登录');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>用户注册</h2>
        
        {error && <div className="error" style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>姓名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入姓名"
              required
            />
          </div>
          
          <div className="form-group">
            <label>身份证号码</label>
            <input
              type="text"
              value={idCard}
              onChange={(e) => setIdCard(formatIdCard(e.target.value))} maxLength={18}
              placeholder="请输入15-18位身份证号码"
              required
            />
          </div>
          
          <div className="form-group">
            <label>手机号码</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))} maxLength={11} placeholder="请输入11位手机号码"
              required
            />
          </div>
          
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码（至少6位）"
              minLength={6}
              required
            />
          </div>
          
          <div className="form-group">
            <label>确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              required
            />
          </div>
          
          <button type="submit" className="btn" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          已有账号？<Link to="/login">立即登录</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;