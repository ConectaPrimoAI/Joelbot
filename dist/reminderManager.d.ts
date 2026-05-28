import { Telegraf } from 'telegraf';
export interface Lembrete {
    id: string;
    userId: number;
    mensagem: string;
    tipo: 'normal' | 'repetitivo' | 'rotina';
    hora: string;
    dataAlvo?: string;
    diasOn?: number;
    diasOff?: number;
    totalCiclos?: number;
    ciclosCompletados?: number;
    emCicloOn?: boolean;
    diasRestantesNoCiclo?: number;
    ultimoDisparoData?: string;
    ativo: boolean;
    criadoEm: string;
}
export declare function startReminderManager(bot: Telegraf): void;
export declare function adicionarLembrete(dados: Omit<Lembrete, 'id' | 'criadoEm'>): Lembrete;
export declare function listarLembretes(userId: number): Lembrete[];
export declare function cancelarLembrete(id: string, userId: number): boolean;
export declare function cancelarTodos(userId: number): number;
