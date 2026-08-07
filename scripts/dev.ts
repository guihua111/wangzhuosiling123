import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: '.env.vercel-public' });
config({ path: '.env.vercel-secret', override: true });

const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== '--');
const portFlagIndex = forwardedArgs.findIndex(
  (arg) => arg === '-p' || arg === '--port'
);
const port =
  portFlagIndex >= 0 && forwardedArgs[portFlagIndex + 1]
    ? forwardedArgs[portFlagIndex + 1]
    : '3000';
const localAppUrl = `http://localhost:${port}`;

const child = spawn(
  process.execPath,
  [
    resolve('node_modules/next/dist/bin/next'),
    'dev',
    '--turbopack',
    ...forwardedArgs,
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      NEXT_PUBLIC_APP_URL: localAppUrl,
      AUTH_URL: localAppUrl,
    },
  }
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal));
}
