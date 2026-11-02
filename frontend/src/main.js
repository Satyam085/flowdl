// FlowDL — Precision Desktop Interface Logic

let appState = {
  mode: 'single', // 'single' or 'batch'
  saveDir: '',
  formatType: 'video', // 'video' or 'audio'
  quality: 'best',
  audioFormat: 'mp3',
  tasks: {}, // id -> task
  activeFilter: 'all', // 'all', 'active', 'completed'
  inspectedInfo: null,
  autoPlaylist: false // Playlist box was ticked by inspection, not the user
};

const ACTIVE_STATUSES = ['downloading', 'processing', 'queued'];

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
    // 1. Saved preferences and directory
    const prefs = await loadPrefs();
    applyPrefs(prefs);
    setDirectory((typeof prefs.saveDir === 'string' && prefs.saveDir) || await window.go.main.App.GetDefaultSaveDir());

    // 2. Telemetry
    const dep = await window.go.main.App.GetDependencyStatus();
    const ytdlp = dep.ytDlpInstalled ? `yt-dlp ${dep.ytDlpVersion || 'ready'}` : 'yt-dlp missing';
    depTextEl.textContent = `${ytdlp} • ffmpeg ${dep.ffmpegInstalled ? 'OK' : 'missing'}`;
    depDotEl.className = `telemetry-dot ${!dep.ytDlpInstalled ? 'error' : dep.ffmpegInstalled ? 'ready' : 'warn'}`;
    if (!dep.ytDlpInstalled) {
      showNotice('yt-dlp executable missing from PATH', 'error');
    } else if (!dep.ffmpegInstalled) {
      showNotice('ffmpeg not found: merging, audio extraction and embedding will fail', 'error');
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

// Preferences live in a Go-side config file (survives restarts on every platform)
async function loadPrefs() {
  try {
    return JSON.parse(await window.go.main.App.LoadPrefs()) || {};
  } catch {
    return {};
  }
}

function savePrefs() {
  const prefs = {
    saveDir: appState.saveDir,
    formatType: appState.formatType,
    quality: appState.quality,
    audioFormat: appState.audioFormat,
    embedSubs: chkEmbedSubsEl.checked,
    embedThumbnail: chkEmbedThumbEl.checked,
    embedMetadata: chkEmbedMetaEl.checked
  };
  window.go?.main?.App?.SavePrefs(JSON.stringify(prefs)).catch(() => {});
}

function applyPrefs(prefs) {
  if (prefs.formatType === 'video' || prefs.formatType === 'audio') selectFormatType(prefs.formatType);
  if ([...videoQualityChips].some(p => p.dataset.quality === prefs.quality)) selectQuality(prefs.quality);
  if ([...audioFormatChips].some(p => p.dataset.audio === prefs.audioFormat)) selectAudioFormat(prefs.audioFormat);
  if (typeof prefs.embedSubs === 'boolean') chkEmbedSubsEl.checked = prefs.embedSubs;
  if (typeof prefs.embedThumbnail === 'boolean') chkEmbedThumbEl.checked = prefs.embedThumbnail;
  if (typeof prefs.embedMetadata === 'boolean') chkEmbedMetaEl.checked = prefs.embedMetadata;
}

// Directory chooser
btnChangeDirEl.addEventListener('click', async () => {
  try {
    const chosen = await window.go.main.App.SelectDirectory(appState.saveDir);
    if (chosen) {
      setDirectory(chosen);
      savePrefs();
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
      clearInspection();
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
    clearInspection(); // the preview no longer matches the URL
  });

  // Inspect right after a paste into the field (Ctrl+V or context menu)
  urlInputEl.addEventListener('paste', () => {
    setTimeout(() => {
      if (/^https?:\/\//.test(urlInputEl.value.trim())) inspectTarget();
    });
  });

  btnClearUrlEl.addEventListener('click', () => {
    urlInputEl.value = '';
    btnClearUrlEl.style.display = 'none';
    clearInspection();
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
        clearInspection();
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
      if (freshInspection()) {
        dispatchDownload();
      } else {
        inspectTarget();
      }
    } else if (e.key === 'Escape' && urlInputEl.value) {
      btnClearUrlEl.click();
    }
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const field = appState.mode === 'single' ? urlInputEl : batchUrlsInputEl;

    if (mod && key === 'l') {
      e.preventDefault();
      field.focus();
      field.select();
    } else if (mod && key === 'v' && !e.target.closest('input[type="text"], textarea')) {
      // Move focus before the native paste lands, so it goes into the URL field
      if (field === urlInputEl) {
        field.select();
      } else {
        if (field.value && !field.value.endsWith('\n')) field.value += '\n';
        field.setSelectionRange(field.value.length, field.value.length);
      }
      field.focus();
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
let inspectSeq = 0; // only the latest inspection may update the UI

async function inspectTarget() {
  const url = urlInputEl.value.trim();
  if (!url) {
    showNotice('Enter a valid URL', 'error');
    return;
  }

  const seq = ++inspectSeq;
  inspectSpinnerEl.style.display = 'inline-block';
  inspectBtnTextEl.textContent = 'Inspecting';
  btnInspectEl.disabled = true;

  try {
    const info = await window.go.main.App.FetchInfo(url, chkPlaylistEl.checked);
    if (seq !== inspectSeq || urlInputEl.value.trim() !== url) return;
    appState.inspectedInfo = info;
    displayInspection(info);
  } catch (err) {
    if (seq === inspectSeq) showNotice(err.message || 'Inspection failed', 'error');
  } finally {
    if (seq === inspectSeq) {
      inspectSpinnerEl.style.display = 'none';
      inspectBtnTextEl.textContent = 'Inspect';
      btnInspectEl.disabled = false;
    }
  }
}

// Inspection result, only if it still matches the URL in the field
function freshInspection() {
  const info = appState.inspectedInfo;
  return info && info.url === urlInputEl.value.trim() ? info : null;
}

function clearInspection() {
  appState.inspectedInfo = null;
  mediaPreviewEl.style.display = 'none';
  setQualityLimit(0);
  if (appState.autoPlaylist) {
    chkPlaylistEl.checked = false;
    appState.autoPlaylist = false;
  }
}

function displayInspection(info) {
  mediaPreviewEl.style.display = 'flex';
  previewThumbEl.src = info.thumbnail || '';
  previewThumbEl.style.visibility = info.thumbnail ? 'visible' : 'hidden';
  previewDurationEl.textContent = info.durationStr || '--:--';
  previewTitleEl.textContent = info.title || 'Untitled';
  previewUploaderEl.textContent = info.uploader || (info.isPlaylist ? 'Playlist' : 'Stream');

  const resolutions = info.availableResolutions || [];
  if (info.isPlaylist) {
    previewMetaTagsEl.textContent = `${info.playlistCount} items`;
  } else {
    previewMetaTagsEl.textContent = resolutions.length ? resolutions.slice(0, 4).join(', ') : 'Direct stream';
  }

  if (info.isPlaylist && !chkPlaylistEl.checked) {
    chkPlaylistEl.checked = true;
    appState.autoPlaylist = true;
  }
  setQualityLimit(Math.max(0, ...resolutions.map(r => parseInt(r, 10) || 0)));
}

// Disable quality caps above what the source offers (0 = unknown, enable all)
function setQualityLimit(maxHeight) {
  videoQualityChips.forEach(pill => {
    pill.disabled = maxHeight > 0 && parseInt(pill.dataset.quality, 10) > maxHeight;
  });
}

// Format & Preset Controls
function selectFormatType(type) {
  formatTypeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === type));
  appState.formatType = type;
  videoQualityRowEl.style.display = type === 'video' ? 'flex' : 'none';
  audioFormatRowEl.style.display = type === 'audio' ? 'flex' : 'none';
}

function selectQuality(quality) {
  videoQualityChips.forEach(p => p.classList.toggle('active', p.dataset.quality === quality));
  appState.quality = quality;
}

function selectAudioFormat(format) {
  audioFormatChips.forEach(p => p.classList.toggle('active', p.dataset.audio === format));
  appState.audioFormat = format;
}

function setupFormatOptions() {
  formatTypeBtns.forEach(btn => btn.addEventListener('click', () => {
    selectFormatType(btn.dataset.type);
    savePrefs();
  }));
  videoQualityChips.forEach(pill => pill.addEventListener('click', () => {
    selectQuality(pill.dataset.quality);
    savePrefs();
  }));
  audioFormatChips.forEach(pill => pill.addEventListener('click', () => {
    selectAudioFormat(pill.dataset.audio);
    savePrefs();
  }));
  [chkEmbedSubsEl, chkEmbedThumbEl, chkEmbedMetaEl].forEach(chk => chk.addEventListener('change', savePrefs));
  chkPlaylistEl.addEventListener('change', () => { appState.autoPlaylist = false; });
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
    const info = freshInspection();
    if (info) {
      options.title = info.title || '';
      // The cached extraction is a single video, so it can't serve a playlist download
      if (!options.downloadPlaylist) options.infoJsonPath = info.infoJsonPath || '';
    }

    try {
      const task = await window.go.main.App.AddDownload(options);
      appState.tasks[task.id] = task;
      renderLedgerRow(task);
      updateTelemetry();

      // Reset input
      urlInputEl.value = '';
      btnClearUrlEl.style.display = 'none';
      clearInspection();
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
  const active = all.filter(t => ACTIVE_STATUSES.includes(t.status));
  const completed = all.filter(t => t.status === 'completed');

  countAllEl.textContent = all.length;
  countActiveEl.textContent = active.length;
  countCompletedEl.textContent = completed.length;

  footerActiveCountEl.textContent = `${active.length} active transfer${active.length === 1 ? '' : 's'}`;

  const totalSpeed = active
    .filter(t => t.status === 'downloading')
    .reduce((sum, t) => sum + (t.speedBytes || 0), 0);
  footerSpeedEl.textContent = totalSpeed > 0 ? formatRate(totalSpeed) : 'Idle';
}

function formatRate(bytesPerSec) {
  const units = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s'];
  let i = 0;
  while (bytesPerSec >= 1024 && i < units.length - 1) {
    bytesPerSec /= 1024;
    i++;
  }
  return `${bytesPerSec.toFixed(i ? 2 : 0)} ${units[i]}`;
}

function matchesFilter(task) {
  if (appState.activeFilter === 'active') return ACTIVE_STATUSES.includes(task.status);
  if (appState.activeFilter === 'completed') return task.status === 'completed';
  return true;
}

function renderLedger() {
  updateTelemetry();

  queueListEl.querySelectorAll('.ledger-row').forEach(r => {
    if (!appState.tasks[r.dataset.id]) r.remove();
  });

  // Newest first: appendChild moves existing rows into sorted order
  Object.values(appState.tasks)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach(t => {
      const rowEl = renderLedgerRow(t);
      if (rowEl) queueListEl.appendChild(rowEl);
    });

  syncEmptyState();
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

const ICONS = {
  video: '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>',
  audio: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />',
  cancel: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
  play: '<polygon points="5 3 19 12 5 21 5 3"></polygon>',
  reveal: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />',
  retry: '<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />',
  dismiss: '<polyline points="3 6 5 6 21 6"></polyline><path stroke-linecap="round" stroke-linejoin="round" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>'
};

const svg = (body, size = 13, stroke = 1.75) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}">${body}</svg>`;

// action -> [extra class, tooltip, stroke width]
const ACTION_BUTTONS = {
  cancel: ['danger', 'Cancel Transfer', 2],
  play: ['success', 'Play Media File', 2],
  reveal: ['', 'Reveal in File Manager', 1.75],
  retry: ['', 'Retry Download', 1.75],
  dismiss: ['', 'Dismiss from ledger', 1.75]
};

const ACTIONS_BY_STATUS = {
  queued: ['cancel'],
  downloading: ['cancel'],
  processing: ['cancel'],
  completed: ['play', 'reveal', 'dismiss'],
  error: ['retry', 'dismiss'],
  cancelled: ['retry', 'dismiss']
};

function actionButtons(status) {
  return (ACTIONS_BY_STATUS[status] || []).map(action => {
    const [cls, title, stroke] = ACTION_BUTTONS[action];
    return `<button class="btn-row-action ${cls}" data-action="${action}" title="${title}">${svg(ICONS[action], 13, stroke)}</button>`;
  }).join('');
}

function createRow(task) {
  const rowEl = document.createElement('div');
  rowEl.className = 'ledger-row';
  rowEl.dataset.id = task.id;
  rowEl.innerHTML = `
    <div class="row-thumb">
      <div class="row-thumb-icon">${svg(task.formatType === 'audio' ? ICONS.audio : ICONS.video, 16)}</div>
    </div>
    <div class="row-main">
      <div class="row-top">
        <span class="row-title"></span>
        <div class="row-tags">
          <span class="tag-spec"></span>
          <span class="tag-status"></span>
        </div>
      </div>
      <div class="row-progress"><div class="row-progress-bar"></div></div>
      <div class="row-bottom">
        <span class="row-log"></span>
        <div class="row-metrics"></div>
      </div>
    </div>
    <div class="row-actions"></div>
  `;
  return rowEl;
}

// Last "ERROR:" line of yt-dlp's stderr, without the prefix
function errorSummary(err) {
  const lines = (err || '').split('\n').filter(Boolean);
  const line = lines.findLast(l => l.startsWith('ERROR:')) || lines[lines.length - 1] || 'Download failed';
  return line.replace(/^ERROR:\s*/, '');
}

// Updates fields in place: rebuilding the row on every progress tick ate clicks and reloaded thumbnails
function renderLedgerRow(task) {
  let rowEl = queueListEl.querySelector(`.ledger-row[data-id="${task.id}"]`);

  if (!matchesFilter(task)) {
    if (rowEl) rowEl.remove();
    syncEmptyState();
    return null;
  }

  if (!rowEl) {
    rowEl = createRow(task);
    queueListEl.prepend(rowEl);
  }
  const $ = sel => rowEl.querySelector(sel);

  if (task.thumbnail && rowEl.dataset.thumb !== task.thumbnail) {
    rowEl.dataset.thumb = task.thumbnail;
    const img = new Image();
    img.alt = '';
    img.src = task.thumbnail; // set as a property: the URL is site-controlled
    $('.row-thumb').replaceChildren(img);
  }

  const title = resolveTitle(task);
  $('.row-title').textContent = title;
  $('.row-title').title = `${title} • ${task.url || ''}`;
  $('.tag-spec').textContent = ((task.formatType === 'audio' ? task.audioFormat : task.quality) || '').toUpperCase();
  $('.tag-status').className = `tag-status ${task.status}`;
  $('.tag-status').textContent = task.status;

  const progressPct = Math.min(100, Math.max(0, task.progress || 0));
  $('.row-progress-bar').style.width = `${progressPct}%`;
  $('.row-progress-bar').className = `row-progress-bar ${task.status === 'completed' || task.status === 'error' ? task.status : ''}`;

  const isError = task.status === 'error';
  rowEl.classList.toggle('is-error', isError);
  $('.row-log').textContent = isError ? errorSummary(task.error) : (task.log || 'Waiting...');
  $('.row-log').title = isError ? (task.error || '') : '';

  const metrics = [resolveSizeMetrics(task), task.speed, task.eta && `ETA ${task.eta}`, `${progressPct.toFixed(0)}%`];
  $('.row-metrics').replaceChildren(...metrics.filter(Boolean).map(m => Object.assign(document.createElement('span'), { textContent: m })));

  if (rowEl.dataset.status !== task.status) {
    rowEl.dataset.status = task.status;
    $('.row-actions').innerHTML = actionButtons(task.status);
  }

  syncEmptyState();
  return rowEl;
}

function syncEmptyState() {
  emptyStateEl.style.display = queueListEl.querySelector('.ledger-row') ? 'none' : 'flex';
}

// Row actions (one delegated listener, survives row updates)
queueListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (btn) rowActions[btn.dataset.action](btn.closest('.ledger-row').dataset.id);
});

const rowActions = {
  async cancel(id) {
    try {
      await window.go.main.App.CancelDownload(id);
    } catch (err) {
      showNotice(err.message || 'Cancel failed', 'error');
    }
  },

  async play(id) {
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
  },

  async reveal(id) {
    const task = appState.tasks[id];
    const targetDir = (task && task.saveDir) ? task.saveDir : appState.saveDir;
    try {
      await window.go.main.App.OpenFolder(targetDir);
    } catch (err) {
      showNotice('Failed to open directory', 'error');
    }
  },

  async retry(id) {
    const old = appState.tasks[id];
    if (!old || !old.options) return;
    try {
      const task = await window.go.main.App.AddDownload(old.options);
      await window.go.main.App.RemoveDownload(id);
      delete appState.tasks[id];
      appState.tasks[task.id] = task;
      renderLedger();
    } catch (err) {
      showNotice(err.message || 'Retry failed', 'error');
    }
  },

  async dismiss(id) {
    try {
      await window.go.main.App.RemoveDownload(id);
      delete appState.tasks[id];
      renderLedger();
    } catch (err) {
      console.error(err);
    }
  }
};

// Subtle System Notifications
function showNotice(text, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  const msg = Object.assign(document.createElement('span'), { className: 'toast-text', textContent: text });
  const close = Object.assign(document.createElement('button'), { className: 'toast-close', title: 'Dismiss', textContent: '✕' });
  el.append(msg, close);
  toastContainerEl.appendChild(el);

  const dismiss = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    el.style.transition = 'all 0.15s ease';
    setTimeout(() => el.remove(), 150);
  };
  close.addEventListener('click', dismiss);
  // Errors stay until dismissed so they can be read and copied
  if (type !== 'error') setTimeout(dismiss, duration);
}
