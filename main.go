package main

import (
	"embed"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

//go:embed all:frontend/src
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func init() {
	// Ensure common binary locations are in PATH when launched from desktop environments
	home, err := os.UserHomeDir()
	if err == nil {
		path := os.Getenv("PATH")
		commonDirs := []string{
			filepath.Join(home, ".local", "bin"),
			filepath.Join(home, "bin"),
			"/usr/local/bin",
			"/usr/bin",
			"/bin",
		}
		for _, dir := range commonDirs {
			if !strings.Contains(path, dir) {
				path = dir + string(os.PathListSeparator) + path
			}
		}
		os.Setenv("PATH", path)
	}
}

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "FlowDL — Elegant yt-dlp Studio",
		Width:     1120,
		Height:    780,
		MinWidth:  860,
		MinHeight: 620,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 15, G: 20, B: 28, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		Linux: &linux.Options{
			Icon:                appIcon,
			ProgramName:         "flowdl",
			WindowIsTranslucent: false,
			WebviewGpuPolicy:    linux.WebviewGpuPolicyOnDemand,
		},
	})

	if err != nil {
		println("Error starting FlowDL:", err.Error())
	}
}
