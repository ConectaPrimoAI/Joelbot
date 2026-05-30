import { Context } from "telegraf";
import { createRequire } from "module";

// pptxgenjs não tem export ESM estável; createRequire é a solução correta
// para projetos com "type": "module" no package.json
const require = createRequire(import.meta.url);
const PptxGenJS = require("pptxgenjs");

// ==========================================
// ESTRUTURA DE REALIDADE DA IARA (DADOS PUROS)
// ==========================================
interface VisualElement {
  type: "text" | "shape" | "image" | "line";
  x: any;
  y: any;
  w: any;
  h: any;
  content?: string;
  fontSize?: any;
  fontFace?: string;
  color?: string;    // hex sem "#", ex: "FF0000"
  fill?: string;     // hex sem "#", ex: "CCCCCC"
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  // "rect" | "oval" | "rounded_rect" — mapeado internamente para pres.shapes.*
  shapeType?: string;
}

interface DynamicSlide {
  background: string; // hex sem "#"
  elements: VisualElement[];
}

interface IaraPresentationPayload {
  topic: string;
  slides: DynamicSlide[];
}

export class SlidesSkill {
  name = "slides";
  description = "Renderizador À Prova de Falhas de Slides Criados do Zero Pela IA";

  canHandle(input: string): boolean {
    const text = input.toLowerCase();
    return (
      text.includes("slide") ||
      text.includes("ppt") ||
      text.includes("apresentação")
    );
  }

  // Remove # e caracteres de controle; garante string limpa para hex
  private cleanHex(val: any): string {
    if (!val) return "";
    return String(val)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/#/g, "")
      .trim();
  }

  // Limpa texto livre (conteúdo de texto nos slides)
  private cleanText(text: any): string {
    if (!text) return "";
    return String(text)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/\\n/g, "\n")
      .trim();
  }

  // Normaliza coordenadas — aceita percentuais ("50%") ou números
  private formatCoord(val: any): any {
    if (val === undefined || val === null) return 1;
    if (typeof val === "string" && val.includes("%")) return val.trim();
    const num = parseFloat(String(val));
    return isNaN(num) ? 1 : num;
  }

  // Mapeia shapeType string da IA para a constante correta do pptxgenjs
  private resolveShapeType(pres: any, shapeType?: string): any {
    const map: Record<string, any> = {
      rect:            pres.shapes.RECTANGLE,
      rectangle:       pres.shapes.RECTANGLE,
      oval:            pres.shapes.OVAL,
      circle:          pres.shapes.OVAL,
      ellipse:         pres.shapes.OVAL,
      rounded_rect:    pres.shapes.ROUNDED_RECTANGLE,
      rounded:         pres.shapes.ROUNDED_RECTANGLE,
      roundedrectangle:pres.shapes.ROUNDED_RECTANGLE,
    };
    const key = (shapeType || "rect").toLowerCase().replace(/[^a-z_]/g, "");
    return map[key] ?? pres.shapes.RECTANGLE;
  }

  // ==========================================
  // EXECUTOR REVISADO E BLINDADO
  // ==========================================
  async execute(params: any, ctx: Context): Promise<any> {
    try {
      let designDoc: IaraPresentationPayload;

      // Extração inteligente do JSON — independente de como o framework envie
      if (typeof params === "object" && params !== null) {
        designDoc = params.slides
          ? params
          : params.args ?? params.input ?? params;
      } else if (typeof params === "string") {
        const cleanStr = params
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        designDoc = JSON.parse(cleanStr);
      } else {
        throw new Error("Formato inválido de parâmetros.");
      }

      if (!designDoc || !Array.isArray(designDoc.slides)) {
        throw new Error("Estrutura de slides ausente no payload.");
      }

      // ---------------------------------------------------
      // INSTANCIAÇÃO CORRETA — funciona com CJS e ESM/TS
      // ---------------------------------------------------
      const pres = new PptxGenJS();
      pres.layout = "LAYOUT_WIDE"; // 13.3" × 7.5" — Widescreen 16:9

      // Constrói os slides a partir dos comandos visuais da IA
      for (const slideData of designDoc.slides) {
        const slide = pres.addSlide();

        // Cor de fundo
        if (slideData.background) {
          const bgColor = this.cleanHex(slideData.background);
          if (bgColor) {
            slide.background = { color: bgColor };
          }
        }

        if (!Array.isArray(slideData.elements)) continue;

        for (const el of slideData.elements) {
          const x = this.formatCoord(el.x);
          const y = this.formatCoord(el.y);
          const w = this.formatCoord(el.w);
          const h = this.formatCoord(el.h);

          // Cores sempre sem "#" — obrigatório no pptxgenjs
          const color = el.color ? this.cleanHex(el.color) : "000000";
          const fill  = el.fill  ? this.cleanHex(el.fill)  : "CCCCCC";
          const fontSize = el.fontSize
            ? Math.max(6, Math.min(120, parseInt(String(el.fontSize), 10)))
            : 14;

          // ── TEXTO ──────────────────────────────────────────
          if (el.type === "text") {
            slide.addText(this.cleanText(el.content), {
              x,
              y,
              w,
              h,
              fontSize,
              fontFace: el.fontFace || "Calibri",
              color,
              align:  el.align  || "left",
              bold:   !!el.bold,
              italic: !!el.italic,
              valign: "top",
            });
          }

          // ── FORMA GEOMÉTRICA ───────────────────────────────
          else if (el.type === "shape") {
            const shapeConst = this.resolveShapeType(pres, el.shapeType);
            slide.addShape(shapeConst, {
              x,
              y,
              w,
              h,
              fill: { color: fill },
              // Sem borda: não passamos "line" — evita crash com transparency:100
            });
          }

          // ── IMAGEM (URL ou base64) ─────────────────────────
          else if (el.type === "image" && el.content) {
            try {
              const content = this.cleanText(el.content);
              // Detecta base64 ou URL
              if (content.startsWith("data:") || content.startsWith("image/")) {
                slide.addImage({ data: content, x, y, w, h });
              } else {
                slide.addImage({ path: content, x, y, w, h });
              }
            } catch (imgErr) {
              console.error("[SlidesSkill] Erro ao plotar imagem:", imgErr);
            }
          }

          // ── LINHA VETORIAL ─────────────────────────────────
          else if (el.type === "line") {
            slide.addShape(pres.shapes.LINE, {
              x,
              y,
              w,
              h: 0, // linhas sempre h=0 no pptxgenjs
              line: { color, pt: 2 },
            });
          }
        }
      }

      // ---------------------------------------------------
      // EXPORTAÇÃO EM MEMÓRIA — sem escrita em disco
      // API correta: write({ outputType: "nodebuffer" })
      // ---------------------------------------------------
      const buffer: Buffer = await pres.write({ outputType: "nodebuffer" });

      // Envia o arquivo pelo Telegram
      await ctx.replyWithDocument({
        source: buffer,
        filename: `apresentacao_iara_${Date.now()}.pptx`,
      });

      return {
        success: true,
        text: "Apresentação renderizada com sucesso do absoluto zero.",
      };
    } catch (error: any) {
      // Log detalhado para facilitar debug
      console.error("[SlidesSkill] CRITICAL DESIGN ERROR:", error?.message ?? error);
      console.error("[SlidesSkill] Stack:", error?.stack);
      await ctx.reply(
        `Erro ao gerar a apresentação: ${error?.message ?? "erro desconhecido"}. Verifique o console para detalhes.`
      );
      return { success: false, text: "Abortado." };
    }
  }
}
