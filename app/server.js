/**
 * AI Simultaneous Interpretation Assistant — Backend Server
 *
 * ASR:       iFlytek rtasr (wss://rtasr.xfyun.cn/v1/ws)
 * Translate: Optional Claude API (when ANTHROPIC_API_KEY is set)
 *
 * Pipeline:  Browser mic (Float32) → server converts to Int16 PCM → iFlytek ASR
 *            → server translates via Claude (optional) → browser subtitles + TTS
 */

const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration (from .env)
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const ASR_BASE_URL = process.env.ASR_BASE_URL || 'wss://rtasr.xfyun.cn/v1/asr/ws';
const APP_ID = process.env.TRANSLATE_APP_ID || '';
const APP_SECRET = process.env.TRANSLATE_APP_SECRET || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// Audio constants
const SAMPLE_RATE = 16000;
const NUM_CHANNELS = 1;
const BIT_DEPTH = 16;
const BYTES_PER_SAMPLE = BIT_DEPTH / 8;
const CHUNK_DURATION_MS = 200;
const BYTES_PER_CHUNK = Math.floor(SAMPLE_RATE * BYTES_PER_SAMPLE * NUM_CHANNELS * (CHUNK_DURATION_MS / 1000));

// ---------------------------------------------------------------------------
// iFlytek signature:  signa = Base64(HmacSHA1(MD5(appid + ts), apiKey))
// Matches official Node.js SDK exactly (signature.md)
// ---------------------------------------------------------------------------
function generateSignature(appId, apiKey) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const tt = (appId + ts);
  const baseString = crypto.createHash('md5').update(tt, 'utf-8').digest('hex');
  const hmacKey = Buffer.from(apiKey, 'utf-8');
  const hmac = crypto.createHmac('sha1', hmacKey);
  const signa = hmac.update(baseString, 'utf-8').digest('binary');
  const encodedSigna = Buffer.from(signa, 'binary').toString('base64');
  return { signa: encodedSigna, ts };
}

// ---------------------------------------------------------------------------
// Sentence history — rolling buffer for context-aware correction
// ---------------------------------------------------------------------------
const MAX_HISTORY = 50;

class SentenceHistory {
  constructor() {
    this.sentences = [];
    this.pending = new Map();
  }

  upsert(segId, asr, translate, isFinal) {
    const entry = { seg_id: segId, asr, translate, is_final: isFinal, timestamp: Date.now() };
    if (!isFinal) {
      const prev = this.pending.get(segId);
      this.pending.set(segId, entry);
      const corrected = prev && prev.asr !== asr;
      return { entry, corrected: !!corrected, prevAsr: prev ? prev.asr : null, prevTrans: prev ? prev.translate : null };
    }
    this.pending.delete(segId);
    this.sentences.push(entry);
    if (this.sentences.length > MAX_HISTORY) this.sentences.shift();
    return { entry, corrected: false, prevAsr: null, prevTrans: null };
  }

  getContext(n = 10) {
    return this.sentences.slice(-n).map(s => ({ asr: s.asr, translate: s.translate }));
  }

  getPending() {
    return Array.from(this.pending.values()).sort((a, b) => a.seg_id - b.seg_id);
  }

  getTranscript() {
    const final = this.sentences.map(s => s.asr).join('');
    const interim = this.getPending().map(s => s.asr).join('');
    return final + interim;
  }
}

