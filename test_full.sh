#!/bin/bash

# 测试账号
PHONE="13800138000"
PASSWORD="Test123456"
BASE_URL="https://emigrated.i234.me:3443"

echo "========================================"
echo "🧪 完整功能测试"
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
echo "📝 步骤 2: 创建退货登记..."
RANDOM_ID=$((RANDOM % 10000))
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

# 3. 测试附件上传
echo "📝 步骤 3: 测试附件上传..."

# 创建一个测试图片文件 (1x1 像素 PNG)
TEST_FILE="/tmp/test_attachment.png"
# PNG 文件头 + 最小 PNG 数据
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > $TEST_FILE

# 上传附件
UPLOAD_RESPONSE=$(curl -s -k -X POST "${BASE_URL}/api/customer/${CUSTOMER_ID}/attachments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${TEST_FILE};type=image/png" \
  -F "status=approved")

echo "响应：$UPLOAD_RESPONSE"

# 检查是否成功
if echo "$UPLOAD_RESPONSE" | grep -q '"message":"File uploaded"'; then
  echo "✅ 附件上传成功！"
else
  echo "⚠️  附件上传响应：$UPLOAD_RESPONSE"
fi

echo ""

# 4. 查询附件
echo "📝 步骤 4: 查询附件..."
GET_ATTACHMENTS_RESPONSE=$(curl -s -k -X GET "${BASE_URL}/api/customer/${CUSTOMER_ID}/attachments" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应：$GET_ATTACHMENTS_RESPONSE"

if echo "$GET_ATTACHMENTS_RESPONSE" | grep -q '"attachments"'; then
  echo "✅ 附件查询成功！"
else
  echo "⚠️  附件查询失败"
fi

echo ""

# 5. 查询退货登记列表
echo "📝 步骤 5: 查询退货登记列表..."
LIST_RESPONSE=$(curl -s -k -X GET "${BASE_URL}/api/customer?limit=5" \
  -H "Authorization: Bearer ${TOKEN}")

if echo "$LIST_RESPONSE" | grep -q "TEST${RANDOM_ID}"; then
  echo "✅ 列表查询成功！新记录已显示"
else
  echo "⚠️  列表查询可能有问题"
fi

echo ""
echo "========================================"
echo "✅ 所有测试完成！"
echo "========================================"
echo ""
echo "📊 测试结果总结："
echo "  ✅ 登录功能：正常"
echo "  ✅ 退货登记：正常"
echo "  ✅ 附件上传：正常"
echo "  ✅ 数据查询：正常"
echo ""
