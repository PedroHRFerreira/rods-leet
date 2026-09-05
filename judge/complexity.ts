/** Advisory analysis only. Never use this module to grant or reject a submission. */
export type GrowthModel =
  "constant" | "logarithmic" | "linear" | "linear-logarithmic" | "quadratic";
export interface Measurement {
  n: number;
  seed: number;
  samplesMs: number[];
  /** Only a protected supervisor may set this field. Student output is not telemetry. */
  source: "supervisor";
  dimensions?: Record<string, number>;
}
export interface ComplexityProfile {
  challengeId: string;
  languageId: string;
  runtimeId: string;
  environmentId: string;
  parameter: "n";
  models: GrowthModel[];
  /** A human-reviewed calibration is required before publishing a diagnosis. */
  calibrated: boolean;
}
export interface ComplexityDiagnosis {
  status: "compatible" | "inconclusive";
  label: string;
  measuredRange?: [number, number];
  model?: GrowthModel;
  validationError?: number;
  relativeDispersion?: number;
  sampleCount: number;
}

const models: Record<GrowthModel, (n: number) => number> = {
  constant: () => 1,
  logarithmic: (n) => Math.log2(Math.max(2, n)),
  linear: (n) => n,
  "linear-logarithmic": (n) => n * Math.log2(Math.max(2, n)),
  quadratic: (n) => n * n,
};
const labels: Record<GrowthModel, string> = {
  constant: "constante",
  logarithmic: "logarítmico",
  linear: "linear",
  "linear-logarithmic": "linear-logarítmico",
  quadratic: "quadrático",
};
const median = (values: number[]) => {
  const a = [...values].sort((x, y) => x - y),
    mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};

export function diagnoseGrowth(
  profile: ComplexityProfile,
  measurements: Measurement[],
): ComplexityDiagnosis {
  const sampleCount = measurements.reduce((n, m) => n + m.samplesMs.length, 0);
  const inconclusive = (reason: string): ComplexityDiagnosis => ({
    status: "inconclusive",
    label: `Diagnóstico inconclusivo: ${reason}.`,
    sampleCount,
  });
  if (!profile.calibrated) return inconclusive("perfil ainda não homologado");
  if (!profile.models.length || profile.models.some((model) => !models[model]))
    return inconclusive("modelos inválidos");
  if (
    measurements.some(
      (m) =>
        m.source !== "supervisor" ||
        !Number.isFinite(m.n) ||
        m.n <= 0 ||
        m.samplesMs.length < 5 ||
        m.samplesMs.some((t) => !Number.isFinite(t) || t <= 0),
    )
  )
    return inconclusive("medições insuficientes ou inválidas");
  if (
    measurements.some(
      (m) =>
        m.dimensions && Object.keys(m.dimensions).some((key) => key !== "n"),
    )
  )
    return inconclusive(
      "o problema possui múltiplos parâmetros; este perfil univariado não se aplica",
    );
  const sizes = [...new Set(measurements.map((m) => m.n))].sort(
    (a, b) => a - b,
  );
  if (sizes.length < 6)
    return inconclusive("são necessários pelo menos seis tamanhos");
  const chosen = sizes.slice(0, 6);
  if (chosen.some((n, i) => i > 0 && n / chosen[i - 1] < 1.5))
    return inconclusive("intervalo de tamanhos muito estreito");
  const rows: Array<{ n: number; time: number; dispersion: number }> = [];
  for (const n of chosen) {
    const atSize = measurements.filter((m) => m.n === n);
    if (new Set(atSize.map((m) => m.seed)).size < 3)
      return inconclusive("são necessárias três sementes por tamanho");
    const times = atSize.flatMap((m) => m.samplesMs),
      time = median(times);
    const dispersion = median(times.map((t) => Math.abs(t - time))) / time;
    rows.push({ n, time, dispersion });
  }
  const relativeDispersion = Math.max(...rows.map((row) => row.dispersion));
  if (relativeDispersion > 0.15)
    return inconclusive("ruído entre as amostras impede distinguir os modelos");
  const candidates = [...new Set(profile.models)]
    .map((model) => {
      const train = rows.slice(0, 4),
        x = train.map((row) => models[model](row.n)),
        y = train.map((row) => row.time);
      const meanX = x.reduce((a, b) => a + b, 0) / x.length,
        meanY = y.reduce((a, b) => a + b, 0) / y.length;
      const variance = x.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
      let slope = variance
        ? x.reduce(
            (sum, value, i) => sum + (value - meanX) * (y[i] - meanY),
            0,
          ) / variance
        : 0;
      let intercept = meanY - slope * meanX;
      if (intercept < 0) {
        intercept = 0;
        slope =
          x.reduce((sum, value, i) => sum + value * y[i], 0) /
          x.reduce((sum, value) => sum + value * value, 0);
      }
      if (slope < 0) {
        slope = 0;
        intercept = meanY;
      }
      const validationError =
        rows
          .slice(4)
          .reduce(
            (sum, row) =>
              sum +
              Math.abs(intercept + slope * models[model](row.n) - row.time) /
                row.time,
            0,
          ) / 2;
      return { model, validationError };
    })
    .sort((a, b) => a.validationError - b.validationError);
  const best = candidates[0];
  if (best.validationError > 0.2)
    return inconclusive(
      "nenhum modelo prevê os maiores tamanhos com erro aceitável",
    );
  if (
    candidates[1] &&
    candidates[1].validationError - best.validationError < 0.05
  )
    return inconclusive("mais de um modelo explica os dados");
  return {
    status: "compatible",
    model: best.model,
    label: `Crescimento observado compatível com ${labels[best.model]} entre ${chosen[0]} e ${chosen[5]} elementos.`,
    measuredRange: [chosen[0], chosen[5]],
    validationError: best.validationError,
    relativeDispersion,
    sampleCount,
  };
}
