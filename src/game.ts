import { PhysicsWorld } from './physics';
import type { CelestialBody } from './physics';
import { Renderer } from './renderer';
import { AudioManager } from './audio';
import { CELESTIALS, MAX_LEVEL } from './celestials';

const COOLDOWN = 0.5;
const FIELD_RADIUS = 220;

export class Game {
  private world: PhysicsWorld;
  private renderer: Renderer;
  private audio = new AudioManager();

  private canvas: HTMLCanvasElement;
  private score = 0;
  private hiScore = 0;
  private nextLevel = 0;
  private angle = 0;
  private cooldown = 0;
  private gameOver = false;
  private lastTime = 0;

  private mergeScales = new Map<number, number>();
  private pendingMerge: Array<{ bodies: CelestialBody[]; level: number }> = [];
  private lastLaunched: CelestialBody | null = null;

  private scoreEl: HTMLElement;
  private hiScoreEl: HTMLElement;
  private overlay: HTMLElement;
  private finalScoreEl: HTMLElement;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const hudHeight = document.getElementById('hud')!.offsetHeight
      + (document.getElementById('next-area')!.offsetHeight) + 32;
    const size = Math.min(window.innerWidth - 16, window.innerHeight - hudHeight - 16, 500);
    const canvasSize = Math.max(size, 280);
    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;

    const cx = canvasSize / 2;
    const cy = canvasSize / 2;
    const fr = Math.min(FIELD_RADIUS, canvasSize / 2 - 10);

    this.world = new PhysicsWorld(fr, cx, cy);
    const nextCanvas = document.getElementById('next-canvas') as HTMLCanvasElement;
    this.renderer = new Renderer(this.canvas, nextCanvas, this.world);

    this.scoreEl = document.getElementById('score')!;
    this.hiScoreEl = document.getElementById('hiscore')!;
    this.overlay = document.getElementById('overlay')!;
    this.finalScoreEl = document.getElementById('final-score')!;

    this.hiScore = parseInt(localStorage.getItem('planetmerge_hiscore') ?? '0');
    this.hiScoreEl.textContent = String(this.hiScore);

    this.nextLevel = this.randomLevel();
    this.setupInput();
    document.getElementById('retry-btn')!.addEventListener('click', () => this.restart());
  }

  private randomLevel(): number {
    const weights = [0.4, 0.3, 0.2, 0.1, 0];
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (r < acc) return i;
    }
    return 0;
  }

  private setupInput() {
    const canvas = this.canvas;

    const updateAngle = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const dx = clientX - rect.left - canvas.width / 2;
      const dy = clientY - rect.top - canvas.height / 2;
      this.angle = Math.atan2(dy, dx);
    };

    canvas.addEventListener('mousemove', e => updateAngle(e.clientX, e.clientY));
    canvas.addEventListener('click', e => {
      updateAngle(e.clientX, e.clientY);
      this.launch();
    });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      updateAngle(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (e.changedTouches.length > 0) {
        updateAngle(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
      this.launch();
    }, { passive: false });
  }

  private isReadyToLaunch(): boolean {
    if (!this.lastLaunched) return true;
    if (!this.world.getBodies().includes(this.lastLaunched)) {
      this.lastLaunched = null;
      return true;
    }
    if (this.world.hasLanded(this.lastLaunched)) {
      this.lastLaunched = null;
      return true;
    }
    return false;
  }

  private launch() {
    if (this.gameOver || this.cooldown > 0 || !this.isReadyToLaunch()) return;
    const { fieldRadius: fr, centerX: cx, centerY: cy } = this.world;
    const def = CELESTIALS[this.nextLevel];
    const spawnR = fr - def.radius - 6;
    const x = cx + spawnR * Math.cos(this.angle);
    const y = cy + spawnR * Math.sin(this.angle);

    this.lastLaunched = this.world.addCelestial(x, y, this.nextLevel);
    this.audio.playLaunch();
    this.cooldown = COOLDOWN;
    this.nextLevel = this.randomLevel();
  }

  private checkMerges() {
    for (let level = 0; level <= MAX_LEVEL; level++) {
      const clusters = this.world.getContactClusters(level);
      for (const cluster of clusters) {
        cluster.forEach(cb => (cb.merging = true));
        this.pendingMerge.push({ bodies: cluster, level });
      }
    }

    for (const { bodies, level } of this.pendingMerge) {
      let cx = 0, cy = 0;
      for (const cb of bodies) {
        cx += cb.body.position.x;
        cy += cb.body.position.y;
      }
      cx /= bodies.length;
      cy /= bodies.length;

      for (const cb of bodies) {
        this.world.removeCelestial(cb);
      }

      const gained = CELESTIALS[level].score * bodies.length;
      this.score += gained;
      this.scoreEl.textContent = String(this.score);
      this.renderer.addMergeEffect(cx, cy, level);
      this.renderer.addScorePopup(cx, cy, gained);
      this.audio.playMerge(level);

      if (level < MAX_LEVEL) {
        const newCb = this.world.addCelestial(cx, cy, level + 1);
        this.mergeScales.set(newCb.body.id, 0.1);
      }
    }
    this.pendingMerge = [];
  }

  private checkGameOver() {
    for (const cb of this.world.getBodies()) {
      if (this.world.isOutsideField(cb)) {
        this.triggerGameOver();
        return;
      }
    }
  }

  private triggerGameOver() {
    this.gameOver = true;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      localStorage.setItem('planetmerge_hiscore', String(this.hiScore));
      this.hiScoreEl.textContent = String(this.hiScore);
    }
    this.audio.playGameOver();
    this.finalScoreEl.textContent = `Score: ${this.score}${this.score >= this.hiScore ? ' 🏆 NEW RECORD!' : ''}`;
    this.overlay.classList.add('visible');
  }

  private restart() {
    // rebuild the page to reset physics state cleanly
    location.reload();
  }

  start() {
    requestAnimationFrame(t => this.loop(t));
  }

  private loop(time: number) {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    if (!this.gameOver) {
      this.world.step(dt * 1000);
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.checkMerges();
      this.checkGameOver();

      // animate merge scales
      for (const [id, scale] of this.mergeScales) {
        const newScale = Math.min(1, scale + dt * 4);
        if (newScale >= 1) this.mergeScales.delete(id);
        else this.mergeScales.set(id, newScale);
      }
    }

    const blocked = !this.gameOver && !this.isReadyToLaunch();
    this.renderer.draw(
      this.gameOver ? null : this.angle,
      this.nextLevel,
      this.gameOver,
      this.mergeScales,
      dt,
      blocked,
    );

    requestAnimationFrame(t => this.loop(t));
  }
}
