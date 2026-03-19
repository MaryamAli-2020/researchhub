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

- `Reeza-Buddy-Setup.exe` for the installer
- `Reeza-Buddy-Portable.exe` for the portable app

If you only want to test the packaged app without generating an installer, use:

```bash
npm run pack
```

GitHub release workflow:

- Publish a GitHub Release and the `Reeza Widget Release` workflow will build the Windows packages automatically.
- The built `.exe` files are attached back onto that GitHub Release.

Download page:

- The `Reeza Widget Site` workflow publishes the static landing page from `reeza-widget-site`.
- Its buttons point to the latest GitHub Release assets for the installer and portable build.
- In repository settings, enable GitHub Pages with `GitHub Actions` as the source.
