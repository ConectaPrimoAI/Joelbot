import { Context } from 'telegraf';

export interface Skill {
    name: string;
    description: string;
    canHandle(intent: string): boolean | Promise<boolean>;
    execute(
        params: any,
        ctx: Context
    ): Promise<
        | string
        | null
        | undefined
        | { text?: string; file?: string; type?: 'document' | 'photo' | 'video' | 'voice' }
    >;
}

export class SkillRegistry {
    private skills: Skill[] = [];

    register(skill: Skill): void {
        console.log(`[SkillRegistry] ✅ ${skill.name} registrada`);
        this.skills.push(skill);
    }

    /**
     * FIXADO: Não fazer .toUpperCase() do intent pois quebra as URLs
     * e os regex das skills que fazem match case-insensitive corretamente.
     */
    async selectBestSkill(intent: string): Promise<Skill | null> {
        for (const skill of this.skills) {
            try {
                if (await skill.canHandle(intent)) {
                    return skill;
                }
            } catch {
                // skill falhou no canHandle — ignora silenciosamente
            }
        }
        return null;
    }

    getAll(): Skill[] {
        return [...this.skills];
    }
}
