#!/usr/bin/env bash
set -euo pipefail

# Build FlowDL AppImage
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPDIR="${ROOT_DIR}/build/AppDir"
OUTPUT_DIR="${ROOT_DIR}/build/bin"

echo "==> 1. Compiling FlowDL binary..."
cd "${ROOT_DIR}"
make build

echo "==> 2. Preparing AppDir..."
rm -rf "${APPDIR}"
mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/usr/share/applications"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/256x256/apps"

# Copy binary
cp "${OUTPUT_DIR}/flowdl" "${APPDIR}/usr/bin/flowdl"
chmod +x "${APPDIR}/usr/bin/flowdl"

# Copy desktop file
cp "${ROOT_DIR}/flowdl.desktop" "${APPDIR}/flowdl.desktop"
cp "${ROOT_DIR}/flowdl.desktop" "${APPDIR}/usr/share/applications/flowdl.desktop"

# Copy icon
if [ -f "${ROOT_DIR}/build/appicon.png" ]; then
    cp "${ROOT_DIR}/build/appicon.png" "${APPDIR}/flowdl.png"
    cp "${ROOT_DIR}/build/appicon.png" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/flowdl.png"
fi

# Create AppRun launcher
cat << 'EOF' > "${APPDIR}/AppRun"
#!/bin/sh
HERE="$(dirname "$(readlink -f "${0}")")"
export PATH="${HERE}/usr/bin:${PATH}"
exec "${HERE}/usr/bin/flowdl" "$@"
EOF
chmod +x "${APPDIR}/AppRun"

echo "==> 3. Generating AppImage using appimagetool..."
if ! command -v appimagetool &> /dev/null; then
    echo "Notice: appimagetool is not installed locally."
    echo "To produce the final .AppImage file locally, download appimagetool:"
    echo "  wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    echo "  chmod +x appimagetool-x86_64.AppImage"
    echo "  ./appimagetool-x86_64.AppImage build/AppDir build/bin/FlowDL-x86_64.AppImage"
    echo "(Note: This is automatically automated in GitHub Actions on every release!)"
    exit 0
fi

appimagetool "${APPDIR}" "${OUTPUT_DIR}/FlowDL-x86_64.AppImage"
echo "==> Success: Created ${OUTPUT_DIR}/FlowDL-x86_64.AppImage"
