import { Skill } from './Skill.js';
import { Context } from 'telegraf';
export declare class SlidesSkill implements Skill {
    name: string;
    description: string;
    canHandle(intent: string): boolean;
    execute(params: any, ctx: Context): Promise<string | {
        text: string;
        file: string;
        type: 'document';
    }>;
}
