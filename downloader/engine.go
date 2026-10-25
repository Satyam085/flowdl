package downloader

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	percentRegex = regexp.MustCompile(`([0-9\.]+)%`)
	destRegex    = regexp.MustCompile(`\[(?:download|Merger|ExtractAudio)\]\s+(?:Destination:\s+|Merging formats into\s+"?)([^"\r\n]+)`)
)

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// Engine manages active and finished download tasks
type Engine struct {
	mu         sync.RWMutex
	tasks      map[string]*DownloadTask
	cancels    map[string]context.CancelFunc
	onUpdate   func(task *DownloadTask)
	nodePath   string
	defaultDir string
}

// NewEngine creates a new downloader engine instance
func NewEngine(onUpdate func(task *DownloadTask)) *Engine {
	node, _ := exec.LookPath("node")
	home, _ := os.UserHomeDir()
	dlDir := filepath.Join(home, "Downloads")
	if _, err := os.Stat(dlDir); err != nil {
		dlDir = home
	}

	return &Engine{
		tasks:      make(map[string]*DownloadTask),
		cancels:    make(map[string]context.CancelFunc),
		onUpdate:   onUpdate,
		nodePath:   node,
		defaultDir: dlDir,
	}
}

// GetDefaultDir returns default download folder
func (e *Engine) GetDefaultDir() string {
	return e.defaultDir
}

// SetDefaultDir updates default download directory
func (e *Engine) SetDefaultDir(dir string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if dir != "" {
		e.defaultDir = dir
	}
}

// CreateTask adds a new task to queue
func (e *Engine) CreateTask(opts DownloadOptions) (*DownloadTask, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	saveDir := strings.TrimSpace(opts.SaveDir)
	if saveDir == "" {
		saveDir = e.defaultDir
	}

	quality := strings.TrimSpace(opts.Quality)
	if quality == "" {
		quality = "best"
	}

	formatType := strings.TrimSpace(opts.FormatType)
	if formatType == "" {
		formatType = "video"
	}

	audioFormat := strings.TrimSpace(opts.AudioFormat)
	if audioFormat == "" {
		audioFormat = "mp3"
	}

	ctx, cancel := context.WithCancel(context.Background())

	task := &DownloadTask{
		ID:          generateID(),
		URL:         opts.URL,
		Title:       opts.Title,
		SaveDir:     saveDir,
		Quality:     quality,
		FormatType:  formatType,
		AudioFormat: audioFormat,
		Status:      "queued",
		Progress:    0,
		Log:         "Waiting to start...",
		CreatedAt:   time.Now(),
	}

	if task.Title == "" {
		task.Title = opts.URL
	}

	e.tasks[task.ID] = task
	e.cancels[task.ID] = cancel
	e.notify(task)

	// Launch download asynchronously
	go e.runDownload(ctx, task, opts)

	return task, nil
}

// CancelTask terminates an in-flight download
func (e *Engine) CancelTask(id string) error {
	e.mu.Lock()
	cancel, hasCancel := e.cancels[id]
	task, hasTask := e.tasks[id]
	if !hasTask {
		e.mu.Unlock()
		return fmt.Errorf("task %s not found", id)
	}

	if hasCancel {
		cancel()
		delete(e.cancels, id)
	}

	task.Status = "cancelled"
	task.Log = "Download cancelled by user"
	now := time.Now()
	task.FinishedAt = &now
	e.mu.Unlock()

	e.notify(task)
	return nil
}

// GetAllTasks returns all tasks sorted by creation time (newest first)
func (e *Engine) GetAllTasks() []*DownloadTask {
	e.mu.RLock()
	defer e.mu.RUnlock()

	list := make([]*DownloadTask, 0, len(e.tasks))
	for _, t := range e.tasks {
		taskCopy := *t
		list = append(list, &taskCopy)
	}
	return list
}

// RemoveTask removes task record from history
func (e *Engine) RemoveTask(id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if cancel, exists := e.cancels[id]; exists {
		cancel()
		delete(e.cancels, id)
	}
	delete(e.tasks, id)
	return nil
}

