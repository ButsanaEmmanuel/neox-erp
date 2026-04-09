import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, 'src');
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const bannedTokenRegex = /\b(MockData|DummyService|PlaceholderList)\b/g;
const getDataHardcodedArrayRegexes = [
  /function\s+getData\s*\([^)]*\)\s*\{[\s\S]{0,400}?return\s*\[[\s\S]{0,400}?\]/g,
  /const\s+getData\s*=\s*\([^)]*\)\s*=>\s*\[[\s\S]{0,400}?\]/g,
  /const\s+getData\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]{0,400}?return\s*\[[\s\S]{0,400}?\]/g,
];

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (ALLOWED_EXTENSIONS.has(extname(fullPath))) {
      files.push(fullPath);
    }
  }

  return files;
}

const violations = [];
const files = walk(SRC_DIR);

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf8');

  const tokenMatches = content.match(bannedTokenRegex);
  if (tokenMatches) {
    violations.push(`${filePath}: forbidden token(s): ${[...new Set(tokenMatches)].join(', ')}`);
  }

  for (const regex of getDataHardcodedArrayRegexes) {
    if (regex.test(content)) {
      violations.push(`${filePath}: getData() must not return hardcoded array literals`);
      break;
    }
  }
}

if (violations.length > 0) {
  console.error('Zero-Mock check failed.');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Zero-Mock check passed.');
