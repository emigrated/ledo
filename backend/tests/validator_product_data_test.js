// Lightweight unit tests for product_data validator
// Run: node backend/tests/validator_product_data_test.js
const assert = require('assert');
const { validateProductPayload } = require('../src/utils/product_data_validator');

function run() {
  // 1) valid payload
  try {
    const out = validateProductPayload({ brand: 'BrandA', model: 'M1', type: 'T', color: 'Red', price: 10, reason: 'r', status: 'active' });
    if (!out.brand || out.brand !== 'BrandA' || typeof out.price !== 'number') {
      console.error('Test 1 failed: invalid normalized output', out);
      process.exit(1);
    }
  } catch (e) {
    console.error('Test 1 failed with error:', e.message);
    process.exit(1);
  }

  // 2) missing brand -> should throw
  try {
    validateProductPayload({ model: 'M1', price: 5 });
    console.error('Test 2 failed: expected error for missing brand');
    process.exit(1);
  } catch (e) {
    if (e.message !== '品牌不能为空') {
      console.error('Test 2 failed: unexpected error message', e.message);
      process.exit(1);
    }
  }

  // 3) missing price -> should throw
  try {
    validateProductPayload({ brand: 'BrandA' });
    console.error('Test 3 failed: expected error for missing price');
    process.exit(1);
  } catch (e) {
    if (e.message !== '价格不能为空') {
      console.error('Test 3 failed: unexpected error message', e.message);
      process.exit(1);
    }
  }

  // 4) invalid price
  try {
    validateProductPayload({ brand: 'BrandA', price: 'abc' });
    console.error('Test 4 failed: expected error for invalid price');
    process.exit(1);
  } catch (e) {
    if (e.message !== '价格无效') {
      console.error('Test 4 failed: unexpected error message', e.message);
      process.exit(1);
    }
  }

  console.log('ALL TESTS PASSED');
}

run();
