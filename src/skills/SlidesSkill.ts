import pptxgen from "pptxgenjs";
import fs from "fs";
import path from "path";
import { Context } from "telegraf";

// ==========================================
// INTERFACES DE DESIGN ABSOLUTO DA IA
// ==========================================
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
  description = "Renderizador à Prova de Falhas de Layouts Gerados pela IA do Absoluto Zero";

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

  /**
   * RECURSO DE BLINDAGEM: Garante que os parâmetros geométricos sejam válidos e aceitos nativamente
   */
  private parseCoordinate(val: number | string, defaultValue: number, maxLimit: number): number | string {
    if (typeof val === "string") {
      if (val.includes("%")) {
        return val.trim(); // Se a Iara usar porcentagem nativa (ex: "50%"), passa direto
      }
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

  // ==========================================
  // MOTOR DE RENDERIZAÇÃO BLINDADO
  // ==========================================
  async execute(params: string, ctx: Context): Promise<any> {
    try {
      const cleanParams = params.replace(/```json/g, "").replace(/```/g, "").trim();
      const designDoc = JSON.parse(cleanParams) as IaraPresentationPayload;

      const PptxConstructor = pptxgen as any;
      const pptx = new PptxConstructor();
      pptx.layout = "LAYOUT_WIDE"; // 16:9 Widescreen (13.33 x 7.5 polegadas)

      if (!designDoc.slides || !Array.isArray(designDoc.slides)) {
        throw new Error("Payload de apresentação inválido ou sem array de slides.");
      }

      designDoc.slides.forEach((slideData) => {
        const slide = pptx.addSlide();
        
        if (slideData.background) {
          const cleanBg = slideData.background.replace("#", "").trim();
          slide.background = { color: cleanBg };
        }

        if (Array.isArray(slideData.elements)) {
          slideData.elements.forEach((el) => {
            
            // Tratamento e blindagem de coordenadas geométricas individuais contra erros de parsing
            const elX = this.parseCoordinate(el.x, 0.5, 13.33);
            const elY = this.parseCoordinate(el.y, 0.5, 7.5);
            const elW = this.parseCoordinate(el.w, 3.0, 13.33);
            const elH = this.parseCoordinate(el.h, 1.0, 7.5);

            const textColor = el.color ? el.color.replace("#", "").trim() : "000000";
            const fillColor = el.fill ? el.fill.replace("#", "").trim() : "CCCCCC";
            const fSize = el.fontSize ? Math.max(6, Math.min(140, Number(el.fontSize))) : 14;

            // 1. TEXTO DESENHADO LIVREMENTE
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
            
            // 2. FORMAS GEOMÉTRICAS DO ZERO
            else if (el.type === "shape") {
              slide.addShape((el.shapeType as any) || "rect", {
                x: elX, y: elY, w: elW, h: elH,
                fill: { color: fillColor },
                line: { transparency: 100 }
              });
            }

            // 3. IMAGENS OU ÍCONES DO CONTEXTO
            else if (el.type === "image" && el.content) {
              try {
                slide.addImage({
                  path: el.content,
                  x: elX, y: elY, w: elW, h: elH
                });
              } catch (imgErr) {
                console.error("Link de imagem inválido enviado pela Iara:", imgErr);
              }
            }

            // 4. LINHAS DE DIVISÃO ARTÍSTICAS
            else if (el.type === "line") {
              slide.addShape("line", {
                x: elX, y: elY, w: elW, h: elH,
                line: { color: textColor, pt: 2 }
              });
            }
          });
        }
      });

      const fileName = `apresentacao_${Date.now()}.pptx`;
      const filePath = path.join(process.cwd(), fileName);

      await pptx.writeFile({ fileName: filePath });

      if (fs.existsSync(filePath)) {
        await ctx.replyWithDocument({
          source: fs.createReadStream(filePath),
          filename: fileName,
        });
        fs.unlinkSync(filePath);
        return { success: true, text: "Apresentação renderizada com sucesso." };
      } else {
        throw new Error("Erro de escrita do arquivo PPTX.");
      }

    } catch (error) {
      console.error("Erro Crítico de Renderização:", error);
      await ctx.reply("Houve uma falha crítica ao processar os dados do JSON. Verifique a formatação.");
      return { success: false, text: "Falha de desenho." };
    }
  }
}
