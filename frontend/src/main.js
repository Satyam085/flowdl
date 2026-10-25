// FlowDL - Application Frontend Logic

let appState = {
  mode: 'single', // 'single' or 'batch'
  saveDir: '',
  formatType: 'video', // 'video' or 'audio'
  quality: 'best',
  audioFormat: 'mp3',
  tasks: {}, // id -> task object
  activeFilter: 'all', // 'all', 'active', 'completed'
  inspectedInfo: null
};

// DOM Elements
const currentSavePathEl = document.getElementById('currentSavePath');
const btnChangeDirEl = document.getElementById('btnChangeDir');
const btnOpenFolderEl = document.getElementById('btnOpenFolder');
const ytdlpBadgeEl = document.getElementById('ytdlpBadge');

const tabSingleEl = document.getElementById('tabSingle');
const tabBatchEl = document.getElementById('tabBatch');
const singleUrlGroupEl = document.getElementById('singleUrlGroup');
const batchUrlGroupEl = document.getElementById('batchUrlGroup');
const urlInputEl = document.getElementById('urlInput');
const btnClearUrlEl = document.getElementById('btnClearUrl');
const batchUrlsInputEl = document.getElementById('batchUrlsInput');
const btnInspectEl = document.getElementById('btnInspect');
const inspectBtnTextEl = document.getElementById('inspectBtnText');
const inspectSpinnerEl = document.getElementById('inspectSpinner');
const btnPasteClipEl = document.getElementById('btnPasteClip');

const mediaPreviewEl = document.getElementById('mediaPreview');
const previewThumbEl = document.getElementById('previewThumb');
const previewDurationEl = document.getElementById('previewDuration');
const previewTitleEl = document.getElementById('previewTitle');
const previewUploaderEl = document.getElementById('previewUploader');
const previewResolutionsEl = document.getElementById('previewResolutions');

const formatTypeBtns = document.querySelectorAll('#formatTypeControl .seg-btn');
const videoQualityRowEl = document.getElementById('videoQualityRow');
const audioFormatRowEl = document.getElementById('audioFormatRow');
const videoQualityChips = document.querySelectorAll('#videoQualityChips .chip');
const audioFormatChips = document.querySelectorAll('#audioFormatChips .chip');

const chkEmbedSubsEl = document.getElementById('chkEmbedSubs');
const chkEmbedThumbEl = document.getElementById('chkEmbedThumb');
const chkEmbedMetaEl = document.getElementById('chkEmbedMeta');
const chkPlaylistEl = document.getElementById('chkPlaylist');

const btnDownloadEl = document.getElementById('btnDownload');
const btnDownloadTextEl = document.getElementById('btnDownloadText');

const queueListEl = document.getElementById('queueList');
const emptyStateEl = document.getElementById('emptyState');
const countAllEl = document.getElementById('countAll');
const countActiveEl = document.getElementById('countActive');
const countCompletedEl = document.getElementById('countCompleted');
const filterBtns = document.querySelectorAll('.filter-btn');
const btnClearFinishedEl = document.getElementById('btnClearFinished');
const toastContainerEl = document.getElementById('toastContainer');

// Initialization
window.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupFormatControls();
  setupToggles();
  setupQueueControls();
  setupInputHandlers();

  // Wait for Wails runtime bridge
  const checkWails = setInterval(async () => {
    if (window.go && window.go.main && window.go.main.App) {
      clearInterval(checkWails);
      await initBackend();
    }
  }, 50);
});

