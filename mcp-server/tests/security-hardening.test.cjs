const test = require('node:test');
const assert = require('node:assert/strict');

process.env.LOG_FILE = '/tmp/aion-mcp-ci-app.log';
process.env.AUDIT_LOG_FILE = '/tmp/aion-mcp-ci-audit.log';
process.env.ALLOWED_PATHS = '/tmp,/var/mcp';
delete process.env.MCP_ISOLATED_EXEC_ENABLED;

const { executeTool, getTool } = require('../dist/registry');
const { validatePath, runSandboxed } = require('../dist/utils/sandbox');
require('../dist/tools/shell');

test('Command injection is rejected by the registered schema', async () => {
  await assert.rejects(
    executeTool('shell.run', { command: 'ps aux; touch /tmp/aion-exploit' }),
    /Invalid input/
  );
  await assert.rejects(
    executeTool('run_shell', { command: 'echo unsafe' }),
    /disabled until a scoped approval/
  );
  await assert.rejects(
    runSandboxed('bash', ['-c', 'echo attacker']),
    /not approved/
  );
});

test('Process filter is treated as a literal value, never shell syntax', async () => {
  const result = await executeTool('process.list', {
    filter: '; touch /tmp/aion-should-never-exist',
  });
  assert.equal(result.count, 0);
  assert.deepEqual(result.processes, []);
});

test('Environment variables are limited to non-secret metadata', async () => {
  await assert.rejects(
    executeTool('env.get', { key: 'OPENAI_API_KEY' }),
    /Invalid input/
  );
  const result = await executeTool('env.get', {});
  assert.deepEqual(Object.keys(result.env).sort(), ['LANG', 'NODE_ENV', 'PATH']);
});

test('Unscoped writes and remote execution are fail closed', async () => {
  for (const name of [
    'cron.create', 'env.set', 'service_restart', 'ssh_exec', 'vps_ssh_execute',
    'package.install', 'shell.run_build', 'process.kill', 'trigger_pipeline'
  ]) {
    assert.ok(getTool(name), 'tool registration missing: ' + name);
    await assert.rejects(executeTool(name, {}), /disabled until a scoped approval/, name);
  }
});

test('Sibling path prefix cannot bypass directory allowlist', () => {
  assert.throws(() => validatePath('/tmp-malicious/readme'), /outside approved roots/);
  assert.equal(validatePath('/tmp'), '/tmp');
});

test('Audit logs do not expose tool payloads or returned secrets', () => {
  const { auditLogger, logToolExecution } = require('../dist/utils/logger');
  const prior = auditLogger.info;
  let recorded;
  try {
    auditLogger.info = (_event, data) => { recorded = data; };
    logToolExecution('env.get', { key: 'OPENAI_API_KEY', token: 'secret-abc' },
      { value: 'secret-abc', content: 'private' }, 18);
  } finally {
    auditLogger.info = prior;
  }
  assert.equal(recorded.tool, 'env.get');
  assert.equal(recorded.outcome, 'completed');
  assert.equal(recorded.durationMs, 18);
  assert.equal('input' in recorded, false);
  assert.equal('result' in recorded, false);
  assert.equal(JSON.stringify(recorded).includes('secret-abc'), false);
});
