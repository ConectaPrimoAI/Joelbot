import "dotenv/config";
import { Telegraf, Context } from 'telegraf';
import Groq from 'groq-sdk';
export declare const bot: Telegraf<Context<import("@telegraf/types").Update>>;
export declare const groq: Groq;
export declare function startJoelBotGateway(): void;