// ClearFinished removes completed, failed, or cancelled tasks
func (e *Engine) ClearFinished() {
	e.mu.Lock()
	defer e.mu.Unlock()

	for id, t := range e.tasks {
		if t.Status == "completed" || t.Status == "error" || t.Status == "cancelled" {
			delete(e.tasks, id)
		}
	}
}

func (e *Engine) notify(task *DownloadTask) {
	if e.onUpdate != nil && task != nil {
		taskCopy := *task
		e.onUpdate(&taskCopy)
	}
}

func (e *Engine) runDownload(ctx context.Context, task *DownloadTask, opts DownloadOptions) {
	e.mu.Lock()
	if ctx.Err() != nil {
		e.mu.Unlock()
		return
	}
	task.Status = "downloading"
	task.Log = "Preparing download..."
	e.mu.Unlock()
	e.notify(task)

	defer func() {
		e.mu.Lock()
		delete(e.cancels, task.ID)
		e.mu.Unlock()
	}()

	// Ensure destination directory exists
	if err := os.MkdirAll(task.SaveDir, 0755); err != nil {
		e.finishError(task, fmt.Sprintf("Failed to create save directory: %v", err))
		return
	}

	args := []string{
		"--newline",
		"-P", task.SaveDir,
	}

	// Output template
	if opts.CustomFilename != "" {
		args = append(args, "-o", opts.CustomFilename)
	} else {
		args = append(args, "-o", "%(title)s.%(ext)s")
	}

	// Format selection
	if opts.FormatType == "audio" {
		args = append(args, "-x")
		audioFmt := opts.AudioFormat
		if audioFmt == "" {
			audioFmt = "mp3"
		}
		args = append(args, "--audio-format", audioFmt, "--audio-quality", "0")
	} else {
		// Video mode
		q := strings.ToLower(opts.Quality)
		switch {
		case q == "best" || q == "":
			args = append(args, "-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4")
		case strings.HasSuffix(q, "p"):
			height := strings.TrimSuffix(q, "p")
			fExpr := fmt.Sprintf("bestvideo[height<=%s]+bestaudio/best[height<=%s]/best", height, height)
			args = append(args, "-f", fExpr, "--merge-output-format", "mp4")
		default:
			args = append(args, "-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4")
		}
	}

	// Optional flags
	if opts.EmbedSubs {
		args = append(args, "--write-subs", "--write-auto-subs", "--embed-subs", "--sub-langs", "en.*,all")
	}
	if opts.EmbedThumbnail {
		args = append(args, "--embed-thumbnail")
	}
	if opts.EmbedMetadata {
		args = append(args, "--embed-metadata", "--embed-chapters")
	}
	if opts.DownloadPlaylist {
		args = append(args, "--yes-playlist")
	} else {
		args = append(args, "--no-playlist")
	}

	if e.nodePath != "" {
		args = append(args, "--js-runtimes", "node:"+e.nodePath)
	}

	// Structured progress template prefix
	args = append(args, "--progress-template", "download-meta:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_estimate_str,progress._total_bytes_str)s|%(progress._downloaded_bytes_str)s")

	args = append(args, task.URL)

	cmd := exec.CommandContext(ctx, "yt-dlp", args...)
	cmd.Cancel = func() error {
		if cmd.Process != nil {
			return cmd.Process.Kill()
		}
		return nil
	}

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		e.finishError(task, fmt.Sprintf("Error creating stdout pipe: %v", err))
		return
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		e.finishError(task, fmt.Sprintf("Error creating stderr pipe: %v", err))
		return
	}

	if err := cmd.Start(); err != nil {
		e.finishError(task, fmt.Sprintf("Failed to launch yt-dlp: %v", err))
		return
	}

	var stderrLines []string
	var errMu sync.Mutex

	// Read stderr in background
	go func() {
		scanner := bufio.NewScanner(stderrPipe)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				errMu.Lock()
				stderrLines = append(stderrLines, line)
				errMu.Unlock()
			}
		}
	}()

	// Parse stdout
	reader := bufio.NewReader(stdoutPipe)
	for {
		line, readErr := reader.ReadString('\n')
		line = strings.TrimSpace(line)

		if line != "" {
			e.parseOutputLine(task, line)
		}

		if readErr != nil {
			if readErr != io.EOF && ctx.Err() == nil {
				// Unexpected stream read error
			}
			break
		}
	}

	cmdErr := cmd.Wait()

	if ctx.Err() == context.Canceled {
		// Task already marked as cancelled
		return
	}

	if cmdErr != nil {
		errMu.Lock()
		errMsg := strings.Join(stderrLines, "\n")
		errMu.Unlock()
		if errMsg == "" {
			errMsg = cmdErr.Error()
		}
		e.finishError(task, errMsg)
		return
	}

	// Successful finish
	e.mu.Lock()
	task.Status = "completed"
	task.Progress = 100
	task.Speed = ""
	task.ETA = "Done"
	task.Log = "Download finished successfully"
	now := time.Now()
	task.FinishedAt = &now

	// If OutputFile was relative or empty, locate possible output
	if task.OutputFile != "" && !filepath.IsAbs(task.OutputFile) {
		task.OutputFile = filepath.Join(task.SaveDir, task.OutputFile)
	}
	e.mu.Unlock()

	e.notify(task)
}

