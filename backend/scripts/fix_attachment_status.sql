-- 修复已有数据：将新登记（无修改申请）的附件状态改为 approved
-- 
-- 逻辑：只更新那些没有关联 change_request 的附件
--       有修改申请的记录，附件保持 pending 不动
--
-- 在群晖上运行（SSH 进群晖后执行）：
--   docker exec -i ledo-db mysql -uroot -proot kaifazhe < backend/scripts/fix_attachment_status.sql

UPDATE maintenance_attachments ma
  JOIN (
    SELECT DISTINCT ma2.id
    FROM maintenance_attachments ma2
    LEFT JOIN maintenance_change_requests mcr ON ma2.maintenance_id = mcr.maintenance_id
    WHERE ma2.status = 'pending'
      AND mcr.id IS NULL
  ) AS to_approve ON ma.id = to_approve.id
SET ma.status = 'approved';

-- 输出更新的行数
SELECT ROW_COUNT() AS '已修复附件数';
