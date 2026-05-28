import { Skill } from './Skill.js';
import { Context } from 'telegraf';
export declare class GmailSkill implements Skill {
    name: string;
    description: string;
    canHandle(i: string): boolean;
    execute(params: string, ctx: Context): Promise<string>;
}
