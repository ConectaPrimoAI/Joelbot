import { Skill } from './Skill.js';
import { Context } from 'telegraf';
export declare class GitHubSkill implements Skill {
    name: string;
    description: string;
    canHandle(i: string): boolean;
    private api;
    private slug;
    execute(params: string, _ctx: Context): Promise<string>;
}
