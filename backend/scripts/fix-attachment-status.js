/**
 * 一次性修复脚本：将新登记（非修改）的附件状态从 pending 改为 approved
 * 
 * 逻辑：
 * - 对每个 status='pending' 的附件，检查所属维修记录是否有修改申请（change_request）
 * - 如果没有任何修改申请 → 该附件来自新登记 → 改为 approved
 * - 如果有修改申请 → 可能是修改时上传的 → 保持 pending
 *
 * 运行方式（在 backend 容器或本地搭建好 DB 连接后）：
 *   node scripts/fix-attachment-status.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function fix() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'registration_db',
    charset: 'utf8mb4',
    timezone: '+08:00'
  });

  console.log('已连接数据库');

  // 查找所有 status='pending' 的附件及其所属记录的 change_request 情况
  const [pendingAttachments] = await connection.query(`
    SELECT ma.id, ma.maintenance_id, ma.original_name, ma.uploaded_at
    FROM maintenance_attachments ma
    WHERE ma.status = 'pending'
    ORDER BY ma.maintenance_id, ma.uploaded_at
  `);

  console.log(`找到 ${pendingAttachments.length} 个 pending 附件`);

  // 获取所有有 change_request 的 maintenance_id
  const [recordsWithCR] = await connection.query(`
    SELECT DISTINCT maintenance_id FROM maintenance_change_requests
  `);
  const crMaintenanceIds = new Set(recordsWithCR.map(r => r.maintenance_id));

  console.log(`有修改申请的记录数: ${crMaintenanceIds.size}`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const att of pendingAttachments) {
    if (crMaintenanceIds.has(att.maintenance_id)) {
      // 这条记录有修改申请 → 附件可能来自修改 → 跳过
      skippedCount++;
      console.log(`  跳过: 附件 #${att.id} (${att.original_name}) - 记录 ${att.maintenance_id} 存在修改申请`);
    } else {
      // 没有修改申请 → 附件来自新登记 → 改为 approved
      await connection.query(
        'UPDATE maintenance_attachments SET status = ? WHERE id = ?',
        ['approved', att.id]
      );
      updatedCount++;
      console.log(`  修复: 附件 #${att.id} (${att.original_name}) - 记录 ${att.maintenance_id} → approved`);
    }
  }

  console.log(`\n完成！更新: ${updatedCount}, 跳过(有修改申请): ${skippedCount}`);

  await connection.end();
}

fix().catch(err => {
  console.error('修复失败:', err);
  process.exit(1);
});
