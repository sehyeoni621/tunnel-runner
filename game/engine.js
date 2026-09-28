// 꿀잠 러너 V2 — three.js 게임 엔진
// 상태의 단일 소유자. UI는 onSnapshot(snap) 으로만 받는다(단방향). 입력은 공개 메서드로.
import * as THREE from 'three';
import { TUNNEL, PLAYER, RUN, STAGES, OBSTACLES, ITEMS, RUN_ITEM_POOL, SKINS, SAVE_KEY, DEFAULT_SAVE } from './config.js';
import { buildCharacter, poseCharacter, buildObstacle, buildItem, buildBed, buildSegment, mat } from './models.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function loadSave() {
  try { return { ...DEFAULT_SAVE, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return { ...DEFAULT_SAVE }; }
}
function writeSave(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {} }

function glowTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  const col = '#' + color.toString(16).padStart(6, '0');
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ───── 썸네일러: 모델 → PNG dataURL (UI 아이콘·상점·스테이지 카드) ───── */
export function createThumbnailer() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15; r.setPixelRatio(1);
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a60a0, 1.7); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb8a0ff, 1.4); rim.position.set(-3, 2, -3); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 200);
  const cache = new Map();
  return {
    object(id, obj, { w = 256, h = 256, dir = [0.4, 0.25, 1], pad = 1.08, frame } = {}) {
      if (cache.has(id)) return cache.get(id);
      r.setSize(w, h, false); cam.aspect = w / h; cam.fov = 28; scene.fog = null; scene.background = null;
      scene.add(obj); obj.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(frame || obj); const c = b.getCenter(new THREE.Vector3()); const s = b.getSize(new THREE.Vector3());
      const rad = Math.max(s.x, s.y, s.z) * 0.62 * pad;
      const dist = rad / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / Math.min(1, cam.aspect);
      cam.position.copy(c).add(new THREE.Vector3(...dir).normalize().multiplyScalar(dist)); cam.near = dist / 20; cam.far = dist * 4;
      cam.updateProjectionMatrix(); cam.lookAt(c);
      r.render(scene, cam); const url = r.domElement.toDataURL('image/png'); scene.remove(obj);
      cache.set(id, url); return url;
    },
    corridor(id, stage, { w = 240, h = 300 } = {}) {
      if (cache.has(id)) return cache.get(id);
      const t = stage.theme; const g = new THREE.Group(); const rnd = rng(7);
      for (let i = 0; i < 10; i++) { const s = buildSegment(t, i, TUNNEL.width, TUNNEL.height, TUNNEL.segLen, rnd); s.position.z = -i * TUNNEL.segLen; g.add(s); }
      const star = buildItem('coin'); star.position.set(0, 0.9, -4); g.add(star);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(t.glow), blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
      glow.scale.set(14, 14, 1); glow.position.set(0, 1.6, -58); g.add(glow);
      r.setSize(w, h, false); cam.aspect = w / h; cam.fov = 64; cam.near = 0.1; cam.far = 200;
      scene.background = new THREE.Color(t.bg); scene.fog = new THREE.Fog(t.bg, t.fogNear * 0.6, t.fogFar * 0.75);
      cam.position.set(0, 1.9, 3); cam.updateProjectionMatrix(); cam.lookAt(0, 1.3, -20);
      scene.add(g); r.render(scene, cam); const url = r.domElement.toDataURL('image/jpeg', 0.85); scene.remove(g);
      scene.background = null; scene.fog = null; cache.set(id, url); return url;
    },
  };
}

