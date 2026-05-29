import pptxgen from "pptxgenjs";
import fs from "fs";
import path from "path";
import { Context } from "telegraf";

// ==========================================
// INTERFACES DO PAYLOAD DINÂMICO DA IA
// ==========================================

// Cada slide agora é um objeto perfeitamente planejado pela IA
export interface DynamicSlide {
  title: string;
  layoutType: "title_cover" | "split_editorial" | "big_metric" | "cards_grid" | "impact_quote" | "full_text_center";
  
  // Elementos de conteúdo (A IA envia o texto já digerido, sem blocões longos)
  contentBody?: string; 
  subtitle?: string;
  
  // Metadados opcionais específicos para layouts complexos
  metadata?: {
    quoteAuthor?: string;
    metricValue?: string;
    metricLabel?: string;
    cards?: { cardTitle: string; cardDesc: string }[];
  };
}

// O Payload mestre que a IA deve gerar para a Skill
export interface DynamicPresentationPayload {
  topic: string;
  presentationSettings: {
    // A IA define a paleta perfeitamente baseada no tema (Ex: Amarelo/Marrom/Azul para Bob Esponja)
    backgroundColor: string;    // Ex: "FFF01F"
    surfaceColor: string;       // Ex: "FFFFFF"
    primaryColor: string;       // Ex: "00A6FF"
    accentColor: string;        // Ex: "8B4513"
    textColor: string;          // Ex: "111111"
    mutedColor: string;         // Ex: "555555"
    fontHeading: string;        // Ex: "Impact" ou "Arial Black"
    fontBody: string;           // Ex: "Arial" ou "Comic Sans MS"
  };
  slides: DynamicSlide[];
}

export class SlidesSkill {
  name = "slides";
  description = "Engine Generativa de Apresentações Dinâmicas de Alto Nível de Design";

  canHandle(input: string): boolean {
    const text = input.toLowerCase();
    return text.includes("slide") || text.includes("ppt") || text.includes("apresentação");
  }

  /**
   * Remove caracteres estranhos de codificação/parsing que quebram o layout do PowerPoint
   */
  private cleanText(text: string | undefined): string {
    if (!text) return "";
    return text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove caracteres de controle ASCII perigosos
      .replace(/\\n/g, "\n")
      .trim();
  }

