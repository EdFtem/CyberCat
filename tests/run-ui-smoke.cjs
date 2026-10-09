// Запускає smoke-тест UI з чистим середовищем і окремою текою даних
const { spawnSync } = require('child_process')
const { mkdtempSync, mkdirSync } = require('fs')
const { tmpdir } = require('os')
const path = require('path')

const env = { ...process.env }
for (const k of Object.keys(env)) if (/^(VSCODE|CHROME|ELECTRON_RUN)/.test(k)) delete env[k]
env.CYBERCAT_USER_DATA = mkdtempSync(path.join(tmpdir(), 'cybercat-ui-'))
env.CYBERCAT_DEBUG_SCRIPT = path.resolve('tests/ui-smoke.cjs')
env.CYBERCAT_SHOTS = path.resolve('out/shots')
env.CYBERCAT_DEBUG = '1'
mkdirSync(env.CYBERCAT_SHOTS, { recursive: true })

const electron = require('electron')
const r = spawnSync(electron, ['.'], { env, stdio: 'inherit' })
process.exit(r.status ?? 1)
