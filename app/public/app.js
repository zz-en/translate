/**
 * AI Simultaneous Interpretation Assistant — Frontend Application
 * Nav Module System + Deep Blue-Purple Tech Theme
 *
 * Modules:
 *   1. home     — Landing page with 4 module cards
 *   2. interp   — Real-time recording + ASR + translation + subtitles
 *   3. upload   — Audio file upload and streaming
 *   4. subtitle — Large bilingual subtitle display
 *   5. history  — Search, stats, and export
 */

// ===========================================================================
// State
// ===========================================================================
const state = {
  sessionId: null,
  isRecording: false,
  isConnected: false,

  // Audio
  audioContext: null,
  mediaStream: null,
  processorNode: null,

  // WebSocket
  ws: null,
  reconnectTimer: null,

  // Transcript
  historyEntries: [],   // { seg_id, asr, translate, is_final, corrected, element }
  pendingMap: new Map(), // seg_id → { asr, translate, element }
  sentenceCount: 0,
  correctionCount: 0,

  // Timing
  startTime: null,
  durationTimer: null,

  // Settings (synced to backend)
  config: {
    sourceLang: 'en',
    targetLang: 'zh',
    translateEnabled: true,
    scene: 'edu',
  },
  ttsEnabled: false,
};

// ===========================================================================
// Navigation System
// ===========================================================================
const NAV = {
  currentModule: 'home',

  navigateTo(moduleName) {
    // Hide all module pages and nav home
    document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
    const navHome = document.getElementById('navHome');
    if (navHome) navHome.classList.add('hidden');

    // Show target
    if (moduleName === 'home') {
      if (navHome) navHome.classList.remove('hidden');
    } else {
      const moduleEl = document.getElementById('module-' + moduleName);
      if (moduleEl) moduleEl.classList.add('active');
    }

    // Update sidebar nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.module === moduleName);
    });

    // Module lifecycle
    if (NAV.currentModule !== moduleName) {
      NAV.leaveModule(NAV.currentModule);
      NAV.currentModule = moduleName;
      NAV.enterModule(moduleName);
    }
  },

  navigateHome() {
    NAV.navigateTo('home');
  },

  enterModule(moduleName) {
    switch (moduleName) {
      case 'interp':
        // Ensure WebSocket is connected
        if (!state.isConnected && (!state.ws || state.ws.readyState !== WebSocket.OPEN)) {
          connectWebSocket();
        }
        updateMicButton();
        // Restore subtitles from last known state
        restoreSubtitles();
        break;

      case 'upload':
        // Ensure WebSocket is connected
        if (!state.isConnected && (!state.ws || state.ws.readyState !== WebSocket.OPEN)) {
          connectWebSocket();
        }
        break;

      case 'subtitle':
        // Sync current subtitle state to big display
        syncSubtitleToBig();
        break;

      case 'desktop':
        // Ensure WebSocket is connected
        if (!state.isConnected && (!state.ws || state.ws.readyState !== WebSocket.OPEN)) {
          connectWebSocket();
        }
        // Refresh audio device list (user may have plugged in new devices)
        enumerateAudioDevices();
        updateDesktopUI();
        break;

      case 'history':
        // Sync history entries to the history module list
        syncHistoryToModule();
        syncStatsToModule();
        break;
    }
  },

  leaveModule(moduleName) {
    // Recording continues across modules by design
    // Desktop session is independent — keep running unless explicitly stopped
  },
};

// ===========================================================================
// DOM References — grouped by context
// ===========================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Shared / header
const dom = {
  connectionStatus: $('#connectionStatus'),
  sessionId: $('#sessionId'),
  themeToggle: $('#themeToggle'),
};

// Interp module elements
const domInterp = {
  historyList: $('#historyList'),
  subtitleOriginal: $('#subtitleOriginal'),
  subtitleTranslation: $('#subtitleTranslation'),
  correctionHint: $('#correctionHint'),
  micButton: $('#micButton'),
  micIcon: $('#micButton .mic-icon'),
  micText: $('#micButton .mic-text'),
  meterBar: $('#meterBar'),
  statSentences: $('#statSentences'),
  statCorrections: $('#statCorrections'),
  statDuration: $('#statDuration'),
  sourceLang: $('#sourceLang'),
  targetLang: $('#targetLang'),
  scene: $('#scene'),
  translateToggle: $('#translateToggle'),
  ttsToggle: $('#ttsToggle'),
  uploadButton: $('#uploadButton'),
  fileInput: $('#fileInput'),
  clearHistory: $('#clearHistory'),
  fontSizeSlider: $('#fontSizeSlider'),
  fontSizeValue: $('#fontSizeValue'),
  searchInput: $('#searchInput'),
};

// Upload module elements
const domUpload = {
  uploadArea: $('#uploadArea'),
  fileInput: $('#fileInputUpload'),
  uploadProgress: $('#uploadProgress'),
  progressBarFill: $('#progressBarFill'),
  progressText: $('#progressText'),
  uploadStatus: $('#uploadStatus'),
  uploadStatusIcon: $('#uploadStatusIcon'),
  uploadStatusText: $('#uploadStatusText'),
  sourceLang: $('#sourceLangUpload'),
  targetLang: $('#targetLangUpload'),
  scene: $('#sceneUpload'),
  translateToggle: $('#translateToggleUpload'),
  ttsToggle: $('#ttsToggleUpload'),
};

// Subtitle module elements
const domSubtitle = {
  bigOriginal: $('#subtitleBigOriginal'),
  bigTranslation: $('#subtitleBigTranslation'),
  correctionHintBig: $('#correctionHintBig'),
  display: $('#subtitleOnlyDisplay'),
};

// History module elements
const domHistory = {
  searchInput: $('#searchInputHistory'),
  clearButton: $('#clearHistoryHist'),
  historyList: $('#historyListHist'),
  statSentences: $('#statSentencesHist'),
  statCorrections: $('#statCorrectionsHist'),
  statDuration: $('#statDurationHist'),
  exportFormat: $('#exportFormat'),
  exportButton: $('#exportButton'),
  fontSizeSlider: $('#fontSizeSliderHist'),
  fontSizeValue: $('#fontSizeValueHist'),
};

// Desktop module elements
const domDesktop = {
  startBtnMic: $('#desktopStartBtnMic'),
  startBtnSystem: $('#desktopStartBtnSystem'),
  stopBtn: $('#desktopStopBtn'),
  status: $('#desktopStatus'),
  audioDevice: $('#audioDeviceDesktop'),
  audioDeviceHint: $('#audioDeviceHint'),
  sourceLang: $('#sourceLangDesktop'),
  targetLang: $('#targetLangDesktop'),
  translateToggle: $('#translateToggleDesktop'),
  opacitySlider: $('#opacitySliderDesktop'),
  opacityValue: $('#opacityValueDesktop'),
};

// Desktop subtitle state
const desktopState = {
  active: false,
  mode: null,        // 'mic' | 'system'
  pipWindow: null,
  mediaStream: null,
  audioContext: null,
  speechRecognition: null,
  levelCheckInterval: null,
  lastOriginal: '',
  lastTranslation: '',
};

