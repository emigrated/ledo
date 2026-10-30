import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const STATUS_COLORS = { '待处理': '#f44336', '维修中': '#ff9800', '已完成': '#4caf50', '已退回': '#9e9e9e' };
const PALETTE = ['#1976d2', '#ff9800', '#4caf50', '#f44336', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];

const cardBase = { background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

function formatAmount(n) {
  if (n == null) return '-';
  return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* ---------- 全部/本年 筛选按钮 ---------- */
function YearFilter({ current, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {['all', 'year'].map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            padding: '2px 12px', borderRadius: 12, fontSize: 12, cursor: 'pointer', border: '1px solid #d0d0d0',
            background: current === p ? '#1976d2' : '#fff', color: current === p ? '#fff' : '#666',
          }}
        >
          {p === 'all' ? '全部' : '本年'}
        </button>
      ))}
    </div>
  );
}

/* ---------- SVG 环形图 ---------- */
function Donut({ data, colors, size = 130, thickness = 18, label = '' }) {
  const total = data.reduce((a, d) => a + (d.count || 0), 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  let acc = 0;
  const segs = data.map((d, i) => {
    const pct = total ? d.count / total : 0;
    const seg = { ...d, start: acc, dash: pct * C, color: colors[i % colors.length] };
    acc += pct;
    return seg;
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f0" strokeWidth={thickness} />
          {segs.map((s, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${s.dash} ${C - s.dash}`}
              strokeDashoffset={-s.start * C}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{total}</div>
          {label && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{label}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 12px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0 }} />
            <span style={{ color: '#666' }}>{d.name}</span>
            <span style={{ fontWeight: 600 }}>{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 横向条形图 ---------- */
function HBar({ items, maxCount, barColor }) {
  const max = maxCount || Math.max(...items.map(it => it.count || 0), 1);
  return (
    <div>
      {items.map((it, i) => (
        <div key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 90, flexShrink: 0, fontSize: 12, textAlign: 'right', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.name}>{it.name}</div>
          <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 16, overflow: 'hidden' }}>
            <div style={{ width: `${(it.count / max) * 100}%`, height: '100%', background: barColor || PALETTE[i % PALETTE.length], borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ width: 36, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{it.count}</div>
        </div>
      ))}
      {items.length === 0 && <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 8 }}>暂无数据</div>}
    </div>
  );
}

/* ---------- 月度趋势柱状图 ---------- */
function TrendChart({ data, isMobile }) {
  const max = Math.max(...data.map(d => d.count || 0), 1);
  const barW = isMobile ? 22 : 28;
  const gap = isMobile ? 3 : 6;
  const h = 120;
  const showLabelEvery = isMobile ? 2 : 1;
  const topH = 18;                    // 顶部数值区高度
  const bottomH = isMobile ? 30 : 24; // 底部月标签区高度（移动端旋转下移需更多留白）
  return (
    <div style={{ overflowX: 'auto', padding: '0 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap, minHeight: h + topH + bottomH, minWidth: data.length * (barW + gap) }}>
        {data.map((d, i) => {
          const pct = max ? d.count / max : 0;
          const monthShort = d.ym ? `${d.ym.slice(5)}月` : '';
          return (
            <div key={d.ym} style={{ width: barW, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ height: topH, fontSize: 10, lineHeight: `${topH - 2}px`, color: '#888', fontWeight: 500 }}>{d.count > 0 ? d.count : ''}</div>
              <div style={{ width: '100%', height: h, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', height: `${pct * 100}%`, background: '#1976d2', borderRadius: '3px 3px 0 0', transition: 'height 0.3s', minHeight: d.count > 0 ? 4 : 0 }} />
              </div>
              <div style={{ height: bottomH, fontSize: 10, lineHeight: `${isMobile ? 28 : 18}px`, color: '#999', whiteSpace: 'nowrap', transform: isMobile ? 'rotate(-45deg)' : 'none', marginTop: isMobile ? 4 : 0 }}>
                {i % showLabelEvery === 0 ? monthShort : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- KPI 卡片 ---------- */
function KPICard({ label, value, sub, accent, icon, fullWidth }) {
  return (
    <div style={{ ...cardBase, gridColumn: fullWidth ? '1 / -1' : 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent || '#1a1a1a', lineHeight: 1.15 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#666', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

/* ---------- 看板区块（带标题栏，支持列定位：left/right/full） ---------- */
function BoardCard({ title, children, isMobile, filter, onFilterChange, column }) {
  let gridColumn = 'auto';
  if (column === 'left') gridColumn = isMobile ? '1 / -1' : '1';
  else if (column === 'right') gridColumn = isMobile ? '1 / -1' : '2';
  else if (column === 'full') gridColumn = '1 / -1';
  return (
    <div style={{ ...cardBase, gridColumn, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{title}</div>
        {filter && <YearFilter current={filter} onChange={onFilterChange} />}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>{children}</div>
    </div>
  );
}

/* ========== 主组件 ========== */
function DashboardStats({ isMobile }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // 每张卡片的「全部/本年」筛选（维修省份保留多年度按钮）
  const [statusPeriod, setStatusPeriod] = useState('all');
  const [provinceYear, setProvinceYear] = useState('all');
  const [trendPeriod, setTrendPeriod] = useState('all');
  const [modelPeriod, setModelPeriod] = useState('all');
  const [platformPeriod, setPlatformPeriod] = useState('all');
  const [warrantyPeriod, setWarrantyPeriod] = useState('all');
  const [returnProvPeriod, setReturnProvPeriod] = useState('all');
  const [returnModelPeriod, setReturnModelPeriod] = useState('all');
  const [returnBrandPeriod, setReturnBrandPeriod] = useState('all');
  const [returnPlatPeriod, setReturnPlatPeriod] = useState('all');
  const [returnReasonPeriod, setReturnReasonPeriod] = useState('all');
  const [returnTrendPeriod, setReturnTrendPeriod] = useState('all');

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/stats');
      if (res.ok && res.data && res.data.kpi) {
        setStats(res.data);
        setLastUpdate(new Date());
      } else {
        console.error('Dashboard stats fetch failed:', res.status, res.data);
        setStats(null);
      }
    } catch (e) {
      console.error('Failed to fetch dashboard stats:', e);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 30000);
    return () => clearInterval(t);
  }, [fetchStats]);

  if (loading && !stats) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>加载中...</div>;
  }
  if (!stats?.kpi) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#c00' }}>加载失败</div>;
  }

  const { kpi, statusDistAll, statusDistYear, provinceDist, provinceYearDist, provinceYears, platformDistAll, platformDistYear, trendAll, trendYear, modelTopAll, modelTopYear, reasonDistAll, reasonDistYear, warrantyDistAll, warrantyDistYear, returnBrandDistAll, returnBrandDistYear, returnProvinceDist, returnProvinceYearDist, returnModelDistAll, returnModelDistYear, returnPlatformDistAll, returnPlatformDistYear, returnReasonDistAll, returnReasonDistYear, returnTrendAll, returnTrendYear } = stats;

  const growthArrow = kpi.repairGrowth > 0 ? '↑' : kpi.repairGrowth < 0 ? '↓' : '—';
  const growthColor = kpi.repairGrowth > 0 ? '#4caf50' : kpi.repairGrowth < 0 ? '#f44336' : '#888';

  const statusDist = statusPeriod === 'all' ? statusDistAll : statusDistYear;
  const provItems = provinceYear === 'all' ? provinceDist : (provinceYearDist[provinceYear] || []);
  const provMax = Math.max(...provItems.map(d => d.count || 0), 1);
  const trend = trendPeriod === 'all' ? trendAll : trendYear;
  const modelTop = modelPeriod === 'all' ? modelTopAll : modelTopYear;
  const platformDist = platformPeriod === 'all' ? platformDistAll : platformDistYear;
  const warrantyDist = warrantyPeriod === 'all' ? warrantyDistAll : warrantyDistYear;
  const reasonDist = warrantyPeriod === 'all' ? reasonDistAll : reasonDistYear;
  const returnProvItems = returnProvPeriod === 'all' ? returnProvinceDist : returnProvinceYearDist;
  const returnProvMax = Math.max(...returnProvItems.map(d => d.count || 0), 1);
  const returnModelDist = returnModelPeriod === 'all' ? returnModelDistAll : returnModelDistYear;
  const returnBrandDist = returnBrandPeriod === 'all' ? returnBrandDistAll : returnBrandDistYear;
  const returnPlatDist = returnPlatPeriod === 'all' ? returnPlatformDistAll : returnPlatformDistYear;
  const returnReasonDist = returnReasonPeriod === 'all' ? returnReasonDistAll : returnReasonDistYear;
  const returnTrend = returnTrendPeriod === 'all' ? returnTrendAll : returnTrendYear;
  const curYear = String(new Date().getFullYear());
  const provYearLabel = (provinceYears.includes(curYear) ? curYear : provinceYears[provinceYears.length - 1]) || 'all';

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 16,
  };
  const boardGrid = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
    gap: 14,
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* 顶部信息条 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>控制台</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#999' }}>
          {lastUpdate && <span>更新于 {lastUpdate.toLocaleTimeString('zh-CN', { hour12: false })}</span>}
          <button
            onClick={() => { setLoading(true); fetchStats(); }}
            disabled={loading}
            style={{ padding: '4px 12px', border: '1px solid #1976d2', color: '#1976d2', borderRadius: 4, background: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: 12 }}
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* KPI 卡片区 */}
      <div style={gridStyle}>
        <KPICard
          label="维修单总数"
          value={kpi.maintenanceTotal}
          sub={<span style={{ fontSize: 12 }}>待处理 <b style={{ color: kpi.pendingCount > 0 ? '#f44336' : '#4caf50' }}>{kpi.pendingCount}</b> · 维修中 <b style={{ color: kpi.processingCount > 0 ? '#ff9800' : '#4caf50' }}>{kpi.processingCount}</b> · 已完成 {kpi.doneCount}</span>}
          icon="🔧"
        />
        <KPICard
          label="本月新增维修"
          value={kpi.monthRepairCount}
          sub={
            <span>
              上月 {kpi.prevMonthRepairCount}
              {kpi.repairGrowth !== 0 && <span style={{ color: growthColor, marginLeft: 4 }}>{growthArrow} {Math.abs(kpi.repairGrowth)}%</span>}
            </span>
          }
          accent={kpi.pendingCount > 0 ? '#1976d2' : '#333'}
          icon="📅"
        />
        <KPICard
          label="本月退货订单"
          value={kpi.monthReturns}
          sub={kpi.monthReturnAmount != null ? `退款 ${formatAmount(kpi.monthReturnAmount)}（上月 ${kpi.prevMonthReturns}）` : ''}
          icon="📦"
        />
        <KPICard
          label="本年总退款"
          value={formatAmount(kpi.yearRefundAmount)}
          sub={`共 ${kpi.yearReturnTotal} 单`}
          icon="💰"
        />
        <KPICard
          label="本年退款运费"
          value={formatAmount(kpi.yearShippingRefund)}
          sub={kpi.yearShippingRefund != null ? '退货结算运费合计' : ''}
          icon="🚚"
        />
        <KPICard
          label="产品规模"
          value={kpi.productTotal}
          sub={`${kpi.brandCount} 个品牌`}
          icon="📋"
        />
      </div>

      {/* 看板区：退货居左、维修居右，按行配对等高 */}
      <div style={boardGrid}>
        {/* 退货原因 */}
        <BoardCard title="退货原因" column="left" isMobile={isMobile} filter={returnReasonPeriod} onFilterChange={setReturnReasonPeriod}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Donut data={returnReasonDist} colors={PALETTE} size={isMobile ? 110 : 130} thickness={isMobile ? 14 : 18} />
          </div>
        </BoardCard>

        {/* 维修状态 */}
        <BoardCard title="维修状态" column="right" isMobile={isMobile} filter={statusPeriod} onFilterChange={setStatusPeriod}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Donut data={statusDist} colors={statusDist.map(d => STATUS_COLORS[d.name] || '#999')} size={isMobile ? 110 : 130} thickness={isMobile ? 14 : 18} />
          </div>
        </BoardCard>

        {/* 退货省份 TOP10 */}
        <BoardCard title="退货省份 TOP10" column="left" isMobile={isMobile} filter={returnProvPeriod} onFilterChange={setReturnProvPeriod}>
          <HBar items={returnProvItems} barColor="#9c27b0" maxCount={returnProvMax} />
        </BoardCard>

        {/* 维修省份 TOP10（全部/本年） */}
        <BoardCard
          title="维修省份 TOP10"
          column="right"
          isMobile={isMobile}
          filter={provinceYear === 'all' ? 'all' : 'year'}
          onFilterChange={p => setProvinceYear(p === 'all' ? 'all' : provYearLabel)}
        >
          <HBar items={provItems} barColor="#1976d2" maxCount={provMax} />
        </BoardCard>

        {/* 退货型号 TOP */}
        <BoardCard title="退货型号 TOP" column="left" isMobile={isMobile} filter={returnModelPeriod} onFilterChange={setReturnModelPeriod}>
          <HBar items={returnModelDist} barColor="#00bcd4" />
        </BoardCard>

        {/* 维修型号 TOP */}
        <BoardCard title="维修型号 TOP" column="right" isMobile={isMobile} filter={modelPeriod} onFilterChange={setModelPeriod}>
          <HBar items={modelTop} barColor="#1976d2" />
        </BoardCard>

        {/* 退货平台 TOP */}
        <BoardCard title="退货平台 TOP" column="left" isMobile={isMobile} filter={returnPlatPeriod} onFilterChange={setReturnPlatPeriod}>
          <HBar items={returnPlatDist} barColor="#f44336" />
        </BoardCard>

        {/* 维修来源平台 */}
        <BoardCard title="维修来源平台" column="right" isMobile={isMobile} filter={platformPeriod} onFilterChange={setPlatformPeriod}>
          <HBar items={platformDist} barColor="#ff9800" />
        </BoardCard>

        {/* 退货品牌分布 */}
        {returnBrandDist.length > 0 && (
          <BoardCard title="退货品牌分布" column="left" isMobile={isMobile} filter={returnBrandPeriod} onFilterChange={setReturnBrandPeriod}>
            <HBar items={returnBrandDist.map(it => ({ name: it.name, count: it.count }))} barColor="#795548" />
            <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
              {returnBrandDist.map(it => (
                <span key={it.name} style={{ marginRight: 12 }}>{it.name}: {formatAmount(it.amount)}</span>
              ))}
            </div>
          </BoardCard>
        )}

        {/* 保修状态 + 维修类型 */}
        <BoardCard title="维修与保修类型" column="right" isMobile={isMobile} filter={warrantyPeriod} onFilterChange={setWarrantyPeriod}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>保修状态</div>
            <HBar items={warrantyDist} barColor="#4caf50" />
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>维修类型</div>
            <HBar items={reasonDist} barColor="#9c27b0" />
          </div>
        </BoardCard>

        {/* 近12个月退货趋势 */}
        <BoardCard title={returnTrendPeriod === 'all' ? '近12个月退货趋势' : '本年退货趋势'} column="left" isMobile={isMobile} filter={returnTrendPeriod} onFilterChange={setReturnTrendPeriod}>
          {returnTrend.some(d => d.count > 0)
            ? <TrendChart data={returnTrend} isMobile={isMobile} />
            : <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 20 }}>暂无数据</div>
          }
        </BoardCard>

        {/* 维修趋势 */}
        <BoardCard title={trendPeriod === 'all' ? '近12个月维修趋势' : '本年维修趋势'} column="right" isMobile={isMobile} filter={trendPeriod} onFilterChange={setTrendPeriod}>
          {trend.some(d => d.count > 0)
            ? <TrendChart data={trend} isMobile={isMobile} />
            : <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 20 }}>暂无数据</div>
          }
        </BoardCard>
      </div>
    </div>
  );
}

export default DashboardStats;