import Matter from 'matter-js';
import { CELESTIALS } from './celestials';

const { Engine, Bodies, Body, World } = Matter;

export interface CelestialBody {
  body: Matter.Body;
  level: number;
  merging: boolean;
}

export class PhysicsWorld {
  engine: Matter.Engine;
  private bodies: CelestialBody[] = [];
  readonly fieldRadius: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly coreRadius: number;
  readonly bodyScale: number;
  private gravity = 0.0004;
  private wallBodies: Matter.Body[] = [];

  constructor(fieldRadius: number, centerX: number, centerY: number, bodyScale: number) {
    this.fieldRadius = fieldRadius;
    this.centerX = centerX;
    this.centerY = centerY;
    this.bodyScale = bodyScale;
    this.coreRadius = Math.round(28 * bodyScale);

    this.engine = Engine.create({ gravity: { x: 0, y: 0 } });
    this.buildWalls();
    this.buildCore();
  }

  // スケール済み半径を返すヘルパー
  r(level: number): number {
    return CELESTIALS[level].radius * this.bodyScale;
  }

  private buildWalls() {
    const segments = 64;
    const r = this.fieldRadius;
    const cx = this.centerX;
    const cy = this.centerY;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const len = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const wall = Bodies.rectangle(mx, my, len + 1, 8, {
        isStatic: true,
        angle,
        label: 'wall',
        friction: 0.2,
        restitution: 0.3,
        collisionFilter: { category: 0x0002, mask: 0x0001 },
      });
      this.wallBodies.push(wall);
    }
    World.add(this.engine.world, this.wallBodies);
  }

  private buildCore() {
    const core = Bodies.circle(this.centerX, this.centerY, this.coreRadius, {
      isStatic: true,
      label: 'core',
      restitution: 0.5,
      friction: 0.3,
      collisionFilter: { category: 0x0002, mask: 0x0001 },
    });
    World.add(this.engine.world, core);
  }

  addCelestial(x: number, y: number, level: number): CelestialBody {
    const body = Bodies.circle(x, y, this.r(level), {
      restitution: 0.35,
      friction: 0.08,
      frictionAir: 0.01,
      density: 0.002,
      label: `celestial_${level}`,
      collisionFilter: { category: 0x0001, mask: 0x0001 | 0x0002 },
    });
    (body as any).celestialLevel = level;
    World.add(this.engine.world, body);
    const cb: CelestialBody = { body, level, merging: false };
    this.bodies.push(cb);
    return cb;
  }

  removeCelestial(cb: CelestialBody) {
    World.remove(this.engine.world, cb.body);
    this.bodies = this.bodies.filter(b => b !== cb);
  }

  getBodies(): CelestialBody[] {
    return this.bodies;
  }

  applyGravity() {
    for (const cb of this.bodies) {
      const dx = this.centerX - cb.body.position.x;
      const dy = this.centerY - cb.body.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = { x: dx / dist * this.gravity, y: dy / dist * this.gravity };
      Body.applyForce(cb.body, cb.body.position, force);
    }
  }

  step(delta: number) {
    this.applyGravity();
    Engine.update(this.engine, delta);
  }

  isOutsideField(cb: CelestialBody): boolean {
    const dx = cb.body.position.x - this.centerX;
    const dy = cb.body.position.y - this.centerY;
    return Math.sqrt(dx * dx + dy * dy) + this.r(cb.level) > this.fieldRadius - 2;
  }

  getContactClusters(level: number): CelestialBody[][] {
    const same = this.bodies.filter(b => b.level === level && !b.merging);
    if (same.length < 3) return [];

    const visited = new Set<CelestialBody>();
    const clusters: CelestialBody[][] = [];

    for (const start of same) {
      if (visited.has(start)) continue;
      const cluster: CelestialBody[] = [];
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        cluster.push(cur);
        for (const other of same) {
          if (visited.has(other)) continue;
          if (this.areTouching(cur, other)) queue.push(other);
        }
      }
      if (cluster.length >= 3) clusters.push(cluster);
    }
    return clusters;
  }

  hasLanded(cb: CelestialBody): boolean {
    const dx = cb.body.position.x - this.centerX;
    const dy = cb.body.position.y - this.centerY;
    const distToCore = Math.sqrt(dx * dx + dy * dy);
    if (distToCore <= this.coreRadius + this.r(cb.level) + 6) return true;
    for (const other of this.bodies) {
      if (other === cb) continue;
      if (this.areTouching(cb, other)) return true;
    }
    return false;
  }

  private areTouching(a: CelestialBody, b: CelestialBody): boolean {
    const dx = a.body.position.x - b.body.position.x;
    const dy = a.body.position.y - b.body.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.r(a.level) + this.r(b.level) + 4;
  }
}
