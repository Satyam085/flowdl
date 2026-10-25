package downloader

import (
	"bytes"
	"os/exec"
	"strings"
)

// CheckDependencies inspects the system for yt-dlp and ffmpeg availability
func CheckDependencies() DependencyStatus {
	status := DependencyStatus{}

	// Check yt-dlp
	if path, err := exec.LookPath("yt-dlp"); err == nil && path != "" {
		status.YtDlpInstalled = true
		cmd := exec.Command("yt-dlp", "--version")
		var out bytes.Buffer
		cmd.Stdout = &out
		if err := cmd.Run(); err == nil {
			status.YtDlpVersion = strings.TrimSpace(out.String())
		}
	}

	// Check ffmpeg
	if path, err := exec.LookPath("ffmpeg"); err == nil && path != "" {
		status.FFmpegInstalled = true
		cmd := exec.Command("ffmpeg", "-version")
		var out bytes.Buffer
		cmd.Stdout = &out
		if err := cmd.Run(); err == nil {
			lines := strings.Split(out.String(), "\n")
			if len(lines) > 0 {
				status.FFmpegVersion = strings.TrimSpace(lines[0])
			}
		}
	}

	return status
}
