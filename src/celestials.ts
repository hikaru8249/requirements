export interface CelestialDef {
  name: string;
  radius: number;
  color: string;
  glowColor: string;
  score: number;
}

export const CELESTIALS: CelestialDef[] = [
  { name: '隕石',   radius: 12, color: '#8b7355', glowColor: '#a08060', score: 1 },
  { name: '小惑星', radius: 20, color: '#6a5acd', glowColor: '#9080ff', score: 3 },
  { name: '衛星',   radius: 30, color: '#4682b4', glowColor: '#60a0e0', score: 9 },
  { name: '惑星',   radius: 44, color: '#228b22', glowColor: '#40c040', score: 27 },
  { name: '木星',   radius: 62, color: '#c8a87a', glowColor: '#e8c090', score: 81 },
];

export const MAX_LEVEL = CELESTIALS.length - 1;
