package downloader

import (
	"time"
)

// MediaInfo contains inspected metadata for a given URL
type MediaInfo struct {
	URL                  string   `json:"url"`
	Title                string   `json:"title"`
	Uploader             string   `json:"uploader"`
	Duration             int      `json:"duration"`
	DurationStr          string   `json:"durationStr"`
	Thumbnail            string   `json:"thumbnail"`
	Description          string   `json:"description"`
	IsPlaylist           bool     `json:"isPlaylist"`
	PlaylistCount        int      `json:"playlistCount"`
	AvailableResolutions []string `json:"availableResolutions"`
}

// DownloadOptions defines configuration for a download task
type DownloadOptions struct {
	URL              string `json:"url"`
	Title            string `json:"title"`
	SaveDir          string `json:"saveDir"`
	Quality          string `json:"quality"`          // "best", "2160p", "1440p", "1080p", "720p", "480p", "360p"
	FormatType       string `json:"formatType"`       // "video" or "audio"
	AudioFormat      string `json:"audioFormat"`      // "mp3", "m4a", "flac", "opus", "wav"
	EmbedSubs        bool   `json:"embedSubs"`        // embed subtitles
	EmbedThumbnail   bool   `json:"embedThumbnail"`   // embed cover art / thumbnail
	EmbedMetadata    bool   `json:"embedMetadata"`    // embed tags, chapter markers
	CustomFilename   string `json:"customFilename"`   // custom template or prefix
	DownloadPlaylist bool   `json:"downloadPlaylist"` // whether to download entire playlist if URL is playlist
}

// DownloadTask represents an active, completed, or failed download
type DownloadTask struct {
	ID              string     `json:"id"`
	URL             string     `json:"url"`
	Title           string     `json:"title"`
	Uploader        string     `json:"uploader"`
	Thumbnail       string     `json:"thumbnail"`
	DurationStr     string     `json:"durationStr"`
	SaveDir         string     `json:"saveDir"`
	OutputFile      string     `json:"outputFile"`
	Quality         string     `json:"quality"`
	FormatType      string     `json:"formatType"`
	AudioFormat     string     `json:"audioFormat"`
	Status          string     `json:"status"` // "queued", "fetching", "downloading", "processing", "completed", "error", "cancelled"
	Progress        float64    `json:"progress"`
	Speed           string     `json:"speed"`
	ETA             string     `json:"eta"`
	DownloadedBytes string     `json:"downloadedBytes"`
	TotalBytes      string     `json:"totalBytes"`
	Log             string     `json:"log"`
	Error           string     `json:"error,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	FinishedAt      *time.Time `json:"finishedAt,omitempty"`
}

// DependencyStatus reports whether system tools are detected
type DependencyStatus struct {
	YtDlpInstalled  bool   `json:"ytDlpInstalled"`
	YtDlpVersion    string `json:"ytDlpVersion"`
	FFmpegInstalled bool   `json:"ffmpegInstalled"`
	FFmpegVersion   string `json:"ffmpegVersion"`
}
