import { Telegraf, Context } from 'telegraf';
import Groq from 'groq-sdk';
import axios from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';
import googleTTS from 'google-tts-api';
import { registry } from './skills/index.js';
import { startWebTerminal, addLog } from './web-terminal.js';

// ─── Validação de variáveis obrigatórias ───────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim();
const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("❌ ERRO CRÍTICO: TELEGRAM_TOKEN e GROQ_API_KEY são obrigatórios.");
    console.error("   Configure as variáveis de ambiente antes de iniciar o bot.");
    process.exit(1);
}

const bot = new Telegraf(TELEGRAM_TOKEN);
export const groq = new Groq({ apiKey: GROQ_API_KEY });

// ─── Storage em memória ────────────────────────────────────────────────────
const joelBotStorage = {
    historico: {} as Record<number, Array<{ role: 'user' | 'assistant' | 'system'; content: string }>>,
};

// ─── System Prompt ─────────────────────────────────────────────────────────
const promptMestre = `Você é o JoelBot V20.0, um agente autônomo sênior e assistente pessoal do Joel.
Sua comunicação é humana, direta, amigável e eficiente. Sempre responde em português do Brasil.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRA #1 — CRÍTICA E ABSOLUTA:
Para cumprimentos, conversas casuais, perguntas gerais, piadas, respostas informativas ou qualquer interação que NÃO requeira executar uma ferramenta específica, responda APENAS com texto puro. ZERO tags [SYSTEM_*].

Exemplos de respostas SEM tags:
- "Oi" → Responda com saudação
- "Tudo bem?" → Responda normalmente
- "Qual capital do Brasil?" → Responda diretamente
- "Me conta uma piada" → Conte a piada
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGRA #2 — Skills (use SOMENTE quando explicitamente solicitado):
Inclua UMA tag no FINAL da mensagem somente quando o usuário pedir uma dessas ações:

1. [SYSTEM_BROWSER: acao="screenshot", url="https://exemplo.com"] — capturar screenshot de site
   [SYSTEM_BROWSER: acao="extract", url="https://exemplo.com"] — extrair texto de site
   [SYSTEM_BROWSER: acao="click", url="https://exemplo.com", selector=".btn"] — clicar em elemento
   [SYSTEM_BROWSER: acao="type", url="https://exemplo.com", selector="#input", texto="valor"] — digitar texto

2. [SYSTEM_EXEC: acao="exec", cmd="ls -la"] — executar comando bash no servidor
   [SYSTEM_EXEC: acao="criar", cmd="conteúdo do arquivo", nome="arquivo.ext"] — criar arquivo
   [SYSTEM_EXEC: acao="ler", nome="arquivo.ext"] — ler arquivo

3. [SYSTEM_WEATHER: local="Chapecó, SC"] — previsão do tempo atual e 3 dias

4. [SYSTEM_IMAGE: prompt="detailed description in english, high quality, photorealistic"] — gerar imagem com FLUX

5. [SYSTEM_VIDEO: prompt="short video description in english"] — gerar vídeo curto (requer REPLICATE_API_TOKEN)

6. [SYSTEM_SLIDES: tema="Título da Apresentação", conteudo="# Slide 1\nConteudo\n---\n# Slide 2\nConteudo"] — criar PPTX

7. [SYSTEM_GIT: acao="repo", titulo="nome-repositorio", privado="false", descricao="descrição"] — criar repositório
   [SYSTEM_GIT: acao="listar"] — listar repositórios
   [SYSTEM_GIT: acao="issue", repo="nome-repo", titulo="título", body="descrição"] — criar issue
   [SYSTEM_GIT: acao="perfil"] — ver perfil GitHub

8. [SYSTEM_DRIVE: acao="upload", nome="arquivo.txt", conteudo="texto do arquivo"] — enviar para Drive
   [SYSTEM_DRIVE: acao="listar"] — listar arquivos no Drive
   [SYSTEM_DRIVE: acao="criar", nome="doc.gdoc"] — criar documento Google

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRA #3 — Formatação:
- Use *negrito* para destacar pontos importantes
- Use \`código\` para nomes de arquivos, comandos e variáveis
- A tag vai SEMPRE no FINAL, após sua resposta amigável
- Nunca coloque tags no meio do texto
- Máximo 1 tag por resposta`;