async function initBackend() {
  try {
    // 1. Save directory
    const dir = await window.go.main.App.GetDefaultSaveDir();
    setSaveDirectory(dir);

    // 2. Dependencies
    const dep = await window.go.main.App.GetDependencyStatus();
    if (dep.ytDlpInstalled) {
      ytdlpBadgeEl.textContent = `yt-dlp ${dep.ytDlpVersion || 'ready'}`;
      ytdlpBadgeEl.className = 'badge badge-completed';
    } else {
      ytdlpBadgeEl.textContent = 'yt-dlp missing';
      ytdlpBadgeEl.className = 'badge badge-error';
      showToast('yt-dlp CLI was not found in PATH', 'error');
    }

    // 3. Existing tasks
    const existing = await window.go.main.App.GetDownloads();
    if (Array.isArray(existing)) {
      existing.forEach(t => { appState.tasks[t.id] = t; });
      renderQueue();
    }

    // 4. Listen to real-time events from Go backend
    if (window.runtime && window.runtime.EventsOn) {
      window.runtime.EventsOn('task:update', (task) => {
        appState.tasks[task.id] = task;
        renderTaskItem(task);
        updateCounters();
      });
    }
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

function setSaveDirectory(dir) {
  appState.saveDir = dir || '';
  currentSavePathEl.textContent = dir || 'Select folder...';
  currentSavePathEl.title = dir || '';
}

// Directory chooser
btnChangeDirEl.addEventListener('click', async () => {
  try {
    const chosen = await window.go.main.App.SelectDirectory(appState.saveDir);
    if (chosen) {
      setSaveDirectory(chosen);
      showToast(`Save directory set to: ${chosen}`, 'success');
    }
  } catch (err) {
    showToast('Failed to select directory', 'error');
  }
});

btnOpenFolderEl.addEventListener('click', async () => {
  try {
    await window.go.main.App.OpenFolder(appState.saveDir);
  } catch (err) {
    showToast('Failed to open folder', 'error');
  }
});

// Single vs Batch Tabs
function setupTabs() {
  tabSingleEl.addEventListener('click', () => {
    appState.mode = 'single';
    tabSingleEl.classList.add('active');
    tabBatchEl.classList.remove('active');
    singleUrlGroupEl.style.display = 'flex';
    batchUrlGroupEl.style.display = 'none';
    btnDownloadTextEl.textContent = 'Start Download';
  });

  tabBatchEl.addEventListener('click', () => {
    appState.mode = 'batch';
    tabBatchEl.classList.add('active');
    tabSingleEl.classList.remove('active');
    singleUrlGroupEl.style.display = 'none';
    batchUrlGroupEl.style.display = 'flex';
    mediaPreviewEl.style.display = 'none';
    updateBatchCount();
  });
}

// Input Handlers
function setupInputHandlers() {
  urlInputEl.addEventListener('input', () => {
    btnClearUrlEl.style.display = urlInputEl.value.trim() ? 'block' : 'none';
  });

  btnClearUrlEl.addEventListener('click', () => {
    urlInputEl.value = '';
    btnClearUrlEl.style.display = 'none';
    mediaPreviewEl.style.display = 'none';
    appState.inspectedInfo = null;
    urlInputEl.focus();
  });

  btnPasteClipEl.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      if (appState.mode === 'single') {
        urlInputEl.value = text.trim();
        btnClearUrlEl.style.display = 'block';
        inspectURL();
      } else {
        const cur = batchUrlsInputEl.value;
        batchUrlsInputEl.value = cur ? cur + '\n' + text.trim() : text.trim();
        updateBatchCount();
      }
      showToast('Pasted from clipboard', 'info');
    } catch (e) {
      showToast('Clipboard access unavailable: paste directly into input', 'info');
    }
  });

  batchUrlsInputEl.addEventListener('input', updateBatchCount);

  btnInspectEl.addEventListener('click', inspectURL);

  urlInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (appState.inspectedInfo) {
        startDownload();
      } else {
        inspectURL();
      }
    }
  });
}

function updateBatchCount() {
  if (appState.mode !== 'batch') return;
  const urls = getBatchURLs();
  btnDownloadTextEl.textContent = urls.length > 0 ? `Download Batch (${urls.length})` : 'Start Batch Download';
}

