import pptxgen from "pptxgenjs";
import fs from "fs";
import path from "path";
import { Context } from "telegraf";

// ==========================================
// INTERFACE DE COMANDO PURA DA IARA
// ==========================================
interface VisualElement {
  type: "text" | "shape" | "image" | "line";
  x: number | string; // Aceita número (ex: 1.5) ou porcentagem (ex: "10%")
  y: number | string;
  w: number | string;
  h: number | string;
  content?: string;   // Texto ou URL/Caminho da imagem
  fontSize?: number;
  fontFace?: string;
  color?: string;     // HEX (ex: "FF0000")
  fill?: string;      // HEX de preenchimento para formas
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  shapeType?: string; // Ex: "rect", "ellipse", "triangle"
}

interface DynamicSlide {
  background: string; // Cor de fundo em HEX enviada pela Iara
  elements: VisualElement[];
}

interface IaraPresentationPayload {
  topic: string;
  slides: DynamicSlide[];
}

export class SlidesSkill {
  name = "slides";
  description = "Renderizador Universal de Slides - Executa o design livre criado pela IA";

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

  // ==========================================
  // MOTOR DE RENDERIZAÇÃO ULTRA-ROBUSTO
  // ==========================================
  async execute(params: string, ctx: Context): Promise<any> {
    try {
      // Limpa possíveis blocos de marcação de código markdown que a IA possa enviar por engano
      const cleanParams = params.replace(/```json/g, "").replace(/```/g, "").trim();
      const designDoc = JSON.parse(cleanParams) as IaraPresentationPayload;

      const PptxConstructor = pptxgen as any;
      const pptx = new PptxConstructor();
      pptx.layout = "LAYOUT_WIDE"; // Padrão widescreen 16:9

      // Varre os slides criados livremente pela Iara
      designDoc.slides.forEach((slideData) => {
        const slide = pptx.addSlide();
        
        // Aplica o fundo definido pela IA
        if (slideData.background) {
          const cleanBg = slideData.background.replace("#", "").trim();
          slide.background = { color: cleanBg };
        }

        // Desenha os elementos nas posições exatas comandadas pela IA
        if (Array.isArray(slideData.elements)) {
          slideData.elements.forEach((el) => {
            
            // Força a limpeza das cores removendo a hashtag se a IA enviar
            const textColor = el.color ? el.color.replace("#", "").trim() : "000000";
            const fillColor = el.fill ? el.fill.replace("#", "").trim() : "CCCCCC";

            // 1. TEXTO PURE DESIGN
            if (el.type === "text") {
              slide.addText(this.cleanText(el.content), {
                x: el.x,
                y: el.y,
                w: el.w,
                h: el.h,
                fontSize: Number(el.fontSize) || 14,
                fontFace: el.fontFace || "Arial",
                color: textColor,
                align: el.align || "left",
                bold: !!el.bold,
                italic: !!el.italic,
                valign: "top"
              });
            } 
            
            // 2. FORMAS GEOMÉTRICAS
            else if (el.type === "shape") {
              slide.addShape((el.shapeType as any) || "rect", {
                x: el.x,
                y: el.y,
                w: el.w,
                h: el.h,
                fill: { color: fillColor },
                line: { transparency: 100 }
              });
            }

            // 3. IMAGENS DINÂMICAS
            else if (el.type === "image" && el.content) {
              slide.addImage({
                path: el.content,
                x: el.x,
                y: el.y,
                w: el.w,
                h: el.h
              });
            }

            // 4. LINHAS VECTORIAIS
            else if (el.type === "line") {
              slide.addShape("line", {
                x: el.x,
                y: el.y,
                w: el.w,
                h: el.h,
                line: { color: textColor, pt: 2 }
              });
            }
          });
        }
      });

      // Processo de Salvamento e Envio
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
        throw new Error("Erro físico de escrita do arquivo PPTX.");
      }

    } catch (error) {
      console.error("Erro Crítico de Renderização Nativa:", error);
      await ctx.reply("Erro ao processar a estrutura visual. Verifique os parâmetros geométricos enviados pela Iara.");
      return { success: false, text: "Falha catastrófica de desenho." };
    }
  }
}