// ---------------------------------------------------------------------------
// Extract ASR text from iFlytek's response
// Supports both v2 (flat 'asr' field) and v1 (nested cn.st.rt[].ws[].cw[].w)
// ---------------------------------------------------------------------------
function extractASRText(dataObj) {
  // v2 format: flat 'asr' field
  if (typeof dataObj?.asr === 'string') return dataObj.asr;

  // v1 format: nested structure (fallback)
  try {
    const st = dataObj?.cn?.st;
    if (!st || !st.rt) return '';
    return st.rt.map(seg => {
      if (!seg.ws) return '';
      return seg.ws.map(ws => {
        if (!ws.cw) return '';
        return ws.cw.map(cw => cw.w || '').join('');
      }).join('');
    }).join('');
  } catch (_) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Translate via MyMemory (free, no API key, works in China)
// Falls back to Google Translate if MyMemory is unavailable
// ---------------------------------------------------------------------------
async function translateText(text, sourceLang, targetLang) {
  if (!text || !text.trim()) return null;

  const src = sourceLang === 'auto' ? 'en' : (sourceLang || 'en');
  const target = targetLang || 'zh-CN';

  // Try MyMemory first (accessible in China, free tier: ~1000 words/day)
  try {
    const langPair = `${src}|${target}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (resp.ok) {
      const result = await resp.json();
      if (result.responseData && result.responseData.translatedText) {
        return result.responseData.translatedText.trim() || null;
      }
    }
  } catch (err) {
    // MyMemory failed, try Google as fallback
  }

  // Fallback: Google Translate
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(src)}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const result = await resp.json();
    if (Array.isArray(result) && result[0] && Array.isArray(result[0])) {
      const translation = result[0]
        .filter(part => Array.isArray(part) && part[0])
        .map(part => part[0])
        .join('');
      return translation.trim() || null;
    }
  } catch (err) {
    console.error('Translation error:', err.message);
  }
  return null;
}

// ---------------------------------------------------------------------------
// DeepSeek API — AI-powered features (context-aware, polish, correct, summary)
// ---------------------------------------------------------------------------
function getDeepSeekKey() {
  return process.env.DEEPSEEK_API_KEY || '';
}

async function callDeepSeek(messages, options = {}) {
  const apiKey = getDeepSeekKey();
  if (!apiKey) return null;
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'deepseek-chat',
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens || 1024,
      }),
      signal: AbortSignal.timeout(options.timeout || 15000),
    });
    if (!resp.ok) { console.error('[DeepSeek] API error:', resp.status); return null; }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[DeepSeek] Request failed:', err.message);
    return null;
  }
}

// Context-aware translation: uses previous sentences to improve coherence
async function translateWithContext(text, sourceLang, targetLang, contextSentences) {
  const contextStr = contextSentences.length > 0
    ? contextSentences.map((s, i) => `[${i + 1}] 原文: ${s.asr}\n    译文: ${s.translate}`).join('\n')
    : '(无上下文)';
  const messages = [
    { role: 'system', content: `你是一个专业同声传译引擎。根据对话上下文提供准确、连贯的翻译。保持术语一致性，正确处理代词指代。将${sourceLang === 'auto' ? '任意语言' : sourceLang}翻译为${targetLang}。只输出译文，不要解释。` },
    { role: 'user', content: `对话上下文：\n${contextStr}\n\n请翻译：${text}` },
  ];
  return callDeepSeek(messages, { temperature: 0.1, maxTokens: 512 });
}

// Polish Google Translate output for more natural results
async function polishTranslation(text, sourceLang, targetLang) {
  const messages = [
    { role: 'system', content: `你是一个翻译润色引擎。对机翻结果进行润色使其更自然流畅，符合${targetLang}表达习惯。保持原意不变。只输出润色后的译文，不要解释。` },
    { role: 'user', content: `原文: ${text}\n请润色使译文更自然。` },
  ];
  return callDeepSeek(messages, { temperature: 0.2, maxTokens: 512 });
}

// Smart ASR correction using context
async function correctASR(text, contextSentences) {
  const contextStr = contextSentences.map((s, i) => `[${i}] ${s.asr}`).join('\n');
  const messages = [
    { role: 'system', content: '你是语音识别纠错引擎。根据对话上下文检测并纠正识别错误（发音相近的词、数字、专有名词等）。如果文本正确则原样返回。只输出纠正后的文本，不要解释。' },
    { role: 'user', content: `上下文：\n${contextStr}\n\n待纠正：${text}` },
  ];
  return callDeepSeek(messages, { temperature: 0.05, maxTokens: 512 });
}

// Generate meeting summary
async function generateSummary(sentences) {
  const transcript = sentences.map((s, i) =>
    `[${i + 1}] 原文: ${s.asr}\n    译文: ${s.translate || ''}`
  ).join('\n\n');
  const messages = [
    { role: 'system', content: '你是会议纪要生成引擎。根据转录内容生成结构化会议纪要，包括：1. 会议主题 2. 关键讨论点 3. 结论/决策 4. 待办事项。用中文输出，简洁清晰。如转录内容不足，诚实说明。' },
    { role: 'user', content: `转录内容：\n\n${transcript}\n\n请生成会议纪要。` },
  ];
  return callDeepSeek(messages, { temperature: 0.3, maxTokens: 2048, timeout: 30000 });
}

// ---------------------------------------------------------------------------
// Express + HTTP server
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

const sessions = new Map();

app.get('/api/history/:sessionId', (req, res) => {
  const hist = sessions.get(req.params.sessionId);
  if (!hist) return res.json({ sentences: [], pending: [] });
  res.json({ sentences: hist.sentences, pending: hist.getPending() });
});

// ---------------------------------------------------------------------------
// Export transcript — SRT / TXT / HTML formats
// ---------------------------------------------------------------------------
app.get('/api/export/:sessionId', (req, res) => {
  const format = req.query.format || 'srt';
  const hist = sessions.get(req.params.sessionId);
  if (!hist) return res.status(404).json({ error: 'session not found' });

  const sentences = hist.sentences.filter(s => s.is_final);
  if (sentences.length === 0) {
    return res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      .setHeader('Content-Disposition', 'attachment; filename="transcript_empty.txt"')
      .send('No transcript data available.');
  }

  let content, mimeType, ext;

  switch (format) {
    case 'srt':
      content = formatSRT(sentences);
      mimeType = 'text/srt; charset=utf-8';
      ext = 'srt';
      break;
    case 'txt':
      content = formatTXT(sentences);
      mimeType = 'text/plain; charset=utf-8';
      ext = 'txt';
      break;
    case 'html':
      content = formatHTML(sentences);
      mimeType = 'text/html; charset=utf-8';
      ext = 'html';
      break;
    default:
      return res.status(400).json({ error: 'invalid format, use srt|txt|html' });
  }

  const now = new Date().toISOString().slice(0, 10);
  const filename = `transcript_${req.params.sessionId.slice(0, 8)}_${now}.${ext}`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', mimeType);
  res.send(content);
});

// ---------------------------------------------------------------------------
// Export formatter helpers
// ---------------------------------------------------------------------------
function formatTimestamp(ms) {
  const totalSec = ms / 1000;
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSec % 60).toString().padStart(2, '0');
  const ms3 = Math.floor(ms % 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s},${ms3}`;
}

function formatSRT(sentences) {
  return sentences.map((entry, i) => {
    const num = i + 1;
    const start = formatTimestamp(entry.timestamp);
    const end = formatTimestamp(entry.timestamp + 3000); // 3s default display
    return `${num}\n${start} --> ${end}\n${entry.asr}\n${entry.translate || ''}\n`;
  }).join('\n');
}

function formatTXT(sentences) {
  return sentences.map((entry, i) => {
    const time = new Date(entry.timestamp).toLocaleString('zh-CN');
    let line = `[${time}] #${i + 1}\n`;
    line += `  ${entry.asr}\n`;
    if (entry.translate) line += `  [译文] ${entry.translate}\n`;
    return line;
  }).join('');
}

function escapeStr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatHTML(sentences) {
  const rows = sentences.map((entry, i) => {
    const time = new Date(entry.timestamp).toLocaleString('zh-CN');
    const asr = escapeStr(entry.asr);
    const trans = entry.translate ? escapeStr(entry.translate) : '<span style="color:#999">—</span>';
    return `<tr><td>${i + 1}</td><td>${time}</td><td>${asr}</td><td>${trans}</td></tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>Transcript Export</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#333}
  h1{color:#1a1a2e} table{width:100%;border-collapse:collapse;margin-top:20px}
  th,td{padding:8px 12px;border:1px solid #ddd;text-align:left}
  th{background:#f5f5f5} @media print{body{margin:20px}}
</style></head>
<body>
<h1>📝 Transcript Export</h1>
<p>Generated: ${new Date().toLocaleString('zh-CN')} | Sentences: ${sentences.length}</p>
<table><tr><th>#</th><th>时间</th><th>原文</th><th>译文</th></tr>
${rows}</table>
</body></html>`;
}

app.post('/api/refine', async (req, res) => {
  const { sessionId, segId, asr, translate } = req.body;
  if (!sessionId || !asr) return res.status(400).json({ error: 'missing fields' });
  const hist = sessions.get(sessionId);
  if (!hist) return res.status(404).json({ error: 'session not found' });
  const better = await translateText(asr, 'auto', 'zh-CN');
  res.json({ seg_id: segId, refinement: better ? { needs_correction: true, corrected_translation: better } : null });
});

// --- AI endpoints (DeepSeek powered) ---

// Context-aware translation
app.post('/api/ai/translate-context', async (req, res) => {
  if (!getDeepSeekKey()) return res.status(503).json({ error: 'DeepSeek API not configured' });
  const { text, sourceLang, targetLang, sessionId } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'missing text' });
  const hist = sessionId ? sessions.get(sessionId) : null;
  const context = hist ? hist.getContext(5) : [];
  const result = await translateWithContext(text, sourceLang || 'auto', targetLang || 'zh-CN', context);
  res.json({ translation: result, ai_model: 'deepseek' });
});

// Polish translation
app.post('/api/ai/polish', async (req, res) => {
  if (!getDeepSeekKey()) return res.status(503).json({ error: 'DeepSeek API not configured' });
  const { text, targetLang } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'missing text' });
  const result = await polishTranslation(text, 'auto', targetLang || 'zh-CN');
  res.json({ polished: result, ai_model: 'deepseek' });
});

