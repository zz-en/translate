# AI 同声传译助手 (AI Simultaneous Interpretation Assistant)

## 项目概述
实时语音识别 + 翻译系统，浏览器 Web Speech API 识别 → Node.js 中继翻译 → 双语字幕 + TTS 播报。不依赖任何付费 LLM API Key。支持多语言互译、明暗主题切换、字体大小调节、全屏字幕模式、历史搜索、SRT/TXT/HTML 导出。

## 启动命令
```bash
cd D:/桌面/translate/translate/app
npm start
```
浏览器打开 `http://localhost:3000`，点麦克风或按空格键开始。

## 技术栈
- **后端**: Node.js + Express + ws + dotenv
- **前端**: 原生 HTML/CSS/JS (Web Audio API + Web Speech API + WebSocket)
- **ASR 引擎**: 浏览器内置 Web Speech API (Chrome/Edge, 免费无需凭证)
- **ASR 备选**: 讯飞 rtasr (仅用于音频文件上传, `wss://rtasr.xfyun.cn/v1/asr/ws`)
- **翻译**: MyMemory 免费 API + Google Translate 备选
- **音频格式**: PCM 16kHz, 16bit, 单声道, Int16 little-endian

## 项目结构
```
app/
├── server.js           # 后端服务器 (WebSocket 中继 + REST API + 导出)
├── package.json        # 依赖: express, ws, dotenv
├── .env                # API 凭证配置
├── README.md           # 项目文档
└── public/
    ├── index.html      # 前端 HTML 结构
    ├── style.css       # 样式表 (暗色/亮色主题 + 全屏模式)
    └── app.js          # 前端核心逻辑 (WebSocket + Web Audio + TTS + UI)
```

## 环境变量 (.env)
```
PORT=3000
ASR_BASE_URL=wss://rtasr.xfyun.cn/v1/asr/ws
TRANSLATE_APP_ID=your_app_id
TRANSLATE_APP_SECRET=your_app_secret
DEEPSEEK_API_KEY=               # 可选，启用 AI 功能
```

## 核心数据流
```
浏览器麦克风 (Web Speech API 识别)
  → 语音→文字 (浏览器本地, Chrome/Edge 免费)
  → WebSocket ws://localhost:3000/ws 发送 JSON { type: "asr_text", text, is_final }
  → server.js: 存入 SentenceHistory, forward 给浏览器 (type: "asr")
  → is_final 时异步调用 MyMemory/Google Translate → 翻译结果单独发 (type: "translation")
  → 浏览器渲染双语字幕 + 可选 TTS 播报

备选路径 (文件上传, Firefox 等不支持 Web Speech API 的浏览器):
  浏览器 Float32 PCM
  → WebSocket 发送二进制音频
  → server.js: Float32 → Int16 PCM, 6400 字节/200ms 分块
  → 讯飞 rtasr WebSocket (HMAC-SHA1 鉴权)
  → 返回 JSON → 提取原文 → 翻译 → 回传浏览器
```

## 关键实现细节

### dotenv 加载 (server.js:11-12)
```js
const dotenv = require('dotenv');
dotenv.config();  // 启动时自动加载 .env 文件到 process.env
```

### ASR: 浏览器 Web Speech API (app.js:608-700)
```js
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
recognition.continuous = true;  // 持续识别
recognition.interimResults = true;  // 中间结果
recognition.onresult = (event) => {
  // 获得 interim/final 文本 → 发送 asr_text 到服务器
  ws.send(JSON.stringify({ type: 'asr_text', text, is_final }));
};
```
浏览器直接识别语音为文字，免费无需 API 凭证。仅 Chrome/Edge 支持。
Firefox 等不支持时自动回退到讯飞 ASR。

### ASR 备选: 讯飞 rtasr (server.js:313-431)
仅用于音频文件上传或浏览器不支持 Web Speech API 时。

### 讯飞鉴权 (server.js:40-50)
```js
signa = Base64(HmacSHA1(MD5(hex)(appid + ts), apiKey))
// MD5 结果转为 hex 字符串，再用 HMAC-SHA1 签名，最后 Base64
```
URL 参数: `appid`, `ts`, `signa`, `source_lang`, `punc=1`, `pd` (场景)

### asr_text 消息流 (server.js:591-627)
```js
case 'asr_text': {
  // 浏览器已识别文本 → 存入历史 → 转发 asr 结果
  history.upsert(segId, text, '', isFinal);
  // 最终结果触发翻译
  if (isFinal) translateText(text, ...) → type: 'translation'
}
```

### MyMemory 翻译 (server.js:116-147)
```
GET https://api.mymemory.translated.net/get?q={text}&langpair={src}|{tgt}
返回: { responseData: { translatedText: "..." } }
```
免费额度约 1000 字/天。不可用时自动回退 Google Translate。

### 讯飞响应解析 (server.js:90-104)
```js
dataObj.cn.st → 遍历 → ws.cw[].w → 拼接文本
st.type === "0" 表示最终结果，"1" 表示中间结果
```

