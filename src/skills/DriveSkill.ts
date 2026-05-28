import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import axios from 'axios';
import FormData from 'form-data';
import { addLog } from '../web-terminal.js';

export class DriveSkill implements Skill {
    name = 'DriveSkill';
    description = 'Gerencia arquivos no Google Drive: upload, listar, criar.';

    canHandle(intent: string): boolean {
        return intent.includes('[SYSTEM_DRIVE:');
    }

    private extrairParam(bloco: string, param: string): string | null {
        const regex = new RegExp(`${param}\\s*=\\s*["']([^"']+)["']`, 'i');
        const match = bloco.match(regex);
        return match ? match[1].trim() : null;
    }

    async execute(params: any, _ctx: Context): Promise<string> {
        const match = params.match(/\[SYSTEM_DRIVE:([\s\S]*?)\]/i);
        if (!match) return "";

        const bloco = match[1];
        const acao = this.extrairParam(bloco, 'acao');
        const nome = this.extrairParam(bloco, 'nome');
        const conteudo = this.extrairParam(bloco, 'conteudo');
        const token = process.env.GOOGLE_DRIVE_TOKEN?.trim();

        if (!token) {
            return (
                "⚠️ *Google Drive não configurado!*\n\n" +
                "Configure `GOOGLE_DRIVE_TOKEN` nas variáveis de ambiente.\n\n" +
                "📖 Para obter o token OAuth2:\n" +
                "1. Acesse: console.cloud.google.com\n" +
                "2. Ative a Drive API\n" +
                "3. Crie credenciais OAuth2 e gere o access token"
            );
        }

        addLog(`☁️ DriveSkill: ${acao}`);

        const headers = {
            Authorization: `Bearer ${token}`,
        };

        try {
            if (acao === 'upload' && nome && conteudo) {
                const metadata = {
                    name: nome,
                    mimeType: 'text/plain'
                };

                const form = new FormData();
                form.append('metadata', JSON.stringify(metadata), {
                    contentType: 'application/json; charset=UTF-8',
                    filename: 'metadata'
                });
                form.append('file', Buffer.from(conteudo, 'utf-8'), {
                    filename: nome,
                    contentType: 'text/plain; charset=UTF-8'
                });

                const response = await axios.post(
                    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
                    form,
                    {
                        headers: { ...form.getHeaders(), ...headers },
                        timeout: 20000
                    }
                );

                const fileId = response.data.id;
                const link = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
                addLog(`✅ Drive upload: ${nome} (ID: ${fileId})`);
                return `✅ Arquivo \`${nome}\` enviado ao Google Drive!\n🆔 ID: \`${fileId}\`\n🔗 [Abrir no Drive](${link})`;
            }

            if (acao === 'listar') {
                const response = await axios.get(
                    'https://www.googleapis.com/drive/v3/files?pageSize=20&orderBy=modifiedTime+desc&fields=files(id,name,mimeType,size,modifiedTime)',
                    { headers, timeout: 15000 }
                );

                const files = response.data.files;
                if (!files?.length) return "📭 Nenhum arquivo encontrado no Drive.";

                const lista = files.map((f: any) => {
                    const icon = f.mimeType?.includes('folder') ? '📁' :
                        f.mimeType?.includes('document') ? '📝' :
                        f.mimeType?.includes('spreadsheet') ? '📊' :
                        f.mimeType?.includes('presentation') ? '📋' :
                        f.mimeType?.includes('image') ? '🖼️' :
                        f.mimeType?.includes('video') ? '🎬' :
                        f.mimeType?.includes('audio') ? '🎵' : '📄';
                    const size = f.size ? ` (${(f.size / 1024).toFixed(0)}KB)` : '';
                    return `${icon} ${f.name}${size}`;
                }).join('\n');

                return `☁️ *Arquivos no Google Drive:*\n\n${lista}\n\n_${files.length} arquivo(s)_`;
            }

            if (acao === 'criar' && nome && conteudo) {
                // Criar arquivo de texto diretamente (sem upload multipart para texto simples)
                const response = await axios.post(
                    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
                    { name: nome, mimeType: 'application/vnd.google-apps.document' },
                    { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
                );
                addLog(`✅ Drive: documento criado "${nome}"`);
                return `✅ Documento \`${nome}\` criado no Google Drive!\n🔗 [Abrir](${response.data.webViewLink})`;
            }

            addLog(`⚠️ DriveSkill: ação "${acao}" não reconhecida`);
            return `⚠️ Ação \`${acao}\` não reconhecida. Use: upload, listar, criar.`;

        } catch (error: any) {
            const status = error.response?.status;
            const msg = error.response?.data?.error?.message || error.message;
            addLog(`❌ DriveSkill erro [${status}]: ${msg}`);

            if (status === 401) return "❌ Token Google Drive inválido ou expirado. Renove o access token.";
            if (status === 403) return "❌ Sem permissão no Drive. Verifique os escopos do token (drive.file ou drive).";
            return `❌ Erro no Drive (${status || 'timeout'}): ${msg}`;
        }
    }
}
