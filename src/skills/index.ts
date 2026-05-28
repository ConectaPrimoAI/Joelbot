import { SkillRegistry } from './Skill.js';
import { BrowserSkill } from './BrowserSkill.js';
import { ExecSkill } from './ExecSkill.js';
import { WeatherSkill } from './WeatherSkill.js';
import { ImageSkill } from './ImageSkill.js';
import { VideoSkill } from './VideoSkill.js';
import { SlidesSkill } from './SlidesSkill.js';
import { DriveSkill } from './DriveSkill.js';
import { GitHubSkill } from './GitHubSkill.js';

const registry = new SkillRegistry();

// Registro ordenado por prioridade de detecção
registry.register(new BrowserSkill());
registry.register(new ExecSkill());
registry.register(new WeatherSkill());
registry.register(new ImageSkill());
registry.register(new VideoSkill());
registry.register(new SlidesSkill());
registry.register(new DriveSkill());
registry.register(new GitHubSkill());

export { registry };
export * from './Skill.js';
