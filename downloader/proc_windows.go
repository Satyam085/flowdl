//go:build windows

package downloader

import "os/exec"

func setProcGroup(*exec.Cmd) {}

// ponytail: kills yt-dlp only, ffmpeg children may survive; use a job object if that matters on Windows
func killProcGroup(cmd *exec.Cmd) error {
	return cmd.Process.Kill()
}
