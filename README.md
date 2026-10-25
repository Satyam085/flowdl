# FlowDL — Minimal & Elegant yt-dlp Studio

**FlowDL** is a minimal, elegant desktop wrapper for the `yt-dlp` CLI written in Go and HTML/CSS/JS with [Wails](https://wails.io). It compiles directly to native standalone executables for Linux and Windows with zero web bloat.

---

## ✨ Features

- **Single & Batch Downloads**:
  - Download single videos or paste multiple URLs (batch mode) to download entire queues.
  - Automatic stream title extraction & thumbnail resolution.
  - Playlist support (toggle full playlist or single track).
- **Format & Quality Control**:
  - **Video (MP4)**: Best Quality (up to 4K / 2160p), 1440p, 1080p Full HD, 720p HD, 480p.
  - **Audio Only**: High-quality extraction to MP3 (320kbps), M4A (AAC), FLAC (Lossless), OPUS, or WAV.
- **Save Location & System Integration**:
  - Interactive native Linux directory picker to choose destination folder.
  - Quick button to reveal destination in Linux file manager (`xdg-open`).
  - One-click "Play" button on completed items to launch in default media player (VLC, MPV, etc.).
- **Live Progress & Streaming Output**:
  - Real-time download percentage, download speed (e.g. `4.5 MiB/s`), ETA countdown, and accurate total size estimation (no `NA`).
  - Status badges for downloading, converting/merging, completed, failed, and cancelled.
  - Cancel active downloads instantly with clean process termination.
- **Advanced Media Options**:
  - Embed subtitles (with automatic caption fallback).
  - Embed thumbnail / album art cover.
  - Embed metadata tags & chapter markers.

---

## 📦 Distribution Packages

FlowDL supports multiple distribution targets:

| Platform | Format | Description |
| :--- | :--- | :--- |
| **Windows** | Portable `.exe` | Standalone executable (`FlowDL-Windows-x64-Portable.exe`), no installation required |
| **Windows** | Setup `.exe` | Standard Windows NSIS installation wizard (`FlowDL-Windows-x64-Setup.exe`) |
| **Linux** | Native Binary | Standalone compiled binary (`build/bin/flowdl`) |
| **Linux** | AppImage | Self-contained, portable single-file executable (`FlowDL-Linux-x86_64.AppImage`) |
| **Linux** | Flatpak | Sandboxed distribution via Flatpak manifest (`packaging/flatpak/org.flowdl.FlowDL.yaml`) |

---

## 🚀 Automated GitHub Releases (CI/CD)

A complete multi-platform GitHub Actions workflow is provided at [`.github/workflows/release.yml`](.github/workflows/release.yml).

Whenever you push a version tag to your GitHub repository:
```bash
git tag v1.0.0
git push origin v1.0.0
```
GitHub Actions will automatically spin up Windows and Ubuntu runners, compile all variants, and publish a GitHub Release with:
1. `FlowDL-Windows-x64-Portable.exe`
2. `FlowDL-Windows-x64-Setup.exe`
3. `FlowDL-Linux-x86_64.tar.gz`
4. `FlowDL-Linux-x86_64.AppImage`

---

## 🛠️ Building Locally

### Prerequisites
- Go 1.20+
- `yt-dlp` (`sudo pacman -S yt-dlp` or `sudo apt install yt-dlp`)
- `ffmpeg` (`sudo pacman -S ffmpeg` or `sudo apt install ffmpeg`)
- WebKitGTK dev packages (`webkit2gtk-4.1` on modern Linux distributions)

### Commands
```bash
# Compile native Linux binary (saved to build/bin/flowdl)
make build

# Run downloader unit tests
make test

# Build Linux AppImage
make appimage

# Install to ~/.local/bin/flowdl and set up desktop entry
make install

# Run in development mode with live reload
make dev
```

---

## ⚖️ Licensing & Legal

- **FlowDL** is released under the **[MIT License](LICENSE)**.
- **`yt-dlp`** is dedicated to the public domain under **The Unlicense**.
- **`ffmpeg`** is licensed under **LGPL v2.1+ / GPL v2+**.
- Because FlowDL interacts with `yt-dlp` and `ffmpeg` exclusively via standard CLI subprocesses (`exec.Command`), it is classified as mere aggregation under copyright law. Hosting this project publicly on GitHub complies fully with open-source licensing principles.
