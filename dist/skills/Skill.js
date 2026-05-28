export class SkillRegistry {
    skills = [];
    register(skill) {
        this.skills.push(skill);
        console.log(`[Registry] ✅ ${skill.name}`);
    }
    async selectBestSkill(intent) {
        const up = intent.toUpperCase();
        for (const s of this.skills) {
            try {
                if (await s.canHandle(up))
                    return s;
            }
            catch { }
        }
        return null;
    }
    getAll() { return this.skills; }
}
//# sourceMappingURL=Skill.js.map