/* ───────────────────────── 엔진 ───────────────────────── */
export class Engine {
  constructor(canvas, onSnapshot) {
    this.onSnapshot = onSnapshot;
    this.save = loadSave();
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.12;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 220);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x333366, 1.4); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6); this.sun.position.set(1.5, 6, 4); this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.fill = new THREE.PointLight(0xffc8e8, 12, 12, 1.6); this.scene.add(this.fill);
    this.world = new THREE.Group(); this.dyn = new THREE.Group(); this.scene.add(this.world, this.dyn);
    this.player = new THREE.Group(); this.scene.add(this.player);
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; this.scene.add(this.blob);
    this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 20), new THREE.MeshStandardMaterial({ name: 'shield_bubble', color: 0x7ac6ff, emissive: 0x3a90ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.22, depthWrite: false }));
    this.player.add(this.shieldMesh); this.shieldMesh.position.y = 0.6;
    this.proto = new Map();
    this.particles = [];
    const pg = new THREE.SphereGeometry(0.06, 8, 6);
    for (let i = 0; i < 90; i++) { const m = new THREE.Mesh(pg, mat('p_gold', 0xffd34d, { e: 0xffb000, ei: 1 })); m.visible = false; this.scene.add(m); this.particles.push({ m, life: 0, v: new THREE.Vector3() }); }
    this.pmats = { gold: mat('p_gold', 0xffd34d, { e: 0xffb000, ei: 1 }), red: mat('p_red', 0xff5068, { e: 0xff2040, ei: 1 }), white: mat('p_white', 0xffffff, { e: 0xffffff, ei: 0.8 }), pink: mat('p_pink', 0xff9ad5, { e: 0xff60c0, ei: 1 }), blue: mat('p_blue', 0x7ac6ff, { e: 0x3a90ff, ei: 1 }) };
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true }));
    this.glow.scale.set(26, 26, 1); this.scene.add(this.glow);
    this.skyStars = this.makeStars(); this.scene.add(this.skyStars);
    this.planet = this.makePlanet(); this.scene.add(this.planet);
    this.input = { left: false, right: false, axis: 0 };
    this.state = 'home'; this.stageIdx = clamp(this.save.unlocked - 1, 0, STAGES.length - 1);
    this.t = 0; this.toast = null; this.toastT = 0;
    this.setSkin(this.save.equipped);
    this.buildTheme(this.stageIdx);
    this.resetRun(true);
    this.bindKeys(); this.resize(); addEventListener('resize', () => this.resize());
    this.last = performance.now();
    const frame = (now) => { const dt = Math.min(0.05, Math.max(0, now - this.last) / 1000); this.last = now; this.update(dt); this.renderer.render(this.scene, this.camera); this.emit(); };
    const loop = (now) => { frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    // rAF 가 멈춘 환경(백그라운드 iframe 등)용 폴백 틱
    setInterval(() => { const n = performance.now(); if (n - this.last > 150) frame(n); }, 50);
  }

  /* ── 씬 구성 ── */
  makeStars() {
    const n = 600, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, rr = 30 + Math.random() * 60; p[i * 3] = Math.cos(a) * rr; p[i * 3 + 1] = Math.sin(a) * rr * 0.7 + 10; p[i * 3 + 2] = -60 - Math.random() * 60; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, fog: false, transparent: true, opacity: 0.9 }));
  }
  makePlanet() {
    const g = new THREE.Group(); g.name = 'planet';
    g.add(new THREE.Mesh(new THREE.SphereGeometry(6, 40, 24), new THREE.MeshStandardMaterial({ color: 0x6a8cff, emissive: 0x3040c0, emissiveIntensity: 0.7, fog: false })));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9.5, 0.5, 8, 64), new THREE.MeshStandardMaterial({ color: 0xff9ad5, emissive: 0xff60c0, emissiveIntensity: 0.8, fog: false }));
    ring.rotation.x = 1.2; g.add(ring); return g;
  }
  buildTheme(i) {
    const st = STAGES[i], t = st.theme;
    this.world.clear(); this.segs = [];
    const rnd = rng(100 + i);
    for (let k = 0; k < TUNNEL.segCount; k++) { const s = buildSegment(t, k, TUNNEL.width, TUNNEL.height, TUNNEL.segLen, rnd); s.position.z = -k * TUNNEL.segLen + TUNNEL.segLen; this.world.add(s); this.segs.push(s); }
    this.scene.background = new THREE.Color(t.bg);
    this.scene.fog = new THREE.Fog(t.bg, t.fogNear, t.fogFar);
    this.hemi.color.set(t.sky); this.hemi.groundColor.set(t.ground);
    this.fill.color.set(t.trim);
    this.glow.material.map = glowTexture(t.glow); this.glow.material.needsUpdate = true;
    this.skyStars.visible = t.deco === 'space' || t.deco === 'dream';
    this.skyStars.material.color.set(t.deco === 'dream' ? 0xfff6a8 : 0xffffff);
    this.planet.visible = t.deco === 'space';
  }
  recycle(camZ) {
    const L = TUNNEL.segLen, N = TUNNEL.segCount, top = camZ + 12;
    for (const s of this.segs) {
      while (s.position.z - L / 2 > top) s.position.z -= N * L;
      while (s.position.z + L / 2 < top - N * L) s.position.z += N * L;
    }
  }
  setSkin(key) {
    const skin = SKINS.find(s => s.key === key) || SKINS[0];
    if (this.char) this.player.remove(this.char);
    this.char = buildCharacter(skin, { gender: this.save.gender }); this.player.add(this.char);
  }
  clone(kind, key) {
    const id = kind + ':' + key;
    if (!this.proto.has(id)) this.proto.set(id, kind === 'obs' ? buildObstacle(key, { width: TUNNEL.width, halfW: OBSTACLES.platform.platHalfW }) : kind === 'item' ? buildItem(key) : buildBed());
    return this.proto.get(id).clone(true);
  }

  /* ── 런 초기화 & 레벨 생성 ── */
  resetRun(home = false) {
    const st = STAGES[this.stageIdx];
    this.dyn.clear();
    this.run = { dist: 0, x: 0, y: 0, vy: 0, speed: st.base, t: 0, hp: PLAYER.maxHp, coins: 0, keys: 0,
      eff: { shield: 0, magnet: 0, boots: 0 }, invuln: 0, meme: 0, memeLock: 0, revives: 0, grounded: true, coyote: 0,
      reason: '', dieT: 0, clearT: 0, shake: 0, fell: false, reward: null,
      stepZ: 0,       // 프레임당 전진량 (스윕 히트스캔용)
      goalAdd: 0 };   // 에너지드링크로 멀어진 거리 (침대 위치 = st.goal + goalAdd)
    this.ents = home ? [] : this.generate(st);
    if (!home) { this.bed = this.clone('bed', 'bed'); this.bed.position.set(0, 0, -st.goal - 1.6); this.dyn.add(this.bed); }
    this.player.rotation.set(0, home ? 0 : Math.PI, 0);
    this.player.position.set(0, 0, 0); this.player.visible = true;
  }
  generate(st) {
    const R = rng(Date.now() & 0xffff), ents = [], lanes = TUNNEL.laneX;
    let z = 32, nextItem = 60 + R() * 40;
    const pick = (a) => a[Math.floor(R() * a.length)];
    // 에너지드링크로 골인선이 밀릴 수 있으므로 목표보다 GOAL_EXTRA 만큼 더 깔아둔다
    // (안 마시면 볼 일 없는 구간이지만, 마셨을 때 텅 빈 복도를 달리지 않게 한다)
    const GOAL_EXTRA = 180;
    while (z < st.goal + GOAL_EXTRA - 24) {
      const t = Math.min(1, z / st.goal), gap = lerp(15, 9.5, t) + R() * 4;
      let key = pick(st.obstacles);
      if (st.holes && R() < 0.14) key = 'platform';
      const blocked = new Set();
      if (key === 'platform') {
        const len = OBSTACLES.platform.holeLen;
        ents.push({ kind: 'hole', z, len }); ents.push({ kind: 'obs', key: 'platform', z: z + len / 2, x: 0, x0: 0, phase: R() * 6 });
        z += len; lanes.forEach((_, i) => blocked.add(i));
      } else if (key === 'laser') {
        ents.push({ kind: 'obs', key, z, x: 0, x0: 0, phase: R() * 2 }); lanes.forEach((_, i) => blocked.add(i));
      } else if (key === 'drink') {
        const li = Math.floor(R() * 3); ents.push({ kind: 'obs', key, z, x: lanes[li], x0: lanes[li] }); blocked.add(li);
      } else {
        const li = Math.floor(R() * 3); ents.push({ kind: 'obs', key, z, x: lanes[li], x0: lanes[li], phase: R() * 6, y: key === 'fall' ? OBSTACLES.fall.startY : 0, vy: 0 }); blocked.add(li);
        if (t > 0.3 && R() < 0.35 && !['rotate', 'ghost'].includes(key)) { const l2 = (li + 1 + Math.floor(R() * 2)) % 3; ents.push({ kind: 'obs', key: 'spike', z: z + 0.2, x: lanes[l2], x0: lanes[l2] }); blocked.add(l2); }
      }
      // 코인 줄 (가끔 에너지드링크가 섞여 있다)
      const free = [0, 1, 2].filter(i => !blocked.has(i)); const cl = free.length ? pick(free) : Math.floor(R() * 3);
      const n = Math.floor((gap - 5) / 1.5);
      for (let c = 0; c < n; c++) {
        const cz = z + 3 + c * 1.5;
        if (st.obstacles.includes('drink') && c === Math.floor(n / 2) && R() < 0.25) ents.push({ kind: 'obs', key: 'drink', z: cz, x: lanes[cl], x0: lanes[cl] });
        else ents.push({ kind: 'coin', z: cz, x: lanes[cl], y: 0.75 });
      }
      if (z > nextItem) { const il = pick([0, 1, 2].filter(i => i !== cl)); ents.push({ kind: 'item', key: pick(RUN_ITEM_POOL), z: z + gap / 2, x: lanes[il], y: 0.9 }); nextItem = z + 70 + R() * 50; }
      z += gap;
    }
    return ents;
  }

  /* ── 공개 액션 (UI → 엔진) ── */
  selectStage(i) { if (i + 1 > this.save.unlocked) return; this.stageIdx = i; this.buildTheme(i); this.resetRun(true); this.state = 'home'; }
  start(i = this.stageIdx) { this.stageIdx = i; this.buildTheme(i); this.resetRun(false); this.state = 'playing'; this.flash('달려라!'); }
  goHome() { this.buildTheme(this.stageIdx); this.resetRun(true); this.state = 'home'; }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused' || this.state === 'shop') this.state = 'playing'; }
  openShop() { if (this.state === 'playing') this.state = 'paused'; this.shopFrom = this.state; }
  setAxis(a) { this.input.axis = a; }
  jump() {
    if (this.state !== 'playing' || this.run.memeLock > 0) return;
    if (this.run.grounded || this.run.coyote > 0) { this.run.vy = PLAYER.jumpVel * (STAGES[this.stageIdx].gravityMul < 1 ? 0.9 : 1); this.run.grounded = false; this.run.coyote = 0; }
  }
  useHammer() {
    if (this.state !== 'playing' || this.save.hammers <= 0) return;
    const d = this.run.dist; let best = null;
    for (const e of this.ents) if (e.kind === 'obs' && !e.dead && e.key !== 'platform' && e.z > d && e.z - d < ITEMS.hammer.range && (!best || e.z < best.z)) best = e;
    if (!best) { this.flash('부술 장애물이 없어요'); return; }
    this.save.hammers--; writeSave(this.save);
    this.kill(best, 'white', 26); this.flash('뿅!'); this.run.shake = 0.25;
  }
  revive() {
    const cost = this.run.revives + 1;
    if (this.state !== 'gameover' || this.save.melatonin < cost || this.run.revives >= PLAYER.maxRevives) return;
    this.save.melatonin -= cost; writeSave(this.save);
    const r = this.run; r.revives++; r.hp = PLAYER.maxHp; r.invuln = PLAYER.invulnAfterRevive; r.y = 0; r.vy = 0; r.fell = false; r.grounded = true;
    for (const e of this.ents) if (e.kind === 'hole' && r.dist > e.z - 3 && r.dist < e.z + e.len) r.dist = e.z + e.len + 0.5;
    for (const e of this.ents) if (e.kind === 'obs' && Math.abs(e.z - r.dist) < 4) this.kill(e, 'blue', 8);
    this.player.visible = true; this.state = 'playing'; this.flash('부활!');
  }
  buySkin(key) {
    const s = SKINS.find(x => x.key === key); if (!s) return false;
    if (!this.save.owned.includes(key)) { if (this.save.coins < s.price) return false; this.save.coins -= s.price; this.save.owned.push(key); }
    this.save.equipped = key; writeSave(this.save); this.setSkin(key); return true;
  }
  buyItem(key) {
    const it = ITEMS[key]; const field = key === 'hammer' ? 'hammers' : 'melatonin';
    if (this.save.coins < it.price || this.save[field] >= it.max) return false;
    this.save.coins -= it.price; this.save[field]++; writeSave(this.save); return true;
  }
  setProfile(nick, gender) { this.save.nick = nick.slice(0, 12); this.save.gender = gender; writeSave(this.save); this.setSkin(this.save.equipped); }
  resetSave() { this.save = { ...DEFAULT_SAVE, owned: [...DEFAULT_SAVE.owned], cleared: [] }; writeSave(this.save); this.stageIdx = 0; this.setSkin(this.save.equipped); this.goHome(); }
  flash(text) { this.toast = text; this.toastT = 1.1; }

  bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.input.left = true;
      if (k === 'arrowright' || k === 'd') this.input.right = true;
      if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); this.jump(); }
      if (k === 'h') this.useHammer();
      if (k === 'p' || k === 'escape') this.state === 'playing' ? this.pause() : this.state === 'paused' && this.resume();
    });
    addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.input.left = false;
      if (k === 'arrowright' || k === 'd') this.input.right = false;
    });
  }
  resize() {
    const c = this.renderer.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h; this.camera.aspect = aspect; this.w = w; this.h = h;
    this.portrait = aspect < 0.85;
    // 세로 화면에서도 3차선 터널이 다 보이도록 '수평 시야'(≈64°) 기준으로 세로 fov 역산
    const hfov = 64 * Math.PI / 180;
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / Math.PI;
    this.camera.fov = clamp(vfov, 58, 88);
    this.camera.updateProjectionMatrix();
  }

  /* ── 루프 ── */
  update(dt) {
    this.t += dt; if (this.toastT > 0) this.toastT -= dt;
    const r = this.run, st = STAGES[this.stageIdx];
    if (this.state === 'home') return this.updateHome(dt);
    if (this.state === 'playing') this.updatePlay(dt, r, st);
    else if (this.state === 'dying') { r.dieT += dt; if (r.fell) { r.vy -= 18 * dt; r.y += r.vy * dt; } if (r.dieT > 0.9) this.state = 'gameover'; }
    else if (this.state === 'clear') r.clearT += dt;
    this.updateEnts(dt, r);
    this.updateParticles(dt);
    this.placePlayer(dt, r);
    this.updateCamera(dt, r);
  }
  updateHome(dt) {
    const r = this.run; r.dist -= 4.2 * dt; // 홈: 카메라 쪽(+z)으로 달려오는 연출
    this.player.position.set(0, 0, -r.dist); this.player.rotation.y = 0;
    poseCharacter(this.char, this.t, 'run', 0.72);
    const pz = -r.dist, mobile = this.w / this.h < 0.8;
    this.camera.position.set(0.3, 1.15, pz + (mobile ? 4.4 : 3.7));
    this.camera.lookAt(0.05, 0.7, pz);
    if (mobile) this.camera.setViewOffset(this.w, this.h, 0, this.h * 0.08, this.w, this.h);
    else this.camera.setViewOffset(this.w, this.h, this.w * 0.2, 0, this.w, this.h);
    this.after(pz);
    this.updateParticles(dt);
  }
  after(pz) {
    this.recycle(this.camera.position.z);
    this.blob.position.set(this.player.position.x, 0.012, pz);
    this.glow.position.set(0, 1.7, this.camera.position.z - 80);
    this.skyStars.position.z = this.camera.position.z; this.planet.position.set(10, 16, this.camera.position.z - 120);
    this.fill.position.set(this.player.position.x, 2.2, pz + 1.5);
    this.shieldMesh.visible = this.run.eff.shield > 0;
  }
  updatePlay(dt, r, st) {
    r.t += dt;
    for (const k in r.eff) r.eff[k] = Math.max(0, r.eff[k] - dt);
    r.invuln = Math.max(0, r.invuln - dt); r.meme = Math.max(0, r.meme - dt); r.memeLock = Math.max(0, r.memeLock - dt);
    let speed = Math.min(st.max, st.base + RUN.accel * r.t);
    if (r.eff.boots > 0) speed *= RUN.bootsMul; if (r.meme > 0) speed *= RUN.memeSlowMul;
    r.speed = lerp(r.speed, speed, 0.08);
    r.stepZ = r.speed * dt;   // 이번 프레임 전진량 — 스윕 히트스캔이 쓴다
    r.dist += r.stepZ;
    // 좌우
    let ax = this.input.axis || ((this.input.right ? 1 : 0) - (this.input.left ? 1 : 0));
    if (r.memeLock > 0) ax = 0;
    r.x = clamp(r.x + ax * PLAYER.lateralSpeed * dt, -TUNNEL.clampX, TUNNEL.clampX);
    // 수직
    const ground = this.groundAt(r);
    r.vy -= PLAYER.gravity * st.gravityMul * dt; r.y += r.vy * dt;
    if (ground !== null && r.y <= ground && r.y > ground - 0.35) { if (!r.grounded && r.vy < -3) this.burst(r.x, ground + 0.05, -r.dist, 'white', 5, 1.2); r.y = ground; r.vy = 0; r.grounded = true; r.coyote = 0.1; }
    else { if (r.grounded) r.coyote = 0.1; r.grounded = false; r.coyote = Math.max(0, r.coyote - dt); }
    if (r.y < -0.4) { r.fell = true; this.die('구멍에 빠졌어요'); return; }
    this.collide(r);
    if (r.dist >= st.goal + r.goalAdd) this.clear();
  }
  groundAt(r) {
    for (const e of this.ents) if (e.kind === 'hole' && r.dist > e.z && r.dist < e.z + e.len) {
      const p = this.ents.find(o => o.key === 'platform' && Math.abs(o.z - (e.z + e.len / 2)) < 0.1);
      if (p && Math.abs(p.x - r.x) < OBSTACLES.platform.platHalfW + 0.1 && r.dist > p.z - 0.9 && r.dist < p.z + 0.9) return 0.2;
      return null;
    }
    return 0;
  }
  collide(r) {
    const px = r.x, py = r.y, pz = r.dist;
    // 스윕 판정: 한 프레임 전진량이 판정 구간보다 길 수 있다.
    // (5스테이지 19.5m/s × 부츠 1.45 = 28.3m/s → 30fps에서 0.94m인데,
    //  레이저 벽은 판정 깊이가 0.12m라 점으로 보면 통째로 뚫고 지나간다)
    // 지나온 구간 [pz-step, pz]가 장애물 구간과 겹치는지로 본다.
    const step = r.stepZ || 0, prevZ = pz - step;
    for (const e of this.ents) {
      if (e.dead || Math.abs(e.z - pz) > 2.5 + step) continue;
      if (e.kind === 'coin' || e.kind === 'item') {
        const d = RUN.pickupDist;
        if (Math.abs(e.x - px) < 0.72 && pz >= e.z - d && prevZ <= e.z + d && py + 1.3 > e.y - 0.3 && py < e.y + 0.4) this.pickup(e);
        continue;
      }
      if (e.kind !== 'obs' || e.key === 'platform') continue;
      const o = OBSTACLES[e.key], [hx, hh, hz] = o.hit;
      const y0 = e.key === 'fall' ? e.y : e.key === 'ghost' ? (e.bob || 0) : 0;
      if (e.key === 'laser' && !e.on) continue;
      const hd = hz + PLAYER.hitHalfD;
      if (Math.abs(e.x - px) < hx + PLAYER.hitHalfW && pz >= e.z - hd && prevZ <= e.z + hd && py < y0 + hh && py + PLAYER.hitHeight > y0) {
        if (o.effect === 'cover') { e.dead = true; r.meme = o.coverTime; r.memeLock = 0.5; this.flash('앗, 밈이다!'); continue; }
        if (e.key === 'drink') { e.dead = true; this.dispose(e); this.drinkEnergy(); continue; }
        if (r.eff.shield > 0) { this.kill(e, 'blue', 14); continue; }
        if (o.effect === 'kill') { if (r.invuln > 0) continue; this.die('유령에게 붙잡혔어요'); return; }
        this.hurt(o.name + '에 부딪혔어요');
      }
    }
  }
  hurt(reason, force = false) {
    const r = this.run; if ((r.invuln > 0 || r.eff.shield > 0) && !force) return;
    if (r.eff.shield > 0) return;
    r.hp--; r.invuln = PLAYER.invulnAfterHit; r.shake = 0.3;
    this.burst(r.x, r.y + 0.6, -r.dist, 'red', 14, 3);
    if (r.hp <= 0) this.die(reason);
  }
  // 에너지드링크 — 체력은 그대로지만 잠이 깨서 침대(골인선)가 그만큼 뒤로 밀린다
  drinkEnergy() {
    const r = this.run, st = STAGES[this.stageIdx], m = OBSTACLES.drink.penalty;
    r.goalAdd += m;
    if (this.bed) this.bed.position.z = -(st.goal + r.goalAdd) - 1.6;
    this.flash(`잠이 깼다! 침대가 ${m}m 멀어졌어요`);
    r.shake = 0.18;
    this.burst(r.x, r.y + 0.7, -r.dist, 'blue', 14, 2.4);
  }
  die(reason) { const r = this.run; r.reason = reason; r.dieT = 0; this.state = 'dying'; r.shake = 0.4; this.persistBest(); }
  persistBest() { const m = Math.floor(this.run.dist); if (m > this.save.best) this.save.best = m; this.save.coins += this.run.coins; this.run.banked = (this.run.banked || 0) + this.run.coins; this.run.coins = 0; writeSave(this.save); }
  clear() {
    const r = this.run, st = STAGES[this.stageIdx];
    const stars = r.hp;
    const reward = st.reward + r.keys * ITEMS.key.bonus;
    r.reward = { coins: r.coins, bonus: reward, keys: r.keys, stars, total: r.coins + reward };
    this.save.coins += r.coins + reward; r.coins = 0;
    if (!this.save.cleared.includes(st.key)) this.save.cleared.push(st.key);
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(STAGES.length, this.stageIdx + 2));
    this.save.best = Math.max(this.save.best, Math.floor(r.dist)); writeSave(this.save);
    r.clearT = 0; this.state = 'clear'; this.burst(0, 1.5, -st.goal - 1.6, 'pink', 40, 4);
  }
  pickup(e) {
    const r = this.run; e.dead = true; this.dispose(e);
    if (e.kind === 'coin') { r.coins++; this.burst(e.x, e.y, -e.z, 'gold', 5, 1.6); return; }
    const k = e.key, it = ITEMS[k];
    if (it.duration) r.eff[k] = it.duration;
    if (k === 'heart') r.hp = Math.min(PLAYER.maxHp, r.hp + 1);
    if (k === 'key') r.keys++;
    if (k === 'hammer') { this.save.hammers = Math.min(ITEMS.hammer.max, this.save.hammers + 1); writeSave(this.save); }
    this.burst(e.x, e.y, -e.z, k === 'heart' ? 'pink' : 'blue', 16, 2.4); this.flash(it.name + '!');
  }
  kill(e, color, n) { e.dead = true; this.burst(e.x, 0.6, -e.z, color, n, 3); this.dispose(e); }
  dispose(e) { if (e.mesh) { this.dyn.remove(e.mesh); e.mesh = null; } }

  updateEnts(dt, r) {
    const d = r.dist, t = this.t;
    for (const e of this.ents) {
      const ahead = e.z - d;
      if (e.dead) continue;
      if (ahead < -8) { this.dispose(e); if (e.kind !== 'hole') e.dead = true; continue; }
      if (ahead > 92) continue;
      if (!e.mesh) this.spawnMesh(e);
      const o = OBSTACLES[e.key];
      if (e.kind === 'coin') { e.mesh.rotation.y = t * 3 + e.z; if (r.eff.magnet > 0 && ahead < RUN.magnetDist && ahead > -1) { e.x = lerp(e.x, r.x, 0.2); e.z = lerp(e.z, d, 0.2); e.y = lerp(e.y, r.y + 0.7, 0.2); } e.mesh.position.set(e.x, e.y + Math.sin(t * 3 + e.z) * 0.06, -e.z); continue; }
      if (e.kind === 'item') { e.mesh.rotation.y = t * 1.8; e.mesh.position.set(e.x, e.y + Math.sin(t * 2.5 + e.z) * 0.1, -e.z); continue; }
      if (e.kind === 'hole') continue;
      if (e.key === 'rotate') { e.x = clamp(e.x0 + Math.sin(t * o.swaySpeed + e.phase) * 0.9, -1.6, 1.6); e.mesh.userData.spinner.rotation.y += dt * 2.4; }
      if (e.key === 'ghost') { e.x = clamp(e.x0 + Math.sin(t * o.swaySpeed + e.phase) * o.sway, -1.6, 1.6); e.bob = 0.15 + Math.sin(t * 2.2 + e.phase) * 0.15; e.mesh.userData.float.position.y = 0.35 + e.bob; e.mesh.rotation.y = Math.sin(t * 1.4) * 0.3; }
      if (e.key === 'platform') e.x = Math.sin(t * o.swaySpeed + e.phase) * o.sway;
      if (e.key === 'laser') { const per = o.onTime + o.offTime; e.on = ((t + e.phase) % per) < o.onTime; const b = e.mesh.userData.beams; b.visible = e.on || Math.sin(t * 40) > 0.6; b.scale.y = e.on ? 1 : 0.4; }
      if (e.key === 'fall') {
        if (ahead < o.triggerDist) { e.vy += 22 * dt; e.y = Math.max(0, e.y - e.vy * dt); if (e.y === 0 && !e.landed) { e.landed = true; this.burst(e.x, 0.1, -e.z, 'white', 10, 2); } }
        e.mesh.userData.block.position.y = e.y + 0.5; e.warn.material.opacity = e.landed ? 0 : 0.35 + Math.sin(t * 16) * 0.2;
      }
      if (e.key === 'drink' || e.key === 'meme') e.mesh.rotation.y = Math.sin(t * 2 + e.z) * 0.35;
      e.mesh.position.set(e.x, 0, -e.z);
    }
  }
  spawnMesh(e) {
    if (e.kind === 'hole') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(TUNNEL.width - 0.02, 0.14, e.len), new THREE.MeshBasicMaterial({ color: 0x05040c })));
      const edge = mat('hole_edge', 0x6fe0ff, { e: 0x40d0ff, ei: 1.5 });
      for (const dz of [-e.len / 2, e.len / 2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(TUNNEL.width, 0.03, 0.08), edge); m.position.set(0, 0.01, dz); g.add(m); }
      g.position.set(0, -0.06, -(e.z + e.len / 2)); e.mesh = g; this.dyn.add(g); return;
    }
    e.mesh = this.clone(e.kind === 'coin' ? 'item' : e.kind, e.kind === 'coin' ? 'coin' : e.key);
    if (e.key === 'spinner' || e.key === 'rotate') e.mesh.userData.spinner = e.mesh.getObjectByName('spinner');
    if (e.key === 'ghost') e.mesh.userData.float = e.mesh.getObjectByName('ghost');
    if (e.key === 'laser') e.mesh.userData.beams = e.mesh.getObjectByName('beams');
    if (e.key === 'fall') {
      e.mesh.userData.block = e.mesh.getObjectByName('block');
      e.warn = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.52, 32), new THREE.MeshBasicMaterial({ color: 0xff3050, transparent: true, opacity: 0.4, depthWrite: false }));
      e.warn.rotation.x = -Math.PI / 2; e.warn.position.y = 0.015; e.mesh.add(e.warn);
    }
    if (e.kind === 'item') e.mesh.scale.setScalar(1.25);
    this.dyn.add(e.mesh);
  }
  burst(x, y, z, color, n, spd) {
    let c = 0;
    for (const p of this.particles) {
      if (p.life > 0) continue; if (c++ >= n) break;
      p.life = 0.5 + Math.random() * 0.4; p.m.visible = true; p.m.material = this.pmats[color]; p.m.position.set(x, y, z);
      p.v.set((Math.random() - 0.5) * spd * 2, Math.random() * spd * 1.2 + 0.5, (Math.random() - 0.5) * spd * 2);
    }
  }
  updateParticles(dt) {
    for (const p of this.particles) {
      if (p.life <= 0) continue; p.life -= dt;
      p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt); p.m.scale.setScalar(Math.max(0.01, p.life * 1.8));
      if (p.life <= 0) p.m.visible = false;
    }
  }
  placePlayer(dt, r) {
    const st = STAGES[this.stageIdx];
    if (this.state === 'clear') {
      const k = Math.min(1, r.clearT / 0.8);
      this.player.position.set(lerp(r.x, 0, k), lerp(0, 0.95, k) + Math.sin(k * Math.PI) * 0.9, -st.goal - lerp(0, 1.4, k));
      this.player.rotation.set(-Math.PI / 2 * k, Math.PI * (1 - k), 0);
      poseCharacter(this.char, this.t, k < 1 ? 'jump' : 'sleep');
      this.after(-st.goal - 1.6); return;
    }
    this.player.rotation.set(0, Math.PI, 0);
    this.player.position.set(r.x, r.y, -r.dist);
    const tilt = (this.input.axis || ((this.input.right ? 1 : 0) - (this.input.left ? 1 : 0)));
    this.player.rotation.z = lerp(this.player.rotation.z, -tilt * 0.12, 0.2);
    if (this.state === 'dying' && !r.fell) this.player.rotation.x = Math.min(1.2, r.dieT * 4);
    poseCharacter(this.char, this.t, this.state === 'dying' ? 'idle' : r.grounded ? 'run' : 'jump', r.speed / 12);
    this.player.visible = !(r.invuln > 0 && this.state === 'playing' && Math.sin(this.t * 40) > 0);
    this.after(-r.dist);
    this.blob.visible = this.groundAt(r) !== null;
    this.blob.scale.setScalar(clamp(1 - r.y * 0.3, 0.4, 1));
  }
  updateCamera(dt, r) {
    const cam = this.camera; cam.clearViewOffset();
    const st = STAGES[this.stageIdx];
    if (this.state === 'clear') {
      const gz = -st.goal - 1.6, k = Math.min(1, r.clearT / 1.4);
      cam.position.lerp(new THREE.Vector3(1.6, 3.4, gz + 3.4), 0.06); cam.lookAt(0, 0.8, gz - 0.2 * k); return;
    }
    const s = r.shake > 0 ? (r.shake -= dt, r.shake * 0.25) : 0;
    // 세로 화면에선 카메라를 더 뒤·위로 빼서 터널·차선·다가오는 장애물이 다 보이게
    const back = this.portrait ? 6.6 : 4.4, camY = this.portrait ? 2.7 : 2.15, look = this.portrait ? 8.5 : 6;
    const target = new THREE.Vector3(r.x * (this.portrait ? 0.42 : 0.55) + (Math.random() - 0.5) * s, camY + Math.max(0, r.y) * 0.35 + (Math.random() - 0.5) * s, -r.dist + back);
    cam.position.lerp(target, 0.25);
    cam.lookAt(r.x * 0.4, this.portrait ? 1.25 : 1.05, -r.dist - look);
  }

  /* ── 스냅샷 (엔진 → UI) ── */
  snapshot() {
    const r = this.run, st = STAGES[this.stageIdx], s = this.save;
    return {
      screen: this.state, stageIdx: this.stageIdx, stageName: st.name, goal: st.goal + r.goalAdd,
      dist: Math.floor(r.dist), progress: Math.round(clamp(r.dist / (st.goal + r.goalAdd), 0, 1) * 200) / 200,
      hp: r.hp, maxHp: PLAYER.maxHp, runCoins: r.coins, keys: r.keys,
      score: Math.floor(r.dist) + (r.coins + (r.banked || 0)) * 10,
      eff: { shield: Math.ceil(r.eff.shield), magnet: Math.ceil(r.eff.magnet), boots: Math.ceil(r.eff.boots) },
      meme: r.meme > 0, reason: r.reason, reviveCost: r.revives + 1, canRevive: r.revives < PLAYER.maxRevives && s.melatonin >= r.revives + 1,
      reward: r.reward, clearDone: this.state === 'clear' && r.clearT > 1.2,
      toast: this.toastT > 0 ? this.toast : null,
      wallet: s.coins, best: s.best, hammers: s.hammers, melatonin: s.melatonin, owned: s.owned, equipped: s.equipped,
      unlocked: s.unlocked, cleared: s.cleared, nick: s.nick, gender: s.gender,
    };
  }
  emit() {
    const snap = this.snapshot(); const key = JSON.stringify(snap);
    if (key !== this.lastKey) { this.lastKey = key; this.onSnapshot(snap); }
  }
}
