import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import pptxgen from 'pptxgenjs';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { addLog } from '../web-terminal.js';

const COLORS = {
    bg: '0B1020',
    surface: '121A2B',
    primary: '4DA3FF',
    accent: 'FF5C7A',
    gold: 'FFC857',
    text: 'F5F7FA',
    muted: 'B8C1CC',
    darkText: '1A1F2E',
    soft: 'EEF2F7',
    line: '283046'
};

const FONT_TITLE = 'Aptos Display';
const FONT_BODY = 'Aptos';

function splitContent(content: string) {
    return content
        .split(/---+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function normalizeBullets(lines: string[]) {
    return lines
        .map((l) => l.replace(/^[-•*]\s+/, '').trim())
        .filter(Boolean);
}

function addCinematicBackground(slide: any) {
    slide.background = {
        color: COLORS.bg
    };

    slide.addShape('rect', {
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
        fill: {
            color: COLORS.bg,
            transparency: 0
        },
        line: {
            color: COLORS.bg,
            transparency: 100
        }
    });

    slide.addShape('rect', {
        x: 0,
        y: 0,
        w: 13.33,
        h: 0.08,
        fill: {
            color: COLORS.primary
        },
        line: {
            color: COLORS.primary,
            transparency: 100
        }
    });
}

function addHeader(slide: any, title: string, index: number) {
    slide.addText(title.toUpperCase(), {
        x: 0.7,
        y: 0.45,
        w: 9.5,
        h: 0.7,
        fontFace: FONT_TITLE,
        fontSize: 28,
        bold: true,
        color: COLORS.text,
        margin: 0
    });

    slide.addText(String(index).padStart(2, '0'), {
        x: 11.5,
        y: 0.35,
        w: 1,
        h: 0.6,
        align: 'right',
        fontFace: FONT_TITLE,
        fontSize: 26,
        bold: true,
        color: 'FFFFFF22',
        margin: 0
    });

    slide.addShape('line', {
        x: 0.7,
        y: 1.15,
        w: 11.2,
        h: 0,
        line: {
            color: COLORS.line,
            pt: 1.2
        }
    });
}

function addQuoteSlide(slide: any, quote: string) {
    slide.addText('“', {
        x: 0.7,
        y: 1.0,
        w: 1,
        h: 1,
        fontSize: 70,
        color: COLORS.accent,
        bold: true,
        margin: 0
    });

    slide.addText(quote, {
        x: 1.4,
        y: 1.5,
        w: 10.2,
        h: 2,
        fontFace: FONT_TITLE,
        fontSize: 26,
        bold: false,
        italic: true,
        color: COLORS.text,
        breakLine: false,
        valign: 'mid'
    });
}

function addBulletGrid(slide: any, bullets: string[]) {
    const startY = 1.55;
    const cardHeight = 1.05;

    bullets.slice(0, 4).forEach((bullet, idx) => {
        const y = startY + idx * 1.1;

        slide.addShape('roundRect', {
            x: 0.8,
            y,
            w: 11.2,
            h: cardHeight,
            rectRadius: 0.08,
            fill: {
                color: idx % 2 === 0 ? '151F34' : '111827'
            },
            line: {
                color: '24324A',
                pt: 1
            },
            shadow: {
                type: 'outer',
                color: '000000',
                angle: 45,
                blur: 2,
                distance: 1,
                opacity: 0.18
            }
        });

        slide.addShape('roundRect', {
            x: 1.0,
            y: y + 0.22,
            w: 0.22,
            h: 0.22,
            rectRadius: 0.2,
            fill: {
                color: idx % 2 === 0 ? COLORS.primary : COLORS.accent
            },
            line: {
                color: 'FFFFFF',
                transparency: 100
            }
        });

        slide.addText(bullet, {
            x: 1.4,
            y: y + 0.18,
            w: 9.9,
            h: 0.5,
            fontFace: FONT_BODY,
            fontSize: 18,
            color: COLORS.text,
            bold: false,
            margin: 0
        });
    });
}

function addEditorialText(slide: any, text: string) {
    slide.addText(text, {
        x: 0.9,
        y: 1.7,
        w: 10.8,
        h: 2.8,
        fontFace: FONT_BODY,
        fontSize: 20,
        color: COLORS.muted,
        breakLine: true,
        fit: 'shrink',
        valign: 'mid',
        margin: 0.05,
        paraSpaceAfterPt: 12,
        bold: false
    });

    slide.addShape('rect', {
        x: 0.9,
        y: 4.7,
        w: 1.6,
        h: 0.06,
        fill: {
            color: COLORS.accent
        },
        line: {
            color: COLORS.accent,
            transparency: 100
        }
    });
}

export class SlidesSkill implements Skill {
    name = 'SlidesSkill';

    description = 'Gera apresentações cinematográficas de alto impacto visual.';

    canHandle(intent: string): boolean {
        return intent.includes('[SYSTEM_SLIDES:');
    }

    async execute(params: any, ctx: Context): Promise<any> {
        const match = params.match(/\[SYSTEM_SLIDES:\s*tema="([\s\S]+?)",\s*conteudo="([\s\S]+?)"\]/i);

        if (!match) {
            addLog('⚠️ SlidesSkill: formato inválido');
            return '';
        }

        const tema = match[1].trim();
        const conteudoBruto = match[2].replace(/\\n/g, '\n');

        try {
            const pres = new (pptxgen as any)();

            pres.layout = 'LAYOUT_WIDE';
            pres.author = 'JoelBot Cinematic Engine';
            pres.company = 'JoelBot AI';
            pres.subject = tema;
            pres.title = tema;
            pres.lang = 'pt-BR';
            pres.theme = {
                headFontFace: FONT_TITLE,
                bodyFontFace: FONT_BODY,
                lang: 'pt-BR'
            };

            // COVER
            const cover = pres.addSlide();
            addCinematicBackground(cover);

            cover.addShape('rect', {
                x: 0,
                y: 0,
                w: 13.33,
                h: 7.5,
                fill: {
                    color: '000000',
                    transparency: 12
                },
                line: {
                    color: '000000',
                    transparency: 100
                }
            });

            cover.addText(tema.toUpperCase(), {
                x: 0.9,
                y: 2.0,
                w: 10.5,
                h: 1.4,
                fontFace: FONT_TITLE,
                fontSize: 34,
                bold: true,
                color: COLORS.text,
                margin: 0,
                valign: 'mid'
            });

            cover.addText('APRESENTAÇÃO CINEMATOGRÁFICA • JOELBOT AI', {
                x: 0.95,
                y: 3.25,
                w: 5,
                h: 0.3,
                fontFace: FONT_BODY,
                fontSize: 11,
                bold: true,
                color: COLORS.primary,
                charSpace: 1.5,
                margin: 0
            });

            cover.addText(new Date().toLocaleDateString('pt-BR'), {
                x: 0.95,
                y: 6.7,
                w: 2,
                h: 0.3,
                fontFace: FONT_BODY,
                fontSize: 10,
                color: 'FFFFFF88',
                margin: 0
            });

            // CONTENT
            const sections = splitContent(conteudoBruto);

            sections.forEach((section, idx) => {
                const lines = section
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean);

                if (!lines.length) return;

                const title = lines[0].replace(/^#+\s*/, '').trim();
                const body = lines.slice(1);

                const slide = pres.addSlide();
                addCinematicBackground(slide);
                addHeader(slide, title, idx + 1);

                const bullets = normalizeBullets(body.filter((l) => /^[-•*]/.test(l)));

                const plainText = body
                    .filter((l) => !/^[-•*]/.test(l))
                    .join(' ')
                    .trim();

                // Quote layout
                if (plainText.length < 140 && bullets.length === 0) {
                    addQuoteSlide(slide, plainText);
                }
                // Bullet cards
                else if (bullets.length >= 2) {
                    addBulletGrid(slide, bullets);
                }
                // Editorial paragraph
                else {
                    addEditorialText(slide, plainText || body.join(' '));
                }

                // Footer branding
                slide.addText('JOELBOT AI', {
                    x: 10.8,
                    y: 6.9,
                    w: 1.5,
                    h: 0.2,
                    align: 'right',
                    fontFace: FONT_BODY,
                    fontSize: 9,
                    color: 'FFFFFF55',
                    bold: true,
                    margin: 0
                });
            });

            // FINAL SLIDE
            const finalSlide = pres.addSlide();
            addCinematicBackground(finalSlide);

            finalSlide.addText('FIM DA APRESENTAÇÃO', {
                x: 1,
                y: 2.1,
                w: 11,
                h: 0.8,
                align: 'center',
                fontFace: FONT_TITLE,
                fontSize: 32,
                bold: true,
                color: COLORS.text,
                margin: 0
            });

            finalSlide.addText('Obrigado.', {
                x: 1,
                y: 3.1,
                w: 11,
                h: 0.5,
                align: 'center',
                fontFace: FONT_BODY,
                fontSize: 18,
                color: COLORS.muted,
                italic: true,
                margin: 0
            });

            finalSlide.addShape('rect', {
                x: 5.1,
                y: 4.3,
                w: 3.1,
                h: 0.08,
                fill: {
                    color: COLORS.accent
                },
                line: {
                    color: COLORS.accent,
                    transparency: 100
                }
            });

            // SAVE
            const fileName = `cinematic_presentation_${Date.now()}.pptx`;
            const filePath = path.join(process.cwd(), fileName);

            await pres.writeFile({ fileName: filePath });

            if (!fs.existsSync(filePath)) {
                throw new Error('Falha ao gerar apresentação');
            }

            addLog(`🎬 Apresentação cinematográfica criada: ${fileName}`);

            return {
                text: `🎬 Apresentação cinematográfica criada com sucesso!`,
                file: filePath,
                type: 'document'
            };
        } catch (err: any) {
            addLog(`❌ SlidesSkill erro: ${err.message}`);
            return '';
        }
    }
}
