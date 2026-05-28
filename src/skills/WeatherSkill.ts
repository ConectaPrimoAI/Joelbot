import { Skill } from './Skill.js';
import { Context } from 'telegraf';
import axios from 'axios';
import { addLog } from '../web-terminal.js';

export class WeatherSkill implements Skill {
    name = 'WeatherSkill';
    description = 'Previsão do tempo atual e para os próximos dias.';

    canHandle(intent: string): boolean {
        return intent.includes('[SYSTEM_WEATHER:');
    }

    async execute(params: any, _ctx: Context): Promise<string> {
        const match = params.match(/\[SYSTEM_WEATHER:\s*local="([^"]+)"\]/i);
        const local = match ? match[1].trim() : 'Chapecó, SC';

        addLog(`🌤️ WeatherSkill: consultando ${local}`);

        try {
            const encoded = encodeURIComponent(local);

            const [resAtual, jsonRes] = await Promise.allSettled([
                axios.get(`https://wttr.in/${encoded}?format=%C+%t+%h&lang=pt`, { timeout: 8000 }),
                axios.get(`https://wttr.in/${encoded}?format=j1`, { timeout: 10000 })
            ]);

            const atual = resAtual.status === 'fulfilled'
                ? (resAtual.value.data?.trim() || 'Dados indisponíveis')
                : 'Dados indisponíveis';

            let previsao3dias = 'Previsão detalhada indisponível.';

            if (jsonRes.status === 'fulfilled') {
                const data = jsonRes.value.data;
                const weather = data.weather || [];
                const dayNames = ['Hoje', 'Amanhã', 'Depois de amanhã'];

                previsao3dias = weather.slice(0, 3).map((day: any, i: number) => {
                    const maxC = day.maxtempC;
                    const minC = day.mintempC;
                    const desc = day.hourly?.[4]?.weatherDesc?.[0]?.value || '';
                    const totalRain = day.hourly?.reduce(
                        (acc: number, h: any) => acc + parseInt(h.chanceofrain || '0', 10), 0
                    ) || 0;
                    const avgRain = Math.round(totalRain / (day.hourly?.length || 1));
                    return `• *${dayNames[i]}*: ${minC}°C–${maxC}°C ${desc} 🌧️${avgRain}%`;
                }).join('\n');
            }

            return (
                `🌤️ *Tempo em ${local}*\n\n` +
                `📍 *Agora:* ${atual}\n\n` +
                `📅 *Próximos 3 dias:*\n${previsao3dias}`
            );

        } catch (error: any) {
            addLog(`❌ WeatherSkill erro: ${error.message}`);
            return `⚠️ Não consegui obter a previsão do tempo para "${local}". Tente novamente.`;
        }
    }
}
