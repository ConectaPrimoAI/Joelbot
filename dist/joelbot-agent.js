import "dotenv/config";
import { Telegraf } from 'telegraf';
import Groq from 'groq-sdk';
import axios from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';
import googleTTS from 'google-tts-api';
import http from 'node:http';
import { registry } from './skills/index.js';
import { startWebTerminal, addLog } from './web-terminal.js';
import { startReminderManager, listarLembretes, cancelarLembrete, cancelarTodos } from './reminderManager.js';
// ── Validação de variáveis obrigatórias ────────────────────
if (!process.env.TELEGRAM_TOKEN || !process.env.GROQ_API_KEY) {
    console.error('❌ TELEGRAM_TOKEN ou GROQ_API_KEY não configurados.');
    process.exit(1);
}
export const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
// ── Estado por usuário ─────────────────────────────────────
const historico = {};
const cooldown = {};
const MAX_HIST = 8; // 4 pares de troca
const COOLDOWN = 800; // ms
// ── Modelos ────────────────────────────────────────────────
const M8B = 'llama-3.1-8b-instant'; // 30k TPM — padrão
const M70B = 'llama-3.3-70b-versatile'; // 6k TPM — raciocínio
const KW_COMPLEX = ['analis', 'explica', 'resumo', 'código', 'codigo', 'program', 'calcul', 'estrateg', 'compar', 'debug'];
function modelo(msg) {
    const l = msg.toLowerCase();
    return (msg.length > 250 || KW_COMPLEX.some(k => l.includes(k))) ? M70B : M8B;
}
// ── Prompt do sistema ──────────────────────────────────────
const SYS = `Você é o JoelBot V20.0, assistente pessoal autônomo.
Responda sempre em português, seja direto e humano.

Quando o usuário pedir uma ação, inclua a tag correspondente NO FINAL da resposta:

LEMBRETES:
[SYSTEM_REMINDER: tipo="normal", mensagem="texto", hora="17:00"]
[SYSTEM_REMINDER: tipo="repetitivo", mensagem="texto", hora="09:00"]
[SYSTEM_REMINDER: tipo="rotina", mensagem="texto", hora="08:00", dias_on="10", dias_off="20", ciclos="3"]
[SYSTEM_REMINDER: acao="listar"]
[SYSTEM_REMINDER: acao="cancelar", id="ID"]

GMAIL:
[SYSTEM_GMAIL: acao="listar", query="is:unread"]
[SYSTEM_GMAIL: acao="ler", id="ID"]
[SYSTEM_GMAIL: acao="resumir", id="ID"]
[SYSTEM_GMAIL: acao="enviar", para="email@ex.com", assunto="Assunto", corpo="Texto"]
[SYSTEM_GMAIL: acao="responder", id="ID", corpo="Texto"]
[SYSTEM_GMAIL: acao="buscar", query="from:joel"]
[SYSTEM_GMAIL: acao="deletar", id="ID"]

DRIVE:
[SYSTEM_DRIVE: acao="listar"]
[SYSTEM_DRIVE: acao="ler", id="ID"]
[SYSTEM_DRIVE: acao="criar", nome="arquivo.txt", conteudo="texto"]
[SYSTEM_DRIVE: acao="compartilhar", id="ID", email="x@ex.com", nivel="writer"]
[SYSTEM_DRIVE: acao="deletar", id="ID"]
[SYSTEM_DRIVE: acao="pasta", nome="NomePasta"]

GITHUB:
[SYSTEM_GIT: acao="listar"]
[SYSTEM_GIT: acao="repo", titulo="nome", privado="false"]
[SYSTEM_GIT: acao="analisar", repo="owner/repo"]
[SYSTEM_GIT: acao="arquivo", repo="owner/repo", caminho="src/index.ts"]
[SYSTEM_GIT: acao="editar", repo="owner/repo", caminho="src/index.ts", conteudo="código"]
[SYSTEM_GIT: acao="deletar_arquivo", repo="owner/repo", caminho="src/old.ts"]
[SYSTEM_GIT: acao="deletar_repo", repo="owner/repo"]
[SYSTEM_GIT: acao="listar_arquivos", repo="owner/repo", pasta="src"]

CLIMA:
[SYSTEM_WEATHER: local="Chapecó, SC"]
[SYSTEM_WEATHER: local="Chapecó, SC", hora="17"]

VÍDEO:
[SYSTEM_VIDEO: prompt="descrição detalhada em inglês"]

IMAGEM:
[SYSTEM_IMAGE: prompt="descrição detalhada em inglês"]

SLIDES:
[SYSTEM_SLIDES: tema="Título", conteudo="# Slide 1\nTexto --- # Slide 2\nTexto"]

BROWSER / PESQUISA:
[SYSTEM_BROWSER: acao="screenshot", url="https://..."]
[SYSTEM_BROWSER: acao="extract", url="https://..."]
[SYSTEM_BROWSER: acao="pesquisar", query="termo de busca"]

TERMINAL LINUX:
[SYSTEM_EXEC: acao="exec", cmd="ls -la"]
[SYSTEM_EXEC: acao="criar", nome="script.py", cmd="print('hello')"]
[SYSTEM_EXEC: acao="listar"]

REGRAS ABSOLUTAS:
- Tags SEMPRE no final, nunca no meio do texto
- Hora sempre no formato HH:MM (24h)
- Para lembretes, detecte o tipo pelo contexto: "me lembre hoje" = normal; "todo dia" = repetitivo; "por X dias depois X dias de pausa" = rotina`;
// ── Keywords para pré-executar skills de dados ────────────
// Isto permite UMA ÚNICA chamada LLM (resolve travamento no celular)
const PRE_FETCH_RULES = [
    {
        keywords: ['clima', 'tempo', 'chuva', 'temperatura', 'vai chover', 'previsão', 'chove', 'calor', 'frio', 'graus'],
        tag: (msg) => {
            const horaMatch = msg.match(/(\d{1,2})\s*(h|hr|hrs|hora|horas|:00)/i);
            const hora = horaMatch ? parseInt(horaMatch[1]) : null;
            const local = msg.match(/em\s+([A-Za-zÀ-ú\s,]+?)(?:\s+(às|as|hoje|amanhã|agora|vai|o clima|o tempo|$))/i)?.[1]?.trim() || 'Chapecó, SC';
            return hora != null
                ? `[SYSTEM_WEATHER: local="${local}", hora="${hora}"]`
                : `[SYSTEM_WEATHER: local="${local}"]`;
        }
    },
    {
        keywords: ['email', 'gmail', 'e-mail', 'mensagem', 'caixa de entrada', 'inbox', 'não lidos'],
        tag: () => '[SYSTEM_GMAIL: acao="listar", query="is:unread", max="5"]'
    },
    {
        keywords: ['drive', 'meus arquivos', 'google drive', 'pasta do drive'],
        tag: () => '[SYSTEM_DRIVE: acao="listar"]'
    },
    {
        keywords: ['meus repos', 'meus repositórios', 'listar repos', 'listar repositórios'],
        tag: () => '[SYSTEM_GIT: acao="listar"]'
    }
];
// ── Envio seguro (divide msgs longas, nunca falha) ─────────
async function enviar(ctx, texto) {
    if (!texto?.trim())
        return;
    const MAX = 4000;
    const partes = [];
    let resto = texto;
    while (resto.length > 0) {
        if (resto.length <= MAX) {
            partes.push(resto);
            break;
        }
        // Divide em ponto de parágrafo
        let corte = resto.lastIndexOf('\n\n', MAX);
        if (corte < MAX / 2)
            corte = resto.lastIndexOf('\n', MAX);
        if (corte < MAX / 2)
            corte = MAX;
        partes.push(resto.substring(0, corte));
        resto = resto.substring(corte).trim();
    }
    for (const parte of partes) {
        try {
            await ctx.reply(parte, { parse_mode: 'Markdown' });
        }
        catch {
            // Falha Markdown → envia texto puro (principal causa de falha no celular)
            try {
                await ctx.reply(parte.replace(/[*_`\[\]()~>#+=|{}.!]/g, ''));
            }
            catch (e) {
                addLog(`❌ Envio falhou: ${e.message}`);
            }
        }
    }
}
// ── Fluxo principal ────────────────────────────────────────
async function processar(ctx, msgUsuario, responderVoz = false) {
    const userId = ctx.from?.id || 0;
    const agora = Date.now();
    if (cooldown[userId] && agora - cooldown[userId] < COOLDOWN)
        return;
    cooldown[userId] = agora;
    if (!historico[userId])
        historico[userId] = [];
    try {
        await ctx.sendChatAction('typing').catch(() => { });
        addLog(`📨 [${userId}] ${msgUsuario.substring(0, 80)}`);
        // ── 1. Pré-fetch de dados por keyword (sem LLM extra) ──
        let dadosInjetados = '';
        for (const rule of PRE_FETCH_RULES) {
            const l = msgUsuario.toLowerCase();
            if (rule.keywords.some(k => l.includes(k))) {
                const tag = rule.tag(msgUsuario);
                const skill = await registry.selectBestSkill(tag.toUpperCase());
                if (skill) {
                    addLog(`⚡ Pré-fetch: ${skill.name}`);
                    try {
                        const res = await skill.execute(tag, ctx);
                        if (res && typeof res === 'string' && res.trim()) {
                            dadosInjetados = `\n\n[DADOS REAIS — use para responder ao usuário]:\n${res}`;
                        }
                    }
                    catch (e) {
                        addLog(`⚠️ Pré-fetch falhou: ${e.message}`);
                    }
                }
                break; // só um pré-fetch por mensagem
            }
        }
        // ── 2. UMA ÚNICA chamada LLM ───────────────────────────
        const m = modelo(msgUsuario);
        addLog(`🧠 ${m === M8B ? '8b' : '70b'}`);
        const maxTok = dadosInjetados ? 400 : (msgUsuario.length > 200 ? 700 : 450);
        const chat = await groq.chat.completions.create({
            model: m,
            max_tokens: maxTok,
            temperature: 0.6,
            messages: [
                { role: 'system', content: SYS + dadosInjetados },
                ...historico[userId],
                { role: 'user', content: msgUsuario }
            ]
        });
        const bruto = chat.choices[0].message.content || '';
        const limpo = bruto.replace(/\[SYSTEM_[^\]]+\]/gs, '').trim();
        addLog(`📊 Tokens: ${chat.usage?.total_tokens ?? '?'}`);
        // ── 3. Se dados já injetados → resposta é o texto do LLM ─
        if (dadosInjetados) {
            await enviar(ctx, limpo);
        }
        else {
            // ── 4. Verificar se há tag de ação ────────────────────
            const skill = await registry.selectBestSkill(bruto.toUpperCase());
            if (skill) {
                // Texto de intro do LLM primeiro
                if (limpo)
                    await enviar(ctx, limpo);
                addLog(`🎯 Executando: ${skill.name}`);
                try {
                    const res = await skill.execute(bruto, ctx);
                    if (res && typeof res === 'string' && res.trim()) {
                        await enviar(ctx, res);
                    }
                    else if (res && typeof res === 'object') {
                        if (res.text)
                            await enviar(ctx, res.text);
                        if (res.file && fs.existsSync(res.file)) {
                            try {
                                if (res.type === 'video')
                                    await ctx.replyWithVideo({ source: res.file });
                                else if (res.type === 'photo')
                                    await ctx.replyWithPhoto({ source: res.file });
                                else
                                    await ctx.replyWithDocument({ source: res.file });
                                addLog(`📤 ${path.basename(res.file)} enviado`);
                            }
                            finally {
                                try {
                                    fs.unlinkSync(res.file);
                                }
                                catch { }
                            }
                        }
                    }
                }
                catch (e) {
                    addLog(`⚠️ ${skill.name}: ${e.message}`);
                    await enviar(ctx, `⚠️ Erro ao executar: ${e.message.substring(0, 150)}`);
                }
            }
            else {
                // Resposta de texto puro
                await enviar(ctx, limpo);
            }
        }
        // Resposta em voz se solicitado
        if (responderVoz && limpo) {
            const audio = await gerarAudio(limpo, userId);
            if (audio) {
                try {
                    await ctx.replyWithVoice({ source: audio });
                }
                finally {
                    try {
                        fs.unlinkSync(audio);
                    }
                    catch { }
                }
            }
        }
        // ── 5. Atualizar histórico compacto ───────────────────────
        historico[userId].push({ role: 'user', content: msgUsuario.substring(0, 400) }, { role: 'assistant', content: (limpo || '[ação executada]').substring(0, 400) });
        if (historico[userId].length > MAX_HIST)
            historico[userId].splice(0, 2);
    }
    catch (e) {
        addLog(`❌ Erro: ${e.message}`);
        if (e.message?.includes('rate_limit') || e.message?.includes('429')) {
            await enviar(ctx, '⏳ Limite de requisições atingido. Aguarde alguns segundos.');
        }
        else {
            await enviar(ctx, 'Tive um problema técnico. Pode tentar de novo?');
        }
    }
}
// ── TTS ────────────────────────────────────────────────────
async function gerarAudio(texto, userId) {
    const file = path.join(process.cwd(), `voz_${userId}_${Date.now()}.mp3`);
    try {
        const urls = googleTTS.getAllAudioUrls(texto.substring(0, 500), {
            lang: 'pt-BR', splitPunct: '.,!?', slow: false
        });
        const bufs = [];
        for (const u of urls) {
            const r = await axios.get(u.url, { responseType: 'arraybuffer', timeout: 8000 });
            bufs.push(Buffer.from(r.data));
        }
        fs.writeFileSync(file, Buffer.concat(bufs));
        return file;
    }
    catch {
        return null;
    }
}
// ── Comandos ───────────────────────────────────────────────
bot.command('start', (ctx) => {
    enviar(ctx, `🤖 *JoelBot V20.0 Online!*\n\n` +
        `Olá! Sou seu assistente pessoal autônomo.\n\n` +
        `*O que posso fazer:*\n` +
        `⏰ Lembretes (único, diário, rotina de ciclos)\n` +
        `📧 Gmail (ler, escrever, enviar, responder)\n` +
        `☁️ Google Drive (criar, ler, compartilhar)\n` +
        `🐙 GitHub (criar repos, editar arquivos, commit)\n` +
        `🌤️ Clima real em Chapecó e qualquer cidade\n` +
        `🎬 Gerar vídeos (Replicate)\n` +
        `🎨 Gerar imagens (Pollinations FLUX)\n` +
        `📊 Apresentações PowerPoint\n` +
        `🌐 Browser (pesquisar, screenshot, extrair)\n` +
        `💻 Terminal Linux (comandos, criar arquivos)\n` +
        `🎤 Transcrição de áudio\n\n` +
        `*Comandos:*\n` +
        `/lembretes — ver lembretes ativos\n` +
        `/limpar — limpar histórico da conversa\n` +
        `/start — esta mensagem`);
});
bot.command('limpar', (ctx) => {
    historico[ctx.from?.id || 0] = [];
    ctx.reply('🗑️ Histórico limpo!');
});
bot.command('lembretes', (ctx) => {
    const uid = ctx.from?.id || 0;
    const list = listarLembretes(uid);
    if (!list.length) {
        enviar(ctx, '📭 Nenhum lembrete ativo.\n\n' +
            '*Exemplos:*\n' +
            '"Me lembre às 17h de tomar água"\n' +
            '"Me lembre todo dia às 9h de escovar os dentes"\n' +
            '"Tenho que tomar remédio por 10 dias, pausar 20 dias, 3 vezes"');
        return;
    }
    const linhas = list.map(l => {
        const e = l.tipo === 'repetitivo' ? '🔁' : l.tipo === 'rotina' ? '🔄' : '📌';
        let extra = '';
        if (l.tipo === 'rotina') {
            const fase = l.emCicloOn
                ? `ON — ${l.diasRestantesNoCiclo}d restantes`
                : `PAUSA — ${l.diasRestantesNoCiclo}d restantes`;
            extra = `\n   Ciclo ${l.ciclosCompletados ?? 0}/${l.totalCiclos} | ${fase}`;
        }
        return `${e} *[${l.id}]* ${l.mensagem} — ${l.hora}h${extra}`;
    });
    enviar(ctx, `⏰ *Lembretes ativos (${list.length}):*\n\n${linhas.join('\n\n')}\n\n` +
        `_Para cancelar: "cancela o lembrete [ID]"_`);
});
bot.command('cancelarlembrete', (ctx) => {
    const uid = ctx.from?.id || 0;
    const id = ctx.message.text.split(' ')[1];
    if (!id) {
        ctx.reply('Use: /cancelarlembrete [ID]\nPara ver IDs: /lembretes');
        return;
    }
    const ok = cancelarLembrete(id, uid);
    ctx.reply(ok ? `✅ Lembrete [${id}] cancelado.` : `⚠️ ID não encontrado. Use /lembretes.`);
});
bot.command('cancelartudo', (ctx) => {
    const n = cancelarTodos(ctx.from?.id || 0);
    ctx.reply(n > 0 ? `✅ ${n} lembrete(s) cancelado(s).` : '📭 Nenhum lembrete para cancelar.');
});
// ── Mensagem de texto ──────────────────────────────────────
bot.on('text', (ctx) => processar(ctx, ctx.message.text));
// ── Foto / Vision ──────────────────────────────────────────
bot.on('photo', async (ctx) => {
    try {
        await ctx.sendChatAction('typing').catch(() => { });
        const photos = ctx.message.photo;
        const photo = photos[photos.length - 1];
        const link = await bot.telegram.getFileLink(photo.file_id);
        const res = await axios.get(link.href, { responseType: 'arraybuffer', timeout: 20000 });
        const b64 = Buffer.from(res.data).toString('base64');
        const caption = ctx.message.caption?.trim() || 'Descreva esta imagem em detalhes em português.';
        const chat = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            max_tokens: 600,
            temperature: 0.3,
            messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
                        { type: 'text', text: caption }
                    ]
                }]
        });
        await enviar(ctx, `🔍 ${chat.choices[0].message.content || 'Não consegui analisar.'}`);
    }
    catch (e) {
        addLog(`❌ Vision: ${e.message}`);
        await enviar(ctx, 'Não consegui processar a imagem.');
    }
});
// ── Áudio / Voz ────────────────────────────────────────────
bot.on('voice', async (ctx) => {
    let tmp = '';
    try {
        await ctx.sendChatAction('typing').catch(() => { });
        const fid = ctx.message.voice?.file_id;
        if (!fid)
            return;
        const link = await bot.telegram.getFileLink(fid);
        const r = await axios.get(link.href, { responseType: 'arraybuffer' });
        tmp = path.join(process.cwd(), `voz_${Date.now()}.ogg`);
        fs.writeFileSync(tmp, Buffer.from(r.data));
        const t = await groq.audio.transcriptions.create({
            file: fs.createReadStream(tmp),
            model: 'whisper-large-v3'
        });
        addLog(`🎤 "${t.text.substring(0, 60)}"`);
        await enviar(ctx, `🎤 _"${t.text}"_`);
        await processar(ctx, t.text, true);
    }
    catch (e) {
        addLog(`❌ Voz: ${e.message}`);
        await enviar(ctx, 'Falha na transcrição de áudio.');
    }
    finally {
        if (tmp && fs.existsSync(tmp))
            try {
                fs.unlinkSync(tmp);
            }
            catch { }
    }
});
// ── Gateway ────────────────────────────────────────────────
export function startJoelBotGateway() {
    startWebTerminal();
    startReminderManager(bot);
    const server = http.createServer((_, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('JoelBot V20.0 Active');
    });
    server.listen(process.env.PORT || 10000, async () => {
        try {
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            bot.launch();
            addLog('🚀 JoelBot V20.0 Online!');
            addLog('⏰ Sistema de lembretes ativo');
            addLog(`🌐 Web Terminal: http://localhost:${process.env.WEB_TERMINAL_PORT || 3000}`);
        }
        catch (e) {
            addLog(`❌ Falha ao iniciar: ${e}`);
            process.exit(1);
        }
    });
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
//# sourceMappingURL=joelbot-agent.js.map