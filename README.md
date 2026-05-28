# 🤖 JoelBot V20.0

Bot Telegram com agente autônomo — Browser, Imagens, Vídeos, Slides, GitHub, Drive e muito mais.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `TELEGRAM_TOKEN` | ✅ | Token do bot ([@BotFather](https://t.me/BotFather)) |
| `GROQ_API_KEY` | ✅ | API key da Groq ([console.groq.com](https://console.groq.com)) |
| `GOOGLE_DRIVE_TOKEN` | ❌ | OAuth2 token do Google Drive |
| `GITHUB_TOKEN` | ❌ | Token GitHub (scope: `repo`) |
| `REPLICATE_API_TOKEN` | ❌ | Token Replicate para geração de vídeos |
| `CHROME_PATH` | ❌ | Caminho do Chrome (ex: `/usr/bin/google-chrome-stable`) |

## Instalação local

```bash
cp .env.example .env
# Preencha o .env
npm install
npm run dev
```

## Deploy no Render

1. Faça push do repositório
2. Crie um **Web Service** no Render apontando para este repo
3. Configure as variáveis de ambiente no painel
4. O `render.yaml` já configura tudo automaticamente

## Skills disponíveis

- 📸 `[SYSTEM_BROWSER:]` — Screenshots e extração de texto de sites
- 💻 `[SYSTEM_EXEC:]` — Execução de comandos bash e criação de arquivos
- 🌤️ `[SYSTEM_WEATHER:]` — Previsão do tempo
- 🎨 `[SYSTEM_IMAGE:]` — Geração de imagens (Pollinations FLUX)
- 🎬 `[SYSTEM_VIDEO:]` — Geração de vídeos (Replicate minimax)
- 📊 `[SYSTEM_SLIDES:]` — Apresentações PowerPoint
- ☁️ `[SYSTEM_DRIVE:]` — Google Drive (upload/listar)
- 🐙 `[SYSTEM_GIT:]` — GitHub (criar repos/listar)
