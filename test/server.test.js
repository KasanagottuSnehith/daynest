import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../server.js';

test('serves app assets, restricts private files, and returns useful HTTP errors', async t => {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/', '/index.html', '/app.js', '/model.js', '/styles.css', '/favicon.svg']) {
    const response = await fetch(base + route); assert.equal(response.status,200);
    assert.ok((await response.text()).length > 0); assert.ok(response.headers.get('content-security-policy'));
  }
  for (const route of ['/package.json','/.git/config','/README.md','/missing','/test/model.test.js']) assert.equal((await fetch(base+route)).status,404);
  assert.equal((await fetch(base,{method:'POST'})).status,405);
  const head = await fetch(base,{method:'HEAD'}); assert.equal(head.status,200); assert.equal(await head.text(),'');
});
