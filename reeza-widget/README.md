# Reeza Widget

Small Electron desktop companion for Reeza.

Features in this first version:

- bottom-left desktop widget window
- transparent frameless shell
- draggable top bar with remembered position
- tray icon with show/hide and quit actions
- launch-at-login toggle
- sign in with the same Supabase account
- fetches open todo tasks from the existing `users` table
- rotating reminder chat bubbles
- upload a photo for the avatar
- idle avatar motion plus simple mouth moods
- optional light reminder sound

Run locally:

```bash
npm install
npm run dev
```

Production-style renderer build:

```bash
npm run build
npm run start
```

Windows packaging:

```bash
npm install
npm run dist:win
```

Artifacts are written to the `release` folder:

- `Reeza-Buddy-Setup-<version>.exe` for the installer
- `Reeza-Buddy-Portable-<version>.exe` for the portable app

If you only want to test the packaged app without generating an installer, use:

```bash
npm run pack
```

GitHub release workflow:

- Open the `Actions` tab and run `Reeza Widget Release` with `workflow_dispatch` for a manual build.
- Or push a tag like `reeza-widget-v0.1.0` to build packages and publish a GitHub release automatically.

The workflow uploads the generated Windows `.exe` files as artifacts, and tag builds attach them to the GitHub release page.
