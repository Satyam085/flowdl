# FlowDL — Minimal & Elegant yt-dlp Studio

**FlowDL** is a minimal, elegant desktop wrapper for the `yt-dlp` CLI written in Go and HTML/CSS/JS with [Wails](https://wails.io). It compiles directly to a native, self-contained Linux executable with zero runtime web dependencies.

---

## ✨ Features

- **Single & Batch Downloads**:
  - Download single videos or paste multiple URLs (batch mode) to download entire queues.
  - Playlist support (toggle full playlist or single track).
- **Format & Quality Control**:
  - **Video (MP4)**: Best Quality (up to 4K / 2160p), 1440p, 1080p Full HD, 720p HD, 480p.
  - **Audio Only**: High-quality extraction to MP3 (320kbps), M4A (AAC), FLAC (Lossless), OPUS, or WAV.
- **Save Location & System Integration**:
  - Interactive native Linux directory picker to choose destination folder.
  - Quick button to reveal destination in Linux file manager (`xdg-open`).
  - One-click "Play" button on completed items to launch in default media player (VLC, MPV, etc.).
- **Live Progress & Streaming Output**:
  - Real-time download percentage, download speed (e.g. `4.5 MiB/s`), ETA countdown, and file sizes.
  - Status badges for downloading, converting/merging, completed, failed, and cancelled.
  - Cancel active downloads instantly with process termination.
- **Advanced Media Options**:
  - Embed subtitles (with automatic caption fallback).
  - Embed thumbnail / album art cover.
  - Embed metadata tags & chapter markers.
- **Native Look & Feel**:
  - Polished dark UI with subtle glows, glassmorphism, fluid CSS transitions, and keyboard shortcuts.
  - Clipboard paste helper and automatic metadata inspection (title, thumbnail, duration, channel).

---

## 🚀 Quick Start

### Running FlowDL
The application is already built and installed to `~/.local/bin/flowdl`. You can launch it by running:

```bash
flowdl
```

Or find **FlowDL** directly in your Linux desktop application launcher (GNOME, KDE, XFCE, etc.).

---

## 🛠️ Building from Source

### Prerequisites
- Go 1.20+
- `yt-dlp` (`sudo pacman -S yt-dlp` or `sudo apt install yt-dlp`)
- `ffmpeg` (`sudo pacman -S ffmpeg` or `sudo apt install ffmpeg`)
- WebKitGTK dev packages (`webkit2gtk-4.1` on modern Linux distributions)

### Commands
```bash
# Compile native binary (saved to build/bin/flowdl)
make build

# Run downloader unit tests
make test

# Install to ~/.local/bin/flowdl and set up desktop entry
make install

# Run in development mode with live reload
make dev
```

---

## 📂 Project Architecture

```
yt-dlp-wrapper/
├── main.go               # Wails app initialization & window configuration
├── app.go                # Bridge between Go backend and frontend UI
├── downloader/           # Go core downloader package
│   ├── types.go          # Data models (MediaInfo, DownloadOptions, DownloadTask)
│   ├── info.go           # Metadata inspection & URL parsing via yt-dlp
│   ├── engine.go         # Task queue, process lifecycle, regex progress parser, cancellation
│   ├── system.go         # Dependency inspection (yt-dlp & ffmpeg check)
│   └── engine_test.go    # Unit tests for downloader package
├── frontend/
│   └── src/
│       ├── index.html    # Clean semantic UI layout
│       ├── main.css      # Dark modern theme & micro-interactions
│       └── main.js       # App state, Wails RPC calls & real-time events
├── Makefile              # Build, test, and install targets
├── flowdl.desktop        # Linux desktop launcher entry
└── wails.json            # Wails project configuration
```
