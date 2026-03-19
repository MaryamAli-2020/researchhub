# Reeza

Reeza is a small productivity ecosystem built around one account and one shared task/data model.

This repository currently includes:

- a web app for the main dashboard experience
- a mobile app for on-the-go access
- a desktop companion widget that lives on the user's screen
- a small download website for the widget

The goal is to keep a user's tasks, outputs, and profile experience feeling consistent across devices while also making the product feel warm, personal, and visually polished.

## Projects

### Web App

Path: [my-app](C:\Users\mhral\OneDrive\Documents\New%20project\researchhub\my-app)

The web app is the main browser-based Reeza dashboard. It uses React, Vite, and Supabase.

What it covers:

- account login
- dashboard and navigation
- task and output management
- syncing shared account data

Run locally:

```bash
cd my-app
npm install
npm run dev
```

Production build:

```bash
npm run build
```

### Mobile App

Path: [reeza-app](C:\Users\mhral\OneDrive\Documents\New%20project\researchhub\reeza-app)

The mobile app is the React Native / Expo version of Reeza. It is designed to keep the same account data and a similar visual language as the web app.

What it covers:

- login with the same account
- mobile-friendly dashboard access
- synced task and profile data
- companion access away from desktop

Run locally:

```bash
cd reeza-app
npm install
npx expo start
```

### Desktop Widget

Path: [reeza-widget](C:\Users\mhral\OneDrive\Documents\New%20project\researchhub\reeza-widget)

The desktop widget is an Electron-based companion called **Reeza Buddy**. It is meant to feel like a tiny desktop friend rather than a full application window.

What it does:

- signs into the same Reeza account
- pulls open tasks from the shared data source
- shows gentle reminder bubbles
- supports tray behavior and launch at login
- lets the user add a personal avatar
- can be packaged as a Windows installer or portable app

Run locally:

```bash
cd reeza-widget
npm install
npm run dev
```

Package for Windows:

```bash
npm run dist:win
```

The generated files are placed in:

- [reeza-widget/release](C:\Users\mhral\OneDrive\Documents\New%20project\researchhub\reeza-widget\release)

### Widget Download Site

Path: [reeza-widget-site](C:\Users\mhral\OneDrive\Documents\New%20project\researchhub\reeza-widget-site)

This is a small static landing page for the desktop widget. Its purpose is to give people a clean place to understand the widget and download the latest installer or portable build.

It is designed to work with GitHub Pages and GitHub Releases.

## Repository Structure

```text
researchhub/
  my-app/              Web app
  reeza-app/           Mobile app
  reeza-widget/        Desktop widget
  reeza-widget-site/   Widget download page
  .github/workflows/   Release + Pages automation
```

## Shared Product Direction

Across the different Reeza surfaces, the project aims for:

- consistent user data between devices
- a softer, more personable reminder experience
- visually cohesive styling across web, mobile, and desktop
- Supabase-backed authentication and sync

## Release Automation

The repo includes GitHub Actions workflows in:

- [.github/workflows/reeza-widget-release.yml](C:\Users\mhral\OneDrive\Documents\New%20project\researchhub\.github\workflows\reeza-widget-release.yml)
- [.github/workflows/reeza-widget-site.yml](C:\Users\mhral\OneDrive\Documents\New%20project\researchhub\.github\workflows\reeza-widget-site.yml)

### Widget Release Flow

Publishing a GitHub Release on this repository triggers the Windows packaging workflow for the desktop widget.

That workflow:

- builds `Reeza Buddy`
- generates the Windows installer and portable app
- attaches the `.exe` files to the GitHub Release

Expected release assets:

- `Reeza-Buddy-Setup.exe`
- `Reeza-Buddy-Portable.exe`

### Download Site Flow

The widget site workflow publishes the static download page through GitHub Pages.

The page is intended to point to:

- the latest GitHub Release
- the latest widget installer
- the latest portable widget build

To use it, make sure GitHub Pages is enabled with `GitHub Actions` as the source in repository settings.

## Getting Started

If you are working on the whole project, a practical order is:

1. Start the web app if you are working on core product flows.
2. Start the mobile app if you are checking cross-device behavior.
3. Start the desktop widget if you are testing reminder and companion behavior.

## Notes

- The apps share the same broader Reeza concept, but each surface is optimized for a different context.
- The desktop widget is packaged inside this repo even though it is a separate product surface.
- Some workflows depend on GitHub Releases and GitHub Pages being enabled in the repository settings.

## Author

Created by Maryam Ali.
