# Contributing to CyberCat

Thanks for your interest! Issues and pull requests are welcome in English or Ukrainian.

## Development setup

```bash
git clone https://github.com/EdFtem/CyberCat.git
cd CyberCat
npm install
npm run dev
```

Requirements: Node.js 22 or newer, npm 10 or newer. Docker is needed only for the end-to-end tests.

If you launch from a VS Code terminal and the window never appears, unset the `ELECTRON_RUN_AS_NODE` environment variable first.

## Project layout

```
src/main        Electron main process: SSH sessions (ssh2), SFTP and local FS adapters,
                transfer queue, text editor backend, external editor watcher, terminal, IPC
src/preload     contextBridge API exposed as window.api
src/renderer    React + Tailwind UI: panes, dialogs, Monaco editor, xterm terminal
src/shared      Types and the API contract shared by all three
tests           Backend end-to-end test and UI smoke test
```

## Checks before opening a PR

```bash
npm run typecheck     # TypeScript, main + renderer
npm run build         # production bundles
npm run test:e2e      # backend against a local test sshd (see below)
npm run test:ui       # screenshots into out/shots/
```

Test SSH server:

```bash
docker run -d --name cybercat-sshd -p 2222:2222 -e PUID=1000 -e PGID=1000 \
  -e PASSWORD_ACCESS=true -e USER_NAME=cat -e USER_PASSWORD=catpass \
  lscr.io/linuxserver/openssh-server:latest
```

## Guidelines

- Keep the main process free of UI concerns and the renderer free of Node APIs. Everything crosses through `src/shared/api.ts`.
- Anything that talks to a server must work over plain SFTP and only use `exec` as an optimization when `session.info.hasShell` is true.
- Prefer small, focused PRs with a short description of what changed and why. Screenshots help for UI changes.
- Match the existing code style; Prettier settings are in `.prettierrc`.
- User-facing strings are currently Ukrainian. Keep them consistent until localization lands.

## Reporting bugs

Use the bug report template. Please include the OS, the SSH server type if known, and the steps to reproduce. Never paste private keys, passwords or host fingerprints of production servers.

## License

By contributing you agree that your contributions are licensed under the MIT License.
