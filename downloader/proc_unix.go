//go:build !windows

package downloader

import (
	"os/exec"
	"syscall"
)

// setProcGroup puts yt-dlp in its own process group so killProcGroup reaches its ffmpeg children.
func setProcGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func killProcGroup(cmd *exec.Cmd) error {
	return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
}
