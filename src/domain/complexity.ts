export type GrowthModel = 'constant' | 'logarithmic' | 'linear' | 'linear_logarithmic' | 'quadratic';
export interface BenchmarkSample { size: number; seed: number; cpuMs: number }
export interface GrowthDiagnostic {
  status: 'compatible' | 'inconclusive';
  label: string;
  model?: GrowthModel;
  measuredRange?: [number, number];
  relativePredictionError?: number;
}
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const models: Record<GrowthModel, (n: number) => number> = {
  constant: () => 1, logarithmic: n => Math.log2(n), linear: n => n,
  linear_logarithmic: n => n * Math.log2(n), quadratic: n => n * n,
};
const labels: Record<GrowthModel, string> = {
  constant: 'constante', logarithmic: 'logarítmico', linear: 'linear',
  linear_logarithmic: 'linear-logarítmico', quadratic: 'quadrático',
};
const inconclusive = (reason: string): GrowthDiagnostic => ({ status: 'inconclusive', label: reason });
/** Advisory only. Input must come from the protected supervisor, never stdout. */
export function diagnoseGrowth(input: {
  samples: readonly BenchmarkSample[];
  trustedSupervisor: boolean;
  eligibleModels: readonly GrowthModel[];
}): GrowthDiagnostic {
  if (!input.trustedSupervisor) return inconclusive('Métricas do supervisor indisponíveis');
  if (!input.samples.length || input.samples.some(item => !Number.isFinite(item.cpuMs) || item.cpuMs <= 0 || !Number.isSafeInteger(item.size) || item.size < 2)) return inconclusive('Amostras insuficientes ou inválidas');
  const sizes = [...new Set(input.samples.map(item => item.size))].sort((a, b) => a - b);
  if (sizes.length !== 6 || input.eligibleModels.length < 2) return inconclusive('São necessários seis tamanhos e modelos comparáveis');
  const points: Array<{ n: number; time: number }> = [];
  for (const n of sizes) {
    const group = input.samples.filter(item => item.size === n);
    const seeds = [...new Set(group.map(item => item.seed))];
    if (seeds.length < 3 || seeds.some(seed => group.filter(item => item.seed === seed).length < 5)) return inconclusive('São necessárias três sementes e cinco repetições por tamanho');
    const values = group.map(item => item.cpuMs);
    const time = median(values);
    if (median(values.map(value => Math.abs(value - time))) / time > 0.2) return inconclusive('Ruído elevado nas medições');
    points.push({ n, time });
  }
  const train = points.slice(0, 4);
  const candidates = [...new Set(input.eligibleModels)].map(model => {
    const transform = models[model];
    const xs = train.map(point => transform(point.n));
    const ys = train.map(point => point.time);
    const meanX = xs.reduce((sum, x) => sum + x, 0) / 4;
    const meanY = ys.reduce((sum, y) => sum + y, 0) / 4;
    const variance = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
    let slope = variance === 0 ? 0 : Math.max(0, xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0) / variance);
    let intercept = meanY - slope * meanX;
    if (intercept < 0) {
      intercept = 0;
      slope = xs.reduce((sum, x, index) => sum + x * ys[index], 0) / xs.reduce((sum, x) => sum + x * x, 0);
    }
    const error = points.slice(4).reduce((sum, point) => sum + Math.abs(intercept + slope * transform(point.n) - point.time) / point.time, 0) / 2;
    return { model, error };
  }).sort((a, b) => a.error - b.error);
  const [best, second] = candidates;
  if (!second || best.error > 0.2 || second.error - best.error < 0.05) return inconclusive('Os dados não distinguem os modelos com confiança');
  return {
    status: 'compatible', model: best.model,
    label: `Crescimento observado compatível com ${labels[best.model]}`,
    measuredRange: [sizes[0], sizes[5]], relativePredictionError: best.error,
  };
}
