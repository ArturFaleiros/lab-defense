import type { MatchSummary, Profile } from '../progress/profile';
import { CAMPAIGN } from './stages';

/**
 * Conquistas: objetivos opcionais com recompensa em Energia concatenada (EC).
 * `check` recebe o perfil já atualizado e, quando houver, o resumo da última partida.
 */
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  ec: number;
  check: (p: Profile, m: MatchSummary | null) => boolean;
}

const cleared = (p: Profile, id: string) => !!p.stages[id]?.cleared;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'primeiro', name: 'Primeiro acionamento', desc: 'Vença a primeira fase da campanha.', ec: 30, check: (p) => cleared(p, '1-1') },
  {
    id: 'estrelas',
    name: 'Projeto impecável',
    desc: 'Obtenha 3 estrelas em uma fase.',
    ec: 40,
    check: (p) => Object.values(p.stages).some((s) => s.stars >= 3),
  },
  { id: 'cap1', name: 'Fundamentos de comutação', desc: 'Conclua o capítulo 1.', ec: 50, check: (p) => cleared(p, '1-3') },
  {
    id: 'arco',
    name: 'Arco extinto',
    desc: 'Derrote o Arco Elétrico.',
    ec: 40,
    check: (_p, m) => !!m?.stats.bosses.includes('arco'),
  },
  {
    id: 'equipe',
    name: 'Equipe equilibrada',
    desc: 'Vença uma partida usando unidades de 4 classes diferentes.',
    ec: 50,
    check: (_p, m) => !!m?.won && m.stats.classes.length >= 4,
  },
  {
    id: 'protecao',
    name: 'Proteção total',
    desc: 'Vença uma fase sem perder vidas tendo usado um Diodo de Proteção.',
    ec: 50,
    check: (_p, m) => !!m?.won && m.stats.leaks === 0 && m.stats.unitsUsed.includes('diodo'),
  },
  {
    id: 'economia',
    name: 'Fonte estável',
    desc: 'Gere 1 000 créditos com Fontes DC em uma única partida.',
    ec: 40,
    check: (_p, m) => !!m && m.stats.fonteIncome >= 1000,
  },
  {
    id: 'comutacao',
    name: 'Comutação em série',
    desc: 'Interrompa 150 inimigos em uma única partida.',
    ec: 30,
    check: (_p, m) => !!m && m.stats.stuns >= 150,
  },
  {
    id: 'evolucao',
    name: 'Evolução máxima',
    desc: 'Evolua uma unidade até a última forma.',
    ec: 50,
    check: (p) => Object.values(p.tiers).some((t) => t === 2),
  },
  {
    id: 'quiz',
    name: 'Banca aprovada',
    desc: 'Acerte 5 desafios de conhecimento.',
    ec: 60,
    check: (p) => p.stats.quizCorrect >= 5,
  },
  { id: 'mil', name: 'Mil falhas contidas', desc: 'Elimine 1 000 inimigos no total.', ec: 60, check: (p) => p.stats.kills >= 1000 },
  {
    id: 'infinito',
    name: 'Regime permanente',
    desc: 'Alcance a onda 15 no modo infinito.',
    ec: 70,
    check: (p) => p.stats.endlessBest >= 15,
  },
  {
    id: 'nucleo',
    name: 'Núcleo protegido',
    desc: 'Derrote o Colapso do Sistema.',
    ec: 120,
    check: (_p, m) => !!m?.stats.bosses.includes('colapso'),
  },
  {
    id: 'mestre',
    name: 'Engenharia de excelência',
    desc: 'Obtenha 3 estrelas em todas as fases da campanha.',
    ec: 200,
    check: (p) => CAMPAIGN.every((s) => (p.stages[s.id]?.stars ?? 0) >= 3),
  },
  // ---------------- Patch 1.1 ----------------
  {
    id: 'dificil',
    name: 'Projeto sob estresse',
    desc: 'Vença uma fase na dificuldade Difícil.',
    ec: 60,
    check: (_p, m) => !!m?.won && m.difficulty === 'dificil',
  },
  {
    id: 'impossivel',
    name: 'Margem de segurança zero',
    desc: 'Vença uma fase na dificuldade Impossível.',
    ec: 200,
    check: (_p, m) => !!m?.won && m.difficulty === 'impossivel',
  },
  {
    id: 'capsula',
    name: 'Energia concatenada',
    desc: 'Obtenha uma Cápsula Energética no modo infinito.',
    ec: 30,
    check: (p) => p.capsules.opened >= 1,
  },
  {
    id: 'secreto',
    name: 'Resistência zero',
    desc: 'Descubra a unidade secreta.',
    ec: 150,
    check: (p) => !!p.secrets.supercondutor,
  },
  {
    id: 'expansao',
    name: 'Rede restabelecida',
    desc: 'Derrote o Apagão Total (fase 11-3).',
    ec: 150,
    check: (p) => cleared(p, '11-3'),
  },
  {
    id: 'sinergia',
    name: 'Circuito bem projetado',
    desc: 'Vença uma partida com 6 tipos diferentes de unidade.',
    ec: 50,
    check: (_p, m) => !!m?.won && m.stats.unitsUsed.length >= 6,
  },
];
