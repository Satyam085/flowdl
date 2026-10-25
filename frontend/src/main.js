// FlowDL — Precision Desktop Interface Logic

let appState = {
  mode: 'single', // 'single' or 'batch'
  saveDir: '',
  formatType: 'video', // 'video' or 'audio'
  quality: 'best',
  audioFormat: 'mp3',
  tasks: {}, // id -> task
  activeFilter: 'all', // 'all', 'active', 'completed'
  inspectedInfo: null
};

// DOM References
const depDotEl = document.getElementById('depDot');
const depTextEl = document.getElementById('depText');
const currentSavePathEl = document.getElementById('currentSavePath');
const btnChangeDirEl = document.getElementById('btnChangeDir');
const btnOpenFolderEl = document.getElementById('btnOpenFolder');

const singleWrapEl = document.getElementById('singleWrap');
const batchWrapEl = document.getElementById('batchWrap');
const urlInputEl = document.getElementById('urlInput');
const btnClearUrlEl = document.getElementById('btnClearUrl');
const batchUrlsInputEl = document.getElementById('batchUrlsInput');
const tabModeToggleEl = document.getElementById('tabModeToggle');
const tabModeLabelEl = document.getElementById('tabModeLabel');
const btnPasteClipEl = document.getElementById('btnPasteClip');
const btnInspectEl = document.getElementById('btnInspect');
const inspectSpinnerEl = document.getElementById('inspectSpinner');
const inspectBtnTextEl = document.getElementById('inspectBtnText');
const btnDownloadEl = document.getElementById('btnDownload');
const btnDownloadTextEl = document.getElementById('btnDownloadText');

const mediaPreviewEl = document.getElementById('mediaPreview');
const previewThumbEl = document.getElementById('previewThumb');
const previewDurationEl = document.getElementById('previewDuration');
const previewTitleEl = document.getElementById('previewTitle');
const previewUploaderEl = document.getElementById('previewUploader');
const previewMetaTagsEl = document.getElementById('previewMetaTags');

const formatTypeBtns = document.querySelectorAll('#formatTypeControl .seg-item');
const videoQualityRowEl = document.getElementById('videoQualityRow');
const audioFormatRowEl = document.getElementById('audioFormatRow');
const videoQualityChips = document.querySelectorAll('#videoQualityChips .pill');
const audioFormatChips = document.querySelectorAll('#audioFormatChips .pill');

const chkEmbedSubsEl = document.getElementById('chkEmbedSubs');
const chkEmbedThumbEl = document.getElementById('chkEmbedThumb');
const chkEmbedMetaEl = document.getElementById('chkEmbedMeta');
const chkPlaylistEl = document.getElementById('chkPlaylist');

const ledgerTabs = document.querySelectorAll('.ledger-tab');
const countAllEl = document.getElementById('countAll');
const countActiveEl = document.getElementById('countActive');
const countCompletedEl = document.getElementById('countCompleted');
const btnClearFinishedEl = document.getElementById('btnClearFinished');
const queueListEl = document.getElementById('queueList');
const emptyStateEl = document.getElementById('emptyState');

const footerActiveCountEl = document.getElementById('footerActiveCount');
const footerSpeedEl = document.getElementById('footerSpeed');
const toastContainerEl = document.getElementById('toastContainer');

// Startup Lifecycle
window.addEventListener('DOMContentLoaded', () => {
  setupModeToggle();
  setupFormatOptions();
  setupLedgerFilters();
  setupInputListeners();

  const btnAuthorCreditEl = document.getElementById('btnAuthorCredit');
  if (btnAuthorCreditEl) {
    btnAuthorCreditEl.addEventListener('click', () => {
      const url = 'https://github.com/Satyam085';
      if (window.runtime && window.runtime.BrowserOpenURL) {
        window.runtime.BrowserOpenURL(url);
      } else {
        window.open(url, '_blank');
      }
    });
  }

  const wailsPoll = setInterval(async () => {
    if (window.go && window.go.main && window.go.main.App) {
      clearInterval(wailsPoll);
      await initSystem();
    }
  }, 40);
});

async function initSystem() {
  try {
    // 1. Initial Directory
    const dir = await window.go.main.App.GetDefaultSaveDir();
    setDirectory(dir);

    // 2. Telemetry
    const dep = await window.go.main.App.GetDependencyStatus();
    if (dep.ytDlpInstalled) {
      depDotEl.className = 'telemetry-dot ready';
      depTextEl.textContent = `yt-dlp ${dep.ytDlpVersion || 'ready'} • ffmpeg OK`;
    } else {
      depDotEl.className = 'telemetry-dot error';
      depTextEl.textContent = 'yt-dlp not found in PATH';
      showNotice('yt-dlp executable missing from PATH', 'error');
    }

    // 3. Queue state
    const currentTasks = await window.go.main.App.GetDownloads();
    if (Array.isArray(currentTasks)) {
      currentTasks.forEach(t => { appState.tasks[t.id] = t; });
      renderLedger();
    }

    // 4. Live streaming events
    if (window.runtime && window.runtime.EventsOn) {
      window.runtime.EventsOn('task:update', (task) => {
        appState.tasks[task.id] = task;
        renderLedgerRow(task);
        updateTelemetry();
      });
    }
  } catch (err) {
    console.error('System init error:', err);
  }
}

