import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import pptxgen from 'pptxgenjs';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { addLog } from '../web-terminal.js';

// Paleta de cores profissional JoelBot
const COLORS = {
    dark: '1A1A2E',
    primary: '0F3460',
    accent: 'E94560',
    light: 'F5F5F5',
    white: 'FFFFFF',
    gray: '555555',
    blue: '0078D4',
    softBlue: 'E8F4FD',
};

export class SlidesSkill implements Skill {
    name = 'SlidesSkill';
    description = 'Gera apresentações PowerPoint profissionais com design moderno.';

    canHandle(intent: string): boolean {
        return intent.includes('[SYSTEM_SLIDES:');
    }

    async execute(params: any, _ctx: Context): Promise<string | { text: string; file: string; type: 'document' }> {
        const match = params.match(/\[SYSTEM_SLIDES:\s*tema="([\s\S]+?)",\s*conteudo="([\s\S]+?)"\]/i);
        if (!match) {
            addLog('⚠️ SlidesSkill: formato inválido — esperado tema="..." e conteudo="..."');
            return "";
        }

        const tema = match[1].trim();
        const conteudoBruto = match[2].replace(/\\n/g, '\n');

        addLog(`📊 Criando apresentação: "${tema}"`);

        try {
            // FIXADO: instanciação correta do pptxgenjs
            const pres = new pptxgen();
            pres.layout = 'LAYOUT_16x9';
            pres.author = 'JoelBot V20.0';
            pres.subject = tema;
            pres.title = tema;

            // ── Slide de Capa ──────────────────────────────────────────────
            const slideCapa = pres.addSlide();
            slideCapa.background = { color: COLORS.dark };

            // Faixa decorativa superior
            slideCapa.addShape(pres.ShapeType.rect, {
                x: 0, y: 0, w: 0.5, h: '100%',
                fill: { color: COLORS.accent }
            });

            // Linha divisória
            slideCapa.addShape(pres.ShapeType.rect, {
                x: 0.5, y: 3.0, w: '95%', h: 0.05,
                fill: { color: COLORS.primary }
            });

            slideCapa.addText(tema.toUpperCase(), {
                x: 0.9, y: 0.8, w: '87%', h: 2.0,
                fontSize: 38, color: COLORS.white,
                bold: true, align: 'left',
                fontFace: 'Calibri',
                wrap: true
            });

            slideCapa.addText('Apresentação gerada por JoelBot V20.0 🤖', {
                x: 0.9, y: 3.2, w: '87%',
                fontSize: 14, color: 'AAAAAA',
                align: 'left', fontFace: 'Calibri'
            });

            const dataHoje = new Date().toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric'
            });
            slideCapa.addText(dataHoje, {
                x: 0.9, y: 3.8, w: '87%',
                fontSize: 12, color: '777777',
                align: 'left', fontFace: 'Calibri'
            });

