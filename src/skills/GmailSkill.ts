import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import axios from 'axios';
import { addLog } from '../web-terminal.js';
import { getGoogleToken } from '../googleAuth.js';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

function p(bloco: string, key: string): string | null {
    const m = bloco.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`, 'i'));
    return m ? m[1].trim() : null;
}

function decodeBase64Url(s: string): string {
    try { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'); }
    catch { return s; }
}

function extractBody(payload: any): string {
    if (!payload) return '';
    if (payload.body?.data) return decodeBase64Url(payload.body.data);
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data)
                return decodeBase64Url(part.body.data);
        }
        for (const part of payload.parts) {
            const sub = extractBody(part);
            if (sub) return sub;
        }
    }
    return '';
}

function toBase64Url(s: string): string {
    return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function buildRaw(para: string, de: string, assunto: string, corpo: string, replyToId?: string): string {
    const lines = [
        `From: ${de}`,
        `To: ${para}`,
        `Subject: =?UTF-8?B?${Buffer.from(assunto).toString('base64')}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        ...(replyToId ? [`In-Reply-To: ${replyToId}`, `References: ${replyToId}`] : []),
        '',
        Buffer.from(corpo).toString('base64')
    ];
    return toBase64Url(lines.join('\r\n'));
}

export class GmailSkill implements Skill {
    name = 'GmailSkill';
    description = 'Acesso total ao Gmail: ler, resumir, escrever, enviar, responder, buscar.';

    canHandle(i: string): boolean { return i.includes('[SYSTEM_GMAIL:'); }

