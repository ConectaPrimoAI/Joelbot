import { Skill } from './Skill.js';
import { Context } from 'telegraf';
export declare class ExecSkill implements Skill {
    name: string;
    description: string;
    canHandle(i: string): boolean;
    constructor();
    private p;
    execute(params: string, _ctx: Context): Promise<string | {
        text: string;
        file?: string;
        type?: 'document';
    }>;
}
