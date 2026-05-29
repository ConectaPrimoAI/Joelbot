```ts
import pptxgen from "pptxgenjs";

const COLORS = {
  bg: "0B1020",
  surface: "121826",
  primary: "4DA3FF",
  accent: "FF5C7A",
  gold: "FFC857",
  text: "F5F7FA",
  muted: "B8C1CC",
  line: "283046",
};

export async function generateSlides(topic: string, sections: any[]) {
  const pptx = new pptxgen();

  pptx.layout = "LAYOUT_WIDE";

  // =========================================
  // COVER
  // =========================================

  const cover = pptx.addSlide();

  cover.background = {
    color: COLORS.bg,
  };

  cover.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 7.5,
    fill: {
      color: "000000",
      transparency: 10,
    },
    line: {
      transparency: 100,
    },
  });

  cover.addText(topic.toUpperCase(), {
    x: 0.8,
    y: 2.1,
    w: 11,
    h: 1,
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    color: COLORS.text,
    margin: 0,
  });

  cover.addText("JOELBOT CINEMATIC ENGINE", {
    x: 0.9,
    y: 3.2,
    w: 4,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 11,
    color: COLORS.primary,
    bold: true,
    margin: 0,
  });

  // =========================================
  // DYNAMIC SLIDES
  // =========================================

  sections.forEach((section, index) => {
    const slide = pptx.addSlide();

    slide.background = {
      color: COLORS.bg,
    };

    const layoutType = index % 5;

    switch (layoutType) {
      // =====================================
      // LAYOUT 1 — BIG TITLE + EDITORIAL
      // =====================================

      case 0:
        slide.addText(section.title.toUpperCase(), {
          x: 0.7,
          y: 0.8,
          w: 10,
          h: 0.8,
          fontFace: "Aptos Display",
          fontSize: 28,
          bold: true,
          color: COLORS.text,
          margin: 0,
        });

        slide.addShape(pptx.ShapeType.rect, {
          x: 0.7,
          y: 1.6,
          w: 1.8,
          h: 0.05,
          fill: {
            color: COLORS.accent,
          },
          line: {
            transparency: 100,
          },
        });

        slide.addText(section.content.join(" "), {
          x: 0.8,
          y: 2,
          w: 8.5,
          h: 3,
          fontFace: "Aptos",
          fontSize: 20,
          color: COLORS.muted,
          breakLine: true,
        });

        break;

      // =====================================
      // LAYOUT 2 — PREMIUM CARDS
      // =====================================

      case 1:
        slide.addText(section.title, {
          x: 0.7,
          y: 0.5,
          w: 7,
          h: 0.5,
          fontFace: "Aptos Display",
          fontSize: 24,
          bold: true,
          color: COLORS.text,
        });

        section.content.slice(0, 4).forEach((item: string, idx: number) => {
          const y = 1.4 + idx * 1.2;

          slide.addShape(pptx.ShapeType.roundRect, {
            x: 0.8,
            y,
            w: 11,
            h: 0.9,
            rectRadius: 0.05,
            fill: {
              color: idx % 2 === 0
                ? "151F34"
                : "101827",
            },
            line: {
              color: "24324A",
              pt: 1,
            },
          });

          slide.addText(item, {
            x: 1.1,
            y: y + 0.2,
            w: 9.5,
            h: 0.4,
            fontFace: "Aptos",
            fontSize: 18,
            color: COLORS.text,
          });
        });

        break;

      // =====================================
      // LAYOUT 3 — HUGE QUOTE
      // =====================================

      case 2:
        slide.addText("“", {
          x: 0.8,
          y: 1.2,
          w: 1,
          h: 1,
          fontSize: 70,
          color: COLORS.accent,
          bold: true,
        });

        slide.addText(section.content.join(" "), {
          x: 1.5,
          y: 2,
          w: 9.5,
          h: 2,
          fontFace: "Aptos Display",
          fontSize: 26,
          italic: true,
          color: COLORS.text,
        });

        slide.addText(section.title.toUpperCase(), {
          x: 1.5,
          y: 5.3,
          w: 4,
          h: 0.3,
          fontFace: "Aptos",
          fontSize: 12,
          color: COLORS.primary,
          bold: true,
        });

        break;

      // =====================================
      // LAYOUT 4 — SPLIT SCREEN
      // =====================================

      case 3:
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 4.8,
          h: 7.5,
          fill: {
            color: "111827",
          },
          line: {
            transparency: 100,
          },
        });

        slide.addText(section.title.toUpperCase(), {
          x: 0.6,
          y: 1.3,
          w: 3.5,
          h: 1,
          fontFace: "Aptos Display",
          fontSize: 26,
          bold: true,
          color: COLORS.text,
        });

        slide.addText(section.content.join(" "), {
          x: 5.4,
          y: 1.8,
          w: 6.5,
          h: 3,
          fontFace: "Aptos",
          fontSize: 20,
          color: COLORS.muted,
        });

        break;

      // =====================================
      // LAYOUT 5 — CINEMATIC MINIMAL
      // =====================================

      case 4:
        slide.addText(section.title.toUpperCase(), {
          x: 0.9,
          y: 2.2,
          w: 10,
          h: 0.8,
          align: "center",
          fontFace: "Aptos Display",
          fontSize: 30,
          bold: true,
          color: COLORS.text,
        });

        slide.addShape(pptx.ShapeType.line, {
          x: 4.6,
          y: 3.3,
          w: 3,
          h: 0,
          line: {
            color: COLORS.primary,
            pt: 1.5,
          },
        });

        slide.addText(section.content[0] || "", {
          x: 2,
          y: 3.7,
          w: 9,
          h: 1,
          align: "center",
          fontFace: "Aptos",
          fontSize: 18,
          italic: true,
          color: COLORS.muted,
        });

        break;
    }

    // slide number
    slide.addText(String(index + 1).padStart(2, "0"), {
      x: 11.5,
      y: 6.8,
      w: 0.5,
      h: 0.2,
      fontFace: "Aptos",
      fontSize: 10,
      color: "FFFFFF55",
      align: "right",
    });
  });

  // =========================================
  // FINAL
  // =========================================

  const end = pptx.addSlide();

  end.background = {
    color: COLORS.bg,
  };

  end.addText("FIM.", {
    x: 1,
    y: 2.6,
    w: 11,
    h: 0.8,
    align: "center",
    fontFace: "Aptos Display",
    fontSize: 36,
    bold: true,
    color: COLORS.text,
  });

  end.addText("JoelBot AI", {
    x: 1,
    y: 3.5,
    w: 11,
    h: 0.3,
    align: "center",
    fontFace: "Aptos",
    fontSize: 12,
    color: COLORS.muted,
  });

  const fileName = `slides_${Date.now()}.pptx`;

  await pptx.writeFile({
    fileName,
  });

  return fileName;
}
```
