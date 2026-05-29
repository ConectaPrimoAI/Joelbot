
import PptxGenJS from "pptxgenjs";
import fs from "fs";
import path from "path";
import { Context } from "telegraf";

type SlideSection = {
  title: string;
  content: string[];
};

const THEMES = {
  netflix: {
    bg: "0B0B0F",
    surface: "16161D",
    primary: "E50914",
    secondary: "B20710",
    text: "FFFFFF",
    muted: "B3B3B3",
  },

  apple: {
    bg: "F5F5F7",
    surface: "FFFFFF",
    primary: "0071E3",
    secondary: "111111",
    text: "111111",
    muted: "6E6E73",
  },

  cyberpunk: {
    bg: "0A0A0A",
    surface: "111827",
    primary: "00F0FF",
    secondary: "FF00A8",
    text: "FFFFFF",
    muted: "AAAAAA",
  },
};

function splitLongText(text: string): string[] {
  const sentences = text
    .replace(/\n/g, " ")
    .split(/(?<=[.!?])\s+/);

  const chunks: string[] = [];

  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > 180) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += " " + sentence;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function normalizeSections(rawSections: any[]): SlideSection[] {
  const finalSlides: SlideSection[] = [];

  rawSections.forEach((section) => {
    const title = section.title || "Slide";

    const fullText = Array.isArray(section.content)
      ? section.content.join(" ")
      : String(section.content || "");

    const chunks = splitLongText(fullText);

    chunks.forEach((chunk, index) => {
      finalSlides.push({
        title:
          chunks.length > 1
            ? `${title} (${index + 1})`
            : title,
        content: [chunk],
      });
    });
  });

  return finalSlides;
}

export class SlidesSkill {
  async execute(
    ctx: Context,
    topic: string,
    rawSections: any[],
    themeName: keyof typeof THEMES = "netflix"
  ) {
    const theme = THEMES[themeName];

    const sections = normalizeSections(rawSections);

    const pptx = new PptxGenJS();

    pptx.layout = "LAYOUT_WIDE";

    pptx.author = "JoelBot AI";
    pptx.company = "JoelBot";
    pptx.subject = topic;
    pptx.title = topic;
    pptx.lang = "pt-BR";

    // =====================================
    // COVER
    // =====================================

    const cover = pptx.addSlide();

    cover.background = {
      color: theme.bg,
    };

    cover.addShape(PptxGenJS.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      fill: {
        color: theme.primary,
        transparency: 88,
      },
      line: {
        transparency: 100,
      },
    });

    cover.addText(topic.toUpperCase(), {
      x: 0.8,
      y: 2,
      w: 11,
      h: 1,
      fontFace: "Aptos Display",
      fontSize: 30,
      bold: true,
      color: theme.text,
      margin: 0,
      align: "left",
    });

    cover.addText(
      `STYLE: ${themeName.toUpperCase()}`,
      {
        x: 0.85,
        y: 3.2,
        w: 4,
        h: 0.3,
        fontFace: "Aptos",
        fontSize: 12,
        bold: true,
        color: theme.primary,
        margin: 0,
      }
    );

    // =====================================
    // DYNAMIC SLIDES
    // =====================================

