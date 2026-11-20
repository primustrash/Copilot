const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.LOG_FILE = '/tmp/aion-mcp-inventory.log';
process.env.AUDIT_LOG_FILE = '/tmp/aion-mcp-inventory-audit.log';

test('Enumerate actual registered tool modules, distinct names and executable policy', () => {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
  const imports = [...source.matchAll(/import '\.\/tools\/([^']+)';/g)].map(m => m[1]);
  assert.ok(imports.length > 25, 'Main server must import the full tool catalog');
  for (const moduleName of imports) {
    require(path.join(root, 'dist/tools', moduleName));
  }
  const { getToolNames, toolAvailability, getMCPToolList } = require('../dist/registry');
  const names = getToolNames();
  const summary = { registered_total: names.length, imported_modules: imports.length,
    verified_read: 0, grant_required: 0, security_blocked: 0 };
  assert.ok(names.length > 0);
  assert.equal(names.length, new Set(names).size, 'Every registered tool must have a unique name');
  const toolMatrix = [];
  for (const name of names) {
    const disposition = toolAvailability(name);
    if (disposition === 'verified_read') summary.verified_read++;
    else if (disposition === 'grant_required') summary.grant_required++;
    else summary.security_blocked++;
    toolMatrix.push({
      tool: name, disposition,
      executable: disposition !== 'blocked',
      authorization: disposition === 'grant_required'
        ? 'operator HMAC, exact argument hash, actor binding, one-use, 60-second expiry'
        : disposition === 'verified_read'
        ? 'authenticated MCP request, fixed passive behavior'
        : 'UNSUPPORTED: deny before handler; individual security acceptance required',
      production_accepted: false,
    });
  }
  assert.equal(summary.registered_total,
    summary.verified_read + summary.grant_required + summary.security_blocked);
  assert.equal(getMCPToolList().length,
    summary.verified_read + summary.grant_required);
  // Do not pretend the originally claimed 371 tools have passed QA; instead
  // write the measured counts and the exact discrepancy into CI logs.
  summary.claimed_historical_total = 371;
  summary.claim_discrepancy = summary.registered_total - 371;
  const matrix = { generated_by: 'GitHub Actions CI for exact checked-out PR HEAD',
    classification_version: 1, summary,
    tools: toolMatrix.sort((a,b) => a.tool.localeCompare(b.tool)) };
  const directory = path.join(root, 'evidence');
  fs.mkdirSync(directory, {recursive:true});
  fs.writeFileSync(path.join(directory, 'tool-security-matrix.json'),
    JSON.stringify(matrix, null, 2) + '\n', {mode:0o600});
  assert.equal(matrix.tools.length, summary.registered_total);
  process.stdout.write('AION_TOOL_INVENTORY=' + JSON.stringify(summary) + '\n');
});
