// 输入验证工具函数

// 订单编号、单号：只允许字母和数字
export function validateOrderNo(value) {
  return /^[a-zA-Z0-9]*$/.test(value);
}

// 电话号码：只能11位数字
export function validatePhone(value) {
  return /^\d{11}$/.test(value);
}

// 身份证：18位数字，最后一位可以是字母X
export function validateIdCard(value) {
  return /^\d{17}[\dXx]$/.test(value);
}

// 格式化订单编号为字母数字
export function formatOrderNo(value) {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}

// 格式化电话号码为纯数字
export function formatPhone(value) {
  return value.replace(/\D/g, '').slice(0, 11);
}

// 格式化身份证（保留数字和X）
export function formatIdCard(value) {
  return value.replace(/[^0-9Xx]/g, '').slice(0, 18);
}

// 获取验证错误信息
export function getValidationError(field, value) {
  switch (field) {
    case '订单编号':
    case '单号':
    case '返厂单号':
    case '寄回单号':
      if (value && !validateOrderNo(value)) {
        return '只能输入字母和数字';
      }
      break;
    case '电话号码':
    case 'phone':
      if (value && !validatePhone(value)) {
        return '请输入11位数字';
      }
      break;
    case '身份证':
    case 'id_card':
    case '身份证号码':
      if (value && !validateIdCard(value)) {
        return '请输入18位身份证号码（最后一位可以是X）';
      }
      break;
    default:
      return null;
  }
  return null;
}