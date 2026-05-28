import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import axios from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { addLog } from '../web-terminal.js';

export class VideoSkill implements Skill {
    name = 'VideoSkill';
    description = 'Gera vídeos curtos usando Replicate API (minimax/video-01).';

    canHandle(intent: string): boolean {
        return intent.includes('[SYSTEM_VIDEO:');
    }

    async execute(params: any, ctx: Context): Promise<string | { text: string; file?: string; type?: 'video' }> {
        const match = params.match(/\[SYSTEM_VIDEO:\s*prompt="([\s\S]+?)"\]/i);
        if (!match) return "";

        const userPrompt = match[1].trim();
        const replicateToken = process.env.REPLICATE_API_TOKEN?.trim();

        if (!replicateToken) {
            addLog('⚠️ VideoSkill: REPLICATE_API_TOKEN não configurado');
            return (
                `🎬 *Geração de Vídeo*\n\n` +
                `Para gerar vídeos, configure \`REPLICATE_API_TOKEN\` nas variáveis de ambiente.\n\n` +
                `📝 *Prompt recebido:* "${userPrompt}"\n\n` +
                `Cadastre-se gratuitamente em: https://replicate.com`
            );
        }

        addLog(`🎬 VideoSkill: gerando vídeo para "${userPrompt.substring(0, 50)}"`);
        await (ctx as any).sendChatAction('upload_video').catch(() => {});

        try {
            return await this.generateWithReplicate(userPrompt, replicateToken);
        } catch (error: any) {
            addLog(`❌ VideoSkill erro: ${error.message}`);
            return `❌ Falha ao gerar vídeo: ${error.message}`;
        }
    }

    private async generateWithReplicate(
        prompt: string,
        token: string
    ): Promise<string | { text: string; file?: string; type?: 'video' }> {

        // FIXADO: usar 'model' ao invés de 'version' para modelos públicos do Replicate
        const createResponse = await axios.post(
            'https://api.replicate.com/v1/models/minimax/video-01/predictions',
            {
                input: {
                    prompt,
                    duration: 5,
                    aspect_ratio: '16:9',
                    prompt_optimizer: true
                }
            },
            {
                headers: {
                    Authorization: `Token ${token}`,
                    'Content-Type': 'application/json',
                    Prefer: 'wait'
                },
                timeout: 30000
            }
        );

        const predictionId = createResponse.data.id;
        addLog(`🎬 Prediction iniciada: ${predictionId}`);

        // Polling com backoff
        let result = createResponse.data;
        let attempts = 0;
        const MAX_ATTEMPTS = 90; // ~3 minutos

        while (['starting', 'processing'].includes(result.status) && attempts < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 2000));
            const checkResponse = await axios.get(
                `https://api.replicate.com/v1/predictions/${predictionId}`,
                { headers: { Authorization: `Token ${token}` }, timeout: 10000 }
            );
            result = checkResponse.data;
            attempts++;
            if (attempts % 15 === 0) {
                addLog(`🎬 Aguardando vídeo... ${attempts * 2}s (status: ${result.status})`);
            }
        }

        if (result.status === 'succeeded' && result.output) {
            const videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            const videoPath = path.join(process.cwd(), `video_${Date.now()}.mp4`);

            addLog(`🎬 Download do vídeo: ${videoUrl}`);
            const videoResponse = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 120000
            });
            fs.writeFileSync(videoPath, Buffer.from(videoResponse.data));

            const sizeMB = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(1);
            addLog(`✅ Vídeo gerado: ${path.basename(videoPath)} (${sizeMB}MB)`);
            return {
                text: `🎬 Vídeo gerado: *"${prompt}"*`,
                file: videoPath,
                type: 'video'
            };
        }

        const errorMsg = result.error || `Status final: ${result.status}`;
        addLog(`❌ Vídeo falhou: ${errorMsg}`);
        return `❌ Geração de vídeo falhou.\n_${errorMsg}_\n\nTente novamente com um prompt diferente.`;
    }
}
