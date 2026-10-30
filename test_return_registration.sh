#!/bin/bash

# 测试账号
PHONE="13800138000"
PASSWORD="Test123456"
BASE_URL="https://emigrated.i234.me:3443"

echo "========================================"
echo "🧪 开始测试退货登记功能"
echo "========================================"
echo ""

# 1. 登录
echo "📝 步骤 1: 登录..."
LOGIN_RESPONSE=$(curl -s -k -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"${PHONE}\",
    \"password\": \"${PASSWORD}\"
  }")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败！"
  echo "响应：$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ 登录成功！"
echo ""

# 2. 创建退货登记
# 生成随机订单号
RANDOM_ID=$((RANDOM % 10000))
echo "📝 步骤 2: 创建退货登记 (订单号：TEST${RANDOM_ID})..."
REGISTER_RESPONSE=$(curl -s -k -X POST "${BASE_URL}/api/customer" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"订单编号\": \"TEST${RANDOM_ID}\",
    \"客户信息\": \"测试客户-${RANDOM_ID}\",
    \"购买日期\": \"2026-04-30\",
    \"品牌\": \"测试品牌\",
    \"型号\": \"M1\",
    \"类型\": \"打窝船\",
    \"颜色\": \"红色\",
    \"规格\": \"标准版\",
    \"原因\": \"质量问题\",
    \"状态\": \"未使用\",
    \"快递\": \"顺丰\",
    \"单号\": \"SF${RANDOM_ID}\",
    \"备注\": \"自动化测试\",
    \"价格\": \"100\",
    \"仓库\": \"汕尾仓\",
    \"平台\": \"淘宝\",
    \"运费\": \"10\",
    \"登记人\": \"测试管理员\",
    \"购买件数\": \"1\",
    \"退货件数\": \"1\",
    \"结算\": \"0\"
  }")

echo "响应：$REGISTER_RESPONSE"

# 检查是否成功
if echo "$REGISTER_RESPONSE" | grep -q '"message":"退货登记成功"'; then
  echo "✅ 退货登记成功！"
  CUSTOMER_ID=$(echo $REGISTER_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)
  echo "📦 客户记录 ID: $CUSTOMER_ID"
else
  echo "❌ 退货登记失败！"
  exit 1
fi

echo ""
echo "========================================"
echo "✅ 所有测试通过！"
echo "========================================"
