/**
 * The CLI's paired bootstrap, with the same generator and seeds, so the figure
 * on the page lands on exactly the interval the CLI printed. Mirrors
 * packages/agent-eval/src/stats/stats.ts; keep the two in step.
 */

export interface Estimate {
  mean: number;
  low: number;
  high: number;
  /** Every resampled estimate, in the order the generator produced them. */
  samples: number[];
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resample<T>(items: T[], random: () => number): T[] {
  return items.map(() => items[Math.floor(random() * items.length)]!);
}

function rate(outcomes: boolean[]): number {
  return outcomes.length === 0 ? 0 : outcomes.filter(Boolean).length / outcomes.length;
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function interval(samples: number[], mean: number, confidence = 0.95): Estimate {
  const sorted = [...samples].sort((a, b) => a - b);
  const tail = (1 - confidence) / 2;
  const last = sorted.length - 1;
  return {
    mean,
    low: sorted[Math.floor(tail * last)] ?? mean,
    high: sorted[Math.ceil((1 - tail) * last)] ?? mean,
    samples
  };
}

/** Difference in pass rate (candidate − reference), tasks resampled first, then runs. */
export function passRateDifference(reference: boolean[][], candidate: boolean[][], iterations = 2000): Estimate {
  const tasks = reference.map((ref, i) => ({ reference: ref, candidate: candidate[i] ?? [] }));
  const random = createRandom(20261002);
  const meanDifference = (sample: typeof tasks, inner: boolean): number => {
    let total = 0;
    for (const task of sample) {
      const ref = inner ? resample(task.reference, random) : task.reference;
      const cand = inner ? resample(task.candidate, random) : task.candidate;
      total += rate(cand) - rate(ref);
    }
    return total / sample.length;
  };

  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    samples.push(meanDifference(resample(tasks, random), true));
  }
  return interval(samples, meanDifference(tasks, false));
}

/** Relative change in a measurement (candidate ÷ reference − 1), paired the same way. */
export function relativeChange(reference: number[][], candidate: number[][], iterations = 2000): Estimate {
  const tasks = reference.map((ref, i) => ({ reference: ref, candidate: candidate[i] ?? [] }));
  const random = createRandom(20261003);
  const ratio = (sample: typeof tasks, inner: boolean): number => {
    let ref = 0;
    let cand = 0;
    for (const task of sample) {
      ref += average(inner ? resample(task.reference, random) : task.reference);
      cand += average(inner ? resample(task.candidate, random) : task.candidate);
    }
    return cand / ref - 1;
  };

  const mean = ratio(tasks, false);
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    samples.push(ratio(resample(tasks, random), true));
  }
  return interval(samples, mean);
}