    sections.forEach((section, index) => {
      const slide = pptx.addSlide();

      slide.background = {
        color: theme.bg,
      };

      const layout = index % 6;

      // =====================================
      // HERO LAYOUT
      // =====================================

      if (layout === 0) {
        slide.addText(section.title.toUpperCase(), {
          x: 0.7,
          y: 0.8,
          w: 10,
          h: 0.7,
          fontFace: "Aptos Display",
          fontSize: 28,
          bold: true,
          color: theme.text,
        });

        slide.addShape(PptxGenJS.ShapeType.line, {
          x: 0.7,
          y: 1.55,
          w: 2.5,
          h: 0,
          line: {
            color: theme.primary,
            pt: 2,
          },
        });

        slide.addText(section.content[0], {
          x: 0.8,
          y: 2,
          w: 8.5,
          h: 3,
          fontFace: "Aptos",
          fontSize: 20,
          color: theme.muted,
          breakLine: true,
        });
      }

      // =====================================
      // QUOTE LAYOUT
      // =====================================

      else if (layout === 1) {
        slide.addText("“", {
          x: 0.7,
          y: 1,
          w: 1,
          h: 1,
          fontSize: 70,
          bold: true,
          color: theme.primary,
        });

        slide.addText(section.content[0], {
          x: 1.6,
          y: 2,
          w: 9.5,
          h: 2,
          fontFace: "Aptos Display",
          fontSize: 26,
          italic: true,
          color: theme.text,
        });

        slide.addText(section.title.toUpperCase(), {
          x: 1.7,
          y: 5.3,
          w: 5,
          h: 0.3,
          fontFace: "Aptos",
          fontSize: 11,
          color: theme.primary,
          bold: true,
        });
      }

      // =====================================
      // SPLIT SCREEN
      // =====================================

      else if (layout === 2) {
        slide.addShape(PptxGenJS.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 4.5,
          h: 7.5,
          fill: {
            color: theme.surface,
          },
          line: {
            transparency: 100,
          },
        });

        slide.addText(section.title.toUpperCase(), {
          x: 0.5,
          y: 1.5,
          w: 3.2,
          h: 1,
          fontFace: "Aptos Display",
          fontSize: 24,
          bold: true,
          color: theme.text,
        });

        slide.addText(section.content[0], {
          x: 5,
          y: 1.8,
          w: 6.5,
          h: 3,
          fontFace: "Aptos",
          fontSize: 20,
          color: theme.muted,
        });
      }

      // =====================================
      // CARD GRID
      // =====================================

      else if (layout === 3) {
        slide.addText(section.title, {
          x: 0.7,
          y: 0.5,
          w: 8,
          h: 0.5,
          fontFace: "Aptos Display",
          fontSize: 25,
          bold: true,
          color: theme.text,
        });

        const bullets = section.content[0]
          .split(".")
          .filter(Boolean)
          .slice(0, 4);

        bullets.forEach((bullet, i) => {
          const y = 1.4 + i * 1.15;

          slide.addShape(
            PptxGenJS.ShapeType.roundRect,
            {
              x: 0.8,
              y,
              w: 11,
              h: 0.9,
              rectRadius: 0.05,
              fill: {
                color:
                  i % 2 === 0
                    ? theme.surface
                    : theme.bg,
              },
              line: {
                color: theme.primary,
                pt: 1,
              },
            }
          );

          slide.addText(bullet.trim(), {
            x: 1.1,
            y: y + 0.2,
            w: 9.5,
            h: 0.3,
            fontFace: "Aptos",
            fontSize: 18,
            color: theme.text,
          });
        });
      }

      // =====================================
      // CENTERED CINEMATIC
      // =====================================

      else if (layout === 4) {
        slide.addText(section.title.toUpperCase(), {
          x: 1,
          y: 2,
          w: 10,
          h: 0.8,
          align: "center",
          fontFace: "Aptos Display",
          fontSize: 32,
          bold: true,
          color: theme.text,
        });

        slide.addShape(PptxGenJS.ShapeType.line, {
          x: 4.8,
          y: 3.2,
          w: 2.5,
          h: 0,
          line: {
            color: theme.primary,
            pt: 2,
          },
        });

        slide.addText(section.content[0], {
          x: 2,
          y: 3.7,
          w: 8.5,
          h: 1,
          align: "center",
          fontFace: "Aptos",
          fontSize: 18,
          italic: true,
          color: theme.muted,
        });
      }

      // =====================================
      // STATEMENT SLIDE
      // =====================================

      else {
        slide.addText(section.content[0], {
          x: 1,
          y: 2.2,
          w: 10,
          h: 2,
          fontFace: "Aptos Display",
          fontSize: 24,
          bold: true,
          color: theme.text,
          align: "center",
          valign: "mid",
        });
      }

      // footer
      slide.addText(
        String(index + 1).padStart(2, "0"),
        {
          x: 11.5,
          y: 6.8,
          w: 0.4,
          h: 0.2,
          fontFace: "Aptos",
          fontSize: 10,
          color: "FFFFFF55",
          align: "right",
        }
      );
    });

    // =====================================
    // END
    // =====================================

    const end = pptx.addSlide();

    end.background = {
      color: theme.bg,
    };

    end.addText("FIM.", {
      x: 1,
      y: 2.5,
      w: 11,
      h: 1,
      align: "center",
      fontFace: "Aptos Display",
      fontSize: 36,
      bold: true,
      color: theme.text,
    });

    end.addText("JoelBot AI", {
      x: 1,
      y: 3.5,
      w: 11,
      h: 0.3,
      align: "center",
      fontFace: "Aptos",
      fontSize: 12,
      color: theme.muted,
    });

    // =====================================
    // SAVE
    // =====================================

    const fileName = `slides_${Date.now()}.pptx`;

    const filePath = path.join(
      process.cwd(),
      fileName
    );

    await pptx.writeFile({
      fileName: filePath,
    });

    // =====================================
    // SEND TELEGRAM FILE
    // =====================================

    await ctx.replyWithDocument({
      source: fs.createReadStream(filePath),
      filename: fileName,
    });

    return {
      success: true,
      fileName,
      filePath,
    };
  }
}
