import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import axios, { AxiosInstance } from 'axios';
import { addLog } from '../web-terminal.js';

function p(bloco: string, key: string): string | null {
    const m = bloco.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`, 'i'));
    return m ? m[1].trim() : null;
}

// Suporta conteudo="..." com múltiplas linhas usando |||...|||
function pMultiline(bloco: string, key: string): string | null {
    const m = bloco.match(new RegExp(`${key}\\s*=\\s*\\|\\|\\|([\\s\\S]*?)\\|\\|\\|`, 'i'));
    if (m) return m[1];
    return p(bloco, key);
}

export class GitHubSkill implements Skill {
    name = 'GitHubSkill';
    description = 'Acesso total ao GitHub: criar/deletar repos, editar/criar/deletar arquivos, commits.';

    canHandle(i: string): boolean { return i.includes('[SYSTEM_GIT:'); }

    private api(token: string): AxiosInstance {
        return axios.create({
            baseURL: 'https://api.github.com',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'JoelBot/20.0',
                'Content-Type': 'application/json'
            },
            timeout: 20000
        });
    }

    private slug(name: string): string {
        return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
    }

    async execute(params: string, _ctx: Context): Promise<string> {
        const m = params.match(/\[SYSTEM_GIT:([\s\S]*?)\]/i);
        if (!m) return '';

        const bloco = m[1];
        const acao  = p(bloco, 'acao') || 'listar';
        addLog(`🐙 GitHub: ${acao}`);

        const token = process.env.GITHUB_TOKEN?.trim();
        const owner = process.env.GITHUB_USERNAME?.trim();

        if (!token) return '⚠️ Configure GITHUB_TOKEN no Render.';

        const api = this.api(token);

        try {
            // ── LISTAR REPOS ──────────────────────────────────────
            if (acao === 'listar') {
                const res  = await api.get('/user/repos?per_page=20&sort=updated');
                const repos = res.data;
                if (!repos.length) return '📭 Nenhum repositório encontrado.';
                const linhas = repos.map((r: any) =>
                    `${r.private ? '🔒' : '🌐'} *${r.full_name}* — ${r.description || 'sem descrição'}\n   ⭐${r.stargazers_count} | 🍴${r.forks_count} | ${r.language || '?'}`
                ).join('\n\n');
                return `📚 *Seus repositórios (${repos.length}):*\n\n${linhas}`;
            }

            // ── CRIAR REPO ────────────────────────────────────────
            if (acao === 'repo') {
                const nome   = p(bloco, 'titulo') || p(bloco, 'nome');
                if (!nome) return '⚠️ Informe o nome do repositório.';
                const repoName = this.slug(nome);
                const priv   = p(bloco, 'privado') === 'true';
                const desc   = p(bloco, 'descricao') || 'Criado pelo JoelBot V20.0 🤖';

                const res = await api.post('/user/repos', { name: repoName, private: priv, description: desc, auto_init: true });
                return `✅ Repositório ${priv ? '🔒 privado' : '🌐 público'} criado!\n📦 *${repoName}*\n🔗 ${res.data.html_url}`;
            }

            // ── DELETAR REPO ──────────────────────────────────────
            if (acao === 'deletar_repo') {
                const repo = p(bloco, 'repo');
                if (!repo) return '⚠️ Informe o repo. Ex: repo="owner/nome"';
                const [repoOwner, repoName] = repo.includes('/') ? repo.split('/') : [owner, repo];
                await api.delete(`/repos/${repoOwner}/${repoName}`);
                return `🗑️ Repositório *${repo}* deletado.`;
            }

            // ── ANALISAR REPO ─────────────────────────────────────
            if (acao === 'analisar') {
                const repo = p(bloco, 'repo');
                if (!repo) return '⚠️ Informe o repo. Ex: repo="owner/nome"';
                const [repoOwner, repoName] = repo.includes('/') ? repo.split('/') : [owner, repo];

                const [repoRes, contentsRes, langRes] = await Promise.all([
                    api.get(`/repos/${repoOwner}/${repoName}`),
                    api.get(`/repos/${repoOwner}/${repoName}/contents/`),
                    api.get(`/repos/${repoOwner}/${repoName}/languages`),
                ]);

                const r       = repoRes.data;
                const files   = contentsRes.data.slice(0, 20).map((f: any) => `${f.type === 'dir' ? '📁' : '📄'} ${f.name}`).join('\n');
                const langs   = Object.entries(langRes.data).map(([l, b]) => `${l}: ${((b as number) / 1000).toFixed(0)}KB`).join(' | ');
                const commits = await api.get(`/repos/${repoOwner}/${repoName}/commits?per_page=5`);
                const lastC   = commits.data.map((c: any) => `• ${c.commit.message.split('\n')[0]} (${c.commit.author.name})`).join('\n');

                return (
                    `🐙 *Análise: ${r.full_name}*\n\n` +
                    `📋 ${r.description || 'sem descrição'}\n` +
                    `⭐ ${r.stargazers_count} stars | 🍴 ${r.forks_count} forks | ${r.private ? '🔒 privado' : '🌐 público'}\n` +
                    `🌿 Branch padrão: ${r.default_branch}\n\n` +
                    `💻 *Linguagens:* ${langs}\n\n` +
                    `📂 *Arquivos raiz:*\n${files}\n\n` +
                    `📝 *Últimos commits:*\n${lastC}`
                );
            }

            // ── LER ARQUIVO ───────────────────────────────────────
            if (acao === 'arquivo' || acao === 'ler') {
                const repo    = p(bloco, 'repo');
                const caminho = p(bloco, 'caminho') || p(bloco, 'arquivo');
                if (!repo || !caminho) return '⚠️ Informe repo e caminho.';
                const [repoOwner, repoName] = repo.includes('/') ? repo.split('/') : [owner, repo];
                const branch = p(bloco, 'branch') || 'main';

                const res  = await api.get(`/repos/${repoOwner}/${repoName}/contents/${caminho}?ref=${branch}`);
                const body = Buffer.from(res.data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
                return `📄 *${caminho}* (${repoName}):\n\`\`\`\n${body.substring(0, 3000)}\n\`\`\`\nSHA: \`${res.data.sha.slice(0, 8)}\``;
            }

            // ── CRIAR / EDITAR / SOBRESCREVER ARQUIVO ─────────────
            if (acao === 'editar' || acao === 'criar_arquivo' || acao === 'sobrescrever') {
                const repo     = p(bloco, 'repo');
                const caminho  = p(bloco, 'caminho') || p(bloco, 'arquivo');
                const conteudo = pMultiline(bloco, 'conteudo') || '';
                const msg      = p(bloco, 'mensagem') || p(bloco, 'msg') || `chore: update ${caminho}`;
                const branch   = p(bloco, 'branch') || 'main';

                if (!repo || !caminho) return '⚠️ Informe repo e caminho.';
                const [repoOwner, repoName] = repo.includes('/') ? repo.split('/') : [owner, repo];
                const b64 = Buffer.from(conteudo, 'utf-8').toString('base64');

                // Verifica se o arquivo já existe para pegar o SHA
                let sha: string | undefined;
                try {
                    const ex = await api.get(`/repos/${repoOwner}/${repoName}/contents/${caminho}?ref=${branch}`);
                    sha = ex.data.sha;
                } catch { /* arquivo novo */ }

                const body: any = { message: msg, content: b64, branch };
                if (sha) body.sha = sha;

                await api.put(`/repos/${repoOwner}/${repoName}/contents/${caminho}`, body);

                const acao2 = sha ? 'atualizado' : 'criado';
                return `✅ Arquivo *${caminho}* ${acao2} em *${repoName}*!\n💬 Commit: "${msg}"`;
            }

            // ── DELETAR ARQUIVO ───────────────────────────────────
            if (acao === 'deletar_arquivo') {
                const repo    = p(bloco, 'repo');
                const caminho = p(bloco, 'caminho') || p(bloco, 'arquivo');
                const msg     = p(bloco, 'mensagem') || `chore: remove ${caminho}`;
                const branch  = p(bloco, 'branch') || 'main';
                if (!repo || !caminho) return '⚠️ Informe repo e caminho.';
                const [repoOwner, repoName] = repo.includes('/') ? repo.split('/') : [owner, repo];

                const ex  = await api.get(`/repos/${repoOwner}/${repoName}/contents/${caminho}?ref=${branch}`);
                const sha = ex.data.sha;
                await api.delete(`/repos/${repoOwner}/${repoName}/contents/${caminho}`, {
                    data: { message: msg, sha, branch }
                });
                return `🗑️ *${caminho}* removido de *${repoName}*.\n💬 Commit: "${msg}"`;
            }

            // ── LISTAR ARQUIVOS DA PASTA ──────────────────────────
            if (acao === 'listar_arquivos') {
                const repo    = p(bloco, 'repo');
                const pasta   = p(bloco, 'pasta') || '';
                if (!repo) return '⚠️ Informe o repo.';
                const [repoOwner, repoName] = repo.includes('/') ? repo.split('/') : [owner, repo];
                const branch = p(bloco, 'branch') || 'main';

                const res   = await api.get(`/repos/${repoOwner}/${repoName}/contents/${pasta}?ref=${branch}`);
                const files = res.data.map((f: any) => `${f.type === 'dir' ? '📁' : '📄'} ${f.name}`).join('\n');
                return `📂 *${repoName}/${pasta || ''}:*\n\n${files}`;
            }

            // ── ISSUES ────────────────────────────────────────────
            if (acao === 'issues') {
                const repo = p(bloco, 'repo');
                if (!repo) return '⚠️ Informe o repo.';
                const [repoOwner, repoName] = repo.includes('/') ? repo.split('/') : [owner, repo];
                const res  = await api.get(`/repos/${repoOwner}/${repoName}/issues?state=open&per_page=10`);
                if (!res.data.length) return `✅ Nenhuma issue aberta em *${repoName}*.`;
                const issues = res.data.map((i: any) => `#${i.number} ${i.title} — ${i.user.login}`).join('\n');
                return `🐛 *Issues abertas em ${repoName}:*\n\n${issues}`;
            }

            return `⚠️ Ação GitHub desconhecida: "${acao}"`;
        } catch (e: any) {
            const status = e.response?.status;
            const msg    = e.response?.data?.message || e.message;
            addLog(`❌ GitHub [${status}]: ${msg}`);
            if (status === 401) return '❌ Token GitHub inválido. Verifique GITHUB_TOKEN.';
            if (status === 403) return '❌ Sem permissão. Token precisa do scope "repo" e "delete_repo".';
            if (status === 404) return `❌ Repositório ou arquivo não encontrado.`;
            if (status === 422) return `❌ Dados inválidos: ${msg}`;
            return `❌ Erro GitHub (${status}): ${msg}`;
        }
    }
}
