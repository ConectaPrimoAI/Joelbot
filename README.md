# 🤖 JoelBot V20.0 — Motor Agente Autônomo

Bot Telegram inteligente com múltiplas skills: IA conversacional, geração de imagens/vídeos, automação web, GitHub, Google Drive e muito mais.

## 🚀 Deploy no Render (Recomendado)

1. Faça fork do repositório no GitHub
2. Acesse [render.com](https://render.com) e conecte o repositório
3. Configure as variáveis de ambiente (veja `.env.example`)
4. O deploy é automático!

## 🛠️ Skills Disponíveis

| Skill | Comando | API Key Necessária |
|-------|---------|-------------------|
| 🌐 Browser | Screenshot, extração de sites | — |
| 💻 Exec | Comandos bash, criar arquivos | — |
| 🌤️ Weather | Previsão do tempo (3 dias) | — |
| 🎨 Image | Geração de imagens FLUX | — |
| 🎬 Video | Geração de vídeos | `REPLICATE_API_TOKEN` |
| 📊 Slides | Apresentações PowerPoint | — |
| 🐙 GitHub | Criar repos, issues, listar | `GITHUB_TOKEN` |
| ☁️ Drive | Upload, listar arquivos | `GOOGLE_DRIVE_TOKEN` |
| 🎤 Voz | Transcrição Whisper + TTS | — |
| 👁️ Visão | Análise de imagens | — |

## ⚙️ Configuração Local

```bash
# 1. Clone o repositório
git clone https://github.com/ConectaPrimoAI/Joelbot.git
cd Joelbot

# 2. Instale as dependências
npm install

# 3. Configure as variáveis
cp .env.example .env
# Edite .env com seus tokens

# 4. Compile e inicie
npm run build
npm start

# Ou desenvolvimento (compila + inicia)
npm run dev
```

## 🔑 Como Obter as API Keys

### Telegram Token (OBRIGATÓRIO)
1. Abra o Telegram e procure @BotFather
2. Digite `/newbot` e siga as instruções
3. Copie o token gerado

### Groq API Key (OBRIGATÓRIO)
1. Acesse [console.groq.com](https://console.groq.com)
2. Crie uma conta gratuita
3. Gere uma API key em "API Keys"

### GitHub Token (opcional)
1. Acesse [github.com/settings/tokens](https://github.com/settings/tokens)
2. Clique "Generate new token (classic)"
3. Marque o scope `repo` e `read:user`

### Replicate Token (opcional — para vídeos)
1. Acesse [replicate.com](https://replicate.com)
2. Faça login e vá em Account > API tokens

### Google Drive Token (opcional)
1. Acesse [Google OAuth2 Playground](https://developers.google.com/oauthplayground)
2. Selecione o escopo `https://www.googleapis.com/auth/drive`
3. Autorize e copie o Access Token

## 📡 Web Terminal

O bot inclui uma interface web de monitoramento em tempo real.  
Acesse: `http://localhost:3000` (local) ou `https://seu-app.onrender.com` (Render)

## 🏗️ Estrutura do Projeto

```
src/
├── index.ts              # Entry point
├── joelbot-agent.ts      # Lógica principal do bot
├── web-terminal.ts       # Interface web de monitoramento
└── skills/
    ├── Skill.ts          # Interface e Registry
    ├── index.ts          # Registro de skills
    ├── BrowserSkill.ts   # Automação web (Puppeteer)
    ├── DriveSkill.ts     # Google Drive
    ├── ExecSkill.ts      # Execução bash
    ├── GitHubSkill.ts    # GitHub API
    ├── ImageSkill.ts     # Geração de imagens (FLUX)
    ├── SlidesSkill.ts    # Apresentações PowerPoint
    ├── VideoSkill.ts     # Geração de vídeos (Replicate)
    └── WeatherSkill.ts   # Previsão do tempo
```

## 📝 Licença

MIT — Feito com ❤️ por JoelBot V20.0 🤖
