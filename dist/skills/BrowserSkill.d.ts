import { Skill } from './Skill.js';
import { Context } from 'telegraf';
export declare class BrowserSkill implements Skill {
    name: string;
    description: string;
    canHandle(i: string): boolean;
    private p;
    execute(params: string, ctx: Context): Promise<string | {
        text: string;
        file?: string;
        type?: 'photo';
    }>;
}
