import pptxgen from "pptxgenjs";
import fs from "fs";
import path from "path";
import { Context } from "telegraf";

// ==========================================
// DEFINIÇÃO DE TIPOS E INTERFACES
// ==========================================
export type SlideSection = {
  title: string;
  content: string[];
  type?: "auto" | "intro" | "quote" | "split" | "cards" | "metric" | "timeline";
  metadata?: {
    subtitle?: string;
    quoteAuthor?: string;
    metricValue?: string;
    metricLabel?: string;
    cards?: { title: string; desc: string }[];
    timeline?: { date: string; label: string }[];
  };
};

// Interface esperada pelo payload de entrada estruturado por JSON
interface SlidesPayload {
  topic: string;
  themeName?: "netflix" | "apple" | "cyberpunk" | "editorial_nordic";
  sections: SlideSection[];
}

interface ThemeColors {
  bg: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  muted: string;
}

const THEMES: Record<string, ThemeColors> = {
  netflix: {
    bg: "0B0B0F",
    surface: "16161D",
    primary: "E50914",
    accent: "B9090B",
    text: "FFFFFF",
    muted: "B3B3B3",
  },
  apple: {
    bg: "F5F5F7",
    surface: "FFFFFF",
    primary: "0071E3",
    accent: "1D1D1F",
    text: "111111",
    muted: "6E6E73",
  },
  cyberpunk: {
    bg: "09090B",
    surface: "111827",
    primary: "00F0FF",
    accent: "FF007F",
    text: "FFFFFF",
    muted: "AAAAAA",
  },
  editorial_nordic: {
    bg: "ECEFF4",
    surface: "D8DEE9",
    primary: "5E81AC",
    accent: "81A1C1",
    text: "2E3440",
    muted: "4C566A",
  }
};

export class SlidesSkill {
  name = "slides";
  description = "Gerador Inteligente de Apresentações Cinemáticas Baseadas em IA";

  canHandle(input: string): boolean {
    const text = input.toLowerCase();
    return text.includes("slide") || text.includes("ppt") || text.includes("apresentação");
  }

  // ==========================================
  // MOTOR DE CLASSIFICAÇÃO SEMÂNTICA (IA)
  // ==========================================
  private detectBestLayout(section: SlideSection): Required<Pick<SlideSection, "type" | "metadata">> {
    const contentText = section.content.join(" ");
    const type = section.type && section.type !== "auto" ? section.type : "split";
    const metadata: any = section.metadata || {};

    if (section.type && section.type !== "auto") {
      return { type, metadata };
    }

    // 1. Detecção de citações
    if (contentText.includes("“") || contentText.includes('"') || (contentText.length < 90 && section.title.toLowerCase().includes("frase"))) {
      return {
        type: "quote",
        metadata: { quoteAuthor: metadata.quoteAuthor || "Autor Desconhecido" }
      };
    }

    // 2. Detecção de métricas / números grandes
    const numMatch = contentText.match(/(\d+%\s*|\d+[kKMm]?\s+)(vagas|vidas|lucro|crescimento|habitantes|mortes)/i);
    if (numMatch || metadata.metricValue) {
      return {
        type: "metric",
        metadata: {
          metricValue: metadata.metricValue || numMatch?.[1]?.trim() || "60M",
          metricLabel: metadata.metricLabel || section.title.toUpperCase()
        }
      };
    }

    // 3. Detecção de Listas e Cards
    if (section.content.length > 1 || (contentText.includes(":") && contentText.split(/[.;]|\n/).length > 2)) {
      if (!metadata.cards) {
        const rawItems = contentText.split(/[.;]|\n/).filter(t => t.trim().length > 5);
        metadata.cards = rawItems.slice(0, 3).map((item) => {
          const splitIdx = item.indexOf(":");
          return splitIdx !== -1 
            ? { title: item.substring(0, splitIdx).trim(), desc: item.substring(splitIdx + 1).trim() }
            : { title: "Destaque", desc: item.trim() };
        });
      }
      return { type: "cards", metadata };
    }

    return { type: "split", metadata };
  }

