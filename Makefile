.PHONY: all build dev test clean install

WAILS ?= /home/satyam/go/bin/wails
TAGS ?= webkit2_41
OUTPUT ?= build/bin/flowdl

all: build

build:
	@echo "Building FlowDL with tags: $(TAGS)..."
	$(WAILS) build -tags $(TAGS)

dev:
	@echo "Running FlowDL in development mode..."
	$(WAILS) dev -tags $(TAGS)

test:
	@echo "Running tests..."
	go test -v ./downloader

clean:
	@echo "Cleaning build artifacts..."
	rm -rf build/bin

install: build
	@echo "Installing flowdl to ~/.local/bin..."
	mkdir -p $(HOME)/.local/bin
	cp $(OUTPUT) $(HOME)/.local/bin/flowdl
	chmod +x $(HOME)/.local/bin/flowdl
	@echo "Installing desktop launcher..."
	mkdir -p $(HOME)/.local/share/applications
	cp flowdl.desktop $(HOME)/.local/share/applications/
	@echo "Installation complete! You can run 'flowdl' from your terminal or desktop menu."
