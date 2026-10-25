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

	initialTitle := strings.TrimSpace(opts.Title)
	if initialTitle == "" {
		initialTitle = "Fetching stream title..."
	}

	task := &DownloadTask{
		ID:          generateID(),
		URL:         opts.URL,
		Title:       initialTitle,
		SaveDir:     saveDir,
		Quality:     quality,
		FormatType:  formatType,
		AudioFormat: audioFormat,
		Status:      "queued",
		Progress:    0,
		Log:         "Waiting to start...",
		CreatedAt:   time.Now(),
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

	// Structured progress template prefix with title, thumbnail, downloaded bytes, and total bytes
	args = append(args, "--progress-template", "download-meta:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_str,progress._total_bytes_estimate_str,info.filesize_str,info.filesize_approx_str)s|%(progress._downloaded_bytes_str)s|%(info.title)s|%(info.thumbnail)s|%(progress.downloaded_bytes)s|%(progress.total_bytes,progress.total_bytes_estimate,info.filesize,info.filesize_approx)s")

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

func formatBytes(b float64) string {
	const (
		KiB = 1024.0
		MiB = 1024.0 * KiB
		GiB = 1024.0 * MiB
		TiB = 1024.0 * GiB
	)
	switch {
	case b >= TiB:
		return fmt.Sprintf("%.2f TiB", b/TiB)
	case b >= GiB:
		return fmt.Sprintf("%.2f GiB", b/GiB)
	case b >= MiB:
		return fmt.Sprintf("%.2f MiB", b/MiB)
	case b >= KiB:
		return fmt.Sprintf("%.2f KiB", b/KiB)
	default:
		return fmt.Sprintf("%.0f B", b)
	}
}

func parseHumanBytes(s string) float64 {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "~")
	if s == "" || s == "NA" || s == "None" {
		return 0
	}

	numStr := ""
	unitStr := ""
	for i, r := range s {
		if (r >= '0' && r <= '9') || r == '.' {
			numStr += string(r)
		} else {
			unitStr = strings.TrimSpace(s[i:])
			break
		}
	}

	val, err := strconv.ParseFloat(numStr, 64)
	if err != nil {
		return 0
	}

	u := strings.ToUpper(unitStr)
	switch {
	case strings.HasPrefix(u, "T"):
		return val * 1024 * 1024 * 1024 * 1024
	case strings.HasPrefix(u, "G"):
		return val * 1024 * 1024 * 1024
	case strings.HasPrefix(u, "M"):
		return val * 1024 * 1024
	case strings.HasPrefix(u, "K"):
		return val * 1024
	default:
		return val
	}
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
			task.DownloadedBytes = strings.TrimSpace(parts[4])
			task.Status = "downloading"
			task.Log = fmt.Sprintf("Downloading... %s (%s)", task.Speed, task.ETA)

			// 1. Resolve human title from info dict if present
			if len(parts) >= 6 {
				titleFromInfo := strings.TrimSpace(parts[5])
				if titleFromInfo != "" && titleFromInfo != "NA" && titleFromInfo != "None" {
					task.Title = titleFromInfo
				}
			}

			// 2. Resolve thumbnail from info dict
			if len(parts) >= 7 {
				thumbFromInfo := strings.TrimSpace(parts[6])
				if thumbFromInfo != "" && thumbFromInfo != "NA" && thumbFromInfo != "None" && task.Thumbnail == "" {
					task.Thumbnail = thumbFromInfo
				}
			}

			// 3. Resolve TotalBytes and prevent "NA"
			rawDownloadedStr := ""
			if len(parts) >= 8 {
				rawDownloadedStr = strings.TrimSpace(parts[7])
			}
			rawTotalStr := ""
			if len(parts) >= 9 {
				rawTotalStr = strings.TrimSpace(parts[8])
			}

			formattedTotal := strings.TrimSpace(parts[3])
			if formattedTotal != "" && formattedTotal != "NA" && formattedTotal != "N/A" && formattedTotal != "None" {
				task.TotalBytes = formattedTotal
			} else if rawTotalStr != "" && rawTotalStr != "NA" && rawTotalStr != "N/A" && rawTotalStr != "None" {
				if totVal, err := strconv.ParseFloat(rawTotalStr, 64); err == nil && totVal > 0 {
					task.TotalBytes = formatBytes(totVal)
				}
			} else {
				// Estimate total size mathematically from progress percentage and downloaded bytes
				var dlBytes float64
				if rawDownloadedStr != "" && rawDownloadedStr != "NA" && rawDownloadedStr != "None" {
					dlBytes, _ = strconv.ParseFloat(rawDownloadedStr, 64)
				}
				if dlBytes == 0 && task.DownloadedBytes != "" {
					dlBytes = parseHumanBytes(task.DownloadedBytes)
				}

				if task.Progress > 0.5 && dlBytes > 0 {
					estTotal := dlBytes / (task.Progress / 100.0)
					task.TotalBytes = "~" + formatBytes(estTotal)
				} else {
					task.TotalBytes = ""
				}
			}
		}
		e.notify(task)
		return
	}

	// Capture Destination file and title fallback
	if m := destRegex.FindStringSubmatch(line); len(m) > 1 {
		destPath := strings.TrimSpace(m[1])
		if !filepath.IsAbs(destPath) {
			destPath = filepath.Join(task.SaveDir, destPath)
		}
		task.OutputFile = destPath

		// Extract base filename without extension as title fallback
		base := filepath.Base(destPath)
		ext := filepath.Ext(base)
		fileTitle := strings.TrimSuffix(base, ext)
		if fileTitle != "" && (task.Title == "" || task.Title == "Fetching stream title..." || strings.HasPrefix(task.Title, "http://") || strings.HasPrefix(task.Title, "https://")) {
			task.Title = fileTitle
		}
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
