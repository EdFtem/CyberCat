// Runs the UI smoke test with a clean environment and a separate data folder
const { spawnSync } = require('child_process')
const { mkdtempSync, mkdirSync, writeFileSync } = require('fs')
const { tmpdir } = require('os')
const path = require('path')

const env = { ...process.env }
for (const k of Object.keys(env)) if (/^(VSCODE|CHROME|ELECTRON_RUN)/.test(k)) delete env[k]
env.CYBERCAT_USER_DATA = mkdtempSync(path.join(tmpdir(), 'cybercat-ui-'))
env.CYBERCAT_DEBUG_SCRIPT = path.resolve('tests/ui-smoke.cjs')
env.CYBERCAT_SHOTS = path.resolve('out/shots')
env.CYBERCAT_DEBUG = '1'
mkdirSync(env.CYBERCAT_SHOTS, { recursive: true })

// Interface language for the run: English by default, CC_UI_LANG=uk for Ukrainian
env.CC_UI_LANG = process.env.CC_UI_LANG || 'en'
writeFileSync(path.join(env.CYBERCAT_USER_DATA, 'settings.json'), JSON.stringify({ language: env.CC_UI_LANG }))

const electron = require('electron')
const r = spawnSync(electron, ['.'], { env, stdio: 'inherit' })
process.exit(r.status ?? 1)