// ===========================================================================
// WebSocket — connect to our backend relay server
// ===========================================================================
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/ws`;

  dom.connectionStatus.textContent = '● 连接中...';
  dom.connectionStatus.className = 'badge connecting';

  state.ws = new WebSocket(url);

  state.ws.onopen = () => {
    console.log('WebSocket connected to backend');
    state.isConnected = true;
    dom.connectionStatus.textContent = '● 已连接';
    dom.connectionStatus.className = 'badge connected';
    state.reconnectTimer = null;
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (err) {
      console.error('Failed to parse server message:', err);
    }
  };

  state.ws.onclose = () => {
    console.log('WebSocket disconnected');
    state.isConnected = false;
    dom.connectionStatus.textContent = '● 连接断开';
    dom.connectionStatus.className = 'badge disconnected';

    // Auto-reconnect
    if (!state.reconnectTimer) {
      state.reconnectTimer = setTimeout(connectWebSocket, 2000);
    }
  };

  state.ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    dom.connectionStatus.textContent = '● 连接错误';
    dom.connectionStatus.className = 'badge error';
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'status':
      if (msg.sessionId && !state.sessionId) {
        state.sessionId = msg.sessionId;
        dom.sessionId.textContent = msg.sessionId.slice(0, 8) + '...';
      }
      break;

    case 'asr':
      handleASRResult(msg);
      break;

    case 'translation':
      handleTranslationResult(msg);
      break;

    case 'voiceprint':
      // Could display speaker identity alongside entries
      break;

    case 'error':
      console.error('Server error:', msg.code, msg.desc);
      showToast(`识别错误: ${msg.desc || msg.code}`, 'error');
      break;

    default:
      console.log('Unknown server message:', msg.type);
  }
}

// ===========================================================================
// ASR Result Handling — the heart of the UI
// ===========================================================================
function handleASRResult(msg) {
  const { seg_id, asr, translate, is_final, corrected, prev_asr, prev_translate } = msg;

  // --- Update interp module live subtitles ---
  if (domInterp.subtitleOriginal && asr) {
    domInterp.subtitleOriginal.textContent = asr;
  }
  if (domInterp.subtitleTranslation) {
    if (translate && state.config.translateEnabled) {
      domInterp.subtitleTranslation.textContent = translate;
    } else if (!state.config.translateEnabled) {
      domInterp.subtitleTranslation.textContent = '';
    }
  }
  // Auto-scroll to latest text
  scrollSubtitleToBottom();

  // --- Sync to subtitle module (big display) ---
  syncSubtitleToBig(msg);

  // --- Sync to desktop PiP window (all modes) ---
  if (desktopState.active) {
    updatePiPSubtitles(asr, translate || null, corrected);
  }

  // --- Show correction hint (interp module) ---
  if (corrected && prev_asr) {
    if (domInterp.correctionHint) {
      domInterp.correctionHint.classList.remove('hidden');
    }
    if (domSubtitle.correctionHintBig) {
      domSubtitle.correctionHintBig.classList.remove('hidden');
    }
    state.correctionCount++;
    updateStats();
    // Auto-hide after 2 seconds
    clearTimeout(state._correctionHintTimer);
    state._correctionHintTimer = setTimeout(() => {
      if (domInterp.correctionHint) domInterp.correctionHint.classList.add('hidden');
      if (domSubtitle.correctionHintBig) domSubtitle.correctionHintBig.classList.add('hidden');
    }, 2000);
  }

  // --- Build or update history entry ---
  const historyList = getActiveHistoryList();
  if (is_final) {
    // Final result: commit to history
    const existing = state.pendingMap.get(seg_id);
    if (existing) {
      updateHistoryEntry(existing.element, seg_id, asr, translate, true, corrected, prev_asr, prev_translate);
      state.pendingMap.delete(seg_id);
    } else {
      const el = createHistoryEntry(seg_id, asr, translate, true, corrected, prev_asr, prev_translate);
      appendToHistory(el, seg_id, true);
    }
    state.sentenceCount++;
    updateStats();

    // --- TTS ---
    if (state.ttsEnabled && translate) {
      speakTranslation(translate);
    }

  } else {
    // Interim result: show in pending
    const existing = state.pendingMap.get(seg_id);
    if (existing) {
      updateHistoryEntry(existing.element, seg_id, asr, translate, false, corrected, prev_asr, prev_translate);
      existing.asr = asr;
      existing.translate = translate;
    } else {
      const el = createHistoryEntry(seg_id, asr, translate, false, false, null, null);
      appendToHistory(el, seg_id, false);
      state.pendingMap.set(seg_id, { asr, translate, element: el });
    }
  }
}

// Store last subtitle state for syncing across modules
let _lastSubtitle = { original: '', translation: '', corrected: false };

function syncSubtitleToBig(msg) {
  if (msg) {
    _lastSubtitle.original = msg.asr || _lastSubtitle.original;
    _lastSubtitle.translation = msg.translate || _lastSubtitle.translation;
    _lastSubtitle.corrected = msg.corrected || false;
  }
  if (domSubtitle.bigOriginal) {
    domSubtitle.bigOriginal.textContent = _lastSubtitle.original;
  }
  if (domSubtitle.bigTranslation) {
    domSubtitle.bigTranslation.textContent = _lastSubtitle.translation;
  }
}

function restoreSubtitles() {
  syncSubtitleToBig();
}

// Handle translation results (sent separately from ASR by iFlytek backend)
function handleTranslationResult(msg) {
  const { seg_id, translate } = msg;

  if (!translate) return;

  // Update interp subtitle
  if (domInterp.subtitleTranslation) {
    domInterp.subtitleTranslation.textContent = translate;
  }
  // Auto-scroll to latest text
  scrollSubtitleToBottom();

  // Update desktop PiP if active
  if (desktopState.active) {
    updatePiPSubtitles(null, translate, false);
  }

  // Update subtitle module
  _lastSubtitle.translation = translate;
  if (domSubtitle.bigTranslation) {
    domSubtitle.bigTranslation.textContent = translate;
  }

  // Update history entry with translation
  const existing = state.pendingMap.get(seg_id);
  if (existing) {
    existing.translate = translate;
    updateHistoryEntry(existing.element, seg_id, existing.asr, translate, false, false, null, null);
  } else {
    // Find final entries across all history lists
    const el = document.querySelector(`.transcript-entry[data-seg-id="${seg_id}"]`);
    if (el) {
      const transDiv = el.querySelector('.entry-translation');
      if (transDiv) transDiv.textContent = translate;
    }
  }

  // TTS
  if (state.ttsEnabled && translate && !translate.startsWith('[翻译]')) {
    speakTranslation(translate);
  }
}

// ===========================================================================
// History Entry — DOM management
// ===========================================================================
function createHistoryEntry(segId, asr, translate, isFinal, corrected, prevAsr, prevTrans) {
  const div = document.createElement('div');
  div.className = 'transcript-entry';
  div.dataset.segId = segId;
  if (!isFinal) div.classList.add('current');

  let originalHTML = '';
  if (corrected && prevAsr) {
    originalHTML = `<span class="corrected-text">${escapeHtml(prevAsr)}</span>`;
    originalHTML += `<span class="correction-arrow">→</span>`;
  }
  originalHTML += escapeHtml(asr || '(识别中...)');

  div.innerHTML = `
    <div class="entry-original">${originalHTML}</div>
    <div class="entry-translation">${escapeHtml(translate || (state.config.translateEnabled ? '(翻译中...)' : ''))}</div>
    <div class="entry-meta">
      <span class="entry-badge ${isFinal ? 'final' : 'interim'}">${isFinal ? '✓ 最终' : '⏳ 识别中'}</span>
      ${corrected ? '<span class="entry-badge corrected">已纠正</span>' : ''}
      <span>#${segId}</span>
    </div>
  `;

  return div;
}

function updateHistoryEntry(element, segId, asr, translate, isFinal, corrected, prevAsr, prevTrans) {
  // Update original text
  const origDiv = element.querySelector('.entry-original');
  if (origDiv) {
    let originalHTML = '';
    if (corrected && prevAsr) {
      originalHTML = `<span class="corrected-text">${escapeHtml(prevAsr)}</span>`;
      originalHTML += `<span class="correction-arrow">→</span>`;
    }
    originalHTML += escapeHtml(asr || '(识别中...)');
    origDiv.innerHTML = originalHTML;
  }

  // Update translation
  const transDiv = element.querySelector('.entry-translation');
  if (transDiv) {
    transDiv.textContent = translate || (state.config.translateEnabled ? '(翻译中...)' : '');
  }

  // Update meta badges
  const interimBadge = element.querySelector('.entry-badge.interim');
  if (isFinal && interimBadge) {
    element.classList.remove('current');
    interimBadge.classList.remove('interim');
    interimBadge.classList.add('final');
    interimBadge.textContent = '✓ 最终';
  }

  if (corrected) {
    let corrBadge = element.querySelector('.entry-badge.corrected');
    if (!corrBadge) {
      corrBadge = document.createElement('span');
      corrBadge.className = 'entry-badge corrected';
      corrBadge.textContent = '已纠正';
      const metaEl = element.querySelector('.entry-meta');
      if (metaEl) metaEl.appendChild(corrBadge);
    }
    element.classList.add('flash-correction');
    setTimeout(() => element.classList.remove('flash-correction'), 1200);
  }
}

function getActiveHistoryList() {
  // Return the history list in the currently active module, or interp as default
  if (NAV.currentModule === 'history' && domHistory.historyList) {
    return domHistory.historyList;
  }
  return domInterp.historyList;
}

function appendToHistory(element, segId, scroll) {
  // Add to interp history list
  addEntryToList(domInterp.historyList, element, scroll);

  // Clone and add to history module list (keep them in sync)
  if (domHistory.historyList && domHistory.historyList !== domInterp.historyList) {
    const clone = element.cloneNode(true);
    clone.dataset.segId = segId + '-hist'; // avoid duplicate id conflicts
    addEntryToList(domHistory.historyList, clone, false);
  }
}

function addEntryToList(list, element, scroll) {
  if (!list) return;
  // Remove empty state
  const emptyState = list.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  list.appendChild(element);

  if (scroll) {
    element.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}

function syncHistoryToModule() {
  if (!domHistory.historyList) return;
  // Clear and rebuild from interp list
  const sourceList = domInterp.historyList;
  if (!sourceList) return;

  domHistory.historyList.innerHTML = '';

  const entries = sourceList.querySelectorAll('.transcript-entry');
  if (entries.length === 0) {
    domHistory.historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎤</div>
        <p>尚无记录</p>
        <p class="sub">进入同声传译模块录音后将显示在此</p>
      </div>
    `;
    return;
  }

  entries.forEach(entry => {
    const clone = entry.cloneNode(true);
    domHistory.historyList.appendChild(clone);
  });
}