function setDirectory(dir) {
  appState.saveDir = dir || '';
  currentSavePathEl.textContent = dir || 'Select destination...';
  currentSavePathEl.title = dir || '';
}

// Directory chooser
btnChangeDirEl.addEventListener('click', async () => {
  try {
    const chosen = await window.go.main.App.SelectDirectory(appState.saveDir);
    if (chosen) {
      setDirectory(chosen);
      showNotice(`Output path: ${chosen}`, 'success');
    }
  } catch (err) {
    showNotice('Directory selection failed', 'error');
  }
});

btnOpenFolderEl.addEventListener('click', async () => {
  try {
    await window.go.main.App.OpenFolder(appState.saveDir);
  } catch (err) {
    showNotice('Failed to reveal directory', 'error');
  }
});

// Mode Toggle (Single URL <-> Batch URL list)
function setupModeToggle() {
  tabModeToggleEl.addEventListener('click', () => {
    if (appState.mode === 'single') {
      appState.mode = 'batch';
      tabModeLabelEl.textContent = 'Single';
      singleWrapEl.style.display = 'none';
      batchWrapEl.style.display = 'block';
      mediaPreviewEl.style.display = 'none';
      updateBatchMetrics();
      batchUrlsInputEl.focus();
    } else {
      appState.mode = 'single';
      tabModeLabelEl.textContent = 'Batch';
      singleWrapEl.style.display = 'flex';
      batchWrapEl.style.display = 'none';
      btnDownloadTextEl.textContent = 'Download';
      urlInputEl.focus();
    }
  });
}

function setupInputListeners() {
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

  batchUrlsInputEl.addEventListener('input', updateBatchMetrics);

  btnPasteClipEl.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      if (appState.mode === 'single') {
        urlInputEl.value = text.trim();
        btnClearUrlEl.style.display = 'block';
        inspectTarget();
      } else {
        const cur = batchUrlsInputEl.value;
        batchUrlsInputEl.value = cur ? cur + '\n' + text.trim() : text.trim();
        updateBatchMetrics();
      }
    } catch {
      showNotice('Clipboard read blocked — paste directly', 'info');
    }
  });

  btnInspectEl.addEventListener('click', inspectTarget);

  urlInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (appState.inspectedInfo) {
        dispatchDownload();
      } else {
        inspectTarget();
      }
    }
  });
}

function updateBatchMetrics() {
  if (appState.mode !== 'batch') return;
  const urls = parseBatchUrls();
  btnDownloadTextEl.textContent = urls.length > 0 ? `Download (${urls.length})` : 'Download Batch';
}

function parseBatchUrls() {
  const raw = batchUrlsInputEl.value || '';
  return raw
    .split(/[\r\n,]+/)
    .map(s => s.trim())
    .filter(s => s.startsWith('http://') || s.startsWith('https://'));
}

// Media Specs Inspection
async function inspectTarget() {
  const url = urlInputEl.value.trim();
  if (!url) {
    showNotice('Enter a valid URL', 'error');
    return;
  }

  inspectSpinnerEl.style.display = 'inline-block';
  inspectBtnTextEl.textContent = 'Inspecting';
  btnInspectEl.disabled = true;

  try {
    const info = await window.go.main.App.FetchInfo(url);
    appState.inspectedInfo = info;
    displayInspection(info);
  } catch (err) {
    showNotice(err.message || 'Inspection failed', 'error');
  } finally {
    inspectSpinnerEl.style.display = 'none';
    inspectBtnTextEl.textContent = 'Inspect';
    btnInspectEl.disabled = false;
  }
}

function displayInspection(info) {
  if (!info) {
    mediaPreviewEl.style.display = 'none';
    return;
  }

  mediaPreviewEl.style.display = 'flex';
  previewThumbEl.src = info.thumbnail || '';
  previewDurationEl.textContent = info.durationStr || '--:--';
  previewTitleEl.textContent = info.title || 'Untitled';
  previewUploaderEl.textContent = info.uploader || (info.isPlaylist ? `Playlist (${info.playlistCount} items)` : 'Stream');

  const resList = Array.isArray(info.availableResolutions) ? info.availableResolutions.slice(0, 4).join(', ') : 'Direct stream';
  previewMetaTagsEl.textContent = resList;
}

