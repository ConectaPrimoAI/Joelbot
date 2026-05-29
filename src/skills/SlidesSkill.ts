import pptxgen from "pptxgenjs";
import fs from "fs";
import path from "path";
import { Context } from "telegraf";

// ==========================================
// CONFIGURAÇÕES GRANULARES ENVIADAS PELA IA
// ==========================================
interface VisualElement {
  type: "text" | "shape" | "image" | "line";
  x: number;          // Posição horizontal na tela (em polegadas)
  y: number;          // Posição vertical na tela (em polegadas)
  w: number;          // Largura do elemento (em polegadas)
  h: number;          // Altura do elemento (em polegadas)
  content?: string;   // O texto a ser escrito ou a URL/Caminho da imagem
  fontSize?: number;  // Tamanho da fonte definido pela IA
  fontFace?: string;  // Nome da fonte (Ex: Arial, Impact, Georgia, Comic Sans)
  color?: string;     // Cor do texto em formato HEX (Ex: "FFFFFF")
  fill?: string;      // Cor de preenchimento da forma em formato HEX
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  shapeType?: string; // Tipo da forma (Ex: "rect", "ellipse", "triangle")
}

interface DynamicSlide {
  background: string; // Cor de fundo do slide em HEX definida pela IA
  elements: VisualElement[];
}

interface IaraPresentationPayload {
  topic: string;
  slides: DynamicSlide[];
}

export class SlidesSkill {
  name = "slides";
  description = "Renderizador Universal de Slides - Cria a apresentação do zero conforme o design da IA";

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
  // MOTOR DE RENDERIZAÇÃO EM BRANCO
  // ==========================================
  async execute(params: string, ctx: Context): Promise<any> {
    try {
      // Limpa possíveis marcações de blocos de código que a IA possa enviar na string
      const cleanParams = params.replace(/```json/g, "").replace(/```/g, "").trim();
      const designDoc = JSON.parse(cleanParams) as IaraPresentationPayload;

      // Inicializa o PowerPoint em branco no formato Widescreen (16:9)
      const PptxConstructor = pptxgen as any;
      const pptx = new PptxConstructor();
      pptx.layout = "LAYOUT_WIDE";

      // Percorre os slides gerados pela IA
      designDoc.slides.forEach((slideData) => {
        const slide = pptx.addSlide();
        
        // Aplica a cor de fundo que a IA escolheu para este slide
        if (slideData.background) {
          slide.background = { color: slideData.background.replace("#", "") };
        }

        // Desenha individualmente cada elemento posicionado pela IA
        slideData.elements.forEach((el) => {
          const elX = el.x;
          const elY = el.y;
          const elW = el.w;
          const elH = el.h;

          // 1. Renderização de Texto Próprio
          if (el.type === "text") {
            slide.addText(this.cleanText(el.content), {
              x: elX, y: elY, w: elW, h: elH,
              fontSize: el.fontSize || 14,
              fontFace: el.fontFace || "Arial",
              color: el.color ? el.color.replace("#", "") : "000000",
              align: el.align || "left",
              bold: el.bold || false,
              italic: el.italic || false,
              valign: "top"
            });
          } 
          
          // 2. Renderização de Formas Geométricas Customizadas
          else if (el.type === "shape") {
            slide.addShape((el.shapeType as any) || "rect", {
              x: elX, y: elY, w: elW, h: elH,
              fill: { color: el.fill ? el.fill.replace("#", "") : "CCCCCC" },
              line: { transparency: 100 }
            });
          }

          // 3. Renderização de Imagens Dinâmicas
          else if (el.type === "image" && el.content) {
            slide.addImage({
              path: el.content,
              x: elX, y: elY, w: elW, h: elH
            });
          }

          // 4. Renderização de Linhas de Separação Estilizadas
          else if (el.type === "line") {
            slide.addShape("line", {
              x: elX, y: elY, w: elW, h: elH,
              line: { color: el.color ? el.color.replace("#", "") : "000000", pt: 2 }
            });
          }
        });
      });

      // Salva o arquivo gerado
      const fileName = `apresentacao_${Date.now()}.pptx`;
      const filePath = path.join(process.cwd(), fileName);

      await pptx.writeFile({ fileName: filePath });

      if (fs.existsSync(filePath)) {
        await ctx.replyWithDocument({
          source: fs.createReadStream(filePath),
          filename: fileName,
        });
        fs.unlinkSync(filePath);
        return { success: true, text: "Apresentação renderizada a partir do design customizado da IA." };
      } else {
        throw new Error("Erro na gravação física do arquivo PPTX.");
      }

    } catch (error) {
      console.error("Erro no motor de renderização puro:", error);
      await ctx.reply("Houve um problema de sintaxe ao desenhar os elementos deste slide.");
      return { success: false, text: "Erro ao processar estrutura visual." };
    }
  }
}