function updateStats() {
  // Update interp stats
  if (domInterp.statSentences) domInterp.statSentences.textContent = state.sentenceCount;
  if (domInterp.statCorrections) domInterp.statCorrections.textContent = state.correctionCount;

  // Update history module stats
  if (domHistory.statSentences) domHistory.statSentences.textContent = state.sentenceCount;
  if (domHistory.statCorrections) domHistory.statCorrections.textContent = state.correctionCount;
}

function syncStatsToModule() {
  updateStats();
  // Sync duration
  if (domHistory.statDuration && domInterp.statDuration) {
    domHistory.statDuration.textContent = domInterp.statDuration.textContent;
  }
}

// ===========================================================================
// Subtitle scroll helper — keep latest text in view
// ===========================================================================
function scrollSubtitleToBottom() {
  const overlay = document.getElementById('subtitleOverlay');
  if (overlay) {
    overlay.scrollTop = overlay.scrollHeight;
  }
}

// ===========================================================================
// TTS — Web Speech API
// ===========================================================================
let ttsQueue = [];
let ttsSpeaking = false;

function speakTranslation(text) {
  if (!('speechSynthesis' in window)) return;

  ttsQueue.push(text);
  if (!ttsSpeaking) processTTSQueue();
}

function processTTSQueue() {
  if (ttsQueue.length === 0) {
    ttsSpeaking = false;
    return;
  }

  ttsSpeaking = true;
  const text = ttsQueue.shift();
  const utterance = new SpeechSynthesisUtterance(text);

  // Use Chinese voice
  const voices = speechSynthesis.getVoices();
  const zhVoice = voices.find(v => v.lang.startsWith('zh')) ||
                  voices.find(v => v.lang.startsWith('cmn')) ||
                  voices.find(v => v.lang === 'zh-CN');
  if (zhVoice) utterance.voice = zhVoice;

  utterance.rate = 1.1;
  utterance.pitch = 1.0;

  utterance.onend = () => processTTSQueue();
  utterance.onerror = () => processTTSQueue();

  speechSynthesis.speak(utterance);
}

// Pre-load voices
if ('speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

// ===========================================================================
// Desktop Subtitle Module — PiP floating window + system audio capture
// ===========================================================================

function updateDesktopUI() {
  if (!domDesktop.startBtnMic) return;
  if (desktopState.active) {
    domDesktop.startBtnMic.classList.add('hidden');
    domDesktop.startBtnSystem.classList.add('hidden');
    domDesktop.stopBtn.classList.remove('hidden');
    const modeLabel = desktopState.mode === 'system' ? '系统音频' : '麦克风';
    showDesktopStatus(`● 桌面字幕运行中 — ${modeLabel}`, '');
  } else {
    domDesktop.startBtnMic.classList.remove('hidden');
    domDesktop.startBtnSystem.classList.remove('hidden');
    domDesktop.stopBtn.classList.add('hidden');
    hideDesktopStatus();
  }
}

function showDesktopStatus(msg, cls) {
  if (!domDesktop.status) return;
  domDesktop.status.textContent = msg;
  domDesktop.status.className = 'desktop-status ' + (cls || '');
  domDesktop.status.classList.remove('hidden');
}

function hideDesktopStatus() {
  if (!domDesktop.status) return;
  domDesktop.status.classList.add('hidden');
}

function readDesktopConfig() {
  if (domDesktop.sourceLang) {
    const src = domDesktop.sourceLang.value;
    state.config.sourceLang = (src === 'auto') ? 'auto' : (LANG_MAP[src] || src);
  }
  if (domDesktop.targetLang) {
    state.config.targetLang = LANG_MAP[domDesktop.targetLang.value] || 'zh-CN';
  }
  if (domDesktop.translateToggle) {
    state.config.translateEnabled = domDesktop.translateToggle.checked;
  }
}

async function startDesktopMicMode() {
  // Use speech recognition for mic
  if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
    showToast('此浏览器不支持语音识别，请使用 Chrome 或 Edge', 'error');
    return;
  }

  // Stop interp recording if active (can't have two SpeechRecognition instances)
  if (state.isRecording) stopRecording();

  // Open PiP window first
  const pipOpened = await openPiPWindow();
  if (!pipOpened) {
    showToast('无法打开悬浮窗，请检查浏览器是否支持画中画功能', 'error');
    return;
  }

  // Read config
  readDesktopConfig();
  sendConfigToServer();

  // Start speech recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = mapLangForSpeechAPI(state.config.sourceLang);

  rec.onresult = (event) => {
    let interim = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }

    // Send to server
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      if (interim) {
        state.ws.send(JSON.stringify({ type: 'asr_text', text: interim, is_final: false }));
      }
      if (finalText) {
        state.ws.send(JSON.stringify({ type: 'asr_text', text: finalText, is_final: true }));
      }
    }

    // Update PiP directly for instant feedback
    if (finalText) {
      updatePiPSubtitles(finalText, null, false);
    } else if (interim) {
      updatePiPSubtitles(interim, null, false);
    }
  };

  rec.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    console.error('Desktop speech error:', event.error);
    showDesktopStatus('识别错误: ' + event.error, 'warning');
  };

  rec.onend = () => {
    if (desktopState.active && desktopState.mode === 'mic') {
      try { rec.start(); } catch (e) {}
    }
  };

  desktopState.speechRecognition = rec;
  rec.start();

  desktopState.active = true;
  desktopState.mode = 'mic';
  updateDesktopUI();
  showDesktopStatus('● 桌面字幕运行中 — 麦克风', '');
  showToast('桌面字幕已启动（麦克风模式）', 'info');
}

