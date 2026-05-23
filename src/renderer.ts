import type { PhysicsWorld } from './physics';
import { CELESTIALS, MAX_LEVEL } from './celestials';

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

export interface ScorePopup {
  x: number; y: number;
  text: string;
  life: number;
}

interface ReadyPing {
  x: number;
  y: number;
  life: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private nextCtx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private popups: ScorePopup[] = [];
  private readyPings: ReadyPing[] = [];
  private corePhase = 0;
  private rimPhase = 0;
  private wasBlocked = false;
  private canvas: HTMLCanvasElement;
  private world: PhysicsWorld;

  constructor(
    canvas: HTMLCanvasElement,
    nextCanvas: HTMLCanvasElement,
    world: PhysicsWorld,
  ) {
    this.canvas = canvas;
    this.world = world;
    this.ctx = canvas.getContext('2d')!;
    this.nextCtx = nextCanvas.getContext('2d')!;
  }

  addMergeEffect(x: number, y: number, level: number) {
    const def = CELESTIALS[Math.min(level + 1, MAX_LEVEL)];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        color: def.glowColor,
        radius: 2 + Math.random() * 4,
      });
    }
  }

  addScorePopup(x: number, y: number, score: number) {
    this.popups.push({ x, y, text: `+${score}`, life: 1.5 });
  }

  draw(
    angle: number | null,
    nextLevel: number,
    gameOver: boolean,
    mergeScales: Map<number, number>,
    dt: number,
    blocked = false,
  ) {
    const ctx = this.ctx;
    const { fieldRadius: fr, centerX: cx, centerY: cy, coreRadius } = this.world;

    // ブロック解除の瞬間を検知してピンを発火
    if (this.wasBlocked && !blocked && angle !== null && !gameOver) {
      const rx = cx + fr * Math.cos(angle);
      const ry = cy + fr * Math.sin(angle);
      this.readyPings.push({ x: rx, y: ry, life: 1 });
    }
    this.wasBlocked = blocked;

    this.rimPhase += dt * 4;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawStarfield(ctx);
    this.drawField(ctx, cx, cy, fr);
    this.drawCore(ctx, cx, cy, coreRadius, dt);
    this.drawBodies(ctx, mergeScales);
    this.drawParticles(ctx, dt);
    this.drawPopups(ctx, dt);
    this.drawReadyPings(ctx, dt);

    if (angle !== null && !gameOver) {
      if (blocked) {
        this.drawBlockedIndicator(ctx, cx, cy, fr, angle, nextLevel);
      } else {
        this.drawIndicator(ctx, cx, cy, fr, angle, nextLevel);
      }
    }

    this.drawNextCelestial(nextLevel);
  }

  private drawStarfield(_ctx: CanvasRenderingContext2D) {
    // static stars skipped for performance
  }

  private drawField(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    grad.addColorStop(0, 'rgba(10,10,40,0.95)');
    grad.addColorStop(1, 'rgba(0,0,10,0.98)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(100,140,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private drawCore(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, dt: number) {
    this.corePhase += dt * 1.8;
    const pulse = 1 + 0.07 * Math.sin(this.corePhase);

    ctx.save();
    ctx.translate(cx, cy);

    // コロナ外輝(大きい光の輪)
    const corona = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 3.5);
    corona.addColorStop(0, 'rgba(255,200,40,0.35)');
    corona.addColorStop(0.4, 'rgba(255,120,10,0.15)');
    corona.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.beginPath(); ctx.arc(0, 0, r * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = corona; ctx.fill();

    // 光芒(プロミネンス風の細い光線)
    const rays = 12;
    ctx.save();
    ctx.rotate(this.corePhase * 0.15);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const len = r * (1.4 + 0.3 * Math.sin(this.corePhase * 1.3 + i));
      ctx.save();
      ctx.rotate(a);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ffcc20';
      ctx.beginPath();
      ctx.moveTo(r * 0.85, 0);
      ctx.lineTo(len, -r * 0.12);
      ctx.lineTo(len * 1.05, 0);
      ctx.lineTo(len, r * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 球体本体
    const ballR = r * pulse;
    const g = ctx.createRadialGradient(-ballR * 0.3, -ballR * 0.3, 0, 0, 0, ballR);
    g.addColorStop(0, '#fff8c0');
    g.addColorStop(0.35, '#ffdd30');
    g.addColorStop(0.75, '#ff9900');
    g.addColorStop(1, '#cc4400');
    ctx.beginPath(); ctx.arc(0, 0, ballR, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ffaa00';
    ctx.fill();

    // 表面の粒状対流(小さなまだら)
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, ballR, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ff6600';
    for (const [ox, oy, sr] of [
      [0.3, 0.25, 0.38], [-0.35, -0.2, 0.28], [0.1, -0.4, 0.22], [-0.2, 0.4, 0.3],
    ] as [number,number,number][]) {
      ctx.beginPath(); ctx.arc(ox * ballR, oy * ballR, sr * ballR, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  private drawBodies(ctx: CanvasRenderingContext2D, mergeScales: Map<number, number>) {
    for (const cb of this.world.getBodies()) {
      const def = CELESTIALS[cb.level];
      const { x, y } = cb.body.position;
      const scale = mergeScales.get(cb.body.id) ?? 1;
      const r = def.radius * scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(cb.body.angle);
      ctx.shadowBlur = 14;
      ctx.shadowColor = def.glowColor;

      this.drawPlanet(ctx, r, cb.level);

      ctx.restore();
    }
  }

  private drawPlanet(ctx: CanvasRenderingContext2D, r: number, level: number) {
    switch (level) {
      case 0: this.drawMeteor(ctx, r); break;
      case 1: this.drawMoon(ctx, r); break;
      case 2: this.drawMars(ctx, r); break;
      case 3: this.drawEarth(ctx, r); break;
      case 4: this.drawJupiter(ctx, r); break;
      default: this.drawMeteor(ctx, r);
    }
  }

  // Level 0: 隕石 — 暗い岩石、心配そうな顔
  private drawMeteor(ctx: CanvasRenderingContext2D, r: number) {
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
    g.addColorStop(0, '#b0a090');
    g.addColorStop(0.6, '#7a6a55');
    g.addColorStop(1, '#3d3020');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    // クレーター
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#2a2010';
    for (const [ox, oy, cr] of [[-r*0.3, r*0.2, r*0.18], [r*0.35, -r*0.15, r*0.13], [-r*0.1, -r*0.35, r*0.1]] as [number,number,number][]) {
      ctx.beginPath(); ctx.arc(ox, oy, cr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    this.drawFace(ctx, r, 'worried');
  }

  // Level 1: 小惑星 → 月(Moon) — グレー、クレーター多め、眠そうな顔
  private drawMoon(ctx: CanvasRenderingContext2D, r: number) {
    const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 0, 0, 0, r);
    g.addColorStop(0, '#e8e0d0');
    g.addColorStop(0.7, '#c0b8a8');
    g.addColorStop(1, '#807868');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    // クレーター
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#9a9080';
    for (const [ox, oy, cr] of [[-r*0.4, r*0.3, r*0.2], [r*0.3, r*0.25, r*0.15], [r*0.15, -r*0.4, r*0.12], [-r*0.2, -r*0.2, r*0.1]] as [number,number,number][]) {
      ctx.beginPath(); ctx.arc(ox, oy, cr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    this.drawFace(ctx, r, 'sleepy');
  }

  // Level 2: 衛星 → 火星(Mars) — 赤茶色、砂嵐模様、悪そうな顔
  private drawMars(ctx: CanvasRenderingContext2D, r: number) {
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, 0, 0, 0, r);
    g.addColorStop(0, '#e8825a');
    g.addColorStop(0.5, '#c05030');
    g.addColorStop(1, '#7a2810');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    // 極冠(北極の白い帽子)
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#f0ece8';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.75, r * 0.25, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    // 暗い斑点
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#601800';
    ctx.beginPath(); ctx.ellipse(-r*0.2, r*0.1, r*0.4, r*0.2, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    this.drawFace(ctx, r, 'angry');
  }

  // Level 3: 惑星 → 地球(Earth) — 青緑、大陸あり、笑顔
  private drawEarth(ctx: CanvasRenderingContext2D, r: number) {
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.25, 0, 0, 0, r);
    g.addColorStop(0, '#5ab4e8');
    g.addColorStop(0.6, '#1a7ac0');
    g.addColorStop(1, '#0a3a70');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    // 大陸
    ctx.save();
    ctx.clip(); // 円の中にクリップ
    ctx.fillStyle = '#3a9a40';
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(-r*0.15, -r*0.1, r*0.38, r*0.28, 0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.32, r*0.25, r*0.22, r*0.32, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-r*0.28, r*0.38, r*0.18, r*0.14, 0.6, 0, Math.PI*2); ctx.fill();
    // 雲
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(r*0.1, -r*0.35, r*0.3, r*0.1, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    this.drawFace(ctx, r, 'happy');
  }

  // Level 4: 木星(Jupiter) — ベージュ+茶色の縞模様、大赤斑、誇らしげな顔
  private drawJupiter(ctx: CanvasRenderingContext2D, r: number) {
    // ベースの球体グラデーション
    const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 0, 0, 0, r);
    g.addColorStop(0, '#f5e8c8');
    g.addColorStop(0.5, '#c8a87a');
    g.addColorStop(1, '#8a6040');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();

    // 横縞(円にクリップして描画)
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();

    const bands: Array<[number, number, string]> = [
      [-r * 0.85, r * 0.14, 'rgba(160,100,55,0.75)'],
      [-r * 0.60, r * 0.12, 'rgba(230,200,155,0.65)'],
      [-r * 0.42, r * 0.16, 'rgba(140,85,45,0.80)'],
      [-r * 0.18, r * 0.13, 'rgba(210,175,130,0.60)'],
      [ r * 0.02, r * 0.18, 'rgba(155,95,50,0.75)'],
      [ r * 0.26, r * 0.13, 'rgba(225,195,150,0.60)'],
      [ r * 0.46, r * 0.15, 'rgba(145,88,48,0.70)'],
      [ r * 0.68, r * 0.18, 'rgba(200,165,115,0.55)'],
    ];
    for (const [cy, h, color] of bands) {
      ctx.fillStyle = color;
      ctx.fillRect(-r, cy, r * 2, h);
    }

    // 大赤斑(Great Red Spot)
    ctx.save();
    ctx.translate(r * 0.25, r * 0.18);
    const spotG = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.22);
    spotG.addColorStop(0, 'rgba(200,60,30,0.95)');
    spotG.addColorStop(0.6, 'rgba(180,50,20,0.7)');
    spotG.addColorStop(1, 'rgba(160,40,10,0)');
    ctx.fillStyle = spotG;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
    this.drawFace(ctx, r, 'proud');
  }

  private drawFace(ctx: CanvasRenderingContext2D, r: number, expression: 'happy'|'sleepy'|'worried'|'angry'|'proud') {
    if (r < 10) return;
    ctx.save();
    ctx.shadowBlur = 0;

    const eyeY = -r * 0.08;
    const eyeX = r * 0.22;
    const eyeR = Math.max(1.5, r * 0.1);
    const pupilR = eyeR * 0.55;

    // 目(白目)
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(-eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();

    // 表情別の目の形
    ctx.fillStyle = '#1a1a1a';
    switch (expression) {
      case 'sleepy':
        // 半目
        ctx.beginPath(); ctx.arc(-eyeX, eyeY + pupilR*0.3, pupilR, Math.PI, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX, eyeY + pupilR*0.3, pupilR, Math.PI, Math.PI*2); ctx.fill();
        // まぶた
        ctx.fillStyle = CELESTIALS[1].color;
        ctx.beginPath(); ctx.arc(-eyeX, eyeY, eyeR, Math.PI, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, Math.PI, Math.PI*2); ctx.fill();
        break;
      case 'worried':
        ctx.beginPath(); ctx.arc(-eyeX, eyeY, pupilR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX, eyeY, pupilR, 0, Math.PI * 2); ctx.fill();
        // 眉(への字)
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = Math.max(1, r * 0.06);
        ctx.beginPath(); ctx.moveTo(-eyeX - eyeR, eyeY - eyeR * 1.6); ctx.lineTo(-eyeX + eyeR * 0.5, eyeY - eyeR * 2.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(eyeX + eyeR, eyeY - eyeR * 1.6); ctx.lineTo(eyeX - eyeR * 0.5, eyeY - eyeR * 2.2); ctx.stroke();
        break;
      case 'angry':
        ctx.beginPath(); ctx.arc(-eyeX, eyeY, pupilR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX, eyeY, pupilR, 0, Math.PI * 2); ctx.fill();
        // 眉(怒り)
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = Math.max(1.5, r * 0.07);
        ctx.beginPath(); ctx.moveTo(-eyeX - eyeR, eyeY - eyeR * 1.8); ctx.lineTo(-eyeX + eyeR, eyeY - eyeR * 1.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(eyeX + eyeR, eyeY - eyeR * 1.8); ctx.lineTo(eyeX - eyeR, eyeY - eyeR * 1.2); ctx.stroke();
        break;
      default:
        // happy / proud — 普通の丸い瞳
        ctx.beginPath(); ctx.arc(-eyeX, eyeY, pupilR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX, eyeY, pupilR, 0, Math.PI * 2); ctx.fill();
    }

    // 口
    const mouthY = r * 0.28;
    const mouthW = r * 0.3;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = Math.max(1.2, r * 0.065);
    ctx.lineCap = 'round';
    ctx.beginPath();
    switch (expression) {
      case 'happy':
      case 'proud':
        ctx.arc(0, mouthY - mouthW * 0.5, mouthW, 0.2, Math.PI - 0.2);
        break;
      case 'sleepy':
        ctx.moveTo(-mouthW * 0.5, mouthY); ctx.lineTo(mouthW * 0.5, mouthY);
        break;
      case 'worried':
        ctx.arc(0, mouthY + mouthW * 0.5, mouthW, Math.PI + 0.3, -0.3);
        break;
      case 'angry':
        ctx.arc(0, mouthY + mouthW * 0.6, mouthW, Math.PI + 0.2, -0.2);
        break;
    }
    ctx.stroke();

    // proudの場合はほっぺに赤み
    if (expression === 'proud') {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ff6060';
      ctx.beginPath(); ctx.ellipse(-eyeX - eyeR * 0.3, mouthY - r*0.15, eyeR*0.9, eyeR*0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(eyeX + eyeR * 0.3, mouthY - r*0.15, eyeR*0.9, eyeR*0.6, 0, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPopups(ctx: CanvasRenderingContext2D, dt: number) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.y -= 1;
      if (p.life <= 0) { this.popups.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = '#ffee88';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ffaa00';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  private drawIndicator(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, fr: number,
    angle: number, nextLevel: number,
  ) {
    const def = CELESTIALS[nextLevel];
    const ix = cx + (fr - def.radius - 4) * Math.cos(angle);
    const iy = cy + (fr - def.radius - 4) * Math.sin(angle);

    // trajectory line — spawn位置からコア付近まで延長
    ctx.save();
    const lineEnd = this.world.coreRadius + 18;
    const grad2 = ctx.createLinearGradient(
      ix, iy,
      cx + lineEnd * Math.cos(angle), cy + lineEnd * Math.sin(angle),
    );
    grad2.addColorStop(0, 'rgba(80,255,140,0.75)');
    grad2.addColorStop(0.6, 'rgba(40,200,100,0.4)');
    grad2.addColorStop(1, 'rgba(40,200,100,0)');
    ctx.strokeStyle = grad2;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 8]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(cx + lineEnd * Math.cos(angle), cy + lineEnd * Math.sin(angle));
    ctx.stroke();
    ctx.restore();

    // preview body — 惑星デザインで表示
    ctx.save();
    ctx.translate(ix, iy);
    ctx.globalAlpha = 0.75;
    ctx.shadowBlur = 10;
    ctx.shadowColor = def.glowColor;
    this.drawPlanet(ctx, def.radius, nextLevel);
    ctx.restore();

    // リム上の「リリース可能」インジケータ — 緑の脈動ドット
    const rx = cx + fr * Math.cos(angle);
    const ry = cy + fr * Math.sin(angle);
    const pulse = 1 + 0.35 * Math.sin(this.rimPhase);
    const dotR = 6 * pulse;

    ctx.save();
    // 外側の光輪
    ctx.beginPath();
    ctx.arc(rx, ry, dotR * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(60,255,120,${0.15 * pulse})`;
    ctx.fill();
    // 中心ドット
    ctx.beginPath();
    ctx.arc(rx, ry, dotR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,255,140,${0.85 + 0.15 * Math.sin(this.rimPhase)})`;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#40ff80';
    ctx.fill();
    ctx.restore();
  }

  private drawReadyPings(ctx: CanvasRenderingContext2D, dt: number) {
    for (let i = this.readyPings.length - 1; i >= 0; i--) {
      const p = this.readyPings[i];
      p.life -= dt * 1.8;
      if (p.life <= 0) { this.readyPings.splice(i, 1); continue; }

      const progress = 1 - p.life;         // 0→1 で拡大
      const ringR = 12 + progress * 38;    // 拡散する半径
      const alpha = p.life * 0.9;          // フェードアウト

      ctx.save();
      ctx.strokeStyle = `rgba(80,255,140,${alpha})`;
      ctx.lineWidth = 3 * p.life;
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#40ff80';
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // 二重リング
      ctx.strokeStyle = `rgba(180,255,220,${alpha * 0.5})`;
      ctx.lineWidth = 1.5 * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringR * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBlockedIndicator(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, fr: number,
    angle: number, nextLevel: number,
  ) {
    const def = CELESTIALS[nextLevel];
    const ix = cx + (fr - def.radius - 4) * Math.cos(angle);
    const iy = cy + (fr - def.radius - 4) * Math.sin(angle);
    const r = def.radius;

    // 薄暗い惑星プレビュー
    ctx.save();
    ctx.translate(ix, iy);
    ctx.globalAlpha = 0.25;
    this.drawPlanet(ctx, r, nextLevel);
    ctx.restore();

    // 赤い×マーク
    ctx.save();
    ctx.translate(ix, iy);
    const arm = r * 0.55;
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = Math.max(3, r * 0.18);
    ctx.lineCap = 'round';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff0000';
    ctx.beginPath();
    ctx.moveTo(-arm, -arm); ctx.lineTo(arm, arm);
    ctx.moveTo(arm, -arm);  ctx.lineTo(-arm, arm);
    ctx.stroke();

    // 赤い円枠
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,50,50,0.7)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.restore();
  }

  private drawNextCelestial(level: number) {
    const ctx = this.nextCtx;
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const def = CELESTIALS[level];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(def.radius, cx - 4);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowBlur = 10;
    ctx.shadowColor = def.glowColor;
    this.drawPlanet(ctx, r, level);
    ctx.restore();
  }
}

