const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aion-mcp-e2e-'));
process.env.WORKSPACE_ROOT = root;
process.env.LOG_FILE = path.join(root, 'app.log');
process.env.AUDIT_LOG_FILE = path.join(root, 'audit.log');
process.env.MCP_TOOL_APPROVAL_SECRET = 'phase2-test-operator-hmac-secret-not-for-production-abcdefghijklmnopqrstuvwxyz';

const { signGrant } = require('../dist/utils/tool-grants');
const { createServer } = require('../dist/server');
const { addApiKey, removeApiKey } = require('../dist/auth/apikey');
const { getMCPToolList, executeTool } = require('../dist/registry');
require('../dist/tools/scoped-files');
const apiKey = 'phase2-scoped-files-api-key-only';
const anotherKey = 'phase2-another-api-key';
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

async function withServer(fn) {
  const app = createServer();
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try { await fn('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function call(base, key, tool, input, grant) {
  return fetch(base + '/mcp/tools/call', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': key,
      ...(grant ? {'x-mcp-tool-grant': grant} : {}),
    },
    body: JSON.stringify({tool, input}),
  });
}

test('Real HTTP create -> read -> compare-and-replace -> read -> delete -> verified missing', async () => {
  addApiKey(apiKey);
  addApiKey(anotherKey);
  try {
    await withServer(async base => {
      const filename = 'aion-phase2-acceptance.txt';
      const before = {filename, content:'original'};
      const grant = (tool, input) => signGrant(tool, input, apiKey,
        process.env.MCP_TOOL_APPROVAL_SECRET);

      // Deny write without grant, even if the client has the valid MCP API key.
      assert.equal((await call(base, apiKey, 'safe_file.create', before)).status, 400);
      assert.equal(fs.existsSync(path.join(root, filename)), false);

      // A signed capability is bound to a particular authenticated API key.
      const createGrant = grant('safe_file.create', before);
      assert.equal((await call(base, anotherKey, 'safe_file.create', before, createGrant)).status, 400);
      assert.equal((await call(base, apiKey, 'safe_file.create', {filename, content:'changed'}, createGrant)).status, 400);

      const created = await call(base, apiKey, 'safe_file.create', before, createGrant);
      assert.equal(created.status, 200);
      assert.equal((await created.json()).result.sha256, sha('original'));
      assert.equal(fs.readFileSync(path.join(root, filename), 'utf8'), 'original');

      const readInput = {filename};
      const readGrant = grant('safe_file.read', readInput);
      const read = await call(base, apiKey, 'safe_file.read', readInput, readGrant);
      assert.equal(read.status, 200);
      assert.equal((await read.json()).result.content, 'original');
      assert.equal((await call(base, apiKey, 'safe_file.read', readInput, readGrant)).status, 400);

      const replacement = {filename, expected_sha256:sha('original'), content:'revised'};
      assert.equal((await call(base, apiKey, 'safe_file.replace',
        {...replacement, expected_sha256:sha('not-current')},
        grant('safe_file.replace', {...replacement, expected_sha256:sha('not-current')}))).status, 400);

      const replace = await call(base, apiKey, 'safe_file.replace', replacement,
        grant('safe_file.replace', replacement));
      assert.equal(replace.status, 200);
      assert.equal(fs.readFileSync(path.join(root, filename), 'utf8'), 'revised');

      const readAgain = await call(base, apiKey, 'safe_file.read', readInput,
        grant('safe_file.read', readInput));
      assert.equal((await readAgain.json()).result.content, 'revised');

      const deletion = {filename, expected_sha256:sha('revised')};
      const deleted = await call(base, apiKey, 'safe_file.delete', deletion,
        grant('safe_file.delete', deletion));
      assert.equal(deleted.status, 200);
      assert.equal((await deleted.json()).result.deleted, true);
      assert.equal(fs.existsSync(path.join(root, filename)), false);

      const afterDeletion = await call(base, apiKey, 'safe_file.read', readInput,
        grant('safe_file.read', readInput));
      assert.equal(afterDeletion.status, 400);
    });
  } finally {
    removeApiKey(apiKey); removeApiKey(anotherKey);
    fs.rmSync(root, {recursive:true,force:true});
  }
});

test('Token expiry, malformed signatures and path traversal fail closed', async () => {
  const input = {filename:'../outside.txt',content:'x'};
  await assert.rejects(executeTool('safe_file.create', input),
    /Invalid input/);
  const correct = {filename:'ok.txt',content:'valid'};
  const expired = signGrant('safe_file.create', correct, apiKey,
    process.env.MCP_TOOL_APPROVAL_SECRET, Date.now() - 120000);
  await assert.rejects(executeTool('safe_file.create', correct, {
    actorSha256:sha(apiKey),grant:expired}), /does not match this exact call/);
  await assert.rejects(executeTool('safe_file.create', correct, {
    actorSha256:sha(apiKey), grant:'broken.token'}), /Invalid scoped approval/);
});

test('Only security-reviewed and signable tools appear in MCP discovery', () => {
  const names = getMCPToolList().map(t => t.name);
  for (const name of ['safe_file.create','safe_file.read','safe_file.replace','safe_file.delete','env.get'])
    assert.ok(names.includes(name), name);
  for (const name of ['policy.set','secrets.raw','net.post','cron.create','fs.write_file'])
    assert.ok(!names.includes(name), name);
});
