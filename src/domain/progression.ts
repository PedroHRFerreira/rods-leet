import type { GameMode, RankingEntry, Verdict } from '../lib/contracts';
import { rewardPercent } from './rules';

export interface XpEvent {
  id: string; challengeId: string; amount: number; at: string;
  reason: 'completion' | 'hard_penalty';
}
export interface AssistanceSnapshot { hintsUsed: number; practiceOnly: boolean }
/** One user's state. Server persistence supplies serialization and ownership checks. */
export interface ProgressState {
  xp: number;
  hintBalance: number;
  completedChallengeIds: string[];
  rewardedKeys: string[];
  processedSubmissionIds: string[];
  incorrectByChallenge: Record<string, number>;
  hintsByChallenge: Record<string, number>;
  solutionAccess: Record<string, { practiceOnly: boolean }>;
  hintRequests: Record<string, { challengeId: string; hintsUsed: number; balance: number; rewardPercent: number }>;
  xpEvents: XpEvent[];
}
export const createProgressState = (): ProgressState => ({
  xp: 0, hintBalance: 1, completedChallengeIds: [], rewardedKeys: [],
  processedSubmissionIds: [], incorrectByChallenge: {}, hintsByChallenge: {},
  solutionAccess: {}, hintRequests: {}, xpEvents: [],
});
export function levelProgress(xp: number) {
  if (!Number.isSafeInteger(xp) || xp < 0) throw new Error('XP inválido');
  const level = Math.floor((Math.sqrt(1 + 8 * xp / 150) - 1) / 2);
  const levelStartsAt = 150 * level * (level + 1) / 2;
  return { level, xpIntoLevel: xp - levelStartsAt, xpForNextLevel: 150 * (level + 1) };
}
export const assistanceSnapshot = (state: ProgressState, challengeId: string): AssistanceSnapshot => ({
  hintsUsed: state.hintsByChallenge[challengeId] ?? 0,
  practiceOnly: state.solutionAccess[challengeId]?.practiceOnly ?? false,
});
export const canAccessSolution = (state: ProgressState, challengeId: string): boolean =>
  state.completedChallengeIds.includes(challengeId) || (state.incorrectByChallenge[challengeId] ?? 0) >= 3;

export function accessSolution(state: ProgressState, challengeId: string): ProgressState {
  if (Object.hasOwn(state.solutionAccess, challengeId)) return state;
  if (!canAccessSolution(state, challengeId)) throw new Error('O gabarito desbloqueia após aprovação ou três erros');
  const next = structuredClone(state);
  next.solutionAccess[challengeId] = { practiceOnly: !state.completedChallengeIds.includes(challengeId) };
  return next;
}

export function useHint(state: ProgressState, challengeId: string, requestId: string) {
  const existing = state.hintRequests[requestId];
  if (existing) {
    if (existing.challengeId !== challengeId) throw new Error('Chave de idempotência reutilizada');
    return { state, result: existing };
  }
  if (state.hintBalance < 1) throw new Error('Você não tem dicas disponíveis');
  const next = structuredClone(state);
  const hintsUsed = (next.hintsByChallenge[challengeId] ?? 0) + 1;
  next.hintsByChallenge[challengeId] = hintsUsed;
  next.hintBalance -= 1;
  const result = { challengeId, hintsUsed, balance: next.hintBalance, rewardPercent: rewardPercent(hintsUsed) };
  next.hintRequests[requestId] = result;
  return { state: next, result };
}

export interface FinalVerdictInput {
  submissionId: string; challengeId: string; mode: GameMode;
  baseXp: number; verdict: Verdict; assistance: AssistanceSnapshot; at: string;
}
export function applyFinalVerdict(state: ProgressState, input: FinalVerdictInput) {
  if (state.processedSubmissionIds.includes(input.submissionId)) return { state, xpDelta: 0, duplicate: true };
  if (input.verdict === 'infrastructure_error') return { state, xpDelta: 0, duplicate: false };
  if (!Number.isSafeInteger(input.baseXp) || input.baseXp < 0) throw new Error('Recompensa inválida');
  if (!Number.isSafeInteger(input.assistance.hintsUsed) || input.assistance.hintsUsed < 0) throw new Error('Assistência inválida');
  const next = structuredClone(state);
  next.processedSubmissionIds.push(input.submissionId);
  let xpDelta = 0;
  if (input.verdict === 'accepted') {
    const rewardKey = `${input.challengeId}:${input.mode}`;
    if (!next.rewardedKeys.includes(rewardKey)) {
      next.rewardedKeys.push(rewardKey);
      if (!input.assistance.practiceOnly) {
        xpDelta = Math.floor(input.baseXp * (input.mode === 'hard' ? 3 : 1) * rewardPercent(input.assistance.hintsUsed) / 100);
      }
    }
    if (!next.completedChallengeIds.includes(input.challengeId)) {
      next.completedChallengeIds.push(input.challengeId);
      if (next.completedChallengeIds.length % 10 === 0) next.hintBalance += 1;
    }
  } else {
    next.incorrectByChallenge[input.challengeId] = (next.incorrectByChallenge[input.challengeId] ?? 0) + 1;
    if (input.mode === 'hard') xpDelta = -Math.min(30, next.xp);
  }
  if (xpDelta !== 0) {
    next.xp += xpDelta;
    next.xpEvents.push({
      id: input.submissionId, challengeId: input.challengeId, amount: xpDelta, at: input.at,
      reason: input.verdict === 'accepted' ? 'completion' : 'hard_penalty',
    });
  }
  return { state: next, xpDelta, duplicate: false };
}
export function sortRanking(entries: readonly RankingEntry[]): RankingEntry[] {
  return [...entries].sort((a, b) => b.xp - a.xp || b.completedCount - a.completedCount ||
    Date.parse(a.reachedAt) - Date.parse(b.reachedAt) || a.userId.localeCompare(b.userId));
}
