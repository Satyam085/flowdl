.PHONY: all build dev test clean install appimage

WAILS ?= /home/satyam/go/bin/wails
TAGS ?= webkit2_41
OUTPUT ?= build/bin/flowdl

all: build

build:
	@echo "Building FlowDL with tags: $(TAGS)..."
	$(WAILS) build -tags $(TAGS)

appimage: build
	@echo "Packaging AppImage..."
	./scripts/build-appimage.sh

dev:
	@echo "Running FlowDL in development mode..."
	$(WAILS) dev -tags $(TAGS)

test:
	@echo "Running tests..."
	go test -v ./downloader

clean:
	@echo "Cleaning build artifacts..."
	rm -rf build/bin build/AppDir

install: build
	@echo "Installing flowdl to ~/.local/bin..."
	mkdir -p $(HOME)/.local/bin
	cp $(OUTPUT) $(HOME)/.local/bin/flowdl
	chmod +x $(HOME)/.local/bin/flowdl
	@echo "Installing desktop launcher and icons..."
	mkdir -p $(HOME)/.local/share/applications
	cp flowdl.desktop $(HOME)/.local/share/applications/
	mkdir -p $(HOME)/.local/share/icons/hicolor/512x512/apps
	mkdir -p $(HOME)/.local/share/icons/hicolor/256x256/apps
	mkdir -p $(HOME)/.local/share/pixmaps
	cp build/appicon.png $(HOME)/.local/share/icons/hicolor/512x512/apps/flowdl.png
	cp build/flowdl.png $(HOME)/.local/share/icons/hicolor/256x256/apps/flowdl.png
	cp build/appicon.png $(HOME)/.local/share/pixmaps/flowdl.png
	@echo "Installation complete! You can run 'flowdl' from your terminal or desktop menu."
