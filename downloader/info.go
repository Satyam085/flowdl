package downloader

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"
)

type rawMediaJSON struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Uploader    string `json:"uploader"`
	Duration    int    `json:"duration"`
	Thumbnail   string `json:"thumbnail"`
	Description string `json:"description"`
	Type        string `json:"_type"`
	Entries     []struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	} `json:"entries"`
	Formats []struct {
		FormatID   string  `json:"format_id"`
		Resolution string  `json:"resolution"`
		Height     int     `json:"height"`
		VCodec     string  `json:"vcodec"`
		ACodec     string  `json:"acodec"`
		Filesize   int64   `json:"filesize"`
		FilesizeAp int64   `json:"filesize_approx"`
	} `json:"formats"`
}

// FormatDuration converts seconds to mm:ss or hh:mm:ss
func FormatDuration(seconds int) string {
	if seconds <= 0 {
		return "--:--"
	}
	h := seconds / 3600
	m := (seconds % 3600) / 60
	s := seconds % 60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%d:%02d", m, s)
}

// FetchMediaInfo retrieves video or playlist metadata via yt-dlp --dump-single-json
func FetchMediaInfo(ctx context.Context, mediaURL string) (*MediaInfo, error) {
	mediaURL = strings.TrimSpace(mediaURL)
	if mediaURL == "" {
		return nil, fmt.Errorf("URL cannot be empty")
	}

	cmdCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	args := []string{
		"--dump-single-json",
		"--no-warnings",
		"--skip-download",
	}

	// Try using node if available in PATH or common paths to assist JS challenges
	if nodePath, err := exec.LookPath("node"); err == nil && nodePath != "" {
		args = append(args, "--js-runtimes", "node:"+nodePath)
	}

	args = append(args, mediaURL)

	cmd := exec.CommandContext(cmdCtx, "yt-dlp", args...)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg == "" {
			errMsg = err.Error()
		}
		return nil, fmt.Errorf("yt-dlp metadata failed: %s", errMsg)
	}

	var raw rawMediaJSON
	if err := json.Unmarshal(stdout.Bytes(), &raw); err != nil {
		return nil, fmt.Errorf("failed to parse metadata: %w", err)
	}

	info := &MediaInfo{
		URL:         mediaURL,
		Title:       raw.Title,
		Uploader:    raw.Uploader,
		Duration:    raw.Duration,
		DurationStr: FormatDuration(raw.Duration),
		Thumbnail:   raw.Thumbnail,
		Description: raw.Description,
	}

	if raw.Type == "playlist" || len(raw.Entries) > 0 {
		info.IsPlaylist = true
		info.PlaylistCount = len(raw.Entries)
		if info.Title == "" {
			info.Title = fmt.Sprintf("Playlist (%d videos)", len(raw.Entries))
		}
	}

	// Extract unique available video heights
	heightMap := make(map[int]bool)
	for _, f := range raw.Formats {
		if f.Height > 0 && f.VCodec != "none" && f.VCodec != "" {
			heightMap[f.Height] = true
		}
	}

	var heights []int
	for h := range heightMap {
		heights = append(heights, h)
	}
	// Sort descending (highest resolution first)
	sort.Sort(sort.Reverse(sort.IntSlice(heights)))

	var resList []string
	for _, h := range heights {
		resList = append(resList, strconv.Itoa(h)+"p")
	}
	info.AvailableResolutions = resList

	return info, nil
}
