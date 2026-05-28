import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import pptxgen from 'pptxgenjs';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { addLog } from '../web-terminal.js';

// Paleta de cores profissional
const COLORS = {
    dark: '1A1A2E',
    primary: '0F3460',
    accent: 'E94560',
    light: 'F5F5F5',
    white: 'FFFFFF',
    gray: '666666',
    blue: '0078D4',
};

export class SlidesSkill implements Skill {
    name = 'SlidesSkill';
    description = 'Gera apresentações PowerPoint profissionais com design moderno.';

    canHandle(intent: string): boolean {
        return intent.includes('[SYSTEM_SLIDES:');
    }

    async execute(params: any, ctx: Context): Promise<string | { text: string; file: string; type: 'document' }> {
        const match = params.match(/\[SYSTEM_SLIDES:\s*tema="([\s\S]+?)",\s*conteudo="([\s\S]+?)"\]/i);
        if (!match) {
            addLog('⚠️ SlidesSkill: formato inválido');
            return "";
        }

        const tema = match[1].trim();
        const conteudoBruto = match[2].replace(/\\n/g, '\n');

        addLog(`📊 Criando apresentação: "${tema}"`);

        try {
            const pres = new (pptxgen as any)();
            pres.layout = 'LAYOUT_16x9';
            pres.author = 'JoelBot V20.0';
            pres.subject = tema;

            // ── Slide de Capa ────────────────────────────────────────
            const slideCapa = pres.addSlide();
            slideCapa.background = { color: COLORS.dark };

            // Faixa decorativa
            slideCapa.addShape('rect', {
                x: 0, y: 3.2, w: '100%', h: 0.08,
                fill: { color: COLORS.accent }
            });

            slideCapa.addText(tema.toUpperCase(), {
                x: 0.8, y: 1.0, w: '85%', h: 1.8,
                fontSize: 40, color: COLORS.white,
                bold: true, align: 'left',
                fontFace: 'Calibri'
            });

            slideCapa.addText('Apresentação gerada por JoelBot V20.0 🤖', {
                x: 0.8, y: 3.5, w: '85%',
                fontSize: 14, color: 'AAAAAA',
                align: 'left', fontFace: 'Calibri'
            });

            const dataHoje = new Date().toLocaleDateString('pt-BR');
            slideCapa.addText(dataHoje, {
                x: 0.8, y: 4.2, w: '85%',
                fontSize: 12, color: '777777',
                align: 'left'
            });

            // ── Slides de Conteúdo ───────────────────────────────────
            const slidesRaw = conteudoBruto
                .split(/---+/)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0);

            slidesRaw.forEach((slideText: string, idx: number) => {
                const lines = slideText.split('\n').filter(l => l.trim());
                if (!lines.length) return;

                const titleLine = lines[0].replace(/^#+\s*/, '').trim();
                const bodyLines = lines.slice(1).filter(l => l.trim());

                const slide = pres.addSlide();
                slide.background = { color: COLORS.light };

                // Cabeçalho colorido
                slide.addShape('rect', {
                    x: 0, y: 0, w: '100%', h: 1.1,
                    fill: { color: COLORS.primary }
                });

                // Numeração
                slide.addText(`${idx + 1}`, {
                    x: 8.8, y: 0.1, w: 0.8, h: 0.8,
                    fontSize: 20, color: 'FFFFFF55',
                    bold: true, align: 'right'
                });

                // Título
                slide.addText(titleLine, {
                    x: 0.4, y: 0.15, w: '85%', h: 0.8,
                    fontSize: 24, color: COLORS.white,
                    bold: true, align: 'left', fontFace: 'Calibri'
                });

                // Linha separadora colorida
                slide.addShape('rect', {
                    x: 0.4, y: 1.2, w: 0.5, h: 0.06,
                    fill: { color: COLORS.accent }
                });

                // Conteúdo
                if (bodyLines.length > 0) {
                    const isBullets = bodyLines.some(l => l.match(/^[-•*]\s/));

                    if (isBullets) {
                        // Bullets
                        const bullets = bodyLines
                            .map(l => l.replace(/^[-•*]\s+/, '').trim())
                            .filter(l => l);

                        const bulletObjs = bullets.map(b => ({
                            text: b,
                            options: {
                                bullet: { type: 'bullet', characterCode: '25CF' },
                                fontSize: 16,
                                color: '333333',
                                paraSpaceAfter: 8,
                                indentLevel: 0
                            }
                        }));

                        slide.addText(bulletObjs, {
                            x: 0.4, y: 1.4, w: '90%', h: 3.8,
                            fontFace: 'Calibri', valign: 'top'
                        });
                    } else {
                        // Texto corrido
                        slide.addText(bodyLines.join('\n'), {
                            x: 0.4, y: 1.4, w: '90%', h: 3.8,
                            fontSize: 16, color: '333333',
                            fontFace: 'Calibri', valign: 'top',
                            wrap: true
                        });
                    }
                }

                // Rodapé
                slide.addText(tema, {
                    x: 0.3, y: 5.0, w: '60%',
                    fontSize: 9, color: 'AAAAAA'
                });
            });

            // ── Slide Final ──────────────────────────────────────────
            const slideFinal = pres.addSlide();
            slideFinal.background = { color: COLORS.accent };

            slideFinal.addText('OBRIGADO!', {
                x: 0.5, y: 1.8, w: '90%', h: 1.5,
                fontSize: 60, color: COLORS.white,
                bold: true, align: 'center', fontFace: 'Calibri'
            });

            slideFinal.addText(tema, {
                x: 0.5, y: 3.4, w: '90%',
                fontSize: 18, color: 'FFFFFF99',
                align: 'center'
            });

            slideFinal.addText('Gerado por JoelBot V20.0 🤖', {
                x: 0.5, y: 4.4, w: '90%',
                fontSize: 12, color: 'FFFFFF77',
                align: 'center'
            });

            // ── Salvar ───────────────────────────────────────────────
            const fileName = `apresentacao_${Date.now()}.pptx`;
            const filePath = path.join(process.cwd(), fileName);

            await pres.writeFile({ fileName: filePath });

            if (!fs.existsSync(filePath)) throw new Error('Arquivo não foi gerado.');

            const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
            addLog(`✅ PPTX criado: ${fileName} (${sizeMB}MB, ${slidesRaw.length + 2} slides)`);

            return {
                text: `📊 Apresentação *"${tema}"* criada!\n${slidesRaw.length + 2} slides • Design profissional`,
                file: filePath,
                type: 'document'
            };
        } catch (error: any) {
            addLog(`❌ SlidesSkill erro: ${error.message}`);
            return "";
        }
    }
}
