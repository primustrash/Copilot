const test = require('node:test');
const assert = require('node:assert/strict');

process.env.LOG_FILE = '/tmp/aion-mcp-phase2-logs.log';
process.env.AUDIT_LOG_FILE = '/tmp/aion-mcp-phase2-audit.log';
delete process.env.MCP_ADMIN_BROADCAST_TOKEN;

const { createServer } = require('../dist/server');
const { addApiKey, removeApiKey } = require('../dist/auth/apikey');

async function withServer(run) {
  const app = createServer();
  const server = await new Promise(resolve => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
  });
  try {
    const { port } = server.address();
    await run('http://127.0.0.1:' + port);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('Admin broadcast requires primary authentication even if secondary token is supplied', async () => {
  await withServer(async base => {
    const resp = await fetch(base + '/admin/broadcast', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-broadcast-token': 'attacker' },
      body: JSON.stringify({event: 'operator_notice', data: 'hello'}),
    });
    assert.equal(resp.status, 401);
    assert.equal((await resp.json()).code, 'UNAUTHORIZED');
  });
});

test('Broadcast is fail closed with primary API key when secondary credential is absent', async () => {
  const key = 'phase2-http-api-key-only';
  addApiKey(key);
  try {
    await withServer(async base => {
      const resp = await fetch(base + '/admin/broadcast', {
        method: 'POST',
        headers: {'content-type':'application/json','x-api-key':key},
        body: JSON.stringify({event: 'operator_notice', data: 'hello'}),
      });
      assert.equal(resp.status, 503);
    });
  } finally { removeApiKey(key); }
});

test('Authenticated tool-call error response does not echo secret payloads', async () => {
  const key = 'phase2-router-api-key';
  const secret = 'SENSITIVE_PHASE2_AUTH_TOKEN_SHOULD_NEVER_ECHO';
  addApiKey(key);
  try {
    await withServer(async base => {
      const resp = await fetch(base + '/mcp/tools/call', {
        method: 'POST',
        headers: {'content-type':'application/json','x-api-key':key},
        body: JSON.stringify({tool: 'nonexistent.tool', input: {secret}}),
      });
      assert.equal(resp.status, 400);
      const response = await resp.text();
      assert.equal(response.includes(secret), false);
      assert.equal(JSON.parse(response).code, 'TOOL_REQUEST_FAILED');
    });
  } finally { removeApiKey(key); }
});
