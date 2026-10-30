// Lightweight payload validator and normalizer for product_data create route

function validateProductPayload(payload, pool) {
  const data = payload || {};
  const brandRaw = (typeof data.brand === 'string') ? data.brand.trim() : '';
  if (!brandRaw) {
    throw new Error('品牌不能为空');
  }

  const modelVal = (typeof data.model === 'string' && data.model.trim() !== '') ? data.model.trim() : null;
  const typeVal = (typeof data.type === 'string' && data.type.trim() !== '') ? data.type.trim() : null;
  const colorVal = (typeof data.color === 'string' && data.color.trim() !== '') ? data.color.trim() : null;
  const specVal = (typeof data.spec === 'string' && data.spec.trim() !== '') ? data.spec.trim() : null;
  const priceRaw = data.price;
  if (priceRaw === undefined || priceRaw === null || priceRaw === '') {
    throw new Error('价格不能为空');
  }
  const priceNum = Number(priceRaw);
  if (Number.isNaN(priceNum) || !Number.isFinite(priceNum)) {
    throw new Error('价格无效');
  }

  return {
    brand: brandRaw,
    model: modelVal,
    type: typeVal,
    color: colorVal,
    spec: specVal,
    price: priceNum
  };
}

async function checkDuplicate(pool, brand, model, type, color, spec) {
  const [rows] = await pool.execute(
    'SELECT id FROM product_data WHERE brand = ? AND model = ? AND type = ? AND color = ? AND spec = ?',
    [brand, model || null, type || null, color || null, spec || null]
  );
  if (rows.length > 0) {
    throw new Error('数据已存在，请勿重复录入');
  }
}

module.exports = { validateProductPayload, checkDuplicate };
