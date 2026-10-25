package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"ytdl-wrapper/downloader"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx    context.Context
	engine *downloader.Engine
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.engine = downloader.NewEngine(func(task *downloader.DownloadTask) {
		runtime.EventsEmit(a.ctx, "task:update", task)
	})
}

// FetchInfo inspects metadata for a given URL
func (a *App) FetchInfo(mediaURL string) (*downloader.MediaInfo, error) {
	return downloader.FetchMediaInfo(a.ctx, mediaURL)
}

// AddDownload starts a single download task
func (a *App) AddDownload(opts downloader.DownloadOptions) (*downloader.DownloadTask, error) {
	if a.engine == nil {
		return nil, fmt.Errorf("engine not initialized")
	}
	return a.engine.CreateTask(opts)
}

// AddBatchDownloads enqueues multiple URLs with the same base options
func (a *App) AddBatchDownloads(urls []string, baseOpts downloader.DownloadOptions) ([]*downloader.DownloadTask, error) {
	if a.engine == nil {
		return nil, fmt.Errorf("engine not initialized")
	}

	var tasks []*downloader.DownloadTask
	for _, u := range urls {
		u = strings.TrimSpace(u)
		if u == "" {
			continue
		}
		itemOpts := baseOpts
		itemOpts.URL = u
		task, err := a.engine.CreateTask(itemOpts)
		if err == nil {
			tasks = append(tasks, task)
		}
	}
	return tasks, nil
}

// CancelDownload cancels an active download
func (a *App) CancelDownload(id string) error {
	if a.engine == nil {
		return fmt.Errorf("engine not initialized")
	}
	return a.engine.CancelTask(id)
}

// GetDownloads retrieves all tasks
func (a *App) GetDownloads() []*downloader.DownloadTask {
	if a.engine == nil {
		return []*downloader.DownloadTask{}
	}
	return a.engine.GetAllTasks()
}

// RemoveDownload removes a task record
func (a *App) RemoveDownload(id string) error {
	if a.engine == nil {
		return fmt.Errorf("engine not initialized")
	}
	return a.engine.RemoveTask(id)
}

// ClearFinishedDownloads clears completed or failed tasks
func (a *App) ClearFinishedDownloads() error {
	if a.engine == nil {
		return fmt.Errorf("engine not initialized")
	}
	a.engine.ClearFinished()
	return nil
}

// SelectDirectory opens the native system directory chooser
func (a *App) SelectDirectory(currentDir string) (string, error) {
	if currentDir == "" && a.engine != nil {
		currentDir = a.engine.GetDefaultDir()
	}

	selectedDir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		DefaultDirectory: currentDir,
		Title:            "Select Download Directory",
	})
	if err != nil {
		return "", err
	}
	if selectedDir != "" && a.engine != nil {
		a.engine.SetDefaultDir(selectedDir)
	}
	return selectedDir, nil
}

// GetDefaultSaveDir returns default save directory
func (a *App) GetDefaultSaveDir() string {
	if a.engine != nil {
		return a.engine.GetDefaultDir()
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Downloads")
}

// OpenFolder opens the target folder in the system file manager
func (a *App) OpenFolder(folderPath string) error {
	if folderPath == "" {
		folderPath = a.GetDefaultSaveDir()
	}
	return exec.Command("xdg-open", folderPath).Start()
}

// OpenFile opens a downloaded video/audio file in default player
func (a *App) OpenFile(filePath string) error {
	if filePath == "" {
		return fmt.Errorf("file path is empty")
	}
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("file does not exist: %s", filePath)
	}
	return exec.Command("xdg-open", filePath).Start()
}

// GetDependencyStatus checks yt-dlp and ffmpeg presence
func (a *App) GetDependencyStatus() downloader.DependencyStatus {
	return downloader.CheckDependencies()
}
