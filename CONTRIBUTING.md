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
src/shared      Types, the API contract and translations (i18n) shared by all three
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
- Never hard-code user-facing text. Every string shown to the user, including error messages thrown in the main process, goes through the translation dictionaries described below.

## Translations

The interface is available in English and Ukrainian. Dictionaries live in `src/shared/i18n/locales/<lang>/`, one file per screen or area (namespace), and are shared by the main process and the renderer.

- `en/` is the source of truth. Every other language is typed as `typeof en`, so `npm run typecheck` fails when a key is missing, misspelled or has the wrong shape.
- Strings with values are functions: ``deleteTitle: (name: string) => `Delete ${name}?` ``. Plurals use `pluralEn` / `pluralUk` from `src/shared/i18n/plural.ts`; keep a whole sentence in one message instead of gluing fragments together, because word order differs between languages.
- In React components call `const t = useT()` (from `@/lib/i18n`) and read `t.<namespace>.<key>`; the component re-renders when the language changes. Outside components (store actions, `lib/ops.ts`) call `tr()` at the moment the text is needed. In the main process use `tr()` from `src/main/i18n.ts`.
- For inline markup inside a sentence, put tags in the message (`'Use <code>%f</code> for the path'`) and render it with `rich()`.
- Dates, sizes and numbers go through the helpers in `src/renderer/src/lib/format.ts`, which follow the selected language.

When you add or change a string, update every language. If you cannot translate it, copy the English text and mention it in the PR so a native speaker can follow up.

To add a language:

1. Copy `src/shared/i18n/locales/en/` to `src/shared/i18n/locales/<code>/` and translate the values, typing each namespace as `typeof en` (see `uk/` for the pattern).
2. Register it in `src/shared/i18n/index.ts`: the `Lang` union, `LANGUAGES` (labelled in its own language), `INTL_LOCALE` and the dictionary map. Add a plural helper to `plural.ts` if the language needs one.
3. Run `npm run typecheck` and check the app with `CC_UI_LANG=<code> npm run test:ui`.

## Screenshots

The screenshots in `docs/` are produced by the UI smoke test against the test sshd, in English:

```bash
npm run build
npm run test:ui
cp out/shots/01-home.png docs/screenshot-home.png
cp out/shots/05-editor.png docs/screenshot-editor.png
cp out/shots/06-logview.png docs/screenshot-logview.png
cp out/shots/07d-compare.png docs/screenshot-compare.png
```

The test opens the local pane in a small demo folder, so your own files do not end up in the pictures.

## Releasing

Installers are built by GitHub Actions and hosted on GitHub Releases, so releases cost nothing for this public repository.

1. Bump the version: `npm version patch` (or `minor`, `major`). This commits `package.json` and creates the tag `vX.Y.Z`.
2. Push it: `git push --follow-tags`.
3. The [Release workflow](.github/workflows/release.yml) checks that the tag matches `package.json`, creates a draft release with generated notes, then builds the Windows installer and portable `.exe`, the macOS `.dmg` and `.zip` for Apple Silicon and Intel, and the Linux AppImage, and uploads them together with the `latest*.yml` files the updater reads.
4. Edit the notes if needed and click **Publish**. Installed apps see the update at their next check (on start, then every six hours). A draft is invisible to them.

To try a build without publishing anything, run the workflow manually from the Actions tab: the installers are attached to the run as artifacts. Locally, `npm run dist` builds the installers for your OS into `dist/`.

To test the update flow without GitHub, serve a folder with a `latest*.yml` and the installer over HTTP and start the app with `CYBERCAT_UPDATE_FEED=http://localhost:8080/`.

### Website

The landing page lives in `site/`: plain HTML, CSS and JavaScript with no build step and no external requests besides the GitHub API (latest release and star count). Open `site/index.html` in a browser to preview it. The [Pages workflow](.github/workflows/pages.yml) publishes it to https://edftem.github.io/CyberCat/ on every push to `main` that touches `site/`. The download buttons read the newest release from the GitHub API, so they never need editing after a release.

Screenshots in `site/assets/shots/` are WebP, 2400 px wide. Keep both languages in sync: English is in the HTML, Ukrainian in the `uk` table in `site/main.js`.

### Code signing

No certificates are configured, which keeps releases free:

- **Windows** installs and updates work unsigned; SmartScreen warns on first launch. [SignPath Foundation](https://signpath.org) signs open-source projects for free, which removes the warning over time.
- **macOS** builds are ad-hoc signed, which Apple Silicon requires, so updates there are manual. With an Apple Developer ID ($99 a year): set `mac.identity`, enable `hardenedRuntime` and notarization in `electron-builder.yml`, and let `canInstall()` in `src/main/updater.ts` return true on macOS.
- **Linux** AppImages need no signing.

## Reporting bugs

Use the bug report template. Please include the OS, the SSH server type if known, and the steps to reproduce. Never paste private keys, passwords or host fingerprints of production servers.

## License

By contributing you agree that your contributions are licensed under the MIT License.
