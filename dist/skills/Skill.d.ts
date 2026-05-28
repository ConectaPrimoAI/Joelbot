import { Context } from 'telegraf';
export type SkillResult = string | null | undefined | {
    text?: string;
    file?: string;
    type?: 'document' | 'photo' | 'video' | 'voice';
};
export interface Skill {
    name: string;
    description: string;
    canHandle(intent: string): boolean | Promise<boolean>;
    execute(params: string, ctx: Context): Promise<SkillResult>;
}
export declare class SkillRegistry {
    private skills;
    register(skill: Skill): void;
    selectBestSkill(intent: string): Promise<Skill | null>;
    getAll(): Skill[];
}
