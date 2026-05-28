import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import axios from 'axios';
import FormData from 'form-data';
import { addLog } from '../web-terminal.js';
import { getGoogleToken } from '../googleAuth.js';

const BASE = 'https://www.googleapis.com/drive/v3';
const UP   = 'https://www.googleapis.com/upload/drive/v3';

function p(bloco: string, key: string): string | null {
    const m = bloco.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`, 'i'));
    return m ? m[1].trim() : null;
}

export class DriveSkill implements Skill {
    name = 'DriveSkill';
    description = 'Acesso total ao Google Drive: listar, ler, criar, compartilhar, deletar.';

    canHandle(i: string): boolean { return i.includes('[SYSTEM_DRIVE:'); }

    async execute(params: string, _ctx: Context): Promise<string> {
        const m = params.match(/\[SYSTEM_DRIVE:([\s\S]*?)\]/i);
        if (!m) return '';

        const bloco = m[1];
        const acao  = p(bloco, 'acao') || 'listar';
        addLog(`☁️ DriveSkill: ${acao}`);

        let token: string;
        try { token = await getGoogleToken(); }
        catch (e: any) { return `❌ Google não autenticado: ${e.message}`; }

        const h = { Authorization: `Bearer ${token}` };

        try {
            // ── LISTAR ────────────────────────────────────────────
            if (acao === 'listar') {
                const pasta  = p(bloco, 'pasta');
                const query  = pasta
                    ? `'${pasta}' in parents and trashed=false`
                    : 'trashed=false';
                const res = await axios.get(
                    `${BASE}/files?q=${encodeURIComponent(query)}&pageSize=20&orderBy=modifiedTime+desc` +
                    `&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)`,
                    { headers: h, timeout: 10000 }
                );
                const files = res.data.files || [];
                if (!files.length) return '📭 Nenhum arquivo encontrado.';

                const linhas = files.map((f: any) => {
                    const ico = f.mimeType?.includes('folder') ? '📁'
                        : f.mimeType?.includes('document') ? '📝'
                        : f.mimeType?.includes('spreadsheet') ? '📊'
                        : f.mimeType?.includes('presentation') ? '📋'
                        : f.mimeType?.includes('image') ? '🖼️' : '📄';
                    const sz  = f.size ? ` (${(parseInt(f.size) / 1024).toFixed(0)} KB)` : '';
                    return `${ico} *[${f.id.slice(-8)}]* ${f.name}${sz}`;
                }).join('\n');

                return `☁️ *Google Drive (${files.length} itens):*\n\n${linhas}\n\n_Para ler: acao="ler", id="ID"_`;
            }

            // ── LER conteúdo ──────────────────────────────────────
            if (acao === 'ler') {
                const id = p(bloco, 'id') || p(bloco, 'nome');
                if (!id) return '⚠️ Informe o ID do arquivo.';

                // Se parece um nome, busca o ID
                let fileId = id;
                if (!id.match(/^[a-zA-Z0-9_-]{20,}$/)) {
                    const search = await axios.get(
                        `${BASE}/files?q=${encodeURIComponent(`name='${id}' and trashed=false`)}&fields=files(id,name)`,
                        { headers: h, timeout: 8000 }
                    );
                    const found = search.data.files?.[0];
                    if (!found) return `⚠️ Arquivo "${id}" não encontrado.`;
                    fileId = found.id;
                }

                const meta = await axios.get(`${BASE}/files/${fileId}?fields=name,mimeType`, { headers: h, timeout: 5000 });
                const mime = meta.data.mimeType || '';

                // Google Docs/Sheets/Slides → exportar como texto
                let content = '';
                if (mime.includes('google-apps.document')) {
                    const r = await axios.get(`${BASE}/files/${fileId}/export?mimeType=text/plain`, { headers: h, timeout: 10000, responseType: 'text' });
                    content = r.data;
                } else if (mime.includes('text') || mime.includes('json') || mime.includes('javascript')) {
                    const r = await axios.get(`${BASE}/files/${fileId}?alt=media`, { headers: h, timeout: 10000, responseType: 'text' });
                    content = r.data;
                } else {
                    return `⚠️ Tipo "${mime}" não suporta leitura de texto.`;
                }

                return `📄 *${meta.data.name}:*\n\`\`\`\n${content.substring(0, 3000)}\n\`\`\``;
            }

            // ── CRIAR arquivo ─────────────────────────────────────
            if (acao === 'criar' || acao === 'upload') {
                const nome     = p(bloco, 'nome');
                const conteudo = p(bloco, 'conteudo') || '';
                const pasta    = p(bloco, 'pasta');
                if (!nome) return '⚠️ Informe o nome do arquivo.';

                const metadata: any = { name: nome, mimeType: 'text/plain' };
                if (pasta) metadata.parents = [pasta];

                const form = new FormData();
                form.append('metadata', JSON.stringify(metadata), { contentType: 'application/json; charset=UTF-8' });
                form.append('file', Buffer.from(conteudo, 'utf-8'), { filename: nome, contentType: 'text/plain' });

                const res = await axios.post(`${UP}/files?uploadType=multipart`, form, {
                    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
                    timeout: 15000
                });

                return `✅ Arquivo *${nome}* criado!\n🆔 ID: ${res.data.id}`;
            }

            // ── COMPARTILHAR ──────────────────────────────────────
            if (acao === 'compartilhar') {
                const id    = p(bloco, 'id');
                const email = p(bloco, 'email');
                const nivel = p(bloco, 'nivel') || 'reader'; // reader | writer | commenter
                if (!id) return '⚠️ Informe o ID do arquivo.';

                const body: any = email
                    ? { type: 'user', role: nivel, emailAddress: email }
                    : { type: 'anyone', role: 'reader' };

                const res = await axios.post(
                    `${BASE}/files/${id}/permissions`,
                    body,
                    { headers: { ...h, 'Content-Type': 'application/json' }, timeout: 10000 }
                );

                const linkRes = await axios.get(`${BASE}/files/${id}?fields=webViewLink`, { headers: h, timeout: 5000 });
                const link    = linkRes.data.webViewLink;

                return email
                    ? `✅ Compartilhado com ${email} (${nivel}).\n🔗 ${link}`
                    : `✅ Link público gerado!\n🔗 ${link}`;
            }

            // ── DELETAR ───────────────────────────────────────────
            if (acao === 'deletar') {
                const id = p(bloco, 'id');
                if (!id) return '⚠️ Informe o ID do arquivo.';
                const meta = await axios.get(`${BASE}/files/${id}?fields=name`, { headers: h, timeout: 5000 });
                await axios.delete(`${BASE}/files/${id}`, { headers: h, timeout: 8000 });
                return `🗑️ *${meta.data.name}* deletado.`;
            }

            // ── CRIAR PASTA ───────────────────────────────────────
            if (acao === 'pasta') {
                const nome  = p(bloco, 'nome');
                const pai   = p(bloco, 'pai');
                if (!nome) return '⚠️ Informe o nome da pasta.';

                const meta: any = { name: nome, mimeType: 'application/vnd.google-apps.folder' };
                if (pai) meta.parents = [pai];

                const res = await axios.post(
                    `${BASE}/files`,
                    meta,
                    { headers: { ...h, 'Content-Type': 'application/json' }, timeout: 10000 }
                );
                return `📁 Pasta *${nome}* criada!\n🆔 ID: ${res.data.id}`;
            }

            return `⚠️ Ação Drive desconhecida: "${acao}"`;
        } catch (e: any) {
            const status = e.response?.status;
            const msg    = e.response?.data?.error?.message || e.message;
            addLog(`❌ Drive [${status}]: ${msg}`);
            if (status === 401) return '❌ Token Google expirado.';
            if (status === 403) return '❌ Sem permissão no Drive.';
            if (status === 404) return '❌ Arquivo não encontrado.';
            return `❌ Erro Drive (${status}): ${msg}`;
        }
    }
}
