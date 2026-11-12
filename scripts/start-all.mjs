/**
 * CHAAT KULTURE OS — UNIFIED START SCRIPT
 * Starts both the Local Backend Server (port 3001) and the Frontend Vite Dev Server (port 5173).
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('========================================================');
console.log('  CHAAT KULTURE OS — MULTI-LOCATION PLATFORM');
console.log('  Starting Full-Stack Local Environment...');
console.log('========================================================\n');

// 1. Start Backend Server
const serverScript = path.join(ROOT_DIR, 'server', 'server.mjs');
console.log('[Backend] Starting Node.js API server on port 3001...');
const backendProcess = spawn('node', [`"${serverScript}"`], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  shell: true
});

// 2. Start Vite Frontend Server
console.log('[Frontend] Starting Vite dev server on port 5173...');
const frontendProcess = spawn('npx', ['vite', '--port', '5173', '--host'], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  shell: true
});

// Handle termination
function shutdown() {
  console.log('\n[System] Shutting down Chaat Kulture OS servers...');
  backendProcess.kill();
  frontendProcess.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
