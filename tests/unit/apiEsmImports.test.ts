import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// package.json is "type": "module", and Vercel runs api/ as plain Node ESM without a bundler.
// Node needs the file extension on relative imports, so `./_lib/x` crashes the whole function at load
// (FUNCTION_INVOCATION_FAILED) even though tsx, Vite and Vitest resolve it fine locally.
const API_DIR = join(__dirname, '..', '..', 'api');

const tsFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tsFiles(path) : path.endsWith('.ts') ? [path] : [];
  });

describe('api/ relative imports', () => {
  it('always carry a .js extension', () => {
    const offenders: string[] = [];
    for (const file of tsFiles(API_DIR)) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
        if (!/\.(js|mjs|cjs|json)$/.test(m[1])) offenders.push(`${file.slice(API_DIR.length + 1)} → ${m[1]}`);
      }
      for (const m of src.matchAll(/import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
        if (!/\.(js|mjs|cjs|json)$/.test(m[1])) offenders.push(`${file.slice(API_DIR.length + 1)} → ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
