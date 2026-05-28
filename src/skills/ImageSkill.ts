import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import axios from 'axios';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { addLog } from '../web-terminal.js';

export class ImageSkill implements Skill {
    name = 'ImageSkill';
    description = 'Gera imagens de alta qualidade via Pollinations.ai (FLUX model).';

    canHandle(intent: string): boolean {
        return intent.includes('[SYSTEM_IMAGE:');
    }

    async execute(params: any, ctx: Context): Promise<string | { text: string; file?: string; type?: 'photo' }> {
        const match = params.match(/\[SYSTEM_IMAGE:\s*prompt="([\s\S]+?)"\]/i);
        if (!match) return "";

        const prompt = match[1].trim();
        addLog(`🎨 Gerando imagem: "${prompt.substring(0, 60)}..."`);

        try {
            await (ctx as any).sendChatAction('upload_photo').catch(() => {});

            const seed = Math.floor(Math.random() * 999999);
            const encodedPrompt = encodeURIComponent(prompt);

            // Pollinations.ai - FLUX model, gratuito, sem API key necessária
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&enhance=true&model=flux&seed=${seed}`;

            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 120000,
                headers: { 'User-Agent': 'JoelBot/20.0' }
            });

            if (!response.data || response.data.byteLength < 1000) {
                addLog('⚠️ Imagem retornada muito pequena — tentando novamente sem enhance');
                // Tenta sem enhance como fallback
                const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&model=flux&seed=${seed}`;
                const fallbackResponse = await axios.get(fallbackUrl, {
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    headers: { 'User-Agent': 'JoelBot/20.0' }
                });
                if (!fallbackResponse.data || fallbackResponse.data.byteLength < 1000) {
                    return "❌ Não foi possível gerar a imagem. Tente novamente com outro prompt.";
                }
                const imagePath2 = path.join(process.cwd(), `image_${Date.now()}.jpg`);
                fs.writeFileSync(imagePath2, Buffer.from(fallbackResponse.data));
                return { text: `🎨 Imagem gerada: "${prompt.substring(0, 100)}"`, file: imagePath2, type: 'photo' };
            }

            const imagePath = path.join(process.cwd(), `image_${Date.now()}.jpg`);
            fs.writeFileSync(imagePath, Buffer.from(response.data));

            addLog(`✅ Imagem gerada: ${path.basename(imagePath)} (${(response.data.byteLength / 1024).toFixed(0)}KB)`);
            return {
                text: `🎨 Imagem gerada: *"${prompt.substring(0, 100)}"*`,
                file: imagePath,
                type: 'photo'
            };

        } catch (error: any) {
            addLog(`❌ ImageSkill erro: ${error.message}`);
            return "❌ Erro ao gerar imagem. Verifique o prompt e tente novamente.";
        }
    }
}
