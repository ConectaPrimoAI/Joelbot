import { Context } from "telegraf";
// Importação correta e compatível com "type": "module" e o compilador do TypeScript
import pptxgen from "pptxgenjs";

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
  color?: string;     
  fill?: string;      
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  shapeType?: string; 
}

interface DynamicSlide {
  background: string; 
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
    return text.includes("slide") || text.includes("ppt") || text.includes("apresentação");
  }

  // Helper para limpar strings
  private cleanText(text: any): string {
    if (!text) return "";
    return String(text)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/\\n/g, "\n")
      .trim();
  }

  // Normaliza de forma segura as coordenadas para a biblioteca aceitar sem travar
  private formatCoord(val: any): any {
    if (val === undefined || val === null) return 1;
    if (typeof val === "string" && val.includes("%")) return val.trim();
    const num = parseFloat(val);
    return isNaN(num) ? 1 : num;
  }

  // ==========================================
  // EXECUTOR REVISADO E BLINDADO
  // ==========================================
  async execute(params: any, ctx: Context): Promise<any> {
    try {
      let designDoc: IaraPresentationPayload;

      // Extração inteligente do JSON independente de como o framework envie
      if (typeof params === "object" && params !== null) {
        designDoc = params.slides ? params : (params.args || params.input || params);
      } else if (typeof params === "string") {
        const cleanStr = params.replace(/```json/g, "").replace(/```/g, "").trim();
        designDoc = JSON.parse(cleanStr);
      } else {
        throw new Error("Formato inválido de parâmetros.");
      }

      if (!designDoc || !Array.isArray(designDoc.slides)) {
        throw new Error("Estrutura de slides ausente no payload.");
      }

      // INSTANCIAÇÃO RETIFICADA PARA EVITAR ERRO TS2351 E DAR SUPORTE A ESM
      // Acessando o construtor diretamente da propriedade default se necessário
      const PptxConstructor: any = (pptxgen as any).default || pptxgen;
      const pptx = new PptxConstructor();
      pptx.layout = "LAYOUT_WIDE"; // Força o padrão Widescreen 16:9

      // Monta os slides iterando os comandos diretos de pixel da Iara
      designDoc.slides.forEach((slideData) => {
        const slide = pptx.addSlide();
        
        // Trata cor de fundo
        if (slideData.background) {
          const bg = this.cleanText(slideData.background).replace("#", "");
          slide.background = { color: bg };
        }

        if (Array.isArray(slideData.elements)) {
          slideData.elements.forEach((el) => {
            const x = this.formatCoord(el.x);
            const y = this.formatCoord(el.y);
            const w = this.formatCoord(el.w);
            const h = this.formatCoord(el.h);

            const color = el.color ? this.cleanText(el.color).replace("#", "") : "000000";
            const fill = el.fill ? this.cleanText(el.fill).replace("#", "") : "CCCCCC";
            const fontSize = el.fontSize ? Math.max(6, Math.min(120, parseInt(el.fontSize))) : 14;

            // Desenha Texto Livre
            if (el.type === "text") {
              slide.addText(this.cleanText(el.content), {
                x, y, w, h,
                fontSize,
                fontFace: el.fontFace || "Arial",
                color,
                align: el.align || "left",
                bold: !!el.bold,
                italic: !!el.italic,
                valign: "top"
              });
            }
            // Desenha Forma Geométrica Livre
            else if (el.type === "shape") {
              slide.addShape((el.shapeType as any) || "rect", {
                x, y, w, h,
                fill: { color: fill },
                line: { transparency: 100 }
              });
            }
            // Desenha Imagem da internet
            else if (el.type === "image" && el.content) {
              try {
                slide.addImage({ path: el.content, x, y, w, h });
              } catch (e) {
                console.error("Erro ao plotar imagem:", e);
              }
            }
            // Desenha Linha de vetor
            else if (el.type === "line") {
              slide.addShape("line", { x, y, w, h, line: { color, pt: 2 } });
            }
          });
        }
      });

      // SALVAMENTO EM MEMÓRIA (Evita erros de gravação física no Render / Servidores)
      const buffer = await pptx.write("nodebuffer");

      // Envia o arquivo de forma direta pelo stream de dados binários do Telegram
      await ctx.replyWithDocument({
        source: buffer as Buffer,
        filename: `apresentacao_iara_${Date.now()}.pptx`
      });

      return { success: true, text: "Apresentação renderizada com sucesso do absoluto zero." };

    } catch (error) {
      console.error("CRITICAL DESIGN ERROR:", error);
      await ctx.reply("Houve um erro no processamento visual ou na estrutura dos elementos fornecidos.");
      return { success: false, text: "Abortado." };
    }
  }
}