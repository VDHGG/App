
import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const infraDir = path.dirname(fileURLToPath(import.meta.url));
/** Always `.../app/.env` when this file lives in `app/src/infra/` */
const envNextToPackageJson = path.resolve(infraDir, '../../.env');

const candidates = [
  envNextToPackageJson,
  path.resolve(infraDir, '../.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'app', '.env'),
];

const envPath = candidates.find((p) => existsSync(p));

if (envPath) {
  const isProdOrCloud = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  config({ path: envPath, override: !isProdOrCloud });
  if (!isProdOrCloud) {
    console.log(`[env] Loaded variables from: ${envPath}`);
  }
} else {
  config();
}
