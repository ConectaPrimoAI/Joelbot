import { Skill } from './Skill.js';
import { Context } from 'telegraf';
export declare class VideoSkill implements Skill {
    name: string;
    description: string;
    canHandle(i: string): boolean;
    execute(params: string, ctx: Context): Promise<string | {
        text: string;
        file?: string;
        type?: 'video';
    }>;
}
