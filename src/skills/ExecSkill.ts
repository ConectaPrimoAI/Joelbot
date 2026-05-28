import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { addLog } from '../web-terminal.js';

const execAsync = promisify(exec);

// Comandos bloqueados por segurança
const BLOCKED_CMDS = [
    'rm -rf /', 'mkfs', 'dd if=', ':(){', 'format c',
    'shutdown', 'reboot', 'kill -9 1', 'pkill -9', 'halt'
];

export class ExecSkill implements Skill {
    name = 'ExecSkill';
    description = 'Executa comandos bash seguros e cria/lê arquivos no servidor.';

    canHandle(intent: string): boolean {
        return intent.includes('[SYSTEM_EXEC:');
    }

    private extrairParam(bloco: string, param: string): string | null {
        const regex = new RegExp(`${param}\\s*=\\s*["']([^"']+)["']`, 'i');
        const match = bloco.match(regex);
        return match ? match[1].trim() : null;
    }

    async execute(params: any, ctx: Context): Promise<string | { text: string; file?: string; type?: 'document' }> {
        const match = params.match(/\[SYSTEM_EXEC:([\s\S]*?)\]/i);
        if (!match) return "";

        const bloco = match[1];
        const acao = this.extrairParam(bloco, 'acao');
        const cmd = this.extrairParam(bloco, 'cmd');
        const nome = this.extrairParam(bloco, 'nome');

        addLog(`🔧 ExecSkill: acao=${acao}`);

        if (acao === 'exec' && cmd) {
            const cmdLower = cmd.toLowerCase();
            if (BLOCKED_CMDS.some(b => cmdLower.includes(b))) {
                addLog(`⚠️ Comando bloqueado por segurança: ${cmd.substring(0, 80)}`);
                return "⚠️ Comando bloqueado por razões de segurança.";
            }

            try {
                const { stdout, stderr } = await execAsync(cmd, {
                    timeout: 30000,
                    shell: '/bin/bash',
                    env: { ...process.env, PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }
                });
                const output = (stdout || stderr || '✅ Comando executado sem saída.').substring(0, 3000);
                addLog(`✅ Exec concluído: ${cmd.substring(0, 50)}`);
                return `💻 **Terminal:**\n\`\`\`\n${output}\n\`\`\``;
            } catch (err: any) {
                const errMsg = (err.stdout || err.stderr || err.message).substring(0, 1500);
                addLog(`❌ Exec erro: ${errMsg.substring(0, 100)}`);
                return `💻 **Terminal (erro):**\n\`\`\`\n${errMsg}\n\`\`\``;
            }
        }

        if (acao === 'criar' && nome && cmd) {
            try {
                const safeNome = path.basename(nome);
                const filePath = path.join(process.cwd(), safeNome);
                const conteudo = cmd.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
                fs.writeFileSync(filePath, conteudo, 'utf-8');
                addLog(`📄 Arquivo criado: ${safeNome} (${conteudo.length} chars)`);
                return {
                    text: `📄 Arquivo \`${safeNome}\` criado com sucesso!`,
                    file: filePath,
                    type: 'document'
                };
            } catch (err: any) {
                addLog(`❌ Criar arquivo erro: ${err.message}`);
                return `❌ Erro ao criar arquivo: ${err.message}`;
            }
        }

        if (acao === 'ler' && nome) {
            try {
                const safeNome = path.basename(nome);
                const filePath = path.join(process.cwd(), safeNome);
                if (!fs.existsSync(filePath)) return `❌ Arquivo \`${safeNome}\` não encontrado.`;
                const conteudo = fs.readFileSync(filePath, 'utf-8').substring(0, 3000);
                addLog(`📖 Arquivo lido: ${safeNome}`);
                return `📖 **Conteúdo de \`${safeNome}\`:**\n\`\`\`\n${conteudo}\n\`\`\``;
            } catch (err: any) {
                return `❌ Erro ao ler arquivo: ${err.message}`;
            }
        }

        addLog(`⚠️ ExecSkill: ação "${acao}" não reconhecida — ignorando`);
        return "";
    }
}
