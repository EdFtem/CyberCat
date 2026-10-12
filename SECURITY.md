# Security Policy

CyberCat handles SSH credentials and connects to remote servers, so security reports are taken seriously.

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private vulnerability reporting on this repository ("Security" tab, "Report a vulnerability"). You should get an acknowledgement within a few days.

## What is in scope

- Credential storage (passwords are encrypted with Electron `safeStorage`, keys are read from disk only when connecting)
- S3 credentials (secret access keys are stored like SSH passwords; named AWS profiles are read from `~/.aws` and never copied) and share links (presigned URLs that expire after at most 7 days)
- Host key verification and the known-hosts store
- Path handling for local and remote file operations
- The preload bridge (`window.api`) and IPC surface
- Temporary files created for the external editor

## Hardening notes

- Renderer runs with `contextIsolation: true` and `nodeIntegration: false`; all privileged work happens in the main process.
- Remote shell commands built from paths are single-quoted with escaping (`shq` in `src/main/fs/sftpUtil.ts`). Please report any path that escapes it.
- No telemetry. Besides the SSH and S3 connections you create, the only network traffic is the update check against GitHub Releases (`github.com`), which can be turned off in Settings → Updates.
- Updates are downloaded over HTTPS from the project's GitHub releases; on Windows and Linux the updater checks each download against the SHA-512 hash published in `latest*.yml`.