    async execute(params: string, ctx: Context): Promise<string> {
        const m = params.match(/\[SYSTEM_GMAIL:([\s\S]*?)\]/i);
        if (!m) return '';

        const bloco = m[1];
        const acao  = p(bloco, 'acao') || 'listar';
        addLog(`📧 GmailSkill: ${acao}`);

        let token: string;
        try { token = await getGoogleToken(); }
        catch (e: any) { return `❌ Google não autenticado. Configure GOOGLE_ACCESS_TOKEN ou as credenciais OAuth2.\nDetalhes: ${e.message}`; }

        const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        try {
            // ── LISTAR ────────────────────────────────────────────
            if (acao === 'listar') {
                const q      = p(bloco, 'query') || 'is:unread';
                const maxR   = parseInt(p(bloco, 'max') || '10');
                const res    = await axios.get(`${BASE}/messages?q=${encodeURIComponent(q)}&maxResults=${maxR}`, { headers: h, timeout: 10000 });
                const msgs   = res.data.messages || [];
                if (!msgs.length) return `📭 Nenhum e-mail encontrado para "${q}".`;

                const detalhes = await Promise.all(msgs.slice(0, 8).map(async (msg: any) => {
                    const d   = await axios.get(`${BASE}/messages/${msg.id}?format=metadata&metadataHeaders=From,Subject,Date`, { headers: h, timeout: 8000 });
                    const hdrs = d.data.payload?.headers || [];
                    const get = (n: string) => hdrs.find((h: any) => h.name === n)?.value || '?';
                    return `📩 *[${msg.id.slice(-8)}]* ${get('Subject')}\n   De: ${get('From')} | ${get('Date')}`;
                }));

                return `📧 *Gmail — ${q} (${msgs.length} total):*\n\n${detalhes.join('\n\n')}\n\n_Para ler: "leia o email [ID]"_`;
            }

            // ── LER / RESUMIR ─────────────────────────────────────
            if (acao === 'ler' || acao === 'resumir') {
                const id = p(bloco, 'id');
                if (!id) return '⚠️ Informe o ID do e-mail. Ex: acao="ler", id="abc12345"';

                const res  = await axios.get(`${BASE}/messages/${id}?format=full`, { headers: h, timeout: 10000 });
                const d    = res.data;
                const hdrs = d.payload?.headers || [];
                const get  = (n: string) => hdrs.find((hd: any) => hd.name === n)?.value || '';
                const body = extractBody(d.payload).substring(0, 3000);

                if (acao === 'resumir') {
                    return (
                        `📧 *E-mail [${id.slice(-8)}]:*\n` +
                        `📤 De: ${get('From')}\n` +
                        `📌 Assunto: ${get('Subject')}\n` +
                        `📅 Data: ${get('Date')}\n\n` +
                        `📄 *Conteúdo (primeiros 3000 chars):*\n${body}`
                    );
                }
                return (
                    `📧 *E-mail completo [${id.slice(-8)}]:*\n` +
                    `📤 De: ${get('From')}\n📌 ${get('Subject')}\n📅 ${get('Date')}\n\n${body}`
                );
            }

            // ── ENVIAR ────────────────────────────────────────────
            if (acao === 'enviar') {
                const para   = p(bloco, 'para');
                const assunto = p(bloco, 'assunto') || '(sem assunto)';
                const corpo  = p(bloco, 'corpo') || '';
                if (!para) return '⚠️ Informe o destinatário. Ex: para="email@exemplo.com"';

                const profileRes = await axios.get(`${BASE}/profile`, { headers: h, timeout: 5000 });
                const deEmail    = profileRes.data.emailAddress;

                const raw = buildRaw(para, deEmail, assunto, corpo);
                await axios.post(`${BASE}/messages/send`, { raw }, { headers: h, timeout: 10000 });

                addLog(`✅ E-mail enviado para ${para}`);
                return `✅ E-mail enviado!\n📤 Para: ${para}\n📌 Assunto: ${assunto}`;
            }

            // ── RESPONDER ─────────────────────────────────────────
            if (acao === 'responder') {
                const id    = p(bloco, 'id');
                const corpo = p(bloco, 'corpo') || '';
                if (!id) return '⚠️ Informe o ID do e-mail para responder.';

                const orig   = await axios.get(`${BASE}/messages/${id}?format=metadata&metadataHeaders=From,Subject,Message-ID`, { headers: h, timeout: 8000 });
                const hdrs   = orig.data.payload?.headers || [];
                const get    = (n: string) => hdrs.find((hd: any) => hd.name === n)?.value || '';
                const de     = get('From');
                const assunto = `Re: ${get('Subject')}`;
                const msgId  = get('Message-ID');

                const profileRes = await axios.get(`${BASE}/profile`, { headers: h, timeout: 5000 });
                const meuEmail   = profileRes.data.emailAddress;

                // Extrai só o e-mail do campo From: "Nome <email@ex.com>"
                const deEmail = de.match(/<(.+)>/)?.[1] || de;
                const raw = buildRaw(deEmail, meuEmail, assunto, corpo, msgId);

                await axios.post(`${BASE}/messages/send`, {
                    raw,
                    threadId: orig.data.threadId
                }, { headers: h, timeout: 10000 });

                addLog(`✅ Resposta enviada para ${deEmail}`);
                return `✅ Resposta enviada para ${de}`;
            }

            // ── BUSCAR ────────────────────────────────────────────
            if (acao === 'buscar') {
                const query = p(bloco, 'query') || '';
                if (!query) return '⚠️ Informe o termo de busca. Ex: query="from:joao@exemplo.com"';

                const res  = await axios.get(`${BASE}/messages?q=${encodeURIComponent(query)}&maxResults=5`, { headers: h, timeout: 10000 });
                const msgs = res.data.messages || [];
                if (!msgs.length) return `📭 Nenhum e-mail encontrado para "${query}".`;

                const detalhes = await Promise.all(msgs.map(async (msg: any) => {
                    const d   = await axios.get(`${BASE}/messages/${msg.id}?format=metadata&metadataHeaders=From,Subject,Date`, { headers: h, timeout: 8000 });
                    const hdrs = d.data.payload?.headers || [];
                    const get = (n: string) => hdrs.find((h: any) => h.name === n)?.value || '?';
                    return `📩 *[${msg.id.slice(-8)}]* ${get('Subject')}\n   De: ${get('From')}`;
                }));

                return `🔍 *Resultados para "${query}":*\n\n${detalhes.join('\n\n')}`;
            }

            // ── DELETAR ───────────────────────────────────────────
            if (acao === 'deletar') {
                const id = p(bloco, 'id');
                if (!id) return '⚠️ Informe o ID do e-mail.';
                await axios.delete(`${BASE}/messages/${id}`, { headers: h, timeout: 8000 });
                return `✅ E-mail [${id.slice(-8)}] deletado.`;
            }

            return `⚠️ Ação Gmail desconhecida: "${acao}"`;
        } catch (e: any) {
            const status = e.response?.status;
            const msg    = e.response?.data?.error?.message || e.message;
            addLog(`❌ Gmail [${status}]: ${msg}`);
            if (status === 401) return '❌ Token Google expirado. Reconfigure GOOGLE_ACCESS_TOKEN.';
            if (status === 403) return '❌ Sem permissão para o Gmail. Verifique os escopos OAuth2.';
            return `❌ Erro Gmail (${status || 'sem status'}): ${msg}`;
        }
    }
}
