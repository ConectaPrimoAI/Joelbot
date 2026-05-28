#!/usr/bin/env node
import 'dotenv/config';
import process from "node:process";
import { startJoelBotGateway } from "./joelbot-agent.js";

async function runGateway() {
  process.on("uncaughtException", (error) => {
    console.error("[JoelBot Core Exception]:", error);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[JoelBot Unhandled Rejection]:", reason);
  });
  try {
    await startJoelBotGateway();
  } catch (err: any) {
    console.error("❌ Falha crítica ao subir o barramento JoelBot:", err);
    process.exit(1);
  }
}

void runGateway();
