package downloader

import (
	"context"
	"testing"
	"time"
)

func TestCheckDependencies(t *testing.T) {
	status := CheckDependencies()
	if !status.YtDlpInstalled {
		t.Errorf("expected yt-dlp to be installed, got false")
	}
	if status.YtDlpVersion == "" {
		t.Errorf("expected yt-dlp version, got empty")
	}
	if !status.FFmpegInstalled {
		t.Errorf("expected ffmpeg to be installed, got false")
	}
	t.Logf("yt-dlp version: %s, ffmpeg: %s", status.YtDlpVersion, status.FFmpegVersion)
}

func TestFormatDuration(t *testing.T) {
	cases := []struct {
		sec  int
		want string
	}{
		{0, "--:--"},
		{45, "0:45"},
		{213, "3:33"},
		{3661, "1:01:01"},
	}

	for _, c := range cases {
		got := FormatDuration(c.sec)
		if got != c.want {
			t.Errorf("FormatDuration(%d) = %q, want %q", c.sec, got, c.want)
		}
	}
}

func TestEngineTaskLifecycle(t *testing.T) {
	updated := false
	engine := NewEngine(func(task *DownloadTask) {
		updated = true
	})

	opts := DownloadOptions{
		URL:        "https://example.com/test",
		Title:      "Test Video",
		Quality:    "1080p",
		FormatType: "video",
	}

	task, err := engine.CreateTask(opts)
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}

	if task.ID == "" {
		t.Errorf("expected non-empty task ID")
	}
	if task.Title != "Test Video" {
		t.Errorf("expected title 'Test Video', got %q", task.Title)
	}
	if !updated {
		t.Errorf("expected engine notify callback to fire")
	}

	// Immediate cancel to test process teardown
	err = engine.CancelTask(task.ID)
	if err != nil {
		t.Errorf("failed to cancel task: %v", err)
	}

	time.Sleep(100 * time.Millisecond)

	all := engine.GetAllTasks()
	if len(all) != 1 {
		t.Errorf("expected 1 task in queue, got %d", len(all))
	}

	engine.ClearFinished()
	allAfter := engine.GetAllTasks()
	if len(allAfter) != 0 {
		t.Errorf("expected 0 tasks after ClearFinished, got %d", len(allAfter))
	}
}

func TestFetchMediaInfoValidation(t *testing.T) {
	ctx := context.Background()
	_, err := FetchMediaInfo(ctx, "   ")
	if err == nil {
		t.Errorf("expected error on empty URL, got nil")
	}
}