// Smart ASR correction
app.post('/api/ai/correct', async (req, res) => {
  if (!getDeepSeekKey()) return res.status(503).json({ error: 'DeepSeek API not configured' });
  const { text, sessionId } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'missing text' });
  const hist = sessionId ? sessions.get(sessionId) : null;
  const context = hist ? hist.getContext(5).map(s => ({ asr: s.asr })) : [];
  const result = await correctASR(text, context);
  res.json({ corrected: result, ai_model: 'deepseek' });
});

// Meeting summary
app.post('/api/ai/summary', async (req, res) => {
  if (!getDeepSeekKey()) return res.status(503).json({ error: 'DeepSeek API not configured' });
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'missing sessionId' });
  const hist = sessions.get(sessionId);
  if (!hist) return res.status(404).json({ error: 'session not found' });
  const sentences = hist.sentences.filter(s => s.is_final && s.asr.trim());
  if (sentences.length < 2) return res.json({ summary: '转录内容不足，至少需要2句完整对话才能生成纪要。请继续录音。' });
  const result = await generateSummary(sentences);
  res.json({ summary: result, sentenceCount: sentences.length, ai_model: 'deepseek' });
});

// DeepSeek status
app.get('/api/ai/status', (_req, res) => {
  res.json({ available: !!getDeepSeekKey(), model: 'deepseek-chat' });
});

