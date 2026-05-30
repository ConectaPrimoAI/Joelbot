import pptxgen from "pptxgenjs";
import fs from "fs";
import path from "path";
import { Context } from "telegraf";

interface VisualElement {
  type: "text" | "shape" | "image" | "line";
  x: number | string; 
  y: number | string;
  w: number | string;
  h: number | string;
  content?: string;   
  fontSize?: number | string;
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
  description = "Renderizador à Prova de Falhas Total de Apresentações Criadas do Zero pela IA";

  canHandle(input: string): boolean {
    const text = input.toLowerCase();
    return text.includes("slide") || text.includes("ppt") || text.includes("apresentação");
  }

  private cleanText(text: string | undefined): string {
    if (!text) return "";
    return text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/\\n/g, "\n")
      .trim();
  }

  private parseCoordinate(val: number | string, defaultValue: number, maxLimit: number): number | string {
    if (typeof val === "string") {
      if (val.includes("%")) return val.trim();
      const parsed = parseFloat(val);
      if (isNaN(parsed)) return defaultValue;
      return parsed > maxLimit ? maxLimit : parsed;
    }
    if (typeof val === "number") {
      if (isNaN(val)) return defaultValue;
      return val > maxLimit ? maxLimit : val;
    }
    return defaultValue;
  }

  // =================================================================
  // EXECUTOR MULTI-FORMATO (PREVINE ERROS DE SINTAXE DO BOT)
  // =================================================================
  async execute(params: any, ctx: Context): Promise<any> {
    try {
      let designDoc: IaraPresentationPayload;

      // SEFA-1: Se o framework do bot já passar os parâmetros como Objeto Javascript
      if (typeof params === "object" && params !== null) {
        // Se o objeto real estiver envelopado em uma propriedade comum de agents (como args ou input)
        if (params.slides) {
          designDoc = params as IaraPresentationPayload;
        } else if (params.args && typeof params.args === "object" && params.args.slides) {
          designDoc = params.args as IaraPresentationPayload;
        } else if (params.input && typeof params.input === "string") {
          const clean = params.input.replace(/```json/g, "").replace(/```/g, "").trim();
          designDoc = JSON.parse(clean);
        } else {
          // Tenta ler o primeiro campo que encontrar ou stringifica para tentar o parser manual
          const strParams = JSON.stringify(params);
          designDoc = JSON.parse(strParams);
        }
      } 
      // SEFA-2: Se vier como String bruta do LLM
      else if (typeof params === "string") {
        const cleanParams = params.replace(/```json/g, "").replace(/```/g, "").trim();
        designDoc = JSON.parse(cleanParams) as IaraPresentationPayload;
      } else {
        throw new Error("Formato de parâmetro completamente desconhecido.");
      }

      // Validação básica do documento decodificado
      if (!designDoc || !designDoc.slides || !Array.isArray(designDoc.slides)) {
        console.log("Conteúdo recebido mal estruturado:", designDoc);
        throw new Error("O JSON decodificado não possui a estrutura de slides necessária.");
      }

      // Inicialização da API nativa de desenho
      const PptxConstructor = pptxgen as any;
      const pptx = new PptxConstructor();
      pptx.layout = "LAYOUT_WIDE"; // Proporção 16:9

      // Varre e executa o design livre ordenado pela IA
      designDoc.slides.forEach((slideData) => {
        const slide = pptx.addSlide();
        
        if (slideData.background) {
          slide.background = { color: slideData.background.replace("#", "").trim() };
        }

        if (Array.isArray(slideData.elements)) {
          slideData.elements.forEach((el) => {
            const elX = this.parseCoordinate(el.x, 0.5, 13.33);
            const elY = this.parseCoordinate(el.y, 0.5, 7.5);
            const elW = this.parseCoordinate(el.w, 3.0, 13.33);
            const elH = this.parseCoordinate(el.h, 1.0, 7.5);

            const textColor = el.color ? el.color.replace("#", "").trim() : "000000";
            const fillColor = el.fill ? el.fill.replace("#", "").trim() : "CCCCCC";
            const fSize = el.fontSize ? Math.max(6, Math.min(140, Number(el.fontSize))) : 14;

            if (el.type === "text") {
              slide.addText(this.cleanText(el.content), {
                x: elX, y: elY, w: elW, h: elH,
                fontSize: fSize,
                fontFace: el.fontFace || "Arial",
                color: textColor,
                align: el.align || "left",
                bold: !!el.bold,
                italic: !!el.italic,
                valign: "top"
              });
            } 
            else if (el.type === "shape") {
              slide.addShape((el.shapeType as any) || "rect", {
                x: elX, y: elY, w: elW, h: elH,
                fill: { color: fillColor },
                line: { transparency: 100 }
              });
            }
            else if (el.type === "image" && el.content) {
              try {
                slide.addImage({ path: el.content, x: elX, y: elY, w: elW, h: elH });
              } catch (e) {}
            }
            else if (el.type === "line") {
              slide.addShape("line", {
                x: elX, y: elY, w: elW, h: elH,
                line: { color: textColor, pt: 2 }
              });
            }
          });
        }
      });

      // Geração física do arquivo final do desenho
      const fileName = `apresentacao_${Date.now()}.pptx`;
      const filePath = path.join(process.cwd(), fileName);

      await pptx.writeFile({ fileName: filePath });

      if (fs.existsSync(filePath)) {
        await ctx.replyWithDocument({
          source: fs.createReadStream(filePath),
          filename: fileName,
        });
        fs.unlinkSync(filePath);
        return { success: true, text: "Apresentação renderizada com sucesso do zero." };
      } else {
        throw new Error("Falha ao gravar arquivo físico.");
      }

    } catch (error) {
      console.error("DEBUG INTERNO DO MOTOR DE DESIGN:", error);
      await ctx.reply("Houve um problema de dessincronização de dados na chamada da ferramenta de slides. Tentando reajustar...");
      return { success: false, text: "Falha de desenho." };
    }
  }
}