  // ==========================================
  // EXECUÇÃO DO FLUXO PRINCIPAL (Conforme Contrato da Skill)
  // ==========================================
  async execute(params: string, ctx: Context) {
    try {
      let topic = "Apresentação Inteligente";
      let themeName: keyof typeof THEMES = "netflix";
      let rawSections: SlideSection[] = [];

      // Tenta interpretar os parâmetros como JSON enviado pela IA.
      // Se falhar (for texto puro), monta uma estrutura padrão emergencial.
      try {
        const parsed = JSON.parse(params) as SlidesPayload;
        topic = parsed.topic || topic;
        themeName = parsed.themeName || themeName;
        rawSections = parsed.sections || [];
      } catch (e) {
        // Fallback: Se os parâmetros forem texto simples puro, converte em um slide básico
        topic = "Apresentação Automática";
        rawSections = [{ title: "Introdução", content: [params], type: "split" }];
      }

      const theme = THEMES[themeName] || THEMES.netflix;
      
      // SOLUÇÃO ERRO TS2351: Instanciação dinâmica ignorando tipagem restrita do módulo
      const PptxConstructor = pptxgen as any;
      const pptx = new PptxConstructor();
      pptx.layout = "LAYOUT_WIDE";

      const fontFace = themeName === "apple" ? "SF Pro Display" : "Arial Black";
      const bodyFont = "Arial";

      // =====================================
      // 1. CAPA ESTILO NETFLIX ORIGINAL
      // =====================================
      const cover = pptx.addSlide();
      cover.background = { color: theme.bg };

      cover.addText("TOP 1 EM CONTEÚDO HOJE", {
        x: 0.8, y: 1.2, w: 5, h: 0.3,
        fontFace, fontSize: 11, bold: true, color: theme.primary, characterSpacing: 2
      });

      cover.addText(topic.toUpperCase(), {
        x: 0.8, y: 1.6, w: 11.5, h: 2.2,
        fontFace, fontSize: 44, bold: true, color: theme.text
      });

      cover.addShape("rect", {
        x: 0.8, y: 4.2, w: 2.5, h: 0.4,
        fill: { color: theme.primary }, line: { transparency: 100 }
      });
      cover.addText("► ASSISTIR AGORA", {
        x: 0.9, y: 4.25, w: 2.3, h: 0.3,
        fontFace, fontSize: 10, bold: true, color: "FFFFFF", align: "center"
      });

      cover.addText("SÉRIE ORIGINAL • TEMPORADA 1", {
        x: 3.6, y: 4.25, w: 5, h: 0.3,
        fontFace: bodyFont, fontSize: 11, bold: true, color: theme.muted
      });

      // =====================================
      // 2. PROCESSAMENTO INTELIGENTE DOS SLIDES
      // =====================================
      rawSections.forEach((rawSection, index) => {
        const slide = pptx.addSlide();
        slide.background = { color: theme.bg };

        slide.addText(`CAPÍTULO ${index + 1}`, {
          x: 0.8, y: 0.5, w: 3, h: 0.2,
          fontFace, fontSize: 10, color: theme.primary, characterSpacing: 3
        });

        const { type, metadata } = this.detectBestLayout(rawSection);

        // -------------------------------------
        // LAYOUT A: SPLIT
        // -------------------------------------
        if (type === "split") {
          slide.addText(rawSection.title.toUpperCase(), {
            x: 0.8, y: 0.9, w: 5.0, h: 2.5,
            fontFace, fontSize: 32, bold: true, color: theme.text, lineSpacing: 36
          });

          slide.addShape("rect", {
            x: 6.4, y: 1.2, w: 0.05, h: 4.5,
            fill: { color: theme.primary }, line: { transparency: 100 }
          });

          slide.addText(rawSection.content.join("\n\n"), {
            x: 6.8, y: 1.1, w: 5.7, h: 4.8,
            fontFace: bodyFont, fontSize: 16, color: theme.muted, lineSpacing: 26
          });
        }

        // -------------------------------------
        // LAYOUT B: METRIC
        // -------------------------------------
        else if (type === "metric") {
          slide.addText(metadata.metricValue, {
            x: 0.8, y: 1.5, w: 11.5, h: 2.0,
            fontFace, fontSize: 110, bold: true, color: theme.primary
          });

          slide.addText(metadata.metricLabel, {
            x: 0.9, y: 3.7, w: 11.0, h: 0.5,
            fontFace, fontSize: 18, bold: true, color: theme.text, characterSpacing: 1
          });

          slide.addText(rawSection.content[0], {
            x: 0.9, y: 4.4, w: 9.0, h: 1.8,
            fontFace: bodyFont, fontSize: 16, color: theme.muted, lineSpacing: 24
          });
        }

        // -------------------------------------
        // LAYOUT C: CARDS
        // -------------------------------------
        else if (type === "cards" && metadata.cards) {
          slide.addText(rawSection.title.toUpperCase(), {
            x: 0.8, y: 0.9, w: 11.5, h: 0.6,
            fontFace, fontSize: 24, bold: true, color: theme.text
          });

          const cardCount = Math.min(metadata.cards.length, 3);
          const totalWidth = 11.73; 
          const gap = 0.4;
          const cardW = (totalWidth - (gap * (cardCount - 1))) / cardCount;

          metadata.cards.forEach((card: any, i: number) => {
            const cardX = 0.8 + i * (cardW + gap);

            slide.addShape("rect", {
              x: cardX, y: 2.0, w: cardW, h: 4.2,
              fill: { color: theme.surface }, line: { transparency: 100 }
            });

            slide.addShape("rect", {
              x: cardX, y: 2.0, w: cardW, h: 0.08,
              fill: { color: i === 0 ? theme.primary : theme.muted }, line: { transparency: 100 }
            });

            slide.addText(card.title.toUpperCase(), {
              x: cardX + 0.3, y: 2.4, w: cardW - 0.6, h: 0.5,
              fontFace, fontSize: 14, bold: true, color: theme.text
            });

            slide.addText(card.desc, {
              x: cardX + 0.3, y: 3.1, w: cardW - 0.6, h: 2.8,
              fontFace: bodyFont, fontSize: 13, color: theme.muted, lineSpacing: 20
            });
          });
        }

        // -------------------------------------
        // LAYOUT D: QUOTE
        // -------------------------------------
        else if (type === "quote") {
          slide.addText("“", {
            x: 0.8, y: 1.0, w: 2.0, h: 1.5,
            fontFace, fontSize: 140, bold: true, color: theme.primary, transparency: 60
          });

          slide.addText(rawSection.content[0], {
            x: 1.2, y: 2.5, w: 10.5, h: 2.5,
            fontFace: bodyFont, fontSize: 26, italic: true, color: theme.text, lineSpacing: 40
          });

          slide.addText(`—  ${metadata.quoteAuthor || rawSection.title}`, {
            x: 1.2, y: 5.4, w: 8.0, h: 0.4,
            fontFace, fontSize: 14, bold: true, color: theme.primary, characterSpacing: 1
          });
        }

        slide.addText(String(index + 1).padStart(2, "0"), {
          x: 12.0, y: 6.8, w: 0.5, h: 0.3,
          fontFace, fontSize: 10, color: theme.muted, align: "right"
        });
      });

      // =====================================
      // 3. SLIDE FINAL
      // =====================================
      const end = pptx.addSlide();
      end.background = { color: theme.bg };

      end.addText("FIM DA APRESENTAÇÃO", {
        x: 1, y: 3.0, w: 11.33, h: 0.4,
        align: "center", fontFace, fontSize: 12, bold: true, color: theme.primary, characterSpacing: 4
      });

      end.addText("N", {
        x: 1, y: 3.6, w: 11.33, h: 1.2,
        align: "center", fontFace, fontSize: 54, bold: true, color: theme.primary
      });

      // =====================================
      // SALVAMENTO E ENVIO
      // =====================================
      const fileName = `apresentacao_${Date.now()}.pptx`;
      const filePath = path.join(process.cwd(), fileName);

      await pptx.writeFile({ fileName: filePath });

      if (fs.existsSync(filePath)) {
        await ctx.replyWithDocument({
          source: fs.createReadStream(filePath),
          filename: fileName,
        });
        fs.unlinkSync(filePath);
        return { success: true, message: "Slides gerados e enviados com sucesso!" };
      } else {
        throw new Error("Falha física na escrita do arquivo PPTX.");
      }

    } catch (error) {
      console.error("Erro crítico no motor de slides:", error);
      await ctx.reply("Erro interno ao sintetizar e estilizar os slides.");
      return { success: false, error };
    }
  }
}
