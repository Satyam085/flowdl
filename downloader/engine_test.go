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

func TestFormatAndParseBytes(t *testing.T) {
	b := 350.0 * 1024 * 1024
	formatted := formatBytes(b)
	if formatted != "350.00 MiB" {
		t.Errorf("expected '350.00 MiB', got %q", formatted)
	}

	parsed := parseHumanBytes("350.00MiB")
	if parsed != b {
		t.Errorf("expected %f, got %f", b, parsed)
	}

	parsedG := parseHumanBytes("1.5GiB")
	expectedG := 1.5 * 1024 * 1024 * 1024
	if parsedG != expectedG {
		t.Errorf("expected %f, got %f", expectedG, parsedG)
	}
}

func TestParseOutputLineTitleAndTotal(t *testing.T) {
	engine := NewEngine(nil)
	task := &DownloadTask{
		ID:    "test-1",
		Title: "Fetching stream title...",
		URL:   "https://www.youtube.com/watch?v=sample123",
	}

	// Line with title in info and NA total, but valid progress and downloaded bytes
	line := "download-meta: 50.0%|4.20MiB/s|00:20|NA|350.00MiB|Never Gonna Give You Up|https://img.yt.com/123.jpg|367001600|NA"
	engine.parseOutputLine(task, line)

	if task.Title != "Never Gonna Give You Up" {
		t.Errorf("expected Title to update to 'Never Gonna Give You Up', got %q", task.Title)
	}
	if task.Thumbnail != "https://img.yt.com/123.jpg" {
		t.Errorf("expected Thumbnail to update, got %q", task.Thumbnail)
	}
	// TotalBytes should be estimated mathematically rather than showing NA
	if task.TotalBytes != "~700.00 MiB" {
		t.Errorf("expected TotalBytes to be '~700.00 MiB', got %q", task.TotalBytes)
	}

	// Line with destination filename fallback
	task2 := &DownloadTask{
		ID:    "test-2",
		Title: "Fetching stream title...",
		URL:   "https://www.youtube.com/watch?v=sample456",
	}
	destLine := `[download] Destination: /home/satyam/Downloads/Awesome Artist - Great Song.mp4`
	engine.parseOutputLine(task2, destLine)

	if task2.Title != "Awesome Artist - Great Song" {
		t.Errorf("expected Title fallback from filename to be 'Awesome Artist - Great Song', got %q", task2.Title)
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
