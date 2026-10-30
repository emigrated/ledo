const express = require("express");
const router = express.Router();
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// 仪表盘聚合统计：一次返回控制台所需的全部看板数据
// 每张统计卡片均支持「全部 / 本年」双数据集
router.get('/stats', async (req, res) => {
  try {
    const monthStart = "DATE_FORMAT(CURDATE(), '%Y-%m-01')";
    const prevMonthStart = "DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')";

    const [
      [statusRows], [provinceRows], [platformRows], [trendRows],
      [monthRepairRows],
      [reasonRows], [warrantyRows], [modelTopRows],
      [yearReturnRows], [monthReturnRows], [prevMonthReturnRows], [returnBrandRows],
      [productRows],
      [yearShippingRefundRows],
      [returnDetailRows], [returnModelRows], [returnPlatformRows], [returnReasonRows], [returnTrendRows]
    ] = await Promise.all([
      pool.query("SELECT status, YEAR(created_at) AS y, COUNT(*) c FROM maintenance WHERE status != '预登记' GROUP BY status, y"),
      pool.query("SELECT YEAR(created_at) AS y, province AS name, COUNT(*) c FROM maintenance WHERE status != '预登记' AND province IS NOT NULL AND province != '' GROUP BY y, province"),
      pool.query("SELECT repair_platform, YEAR(created_at) AS y, COUNT(*) c FROM maintenance WHERE status != '预登记' AND repair_platform IS NOT NULL AND repair_platform != '' GROUP BY repair_platform, y"),
      pool.query(`SELECT DATE_FORMAT(created_at, '%Y-%m') ym, YEAR(created_at) AS y, COUNT(*) c FROM maintenance WHERE status != '预登记' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) GROUP BY ym, y ORDER BY ym`),
      pool.query(`SELECT DATE_FORMAT(created_at, '%Y-%m') ym, COUNT(*) c FROM maintenance WHERE status != '预登记' AND created_at >= ${prevMonthStart} GROUP BY ym ORDER BY ym`),
      pool.query("SELECT return_reason, YEAR(created_at) AS y, COUNT(*) c FROM maintenance WHERE status != '预登记' AND return_reason IS NOT NULL AND return_reason != '' GROUP BY return_reason, y"),
      pool.query("SELECT warranty_status, YEAR(created_at) AS y, COUNT(*) c FROM maintenance WHERE status != '预登记' AND warranty_status IS NOT NULL AND warranty_status != '' GROUP BY warranty_status, y"),
      pool.query("SELECT model, YEAR(created_at) AS y, COUNT(*) c FROM maintenance WHERE status != '预登记' GROUP BY model, y"),
      pool.query(`SELECT COUNT(*) total, COALESCE(SUM(价格), 0) amount FROM customer WHERE 创建时间 >= DATE_FORMAT(CURDATE(), '%Y-01-01')`),
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(价格), 0) amount FROM customer WHERE 创建时间 >= ${monthStart}`),
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(价格), 0) amount FROM customer WHERE 创建时间 >= ${prevMonthStart} AND 创建时间 < ${monthStart}`),
      pool.query('SELECT 品牌, YEAR(创建时间) AS y, COUNT(*) c, COALESCE(SUM(价格), 0) amt FROM customer GROUP BY 品牌, y ORDER BY c DESC'),
      pool.query('SELECT COUNT(*) total, COUNT(DISTINCT brand) brands FROM product_data'),
      pool.query(`SELECT COALESCE(SUM(结算金额), 0) amount FROM customer WHERE 结算金额 IS NOT NULL AND 创建时间 >= DATE_FORMAT(CURDATE(), '%Y-01-01')`),
      pool.query("SELECT 客户信息, 创建时间 FROM customer WHERE 客户信息 IS NOT NULL AND 客户信息 != ''"),
      pool.query("SELECT 型号, YEAR(创建时间) AS y, COUNT(*) c FROM customer WHERE 型号 IS NOT NULL AND 型号 != '' GROUP BY 型号, y ORDER BY c DESC"),
      pool.query("SELECT 平台, YEAR(创建时间) AS y, COUNT(*) c FROM customer WHERE 平台 IS NOT NULL AND 平台 != '' GROUP BY 平台, y ORDER BY c DESC"),
      pool.query("SELECT 原因, YEAR(创建时间) AS y, COUNT(*) c FROM customer WHERE 原因 IS NOT NULL AND 原因 != '' GROUP BY 原因, y ORDER BY c DESC"),
      pool.query(`SELECT DATE_FORMAT(创建时间, '%Y-%m') ym, YEAR(创建时间) AS y, COUNT(*) c FROM customer WHERE 创建时间 >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) GROUP BY ym, y ORDER BY ym`)
    ]);

    const curYear = String(new Date().getFullYear());

    // 通用聚合：按名称聚合出「全部」和「本年」两组
    const splitAllYear = (rows, nameKey) => {
      const all = {};
      const year = {};
      rows.forEach(r => {
        const n = r[nameKey] || '未知';
        all[n] = (all[n] || 0) + r.c;
        if (String(r.y) === curYear) year[n] = (year[n] || 0) + r.c;
      });
      return { all, year };
    };
    const sortTop = (map, limit) => Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const statusMap = {};
    statusRows.forEach(r => { statusMap[r.status] = (statusMap[r.status] || 0) + r.c; });
    const maintenanceTotal = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const statusOrder = ['待处理', '维修中', '已完成', '已退回'];
    const statusAll = splitAllYear(statusRows, 'status');
    const statusDistAll = statusOrder.filter(s => statusAll.all[s]).map(s => ({ name: s, count: statusAll.all[s] }));
    const statusDistYear = statusOrder.filter(s => statusAll.year[s]).map(s => ({ name: s, count: statusAll.year[s] }));

    const monthRepair = {};
    monthRepairRows.forEach(r => { monthRepair[r.ym] = r.c; });
    const fmtYm = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const curYm = fmtYm(new Date());
    const prevYm = fmtYm(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
    const monthRepairCount = monthRepair[curYm] || 0;
    const prevMonthRepairCount = monthRepair[prevYm] || 0;
    const repairGrowth = prevMonthRepairCount > 0 ? (monthRepairCount - prevMonthRepairCount) / prevMonthRepairCount : (monthRepairCount > 0 ? 1 : 0);

    // 维修趋势：全部 = 近12个月；本年 = 当年1月起至本月
    const monthSet = new Set(trendRows.map(r => r.ym));
    const trendAll = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trendAll.push({ ym, count: monthSet.has(ym) ? trendRows.find(r => r.ym === ym).c : 0 });
    }
    const yearMonthSet = new Set(trendRows.filter(r => String(r.y) === curYear).map(r => r.ym));
    const trendYear = [];
    for (let m = 1; m <= now.getMonth() + 1; m++) {
      const ym = `${now.getFullYear()}-${String(m).padStart(2, '0')}`;
      trendYear.push({ ym, count: yearMonthSet.has(ym) ? trendRows.find(r => r.ym === ym).c : 0 });
    }

    // 维修省份（按年多档）
    const provAll = {};
    const provByYear = {};
    provinceRows.forEach(r => {
      const name = r.name || '未知';
      provAll[name] = (provAll[name] || 0) + r.c;
      if (r.y) {
        const y = String(r.y);
        provByYear[y] = provByYear[y] || {};
        provByYear[y][name] = (provByYear[y][name] || 0) + r.c;
      }
    });
    const provinceYears = Object.keys(provByYear).sort();
    const provinceDist = sortTop(provAll, 10);
    const provinceYearDist = {};
    provinceYears.forEach(y => { provinceYearDist[y] = sortTop(provByYear[y], 10); });

    const platformSplit = splitAllYear(platformRows, 'repair_platform');
    const platformDistAll = sortTop(platformSplit.all, 10);
    const platformDistYear = sortTop(platformSplit.year, 10);

    const modelSplit = splitAllYear(modelTopRows, 'model');
    const modelTopAll = sortTop(modelSplit.all, 6);
    const modelTopYear = sortTop(modelSplit.year, 6);

    const reasonSplit = splitAllYear(reasonRows, 'return_reason');
    const reasonDistAll = sortTop(reasonSplit.all, 10);
    const reasonDistYear = sortTop(reasonSplit.year, 10);

    const warrantySplit = splitAllYear(warrantyRows, 'warranty_status');
    const warrantyDistAll = sortTop(warrantySplit.all, 10);
    const warrantyDistYear = sortTop(warrantySplit.year, 10);

    const warrantyTotalAll = warrantyDistAll.reduce((a, r) => a + r.count, 0);

    // 退货省份：从「客户信息」文本解析省市
    const PROVINCE_MAP = [
      ['北京市'], ['天津市'], ['上海市'], ['重庆市'],
      ['黑龙江省', '黑龙江'], ['内蒙古自治区', '内蒙古'], ['广西壮族自治区', '广西'], ['西藏自治区', '西藏'],
      ['宁夏回族自治区', '宁夏'], ['新疆维吾尔自治区', '新疆'],
      ['河北省', '河北'], ['山西省', '山西'], ['辽宁省', '辽宁'], ['吉林省', '吉林'], ['江苏省', '江苏'],
      ['浙江省', '浙江'], ['安徽省', '安徽'], ['福建省', '福建'], ['江西省', '江西'], ['山东省', '山东'],
      ['河南省', '河南'], ['湖北省', '湖北'], ['湖南省', '湖南'], ['广东省', '广东'], ['海南省', '海南'],
      ['四川省', '四川'], ['贵州省', '贵州'], ['云南省', '云南'], ['陕西省', '陕西'], ['甘肃省', '甘肃'],
      ['青海省', '青海'], ['台湾省', '台湾'], ['香港特别行政区', '香港'], ['澳门特别行政区', '澳门']
    ];
    const matchProvince = (text) => {
      if (!text) return '未知';
      const hits = [];
      PROVINCE_MAP.forEach(([full, ...short]) => {
        const variants = [full, ...short];
        variants.forEach(v => {
          const idx = text.indexOf(v);
          if (idx !== -1) hits.push({ idx, name: full });
        });
      });
      if (!hits.length) return '未知';
      hits.sort((a, b) => a.idx - b.idx || b.name.length - a.name.length);
      return hits[0].name;
    };
    const returnProvAll = {};
    const returnProvYear = {};
    returnDetailRows.forEach(r => {
      const p = matchProvince(r['客户信息']);
      returnProvAll[p] = (returnProvAll[p] || 0) + 1;
      const y = r['创建时间'] ? String(new Date(r['创建时间']).getFullYear()) : '';
      if (y === curYear) returnProvYear[p] = (returnProvYear[p] || 0) + 1;
    });
    const returnProvinceDist = sortTop(returnProvAll, 10);
    const returnProvinceYearDist = sortTop(returnProvYear, 10);

    const returnBrandAll = {};
    const returnBrandYear = {};
    const returnBrandAmtAll = {};
    const returnBrandAmtYear = {};
    returnBrandRows.forEach(r => {
      const n = r['品牌'] || '未知';
      returnBrandAll[n] = (returnBrandAll[n] || 0) + r.c;
      returnBrandAmtAll[n] = (returnBrandAmtAll[n] || 0) + Number(r.amt || 0);
      if (String(r.y) === curYear) {
        returnBrandYear[n] = (returnBrandYear[n] || 0) + r.c;
        returnBrandAmtYear[n] = (returnBrandAmtYear[n] || 0) + Number(r.amt || 0);
      }
    });
    const brandToArr = (cntMap, amtMap, limit) => Object.entries(cntMap)
      .map(([name, count]) => ({ name, count, amount: Number(amtMap[name] || 0) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    const returnBrandDistAll = brandToArr(returnBrandAll, returnBrandAmtAll, 10);
    const returnBrandDistYear = brandToArr(returnBrandYear, returnBrandAmtYear, 10);

    const returnModelSplit = splitAllYear(returnModelRows, '型号');
    const returnModelDistAll = sortTop(returnModelSplit.all, 10);
    const returnModelDistYear = sortTop(returnModelSplit.year, 10);

    const returnPlatformSplit = splitAllYear(returnPlatformRows, '平台');
    const returnPlatformDistAll = sortTop(returnPlatformSplit.all, 10);
    const returnPlatformDistYear = sortTop(returnPlatformSplit.year, 10);

    const returnReasonSplit = splitAllYear(returnReasonRows, '原因');
    const returnReasonDistAll = sortTop(returnReasonSplit.all, 10);
    const returnReasonDistYear = sortTop(returnReasonSplit.year, 10);

    // 退货趋势：全部 = 近12个月；本年 = 当年1月起至本月
    const returnMonthSet = new Set(returnTrendRows.map(r => r.ym));
    const returnTrendAll = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      returnTrendAll.push({ ym, count: returnMonthSet.has(ym) ? returnTrendRows.find(r => r.ym === ym).c : 0 });
    }
    const returnYearMonthSet = new Set(returnTrendRows.filter(r => String(r.y) === curYear).map(r => r.ym));
    const returnTrendYear = [];
    for (let m = 1; m <= now.getMonth() + 1; m++) {
      const ym = `${now.getFullYear()}-${String(m).padStart(2, '0')}`;
      returnTrendYear.push({ ym, count: returnYearMonthSet.has(ym) ? returnTrendRows.find(r => r.ym === ym).c : 0 });
    }

    res.json({
      kpi: {
        maintenanceTotal,
        pendingCount: statusMap['待处理'] || 0,
        processingCount: statusMap['维修中'] || 0,
        doneCount: statusMap['已完成'] || 0,
        monthRepairCount,
        prevMonthRepairCount,
        repairGrowth: Math.round(repairGrowth * 100),
        monthReturns: monthReturnRows[0].c || 0,
        monthReturnAmount: Number(monthReturnRows[0].amount || 0),
        prevMonthReturns: prevMonthReturnRows[0].c || 0,
        prevMonthReturnAmount: Number(prevMonthReturnRows[0].amount || 0),
        yearReturnTotal: yearReturnRows[0].total || 0,
        yearRefundAmount: Number(yearReturnRows[0].amount || 0),
        yearShippingRefund: Number(yearShippingRefundRows[0].amount || 0),
        productTotal: productRows[0].total || 0,
        brandCount: productRows[0].brands || 0,
        outWarrantyCount: warrantyDistAll.find(r => r.name === '已过质保期')?.count || 0,
        warrantyTotal: warrantyTotalAll
      },
      statusDistAll,
      statusDistYear,
      provinceDist,
      provinceYearDist,
      provinceYears,
      platformDistAll,
      platformDistYear,
      trendAll,
      trendYear,
      modelTopAll,
      modelTopYear,
      reasonDistAll,
      reasonDistYear,
      warrantyDistAll,
      warrantyDistYear,
      returnBrandDistAll,
      returnBrandDistYear,
      returnProvinceDist,
      returnProvinceYearDist,
      returnModelDistAll,
      returnModelDistYear,
      returnPlatformDistAll,
      returnPlatformDistYear,
      returnReasonDistAll,
      returnReasonDistYear,
      returnTrendAll,
      returnTrendYear
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;