#!/usr/bin/env node
'use strict';
// Trusted operator CLI only. NEVER register as an MCP handler or HTTP route.
// Usage: API_KEY_SECRET=... MCP_TOOL_APPROVAL_SECRET=... node scripts/issue-tool-grant.cjs safe_file.create input.json
const fs = require('node:fs');
const { signGrant } = require('../dist/utils/tool-grants');
const [tool, inputFile] = process.argv.slice(2);
const supported = new Set([
  'safe_file.create', 'safe_file.read', 'safe_file.replace', 'safe_file.delete'
]);
if (!supported.has(tool) || !inputFile ||
    !process.env.API_KEY_SECRET || !process.env.MCP_TOOL_APPROVAL_SECRET) {
  process.stderr.write('Operator-only: provide supported tool, JSON input file and both operator secrets through protected environment.\n');
  process.exit(2);
}
const stat = fs.statSync(inputFile);
if (!stat.isFile() || stat.size > 66000) process.exit(2);
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const grant = signGrant(tool, input, process.env.API_KEY_SECRET, process.env.MCP_TOOL_APPROVAL_SECRET);
// Short-lived bearer: do not persist it, echo it into model prompts, or commit.
process.stdout.write(grant + '\n');