### 浏览器 → 后端音频传输
- Web Audio API ScriptProcessorNode, bufferSize=4096
- 发送原始 Float32Array.buffer
- 后端识别: 若首字节是 `{` (0x7B)，尝试解析为 JSON 控制消息，否则为音频数据

### 纠错机制
- 讯飞中间结果变化时 `corrected=true`，前端显示删除线 + 紫色闪动动画
- `@keyframes correctionFlash` 在 style.css 中定义

### TTS
- Web Speech API, `speechSynthesis.speak()`
- 优先选择 `lang.startsWith('zh')` 的语音
- 速率 1.1，队列处理

### Google Translate API (server.js:110-136)
```
GET https://translate.googleapis.com/translate_a/single?client=gtx&sl={src}&tl={target}&dt=t&q={text}
返回: [[["translated","original",...]],...]
```
**目标语言可配置**: 由前端 `targetLang` 传入后端 `config.targetLang`，不再硬编码 `zh-CN`。
语言映射: `zh→zh-CN`, `en→en`, `ja→ja`, `ko→ko`, `auto→auto`。

### SentenceHistory 类 (server.js:52-85)
- 跟踪 pending (中间) 和 final (最终) 结果
- upsert(): interim 更新同 segId，final 则从 pending 移除加入 sentences
- getContext(n): 返回最近 n 条翻译上下文
- getPending(): 返回所有中间结果
- getTranscript(): 拼接最终 + 中间结果文本

### 前端语言映射 (app.js:592-602)
```js
const LANG_MAP = {
  'zh': 'zh-CN', 'en': 'en', 'ja': 'ja', 'ko': 'ko',
  'fr': 'fr', 'de': 'de', 'es': 'es', 'ru': 'ru', 'auto': 'auto',
};
```

### 前端 key 函数 (app.js)
- `handleASRResult(msg)` — 更新字幕、历史条目、纠错标识 (170 行)
- `handleTranslationResult(msg)` — 追加翻译到已有条目 (231 行)
- `startRecording()` — 麦克风采集，AudioContext 16kHz (391 行)
- `handleFileUpload(file)` — 音频文件解码 → 重采样 → 模拟流式发送 (515 行)
- `speakTranslation()` — TTS 播报队列 (349 行)
- `toggleTheme()` — 明暗主题切换 + localStorage 持久化 (760 行)
- `initTheme()` — 启动时恢复保存的主题 (768 行)
- `updateFontSize(px)` — 通过 CSS 变量实时调节字体大小 (781 行)
- `initFontSize()` — 启动时恢复保存的字号 (787 行)
- `toggleFullscreenSubtitle()` — 全屏字幕模式，ESC 退出 (801 行)
- `performSearch()` — 历史搜索，debounce 150ms (812 行)
- `handleExport()` — 触发浏览器下载导出文件 (840 行)

### 主题切换 (app.js:760-776, style.css:27-54)
- `data-theme="dark"` (默认) / `data-theme="light"`
- 亮色主题覆盖: `--bg-primary: #f5f5fa`, `--text-primary: #1a1a2e`
- localStorage key: `theme`

### 字体大小 (app.js:781-784, style.css)
- CSS 变量: `--subtitle-size` (默认 15px), `--history-size` (默认 14px)
- 滑块范围: 10px ~ 28px，`localStorage` key: `fontSize`
- 字幕行: `font-size: var(--subtitle-size, 15px)`
- 历史: `font-size: var(--history-size, 14px)`

### 全屏字幕模式 (style.css:618-656)
- `body.fullscreen-mode` 隐藏 header/main/sidePanel
- 字幕覆盖全屏居中显示: 原文 32px, 译文 52px
- 支持 ESC 键退出

### 历史搜索 (app.js:809-827, style.css)
- 输入框 `#searchInput`，debounce 150ms
- 同时搜索原文和译文字段 (不区分大小写)
- 不匹配项通过 `.search-hidden { display: none !important }` 隐藏

### 导出功能 (server.js:155-258)
- 端点: `GET /api/export/:sessionId?format=srt|txt|html`
- SRT: 标准字幕格式 `num\nstart --> end\ntext\n`
- TXT: 带时间戳的纯文本 `[{time}] #{num}\n  {asr}\n  [译文] {translate}\n`
- HTML: 可打印表格页面，含原文和译文两列

### 前端关键 DOM 元素 (index.html)
- `#subtitleOverlay` → `#subtitleOriginal` + `#subtitleTranslation` — 底部实时字幕
- `#historyList` — 滚动转录记录
- `#micButton` — 录音开关
- `#connectionStatus` — WebSocket 连接状态
- `#statSentences`, `#statCorrections`, `#statDuration` — 统计数字
- `#themeToggle` — 明暗主题切换按钮
- `#fullscreenToggle` — 全屏字幕模式切换按钮
- `#fontSizeSlider` / `#fontSizeValue` — 字体大小滑块和显示值
- `#searchInput` — 历史搜索输入框
- `#exportFormat` / `#exportButton` — 导出格式选择和触发按钮
- 设置项: `#sourceLang`, `#targetLang`, `#scene`, `#translateToggle`, `#ttsToggle`

