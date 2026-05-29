#!/usr/bin/env node

import process from "node:process";
import express from "express";
import axios from "axios";

import { startJoelBotGateway } from "./joelbot-agent.js";

const app = express();

const PORT = process.env.PORT || 3000;
const RENDER_URL = "https://joelbot.onrender.com";

app.get("/", (_, res) => {
  res.send("JoelBot online 🚀");
});

app.listen(PORT, () => {
  console.log(`🌐 Anti-sleep server rodando na porta ${PORT}`);
});

// Anti-sleep ping a cada 10 minutos
setInterval(async () => {
  try {
    await axios.get(RENDER_URL);
    console.log("🏓 Ping enviado para evitar sleep");
  } catch (err) {
    console.error("❌ Erro no ping:", err);
  }
}, 10 * 60 * 1000);

async function runGateway() {
  process.on("uncaughtException", (error) => {
    console.error("[JoelBot Core Exception]:", error);
  });

  try {
    startJoelBotGateway();
  } catch (err: any) {
    console.error("❌ Falha crítica ao subir o barramento JoelBot:", err);
    process.exit(1);
  }
}

void runGateway();
