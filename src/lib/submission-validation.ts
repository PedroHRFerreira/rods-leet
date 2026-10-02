import { GatewayError, type PublicSubmission, type Verdict } from "./contracts";

const verdicts: Verdict[] = [
  "accepted",
  "wrong_answer",
  "compile_error",
  "runtime_error",
  "time_limit",
  "memory_limit",
  "output_limit",
  "infrastructure_error",
];
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const identifier = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 256 &&
  value.trim() === value;
const date = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const nonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Refuse malformed successes before the workspace announces a result or awards XP. */
export function parsePublicSubmission(
  value: unknown,
  expected: { id?: string; attemptId?: string } = {},
): PublicSubmission {
  const fail = (): never => {
    throw new GatewayError(
      "invalid_response",
      "O serviço respondeu com um resultado inválido. Tente novamente.",
      502,
    );
  };
  if (!record(value)) return fail();
  if (
    !identifier(value.id) ||
    !identifier(value.attemptId) ||
    !date(value.submittedAt)
  )
    return fail();
  if (
    (expected.id !== undefined && value.id !== expected.id) ||
    (expected.attemptId !== undefined && value.attemptId !== expected.attemptId)
  )
    return fail();
  if (
    typeof value.status !== "string" ||
    !["queued", "running", "completed"].includes(value.status)
  )
    return fail();
  if (value.status === "completed") {
    if (!verdicts.includes(value.verdict as Verdict)) return fail();
  } else if (
    value.verdict !== undefined ||
    value.completedAt !== undefined ||
    (value.xpAwarded !== undefined && value.xpAwarded !== 0)
  )
    return fail();
  if (
    value.completedAt !== undefined &&
    (!date(value.completedAt) ||
      Date.parse(value.completedAt) < Date.parse(value.submittedAt))
  )
    return fail();
  if (
    value.xpAwarded !== undefined &&
    (!nonnegative(value.xpAwarded) ||
      !Number.isSafeInteger(value.xpAwarded) ||
      (value.xpAwarded > 0 && value.verdict !== "accepted"))
  )
    return fail();
  for (const key of ["message", "stdout", "stderr"])
    if (value[key] !== undefined && typeof value[key] !== "string")
      return fail();
  if (
    value.publicCases !== undefined &&
    (!Array.isArray(value.publicCases) ||
      !value.publicCases.every(
        (item: unknown) =>
          record(item) &&
          typeof item.label === "string" &&
          typeof item.passed === "boolean" &&
          ["input", "expected", "actual"].every(
            (key) => item[key] === undefined || typeof item[key] === "string",
          ),
      ))
  )
    return fail();
  if (
    value.metrics !== undefined &&
    (!record(value.metrics) ||
      ["cpuMs", "wallMs", "peakMemoryKiB"].some(
        (key) =>
          value.metrics &&
          record(value.metrics) &&
          value.metrics[key] !== undefined &&
          !nonnegative(value.metrics[key]),
      ))
  )
    return fail();
  if (value.complexity !== undefined) {
    const complexity = value.complexity;
    if (
      !record(complexity) ||
      typeof complexity.status !== "string" ||
      !["compatible", "inconclusive"].includes(complexity.status) ||
      typeof complexity.label !== "string"
    )
      return fail();
    const range = complexity.measuredRange;
    if (
      range !== undefined &&
      (!Array.isArray(range) ||
        range.length !== 2 ||
        !range.every(nonnegative) ||
        range[0] > range[1])
    )
      return fail();
  }
  return value as unknown as PublicSubmission;
}
