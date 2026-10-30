#!/bin/bash

echo "=== 修复数据库字段错误 ==="
echo ""
echo "问题：后端代码查询 u.username，但 users 表没有 username 字段"
echo "解决方案：将 SQL 查询中的 u.username 改为 u.name"
echo ""

# 检查数据库连接
echo "检查数据库连接..."
docker exec ledo-db mysql -uroot -proot -e "SELECT 1;" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ 数据库连接失败!"
    exit 1
fi

echo "✅ 数据库连接正常"
echo ""

# 查看当前 users 表结构
echo "当前 users 表结构:"
docker exec ledo-db mysql -uroot -proot kaifazhe -e "DESCRIBE users;" 2>&1 | grep -v "mysql:"
echo ""

# 修复方案
echo "💡 修复建议:"
echo "1. 修改后端代码，将 records.js 中的 'u.username' 改为 'u.name'"
echo "2. 或者在 users 表中添加 username 字段 (不推荐，因为已经有 name 字段)"
echo ""

# 检查后端代码
echo "检查后端 records.js 文件..."
if [ -f "/Users/laijiehong/Downloads/ledo/backend/src/routes/records.js" ]; then
    echo "找到 records.js 文件"
    echo ""
    echo "查找包含 'username' 的行:"
    grep -n "username" /Users/laijiehong/Downloads/ledo/backend/src/routes/records.js
    echo ""
else
    echo "❌ 未找到后端代码文件"
fi

echo "=== 检查完成 ==="
