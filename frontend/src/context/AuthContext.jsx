import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import API_BASE_URL from '../config/api';

const AuthContext = createContext(null);

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 分钟

function buildRefreshUrl() {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL : API_BASE_URL + '/';
  return base + 'api/auth/refresh';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  const doRefresh = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    const currentToken = localStorage.getItem('token');
    if (!refreshToken || !currentToken) return;

    try {
      const response = await fetch(buildRefreshUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
      }
      // 静默失败 — http.js 的 401 拦截器会兜底
    } catch (err) {
      // 网络错误也不影响
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // 用户登录后每 10 分钟自动刷新 token，保持会话不过期
  useEffect(() => {
    if (user) {
      doRefresh(); // 登录后立即刷新一次
      refreshTimerRef.current = setInterval(doRefresh, REFRESH_INTERVAL);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [user, doRefresh]);

  const login = (userData, token, refreshToken) => {
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken || '');
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
