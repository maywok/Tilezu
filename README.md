# Tilezu

[![Latest release](https://img.shields.io/github/v/release/maywok/Tilezu?label=Download)](https://github.com/maywok/Tilezu/releases/latest)

**[Download for Windows (v0.1.0)](https://github.com/maywok/Tilezu/releases/latest)**

A personal game launcher for Windows — organize PC games, emulators, and ROM libraries in one place, with optional Rungo collectibles for playtime.

**Early preview (v0.1.0).** Expect bugs. You do **not** need to clone this repo to install.

## Install

1. Click **Download** above (or open [Releases](https://github.com/maywok/Tilezu/releases/latest)).
2. Download **`Tilezu_0.1.0_x64-setup.exe`**.
3. Run the installer and launch **Tilezu** from the Start menu.

Windows may show SmartScreen for unsigned apps. That is normal for indie builds.

### Requirements

- Windows 10 or 11 (64-bit)
- A display at 1200×760 or larger recommended

## What it does

- Import games from Steam, Epic, Battle.net, ROM folders, and executables
- Browse by system, search, favorites, and custom cover art
- Frameless desktop shell with sidebar media and settings
- **Rungos** — collectible characters obtainable by a gacha roll based on playtime tokens. Interactable in the Rungo Range (local)
- Local-first: works without an online account

<details>
<summary><strong>Build from source</strong> (developers)</summary>

Prerequisites: [Node.js](https://nodejs.org/) LTS, [Rust](https://rustup.rs/), and [Tauri prerequisites for Windows](https://v2.tauri.app/start/prerequisites/).

```powershell
npm install
npm run dev:tauri           # live dev
npm run build:tauri:debug   # local test exe
npm run build:tauri         # release installer
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for developer notes and [docs/RELEASE.md](docs/RELEASE.md) for publishing a GitHub release.

</details>

## License

[MIT](LICENSE)
