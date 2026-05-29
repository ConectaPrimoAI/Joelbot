```ts
import pptxgen from "pptxgenjs";

const COLORS = {
  bg: "0B1020",
  surface: "121A2B",
  primary: "4DA3FF",
  accent: "FF5C7A",
  text: "F5F7FA",
  muted: "B8C1CC",
  line: "283046",
};

const FONT_TITLE = "Aptos Display";
const FONT_BODY = "Aptos";

export async function generateCinematicSlides(
  topic: string,
  slides: Array<{
    title: string;
    content: string[];
  }>
) {
  const pptx = new pptxgen();

  pptx.layout = "LAYOUT_WIDE";

  pptx.author = "JoelBot AI";
  pptx.company = "JoelBot";
  pptx.subject = topic;
  pptx.title = topic;
  pptx.lang = "pt-BR";

  pptx.theme = {
    headFontFace: FONT_TITLE,
    bodyFontFace: FONT_BODY,
    lang: "pt-BR",
  };

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
      color: "000000",
      transparency: 100,
    },
  });

  cover.addText(topic.toUpperCase(), {
    x: 0.8,
    y: 2,
    w: 11,
    h: 1,
    fontFace: FONT_TITLE,
    fontSize: 30,
    bold: true,
    color: COLORS.text,
    margin: 0,
  });

  cover.addText("APRESENTAÇÃO CINEMATOGRÁFICA", {
    x: 0.85,
    y: 3.2,
    w: 5,
    h: 0.3,
    fontFace: FONT_BODY,
    fontSize: 11,
    bold: true,
    color: COLORS.primary,
    charSpace: 1.2,
    margin: 0,
  });

  // =========================================
  // CONTENT SLIDES
  // =========================================

  slides.forEach((item, index) => {
    const slide = pptx.addSlide();

    slide.background = {
      color: COLORS.bg,
    };

    // top line
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 0.07,
      fill: {
        color: COLORS.primary,
      },
      line: {
        color: COLORS.primary,
        transparency: 100,
      },
    });

    // title
    slide.addText(item.title.toUpperCase(), {
      x: 0.7,
      y: 0.45,
      w: 9,
      h: 0.6,
      fontFace: FONT_TITLE,
      fontSize: 26,
      bold: true,
      color: COLORS.text,
      margin: 0,
    });

    // slide number
    slide.addText(String(index + 1).padStart(2, "0"), {
      x: 11.3,
      y: 0.35,
      w: 1,
      h: 0.5,
      fontFace: FONT_TITLE,
      fontSize: 24,
      bold: true,
      color: "FFFFFF22",
      align: "right",
      margin: 0,
    });

    // separator
    slide.addShape(pptx.ShapeType.line, {
      x: 0.7,
      y: 1.1,
      w: 11,
      h: 0,
      line: {
        color: COLORS.line,
        pt: 1,
      },
    });

    // cards
    item.content.slice(0, 4).forEach((text, idx) => {
      const y = 1.5 + idx * 1.15;

      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.8,
        y,
        w: 11,
        h: 0.95,
        rectRadius: 0.05,
        fill: {
          color: idx % 2 === 0 ? "151F34" : "101827",
        },
        line: {
          color: "24324A",
          pt: 1,
        },
        shadow: {
          type: "outer",
          color: "000000",
          blur: 2,
          angle: 45,
          distance: 1,
          opacity: 0.15,
        },
      });

      slide.addShape(pptx.ShapeType.ellipse, {
        x: 1,
        y: y + 0.28,
        w: 0.14,
        h: 0.14,
        fill: {
          color: idx % 2 === 0
            ? COLORS.primary
            : COLORS.accent,
        },
        line: {
          color: "FFFFFF",
          transparency: 100,
        },
      });

      slide.addText(text, {
        x: 1.3,
        y: y + 0.18,
        w: 9.8,
        h: 0.4,
        fontFace: FONT_BODY,
        fontSize: 18,
        color: COLORS.text,
        margin: 0,
        breakLine: false,
      });
    });

    // branding
    slide.addText("JOELBOT AI", {
      x: 10.8,
      y: 6.9,
      w: 1.3,
      h: 0.2,
      align: "right",
      fontFace: FONT_BODY,
      fontSize: 9,
      bold: true,
      color: "FFFFFF55",
      margin: 0,
    });
  });

  // =========================================
  // FINAL SLIDE
  // =========================================

  const end = pptx.addSlide();

  end.background = {
    color: COLORS.bg,
  };

  end.addText("OBRIGADO.", {
    x: 1,
    y: 2.5,
    w: 11,
    h: 0.8,
    align: "center",
    fontFace: FONT_TITLE,
    fontSize: 34,
    bold: true,
    color: COLORS.text,
    margin: 0,
  });

  end.addText("JoelBot AI Presentation Engine", {
    x: 1,
    y: 3.5,
    w: 11,
    h: 0.3,
    align: "center",
    fontFace: FONT_BODY,
    fontSize: 12,
    color: COLORS.muted,
    margin: 0,
  });

  // =========================================
  // SAVE
  // =========================================

  const fileName = `presentation_${Date.now()}.pptx`;

  await pptx.writeFile({
    fileName,
  });

  return fileName;
}
```
