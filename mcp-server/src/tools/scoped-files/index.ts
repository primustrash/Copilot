import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { registerTool } from '../../registry';
import { config } from '../../utils/config';

// Deliberately not general filesystem tooling. Every execution also requires
// an exact, short-lived, single-use operator grant in the registry.
const filename = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}\.(txt|md|json)$/);
const contents = z.string().max(65536);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

function workspace(): string {
  const configured = config.workspace.root;
  const stat = fs.lstatSync(configured);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o002)) {
    throw new Error('Dedicated secure workspace missing or world-writable');
  }
  const root = fs.realpathSync(configured);
  if (root === '/' || root === '/tmp' || root === '/home') {
    throw new Error('Use a dedicated workspace, never a shared root');
  }
  return root;
}

function location(name: string): string {
  // filename schema prevents slashes, '..' traversal and hidden config files.
  return path.join(workspace(), name);
}

function readStrict(name: string): Buffer {
  const dest = location(name);
  const fd = fs.openSync(dest, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 65536) {
      throw new Error('File is not a bounded, regular, unlinked workspace file');
    }
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

registerTool({
  name: 'safe_file.create',
  description: 'Create one bounded file in a dedicated operator workspace (single-use approval required)',
  category: 'scoped-files',
  schema: z.object({ filename, content: contents }).strict(),
  handler: async input => {
    const { filename: name, content } = input as { filename: string; content: string };
    const bytes = Buffer.from(content, 'utf8');
    if (bytes.length > 65536) throw new Error('File exceeds 64 KiB');
    const fd = fs.openSync(location(name),
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
      0o600);
    try { fs.writeFileSync(fd, bytes); }
    finally { fs.closeSync(fd); }
    return { created: true, filename: name, sha256: digest(bytes), bytes: bytes.length };
  },
});

registerTool({
  name: 'safe_file.read',
  description: 'Read a bounded, regular workspace file (single-use approval required)',
  category: 'scoped-files',
  schema: z.object({ filename }).strict(),
  handler: async input => {
    const { filename: name } = input as { filename: string };
    const bytes = readStrict(name);
    return { filename: name, content: bytes.toString('utf8'), sha256: digest(bytes) };
  },
});

registerTool({
  name: 'safe_file.replace',
  description: 'Compare-and-replace a workspace file atomically (single-use approval required)',
  category: 'scoped-files',
  schema: z.object({ filename, expected_sha256: hash, content: contents }).strict(),
  handler: async input => {
    const { filename: name, expected_sha256, content } = input as {
      filename: string; expected_sha256: string; content: string;
    };
    if (digest(readStrict(name)) !== expected_sha256) throw new Error('Stale file revision');
    const bytes = Buffer.from(content, 'utf8');
    if (bytes.length > 65536) throw new Error('File exceeds 64 KiB');
    const root = workspace();
    const tmp = path.join(root, '.aion-new-' + randomBytes(16).toString('hex'));
    const fd = fs.openSync(tmp,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
      0o600);
    try {
      fs.writeFileSync(fd, bytes);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      if (digest(readStrict(name)) !== expected_sha256) {
        throw new Error('Stale file revision');
      }
      fs.renameSync(tmp, location(name));
    } catch (error) {
      try { fs.closeSync(fd); } catch { /* already closed */ }
      try { fs.unlinkSync(tmp); } catch { /* already renamed or deleted */ }
      throw error;
    }
    return { replaced: true, filename: name, sha256: digest(bytes) };
  },
});

registerTool({
  name: 'safe_file.delete',
  description: 'Delete exact approved file revision (single-use approval required)',
  category: 'scoped-files',
  schema: z.object({ filename, expected_sha256: hash }).strict(),
  handler: async input => {
    const { filename: name, expected_sha256 } = input as {
      filename: string; expected_sha256: string;
    };
    if (digest(readStrict(name)) !== expected_sha256) throw new Error('Stale file revision');
    fs.unlinkSync(location(name));
    return { deleted: true, filename: name };
  },
});