async function startDesktopSystemMode() {
  // Check SpeechRecognition support
  if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
    showToast('此浏览器不支持语音识别，请使用 Chrome 或 Edge', 'error');
    return;
  }

  // Stop interp recording if active
  if (state.isRecording) stopRecording();

  // Read config
  readDesktopConfig();
  sendConfigToServer();

  // Determine audio source
  const deviceId = domDesktop.audioDevice ? domDesktop.audioDevice.value : 'default';

  let stream;
  let useDisplayMedia = (deviceId === 'display');

  if (useDisplayMedia) {
    // --- Path A: Screen share audio (Chrome tab + audio checkbox) ---
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      showToast('此浏览器不支持屏幕音频捕获，请使用 Chrome 或 Edge', 'error');
      return;
    }

    // Open PiP first
    const pipOpened = await openPiPWindow();
    if (!pipOpened) { showToast('无法打开悬浮窗', 'error'); return; }

    updatePiPSubtitles('请选择「Chrome标签页」并勾选底部「分享音频」', null, false);
    showToast('👉 请选择 Chrome 标签页，并勾选「分享音频」', 'info');

    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: { width: 1, height: 1, frameRate: 1 },
      });
    } catch (err) {
      console.error('Display media failed:', err);
      closePiPWindow();
      showToast(err.name === 'NotAllowedError' ? '用户取消了' : '捕获失败: ' + err.message, 'error');
      return;
    }
    stream.getVideoTracks().forEach(t => t.stop());

  } else {
    // --- Path B: Audio input device (mic, Stereo Mix, etc.) ---
    // Open PiP first
    const pipOpened = await openPiPWindow();
    if (!pipOpened) { showToast('无法打开悬浮窗', 'error'); return; }

    const constraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 16000,
        channelCount: 1,
      },
    };
    if (deviceId !== 'default') {
      constraints.audio.deviceId = { exact: deviceId };
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[Desktop] Audio device stream acquired, deviceId:', deviceId);
    } catch (err) {
      console.error('Audio device capture failed:', err);
      closePiPWindow();
      if (err.name === 'NotAllowedError') {
        showToast('麦克风权限被拒绝', 'error');
      } else if (err.name === 'OverconstrainedError') {
        showToast('所选音频设备不可用，请选择其他设备', 'error');
      } else {
        showToast('音频捕获失败: ' + err.message, 'error');
      }
      return;
    }
  }

  // --- Diagnose audio tracks ---
  const audioTracks = stream.getAudioTracks();
  console.log('[Desktop] Audio tracks received:', audioTracks.length);

  let audioTrack = null;
  let audioCtx = null;

  if (audioTracks.length === 0) {
    // No captured audio track — but the sound IS playing through speakers.
    // The microphone will pick it up directly. No need to re-route.
    console.log('[Desktop] No audio track — using mic to capture speaker output directly');
    stream.getTracks().forEach(t => t.stop()); // Don't need the video stream
    desktopState.mediaStream = null;
    updatePiPSubtitles('🎤 麦克风拾取扬声器声音中...（选标签页+勾分享音频可获得更好效果）', null, false);
    showToast('已启动：麦克风直接拾取扬声器声音（建议选Chrome标签页+分享音频获得最佳效果）', 'info');
  } else {
    // Audio track available — route through speakers for mic to pick up
    audioTrack = audioTracks[0];
    console.log('[Desktop] Audio track:', {
      label: audioTrack.label,
      enabled: audioTrack.enabled,
      muted: audioTrack.muted,
      readyState: audioTrack.readyState,
    });
    desktopState.mediaStream = stream;

    // --- Set up audio routing: capture → speakers → mic → SpeechRecognition ---
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    desktopState.audioContext = audioCtx;

    // Resume AudioContext if suspended (browser policy)
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
      console.log('[Desktop] AudioContext resumed:', audioCtx.state);
    }

    const source = audioCtx.createMediaStreamSource(stream);

    // Analyser to check if audio is actually flowing
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // Route to speakers at moderate volume
    const speakerGain = audioCtx.createGain();
    speakerGain.gain.value = 0.7; // 70%
    source.connect(speakerGain);
    speakerGain.connect(audioCtx.destination);

    // Monitor audio levels to confirm audio is flowing
    let audioDetected = false;
    desktopState.levelCheckInterval = setInterval(() => {
      if (!desktopState.active) {
        clearInterval(desktopState.levelCheckInterval);
        desktopState.levelCheckInterval = null;
        return;
      }
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      if (avg > 5 && !audioDetected) {
        audioDetected = true;
        console.log('[Desktop] Audio signal detected ✓, level:', Math.round(avg));
      }
    }, 1000);

    updatePiPSubtitles('🎧 正在监听系统音频...', null, false);
  }

  // --- Start SpeechRecognition ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = mapLangForSpeechAPI(state.config.sourceLang);

  rec.onresult = (event) => {
    let interim = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }

    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      if (interim) {
        state.ws.send(JSON.stringify({ type: 'asr_text', text: interim, is_final: false }));
      }
      if (finalText) {
        state.ws.send(JSON.stringify({ type: 'asr_text', text: finalText, is_final: true }));
      }
    }

    if (finalText) {
      updatePiPSubtitles(finalText, null, false);
    } else if (interim) {
      updatePiPSubtitles(interim, null, false);
    }
  };

  rec.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    console.error('[Desktop] Speech error:', event.error);
    showDesktopStatus('识别错误: ' + event.error, 'warning');
  };

  rec.onend = () => {
    if (desktopState.active && desktopState.mode === 'system') {
      try { rec.start(); } catch (e) {}
    }
  };

  desktopState.speechRecognition = rec;
  rec.start();

  desktopState.active = true;
  desktopState.mode = 'system';
  updateDesktopUI();
  showDesktopStatus('● 桌面字幕运行中 — 系统音频', '');
  showToast('桌面字幕已启动（系统音频模式）', 'info');

  // Show initial status in PiP
  updatePiPSubtitles('🎧 正在监听系统音频...', null, false);

  // Handle stream end (user clicks "Stop sharing") — only if audio track exists
  if (audioTrack) {
    audioTrack.addEventListener('ended', () => {
      if (desktopState.levelCheckInterval) {
        clearInterval(desktopState.levelCheckInterval);
        desktopState.levelCheckInterval = null;
      }
      if (desktopState.active && desktopState.mode === 'system') {
        stopDesktopSession();
        showToast('音频捕获已停止', 'info');
      }
    });
  }

}

// ===========================================================================
// Picture-in-Picture Window
// ===========================================================================
async function openPiPWindow() {
  // Check for Document PiP API (Chrome 116+)
  if (!('documentPictureInPicture' in window)) {
    // Fallback: use existing fullscreen subtitle module
    console.warn('Document PiP not supported, using subtitle module fallback');
    NAV.navigateTo('subtitle');
    showToast('此浏览器不支持桌面悬浮窗，已切换到全屏字幕模式', 'info');
    // Return true so the session continues (subtitles update via existing hooks)
    desktopState.pipWindow = 'fallback';
    return true;
  }

  try {
    const pip = await documentPictureInPicture.requestWindow({
      width: 800,
      height: 160,
    });
    desktopState.pipWindow = pip;

    // Build PiP content — pure floating text by default, no window chrome
    const opacityVal = domDesktop.opacitySlider ? parseInt(domDesktop.opacitySlider.value) : 0;
    // Default to transparent for pure floating subtitle look
    const bgStyle = opacityVal === 0 ? 'background:transparent;' : `background:rgba(0,0,0,${(opacityVal/100).toFixed(2)});`;
    pip.document.title = 'AI 桌面字幕';
    pip.document.body.innerHTML = `
      <div class="pip-container" style="${bgStyle}">
        <div class="pip-subtitles">
          <div class="pip-subtitle-row">
            <div class="pip-subtitle-original" id="pipOriginal"></div>
          </div>
          <div class="pip-subtitle-row">
            <div class="pip-subtitle-translation" id="pipTranslation"></div>
          </div>
        </div>
        <button class="pip-close-btn" id="pipCloseBtn" title="关闭">✕</button>
      </div>
    `;

    // Copy styles to PiP window
    const style = pip.document.createElement('style');
    style.textContent = await fetchPiPStyles();
    pip.document.head.appendChild(style);

    // Close button handler
    pip.document.getElementById('pipCloseBtn').addEventListener('click', () => {
      stopDesktopSession();
    });

    // Clean up when PiP window is closed by user
    pip.addEventListener('pagehide', () => {
      if (desktopState.active) {
        stopDesktopSession();
      }
    });

    // Restore text if resuming
    if (desktopState.lastOriginal) {
      updatePiPSubtitles(desktopState.lastOriginal, desktopState.lastTranslation, false);
    }

    return true;
  } catch (err) {
    console.error('Failed to open PiP window:', err);
    // Fallback to subtitle module
    NAV.navigateTo('subtitle');
    showToast('悬浮窗打开失败，已切换到全屏字幕模式', 'warning');
    desktopState.pipWindow = 'fallback';
    return true;
  }
}

