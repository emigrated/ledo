const request = require('supertest');
const app = require('../server');
const assert = require('assert');

(async () => {
  let res = await request(app).get('/health');
  console.log('/health', res.status);
  assert.strictEqual(res.status, 200, 'health should be 200');

  res = await request(app).get('/api/waves');
  console.log('/api/waves', res.status);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body && res.body.waves, 'waves payload exists');

  res = await request(app).get('/api/wave/1');
  console.log('/api/wave/1', res.status);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body && (res.body.wave == '1' || res.body.wave === 1));

  res = await request(app).get('/api/evidence-map');
  console.log('/api/evidence-map', res.status);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body && typeof res.body === 'object');

  const resWave2Details = await request(app).get('/api/wave/2/details');
  console.log('/api/wave/2/details', resWave2Details.status);
  const resWave3Details = await request(app).get('/api/wave/3/details');
  console.log('/api/wave/3/details', resWave3Details.status);

  const resStart = await request(app).post('/api/start').send({wave:1, region:1});
  console.log('/api/start', resStart.status, resStart.body.runId);
  assert.strictEqual(resStart.status, 200);
  assert.ok(resStart.body && resStart.body.runId);
})();