// Format & Preset Controls
function setupFormatOptions() {
  formatTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      formatTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.getAttribute('data-type');
      appState.formatType = t;

      if (t === 'video') {
        videoQualityRowEl.style.display = 'flex';
        audioFormatRowEl.style.display = 'none';
      } else {
        videoQualityRowEl.style.display = 'none';
        audioFormatRowEl.style.display = 'flex';
      }
    });
  });

  videoQualityChips.forEach(pill => {
    pill.addEventListener('click', () => {
      videoQualityChips.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      appState.quality = pill.getAttribute('data-quality');
    });
  });

  audioFormatChips.forEach(pill => {
    pill.addEventListener('click', () => {
      audioFormatChips.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      appState.audioFormat = pill.getAttribute('data-audio');
    });
  });
}

// Download Dispatcher
btnDownloadEl.addEventListener('click', dispatchDownload);

async function dispatchDownload() {
  const options = {
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
      showNotice('Please provide a URL', 'error');
      return;
    }

    options.url = url;
    if (appState.inspectedInfo && appState.inspectedInfo.title) {
      options.title = appState.inspectedInfo.title;
    }

    try {
      const task = await window.go.main.App.AddDownload(options);
      appState.tasks[task.id] = task;
      renderLedgerRow(task);
      updateTelemetry();

      // Reset input
      urlInputEl.value = '';
      btnClearUrlEl.style.display = 'none';
      mediaPreviewEl.style.display = 'none';
      appState.inspectedInfo = null;
    } catch (err) {
      showNotice(err.message || 'Dispatch error', 'error');
    }
  } else {
    // Batch
    const urls = parseBatchUrls();
    if (urls.length === 0) {
      showNotice('No valid URLs found in batch input', 'error');
      return;
    }

    try {
      const tasks = await window.go.main.App.AddBatchDownloads(urls, options);
      if (Array.isArray(tasks)) {
        tasks.forEach(t => { appState.tasks[t.id] = t; });
        renderLedger();
        batchUrlsInputEl.value = '';
        updateBatchMetrics();
        showNotice(`Queued ${tasks.length} items`, 'success');
      }
    } catch (err) {
      showNotice(err.message || 'Batch dispatch error', 'error');
    }
  }
}

// Ledger Controls & Filtering
function setupLedgerFilters() {
  ledgerTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      ledgerTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      appState.activeFilter = tab.getAttribute('data-filter');
      renderLedger();
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
      renderLedger();
    } catch (err) {
      console.error(err);
    }
  });
}

