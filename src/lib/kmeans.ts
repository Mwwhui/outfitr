export interface KMeansResult {
  assignments: number[];
  centroids: number[][];
  sizes: number[];
  inertia: number;
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function hashSeed(data: number[][]): number {
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    if (!data[i]) continue;
    for (let j = 0; j < data[i].length; j++) {
      const v = data[i][j];
      if (v === undefined || v === null || !isFinite(v)) continue;
      hash = ((hash << 5) + hash) ^ (Math.round(v * 1e6) | 0);
      hash = hash >>> 0;
    }
  }
  return hash || 1;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kmeansPlusPlusInit(
  data: number[][],
  k: number,
  rng: () => number,
): number[] {
  const n = data.length;
  if (n === 0) return [];

  let firstIdx = Math.floor(rng() * n);
  if (!data[firstIdx]) firstIdx = 0;
  if (!data[firstIdx]) return [];

  const centroids: number[] = [firstIdx];
  const dists = new Float64Array(n);

  for (let c = 1; c < k; c++) {
    let total = 0;
    const lastCentroid = data[centroids[c - 1]];
    if (!lastCentroid) break;

    for (let i = 0; i < n; i++) {
      if (!data[i]) {
        dists[i] = Infinity;
        continue;
      }
      const d = euclidean(data[i], lastCentroid);
      dists[i] = d * d;
      total += dists[i];
    }
    if (total === 0) break;

    const r = rng() * total;
    let cumulative = 0;
    for (let i = 0; i < n; i++) {
      cumulative += dists[i];
      if (cumulative >= r) {
        centroids.push(i);
        break;
      }
    }
  }

  return centroids;
}

export function kMeans(
  data: number[][],
  k: number,
  maxIter = 100,
): KMeansResult {
  const n = data.length;
  if (n === 0) return { assignments: [], centroids: [], sizes: [], inertia: 0 };
  const d = data[0]?.length ?? 0;

  if (k > n) k = n;
  if (k < 1) k = 1;

  for (let i = 0; i < n; i++) {
    if (!data[i] || data[i].length === 0) {
      const fallbackCentroid = new Array(d || 1).fill(0);
      return {
        assignments: new Array(n).fill(0),
        centroids: [fallbackCentroid],
        sizes: [n],
        inertia: 0,
      };
    }
  }

  const rng = mulberry32(hashSeed(data));

  let bestAssignments: number[] = [];
  let bestCentroids: number[][] = [];
  let bestInertia = Infinity;

  const nInit = Math.min(10, Math.max(1, Math.floor(100 / n)));

  for (let run = 0; run < nInit; run++) {
    const centroidIndices = kmeansPlusPlusInit(data, k, rng);
    let centroids = centroidIndices.map((idx) => [...(data[idx] ?? data[0])]);
    while (centroids.length < k) {
      const fallback = [...(data[0] ?? new Array(d).fill(0))];
      centroids.push(fallback);
    }
    const assignments = new Int32Array(n);
    let changed = true;
    let iter = 0;

    while (changed && iter < maxIter) {
      changed = false;
      iter++;

      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        let bestCluster = 0;
        for (let c = 0; c < k; c++) {
          if (!centroids[c]) continue;
          const dist = euclidean(data[i], centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = c;
          }
        }
        if (assignments[i] !== bestCluster) {
          assignments[i] = bestCluster;
          changed = true;
        }
      }

      if (!changed) break;

      const newCentroids: number[][] = [];
      const counts = new Int32Array(k);

      for (let c = 0; c < k; c++) {
        newCentroids.push(new Array(d).fill(0));
      }
      for (let i = 0; i < n; i++) {
        const c = assignments[i];
        counts[c]++;
        for (let j = 0; j < d; j++) {
          newCentroids[c][j] += data[i][j];
        }
      }

      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let j = 0; j < d; j++) {
            newCentroids[c][j] /= counts[c];
          }
        } else {
          const src = data[Math.floor(rng() * n)] ?? data[0] ?? new Array(d).fill(0);
          newCentroids[c] = [...src];
        }
      }

      centroids = newCentroids;
    }

    let inertia = 0;
    for (let i = 0; i < n; i++) {
      if (centroids[assignments[i]]) {
        inertia += euclidean(data[i], centroids[assignments[i]]) ** 2;
      }
    }

    if (inertia < bestInertia) {
      bestInertia = inertia;
      bestAssignments = Array.from(assignments);
      bestCentroids = centroids;
    }
  }

  const sizes: number[] = new Array(k).fill(0);
  for (const a of bestAssignments) {
    sizes[a]++;
  }

  return {
    assignments: bestAssignments,
    centroids: bestCentroids,
    sizes,
    inertia: bestInertia,
  };
}