// ─── Função de áudio TTS ───────────────────────────────────────────────────
async function gerarAudioTTS(texto: string, userId: number): Promise<string | null> {
    const file = path.join(process.cwd(), `voice_${userId}_${Date.now()}.mp3`);
    try {
        // Remove emojis e markdown do texto para TTS
        const textoLimpo = texto
            .replace(/\*+/g, '')
            .replace(/`+/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
            .replace(/[^\w\s\.,!?;:áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ\-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 500); // Máximo 500 chars para TTS

        if (!textoLimpo) return null;

        const urls = (googleTTS as any).getAllAudioUrls(textoLimpo, {
            lang: 'pt-BR',
            splitPunct: '.,!?',
            slow: false
        });

        const bufs: Buffer[] = [];
        for (const u of urls) {
            const r = await axios.get(u.url, { responseType: 'arraybuffer', timeout: 10000 });
            bufs.push(Buffer.from(r.data));
        }

        if (!bufs.length) return null;
        fs.writeFileSync(file, Buffer.concat(bufs));
        return file;
    } catch (e: any) {
        addLog(`⚠️ TTS erro: ${e.message}`);
        return null;
    }
}

// ─── Processamento principal ───────────────────────────────────────────────
async function processarFluxoJoelBot(ctx: Context, msgUsuario: string, responderVoz = false): Promise<void> {
    const userId = ctx.from?.id || 0;
    const username = ctx.from?.first_name || 'Usuário';

    if (!joelBotStorage.historico[userId]) {
        joelBotStorage.historico[userId] = [];
    }

    try {
        await ctx.sendChatAction('typing');
        addLog(`📨 [${userId}/${username}] ${msgUsuario.substring(0, 80)}`);

        const chat = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: promptMestre },
                ...joelBotStorage.historico[userId].slice(-16), // máximo 8 pares
                { role: 'user', content: msgUsuario }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.4,
            max_tokens: 2048
        });

        const respostaBruta = chat.choices[0].message.content || "";
        // Remove tags SYSTEM antes de mostrar ao usuário
        const textoLimpo = respostaBruta
            .replace(/\[SYSTEM_[^\]]+\]/gs, '')
            .trim();

        // Envia resposta de texto
        if (textoLimpo) {
            try {
                await ctx.reply(textoLimpo, { parse_mode: 'Markdown' });
            } catch {
                // Se Markdown falhar, envia como texto puro
                await ctx.reply(textoLimpo);
            }
            addLog(`✅ Resposta enviada a ${username} (${userId})`);

            // Responde em voz se solicitado
            if (responderVoz) {
                const audioFile = await gerarAudioTTS(textoLimpo, userId);
                if (audioFile) {
                    try {
                        await ctx.replyWithVoice({ source: audioFile });
                        addLog(`🎤 Áudio enviado a ${userId}`);
                    } catch (e: any) {
                        addLog(`⚠️ Falha ao enviar áudio: ${e.message}`);
                    } finally {
                        try { fs.unlinkSync(audioFile); } catch {}
                    }
                }
            }
        }

        // ─── Sistema de Skills ───────────────────────────────────────
        const skill = await registry.selectBestSkill(respostaBruta);
        if (skill) {
            addLog(`🎯 Skill ativada: ${skill.name}`);
            try {
                const result = await skill.execute(respostaBruta, ctx);

                if (!result) {
                    // Skill retornou vazio — nenhuma ação necessária
                } else if (typeof result === 'string') {
                    if (result.trim()) {
                        try {
                            await ctx.reply(result, { parse_mode: 'Markdown' });
                        } catch {
                            await ctx.reply(result);
                        }
                    }
                } else {
                    // Resultado estruturado com arquivo
                    if (result.text) {
                        try {
                            await ctx.reply(result.text, { parse_mode: 'Markdown' });
                        } catch {
                            await ctx.reply(result.text);
                        }
                    }

                    if (result.file && fs.existsSync(result.file)) {
                        try {
                            await ctx.sendChatAction(
                                result.type === 'video' ? 'upload_video' :
                                result.type === 'photo' ? 'upload_photo' : 'upload_document'
                            );

                            if (result.type === 'video') {
                                await ctx.replyWithVideo({ source: result.file });
                            } else if (result.type === 'photo') {
                                await ctx.replyWithPhoto({ source: result.file });
                            } else if (result.type === 'voice') {
                                await ctx.replyWithVoice({ source: result.file });
                            } else {
                                await ctx.replyWithDocument({ source: result.file });
                            }
                            addLog(`📤 Arquivo enviado: ${path.basename(result.file)}`);
                        } catch (fileError: any) {
                            addLog(`⚠️ Erro ao enviar arquivo: ${fileError.message}`);
                        } finally {
                            try { fs.unlinkSync(result.file); } catch {}
                        }
                    }
                }
            } catch (skillError: any) {
                addLog(`⚠️ Skill ${skill.name} erro: ${skillError.message}`);
                // Falha silenciosa — não expõe erro técnico ao usuário
            }
        }

        // Atualiza histórico (mantém máximo 20 mensagens = 10 pares)
        joelBotStorage.historico[userId].push(
            { role: 'user', content: msgUsuario },
            { role: 'assistant', content: textoLimpo || respostaBruta }
        );
        if (joelBotStorage.historico[userId].length > 20) {
            joelBotStorage.historico[userId].splice(0, 2);
        }

    } catch (error: any) {
        addLog(`❌ Erro crítico ao processar mensagem de ${userId}: ${error.message}`);
        await ctx.reply("Tive um probleminha técnico momentâneo. Pode tentar novamente? 🔄").catch(() => {});
    }
}

// ─── Handlers do Telegram ──────────────────────────────────────────────────

bot.command('start', async (ctx) => {
    const nome = ctx.from?.first_name || 'Joel';
    await ctx.reply(
        `🤖 *JoelBot V20.0 Online!*\n\n` +
        `Olá, *${nome}*! Estou pronto para ajudar.\n\n` +
        `*🛠️ Skills disponíveis:*\n` +
        `📸 Screenshots e extração de sites\n` +
        `🎨 Geração de imagens (FLUX)\n` +
        `🎬 Geração de vídeos (Replicate)\n` +
        `🌤️ Previsão do tempo\n` +
        `📊 Apresentações PowerPoint\n` +
        `💻 Execução de comandos bash\n` +
        `🐙 Integração GitHub\n` +
        `☁️ Google Drive\n` +
        `🎤 Transcrição de áudio (Whisper)\n` +
        `👁️ Análise de imagens (Vision)\n\n` +
        `_Digite qualquer mensagem para começar!_`,
        { parse_mode: 'Markdown' }
    );
    addLog(`🚀 /start de ${ctx.from?.id} (${nome})`);
});

bot.command('help', async (ctx) => {
    await ctx.reply(
        `📖 *Comandos JoelBot V20.0*\n\n` +
        `• /start — Iniciar o bot\n` +
        `• /help — Esta ajuda\n` +
        `• /status — Status do sistema\n` +
        `• /limpar — Limpar histórico de conversa\n\n` +
        `*Como usar as Skills:*\n` +
        `Basta pedir naturalmente!\n\n` +
        `_Exemplos:_\n` +
        `• "Tira um screenshot de google.com"\n` +
        `• "Gera uma imagem de um gato robótico"\n` +
        `• "Como está o tempo em São Paulo?"\n` +
        `• "Cria um repositório chamado meu-projeto"\n` +
        `• "Faz uma apresentação sobre IA"\n` +
        `• "Roda o comando: ls -la"`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('status', async (ctx) => {
    const userId = ctx.from?.id || 0;
    const histCount = joelBotStorage.historico[userId]?.length || 0;
    const uptime = Math.floor(process.uptime());
    const uptimeStr = uptime < 60 ? `${uptime}s` :
        uptime < 3600 ? `${Math.floor(uptime/60)}m ${uptime%60}s` :
        `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`;

    const skills = registry.getAll().map(s => `✅ ${s.name}`).join('\n');

    await ctx.reply(
        `📊 *Status JoelBot V20.0*\n\n` +
        `🟢 Online\n` +
        `⏱️ Uptime: ${uptimeStr}\n` +
        `💬 Mensagens no histórico: ${histCount}\n` +
        `🤖 Modelo: llama-3.3-70b-versatile\n\n` +
        `*Skills carregadas:*\n${skills}`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('limpar', async (ctx) => {
    const userId = ctx.from?.id || 0;
    joelBotStorage.historico[userId] = [];
    addLog(`🗑️ Histórico limpo para ${userId}`);
    await ctx.reply('🗑️ Histórico de conversa limpo! Podemos começar do zero.');
});

// Handler principal de texto
bot.on('text', (ctx) => {
    return processarFluxoJoelBot(ctx, ctx.message.text, false);
});

// ─── Handler de Fotos (Vision) ────────────────────────────────────────────
bot.on('photo', async (ctx) => {
    try {
        await ctx.sendChatAction('typing');
        const photos = (ctx.message as any).photo as Array<{ file_id: string; width: number; height: number }>;
        const photo = photos[photos.length - 1]; // maior resolução

        addLog(`🖼️ Foto recebida de ${ctx.from?.id}`);

        const fileLink = await bot.telegram.getFileLink(photo.file_id);
        const imgResponse = await axios.get(fileLink.href, {
            responseType: 'arraybuffer',
            timeout: 20000
        });
        const base64 = Buffer.from(imgResponse.data).toString('base64');
        const mimeType = 'image/jpeg';

        const caption = (ctx.message as any).caption?.trim()
            || 'Descreva esta imagem em detalhes em português do Brasil. Inclua cores, objetos, pessoas, texto visível e contexto.';

        const chat = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: { url: `data:${mimeType};base64,${base64}` }
                    },
                    { type: 'text', text: caption }
                ] as any
            }],
            max_tokens: 1024,
            temperature: 0.3
        });

        const analysisText = chat.choices[0].message.content || "Não consegui analisar a imagem.";
        try {
            await ctx.reply(`🔍 *Análise da imagem:*\n\n${analysisText}`, { parse_mode: 'Markdown' });
        } catch {
            await ctx.reply(`🔍 ${analysisText}`);
        }
        addLog(`✅ Imagem analisada para ${ctx.from?.id}`);

    } catch (error: any) {
        addLog(`❌ Erro ao analisar imagem: ${error.message}`);
        await ctx.reply("Não consegui processar a imagem. Tente novamente. 📸").catch(() => {});
    }
});

// ─── Handler de Áudio/Voz ─────────────────────────────────────────────────
bot.on('voice', async (ctx) => {
    let tempFile = '';
    try {
        await ctx.sendChatAction('typing');
        const msgQualquer = ctx.message as any;
        const fid = msgQualquer.voice?.file_id;
        if (!fid) return;

        addLog(`🎤 Áudio de voz recebido de ${ctx.from?.id}`);

        const link = await bot.telegram.getFileLink(fid);
        const r = await axios.get(link.href, { responseType: 'arraybuffer', timeout: 30000 });
        tempFile = path.join(process.cwd(), `input_${fid}_${Date.now()}.ogg`);
        fs.writeFileSync(tempFile, Buffer.from(r.data));

        addLog(`🎤 Transcrevendo áudio (Whisper)...`);
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(tempFile) as any,
            model: 'whisper-large-v3',
            language: 'pt',
            response_format: 'json'
        });

        const textoTranscrito = transcription.text?.trim();
        if (!textoTranscrito) {
            await ctx.reply("Não consegui entender o áudio. Pode repetir?");
            return;
        }

        addLog(`🎤 Transcrito: "${textoTranscrito.substring(0, 80)}"`);
        await ctx.reply(`🎤 *Você disse:* "${textoTranscrito}"`, { parse_mode: 'Markdown' });

        // Processa como mensagem normal e responde em voz
        await processarFluxoJoelBot(ctx, textoTranscrito, true);

    } catch (error: any) {
        addLog(`❌ Erro no áudio: ${error.message}`);
        await ctx.reply("Falha na transcrição do áudio. Tente novamente. 🎤").catch(() => {});
    } finally {
        if (tempFile && fs.existsSync(tempFile)) {
            try { fs.unlinkSync(tempFile); } catch {}
        }
    }
});

// Handler para áudio enviado como arquivo
bot.on('audio', async (ctx) => {
    let tempFile = '';
    try {
        await ctx.sendChatAction('typing');
        const msgQualquer = ctx.message as any;
        const fid = msgQualquer.audio?.file_id;
        if (!fid) return;

        addLog(`🎵 Arquivo de áudio recebido de ${ctx.from?.id}`);

        const link = await bot.telegram.getFileLink(fid);
        const r = await axios.get(link.href, { responseType: 'arraybuffer', timeout: 30000 });
        const ext = msgQualquer.audio?.mime_type?.includes('mpeg') ? 'mp3' : 'ogg';
        tempFile = path.join(process.cwd(), `audio_${fid}_${Date.now()}.${ext}`);
        fs.writeFileSync(tempFile, Buffer.from(r.data));

        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(tempFile) as any,
            model: 'whisper-large-v3',
            language: 'pt',
            response_format: 'json'
        });

        const textoTranscrito = transcription.text?.trim();
        if (!textoTranscrito) {
            await ctx.reply("Não consegui transcrever este arquivo de áudio.");
            return;
        }

        addLog(`🎵 Áudio transcrito: "${textoTranscrito.substring(0, 80)}"`);
        await ctx.reply(`🎵 *Transcrição:*\n\n${textoTranscrito}`, { parse_mode: 'Markdown' });
        await processarFluxoJoelBot(ctx, textoTranscrito, false);

    } catch (error: any) {
        addLog(`❌ Erro ao transcrever áudio: ${error.message}`);
        await ctx.reply("Não consegui processar este arquivo de áudio.").catch(() => {});
    } finally {
        if (tempFile && fs.existsSync(tempFile)) {
            try { fs.unlinkSync(tempFile); } catch {}
        }
    }
});

// ─── Gateway Principal ─────────────────────────────────────────────────────
export async function startJoelBotGateway(): Promise<void> {
    // Web Terminal (escuta no PORT — único servidor)
    startWebTerminal();

    addLog("🤖 Iniciando JoelBot V20.0...");
    addLog(`📋 Skills registradas: ${registry.getAll().map(s => s.name).join(', ')}`);

    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        addLog("🗑️ Webhook removido");

        bot.launch();
        addLog("🚀 JoelBot V20.0 Online! Aguardando mensagens...");
        addLog(`✅ ${registry.getAll().length} Skills carregadas e prontas`);

    } catch (e: any) {
        addLog(`❌ Falha ao iniciar bot: ${e.message}`);
        throw e;
    }

    // Graceful shutdown
    process.once('SIGINT', () => {
        addLog("⚠️ SIGINT recebido — encerrando graciosamente...");
        bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
        addLog("⚠️ SIGTERM recebido — encerrando graciosamente...");
        bot.stop('SIGTERM');
    });
}
