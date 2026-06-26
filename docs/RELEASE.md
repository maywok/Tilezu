# Publishing Tilezu releases

Use this checklist when cutting a GitHub release. Installers are **not** committed to git — attach them to the GitHub Release page.

## 1. Version bump

Keep these in sync:

- `package.json` -> `"version"`
- `src-tauri/tauri.conf.json` -> `"version"`
- `CHANGELOG.md` -> new section
- Git tag -> `v0.1.0`

## 2. Build the Windows installer

```powershell
npm install
npm run build:tauri
```

This produces:

| Artifact | Path |
|----------|------|
| **Setup (upload this)** | `src-tauri\target\release\bundle\nsis\Tilezu_0.1.0_x64-setup.exe` |
| MSI (optional) | `src-tauri\target\release\bundle\msi\Tilezu_0.1.0_x64_en-US.msi` |

Verify artifacts and SHA256 hashes:

```powershell
npm run release:report
```

## 3. Smoke test

Install from the setup exe on a clean profile, complete onboarding, browse library, open Rungo.

## 4. Push source to GitHub

```powershell
git add .
git commit -m "Update README and remove tmp from repo"
git push origin main
```

## 5. GitHub repo presentation (one-time)

On [github.com/maywok/Tilezu](https://github.com/maywok/Tilezu), click the **gear** next to **About**:

- **Description:** `Personal game launcher for Windows`
- **Website:** `https://github.com/maywok/Tilezu/releases/latest`
- **Topics:** `game-launcher`, `windows`, `tauri`, `react`, `emulators`

On **Releases**, pin **v0.1.0** so the installer stays visible at the top.

## 6. Create the GitHub Release

1. **Releases -> Draft a new release**
2. Tag: `v0.1.0`
3. Attach **`Tilezu_0.1.0_x64-setup.exe`**
4. Paste notes from `CHANGELOG.md`
5. Publish

Or with GitHub CLI:

```powershell
gh release create v0.1.0 "src-tauri\target\release\bundle\nsis\Tilezu_0.1.0_x64-setup.exe" --title "Tilezu 0.1.0" --notes-file CHANGELOG.md
```

## What not to upload

- `src-tauri/target` folder
- Debug builds (`build:tauri:debug`)
- ROM files or copyrighted game assets
- `tmp/` scratch files (gitignored)

## Installer SHA256 (v0.1.0)

Run `npm run release:report` after each release build. Example for the current build:

```
Tilezu_0.1.0_x64-setup.exe
7C418803DCE323F573E23DD32B4779601C4A42897C2D8D65C9C5D98DAE06D493
```
