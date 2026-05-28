import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import puppeteer from 'puppeteer';
import * as path from 'node:path';
import { addLog } from '../web-terminal.js';

export class BrowserSkill implements Skill {
    name = 'BrowserSkill';
    description = 'Navega em sites, executa ações e captura screenshots.';

    canHandle(intent: string): boolean {
        return intent.includes('[SYSTEM_BROWSER:');
    }

    private extrairParam(bloco: string, param: string): string | null {
        const regex = new RegExp(`${param}\\s*=\\s*["']([^"']+)["']`, 'i');
        const match = bloco.match(regex);
        return match ? match[1].trim() : null;
    }

    async execute(params: any, ctx: Context): Promise<string | { text: string; file?: string; type?: 'photo' }> {
        const match = params.match(/\[SYSTEM_BROWSER:([\s\S]*?)\]/i);
        if (!match) return "";

        const bloco = match[1];
        const acao = this.extrairParam(bloco, 'acao');
        const url = this.extrairParam(bloco, 'url');
        const selector = this.extrairParam(bloco, 'selector');
        const texto = this.extrairParam(bloco, 'texto');

        if (!acao || !url) {
            addLog('⚠️ BrowserSkill: acao ou url não fornecidos');
            return "";
        }

        addLog(`🌐 BrowserSkill: ${acao} → ${url}`);
        let browser: any;

        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ]
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });
            await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            if (acao === 'screenshot') {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                const screenshotPath = path.join(process.cwd(), `screenshot_${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath as `${string}.png`, fullPage: false });
                addLog(`📸 Screenshot: ${path.basename(screenshotPath)}`);
                return {
                    text: `📸 Screenshot de \`${url}\` capturado!`,
                    file: screenshotPath,
                    type: 'photo'
                };
            }

            if (acao === 'extract') {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                const content: string = await page.evaluate(() => {
                    document.querySelectorAll('script, style, nav, footer, header, aside').forEach((el: any) => el.remove());
                    return (document.body?.innerText || '').trim();
                });
                const excerpt = content.substring(0, 2500);
                addLog(`📄 Conteúdo extraído de ${url} (${content.length} chars)`);
                return `📄 **Conteúdo de ${url}:**\n\`\`\`\n${excerpt}\n\`\`\``;
            }

            if (acao === 'click' && selector) {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForSelector(selector, { timeout: 5000 });
                await page.click(selector);
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
                addLog(`🖱️ Clique em ${selector} executado`);
                return `✅ Clique em \`${selector}\` executado em ${url}`;
            }

            if (acao === 'type' && selector && texto) {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForSelector(selector, { timeout: 5000 });
                await page.type(selector, texto, { delay: 50 });
                addLog(`⌨️ Texto digitado em ${selector}`);
                return `✅ Texto digitado no campo \`${selector}\``;
            }

            addLog(`⚠️ BrowserSkill: ação "${acao}" não reconhecida`);
            return "";

        } catch (error: any) {
            addLog(`❌ BrowserSkill erro: ${error.message}`);
            return `❌ Erro ao acessar ${url}: ${error.message}`;
        } finally {
            if (browser) await browser.close().catch(() => {});
        }
    }
}