// Save API key to .env (restart required to take effect)
app.post('/api/ai/config', express.json(), (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.trim()) {
    return res.status(400).json({ error: 'API key is required' });
  }

  const fs = require('fs');
  const envPath = path.join(__dirname, '.env');

  try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Update or add DEEPSEEK_API_KEY
    if (/^DEEPSEEK_API_KEY=/m.test(envContent)) {
      envContent = envContent.replace(/^DEEPSEEK_API_KEY=.*$/m, `DEEPSEEK_API_KEY=${apiKey.trim()}`);
    } else {
      envContent += `\nDEEPSEEK_API_KEY=${apiKey.trim()}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');

    // Update in-memory for current session
    process.env.DEEPSEEK_API_KEY = apiKey.trim();
    // Re-bind the module-level variable
    const updatedKey = apiKey.trim();
    // Update the const via module-level reassignment isn't possible in JS,
    // but we can update process.env which callDeepSeek reads from.

    res.json({ success: true, message: 'API key saved. Restart server for persistent changes.' });
  } catch (err) {
    console.error('[Config] Failed to write .env:', err.message);
    res.status(500).json({ error: 'Failed to save API key: ' + err.message });
  }
});

const server = http.createServer(app);

// ---------------------------------------------------------------------------
// WebSocket server — browser ←→ server ←→ iFlytek rtasr
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (browserWs) => {
  console.log('Browser connected');

  const sessionId = crypto.randomUUID();
  const history = new SentenceHistory();
  sessions.set(sessionId, history);

  if (sessions.size > 100) {
    const oldest = [...sessions.keys()].slice(0, sessions.size - 100);
    oldest.forEach(k => sessions.delete(k));
  }

  let asrWs = null;
  let asrReady = false;
  let config = {
    lang: 'en',           // iFlytek: 'cn' = Chinese, 'en' = English
    targetLang: 'zh-CN',  // Google Translate target language
    scene: 'edu',         // iFlytek: 'pd' parameter
    translateEnabled: true,
  };

  let audioBuffer = Buffer.alloc(0);
  let pendingSegId = 0;   // Track current seg_id for translation

  // ====================================================================
  // Connect to iFlytek rtasr (v2 API)
  // ====================================================================
  function connectToASR() {
    if (!APP_ID || !APP_SECRET) {
      console.error('Missing APP_ID or APP_SECRET — check .env');
      browserWs.send(JSON.stringify({ type: 'error', code: 'no_credentials', desc: '未配置 API 凭证，请检查 .env 文件' }));
      return;
    }

    const { signa, ts } = generateSignature(APP_ID, APP_SECRET);
    // Auth in BOTH URL params and HTTP headers for maximum compatibility
    const encodedSigna = encodeURIComponent(signa);
    // v1: use source_lang (not lang), asr_type=1 (sentence-level), audio_sample_rate=16000
    const url = `${ASR_BASE_URL}?appid=${APP_ID}&ts=${ts}&signa=${encodedSigna}&source_lang=${config.lang || 'en'}&punc=1&pd=${config.scene || ''}&asr_type=1&audio_sample_rate=16000`;

    console.log(`[iFlytek] Connecting: ${url.replace(signa, '***').replace(encodedSigna, '***')}`);
    asrWs = new WebSocket(url);

    asrWs.on('open', () => {
      console.log('[iFlytek] Connected ✓');
      asrReady = true;
      asrReconnectAttempts = 0; // reset counter on success

      if (audioBuffer.length > 0) {
        audioBuffer = sendAudioToASR(audioBuffer);
      }

      browserWs.send(JSON.stringify({
        type: 'status', code: 'connected', sessionId, config,
      }));
    });

    asrWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // --- v2 result format: has 'type' field ('asr' or 'voiceprint') ---
        if (msg.type === 'asr' || msg.type === 'voiceprint') {
          handleV2Result(msg);
          return;
        }

        // --- Action-based messages (errors, handshake, v1 results) ---
        switch (msg.action) {
          case 'started':
            console.log('[iFlytek] Handshake confirmed, sid:', msg.sid);
            break;

          case 'error':
            console.error('[iFlytek] Error:', JSON.stringify(msg));
            {
              const desc = msg.desc || '';
              if (desc.includes('illegal access') || desc.includes('no appid')) {
                browserWs.send(JSON.stringify({
                  type: 'error', code: msg.code,
                  desc: '讯飞ASR鉴权失败 — 请检查API凭证或使用浏览器语音识别（Chrome/Edge已自动启用）',
                }));
              } else {
                browserWs.send(JSON.stringify({ type: 'error', code: msg.code, desc: msg.desc }));
              }
            }
            break;

          case 'result': {
            // v1 result format (fallback): data field contains the actual result
            let dataObj;
            try {
              dataObj = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
            } catch (_) {
              dataObj = msg.data;
            }

            const segId = dataObj?.seg_id ?? pendingSegId;
            const stType = dataObj?.cn?.st?.type;
            const isFinal = stType === '0';
            const asr = extractASRText(dataObj);

            if (!asr) break;

            const { corrected, prevAsr } = history.upsert(segId, asr, '', isFinal);

            browserWs.send(JSON.stringify({
              type: 'asr',
              seg_id: segId,
              asr: asr,
              translate: '',
              is_final: isFinal,
              corrected: corrected,
              prev_asr: prevAsr,
              prev_translate: null,
              sessionId: sessionId,
            }));

            if (isFinal && asr.trim() && config.translateEnabled) {
              translateText(asr, config.lang, config.targetLang).then(trans => {
                if (trans) {
                  history.upsert(segId, asr, trans, true);
                  browserWs.send(JSON.stringify({
                    type: 'translation',
                    seg_id: segId,
                    translate: trans,
                    sessionId: sessionId,
                  }));
                  if (getDeepSeekKey()) {
                    polishTranslation(trans, config.lang, config.targetLang).then(polished => {
                      if (polished && polished !== trans) {
                        history.upsert(segId, asr, polished, true);
                        browserWs.send(JSON.stringify({
                          type: 'translation_polished',
                          seg_id: segId,
                          translate: polished,
                          original_translate: trans,
                          sessionId: sessionId,
                        }));
                      }
                    }).catch(() => {});
                  }
                }
              });
            }

            pendingSegId = Math.max(pendingSegId, segId);
            break;
          }

          default:
            console.log('[iFlytek] Unknown message:', JSON.stringify(msg).slice(0, 200));
        }
      } catch (err) {
        console.error('[iFlytek] Parse error:', err.message);
      }
    });

    asrWs.on('error', (err) => {
      console.error('[iFlytek] WebSocket error:', err.message);
      // Don't send error to browser — file uploads use browser SpeechRecognition
      // Only log server-side; avoids confusing "404" messages for users
    });

    asrWs.on('close', (code) => {
      console.log('[iFlytek] Disconnected, code:', code);
      asrReady = false;
      asrReconnectAttempts++;
      if (asrReconnectAttempts <= 3) {
        setTimeout(() => {
          if (browserWs.readyState === WebSocket.OPEN) connectToASR();
        }, 5000);
      } else {
        console.log('[iFlytek] Max reconnect attempts reached — giving up');
        // Notify browser once, gently
        browserWs.send(JSON.stringify({
          type: 'status', code: 'asr_unavailable',
          desc: '讯飞ASR暂不可用，文件上传请使用浏览器语音识别模式',
        }));
      }
    });
  }

  // --- v2 result handler ---
  function handleV2Result(msg) {
    const segId = msg.seg_id ?? pendingSegId;
    const isFinal = msg.is_final === true || msg.is_final === 'True' || msg.is_final === 1;
    const asr = extractASRText(msg);
    const trans = msg.translate || '';

    if (!asr) return;

    const { corrected, prevAsr } = history.upsert(segId, asr, '', isFinal);

    // Send ASR result to browser
    browserWs.send(JSON.stringify({
      type: 'asr',
      seg_id: segId,
      asr: asr,
      translate: trans,
      is_final: isFinal,
      corrected: corrected,
      prev_asr: prevAsr,
      prev_translate: null,
      sessionId: sessionId,
    }));

    // If v2 provided translation, send it too
    if (trans && isFinal) {
      history.upsert(segId, asr, trans, true);
      browserWs.send(JSON.stringify({
        type: 'translation',
        seg_id: segId,
        translate: trans,
        sessionId: sessionId,
      }));
    }

    // Fallback: use Google Translate for final sentences without v2 translation
    if (isFinal && asr.trim() && !trans && config.translateEnabled) {
      translateText(asr, config.lang, config.targetLang).then(gtTrans => {
        if (gtTrans) {
          history.upsert(segId, asr, gtTrans, true);
          browserWs.send(JSON.stringify({
            type: 'translation',
            seg_id: segId,
            translate: gtTrans,
            sessionId: sessionId,
          }));
          // AI polish
          if (getDeepSeekKey()) {
            polishTranslation(gtTrans, config.lang, config.targetLang).then(polished => {
              if (polished && polished !== gtTrans) {
                history.upsert(segId, asr, polished, true);
                browserWs.send(JSON.stringify({
                  type: 'translation_polished',
                  seg_id: segId,
                  translate: polished,
                  original_translate: gtTrans,
                  sessionId: sessionId,
                }));
              }
            }).catch(() => {});
          }
        }
      });
    }

    pendingSegId = Math.max(pendingSegId, segId);
  }

  // --- Send v2 control message (language + scene config) ---
  function sendV2ControlMessage() {
    if (!asrWs || asrWs.readyState !== WebSocket.OPEN) return;
    const ctrlMsg = JSON.stringify({
      config: {
        lang: {
          source_lang: config.lang || 'en',
          target_lang: config.targetLang || 'zh-CN',
        },
      },
      scene: config.scene || 'edu',
    });
    asrWs.send(ctrlMsg);
    console.log(`[iFlytek] Control sent: lang=${config.lang}→${config.targetLang} scene=${config.scene}`);
  }

  // ====================================================================
  // Send Int16 PCM audio chunks to iFlytek
  // ====================================================================
  function sendAudioToASR(buffer) {
    if (!asrWs || asrWs.readyState !== WebSocket.OPEN) return Buffer.alloc(0);

    let offset = 0;
    while (offset + BYTES_PER_CHUNK <= buffer.length) {
      asrWs.send(buffer.slice(offset, offset + BYTES_PER_CHUNK));
      offset += BYTES_PER_CHUNK;
    }
    return offset < buffer.length ? buffer.slice(offset) : Buffer.alloc(0);
  }

  function sendEndMarker() {
    if (asrWs && asrWs.readyState === WebSocket.OPEN) {
      asrWs.send(JSON.stringify({ end: true }));
    }
  }

  // ====================================================================
  // Handle browser messages
  // ====================================================================
  browserWs.on('message', (data) => {
    if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
      const buf = Buffer.from(data);

      // If it starts with '{', try to parse as JSON control message
      if (buf.length > 0 && buf[0] === 0x7B) {
        try {
          handleBrowserJson(JSON.parse(buf.toString()));
        } catch (_) { /* fall through to audio */ }
        return;
      }

      // Ensure ASR is connected (lazy connection on first audio)
      ensureASRConnected();

      // Convert Float32 PCM → Int16 PCM
      const float32 = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      audioBuffer = Buffer.concat([audioBuffer, Buffer.from(int16.buffer)]);

      // Cap buffer at 30 seconds of audio to prevent memory leak
      const MAX_BUFFER = BYTES_PER_CHUNK * 150; // 150 chunks × 200ms = 30s
      if (audioBuffer.length > MAX_BUFFER) {
        audioBuffer = audioBuffer.slice(-MAX_BUFFER);
      }

      if (asrReady && audioBuffer.length >= BYTES_PER_CHUNK) {
        audioBuffer = sendAudioToASR(audioBuffer);
      }
      return;
    }

    // Text message
    try {
      handleBrowserJson(JSON.parse(data.toString()));
    } catch (err) {
      console.error('Browser message parse error:', err.message);
    }
  });

  function handleBrowserJson(msg) {
    switch (msg.type) {
      case 'config': {
        if (msg.sourceLang) config.lang = msg.sourceLang;
        if (msg.targetLang) config.targetLang = msg.targetLang;
        if (msg.translateEnabled !== undefined) config.translateEnabled = msg.translateEnabled;
        if (msg.scene) config.scene = msg.scene;

        // If iFlytek is connected, send control message to update lang/scene
        if (asrWs && asrWs.readyState === WebSocket.OPEN) {
          sendV2ControlMessage();
        }
        browserWs.send(JSON.stringify({ type: 'status', code: 'config_updated', config }));
        break;
      }

      case 'asr_text': {
        const text = msg.text || '';
        const isFinal = msg.is_final === true;
        if (!text.trim()) break;

        const segId = ++pendingSegId;
        const { corrected, prevAsr } = history.upsert(segId, text, '', isFinal);

        browserWs.send(JSON.stringify({
          type: 'asr',
          seg_id: segId,
          asr: text,
          translate: '',
          is_final: isFinal,
          corrected: corrected,
          prev_asr: prevAsr,
          prev_translate: null,
          sessionId: sessionId,
        }));

        if (isFinal && text.trim() && config.translateEnabled) {
          // Use conversation-specific target language if provided
          const targetLang = msg.target_lang || config.targetLang;
          const sourceLang = msg.source_lang || config.lang;
          translateText(text, sourceLang, targetLang).then(trans => {
            if (trans) {
              history.upsert(segId, text, trans, true);
              browserWs.send(JSON.stringify({
                type: 'translation',
                seg_id: segId,
                translate: trans,
                sessionId: sessionId,
              }));
              // AI polish: async, non-blocking
              if (getDeepSeekKey()) {
                polishTranslation(trans, sourceLang, targetLang).then(polished => {
                  if (polished && polished !== trans) {
                    history.upsert(segId, text, polished, true);
                    browserWs.send(JSON.stringify({
                      type: 'translation_polished',
                      seg_id: segId,
                      translate: polished,
                      original_translate: trans,
                      sessionId: sessionId,
                    }));
                  }
                }).catch(() => {});
              }
            }
          });
        }
        break;
      }

      case 'end':
        sendEndMarker();
        break;

      case 'reconnect_asr':
        if (asrWs) { try { asrWs.close(); } catch (_) { /* ok */ } }
        audioBuffer = Buffer.alloc(0);
        asrConnectAttempted = true;
        connectToASR();
        break;

      default:
        console.log('Unknown browser msg:', msg.type);
    }
  }

  browserWs.on('close', () => {
    console.log('Browser disconnected, session:', sessionId.slice(0, 8));
    sendEndMarker();
    if (asrWs) { try { asrWs.close(); } catch (_) { /* ok */ } }
    setTimeout(() => { sessions.delete(sessionId); }, 5 * 60 * 1000);
  });

  browserWs.on('error', (err) => console.error('Browser WS error:', err.message));

  browserWs.send(JSON.stringify({ type: 'status', code: 'ready', sessionId }));

  // Don't connect to iFlytek immediately — wait for audio data or config.
  // This avoids showing auth errors on page load before the user interacts.
  let asrConnectAttempted = false;
  let asrReconnectAttempts = 0;

  function ensureASRConnected() {
    if (!asrConnectAttempted) {
      asrConnectAttempted = true;
      connectToASR();
    }
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  const hasCreds = APP_ID && APP_ID !== 'your_app_id';
  const hasAI = !!getDeepSeekKey();
  console.log(`\n🎙️  AI Simultaneous Interpretation Assistant`);
  console.log(`   Server:      http://localhost:${PORT}`);
  console.log(`   WebSocket:   ws://localhost:${PORT}/ws`);
  console.log(`   ASR:         ✓ Browser Web Speech API (Chrome/Edge, free)`);
  console.log(`   ASR Fallback:${hasCreds ? ' iFlytek rtasr (file upload)' : ' ✗ not configured'}`);
  console.log(`   Translation: ✓ MyMemory (free) + Google Translate fallback`);
  console.log(`   AI Features: ${hasAI ? '✓ DeepSeek (context, polish, correct, summary)' : '✗ not configured — set DEEPSEEK_API_KEY in .env'}\n`);
});