function getBatchURLs() {
  const raw = batchUrlsInputEl.value || '';
  return raw
    .split(/[\r\n,]+/)
    .map(s => s.trim())
    .filter(s => s.startsWith('http://') || s.startsWith('https://'));
}

// URL Metadata Inspection
async function inspectURL() {
  const url = urlInputEl.value.trim();
  if (!url) {
    showToast('Please enter a valid URL', 'error');
    return;
  }

  inspectSpinnerEl.style.display = 'inline-block';
  inspectBtnTextEl.textContent = 'Inspecting...';
  btnInspectEl.disabled = true;

  try {
    const info = await window.go.main.App.FetchInfo(url);
    appState.inspectedInfo = info;
    renderPreview(info);
    showToast('Video details loaded', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to inspect URL: ' + (err.message || err), 'error');
  } finally {
    inspectSpinnerEl.style.display = 'none';
    inspectBtnTextEl.textContent = 'Inspect';
    btnInspectEl.disabled = false;
  }
}

function renderPreview(info) {
  if (!info) {
    mediaPreviewEl.style.display = 'none';
    return;
  }

  mediaPreviewEl.style.display = 'flex';
  previewThumbEl.src = info.thumbnail || '';
  previewDurationEl.textContent = info.durationStr || '--:--';
  previewTitleEl.textContent = info.title || 'Untitled';
  previewUploaderEl.textContent = info.uploader || (info.isPlaylist ? `Playlist with ${info.playlistCount} items` : 'Unknown Channel');

  // Available resolutions
  previewResolutionsEl.innerHTML = '';
  if (info.isPlaylist) {
    const pill = document.createElement('span');
    pill.className = 'meta-pill';
    pill.textContent = `Playlist (${info.playlistCount} videos)`;
    previewResolutionsEl.appendChild(pill);
  }
  if (Array.isArray(info.availableResolutions)) {
    info.availableResolutions.slice(0, 5).forEach(res => {
      const pill = document.createElement('span');
      pill.className = 'meta-pill';
      pill.textContent = res;
      previewResolutionsEl.appendChild(pill);
    });
  }
}

// Format & Quality Controls
function setupFormatControls() {
  formatTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      formatTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.getAttribute('data-type');
      appState.formatType = type;

      if (type === 'video') {
        videoQualityRowEl.style.display = 'flex';
        audioFormatRowEl.style.display = 'none';
      } else {
        videoQualityRowEl.style.display = 'none';
        audioFormatRowEl.style.display = 'flex';
      }
    });
  });

  videoQualityChips.forEach(chip => {
    chip.addEventListener('click', () => {
      videoQualityChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      appState.quality = chip.getAttribute('data-quality');
    });
  });

  audioFormatChips.forEach(chip => {
    chip.addEventListener('click', () => {
      audioFormatChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      appState.audioFormat = chip.getAttribute('data-audio');
    });
  });
}

function setupToggles() {
  // Checkbox listeners already bound via values
}

// Download execution
btnDownloadEl.addEventListener('click', startDownload);

async function startDownload() {
  const baseOpts = {
    saveDir: appState.saveDir,
    quality: appState.quality,
    formatType: appState.formatType,
    audioFormat: appState.audioFormat,
    embedSubs: chkEmbedSubsEl.checked,
    embedThumbnail: chkEmbedThumbEl.checked,
    embedMetadata: chkEmbedMetaEl.checked,
    downloadPlaylist: chkPlaylistEl.checked
  };

  if (appState.mode === 'single') {
    const url = urlInputEl.value.trim();
    if (!url) {
      showToast('Please provide a URL to download', 'error');
      return;
    }

    baseOpts.url = url;
    if (appState.inspectedInfo && appState.inspectedInfo.title) {
      baseOpts.title = appState.inspectedInfo.title;
    }

    try {
      const task = await window.go.main.App.AddDownload(baseOpts);
      appState.tasks[task.id] = task;
      renderTaskItem(task);
      updateCounters();
      showToast('Download started', 'success');

      // Clear input and preview
      urlInputEl.value = '';
      btnClearUrlEl.style.display = 'none';
      mediaPreviewEl.style.display = 'none';
      appState.inspectedInfo = null;
    } catch (err) {
      showToast('Error starting download: ' + (err.message || err), 'error');
    }
  } else {
    // Batch mode
    const urls = getBatchURLs();
    if (urls.length === 0) {
      showToast('Please enter at least one valid URL in the batch box', 'error');
      return;
    }

    try {
      const tasks = await window.go.main.App.AddBatchDownloads(urls, baseOpts);
      if (Array.isArray(tasks)) {
        tasks.forEach(t => { appState.tasks[t.id] = t; });
        renderQueue();
        showToast(`Queued ${tasks.length} download(s)`, 'success');
        batchUrlsInputEl.value = '';
        updateBatchCount();
      }
    } catch (err) {
      showToast('Error queuing batch: ' + (err.message || err), 'error');
    }
  }
}

