#!/usr/bin/env node

import net from 'node:net';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const HOST = process.env.SISWEB_DATABASE_EMULATOR_HOST || '127.0.0.1';
const PORT = Number(process.env.SISWEB_DATABASE_EMULATOR_PORT || 9000);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: false,
    ...options
  });
  if (result.error) throw result.error;
  return Number(result.status ?? 1);
}

function isPortOpen(host, port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = value => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(800);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

const staticStatus = run(process.execPath, [
  'test/multi-tenant-isolation.test.mjs',
  '--ci'
]);
if (staticStatus !== 0) process.exit(staticStatus);

if (await isPortOpen(HOST, PORT)) {
  console.log(`Reutilizando Database Emulator em ${HOST}:${PORT}.`);
  const status = run(
    process.execPath,
    ['--test', 'tests/security-rbac-emulator.test.mjs'],
    {
      env: {
        ...process.env,
        FIREBASE_DATABASE_EMULATOR_HOST: `${HOST}:${PORT}`
      }
    }
  );
  process.exit(status);
}

console.log('Database Emulator não está ativo; iniciando instância temporária.');
const command = `${process.execPath} --test tests/security-rbac-emulator.test.mjs`;
const firebaseCommand = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';
const status = run(firebaseCommand, [
  'emulators:exec',
  '--only',
  'database',
  '--project',
  'demo-sisweb-rbac',
  command
], { shell: process.platform === 'win32' });
process.exit(status);
