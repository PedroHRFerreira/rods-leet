/** Public transport contracts. Never add official expectations or solutions here. */
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'normal' | 'hard';
export type ChallengeKind = 'quiz' | 'function' | 'fix_code' | 'guided_review' | 'project' | 'sql';
export type LanguageId = 'python' | 'javascript' | 'typescript' | 'java' | 'csharp' | 'cpp' | 'c' | 'go' | 'rust' | 'kotlin' | 'sql';
export type TopicId = 'logic' | 'algorithms' | 'data-structures' | 'sql' | 'oop' | 'backend' | 'testing' | 'architecture' | 'system-design' | 'devops';

export interface SourceFile { path: string; content: string }
export interface PublicExample { input: unknown; output: unknown; explanation?: string }
export interface ExecutionLimits {
  maxFiles: number; maxSourceBytes: number; compileTimeoutMs: number;
  caseCpuMs: number; caseWallMs: number; jobWallMs: number;
  memoryMiB: number; caseOutputBytes: number; jobOutputBytes: number;
}
export interface PublicChallenge {
  id: string; slug: string; versionId: string; title: string; description: string;
  topicId: TopicId; difficulty: Difficulty; kind: ChallengeKind; baseXp: number;
  examples: PublicExample[]; constraints: string[];
  complexityGoal?: { time: string; space: string };
  languageIds: LanguageId[];
  starterFilesByLanguage: Partial<Record<LanguageId, SourceFile[]>>;
  functionName?: string;
  sqlSchema?: string;
  availableModes?: GameMode[]; estimatedMinutes?: number;
  limits?: ExecutionLimits; tags?: string[];
  /** Only homologated execution profiles are enabled for remote judging. */
  executionAvailable?: boolean;
  prerequisites?: string[];
}
export interface Topic { id: TopicId; title: string; description: string; icon: string; available?: boolean }
export interface Language { id: LanguageId; label: string; monacoId: string; extension: string }
export interface ChallengeFilters { topicId?: TopicId; difficulty?: Difficulty; languageId?: LanguageId; mode?: GameMode; search?: string }
export type Verdict = 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'time_limit' | 'memory_limit' | 'output_limit' | 'infrastructure_error';
export type SubmissionStatus = 'queued' | 'running' | 'completed';
export interface PublicCaseResult { label: string; passed: boolean; input?: string; expected?: string; actual?: string }
export interface PublicSubmission {
  id: string; attemptId: string; status: SubmissionStatus; verdict?: Verdict;
  submittedAt: string; completedAt?: string; message?: string;
  publicCases?: PublicCaseResult[];
  metrics?: { cpuMs?: number; wallMs?: number; peakMemoryKiB?: number };
  xpAwarded?: number;
  /** Only trusted, calibrated measurements may populate this advisory field. */
  complexity?: { status: 'compatible' | 'inconclusive'; label: string; measuredRange?: [number, number] };
}
export interface Attempt {
  id: string; challengeId: string; challengeVersionId: string; mode: GameMode;
  startedAt: string; deadlineAt: string | null;
  status: 'active' | 'accepted' | 'failed' | 'expired' | 'abandoned';
  rejectedCount: number; pendingCount: number; hintsUsed: number;
  practiceOnly: boolean; solutionAvailable: boolean;
}
export interface SubmissionInput { challengeVersionId: string; attemptId: string; languageId: LanguageId; files: SourceFile[] }
export interface StartAttemptInput { challengeVersionId: string; mode: GameMode }
export interface RunInput extends SubmissionInput { customTests?: SourceFile[] }
export interface HintResult { text: string; hintsUsed: number; balance: number; rewardPercent: number }
export interface SolutionResult { files: SourceFile[]; explanation: string; practiceOnly: boolean }
export interface TutorInput { message: string; attemptId?: string; challengeVersionId?: string }
export interface TutorResult { message: string; source: 'ai' | 'editorial'; remainingToday: number }
export interface UserProfile { id: string; displayName: string; avatarUrl?: string; invited: boolean }
export interface Dashboard {
  profile: UserProfile; xp: number; level: number; xpIntoLevel: number; xpForNextLevel: number;
  completedCount: number; hintBalance: number; streakDays: number;
  completedChallengeIds: string[]; recentSubmissions: PublicSubmission[];
  /** UTC dates with completed challenges, independent of the recent-result limit. */
  activityDays?: string[];
  recommendations: Array<{ challengeId: string; reason: string }>;
  remoteRunsRemaining: number; tutorMessagesRemaining: number;
  executionStatus: 'available' | 'unconfigured' | 'quota_exhausted' | 'paused';
}
export interface RankingEntry { userId: string; displayName: string; xp: number; completedCount: number; reachedAt: string; isCurrentUser?: boolean }
export interface DraftInput { challengeId: string; languageId: LanguageId; files: SourceFile[]; updatedAt: string; revision?: number }
export interface AppGateway {
  readonly mode: 'demo' | 'live';
  listChallenges(filters?: ChallengeFilters): Promise<PublicChallenge[]>;
  getChallenge(idOrSlug: string): Promise<PublicChallenge>;
  getDashboard(): Promise<Dashboard>;
  getRanking(): Promise<RankingEntry[]>;
  startAttempt(input: StartAttemptInput, idempotencyKey: string): Promise<Attempt>;
  getAttempt(attemptId: string): Promise<Attempt>;
  run(input: RunInput, idempotencyKey: string): Promise<PublicSubmission>;
  submit(input: SubmissionInput, idempotencyKey: string): Promise<PublicSubmission>;
  getSubmission(id: string): Promise<PublicSubmission>;
  requestHint(attemptId: string, idempotencyKey: string): Promise<HintResult>;
  getSolution(challengeId: string, languageId: LanguageId, idempotencyKey: string): Promise<SolutionResult>;
  askTutor(input: TutorInput, idempotencyKey: string): Promise<TutorResult>;
  getDraft(challengeId: string, languageId: LanguageId): Promise<DraftInput | null>;
  saveDraft(input: DraftInput): Promise<DraftInput>;
  /** Explicit user choice only: keep local code over the latest remote draft. */
  resolveDraftConflict?(input: DraftInput): Promise<DraftInput>;
  signIn(provider: 'google' | 'github'): Promise<void>;
  signOut(): Promise<void>;
}
export class GatewayError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); this.name = 'GatewayError'; }
}