## 依赖
```json
{
  "express": "^4.x",
  "ws": "^8.x",
  "dotenv": "^16.x"
}
```
无前端构建工具，无 TypeScript，无框架依赖 (vanilla JS)。

## API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/history/:sessionId` | 获取当前会话历史记录 |
| GET | `/api/export/:sessionId?format=srt|txt|html` | 导出转录记录 |
| POST | `/api/refine` | 重新翻译 (保留接口) |
| POST | `/api/ai/translate-context` | AI 上下文感知翻译 |
| POST | `/api/ai/polish` | AI 翻译润色 |
| POST | `/api/ai/correct` | AI 智能纠错 |
| POST | `/api/ai/summary` | AI 会议纪要生成 |
| GET | `/api/ai/status` | AI 服务状态 |
| WS | `/ws` | 实时 WebSocket 通信 |

## WebSocket 消息类型
| 类型 | 方向 | 说明 |
|------|------|------|
| `asr_text` | 客户端→服务器 | 浏览器识别的文本 |
| `config` | 客户端→服务器 | 语言/场景配置 |
| `asr` | 服务器→客户端 | ASR 识别结果 |
| `translation` | 服务器→客户端 | 翻译结果 |
| `translation_polished` | 服务器→客户端 | AI 润色后的翻译 |
| `status` | 服务器→客户端 | 连接状态/会话信息 |

## 快捷键
| 快捷键 | 功能 |
|--------|------|
| 空格 | 开始/停止录音 |
| ESC | 退出全屏字幕模式 |

## 更新记录
- 初始实现、讯飞 ASR、Google 翻译、导出、主题等 (详见历史)
- **2026-06-06**: 导航模块重构 — NAV 路由系统，模块生命周期 enterModule/leaveModule，CSS has-settings 侧边栏布局
- **2026-06-06**: 讯飞 ASR 鉴权修复 — 更正 API 路径 `/v1/asr/ws`，参数 `source_lang`，签名算法匹配官方 SDK
- **2026-06-06**: 切换为浏览器 Web Speech API — 讯飞凭据无效，改用 Chrome 内置语音识别（免费），MyMemory 翻译替代 Google（国内可用）
- **2026-06-06**: 字幕区域滚动 — `#subtitleOverlay` max-height 32vh + overflow-y:auto，长句可滑动查看
- **2026-06-07**: 桌面字幕模块 (Desktop Subtitle Module):
  - Document PiP API 悬浮窗，始终置顶
  - 麦克风模式：Web Speech API 识别
  - 系统音频模式：getDisplayMedia 标签页捕获或音频设备回环
  - 音频设备选择器：支持立体声混音/Stereo Mix 数字采集
  - 纯字幕模式：透明背景+金色译文，类似网易云桌面歌词
  - 透明度滑块 (0-100%) + 快捷切换按钮
- **2026-06-07**: 对话模式模块 (Conversation Mode):
  - 双向互译：两人分别说不同语言时自动检测并翻译
  - 对话气泡 UI：左侧"你"蓝色气泡，右侧"对方"渐变色气泡
  - 自动语言检测：基于字符集 (CJK/非CJK) 自动识别说话人
  - 语言预设：中↔英、中↔日、中↔韩、英↔日 一键切换
  - 对话历史管理：清空、搜索
  - 会议纪要：AI 自动生成结构化会议总结
- **2026-06-07**: DeepSeek AI 集成:
  - 翻译润色：翻译后异步调用 DeepSeek 优化译文
  - AI 状态指示器：显示 DeepSeek 是否可用
  - 新增 API: `/api/ai/translate-context`, `/api/ai/polish`, `/api/ai/correct`, `/api/ai/summary`, `/api/ai/status`
  - 逐条目润色按钮：每条转录支持手动触发 AI 润色 (✨)
  - `.env` 新增 `DEEPSEEK_API_KEY` 配置项
- **2026-06-07**: UI/UX 优化:
  - 首页 6 宫格 (3×2) 卡片布局
  - 响应式网格适配：桌面 3 列 → 平板 2 列 → 手机 1 列
  - AI 润色标记：`✨AI` 后缀 + 紫色边框高亮
  - 设置面板 AI 状态实时显示
- **2026-06-07**: Bug 修复：
  - updateHistoryEntry 过渡到 final 时自动添加润色按钮
  - asr_text 处理支持对话模式 speaker/target_lang 参数
  - translation_polished 消息类型支持前端增量更新
  - /api/refine 传参修复
  - 桌面模块语言切换修复（所有模式生效）
  - PiP 回退模式下字幕更新修复
  - 音频缓冲上限 30s 防内存泄漏
  - .desktop-start-btn.hidden CSS 补全
  - 讯飞重连上限 3 次防刷屏
  - 音频设备枚举 + getUserMedia deviceId 采集