            // ── Slides de Conteúdo ─────────────────────────────────────────
            const slidesRaw = conteudoBruto
                .split(/---+/)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0);

            slidesRaw.forEach((slideText: string, idx: number) => {
                const lines = slideText.split('\n').filter((l: string) => l.trim());
                if (!lines.length) return;

                const titleLine = lines[0].replace(/^#+\s*/, '').trim();
                const bodyLines = lines.slice(1).filter((l: string) => l.trim());

                const slide = pres.addSlide();
                slide.background = { color: COLORS.light };

                // Cabeçalho colorido
                slide.addShape(pres.ShapeType.rect, {
                    x: 0, y: 0, w: '100%', h: 1.2,
                    fill: { color: COLORS.primary }
                });

                // Barra accent lateral
                slide.addShape(pres.ShapeType.rect, {
                    x: 0, y: 0, w: 0.12, h: '100%',
                    fill: { color: COLORS.accent }
                });

                // Numeração
                slide.addText(`${String(idx + 1).padStart(2, '0')}`, {
                    x: 8.5, y: 0.15, w: 0.9, h: 0.8,
                    fontSize: 22, color: 'FFFFFF44',
                    bold: true, align: 'right', fontFace: 'Calibri'
                });

                // Título
                slide.addText(titleLine, {
                    x: 0.4, y: 0.18, w: '82%', h: 0.85,
                    fontSize: 22, color: COLORS.white,
                    bold: true, align: 'left', fontFace: 'Calibri'
                });

                // Linha accent abaixo do cabeçalho
                slide.addShape(pres.ShapeType.rect, {
                    x: 0.4, y: 1.25, w: 0.6, h: 0.06,
                    fill: { color: COLORS.accent }
                });

                // Conteúdo
                if (bodyLines.length > 0) {
                    const isBullets = bodyLines.some((l: string) => /^[-•*]\s/.test(l));

                    if (isBullets) {
                        const bulletItems = bodyLines
                            .map((l: string) => l.replace(/^[-•*]\s+/, '').trim())
                            .filter((l: string) => l);

                        // FIXADO: usar array de objetos TextProps para bullets no pptxgenjs v3
                        const textItems = bulletItems.map((b: string) => ({
                            text: b,
                            options: {
                                fontSize: 16,
                                color: COLORS.gray,
                                paraSpaceAfter: 10,
                                bullet: true,
                                indentLevel: 0,
                                fontFace: 'Calibri'
                            }
                        }));

                        slide.addText(textItems, {
                            x: 0.4, y: 1.45, w: '89%', h: 3.8,
                            valign: 'top'
                        });
                    } else {
                        slide.addText(bodyLines.join('\n'), {
                            x: 0.4, y: 1.45, w: '89%', h: 3.8,
                            fontSize: 16, color: COLORS.gray,
                            fontFace: 'Calibri', valign: 'top',
                            wrap: true
                        });
                    }
                }

                // Rodapé
                slide.addText(`${tema} | Slide ${idx + 2}`, {
                    x: 0.3, y: 5.15, w: '65%',
                    fontSize: 9, color: 'BBBBBB', fontFace: 'Calibri'
                });

                slide.addText('JoelBot V20.0 🤖', {
                    x: 7.0, y: 5.15, w: 2.5,
                    fontSize: 9, color: 'BBBBBB', align: 'right', fontFace: 'Calibri'
                });
            });

            // ── Slide Final ────────────────────────────────────────────────
            const slideFinal = pres.addSlide();
            slideFinal.background = { color: COLORS.accent };

            slideFinal.addShape(pres.ShapeType.rect, {
                x: 0, y: 0, w: '100%', h: 0.5,
                fill: { color: COLORS.dark }
            });

            slideFinal.addText('OBRIGADO!', {
                x: 0.5, y: 1.3, w: '90%', h: 2.0,
                fontSize: 64, color: COLORS.white,
                bold: true, align: 'center', fontFace: 'Calibri'
            });

            slideFinal.addText(tema, {
                x: 0.5, y: 3.4, w: '90%',
                fontSize: 18, color: 'FFFFFFCC',
                align: 'center', fontFace: 'Calibri'
            });

            slideFinal.addText('Gerado por JoelBot V20.0 🤖', {
                x: 0.5, y: 4.5, w: '90%',
                fontSize: 12, color: 'FFFFFF88',
                align: 'center', fontFace: 'Calibri'
            });

            // ── Salvar arquivo ─────────────────────────────────────────────
            const fileName = `apresentacao_${Date.now()}.pptx`;
            const filePath = path.join(process.cwd(), fileName);

            await pres.writeFile({ fileName: filePath });

            if (!fs.existsSync(filePath)) throw new Error('Arquivo PPTX não foi gerado no disco.');

            const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
            const totalSlides = slidesRaw.length + 2;
            addLog(`✅ PPTX criado: ${fileName} (${sizeMB}MB, ${totalSlides} slides)`);

            return {
                text: `📊 Apresentação *"${tema}"* criada!\n✅ ${totalSlides} slides • Design profissional • ${sizeMB}MB`,
                file: filePath,
                type: 'document'
            };

        } catch (error: any) {
            addLog(`❌ SlidesSkill erro: ${error.message}`);
            return `❌ Erro ao criar apresentação: ${error.message}`;
        }
    }
}
