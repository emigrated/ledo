import React, { useState, useEffect } from 'react';
import api from '../utils/api';

function Settings({ onSettingsChange, isMobile = false }) {
  const [settings, setSettings] = useState({
    font_size: 100,
    theme: 'light',
    notifications_enabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [appVersion, setAppVersion] = useState('');

  // ---- Update state ----
  const [updateStatus, setUpdateStatus] = useState('');          // plain text status
  const [updateAvailable, setUpdateAvailable] = useState(null);  // { version, size, ... }
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null); // { percent, bytesPerSecond, transferred, total }
  const [updateReady, setUpdateReady] = useState(false);          // downloaded + extracted
  const [checkError, setCheckError] = useState('');
  const [updateError, setUpdateError] = useState('');             // download/extract/install failure

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

  const DEFAULT_SETTINGS = {
    font_size: 100,
    theme: 'light',
    notifications_enabled: true
  };

  useEffect(() => {
    const saved = localStorage.getItem('userSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSettings({ ...DEFAULT_SETTINGS, ...parsed });
    }
    fetchSettings();

    // 获取应用版本（Electron 环境）
    if (window.electronApp && window.electronApp.getVersion) {
      window.electronApp.getVersion().then(v => setAppVersion(v));
    } else {
      // Web/浏览器环境无 Electron API：用构建版本兜底（发版时需同步更新此值）
      setAppVersion('1.0.14');
    }

    // ---- Update IPC listeners ----
    const cleanups = [];

    if (window.electronUpdater) {
      // Status text (backward compat + general messages)
      if (window.electronUpdater.onStatus) {
        const unsub = window.electronUpdater.onStatus((msg) => {
          setUpdateStatus(msg);
        });
        cleanups.push(unsub);
      }

      // Update available (auto-prompt from main process)
      if (window.electronUpdater.onUpdateAvailable) {
        const unsub = window.electronUpdater.onUpdateAvailable((info) => {
          setUpdateAvailable(info);
          setUpdateStatus(`发现新版本 ${info.version}`);
        });
        cleanups.push(unsub);
      }

      // Download progress
      if (window.electronUpdater.onProgress) {
        const unsub = window.electronUpdater.onProgress((progress) => {
          setDownloadProgress(progress);
          setUpdateStatus(`正在下载更新... ${progress.percent}%`);
        });
        cleanups.push(unsub);
      }

      // Update ready (download + extract complete)
      if (window.electronUpdater.onUpdateReady) {
        const unsub = window.electronUpdater.onUpdateReady(() => {
          setUpdateReady(true);
          setIsDownloading(false);
          setDownloadProgress(null);
          setUpdateStatus('更新已就绪，请点击安装');
        });
        cleanups.push(unsub);
      }

      // Update error (download / extract / install failure)
      if (window.electronUpdater.onError) {
        const unsub = window.electronUpdater.onError((msg) => {
          setUpdateError(msg);
          setUpdateStatus(msg);
          setIsDownloading(false);
          setDownloadProgress(null);
          setUpdateReady(false);
        });
        cleanups.push(unsub);
      }

      // Also get the current status on mount
      if (window.electronUpdater.getStatus) {
        window.electronUpdater.getStatus().then(s => {
          if (s) setUpdateStatus(s);
        });
      }
    }

    return () => {
      cleanups.forEach(fn => fn && fn());
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/users/settings');
      const serverSettings = response.data;
      const saved = localStorage.getItem('userSettings');

      if (!saved || serverSettings.font_size !== 90) {
        const mergedSettings = saved ? { ...serverSettings, ...JSON.parse(saved) } : serverSettings;
        setSettings({ ...DEFAULT_SETTINGS, ...mergedSettings });
        localStorage.setItem('userSettings', JSON.stringify(mergedSettings));
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await api.put('/users/settings', settings);
      setMessage('设置已保存');
      localStorage.setItem('userSettings', JSON.stringify(settings));
      if (onSettingsChange) {
        onSettingsChange(settings);
      }
      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
  };

  // ---- Update actions ----

  const handleCheckForUpdate = async () => {
    if (!window.electronUpdater || !window.electronUpdater.checkForUpdate) {
      setUpdateStatus('仅在桌面端可用');
      return;
    }
    setIsChecking(true);
    setCheckError('');
    setUpdateError('');
    setUpdateAvailable(null);
    setUpdateReady(false);
    setDownloadProgress(null);
    try {
      const result = await window.electronUpdater.checkForUpdate();
      if (result && result.hasUpdate) {
        setUpdateAvailable(result);
        setUpdateStatus(`发现新版本 ${result.version}`);
      } else if (result && result.error) {
        setCheckError(result.error);
        setUpdateStatus(`检查失败: ${result.error}`);
      } else {
        setUpdateStatus('已是最新版本');
      }
    } catch (err) {
      setCheckError(err.message);
      setUpdateStatus(`检查失败: ${err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleStartDownload = () => {
    if (!window.electronUpdater || !window.electronUpdater.startDownload) return;
    setUpdateError('');
    setIsDownloading(true);
    setUpdateReady(false);
    window.electronUpdater.startDownload();
  };

  const handleCancelUpdate = () => {
    if (window.electronUpdater && window.electronUpdater.cancelUpdate) {
      window.electronUpdater.cancelUpdate();
    }
    setUpdateAvailable(null);
    setDownloadProgress(null);
    setIsDownloading(false);
    setUpdateReady(false);
    setUpdateError('');
  };

  const handleInstallUpdate = () => {
    if (window.electronUpdater && window.electronUpdater.installUpdate) {
      window.electronUpdater.installUpdate();
    }
  };

  const currentOption = FONT_SIZE_OPTIONS.find(o => o.value === settings.font_size) || FONT_SIZE_OPTIONS.find(o => o.value === 90);

  const previewFontSize = `${(settings.font_size / 100) * 14}px`;

  if (loading) {
    return <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>加载中...</div>;
  }

  // ---- Styles ----

  const overlayStyle = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const dialogStyle = {
    background: '#fff',
    borderRadius: '12px',
    padding: '28px 32px',
    maxWidth: '440px',
    width: '90%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  };

  const btnBase = {
    padding: '10px 24px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  };

  const progressBarOuter = {
    width: '100%',
    height: '8px',
    background: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
  };

  const progressBarInner = (pct) => ({
    width: `${Math.min(pct, 100)}%`,
    height: '100%',
    background: 'linear-gradient(90deg, #1976d2, #42a5f5)',
    borderRadius: '4px',
    transition: 'width 0.2s ease',
  });

  // Helper formats bytes to human-readable
  const fmtSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div style={{ padding: isMobile ? '8px' : '16px', maxWidth: '600px' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: '600' }}>设置</h2>

      <div style={{ background: '#fff', borderRadius: '8px', padding: '24px' }}>
        {message && (
          <div style={{
            padding: '10px',
            marginBottom: '16px',
            borderRadius: '4px',
            background: message.includes('已保存') ? '#e8f5e9' : '#ffebee',
            color: message.includes('已保存') ? '#2e7d32' : '#c62828',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: '500' }}>
              字体大小：{currentOption.label}
            </label>
            <input
              type="range"
              min="75"
              max="150"
              step="5"
              value={settings.font_size}
              onChange={(e) => handleChange('font_size', parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                background: '#ddd',
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#999' }}>
              <span>75%</span>
              <span>150%</span>
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '16px' }}>
              预览：<span style={{ fontSize: previewFontSize }}>
                这是一个示例文本，用于预览字体大小效果
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #eee' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>消息通知</div>
                <div style={{ fontSize: '12px', color: '#666' }}>开启后您将收到审核状态变更通知</div>
              </div>
              <div
                onClick={() => handleChange('notifications_enabled', !settings.notifications_enabled)}
                style={{
                  width: '48px',
                  height: '28px',
                  borderRadius: '14px',
                  background: settings.notifications_enabled ? '#1976d2' : '#ccc',
                  position: 'relative',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: settings.notifications_enabled ? '22px' : '2px',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px',
              background: saving ? '#ccc' : '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </form>
      </div>

      {/* ===================== About Section ===================== */}
      <div style={{ marginTop: '24px', background: '#fff', borderRadius: '8px', padding: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '16px' }}>关于</h3>
        <div style={{ fontSize: '13px', color: '#666' }}>
          <div style={{ marginBottom: '8px' }}>版本：{appVersion || '1.0.14'}</div>
          <div style={{ marginBottom: '16px' }}>企业内部系统</div>

          {/* Check for update button */}
          {window.electronUpdater && window.electronUpdater.checkForUpdate && (
            <div style={{ marginBottom: '12px' }}>
              <button
                onClick={handleCheckForUpdate}
                disabled={isChecking || isDownloading}
                style={{
                  ...btnBase,
                  background: isChecking ? '#e0e0e0' : '#1976d2',
                  color: isChecking ? '#999' : '#fff',
                }}
              >
                {isChecking ? '检查中...' : '检查更新'}
              </button>
            </div>
          )}

          {/* Status text */}
          {updateStatus && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              background: updateStatus.includes('出错') || updateStatus.includes('失败')
                ? '#ffebee' : updateStatus.includes('已是最新')
                ? '#e8f5e9' : '#e3f2fd',
              color: updateStatus.includes('出错') || updateStatus.includes('失败')
                ? '#c62828' : updateStatus.includes('已是最新')
                ? '#2e7d32' : '#1565c0'
            }}>
              {updateStatus}
            </div>
          )}
        </div>
      </div>

      {/* ===================== Update Dialog Overlay ===================== */}
      {(updateAvailable || isDownloading || updateReady || updateError) && (
        <div style={overlayStyle} onClick={(e) => {
          // Click outside closes dialog unless downloading or ready to install
          if (e.target === e.currentTarget && !isDownloading && !updateReady) {
            handleCancelUpdate();
          }
        }}>
          <div style={dialogStyle}>

            {/* Header */}
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>
              软件更新
            </h3>

            {/* Error state */}
            {updateError ? (
              <>
                <div style={{
                  background: '#ffebee',
                  color: '#c62828',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '13px',
                  marginBottom: '16px',
                  wordBreak: 'break-all'
                }}>
                  {updateError}
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleCancelUpdate}
                    style={{
                      ...btnBase,
                      background: '#f5f5f5',
                      color: '#333',
                    }}
                  >
                    关闭
                  </button>
                  <button
                    onClick={handleStartDownload}
                    style={{
                      ...btnBase,
                      background: '#1976d2',
                      color: '#fff',
                    }}
                  >
                    重新下载
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Available update info */}
                {updateAvailable && !isDownloading && !updateReady && (
              <>
                <div style={{ fontSize: '14px', color: '#333', marginBottom: '12px' }}>
                  发现新版本 <strong>{updateAvailable.version}</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  当前版本：{updateAvailable.currentVersion}
                </div>
                {updateAvailable.releaseDate && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    发布日期：{new Date(updateAvailable.releaseDate).toLocaleDateString('zh-CN')}
                  </div>
                )}
                {updateAvailable.size > 0 && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
                    文件大小：{fmtSize(updateAvailable.size)}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleCancelUpdate}
                    style={{
                      ...btnBase,
                      background: '#f5f5f5',
                      color: '#333',
                    }}
                  >
                    暂不更新
                  </button>
                  <button
                    onClick={handleStartDownload}
                    style={{
                      ...btnBase,
                      background: '#1976d2',
                      color: '#fff',
                    }}
                  >
                    下载更新
                  </button>
                </div>
              </>
            )}

            {/* Downloading progress */}
            {isDownloading && (
              <>
                <div style={{ fontSize: '14px', color: '#333', marginBottom: '8px' }}>
                  {updateStatus.includes('解压')
                    ? '正在解压更新包（约 1 分钟），请稍候...'
                    : `正在下载更新${updateAvailable ? ` ${updateAvailable.version}` : ''}...`}
                </div>
                {updateStatus.includes('解压') ? (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                    解压完成后将出现"立即安装"按钮
                  </div>
                ) : (
                  downloadProgress && (
                  <>
                    <div style={progressBarOuter}>
                      <div style={progressBarInner(downloadProgress.percent)} />
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#666',
                      marginTop: '6px',
                    }}>
                      <span>{downloadProgress.percent}%</span>
                      <span>
                        {fmtSize(downloadProgress.transferred)} / {fmtSize(downloadProgress.total)}
                      </span>
                    </div>
                    {downloadProgress.bytesPerSecond > 0 && (
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                        {fmtSize(downloadProgress.bytesPerSecond)}/s
                      </div>
                    )}
                  </>
                  )
                )}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    onClick={handleCancelUpdate}
                    style={{
                      ...btnBase,
                      background: '#f5f5f5',
                      color: '#333',
                    }}
                  >
                    取消下载
                  </button>
                </div>
              </>
            )}

            {/* Ready to install */}
            {updateReady && (
              <>
                <div style={{ fontSize: '14px', color: '#333', marginBottom: '4px' }}>
                  更新已准备就绪
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
                  {updateAvailable ? `版本 ${updateAvailable.version}` : ''} 已下载并解压完成，点击安装后应用将自动重启。
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setUpdateReady(false);
                      setUpdateAvailable(null);
                    }}
                    style={{
                      ...btnBase,
                      background: '#f5f5f5',
                      color: '#333',
                    }}
                  >
                    稍后安装
                  </button>
                  <button
                    onClick={handleInstallUpdate}
                    style={{
                      ...btnBase,
                      background: '#2e7d32',
                      color: '#fff',
                    }}
                  >
                    立即安装
                  </button>
                </div>
              </>
            )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