func (e *Engine) parseOutputLine(task *DownloadTask, line string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Check for structured progress template
	if strings.HasPrefix(line, "download-meta:") {
		content := strings.TrimPrefix(line, "download-meta:")
		parts := strings.Split(content, "|")
		if len(parts) >= 5 {
			pctStr := strings.TrimSpace(parts[0])
			pctClean := strings.TrimSuffix(pctStr, "%")
			if pctVal, err := strconv.ParseFloat(pctClean, 64); err == nil {
				task.Progress = pctVal
			}
			task.Speed = strings.TrimSpace(parts[1])
			task.ETA = strings.TrimSpace(parts[2])
			task.TotalBytes = strings.TrimSpace(parts[3])
			task.DownloadedBytes = strings.TrimSpace(parts[4])
			task.Status = "downloading"
			task.Log = fmt.Sprintf("Downloading... %s (%s)", task.Speed, task.ETA)
		}
		e.notify(task)
		return
	}

	// Capture Destination file
	if m := destRegex.FindStringSubmatch(line); len(m) > 1 {
		destPath := strings.TrimSpace(m[1])
		if !filepath.IsAbs(destPath) {
			destPath = filepath.Join(task.SaveDir, destPath)
		}
		task.OutputFile = destPath
	}

	// Check post-processing steps
	if strings.Contains(line, "[Merger]") {
		task.Status = "processing"
		task.Log = "Merging video and audio streams..."
		e.notify(task)
		return
	}

	if strings.Contains(line, "[ExtractAudio]") {
		task.Status = "processing"
		task.Log = "Extracting audio track..."
		e.notify(task)
		return
	}

	if strings.Contains(line, "[EmbedSubtitle]") {
		task.Status = "processing"
		task.Log = "Embedding subtitles..."
		e.notify(task)
		return
	}

	if strings.Contains(line, "[ThumbnailsConvertor]") {
		task.Status = "processing"
		task.Log = "Embedding cover art..."
		e.notify(task)
		return
	}

	// Fallback percentage matching if template was missed
	if strings.Contains(line, "[download]") {
		if m := percentRegex.FindStringSubmatch(line); len(m) > 1 {
			if pct, err := strconv.ParseFloat(m[1], 64); err == nil {
				task.Progress = pct
				task.Status = "downloading"
				e.notify(task)
			}
		}
	}
}

func (e *Engine) finishError(task *DownloadTask, errMsg string) {
	e.mu.Lock()
	task.Status = "error"
	task.Error = errMsg
	task.Log = "Download failed"
	now := time.Now()
	task.FinishedAt = &now
	e.mu.Unlock()

	e.notify(task)
}