  // ==========================================
  // EXECUÇÃO DO MOTOR GERATIVO
  // ==========================================
  async execute(params: string, ctx: Context): Promise<any> {
    try {
      let payload: DynamicPresentationPayload;

      // 1. TENTATIVA DE PARSING DO JSON ENVIADO PELA IA
      try {
        // Limpa possíveis marcações de bloco markdown que a IA costuma colocar (ex: ```json ... ```)
        const cleanParams = params.replace(/```json/g, "").replace(/```/g, "").trim();
        payload = JSON.parse(cleanParams) as DynamicPresentationPayload;
      } catch (e) {
        console.error("Falha ao ler JSON gerado pela IA. Ativando parser de segurança de texto bruto.");
        // Fallback de segurança avançado se o prompt quebrar e enviar texto puro
        payload = this.generateEmergencyPayload(params);
      }

      // 2. INICIALIZAÇÃO DA BIBLIOTECA DE PPTX
      const PptxConstructor = pptxgen as any;
      const pptx = new PptxConstructor();
      
      // Define o layout moderno Widescreen (16:9) nativamente
      pptx.layout = "LAYOUT_WIDE";

      const cfg = payload.presentationSettings;
      const fontHeading = cfg.fontHeading || "Arial Black";
      const fontBody = cfg.fontBody || "Arial";

      // =================================================================
      // VARREDURA E RENDERIZAÇÃO DOS SLIDES PLANEJADOS PELA IA
      // =================================================================
      payload.slides.forEach((slideData, index) => {
        const slide = pptx.addSlide();
        
        // Define a cor de fundo escolhida pela IA para este projeto
        slide.background = { color: cfg.backgroundColor };

        // Define transição de slide elegante (Efeito de esmaecer/fade entre os slides)
        // Isso remove o aspecto estático bruto do PPT padrão
        (slide as any).slideTransition = { type: "fade", speed: "medium" };

        const titleText = this.cleanText(slideData.title);
        const bodyText = this.cleanText(slideData.contentBody);

        //--------------------------------------------------------------
        // LAYOUT 1: COVER / CAPA CINEMÁTICA PERSONALIZADA
        //--------------------------------------------------------------
        if (slideData.layoutType === "title_cover" || index === 0) {
          // Detalhe superior de design editorial
          slide.addText(payload.topic.toUpperCase(), {
            x: 0.8, y: 1.5, w: 11.5, h: 0.4,
            fontFace: fontHeading, fontSize: 12, bold: true, color: cfg.primaryColor, characterSpacing: 3
          });

          // Título principal gigante
          slide.addText(titleText, {
            x: 0.8, y: 2.0, w: 11.5, h: 2.5,
            fontFace: fontHeading, fontSize: 46, bold: true, color: cfg.textColor,
            valign: "top"
          });

          // Subtítulo descritivo ou chamada de ação abaixo do título
          const subText = slideData.subtitle || "UMA APRESENTAÇÃO EXCLUSIVA E COMPLETA";
          slide.addText(this.cleanText(subText), {
            x: 0.8, y: 4.8, w: 11.0, h: 0.8,
            fontFace: fontBody, fontSize: 14, color: cfg.mutedColor
          });

          // Forma geométrica estilizada de rodapé (Linha de destaque elegante)
          slide.addShape("rect", {
            x: 0.8, y: 5.8, w: 3.5, h: 0.06,
            fill: { color: cfg.accentColor }, line: { transparency: 100 }
          });
        }

        //--------------------------------------------------------------
        // LAYOUT 2: SPLIT EDITORIAL (Layout clássico de revista de luxo)
        //--------------------------------------------------------------
        else if (slideData.layoutType === "split_editorial") {
          // Lado esquerdo: Título marcante ocupando espaço vertical
          slide.addText(titleText, {
            x: 0.8, y: 1.2, w: 5.0, h: 4.0,
            fontFace: fontHeading, fontSize: 34, bold: true, color: cfg.textColor,
            lineSpacing: 38, valign: "top"
          });

          // Divisor vertical físico de design
          slide.addShape("rect", {
            x: 6.2, y: 1.2, w: 0.04, h: 4.8,
            fill: { color: cfg.primaryColor }, line: { transparency: 100 }
          });

          // Lado direito: Bloco de conteúdo bem distribuído e espaçado
          slide.addText(bodyText, {
            x: 6.6, y: 1.2, w: 5.9, h: 4.8,
            fontFace: fontBody, fontSize: 16, color: cfg.mutedColor,
            lineSpacing: 26, valign: "top"
          });
        }

        //--------------------------------------------------------------
        // LAYOUT 3: BIG METRIC (Foco em dados numéricos massivos)
        //--------------------------------------------------------------
        else if (slideData.layoutType === "big_metric") {
          const metricValue = slideData.metadata?.metricValue || "99+";
          const metricLabel = slideData.metadata?.metricLabel || titleText;

          // O número em escala monumental
          slide.addText(metricValue, {
            x: 0.8, y: 1.2, w: 11.5, h: 2.2,
            fontFace: fontHeading, fontSize: 120, bold: true, color: cfg.primaryColor
          });

          // Rótulo explicativo imediatamente abaixo
          slide.addText(metricLabel.toUpperCase(), {
            x: 0.9, y: 3.5, w: 11.0, h: 0.5,
            fontFace: fontHeading, fontSize: 18, bold: true, color: cfg.textColor, characterSpacing: 1
          });

          // Contexto descritivo menor
          if (bodyText) {
            slide.addText(bodyText, {
              x: 0.9, y: 4.2, w: 9.5, h: 1.8,
              fontFace: fontBody, fontSize: 15, color: cfg.mutedColor, lineSpacing: 22
            });
          }
        }

        //--------------------------------------------------------------
        // LAYOUT 4: CARDS GRID (Grade assimétrica de tópicos - Sem blocão!)
        //--------------------------------------------------------------
        else if (slideData.layoutType === "cards_grid" && slideData.metadata?.cards) {
          slide.addText(titleText, {
            x: 0.8, y: 0.8, w: 11.5, h: 0.6,
            fontFace: fontHeading, fontSize: 26, bold: true, color: cfg.textColor
          });

          const cards = slideData.metadata.cards;
          const cardCount = Math.min(cards.length, 4); // Suporta até 4 colunas perfeitamente distribuídas
          const totalWidth = 11.73; // Área de trabalho útil (13.33 - margens)
          const gap = 0.35;
          const cardW = (totalWidth - (gap * (cardCount - 1))) / cardCount;

          cards.slice(0, cardCount).forEach((card, i) => {
            const cardX = 0.8 + i * (cardW + gap);

            // Container plano de fundo do cartão para dar profundidade visual
            slide.addShape("rect", {
              x: cardX, y: 1.8, w: cardW, h: 4.4,
              fill: { color: cfg.surfaceColor }, line: { color: cfg.accentColor, pt: 0.5 }
            });

            // Mini friso decorativo colorido no topo de cada bloco
            slide.addShape("rect", {
              x: cardX, y: 1.8, w: cardW, h: 0.08,
              fill: { color: i === 0 ? cfg.primaryColor : cfg.accentColor }, line: { transparency: 100 }
            });

            // Título interno do card
            slide.addText(this.cleanText(card.cardTitle).toUpperCase(), {
              x: cardX + 0.25, y: 2.1, w: cardW - 0.5, h: 0.6,
              fontFace: fontHeading, fontSize: 14, bold: true, color: cfg.textColor,
              valign: "middle"
            });

            // Texto descritivo interno do card
            slide.addText(this.cleanText(card.cardDesc), {
              x: cardX + 0.25, y: 2.9, w: cardW - 0.5, h: 3.1,
              fontFace: fontBody, fontSize: 13, color: cfg.mutedColor,
              lineSpacing: 19, valign: "top"
            });
          });
        }

        //--------------------------------------------------------------
        // LAYOUT 5: IMPACT QUOTE (Citações artísticas destacadas)
        //--------------------------------------------------------------
        else if (slideData.layoutType === "impact_quote") {
          // Aspas artísticas transparentes gigantes servindo de background gráfico
          slide.addText("“", {
            x: 0.6, y: 0.8, w: 2.0, h: 1.8,
            fontFace: fontHeading, fontSize: 160, bold: true, color: cfg.primaryColor, transparency: 75
          });

          // Frase central de impacto em tamanho expandido
          slide.addText(bodyText || titleText, {
            x: 1.2, y: 2.4, w: 10.5, h: 2.5,
            fontFace: fontBody, fontSize: 26, italic: true, color: cfg.textColor,
            lineSpacing: 38, valign: "middle"
          });

          // Autor da citação alinhado editorialmente
          const author = slideData.metadata?.quoteAuthor || slideData.title;
          slide.addText(`—  ${this.cleanText(author).toUpperCase()}`, {
            x: 1.2, y: 5.2, w: 8.0, h: 0.4,
            fontFace: fontHeading, fontSize: 13, bold: true, color: cfg.primaryColor, characterSpacing: 1
          });
        }

        //--------------------------------------------------------------
        // LAYOUT 6: FULL TEXT CENTER (Foco centralizado minimalista)
        //--------------------------------------------------------------
        else {
          slide.addText(titleText.toUpperCase(), {
            x: 1.0, y: 1.8, w: 11.33, h: 0.6,
            align: "center", fontFace: fontHeading, fontSize: 28, bold: true, color: cfg.textColor
          });

          slide.addShape("rect", {
            x: 5.4, y: 2.7, w: 2.5, h: 0.04,
            fill: { color: cfg.primaryColor }, line: { transparency: 100 }
          });

          slide.addText(bodyText, {
            x: 1.5, y: 3.2, w: 10.33, h: 3.0,
            align: "center", fontFace: fontBody, fontSize: 18, color: cfg.mutedColor,
            lineSpacing: 28, valign: "top"
          });
        }

        // NÚMERAÇÃO CINEMÁTICA DE PÁGINAS NO RODAPÉ (Ex: 01, 02...)
        slide.addText(String(index + 1).padStart(2, "0"), {
          x: 12.0, y: 6.9, w: 0.5, h: 0.3,
          fontFace: fontHeading, fontSize: 10, color: cfg.mutedColor, align: "right"
        });
      });

      // ==========================================
      // SALVAMENTO SEGURO E ENVIO VIA STREAM
      // ==========================================
      const fileName = `apresentacao_${Date.now()}.pptx`;
      const filePath = path.join(process.cwd(), fileName);

      await pptx.writeFile({ fileName: filePath });

      if (fs.existsSync(filePath)) {
        await ctx.replyWithDocument({
          source: fs.createReadStream(filePath),
          filename: fileName,
        });
        
        // Exclusão física do arquivo local para evitar gargalo de disco no Render
        fs.unlinkSync(filePath);

        return {
          success: true,
          text: `Apresentação sobre "${payload.topic}" contendo ${payload.slides.length} slides estilizados sob medida gerada com sucesso.`,
          output: "PPTX enviado com sucesso!"
        };
      } else {
        throw new Error("PowerPoint File Write Verification Error.");
      }

    } catch (error) {
      console.error("Erro crítico na engine de renderização de slides:", error);
      await ctx.reply("Desculpe, ocorreu um erro interno ao pintar e arquitetar os arquivos desta apresentação.");
      return { success: false, text: "Falha na geração dos slides." };
    }
  }

  // =================================================================
  // ESTRUTURA DE FALLBACK SE A IA FALHAR EM RETORNAR JSON VÁLIDO
  // =================================================================
  private generateEmergencyPayload(rawText: string): DynamicPresentationPayload {
    return {
      topic: "Apresentação Inteligente",
      presentationSettings: {
        backgroundColor: "111116",
        surfaceColor: "1B1B22",
        primaryColor: "FF3366",
        accentColor: "FF1144",
        textColor: "FFFFFF",
        mutedColor: "A0A0AA",
        fontHeading: "Arial Black",
        fontBody: "Arial"
      },
      slides: [
        {
          title: "Análise de Conteúdo Estruturado",
          layoutType: "full_text_center",
          contentBody: rawText.substring(0, 600)
        }
      ]
    };
  }
}