async function fetchPiPStyles() {
  // Pure floating subtitle styles — no window chrome, just text
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
    .pip-container {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: transparent;
    }
    .pip-subtitles {
      flex: 1;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 0 24px; gap: 6px;
      overflow-y: auto;
      width: 100%;
    }
    .pip-subtitle-row {
      line-height: 1.3; word-break: break-word;
      text-align: center; width: 100%;
    }
    .pip-subtitle-original {
      font-size: 24px; font-weight: 500;
      color: #fff;
      text-shadow:
        0 0 4px #000, 0 0 8px #000,
        0 1px 2px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.7);
      min-height: 28px;
      letter-spacing: 0.5px;
    }
    .pip-subtitle-translation {
      font-size: 36px; font-weight: 800;
      color: #ffd700;
      text-shadow:
        0 0 6px #000, 0 0 12px #000,
        0 2px 4px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.7);
      min-height: 40px;
      letter-spacing: 1px;
    }
    .pip-close-btn {
      position: fixed; top: 4px; right: 4px;
      width: 18px; height: 18px;
      border: none; border-radius: 50%;
      background: rgba(0,0,0,0.3);
      color: rgba(255,255,255,0.4);
      font-size: 10px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.3s;
    }
    .pip-container:hover .pip-close-btn { opacity: 1; }
    .pip-close-btn:hover { background: rgba(255,60,60,0.7); color: #fff; }
    .pip-subtitles::-webkit-scrollbar { width: 4px; }
    .pip-subtitles::-webkit-scrollbar-track { background: transparent; }
    .pip-subtitles::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
  `;
}

function updatePiPSubtitles(original, translation, corrected) {
  if (!original && !translation) return;

  if (original) desktopState.lastOriginal = original;
  if (translation) desktopState.lastTranslation = translation;

  // If using fallback (subtitle module), update it directly
  const pip = desktopState.pipWindow;
  if (!pip || pip === 'fallback') {
    if (pip === 'fallback') {
      // Update subtitle module directly
      if (original) {
        _lastSubtitle.original = original;
        if (domSubtitle.bigOriginal) domSubtitle.bigOriginal.textContent = original;
      }
      if (translation) {
        _lastSubtitle.translation = translation;
        if (domSubtitle.bigTranslation) domSubtitle.bigTranslation.textContent = translation;
      }
    }
    return;
  }

  try {
    const origEl = pip.document.getElementById('pipOriginal');
    const transEl = pip.document.getElementById('pipTranslation');

    if (origEl && original) {
      origEl.textContent = original;
    }
    if (transEl && translation) {
      transEl.textContent = translation;
    } else if (transEl && state.config.translateEnabled === false) {
      transEl.textContent = '';
    }

    // Auto-scroll PiP subtitles
    const subsEl = pip.document.querySelector('.pip-subtitles');
    if (subsEl) {
      subsEl.scrollTop = subsEl.scrollHeight;
    }
  } catch (e) {
    // PiP window may have been closed
  }
}

function closePiPWindow() {
  const pip = desktopState.pipWindow;
  if (pip && pip !== 'fallback') {
    try { pip.close(); } catch (e) {}
  }
  desktopState.pipWindow = null;
}

function stopDesktopSession() {
  desktopState.active = false;

  // Clear level check interval
  if (desktopState.levelCheckInterval) {
    clearInterval(desktopState.levelCheckInterval);
    desktopState.levelCheckInterval = null;
  }

  // Stop speech recognition
  if (desktopState.speechRecognition) {
    try { desktopState.speechRecognition.stop(); } catch (e) {}
    desktopState.speechRecognition = null;
  }

  // Stop media stream
  if (desktopState.mediaStream) {
    desktopState.mediaStream.getTracks().forEach(t => t.stop());
    desktopState.mediaStream = null;
  }

  // Close audio context
  if (desktopState.audioContext) {
    desktopState.audioContext.close();
    desktopState.audioContext = null;
  }

  // Close PiP window
  closePiPWindow();

  // Send end marker for system audio mode
  if (desktopState.mode === 'system' && state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: 'end' }));
  }

  desktopState.mode = null;
  updateDesktopUI();
  showToast('桌面字幕已停止', 'info');
}

// ===========================================================================
// Speech Recognition — Web Speech API (free, no credentials needed)
// ===========================================================================
let speechRecognition = null;
let speechActive = false;

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Web Speech API not supported — falling back to server ASR');
    return null;
  }

  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = mapLangForSpeechAPI(state.config.sourceLang);

  rec.onresult = (event) => {
    let interim = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }

    // Send interim results for live subtitles
    if (interim && state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({
        type: 'asr_text',
        text: interim,
        is_final: false,
      }));
    }

    // Send final result
    if (finalText && state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({
        type: 'asr_text',
        text: finalText,
        is_final: true,
      }));
    }
  };

  rec.onerror = (event) => {
    if (event.error === 'no-speech') {
      // Normal — just silence, ignore
      return;
    }
    if (event.error === 'aborted') {
      // Normal — user stopped or auto-restart
      return;
    }
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      showToast('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风', 'error');
    } else if (event.error === 'network') {
      showToast('语音识别需要网络连接', 'error');
    } else {
      showToast(`语音识别错误: ${event.error}`, 'error');
    }
  };

  rec.onend = () => {
    // Auto-restart if still recording (Chrome stops after silence)
    if (state.isRecording && speechActive) {
      try {
        rec.start();
        console.log('Speech recognition restarted');
      } catch (e) {
        console.warn('Failed to restart speech recognition:', e.message);
      }
    }
  };

  return rec;
}

function mapLangForSpeechAPI(lang) {
  // Map our lang codes to BCP-47 tags for SpeechRecognition
  const map = {
    'zh': 'zh-CN',
    'en': 'en-US',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'es': 'es-ES',
    'ru': 'ru-RU',
    'auto': '',
  };
  return map[lang] || lang || '';
}

function startSpeechRecognition() {
  if (!speechRecognition) {
    speechRecognition = initSpeechRecognition();
  }
  if (speechRecognition) {
    speechActive = true;
    // Update language in case it changed
    speechRecognition.lang = mapLangForSpeechAPI(state.config.sourceLang);
    try {
      speechRecognition.start();
      console.log('Speech recognition started, lang:', speechRecognition.lang);
    } catch (e) {
      console.warn('Speech recognition start error:', e.message);
      // Might already be started
    }
  }
  return !!speechRecognition;
}

function stopSpeechRecognition() {
  speechActive = false;
  if (speechRecognition) {
    try {
      speechRecognition.stop();
    } catch (e) {
      // Already stopped, ignore
    }
  }
}

// ===========================================================================
// Microphone Capture
// ===========================================================================
async function startRecording() {
  if (state.isRecording) return;

  try {
    // Request microphone for volume meter
    state.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Create audio context for volume meter only
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });

    const source = state.audioContext.createMediaStreamSource(state.mediaStream);

    // Analyser for volume meter
    const analyser = state.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    state._analyser = analyser;

    // Dummy processor to keep audio graph alive (required by some browsers)
    const bufferSize = 4096;
    state.processorNode = state.audioContext.createScriptProcessor(bufferSize, 1, 1);
    source.connect(state.processorNode);
    state.processorNode.connect(state.audioContext.destination);

    // Volume meter update (no audio data sent to server — Web Speech API handles ASR)
    state.processorNode.onaudioprocess = () => {
      if (state._analyser) {
        updateVolumeMeter(state._analyser);
      }
    };

    // Start browser-based speech recognition (free, no credentials)
    const srStarted = startSpeechRecognition();

    // Send config to backend
    sendConfigFromInterp();

    state.isRecording = true;
    state.startTime = Date.now();
    updateMicButton();

    // Start duration timer
    state.durationTimer = setInterval(updateDuration, 1000);

    if (!srStarted) {
      // Fallback: Web Speech API not supported — send raw audio for server ASR
      console.log('Falling back to server-side ASR (iFlytek)');
      state.processorNode.onaudioprocess = (event) => {
        if (!state.isRecording || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
        const inputData = event.inputBuffer.getChannelData(0);
        state.ws.send(inputData.buffer);
        if (state._analyser) updateVolumeMeter(state._analyser);
      };
    }
  } catch (err) {
    console.error('Microphone access denied:', err);
    showToast('无法访问麦克风，请检查权限设置', 'error');
  }
}

function stopRecording() {
  state.isRecording = false;

  // Stop speech recognition
  stopSpeechRecognition();

  // Disconnect audio pipeline
  if (state.processorNode) {
    state.processorNode.disconnect();
    state.processorNode = null;
  }
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(track => track.stop());
    state.mediaStream = null;
  }
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
  state._analyser = null;

  // Send end marker
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: 'end' }));
  }

  // Stop timer
  clearInterval(state.durationTimer);
  state.durationTimer = null;

  updateMicButton();
  const meterBar = $('#meterBar');
  if (meterBar) meterBar.style.width = '0%';
}

function updateMicButton() {
  if (!domInterp.micButton) return;
  if (state.isRecording) {
    domInterp.micButton.classList.add('recording');
    if (domInterp.micIcon) domInterp.micIcon.textContent = '⏹️';
    if (domInterp.micText) domInterp.micText.textContent = '停止录音';
  } else {
    domInterp.micButton.classList.remove('recording');
    if (domInterp.micIcon) domInterp.micIcon.textContent = '🎤';
    if (domInterp.micText) domInterp.micText.textContent = '开始录音';
  }
}

function updateVolumeMeter(analyser) {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
  const percentage = Math.min(100, (average / 128) * 100);
  const meterBar = $('#meterBar');
  if (meterBar) meterBar.style.width = percentage + '%';
}

function updateDuration() {
  if (!state.startTime) return;
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  const text = `${mins}:${secs}`;
  if (domInterp.statDuration) domInterp.statDuration.textContent = text;
  if (domHistory.statDuration) domHistory.statDuration.textContent = text;
}

// ===========================================================================
// File Upload — stream audio file through the pipeline
// ===========================================================================
function handleFileUpload(file, useUploadModuleSettings) {
  if (!file) return;

  // Stop any active recording
  if (state.isRecording) stopRecording();

  const reader = new FileReader();
  reader.onload = async function(e) {
    const arrayBuffer = e.target.result;

    // Decode audio to get Float32 PCM
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // Resample to 16kHz mono if needed
      const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
      const offlineSource = offlineCtx.createBufferSource();
      offlineSource.buffer = audioBuffer;
      offlineSource.connect(offlineCtx.destination);
      offlineSource.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const float32Data = renderedBuffer.getChannelData(0);

      // Stream in chunks simulating real-time (200ms chunks)
      const chunkSize = 16000 * 0.2; // 3200 samples per 200ms
      let offset = 0;

      showToast(`正在处理: ${file.name}`, 'info');

      // Show progress in upload module
      if (useUploadModuleSettings && domUpload.uploadProgress) {
        domUpload.uploadProgress.classList.add('visible');
        domUpload.uploadArea.style.display = 'none';
      }

      function sendNextChunk() {
        const totalChunks = Math.ceil(float32Data.length / chunkSize);
        const currentChunk = Math.floor(offset / chunkSize);
        const progress = Math.min(100, Math.round((offset / float32Data.length) * 100));

        // Update progress
        if (useUploadModuleSettings) {
          if (domUpload.progressBarFill) domUpload.progressBarFill.style.width = progress + '%';
          if (domUpload.progressText) domUpload.progressText.textContent = `处理中 ${progress}% (${currentChunk}/${totalChunks})`;
        }

        if (offset >= float32Data.length) {
          // End of file
          if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({ type: 'end' }));
          }
          if (useUploadModuleSettings) {
            if (domUpload.uploadProgress) domUpload.uploadProgress.classList.remove('visible');
            if (domUpload.uploadArea) domUpload.uploadArea.style.display = '';
            if (domUpload.uploadStatus) domUpload.uploadStatus.style.display = '';
            if (domUpload.uploadStatusIcon) domUpload.uploadStatusIcon.textContent = '✅';
            if (domUpload.uploadStatusText) domUpload.uploadStatusText.textContent = '上传完成！查看同声传译模块获取识别结果';
          }
          showToast('音频处理完毕', 'info');
          return;
        }

        const end = Math.min(offset + chunkSize, float32Data.length);
        const chunk = float32Data.slice(offset, end);

        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
          state.ws.send(chunk.buffer);
        }

        offset = end;
        setTimeout(sendNextChunk, 200);
      }

      // Send config before starting
      if (useUploadModuleSettings) {
        sendConfigFromUpload();
      } else {
        sendConfigFromInterp();
      }

      state.isRecording = true;
      state.startTime = Date.now();
      updateMicButton();
      state.durationTimer = setInterval(updateDuration, 1000);

      sendNextChunk();
    } catch (err) {
      console.error('Audio decode error:', err);
      showToast('音频解码失败，请确认文件格式正确', 'error');
      if (useUploadModuleSettings) {
        if (domUpload.uploadProgress) domUpload.uploadProgress.classList.remove('visible');
        if (domUpload.uploadArea) domUpload.uploadArea.style.display = '';
      }
    } finally {
      audioCtx.close();
    }
  };

  reader.readAsArrayBuffer(file);
}

// ===========================================================================
// Configuration sync
// ===========================================================================

// Map UI language codes to API codes (Google Translate / iFlytek)
const LANG_MAP = {
  'zh': 'zh-CN',
  'en': 'en',
  'ja': 'ja',
  'ko': 'ko',
  'fr': 'fr',
  'de': 'de',
  'es': 'es',
  'ru': 'ru',
  'auto': 'auto',
};

function readConfigFromInterp() {
  if (domInterp.sourceLang) {
    const src = domInterp.sourceLang.value;
    state.config.sourceLang = (src === 'auto') ? 'auto' : (LANG_MAP[src] || src);
  }
  if (domInterp.targetLang) {
    state.config.targetLang = LANG_MAP[domInterp.targetLang.value] || 'zh-CN';
  }
  if (domInterp.translateToggle) {
    state.config.translateEnabled = domInterp.translateToggle.checked;
  }
  if (domInterp.scene) {
    state.config.scene = domInterp.scene.value;
  }
  if (domInterp.ttsToggle) {
    state.ttsEnabled = domInterp.ttsToggle.checked;
  }
}

function readConfigFromUpload() {
  if (domUpload.sourceLang) {
    const src = domUpload.sourceLang.value;
    state.config.sourceLang = (src === 'auto') ? 'auto' : (LANG_MAP[src] || src);
  }
  if (domUpload.targetLang) {
    state.config.targetLang = LANG_MAP[domUpload.targetLang.value] || 'zh-CN';
  }
  if (domUpload.translateToggle) {
    state.config.translateEnabled = domUpload.translateToggle.checked;
  }
  if (domUpload.scene) {
    state.config.scene = domUpload.scene.value;
  }
  if (domUpload.ttsToggle) {
    state.ttsEnabled = domUpload.ttsToggle.checked;
  }
}

function sendConfigFromInterp() {
  readConfigFromInterp();
  sendConfigToServer();
}

function sendConfigFromUpload() {
  readConfigFromUpload();
  sendConfigToServer();
}

function sendConfigToServer() {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({
      type: 'config',
      sourceLang: state.config.sourceLang,
      targetLang: state.config.targetLang,
      translateEnabled: state.config.translateEnabled,
      scene: state.config.scene,
    }));
  }
}

// ===========================================================================
// Toast notifications
// ===========================================================================
function showToast(message, type = 'info') {
  // Simple toast — create and auto-remove
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // Inline styles for toast (since it's dynamic)
  Object.assign(toast.style, {
    position: 'fixed',
    top: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: '9999',
    animation: 'fadeIn 0.3s ease',
    background: type === 'error' ? 'rgba(239, 68, 68, 0.9)' :
                type === 'info' ? 'rgba(79, 110, 247, 0.9)' :
                'rgba(16, 185, 129, 0.9)',
    color: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  });

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===========================================================================
// Utility
// ===========================================================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ===========================================================================
// Event Listeners — Navigation
// ===========================================================================

// Sidebar nav items
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const module = item.dataset.module;
    if (module) NAV.navigateTo(module);
  });
});

// Home page module cards
document.querySelectorAll('.nav-card').forEach(card => {
  card.addEventListener('click', () => {
    const module = card.dataset.navigate;
    if (module) NAV.navigateTo(module);
  });
});

// Back-home buttons in module pages
document.querySelectorAll('.back-home').forEach(btn => {
  btn.addEventListener('click', () => {
    const module = btn.dataset.navigate;
    if (module) NAV.navigateTo(module);
  });
});

// Bottom "go home" button in sidebar
const goHomeBtn = $('#goHomeBtn');
if (goHomeBtn) {
  goHomeBtn.addEventListener('click', () => NAV.navigateHome());
}

// ===========================================================================
// Event Listeners — Interp Module
// ===========================================================================

if (domInterp.micButton) {
  domInterp.micButton.addEventListener('click', () => {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });
}

if (domInterp.uploadButton) {
  domInterp.uploadButton.addEventListener('click', () => {
    if (domInterp.fileInput) domInterp.fileInput.click();
  });
}

if (domInterp.fileInput) {
  domInterp.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file, false);
    domInterp.fileInput.value = '';
  });
}

// Config changes — send to backend immediately
[domInterp.sourceLang, domInterp.targetLang, domInterp.scene].forEach(el => {
  if (el) el.addEventListener('change', sendConfigFromInterp);
});
[domInterp.translateToggle, domInterp.ttsToggle].forEach(el => {
  if (el) el.addEventListener('change', sendConfigFromInterp);
});

// Clear history (interp module)
if (domInterp.clearHistory) {
  domInterp.clearHistory.addEventListener('click', clearAllHistory);
}

// ===========================================================================
// Event Listeners — Upload Module
// ===========================================================================

if (domUpload.uploadArea) {
  domUpload.uploadArea.addEventListener('click', () => {
    if (domUpload.fileInput) domUpload.fileInput.click();
  });
}

if (domUpload.fileInput) {
  domUpload.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Reset status
      if (domUpload.uploadStatus) domUpload.uploadStatus.style.display = 'none';
      handleFileUpload(file, true);
    }
    domUpload.fileInput.value = '';
  });
}

// ===========================================================================
// Event Listeners — Desktop Module
// ===========================================================================

if (domDesktop.startBtnMic) {
  domDesktop.startBtnMic.addEventListener('click', () => startDesktopMicMode());
}

if (domDesktop.startBtnSystem) {
  domDesktop.startBtnSystem.addEventListener('click', () => startDesktopSystemMode());
}

if (domDesktop.stopBtn) {
  domDesktop.stopBtn.addEventListener('click', () => stopDesktopSession());
}

if (domDesktop.opacitySlider && domDesktop.opacityValue) {
  domDesktop.opacitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    domDesktop.opacityValue.textContent = val;
    applyPiPOpacity(val);
  });
}

function applyPiPOpacity(val) {
  const pip = desktopState.pipWindow;
  if (!pip || pip === 'fallback') return;
  try {
    const container = pip.document.querySelector('.pip-container');
    if (!container) return;

    if (val === 0) {
      container.style.background = 'transparent';
    } else {
      const opacity = val / 100;
      container.style.background = `rgba(0,0,0,${opacity.toFixed(2)})`;
    }
  } catch (e) {}
}

// Quick toggle between pure text (0%) and semi-transparent background (70%)
const pureSubtitleBtn = $('#pureSubtitleBtn');
if (pureSubtitleBtn) {
  pureSubtitleBtn.textContent = '🪟 添加半透明背景';
  pureSubtitleBtn.addEventListener('click', () => {
    if (domDesktop.opacitySlider) {
      const current = parseInt(domDesktop.opacitySlider.value);
      if (current === 0) {
        domDesktop.opacitySlider.value = 70;
        if (domDesktop.opacityValue) domDesktop.opacityValue.textContent = '70';
        pureSubtitleBtn.textContent = '✨ 恢复纯字幕模式';
      } else {
        domDesktop.opacitySlider.value = 0;
        if (domDesktop.opacityValue) domDesktop.opacityValue.textContent = '0';
        pureSubtitleBtn.textContent = '🪟 添加半透明背景';
      }
      applyPiPOpacity(parseInt(domDesktop.opacitySlider.value));
    }
  });
}

// Config changes
[domDesktop.sourceLang, domDesktop.targetLang].forEach(el => {
  if (el) el.addEventListener('change', () => {
    readDesktopConfig();
    sendConfigToServer();
    // Update speech recognition language if active (all modes use SpeechRecognition)
    if (desktopState.speechRecognition && desktopState.active) {
      desktopState.speechRecognition.lang = mapLangForSpeechAPI(state.config.sourceLang);
      // Restart to apply language change
      try { desktopState.speechRecognition.stop(); } catch (e) {}
    }
  });
});

if (domDesktop.translateToggle) {
  domDesktop.translateToggle.addEventListener('change', () => {
    readDesktopConfig();
    sendConfigToServer();
  });
}

// ===========================================================================
// Event Listeners — History Module
// ===========================================================================

// Search in history module
if (domHistory.searchInput) {
  domHistory.searchInput.addEventListener('input', debounce(performSearchHistory, 150));
}

// Clear history (history module)
if (domHistory.clearButton) {
  domHistory.clearButton.addEventListener('click', clearAllHistory);
}

// Export
if (domHistory.exportButton) {
  domHistory.exportButton.addEventListener('click', handleExport);
}

// Font size in history module
if (domHistory.fontSizeSlider) {
  domHistory.fontSizeSlider.addEventListener('input', (e) => {
    const px = parseInt(e.target.value);
    if (domHistory.fontSizeValue) domHistory.fontSizeValue.textContent = px;
    updateFontSize(px);
  });
}

// ===========================================================================
// Event Listeners — Shared / Global
// ===========================================================================

// Theme toggle
if (dom.themeToggle) {
  dom.themeToggle.addEventListener('click', toggleTheme);
}

// Font size (interp module)
if (domInterp.fontSizeSlider) {
  domInterp.fontSizeSlider.addEventListener('input', (e) => {
    const px = parseInt(e.target.value);
    if (domInterp.fontSizeValue) domInterp.fontSizeValue.textContent = px;
    updateFontSize(px);
    // Sync to history module slider
    if (domHistory.fontSizeSlider) domHistory.fontSizeSlider.value = px;
    if (domHistory.fontSizeValue) domHistory.fontSizeValue.textContent = px;
  });
}

// Search (interp module)
if (domInterp.searchInput) {
  domInterp.searchInput.addEventListener('input', debounce(performSearchInterp, 150));
}

// Keyboard shortcut: Space to toggle recording
document.addEventListener('keydown', (e) => {
  // Ignore when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (state.isRecording) {
      stopRecording();
    } else {
      // Only start recording from interp module (navigate there first)
      if (NAV.currentModule !== 'interp') {
        NAV.navigateTo('interp');
        // Small delay to ensure DOM is ready
        setTimeout(() => startRecording(), 100);
      } else {
        startRecording();
      }
    }
  }

  // ESC exits fullscreen subtitle mode (when body has the class)
  if (e.code === 'Escape' && document.body.classList.contains('fullscreen-mode')) {
    e.preventDefault();
    document.body.classList.remove('fullscreen-mode');
  }
});

// ===========================================================================
// History Management
// ===========================================================================

function clearAllHistory() {
  // Clear search inputs
  if (domInterp.searchInput) domInterp.searchInput.value = '';
  if (domHistory.searchInput) domHistory.searchInput.value = '';

  // Reset interp list
  if (domInterp.historyList) {
    domInterp.historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎤</div>
        <p>已清空记录</p>
        <p class="sub">继续录音将显示新的转录内容</p>
      </div>
    `;
  }

  // Reset history module list
  if (domHistory.historyList) {
    domHistory.historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎤</div>
        <p>尚无记录</p>
        <p class="sub">进入同声传译模块录音后将显示在此</p>
      </div>
    `;
  }

  state.historyEntries = [];
  state.pendingMap.clear();
  state.sentenceCount = 0;
  state.correctionCount = 0;

  // Reset stats
  if (domInterp.statSentences) domInterp.statSentences.textContent = '0';
  if (domInterp.statCorrections) domInterp.statCorrections.textContent = '0';
  if (domHistory.statSentences) domHistory.statSentences.textContent = '0';
  if (domHistory.statCorrections) domHistory.statCorrections.textContent = '0';

  // Clear subtitles
  if (domInterp.subtitleOriginal) domInterp.subtitleOriginal.textContent = '';
  if (domInterp.subtitleTranslation) domInterp.subtitleTranslation.textContent = '';
  if (domSubtitle.bigOriginal) domSubtitle.bigOriginal.textContent = '';
  if (domSubtitle.bigTranslation) domSubtitle.bigTranslation.textContent = '';
  _lastSubtitle = { original: '', translation: '', corrected: false };
}

// ===========================================================================
// Search — module-specific wrappers
// ===========================================================================

function performSearchInterp() {
  if (!domInterp.searchInput) return;
  const query = domInterp.searchInput.value.trim().toLowerCase();
  applySearch(domInterp.historyList, query);
}

function performSearchHistory() {
  if (!domHistory.searchInput) return;
  const query = domHistory.searchInput.value.trim().toLowerCase();
  applySearch(domHistory.historyList, query);
}

function applySearch(list, query) {
  if (!list) return;
  const entries = list.querySelectorAll('.transcript-entry');
  entries.forEach(entry => {
    if (!query) {
      entry.classList.remove('search-hidden');
      return;
    }
    const orig = entry.querySelector('.entry-original')?.textContent || '';
    const trans = entry.querySelector('.entry-translation')?.textContent || '';
    const match = orig.toLowerCase().includes(query) ||
                  trans.toLowerCase().includes(query);
    entry.classList.toggle('search-hidden', !match);
  });
}

// ===========================================================================
// Export — download transcript via hidden <a> element
// ===========================================================================
function handleExport() {
  if (!state.sessionId) {
    showToast('尚无会话数据，请先录音', 'error');
    return;
  }
  const format = domHistory.exportFormat ? domHistory.exportFormat.value : 'srt';
  const url = `/api/export/${state.sessionId}?format=${format}`;
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('正在导出...', 'info');
}

// ===========================================================================
// Theme Toggle — dark / light with localStorage persistence
// ===========================================================================
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  if (dom.themeToggle) dom.themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
  try { localStorage.setItem('theme', next); } catch (_) {}
}

function initTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved && dom.themeToggle) {
      document.documentElement.setAttribute('data-theme', saved);
      dom.themeToggle.textContent = saved === 'dark' ? '🌙' : '☀️';
    }
  } catch (_) {}
}

// ===========================================================================
// Font Size — live adjustment via CSS variables
// ===========================================================================
function updateFontSize(px) {
  document.documentElement.style.setProperty('--subtitle-size', px + 'px');
  document.documentElement.style.setProperty('--history-size', (px - 1) + 'px');
  try { localStorage.setItem('fontSize', px); } catch (_) {}
}

function initFontSize() {
  try {
    const saved = localStorage.getItem('fontSize');
    if (saved) {
      const px = parseInt(saved);
      if (domInterp.fontSizeSlider) domInterp.fontSizeSlider.value = px;
      if (domInterp.fontSizeValue) domInterp.fontSizeValue.textContent = px;
      if (domHistory.fontSizeSlider) domHistory.fontSizeSlider.value = px;
      if (domHistory.fontSizeValue) domHistory.fontSizeValue.textContent = px;
      updateFontSize(px);
    }
  } catch (_) {}
}

// ===========================================================================
// Audio Device Enumeration — list inputs for system audio mode
// ===========================================================================
async function enumerateAudioDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

  try {
    // Need permission first — a quick getUserMedia unlocks device labels
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      // No mic permission — enumerateDevices still works but labels may be empty
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');

    // Stop the temp stream
    if (stream) stream.getTracks().forEach(t => t.stop());

    if (!domDesktop.audioDevice) return;

    // Remember current selection
    const currentVal = domDesktop.audioDevice.value;

    // Rebuild options
    domDesktop.audioDevice.innerHTML = '';

    // Default mic option
    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'default';
    defaultOpt.textContent = '🎤 默认麦克风';
    domDesktop.audioDevice.appendChild(defaultOpt);

    // Screen share option
    const displayOpt = document.createElement('option');
    displayOpt.value = 'display';
    displayOpt.textContent = '🖥️ 屏幕共享音频（标签页+分享音频）';
    domDesktop.audioDevice.appendChild(displayOpt);

    // Add each physical audio input device
    audioInputs.forEach(device => {
      const opt = document.createElement('option');
      opt.value = device.deviceId;
      const label = device.label || `音频设备 ${device.deviceId.slice(0, 8)}`;
      // Detect loopback devices
      const isLoopback = /stereo|mix|混音|loopback|wave.?out|what.?u.?hear|扬声器/i.test(label);
      opt.textContent = (isLoopback ? '🔁 ' : '🎙️ ') + label;
      if (isLoopback) {
        opt.dataset.loopback = 'true';
      }
      domDesktop.audioDevice.appendChild(opt);
    });

    // Restore previous selection
    if (currentVal && domDesktop.audioDevice.querySelector(`option[value="${currentVal}"]`)) {
      domDesktop.audioDevice.value = currentVal;
    }

    // Update hint
    const hasLoopback = audioInputs.some(d =>
      /stereo|mix|混音|loopback|wave.?out|what.?u.?hear/i.test(d.label)
    );
    if (domDesktop.audioDeviceHint) {
      if (hasLoopback) {
        domDesktop.audioDeviceHint.textContent = '✅ 检测到立体声混音设备！选择它以获得纯净系统音频（零质量损失）';
        domDesktop.audioDeviceHint.style.color = 'var(--success)';
      } else {
        domDesktop.audioDeviceHint.textContent = '💡 未检测到回环设备。如需纯净系统音频，请在Windows声音设置中启用"立体声混音"录制设备';
        domDesktop.audioDeviceHint.style.color = 'var(--text-secondary)';
      }
    }

    console.log('[Devices] Audio inputs found:', audioInputs.length,
      audioInputs.map(d => d.label).join(', '));
  } catch (err) {
    console.warn('Device enumeration failed:', err.message);
  }
}

// ===========================================================================
// Initialize
// ===========================================================================
function init() {
  // Load persisted user preferences
  initTheme();
  initFontSize();

  // Start on the home page
  NAV.navigateTo('home');

  // Connect WebSocket
  connectWebSocket();

  // Read default config
  readConfigFromInterp();

  // Enumerate audio devices for desktop module
  enumerateAudioDevices();

  console.log('🎙️  AI Simultaneous Interpretation Assistant ready');
  console.log('   按空格键开始/停止录音');
}

init();
