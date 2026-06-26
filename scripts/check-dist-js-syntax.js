import { readdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const assetsDir = join(process.cwd(), 'dist', 'assets');
const files = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));

let hasError = false;
for (const file of files) {
  const filePath = join(assetsDir, file);
  console.log('CHECK', filePath);
  const res = spawnSync(process.execPath, ['--check', filePath], {
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    hasError = true;
  }
}

process.exit(hasError ? 1 : 0);
