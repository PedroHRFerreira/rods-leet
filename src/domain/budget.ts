import { BETA_LIMITS } from "./rules";

export interface ExecutionReservation {
  id: string;
  userId: string;
  day: string;
  maxCostMicros: number;
  reservedAt: string;
  expiresAt: string;
  status: "active" | "settled";
  chargedMicros?: number;
  infrastructureFailure?: boolean;
}
export interface BudgetState {
  /** Confirmed non-renewing free credit. Zero keeps execution disabled. */
  confirmedCreditMicros: number;
  reservations: ExecutionReservation[];
  lastSandboxCreatedAt: string | null;
}
function utcDay(at: string) {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) throw new Error("Data inválida");
  return date.toISOString().slice(0, 10);
}
/** Pure preflight model; production must reserve inside one locked DB transaction. */
export function reserveExecution(
  state: BudgetState,
  input: {
    id: string;
    userId: string;
    serverNow: string;
    maxCostMicros: number;
  },
) {
  const existing = state.reservations.find(
    (reservation) => reservation.id === input.id,
  );
  if (existing) {
    if (
      existing.userId !== input.userId ||
      existing.maxCostMicros !== input.maxCostMicros
    )
      throw new Error("Reserva reutilizada com outros parâmetros");
    return state;
  }
  if (!Number.isSafeInteger(input.maxCostMicros) || input.maxCostMicros <= 0)
    throw new Error("O custo máximo precisa ser conhecido");
  if (state.confirmedCreditMicros <= 0)
    throw new Error("Execução indisponível: créditos não confirmados");
  const day = utcDay(input.serverNow);
  const now = Date.parse(input.serverNow);
  // Expired reservations remain financially reserved until reconciled.
  const active = state.reservations.filter(
    (item) => item.status === "active" && Date.parse(item.expiresAt) > now,
  );
  if (active.length >= BETA_LIMITS.globalConcurrency)
    throw new Error("A fila está cheia");
  if (active.some((item) => item.userId === input.userId))
    throw new Error("Você já tem uma execução em andamento");
  if (
    state.lastSandboxCreatedAt &&
    now - Date.parse(state.lastSandboxCreatedAt) <
      BETA_LIMITS.creationIntervalMs
  )
    throw new Error("Aguarde a próxima janela de execução");
  const daily = state.reservations.filter((item) => item.day === day);
  const cost = (items: ExecutionReservation[]) =>
    items.reduce(
      (sum, item) =>
        sum +
        (item.status === "settled" ? item.chargedMicros! : item.maxCostMicros),
      0,
    );
  if (cost(daily) + input.maxCostMicros > BETA_LIMITS.dailyCreditMicros)
    throw new Error("Orçamento diário esgotado");
  if (
    cost(state.reservations) + input.maxCostMicros >
    Math.floor(
      state.confirmedCreditMicros * BETA_LIMITS.availableCreditFraction,
    )
  )
    throw new Error("Saldo de créditos reservado esgotado");
  return {
    ...state,
    lastSandboxCreatedAt: input.serverNow,
    reservations: [
      ...state.reservations,
      {
        id: input.id,
        userId: input.userId,
        day,
        maxCostMicros: input.maxCostMicros,
        reservedAt: input.serverNow,
        expiresAt: new Date(now + 180_000).toISOString(),
        status: "active" as const,
      },
    ],
  };
}
export function settleExecution(
  state: BudgetState,
  input: {
    id: string;
    actualCostMicros?: number;
    infrastructureFailure: boolean;
  },
): BudgetState {
  const reservation = state.reservations.find((item) => item.id === input.id);
  if (!reservation) throw new Error("Reserva não encontrada");
  if (reservation.status === "settled") return state;
  const chargedMicros = input.actualCostMicros ?? reservation.maxCostMicros;
  if (
    !Number.isSafeInteger(chargedMicros) ||
    chargedMicros < 0 ||
    chargedMicros > reservation.maxCostMicros
  )
    throw new Error(
      "Custo fora da reserva: reconciliar provedor antes de novas execuções",
    );
  return {
    ...state,
    reservations: state.reservations.map((item) =>
      item.id === input.id
        ? {
            ...item,
            status: "settled",
            chargedMicros,
            infrastructureFailure: input.infrastructureFailure,
          }
        : item,
    ),
  };
}
