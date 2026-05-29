import pptxgen from "pptxgenjs";
import fs from "fs";
import path from "path";
import { Context } from "telegraf";

/**
 * INTERFACE DE COMANDO VISUAL (O que a Iara envia)
 * A Iara agora tem controle TOTAL sobre cada objeto no slide.
 */
interface VisualElement {
  type: "text" | "shape" | "image" | "line";
  x: number; // Coordenada X (em polegadas ou porcentagem se configurado)
  y: number; // Coordenada Y
  w: number; // Largura
  h: number; // Altura
  content?: string;   // Texto ou URL da imagem
  fontSize?: number;
  fontFace?: string;
  color?: string;     // HEX
  fill?: string;      // HEX para formas
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  shapeType?: string; // "rect", "ellipse", "triangle", etc.
}

interface DynamicSlide {
  background: string; // HEX decidido pela Iara
  elements: VisualElement[];
}

interface IaraPresentation {
  topic: string;
  slides: DynamicSlide[];
}

export class SlidesSkill {
  name = "slides";
  description = "Renderizador Universal de Slides - Executa o design criado pela Iara do zero.";

  canHandle(input: string): boolean {
    const text = input.toLowerCase();
    return text.includes("slide") || text.includes("ppt") || text.includes("apresentação");
  }

  /**
   * O Executor: Ele apenas recebe as instruções de design da Iara e "desenha" no arquivo.
   */
  async execute(params: string, ctx: Context): Promise<any> {
    try {
      // 1. Recebe o Design da Iara (JSON)
      const cleanParams = params.replace(/```json/g, "").replace(/```/g, "").trim();
      const designDoc = JSON.parse(cleanParams) as IaraPresentation;

      // 2. Inicializa o papel em branco
      const PptxConstructor = pptxgen as any;
      const pptx = new PptxConstructor();
      pptx.layout = "LAYOUT_WIDE"; // 16:9 Cinema

      // 3. Iara comanda a criação de cada slide
      designDoc.slides.forEach((slideInstructions) => {
        const slide = pptx.addSlide();
        
        // Define o fundo que a Iara escolheu
        slide.background = { color: slideInstructions.background };

        // Adiciona cada elemento visual que a Iara desenhou
        slideInstructions.elements.forEach((el) => {
          
          if (el.type === "text") {
            slide.addText(el.content || "", {
              x: el.x, y: el.y, w: el.w, h: el.h,
              fontSize: el.fontSize || 18,
              fontFace: el.fontFace || "Arial",
              color: el.color || "000000",
              align: el.align || "left",
              bold: el.bold || false,
              italic: el.italic || false,
              valign: "middle"
            });
          } 
          
          else if (el.type === "shape") {
            slide.addShape((el.shapeType as any) || "rect", {
              x: el.x, y: el.y, w: el.w, h: el.h,
              fill: { color: el.fill || "CCCCCC" },
              line: { transparency: 100 }
            });
          }

          else if (el.type === "image") {
            slide.addImage({
              path: el.content || "",
              x: el.x, y: el.y, w: el.w, h: el.h
            });
          }

          else if (el.type === "line") {
            slide.addShape("line", {
              x: el.x, y: el.y, w: el.w, h: el.h,
              line: { color: el.color || "000000", pt: 2 }
            });
          }
        });
      });

      // 4. Salva o resultado final do design da Iara
      const fileName = `apresentacao_iara_${Date.now()}.pptx`;
      const filePath = path.join(process.cwd(), fileName);

      await pptx.writeFile({ fileName: filePath });

      if (fs.existsSync(filePath)) {
        await ctx.replyWithDocument({
          source: fs.createReadStream(filePath),
          filename: fileName,
        });
        fs.unlinkSync(filePath);
        return { success: true, text: "O design da Iara foi renderizado e enviado." };
      }

    } catch (error) {
      console.error("Erro no Renderizador:", error);
      // Fallback básico se a Iara não mandar um JSON perfeito
      await ctx.reply("Iara, o design enviado tem um erro de sintaxe. Por favor, revise o JSON de renderização.");
    }
  }
}