// Queue Management & Rendering
function setupQueueControls() {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.activeFilter = btn.getAttribute('data-filter');
      renderQueue();
    });
  });

  btnClearFinishedEl.addEventListener('click', async () => {
    try {
      await window.go.main.App.ClearFinishedDownloads();
      for (const id in appState.tasks) {
        const s = appState.tasks[id].status;
        if (s === 'completed' || s === 'error' || s === 'cancelled') {
          delete appState.tasks[id];
        }
      }
      renderQueue();
      showToast('Finished downloads cleared', 'info');
    } catch (err) {
      console.error(err);
    }
  });
}

function updateCounters() {
  const all = Object.values(appState.tasks);
  const active = all.filter(t => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued');
  const completed = all.filter(t => t.status === 'completed');

  countAllEl.textContent = all.length;
  countActiveEl.textContent = active.length;
  countCompletedEl.textContent = completed.length;
}

function getFilteredTasks() {
  const all = Object.values(appState.tasks).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (appState.activeFilter === 'active') {
    return all.filter(t => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued');
  }
  if (appState.activeFilter === 'completed') {
    return all.filter(t => t.status === 'completed');
  }
  return all;
}

function renderQueue() {
  updateCounters();
  const tasks = getFilteredTasks();

  if (tasks.length === 0) {
    emptyStateEl.style.display = 'flex';
    // Remove all task elements
    const items = queueListEl.querySelectorAll('.task-item');
    items.forEach(el => el.remove());
    return;
  }

  emptyStateEl.style.display = 'none';

  // Render or update each task
  tasks.forEach(t => renderTaskItem(t));

  // Remove any DOM elements no longer in state
  const existingEls = queueListEl.querySelectorAll('.task-item');
  existingEls.forEach(el => {
    const id = el.getAttribute('data-id');
    if (!appState.tasks[id]) {
      el.remove();
    }
  });
}

function renderTaskItem(task) {
  let itemEl = queueListEl.querySelector(`.task-item[data-id="${task.id}"]`);

  // Check filter visibility
  if (appState.activeFilter === 'active' && !(task.status === 'downloading' || task.status === 'processing' || task.status === 'queued')) {
    if (itemEl) itemEl.remove();
    return;
  }
  if (appState.activeFilter === 'completed' && task.status !== 'completed') {
    if (itemEl) itemEl.remove();
    return;
  }

  emptyStateEl.style.display = 'none';

  if (!itemEl) {
    itemEl = document.createElement('div');
    itemEl.className = 'task-item';
    itemEl.setAttribute('data-id', task.id);
    queueListEl.prepend(itemEl);
  }

  const isAudio = task.formatType === 'audio';
  const formatBadge = isAudio ? `🎵 ${task.audioFormat.toUpperCase()}` : `🎬 ${task.quality.toUpperCase()}`;
  const statusBadge = getStatusBadge(task.status);

  const speedEta = (task.speed || task.eta) ? `${task.speed || ''} ${task.eta ? '• ETA ' + task.eta : ''}` : '';
  const sizeText = (task.downloadedBytes && task.totalBytes) ? `${task.downloadedBytes} / ${task.totalBytes}` : '';

  itemEl.innerHTML = `
    <div class="task-thumb-wrap">
      ${task.thumbnail ? `<img src="${task.thumbnail}" alt="thumb" />` : `
        <div class="task-thumb-icon">
          ${isAudio ? '🎵' : '🎬'}
        </div>
      `}
    </div>

    <div class="task-content">
      <div class="task-top-row">
        <span class="task-title" title="${escapeHtml(task.title || task.url)}">${escapeHtml(task.title || task.url)}</span>
        <div class="task-badges">
          <span class="badge ${isAudio ? 'badge-audio' : 'badge-video'}">${formatBadge}</span>
          ${statusBadge}
        </div>
      </div>

      <div class="progress-container">
        <div class="progress-fill ${task.status === 'completed' ? 'completed' : (task.status === 'error' ? 'error' : '')}" 
             style="width: ${Math.min(100, Math.max(0, task.progress))}%;"></div>
      </div>

      <div class="task-bottom-row">
        <span>${escapeHtml(task.log || (task.status === 'completed' ? 'Download finished' : 'In queue...'))}</span>
        <div class="task-meta-info">
          ${sizeText ? `<span>${sizeText}</span>` : ''}
          ${speedEta ? `<span>${speedEta}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="task-actions">
      ${(task.status === 'downloading' || task.status === 'processing') ? `
        <button class="btn-action btn-danger" onclick="cancelTask('${task.id}')" title="Cancel Download">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      ` : ''}

      ${task.status === 'completed' ? `
        <button class="btn-action btn-play" onclick="playTaskFile('${task.id}')" title="Play Media File">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
        <button class="btn-action" onclick="openTaskFolder('${task.id}')" title="Show in Folder">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </button>
      ` : ''}

      ${(task.status === 'completed' || task.status === 'error' || task.status === 'cancelled') ? `
        <button class="btn-action" onclick="removeTask('${task.id}')" title="Dismiss from list">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      ` : ''}
    </div>
  `;
}

function getStatusBadge(status) {
  switch (status) {
    case 'downloading':
      return `<span class="badge badge-downloading">Downloading</span>`;
    case 'processing':
      return `<span class="badge badge-processing">Processing</span>`;
    case 'completed':
      return `<span class="badge badge-completed">Completed</span>`;
    case 'error':
      return `<span class="badge badge-error">Failed</span>`;
    case 'cancelled':
      return `<span class="badge badge-cancelled">Cancelled</span>`;
    default:
      return `<span class="badge badge-subtle">Queued</span>`;
  }
}

// Window actions invoked from task card buttons
window.cancelTask = async function(id) {
  try {
    await window.go.main.App.CancelDownload(id);
    showToast('Download cancelled', 'info');
  } catch (err) {
    showToast('Failed to cancel: ' + (err.message || err), 'error');
  }
};

window.playTaskFile = async function(id) {
  const task = appState.tasks[id];
  if (!task || !task.outputFile) {
    showToast('Output file not found', 'error');
    return;
  }
  try {
    await window.go.main.App.OpenFile(task.outputFile);
  } catch (err) {
    showToast('Cannot open file: ' + (err.message || err), 'error');
  }
};

window.openTaskFolder = async function(id) {
  const task = appState.tasks[id];
  const dir = (task && task.saveDir) ? task.saveDir : appState.saveDir;
  try {
    await window.go.main.App.OpenFolder(dir);
  } catch (err) {
    showToast('Failed to open folder', 'error');
  }
};

window.removeTask = async function(id) {
  try {
    await window.go.main.App.RemoveDownload(id);
    delete appState.tasks[id];
    renderQueue();
  } catch (err) {
    console.error(err);
  }
};

// Toast Notifications
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainerEl.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
