import { Skill } from './Skill.js';
import { Context } from 'telegraf';
export declare class WeatherSkill implements Skill {
    name: string;
    description: string;
    canHandle(i: string): boolean;
    execute(params: string, _ctx: Context): Promise<string>;
    private respostaHoraria;
}
