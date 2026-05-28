import express, { Express, Request, Response } from 'express';

const app: Express = express();

// Porta principal — Render usa PORT, local usa 3000
const PORT = parseInt(process.env.PORT || process.env.WEB_TERMINAL_PORT || '3000');

let botLogs: string[] = [];
const MAX_LOGS = 500;
const START_TIME = Date.now();

export function addLog(message: string): void {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const logEntry = `[${timestamp}] ${message}`;
  botLogs.push(logEntry);
  if (botLogs.length > MAX_LOGS) botLogs.shift();
  console.log(logEntry);
}

app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader('X-Powered-By', 'JoelBot V20.0');
  next();
});

// ─── Health Check (para Render / UptimeRobot) ────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    version: 'V20.0',
    timestamp: new Date().toISOString()
  });
});

// ─── API de Logs ─────────────────────────────────────────────
app.get('/api/logs', (_req: Request, res: Response) => {
  res.json({ logs: botLogs, count: botLogs.length });
});

app.post('/api/logs/clear', (_req: Request, res: Response) => {
  botLogs = [];
  res.json({ success: true });
});

// ─── Interface Web ────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JoelBot V20.0 - Web Terminal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; background: #0a0e27; color: #00ff00; overflow: hidden; height: 100vh; }
    .container { display: flex; height: 100vh; flex-direction: column; }
    .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); padding: 20px; border-bottom: 2px solid #00ff00; }
    .header h1 { font-size: 24px; margin-bottom: 5px; text-shadow: 0 0 10px #00ff00; color: #00ff00; }
    .status { display: flex; gap: 20px; font-size: 12px; margin-top: 10px; flex-wrap: wrap; }
    .status-item { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #00ff00; animation: pulse 1s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .terminal { flex: 1; overflow-y: auto; padding: 20px; background: #0a0e27; border: 1px solid #1a3a5c; margin: 10px 20px; border-radius: 5px; font-size: 12px; line-height: 1.8; }
    .log-entry { margin: 2px 0; padding: 3px 8px; border-left: 3px solid #00ff00; word-break: break-all; }
    .log-entry.error { color: #ff4444; border-left-color: #ff4444; background: rgba(255,68,68,0.05); }
    .log-entry.warning { color: #ffaa00; border-left-color: #ffaa00; background: rgba(255,170,0,0.05); }
    .log-entry.success { color: #00ff88; }
    .log-entry.info { color: #00ccff; border-left-color: #00ccff; }
    .footer { background: #1a1f3a; padding: 12px 20px; border-top: 1px solid #1a3a5c; font-size: 11px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    .btn { background: #00ff00; color: #0a0e27; border: none; padding: 6px 14px; border-radius: 3px; cursor: pointer; font-weight: bold; font-family: 'Courier New', monospace; font-size: 12px; }
    .btn:hover { background: #00cc00; }
    .btn-red { background: #ff4444; }
    .btn-red:hover { background: #cc3333; }
    .badge { background: #1a3a5c; color: #00ff00; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
    .skills-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .skill-tag { background: rgba(0,255,0,0.1); border: 1px solid #00ff0044; color: #00ff88; padding: 2px 8px; border-radius: 3px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 JoelBot V20.0 - Web Terminal</h1>
      <div class="status">
        <div class="status-item"><div class="status-dot"></div><span>Status: <strong>ONLINE</strong></span></div>
        <div class="status-item"><span>Logs: <span class="badge" id="log-count">0</span></span></div>
        <div class="status-item"><span>Uptime: <span class="badge" id="uptime">0s</span></span></div>
        <div class="status-item"><span>Versão: <span class="badge">V20.0</span></span></div>
      </div>
      <div class="skills-grid" style="margin-top:10px;">
        <span class="skill-tag">🌐 Browser</span>
        <span class="skill-tag">💻 Exec</span>
        <span class="skill-tag">🌤️ Weather</span>
        <span class="skill-tag">🎨 Image</span>
        <span class="skill-tag">🎬 Video</span>
        <span class="skill-tag">📊 Slides</span>
        <span class="skill-tag">☁️ Drive</span>
        <span class="skill-tag">🐙 GitHub</span>
        <span class="skill-tag">🎤 Voz</span>
        <span class="skill-tag">👁️ Visão</span>
      </div>
    </div>
    <div class="terminal" id="terminal">
      <div class="log-entry success">🚀 JoelBot V20.0 Web Terminal iniciado...</div>
    </div>
    <div class="footer">
      <div style="color:#888">JoelBot V20.0 | Motor Autônomo | Tempo real</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-red" onclick="clearLogs()">🗑️ Limpar</button>
        <button class="btn" onclick="scrollToBottom()">↓ Final</button>
        <button class="btn" onclick="toggleAutoScroll()">⏸ Auto-scroll</button>
      </div>
    </div>
  </div>
  <script>
    const terminal = document.getElementById('terminal');
    const logCount = document.getElementById('log-count');
    const uptime = document.getElementById('uptime');
    const startTime = Date.now();
    let lastCount = 0;
    let autoScroll = true;

    function classifyLog(log) {
      if (log.includes('❌')) return 'error';
      if (log.includes('⚠️')) return 'warning';
      if (log.includes('✅') || log.includes('🚀') || log.includes('🎉')) return 'success';
      if (log.includes('📨') || log.includes('🎯') || log.includes('📤')) return 'info';
      return '';
    }

    function refreshLogs() {
      fetch('/api/logs').then(r => r.json()).then(data => {
        if (data.count === lastCount) return;
        lastCount = data.count;
        const wasAtBottom = terminal.scrollHeight - terminal.clientHeight <= terminal.scrollTop + 80;
        terminal.innerHTML = '';
        data.logs.forEach(log => {
          const div = document.createElement('div');
          const cls = classifyLog(log);
          div.className = 'log-entry' + (cls ? ' ' + cls : '');
          div.textContent = log;
          terminal.appendChild(div);
        });
        logCount.textContent = data.count;
        if (autoScroll && wasAtBottom) terminal.scrollTop = terminal.scrollHeight;
      }).catch(() => {});
    }

    setInterval(refreshLogs, 800);
    setInterval(() => {
      const s = Math.floor((Date.now() - startTime) / 1000);
      if (s < 60) uptime.textContent = s + 's';
      else if (s < 3600) uptime.textContent = Math.floor(s/60) + 'm ' + (s%60) + 's';
      else uptime.textContent = Math.floor(s/3600) + 'h ' + Math.floor((s%3600)/60) + 'm';
    }, 1000);

    function clearLogs() {
      if (!confirm('Limpar todos os logs?')) return;
      fetch('/api/logs/clear', { method: 'POST' }).then(() => { terminal.innerHTML = ''; lastCount = 0; });
    }
    function scrollToBottom() { terminal.scrollTop = terminal.scrollHeight; }
    function toggleAutoScroll() {
      autoScroll = !autoScroll;
      event.target.textContent = autoScroll ? '⏸ Auto-scroll' : '▶ Auto-scroll';
    }
  </script>
</body>
</html>`;
  res.send(html);
});

export function startWebTerminal(): void {
  app.listen(PORT, () => {
    addLog(`🌐 Web Terminal: http://localhost:${PORT}`);
    addLog(`🏥 Health Check: http://localhost:${PORT}/health`);
  });
}

export { app as webTerminalApp };
