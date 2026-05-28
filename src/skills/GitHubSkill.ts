import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import axios from 'axios';
import { addLog } from '../web-terminal.js';

export class GitHubSkill implements Skill {
    name = 'GitHubSkill';
    description = 'Integração com GitHub: criar repositórios, listar, criar issues.';

    canHandle(intent: string): boolean {
        return intent.includes('[SYSTEM_GIT:');
    }

    private extrairParam(bloco: string, param: string): string | null {
        const regex = new RegExp(`${param}\\s*=\\s*["']([^"']+)["']`, 'i');
        const match = bloco.match(regex);
        return match ? match[1].trim() : null;
    }

    private sanitizeRepoName(name: string): string {
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/--+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 100);
    }

    async execute(params: any, _ctx: Context): Promise<string> {
        const match = params.match(/\[SYSTEM_GIT:([\s\S]*?)\]/i);
        if (!match) return "";

        const bloco = match[1];
        const acao = this.extrairParam(bloco, 'acao');
        const titulo = this.extrairParam(bloco, 'titulo');
        const descricao = this.extrairParam(bloco, 'descricao') || 'Criado pelo JoelBot V20.0 🤖';
        const privadoStr = this.extrairParam(bloco, 'privado');
        const privado = privadoStr === 'true';
        const token = process.env.GITHUB_TOKEN?.trim();

        if (!token) {
            return (
                "⚠️ *GitHub não configurado!*\n\n" +
                "Configure `GITHUB_TOKEN` nas variáveis de ambiente.\n\n" +
                "📖 Para criar um token:\n" +
                "1. Acesse: github.com/settings/tokens\n" +
                "2. Clique em 'Generate new token (classic)'\n" +
                "3. Marque o scope `repo` e gere o token"
            );
        }

        const headers = {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'JoelBot/20.0'
        };

        try {
            if (acao === 'repo' && titulo) {
                const repoName = this.sanitizeRepoName(titulo);
                addLog(`🐙 Criando repositório: ${repoName} (${privado ? 'privado' : 'público'})`);

                const response = await axios.post(
                    'https://api.github.com/user/repos',
                    {
                        name: repoName,
                        private: privado,
                        description: descricao,
                        auto_init: true,
                        gitignore_template: 'Node',
                        license_template: 'mit'
                    },
                    { headers, timeout: 15000 }
                );

                const url = response.data.html_url;
                const vis = privado ? '🔒 privado' : '🌐 público';
                addLog(`✅ Repositório criado: ${url}`);
                return (
                    `✅ Repositório ${vis} criado!\n\n` +
                    `📦 *${repoName}*\n` +
                    `🔗 ${url}\n` +
                    `📝 ${descricao}`
                );
            }

            if (acao === 'listar') {
                addLog('🐙 Listando repositórios GitHub');
                const response = await axios.get(
                    'https://api.github.com/user/repos?per_page=20&sort=updated&type=all',
                    { headers, timeout: 10000 }
                );

                if (!response.data.length) return "📭 Nenhum repositório encontrado.";

                const repos = response.data.map((r: any) =>
                    `${r.private ? '🔒' : '🌐'} [${r.name}](${r.html_url})` +
                    (r.description ? ` — ${r.description.substring(0, 60)}` : '')
                ).join('\n');

                return `📚 *Seus repositórios GitHub:*\n\n${repos}`;
            }

            if (acao === 'issue' && titulo) {
                const repo = this.extrairParam(bloco, 'repo');
                const body = this.extrairParam(bloco, 'body') || '';
                if (!repo) return "⚠️ Parâmetro `repo` necessário para criar issue.";

                const userRes = await axios.get('https://api.github.com/user', { headers, timeout: 5000 });
                const owner = userRes.data.login;

                const response = await axios.post(
                    `https://api.github.com/repos/${owner}/${repo}/issues`,
                    { title: titulo, body },
                    { headers, timeout: 15000 }
                );
                addLog(`✅ Issue criada: #${response.data.number}`);
                return `✅ Issue criada!\n🔗 ${response.data.html_url}`;
            }

            if (acao === 'perfil') {
                const response = await axios.get('https://api.github.com/user', { headers, timeout: 8000 });
                const u = response.data;
                return (
                    `👤 *Perfil GitHub*\n\n` +
                    `• *Username:* ${u.login}\n` +
                    `• *Nome:* ${u.name || 'N/A'}\n` +
                    `• *Repositórios:* ${u.public_repos}\n` +
                    `• *Seguidores:* ${u.followers}\n` +
                    `• *Seguindo:* ${u.following}\n` +
                    `🔗 ${u.html_url}`
                );
            }

            addLog(`⚠️ GitHubSkill: ação "${acao}" não reconhecida`);
            return `⚠️ Ação \`${acao}\` não reconhecida. Use: repo, listar, issue, perfil.`;

        } catch (error: any) {
            const status = error.response?.status;
            const msg = error.response?.data?.message || error.message;
            addLog(`❌ GitHub erro [${status}]: ${msg}`);

            if (status === 401) return "❌ Token GitHub inválido ou expirado.\nGere um novo em: github.com/settings/tokens";
            if (status === 403) return "❌ Token GitHub sem permissão. Precisa do scope `repo`.";
            if (status === 422) {
                if (msg.includes('already exists')) return `❌ Repositório "${titulo}" já existe na sua conta.`;
                return `❌ Dados inválidos: ${msg}`;
            }
            if (status === 404) return "❌ Recurso não encontrado no GitHub.";

            return `❌ Erro GitHub (${status || 'timeout'}): ${msg}`;
        }
    }
}
