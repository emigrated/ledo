#!/bin/bash

# 测试账号
PHONE="13800138000"
PASSWORD="Test123456"
BASE_URL="https://emigrated.i234.me:3443"

echo "========================================"
echo "🧪 维修登记测试"
echo "========================================"
echo ""

# 1. 登录
echo "📝 步骤 1: 登录..."
LOGIN_RESPONSE=$(curl -s -k -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${PHONE}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败！"
  echo "响应：$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ 登录成功！"
echo ""

# 2. 创建维修记录 1
echo "📝 步骤 2: 创建维修记录 1 (待处理)..."
RESPONSE1=$(curl -s -k -X POST "${BASE_URL}/api/maintenance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "省份": "广东省",
    "城市": "深圳市",
    "区县": "南山区",
    "详细地址": "科技园南路88号",
    "联系人": "张三",
    "联系电话": "13900139001",
    "品牌": "乐鼎",
    "型号": "M1 Pro",
    "类型": "打窝船",
    "颜色": "红色",
    "电池要求": "锂电池",
    "设备条码": "SN20260501001",
    "购买日期": "2026-04-15",
    "购买平台": "淘宝",
    "订单编号": "TB20260415001",
    "保修状态": "保修期内",
    "返厂原因": "无法开机",
    "故障描述": "设备无法开机，按下电源键无反应",
    "返厂快递": "顺丰",
    "返厂单号": "SF1234567890001",
    "登记人": "测试管理员",
    "状态": "待处理",
    "报修平台": "淘宝",
    "操作人": "测试管理员"
  }')

echo "响应：$RESPONSE1"
if echo "$RESPONSE1" | grep -q '"id"'; then
  echo "✅ 维修记录 1 创建成功！"
else
  echo "❌ 维修记录 1 创建失败！"
fi
echo ""

# 3. 创建维修记录 2
echo "📝 步骤 3: 创建维修记录 2 (维修中)..."
RESPONSE2=$(curl -s -k -X POST "${BASE_URL}/api/maintenance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "省份": "广东省",
    "城市": "广州市",
    "区县": "天河区",
    "详细地址": "天河路123号",
    "联系人": "李四",
    "联系电话": "13900139002",
    "品牌": "乐鼎",
    "型号": "S2",
    "类型": "探鱼器",
    "颜色": "黑色",
    "电池要求": "铅酸电池",
    "设备条码": "SN20260501002",
    "购买日期": "2026-03-20",
    "购买平台": "京东",
    "订单编号": "JD20260320002",
    "保修状态": "保修期内",
    "返厂原因": "屏幕花屏",
    "故障描述": "设备开机后屏幕显示异常，出现花屏现象",
    "返厂快递": "京东物流",
    "返厂单号": "JD9876543210002",
    "登记人": "测试管理员",
    "状态": "维修中",
    "报修平台": "京东",
    "操作人": "测试管理员"
  }')

echo "响应：$RESPONSE2"
if echo "$RESPONSE2" | grep -q '"id"'; then
  echo "✅ 维修记录 2 创建成功！"
else
  echo "❌ 维修记录 2 创建失败！"
fi
echo ""

# 4. 创建维修记录 3
echo "📝 步骤 4: 创建维修记录 3 (已完成)..."
RESPONSE3=$(curl -s -k -X POST "${BASE_URL}/api/maintenance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "省份": "广东省",
    "城市": "东莞市",
    "区县": "南城区",
    "详细地址": "鸿福路200号",
    "联系人": "王五",
    "联系电话": "13900139003",
    "品牌": "乐鼎",
    "型号": "X3",
    "类型": "路亚轮",
    "颜色": "银色",
    "电池要求": "无",
    "设备条码": "SN20260501003",
    "购买日期": "2026-02-10",
    "购买平台": "拼多多",
    "订单编号": "PDD20260210003",
    "保修状态": "保修期外",
    "返厂原因": "刹车失灵",
    "故障描述": "路亚轮刹车系统失效，无法正常刹车",
    "返厂快递": "中通",
    "返厂单号": "ZTO5566778800003",
    "登记人": "测试管理员",
    "状态": "已完成",
    "报修平台": "拼多多",
    "操作人": "测试管理员"
  }')

echo "响应：$RESPONSE3"
if echo "$RESPONSE3" | grep -q '"id"'; then
  echo "✅ 维修记录 3 创建成功！"
else
  echo "❌ 维修记录 3 创建失败！"
fi
echo ""

# 5. 查询所有维修记录
echo "📝 步骤 5: 查询所有维修记录..."
LIST_RESPONSE=$(curl -s -k -X GET "${BASE_URL}/api/maintenance" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应：$LIST_RESPONSE" | head -100
echo ""

TOTAL=$(echo "$LIST_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
echo "📊 总记录数：$TOTAL"
echo ""

echo "========================================"
echo "✅ 测试完成！"
echo "========================================"