function updateTelemetry() {
  const all = Object.values(appState.tasks);
  const active = all.filter(t => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued');
  const completed = all.filter(t => t.status === 'completed');

  countAllEl.textContent = all.length;
  countActiveEl.textContent = active.length;
  countCompletedEl.textContent = completed.length;

  footerActiveCountEl.textContent = `${active.length} active transfer${active.length === 1 ? '' : 's'}`;

  // Find dominant speed among active
  const speeds = active.map(t => t.speed).filter(Boolean);
  footerSpeedEl.textContent = speeds.length > 0 ? speeds[0] : 'Idle';
}

function getVisibleTasks() {
  const all = Object.values(appState.tasks).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (appState.activeFilter === 'active') {
    return all.filter(t => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued');
  }
  if (appState.activeFilter === 'completed') {
    return all.filter(t => t.status === 'completed');
  }
  return all;
}

function renderLedger() {
  updateTelemetry();
  const tasks = getVisibleTasks();

  if (tasks.length === 0) {
    emptyStateEl.style.display = 'flex';
    const rows = queueListEl.querySelectorAll('.ledger-row');
    rows.forEach(r => r.remove());
    return;
  }

  emptyStateEl.style.display = 'none';
  tasks.forEach(t => renderLedgerRow(t));

  // Purge removed
  const existingRows = queueListEl.querySelectorAll('.ledger-row');
  existingRows.forEach(r => {
    const id = r.getAttribute('data-id');
    if (!appState.tasks[id]) r.remove();
  });
}

function resolveTitle(task) {
  if (task.title && task.title !== 'Fetching stream title...' && !task.title.startsWith('http://') && !task.title.startsWith('https://')) {
    return task.title;
  }
  if (task.outputFile) {
    const parts = task.outputFile.split(/[/\\]/);
    const filename = parts[parts.length - 1];
    const clean = filename.replace(/\.[^/.]+$/, "");
    if (clean) return clean;
  }
  return task.title || 'Fetching stream title...';
}

function resolveSizeMetrics(task) {
  if (!task.downloadedBytes || task.downloadedBytes === 'NA' || task.downloadedBytes === 'None') {
    return '';
  }
  const hasTotal = task.totalBytes && task.totalBytes !== 'NA' && task.totalBytes !== 'N/A' && task.totalBytes !== 'None';
  if (hasTotal) {
    return `${task.downloadedBytes} / ${task.totalBytes}`;
  }
  // Never append / NA
  return `${task.downloadedBytes}`;
}

function renderLedgerRow(task) {
  let rowEl = queueListEl.querySelector(`.ledger-row[data-id="${task.id}"]`);

  // Filter check
  const isActive = task.status === 'downloading' || task.status === 'processing' || task.status === 'queued';
  if (appState.activeFilter === 'active' && !isActive) {
    if (rowEl) rowEl.remove();
    return;
  }
  if (appState.activeFilter === 'completed' && task.status !== 'completed') {
    if (rowEl) rowEl.remove();
    return;
  }

  emptyStateEl.style.display = 'none';

  if (!rowEl) {
    rowEl = document.createElement('div');
    rowEl.className = 'ledger-row';
    rowEl.setAttribute('data-id', task.id);
    queueListEl.prepend(rowEl);
  }

  const isAudio = task.formatType === 'audio';
  const specText = isAudio ? task.audioFormat.toUpperCase() : task.quality.toUpperCase();
  const speedText = task.speed ? `${task.speed}` : '';
  const etaText = task.eta ? `ETA ${task.eta}` : '';
  const sizeText = resolveSizeMetrics(task);
  const displayTitle = resolveTitle(task);
  const progressPct = Math.min(100, Math.max(0, task.progress || 0));

  rowEl.innerHTML = `
    <div class="row-thumb">
      ${task.thumbnail ? `<img src="${task.thumbnail}" alt="preview" />` : `
        <div class="row-thumb-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75">
            ${isAudio ? '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />' : '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>'}
          </svg>
        </div>
      `}
    </div>

    <div class="row-main">
      <div class="row-top">
        <span class="row-title" title="${escapeXml(displayTitle)} • ${escapeXml(task.url || '')}">${escapeXml(displayTitle)}</span>
        <div class="row-tags">
          <span class="tag-spec">${specText}</span>
          <span class="tag-status ${task.status}">${task.status}</span>
        </div>
      </div>

      <div class="row-progress">
        <div class="row-progress-bar ${task.status === 'completed' ? 'completed' : (task.status === 'error' ? 'error' : '')}" 
             style="width: ${progressPct}%;"></div>
      </div>

      <div class="row-bottom">
        <span class="row-log">${escapeXml(task.log || (task.status === 'completed' ? 'Transfer complete' : 'Waiting...'))}</span>
        <div class="row-metrics">
          ${sizeText ? `<span>${sizeText}</span>` : ''}
          ${speedText ? `<span>${speedText}</span>` : ''}
          ${etaText ? `<span>${etaText}</span>` : ''}
          <span>${progressPct.toFixed(0)}%</span>
        </div>
      </div>
    </div>

    <div class="row-actions">
      ${(task.status === 'downloading' || task.status === 'processing') ? `
        <button class="btn-row-action danger" onclick="cancelTransfer('${task.id}')" title="Cancel Transfer">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      ` : ''}

      ${task.status === 'completed' ? `
        <button class="btn-row-action success" onclick="playMedia('${task.id}')" title="Play Media File">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
        <button class="btn-row-action" onclick="revealMedia('${task.id}')" title="Reveal in File Manager">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.75">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
          </svg>
        </button>
      ` : ''}

      ${(task.status === 'completed' || task.status === 'error' || task.status === 'cancelled') ? `
        <button class="btn-row-action" onclick="dismissTransfer('${task.id}')" title="Dismiss from ledger">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.75">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      ` : ''}
    </div>
  `;
}

// Window functions
window.cancelTransfer = async function(id) {
  try {
    await window.go.main.App.CancelDownload(id);
  } catch (err) {
    showNotice(err.message || 'Cancel failed', 'error');
  }
};

window.playMedia = async function(id) {
  const task = appState.tasks[id];
  if (!task || !task.outputFile) {
    showNotice('Output file not located', 'error');
    return;
  }
  try {
    await window.go.main.App.OpenFile(task.outputFile);
  } catch (err) {
    showNotice(err.message || 'Cannot launch media player', 'error');
  }
};

window.revealMedia = async function(id) {
  const task = appState.tasks[id];
  const targetDir = (task && task.saveDir) ? task.saveDir : appState.saveDir;
  try {
    await window.go.main.App.OpenFolder(targetDir);
  } catch (err) {
    showNotice('Failed to open directory', 'error');
  }
};

window.dismissTransfer = async function(id) {
  try {
    await window.go.main.App.RemoveDownload(id);
    delete appState.tasks[id];
    renderLedger();
  } catch (err) {
    console.error(err);
  }
};

// Subtle System Notifications
function showNotice(text, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  el.textContent = text;
  toastContainerEl.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    el.style.transition = 'all 0.15s ease';
    setTimeout(() => el.remove(), 150);
  }, duration);
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
