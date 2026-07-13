// =====================================================================
// 꿀잠 러너 — 게임 엔진 (React와 분리된 순수 게임 코어)
//
// React는 이 모듈을 초기화(init)하고, 상태 변화를 구독(subscribe)해서 UI만 그린다.
// 캔버스 렌더링 · 물리 · 게임 루프는 React 렌더 사이클 밖에서 돌아간다 (60fps 유지).
//
// [중력 전환 구조]
// 물리는 항상 "현재 면이 바닥"인 로컬 좌표계에서 계산한다.
// state.surface(0~3)가 어느 월드 면 위를 달리는지 기억하고,
// 렌더링만 state.roll 각도로 회전시켜 90° 전환 연출을 만든다.
// =====================================================================

import { PAL, CONFIG, LEVELS, OBSTACLES, MEMES, HAMMER } from './config.js';
import { getManifest, loadAssets, skinByKey, sprites } from './assets.js';
import { drawRunnerBack, drawRunnerFront, drawStarShape, rr, outlined } from './characters.js';
import { loadBest, saveBest as persistBest, loadWallet, saveWallet as persistWallet } from './save.js';

// ===== 캔버스 =====
let canvas = null;
let ctx = null;
let rafId = 0;
let listener = null;   // React 구독자
let shopIsOpen = false;
let lastSnapshot = '';

// 논리 화면 크기(CSS 픽셀). 캔버스 버퍼는 DPR만큼 키워서 레티나/모바일에서도 선명하게.
const view = { w: 0, h: 0, dpr: 1 };

function resizeCanvas() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // 3x 기기에서 과도한 부하 방지
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = dpr;
  canvas.width = Math.round(view.w * dpr);
  canvas.height = Math.round(view.h * dpr);
  canvas.style.width = `${view.w}px`;
  canvas.style.height = `${view.h}px`;
}

// ===== 저장 데이터 =====
let bestMeters = loadBest();
let wallet = loadWallet(LEVELS.length);

function saveBest(m) { bestMeters = m; persistBest(m); }
function saveWallet() { persistWallet(wallet); }

// ===== React로 내보내는 스냅샷 =====
// 매 프레임 전체를 밀어 넣으면 60fps 리렌더가 되므로, 값이 실제로 바뀔 때만 통지한다.
function snapshot() {
  const lv = currentLevel();
  return {
    phase: state.phase,
    paused: state.paused,
    level: state.level,
    selected: state.selected,
    levelName: `${state.level}. ${lv.name}`,
    runId: state.runId,
    scoreM: Math.floor(state.distance / CONFIG.score.unitsPerMeter),
    bestM: bestMeters,
    progress: state.goalZ ? Math.min(1, (state.distance + CONFIG.player.z) / state.goalZ) : 0,
    coins: wallet.coins,
    owned: wallet.owned,
    equipped: wallet.equipped,
    unlocked: wallet.unlocked,
    cleared: wallet.cleared,
    hammers: wallet.hammers,
    meme: state.memeText ? { text: state.memeText, token: state.memeToken } : null,
    clear: state.clearInfo,
    over: state.overInfo,
  };
}

function emit() {
  if (!listener) return;
  const s = snapshot();
  // 진행도는 0.5% 단위로만 통지 (불필요한 리렌더 방지)
  const key = JSON.stringify([
    s.phase, s.paused, s.level, s.selected, s.runId, s.scoreM, s.bestM,
    Math.round(s.progress * 200), s.coins, s.owned.length, s.equipped,
    s.unlocked, s.cleared.length, s.hammers, s.meme && s.meme.token,
    s.clear ? s.clear.ready : false, !!s.over,
  ]);
  if (key === lastSnapshot) return;
  lastSnapshot = key;
  listener(s);
}

// ===== 게임 상태 =====
const state = {
  phase: 'home',      // 'home' | 'playing' | 'dying' | 'gameover' | 'clear'
  paused: false,
  distance: 0,
  speed: CONFIG.run.baseSpeed,
  surface: 0,         // 현재 달리는 월드 면
  roll: 0,            // 렌더링 회전 각 (전환 직후 ±90°에서 0으로 감쇠)
  time: 0,
  runPhase: 0,        // 달리기 다리 사이클 위상
  dyingRot: 0,        // 넘어짐 회전 연출
  runCoins: 0,        // 이번 판에 모은 코인

  level: 1,           // 현재 스테이지 (1~5)
  selected: 1,        // 홈에서 고른 스테이지
  goalZ: 0,           // 침대까지의 거리 (월드 단위)
  clearT: 0,          // 클리어 연출 경과 시간
  stunT: 0,           // 조작 잠김 (밈 "영혼 없는 춤")
  slowT: 0,           // 감속 지속 시간
  coverT: 0,          // 밈 말풍선이 화면을 가리는 시간
  shake: 0,           // 화면 흔들림
  deathBy: '',        // 사망 원인 (게임오버 문구)
  deathMsg: '',       // 방해꾼별 커스텀 게임오버 멘트 (없으면 기본 템플릿)

  // --- React UI로 넘기는 값 (DOM을 직접 만지지 않는다) ---
  runId: 0,           // 런이 바뀔 때마다 증가 (힌트 애니메이션 재생용 key)
  memeText: '',       // 화면을 가리는 밈 말풍선
  memeToken: 0,       // 같은 밈이 연속으로 나와도 애니메이션이 다시 재생되도록
  clearInfo: null,    // { levelName, meters, runCoins, reward, unlockedNew, isLast }
  overInfo: null,     // { meters, goal, reason, runCoins, newRecord }
};

function currentLevel() {
  return LEVELS[state.level - 1] || LEVELS[0];
}

const player = {
  x: 0,
  vx: 0,          // 좌우 속도 (가감속으로 부드럽게)
  height: 0,
  vy: 0,
  onGround: true,
  lean: 0,        // 이동 방향으로 기우는 각도
  squash: 0,      // 착지 스쿼시 (0이면 없음)
};

// 벽 전환 회전 트윈 (딱 끊기지 않게 이징)
const rollAnim = { from: 0, t: 1, dur: 0.36 };
let wallHold = 0;   // 벽에 붙어 있는 시간 (전환 판정용)

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// 지수 감쇠 대신 프레임 독립 보간 계수
function lerpK(dt, speed) {
  return 1 - Math.exp(-speed * dt);
}

const input = { left: false, right: false };

let holes = [];        // { x, width, z, len, face }
let coins = [];        // { x, z, face, taken }
let obstacles = [];    // { type, x, baseX, z, len, face, hit }
let nextSpawnZ = 0;
let nextCoinZ = 0;
let nextObsZ = 0;
let particles = [];
let zzz = [];          // 엔딩 Zzz 파티클
let pops = [];         // 뽕망치 "뽕!" 팝업 텍스트

// ===== 별 배경 =====
const stars = [];
function initStars() {
  stars.length = 0;
  for (let i = 0; i < CONFIG.stars.count; i++) {
    stars.push({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.4,
      phase: Math.random() * Math.PI * 2,
      twinkle: Math.random() * 2 + 0.5,
    });
  }
}
initStars();

// ===== 좌표 변환 =====
const cam = { x: 0, y: 0 };

// (u,v)를 90° × k 회전 — 면 로컬 좌표 → 상대 면 좌표
function faceRot(u, v, k) {
  switch (k & 3) {
    case 0: return [u, v];
    case 1: return [-v, u];
    case 2: return [-u, -v];
    case 3: return [v, -u];
  }
}

// 로컬 좌표에 roll 회전을 적용한 뒤 원근 투영
function project(x, y, z) {
  const c = Math.cos(state.roll), sn = Math.sin(state.roll);
  const rx = x * c - y * sn;
  const ry = x * sn + y * c;
  const s = CONFIG.camera.fov / z;
  return {
    x: view.w / 2 + (rx - cam.x) * s,
    y: view.h / 2 + (ry - cam.y) * s,
    s,
  };
}

function playerScreenPos() {
  const half = CONFIG.tunnel.size / 2;
  const cy = half - player.height - CONFIG.player.size / 2;
  return project(player.x, cy, CONFIG.player.z);
}


function jump() {
  if (state.phase !== 'playing' || state.paused) return;
  if (player.onGround) {
    player.vy = -CONFIG.player.jumpVel;
    player.onGround = false;
  }
}

function togglePause() {
  if (state.phase !== 'playing') return;
  state.paused = !state.paused;
  emit();
}

// ===== 입력 (게임 조작만 엔진이 처리, 메뉴 클릭은 React) =====
function onKeyDown(e) {
  if (shopIsOpen) return; // 상점이 열려 있으면 React가 처리

  // 홈: 좌우로 스테이지 고르고 Space/Enter로 시작
  if (state.phase === 'home') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') selectLevel(state.selected - 1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') selectLevel(state.selected + 1);
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); startLevel(state.selected); }
    return;
  }

  if (state.phase === 'clear') {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); goNextLevel(); }
    if (e.code === 'Escape') showHome();
    return;
  }

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (state.phase === 'gameover') { startLevel(state.level); return; }
    jump();
  }
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyH') useHammer();   // 뽕망치 사용
  if (e.code === 'Escape') {
    if (state.phase === 'gameover') showHome();
    else togglePause();
  }
  if (e.code === 'KeyR' && state.phase === 'gameover') startLevel(state.level);
}

function onKeyUp(e) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
}

function onVisibility() {
  if (document.hidden && state.phase === 'playing') state.paused = true;
  input.left = false;
  input.right = false;
  emit();
}

// ===== 터치 조작 (React의 TouchControls / 캔버스 탭이 호출) =====
// dir: -1 왼쪽, 1 오른쪽, 0 손 뗌
function setMove(dir) {
  input.left = dir < 0;
  input.right = dir > 0;
}

// 캔버스를 탭하면 점프 (게임오버 화면에서는 재시작)
function tap() {
  if (state.phase === 'gameover') { startLevel(state.level); return; }
  if (state.phase === 'playing') jump();
}


// ===== 런 초기화 / 화면 전환 =====
function resetRun(level) {
  const lv = LEVELS[level - 1] || LEVELS[0];
  state.level = level;
  state.paused = false;
  state.distance = 0;
  state.speed = lv.base;
  state.surface = 0;
  state.roll = 0;
  state.runPhase = 0;
  state.dyingRot = 0;
  state.runCoins = 0;
  state.goalZ = lv.goal * CONFIG.score.unitsPerMeter;
  state.clearT = 0;
  state.stunT = 0;
  state.slowT = 0;
  state.coverT = 0;
  state.shake = 0;
  state.deathBy = '';
  state.deathMsg = '';
  player.x = 0;
  player.height = 0;
  player.vy = 0;
  player.onGround = true;
  holes = [];
  coins = [];
  obstacles = [];
  particles = [];
  zzz = [];
  pops = [];
  nextSpawnZ = CONFIG.hole.safeZone;
  nextCoinZ = CONFIG.coin.safeZone;
  nextObsZ = CONFIG.obstacle.safeZone;
  input.left = false;
  input.right = false;

  state.clearInfo = null;
  state.overInfo = null;
  state.memeText = '';
  state.runId++;
  emit();
}

function startLevel(level) {
  level = Math.min(Math.max(level, 1), LEVELS.length);
  if (level > wallet.unlocked) return; // 잠긴 스테이지
  resetRun(level);
  state.phase = 'playing';
  emit();
}

function showHome() {
  resetRun(state.selected);
  state.phase = 'home';
  emit();
}

function selectLevel(level) {
  level = Math.min(Math.max(level, 1), LEVELS.length);
  if (level > wallet.unlocked) return;
  state.selected = level;
  emit();
}


// ===== 사망 / 클리어 =====
function die(cause, msg) {
  if (state.phase !== 'playing') return;
  state.phase = 'dying';
  state.deathBy = cause;
  state.deathMsg = msg || '';
  state.shake = 0.35;
  const p = playerScreenPos();
  if (cause === 'hole') {
    player.vy = 120;      // 구멍으로 쑥 빠짐
  } else {
    player.vy = -260;     // 방해꾼에 부딪혀 튕김
    spawnBurst(p.x, p.y, [255, 120, 150], 26, 320);
  }
}

function reachBed() {
  state.phase = 'clear';
  state.clearT = 0;
  state.paused = false;
  player.vy = -CONFIG.player.jumpVel * 0.55; // 침대로 폴짝
  player.onGround = false;
  state.memeText = '';

  const lv = currentLevel();
  const meters = Math.floor(state.distance / CONFIG.score.unitsPerMeter);
  if (meters > bestMeters) saveBest(meters);

  // 보상 + 다음 스테이지 해금
  wallet.coins += lv.reward;
  if (!wallet.cleared.includes(state.level)) wallet.cleared.push(state.level);
  const unlockedNew = state.level === wallet.unlocked && wallet.unlocked < LEVELS.length;
  if (unlockedNew) wallet.unlocked = state.level + 1;
  saveWallet();

  // 클리어 패널에 띄울 값 — 연출(1.9초)이 끝나면 React가 보여준다
  state.clearInfo = {
    levelName: `${state.level}. ${lv.name}`,
    meters,
    runCoins: state.runCoins,
    reward: lv.reward,
    unlockedNew,
    isLast: state.level >= LEVELS.length,
    ready: false,
  };
  emit();
}

function goNextLevel() {
  const next = Math.min(state.level + 1, LEVELS.length);
  if (next > wallet.unlocked || next === state.level) { showHome(); return; }
  state.selected = next;
  startLevel(next);
}


// ===== 중력 전환 (벽 타기) =====
function shiftGravity(dir) {
  const half = CONFIG.tunnel.size / 2;
  const size = CONFIG.player.size;

  if (dir === 'right') {
    state.surface = (state.surface + 3) % 4;
    state.roll -= Math.PI / 2;
    player.x = player.height + size / 2 - half; // 기하학적 연속성 유지
  } else {
    state.surface = (state.surface + 1) % 4;
    state.roll += Math.PI / 2;
    player.x = half - player.height - size / 2;
  }

  const clamp = half - size / 2 - 8;
  player.x = Math.max(-clamp, Math.min(clamp, player.x));
  player.height = 0;
  player.vy = 0;
  player.onGround = true;

  // 벽으로 올라타는 순간: 회전 트윈 + 살짝 튀는 느낌
  rollAnim.from = state.roll;
  rollAnim.t = 0;
  player.vx = 0;
  player.lean = dir === 'right' ? 0.3 : -0.3;
  player.squash = 0.22;
  wallHold = 0;

  const p = playerScreenPos();
  spawnBurst(p.x, p.y, [184, 139, 234], 18, 260);
}

// ===== 파티클 =====
function spawnBurst(sx, sy, rgb, n, power) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = Math.random() * power;
    particles.push({
      x: sx, y: sy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 60,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      rgb,
      r: 1.5 + Math.random() * 2,
    });
  }
}

function spawnPop(x, y, text) {
  pops.push({ x, y, text, life: 0.7, maxLife: 0.7 });
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 500 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);

  for (const p of pops) { p.y -= 42 * dt; p.life -= dt; }
  pops = pops.filter((p) => p.life > 0);
}

// ===== 구멍 / 코인 생성 =====
function rand(a, b) { return a + Math.random() * (b - a); }

function randFace() {
  if (Math.random() < CONFIG.hole.currentFaceBias) return state.surface;
  return (state.surface + 1 + Math.floor(Math.random() * 3)) % 4;
}

// 침대 앞 마지막 구간은 비워 둔다 (마지막 스퍼트)
function spawnStopZ() {
  return state.goalZ - 700;
}

function spawnHoles() {
  const T = CONFIG.tunnel;
  const H = CONFIG.hole;
  const horizon = Math.min(state.distance + T.depth, spawnStopZ());
  if (!currentLevel().holes) return;

  while (nextSpawnZ < horizon) {
    // 현재 속도에서 점프로 넘을 수 있는 길이로 제한
    const airTime = (2 * CONFIG.player.jumpVel) / CONFIG.player.gravity;
    const maxJumpable = state.speed * airTime * 0.72;
    const len = rand(H.minLen, Math.min(H.maxLen, maxJumpable));
    const width = rand(H.minWidth, H.maxWidth);
    const margin = width / 2 + 24;
    const x = rand(-T.size / 2 + margin, T.size / 2 - margin);

    holes.push({ x, width, z: nextSpawnZ, len, face: randFace() });

    const difficulty = CONFIG.run.baseSpeed / state.speed;
    const gap = rand(H.minGap, Math.max(H.minGap + 60, H.maxGap * difficulty));
    nextSpawnZ += len + gap;
  }

  const cutoff = state.distance + CONFIG.camera.nearZ - 100;
  holes = holes.filter((h) => h.z + h.len > cutoff);
}

// 코인이 같은 면의 구멍 위에 놓이지 않게 확인
function overlapsHole(face, x, z) {
  for (const h of holes) {
    if (h.face !== face) continue;
    if (z > h.z - 30 && z < h.z + h.len + 30 && Math.abs(x - h.x) < h.width / 2 + 20) return true;
  }
  return false;
}

function spawnCoins() {
  const T = CONFIG.tunnel;
  const C = CONFIG.coin;
  const horizon = Math.min(state.distance + T.depth, spawnStopZ());

  while (nextCoinZ < horizon) {
    const count = Math.round(rand(C.rowMin, C.rowMax));
    const face = randFace();
    const x = rand(-T.size / 2 + 60, T.size / 2 - 60);
    for (let i = 0; i < count; i++) {
      const z = nextCoinZ + i * C.spacing;
      if (!overlapsHole(face, x, z) && !overlapsObstacle(face, x, z, 40)) {
        coins.push({ x, z, face, taken: false });
      }
    }
    nextCoinZ += count * C.spacing + rand(C.minGap, C.maxGap);
  }

  const cutoff = state.distance + CONFIG.camera.nearZ - 50;
  coins = coins.filter((c) => !c.taken && c.z > cutoff);
}

// ===== 방해요인 (아빠 · 동생 · 조XX · 김XX · 밈) =====
function overlapsObstacle(face, x, z, pad) {
  for (const o of obstacles) {
    if (o.face !== face) continue;
    const spec = OBSTACLES[o.type];
    if (z > o.z - pad && z < o.z + o.len + pad && Math.abs(x - o.baseX) < spec.w / 2 + pad) return true;
  }
  return false;
}

function spawnObstacles() {
  const T = CONFIG.tunnel;
  const half = T.size / 2;
  const types = currentLevel().obstacles;
  const horizon = Math.min(state.distance + T.depth, spawnStopZ());

  while (nextObsZ < horizon) {
    const type = types[Math.floor(Math.random() * types.length)];
    const spec = OBSTACLES[type];
    const face = randFace();
    const lim = half - spec.w / 2 - 12;

    let x;
    if (spec.edge) x = (Math.random() < 0.5 ? -1 : 1) * lim;  // 벽에서 튀어나옴
    else if (spec.sway) x = 0;                                // 중앙 차선 점거
    else x = rand(-lim, lim);

    // 구멍 위나 다른 방해꾼과 겹치면 이번 자리는 건너뛴다 (회피 불가 조합 방지)
    if (!overlapsHole(face, x, nextObsZ) && !overlapsObstacle(face, x, nextObsZ, 120)) {
      obstacles.push({
        type, face, x, baseX: x,
        z: nextObsZ,
        len: spec.len,
        seed: Math.random() * Math.PI * 2,
        meme: MEMES[Math.floor(Math.random() * MEMES.length)],
        hit: false,
      });
    }

    // 빨라질수록 간격을 넓혀 반응 시간을 유지한다
    const t = Math.min(state.speed / CONFIG.run.maxSpeed, 1);
    const O = CONFIG.obstacle;
    nextObsZ += spec.len + rand(O.minGap, O.maxGap) * (0.75 + t * 0.9);
  }

  const cutoff = state.distance + CONFIG.camera.nearZ - 100;
  obstacles = obstacles.filter((o) => o.z + o.len > cutoff);
}

function updateObstacles() {
  for (const o of obstacles) {
    const spec = OBSTACLES[o.type];
    if (spec.sway) {
      // 김XX: 중앙에서 좌우로 몸을 흔들며 길을 막음 → 타이밍 회피
      const half = CONFIG.tunnel.size / 2;
      const lim = half - spec.w / 2 - 12;
      o.x = Math.max(-lim, Math.min(lim, o.baseX + Math.sin(state.time * 2.2 + o.seed) * spec.sway));
    }
  }
}


function hitMeme(o) {
  state.slowT = 1.3;
  state.coverT = 1.0;
  state.speed = Math.max(currentLevel().base * 0.6, state.speed * 0.55);
  if (o.meme.text === '영혼 없는 춤…') state.stunT = 0.5; // 따라 추느라 조작 잠김

  state.memeText = o.meme.text;
  state.memeToken++;   // 같은 문구라도 애니메이션이 다시 재생되도록
  emit();

  const p = playerScreenPos();
  spawnBurst(p.x, p.y, o.meme.rgb, 20, 260);
}

function checkObstacles() {
  const pz = state.distance + CONFIG.player.z;
  const size = CONFIG.player.size;

  for (const o of obstacles) {
    if (o.hit || o.face !== state.surface) continue;
    const spec = OBSTACLES[o.type];

    if (pz < o.z - size * 0.3 || pz > o.z + o.len + size * 0.3) continue;
    if (Math.abs(player.x - o.x) > spec.w / 2 + size * 0.32) continue;

    // 세로 판정: 플레이어 몸통 [height, height+size] vs 장애물 [bottom, top]
    const bottom = spec.hover || 0;
    const top = bottom + spec.h;
    if (player.height >= top - 4 || player.height + size * 0.55 <= bottom) continue;

    o.hit = true;
    if (spec.lethal) { die(spec.label, spec.caught); return; }
    hitMeme(o);
  }
}

function collectCoins() {
  const pz = state.distance + CONFIG.player.z;
  const D = CONFIG.coin.collectDist;
  for (const c of coins) {
    if (c.taken || c.face !== state.surface) continue;
    if (Math.abs(c.z - pz) < D && Math.abs(c.x - player.x) < D && player.height < 70) {
      c.taken = true;
      wallet.coins++;
      state.runCoins++;
      saveWallet();
      const p = project(...faceRot(c.x, CONFIG.tunnel.size / 2 - CONFIG.coin.hover, (c.face - state.surface + 4) % 4), c.z - state.distance);
      spawnBurst(p.x, p.y, [255, 226, 138], 8, 150);
    }
  }
}

// ===== 충돌 판정 =====
function checkFall() {
  if (!player.onGround) return;
  const pz = state.distance + CONFIG.player.z;
  const tol = CONFIG.player.size * 0.35;
  for (const h of holes) {
    if (h.face !== state.surface) continue;
    const inZ = pz > h.z + tol && pz < h.z + h.len - tol;
    const inX = Math.abs(player.x - h.x) < h.width / 2 - tol;
    if (inZ && inX) {
      die('hole');
      return;
    }
  }
}


// ===== 클리어 연출 (침대에 뛰어들어 잠들기) =====
function updateClear(dt) {
  state.clearT += dt;
  const bedTop = CONFIG.bed.height;

  if (!player.onGround) {
    player.vy += CONFIG.player.gravity * 0.5 * dt;
    player.height -= player.vy * dt;
    if (player.vy > 0 && player.height <= bedTop) {
      player.height = bedTop;
      player.vy = 0;
      player.onGround = true;
      const p = playerScreenPos();
      spawnBurst(p.x, p.y, [255, 226, 138], 24, 200); // 이불 속으로 폭
    }
  }

  // 침대 중앙으로 정렬 + 회전 원복
  player.x += (0 - player.x) * lerpK(dt, 6);
  player.vx = 0;
  player.lean += (0 - player.lean) * lerpK(dt, 8);
  player.squash += (0 - player.squash) * lerpK(dt, 10);
  updateRoll(dt);
  cam.x += (0 - cam.x) * lerpK(dt, 4);
  cam.y += (0 - cam.y) * lerpK(dt, 4);

  // Zzz 피어오르기
  if (player.onGround && Math.random() < dt * 2.4) {
    const p = playerScreenPos();
    zzz.push({
      x: p.x + rand(-14, 30), y: p.y - 46 * p.s,
      vy: rand(-46, -30), size: rand(15, 30),
      rot: rand(-0.35, 0.35), life: 2.6, maxLife: 2.6,
    });
  }
  for (const z of zzz) {
    z.y += z.vy * dt;
    z.x += Math.sin(state.time * 2.2 + z.size) * 10 * dt;
    z.life -= dt;
  }
  zzz = zzz.filter((z) => z.life > 0);

  updateParticles(dt);

  // 잠드는 연출이 끝나면 React가 클리어 패널을 띄운다
  if (state.clearT > 1.9 && state.clearInfo && !state.clearInfo.ready) {
    state.clearInfo = { ...state.clearInfo, ready: true };
  }
}

// ===== 업데이트 =====
function update(dt) {
  state.time += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);

  // 밈 말풍선이 화면을 가리는 시간
  if (state.coverT > 0) {
    state.coverT -= dt;
    if (state.coverT <= 0) state.memeText = '';
  }

  if (state.phase === 'home') {
    // 홈 배경: 지영이 터널을 천천히 달리는 데모
    state.distance += 340 * dt;
    state.runPhase += dt * 7.5;
    player.x = Math.sin(state.time * 0.8) * 34;
    player.vx = Math.cos(state.time * 0.8) * 34 * 0.8;
    player.lean += ((player.vx / CONFIG.player.moveSpeed) * 0.9 - player.lean) * lerpK(dt, 6);
    player.squash += (0 - player.squash) * lerpK(dt, 10);
    updateParticles(dt);
    cam.x += (player.x * CONFIG.camera.followX - cam.x) * lerpK(dt, 8);
    cam.y += (0 - cam.y) * lerpK(dt, 8);
    return;
  }

  if (state.phase === 'clear') {
    updateClear(dt);
    return;
  }

  if (state.phase === 'playing') {
    const lv = currentLevel();
    if (state.stunT > 0) state.stunT -= dt;
    if (state.slowT > 0) state.slowT -= dt;

    const accel = state.slowT > 0 ? CONFIG.run.accel * 0.3 : CONFIG.run.accel;
    state.speed = Math.min(state.speed + accel * dt, lv.max);
    state.distance += state.speed * dt;
    // 다리 사이클: 속도에 비례하되 너무 빨라 잔상이 되지 않게 제한
    state.runPhase += dt * Math.min(1.7, state.speed / lv.base) * 10.5;

    // 침대 도착 → 클리어 연출
    if (state.distance + CONFIG.player.z >= state.goalZ) {
      state.distance = state.goalZ - CONFIG.player.z;
      reachBed();
      return;
    }

    // 좌우 이동 — 가감속을 둬서 뚝뚝 끊기지 않게 (밈에 홀리면 조작 잠김)
    const half = CONFIG.tunnel.size / 2 - CONFIG.player.size / 2 - 8;
    const locked = state.stunT > 0;
    const dir = locked ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const targetVx = dir * CONFIG.player.moveSpeed;
    player.vx += (targetVx - player.vx) * lerpK(dt, dir ? 16 : 22);
    player.x += player.vx * dt;

    if (player.x <= -half) { player.x = -half; player.vx = Math.max(0, player.vx); }
    if (player.x >= half)  { player.x = half;  player.vx = Math.min(0, player.vx); }

    // 점프 / 중력
    if (!player.onGround) {
      player.vy += CONFIG.player.gravity * dt;
      player.height -= player.vy * dt;
      if (player.height <= 0) {
        player.height = 0;
        player.vy = 0;
        player.onGround = true;
        player.squash = 0.3; // 착지 스쿼시
        const p = playerScreenPos();
        spawnBurst(p.x, p.y + CONFIG.player.size * p.s * 0.4, [184, 169, 224], 8, 130);
      }
    }

    // 벽 타기: 벽에 붙어서 그 방향을 계속 누르면 자연스럽게 그 벽면으로 넘어감
    // (공중이면 바로, 땅 위에서 달리는 중이면 잠깐 벽을 타고 오르는 시간을 둔다)
    const atRight = player.x >= half - 1 && input.right && !locked;
    const atLeft = player.x <= -half + 1 && input.left && !locked;
    if (atRight || atLeft) {
      wallHold += dt;
      const need = player.onGround ? 0.14 : 0;
      // 벽에 스치는 먼지
      if (Math.random() < dt * 30) {
        const p = playerScreenPos();
        spawnBurst(p.x, p.y - CONFIG.player.size * p.s * 0.3, [184, 169, 224], 1, 70);
      }
      if (wallHold >= need) shiftGravity(atRight ? 'right' : 'left');
    } else {
      wallHold = 0;
    }

    // 유니콘 스킨: 달릴 때 반짝이 잔상
    if (wallet.equipped === 'unicorn' && Math.random() < dt * 22) {
      const p = playerScreenPos();
      const hue = [[255, 150, 180], [255, 226, 138], [150, 220, 255], [190, 150, 255]][Math.floor(Math.random() * 4)];
      spawnBurst(p.x + rand(-12, 12), p.y + rand(-6, 14), hue, 1, 60);
    }

    spawnHoles();
    spawnObstacles();
    spawnCoins();
    updateObstacles();
    collectCoins();
    checkFall();
    checkObstacles();
    // 점수·진행도는 스냅샷(snapshot)에서 계산해 React로 넘어간다
  } else if (state.phase === 'dying') {
    player.vy += CONFIG.player.gravity * dt;
    player.height -= player.vy * dt;
    state.dyingRot += dt * 7; // 넘어지며 빙글 도는 연출
    if (player.height < -420) {
      state.phase = 'gameover';
      const lv = currentLevel();
      const meters = Math.floor(state.distance / CONFIG.score.unitsPerMeter);
      const newRecord = meters > bestMeters;
      if (newRecord) saveBest(meters);
      saveWallet();

      state.memeText = '';
      state.overInfo = {
        meters,
        goal: lv.goal,
        reason: state.deathBy === 'hole'
          ? '구멍에 빠져 잠이 확 깼어요'
          : (state.deathMsg || `${state.deathBy}에게 붙잡혔어요`),
        runCoins: state.runCoins,
        newRecord,
      };
    }
  }

  updateRoll(dt);

  // 이동 방향으로 기울기 + 착지 스쿼시 회복
  const leanTarget = (player.vx / CONFIG.player.moveSpeed) * 0.2;
  player.lean += (leanTarget - player.lean) * lerpK(dt, 9);
  player.squash += (0 - player.squash) * lerpK(dt, 12);

  updateParticles(dt);

  // 카메라가 플레이어(회전 반영)를 부드럽게 따라감
  const half = CONFIG.tunnel.size / 2;
  const pcx = player.x;
  const pcy = half - Math.max(player.height, 0) - CONFIG.player.size / 2;
  const c = Math.cos(state.roll), sn = Math.sin(state.roll);
  const rx = pcx * c - pcy * sn;
  const ry = pcx * sn + pcy * c;
  const camTX = rx * CONFIG.camera.followX;
  const camTY = (ry - (half - CONFIG.player.size / 2)) * CONFIG.camera.followY;
  cam.x += (camTX - cam.x) * lerpK(dt, 11);
  cam.y += (camTY - cam.y) * lerpK(dt, 9);
}

// 벽 전환 회전: ±90°에서 0으로 이징 (앞뒤로 부드럽게 가속·감속)
function updateRoll(dt) {
  if (rollAnim.t >= rollAnim.dur) {
    state.roll = 0;
    return;
  }
  rollAnim.t = Math.min(rollAnim.dur, rollAnim.t + dt);
  const k = easeInOutCubic(rollAnim.t / rollAnim.dur);
  state.roll = rollAnim.from * (1 - k);
}


// ===== 렌더링: 배경/터널 =====
function quad(a, b, c, d, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

function shade(rgb, z) {
  const t = Math.min(z / CONFIG.tunnel.depth, 1);
  const f = 1 - t * 0.93;
  return `rgb(${(rgb[0] * f) | 0},${(rgb[1] * f) | 0},${(rgb[2] * f) | 0})`;
}

function drawStars() {
  ctx.fillStyle = '#101228';
  ctx.fillRect(0, 0, view.w, view.h);
  for (const s of stars) {
    const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * s.twinkle + s.phase));
    ctx.fillStyle = `rgba(210, 225, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(s.x * view.w, s.y * view.h, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 로컬 면 인덱스(0=바닥 1=왼벽 2=천장 3=오른벽)별 색상 — 라벤더 밤 톤
const FACE_COLORS = [
  [64, 58, 112],  // 바닥 (가장 밝음)
  [46, 42, 88],   // 왼쪽 벽
  [34, 30, 66],   // 천장 (가장 어두움)
  [46, 42, 88],   // 오른쪽 벽
];

function drawTunnel() {
  const T = CONFIG.tunnel;
  const half = T.size / 2;
  const near = CONFIG.camera.nearZ;
  const offset = state.distance % T.segmentLen;
  const numSegs = Math.ceil(T.depth / T.segmentLen) + 1;

  // --- 4개 면 ---
  for (let k = numSegs - 1; k >= 0; k--) {
    let z0 = k * T.segmentLen - offset;
    let z1 = z0 + T.segmentLen;
    if (z1 <= near) continue;
    z0 = Math.max(z0, near);
    z1 = Math.min(z1, T.depth);
    if (z0 >= z1) continue;
    const zMid = (z0 + z1) / 2;

    for (let r = 0; r < 4; r++) {
      const [ax, ay] = faceRot(-half, half, r);
      const [bx, by] = faceRot(half, half, r);
      quad(project(ax, ay, z0), project(bx, by, z0),
           project(bx, by, z1), project(ax, ay, z1), shade(FACE_COLORS[r], zMid));
    }
  }

  // --- 꿈나라 빛 (터널 끝 소실점의 따뜻한 빛) ---
  const vp = project(0, 0, T.depth);
  const glowR = Math.max(view.w, view.h) * 0.09;
  const g = ctx.createRadialGradient(vp.x, vp.y, 0, vp.x, vp.y, glowR);
  g.addColorStop(0, 'rgba(255, 226, 138, 0.5)');
  g.addColorStop(1, 'rgba(255, 226, 138, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(vp.x - glowR, vp.y - glowR, glowR * 2, glowR * 2);

  // --- 구멍 ---
  for (const h of holes) {
    let z0 = h.z - state.distance;
    let z1 = z0 + h.len;
    if (z1 <= near || z0 >= T.depth) continue;
    z0 = Math.max(z0, near);
    z1 = Math.min(z1, T.depth);
    const r = (h.face - state.surface + 4) % 4;
    const x0 = h.x - h.width / 2;
    const x1 = h.x + h.width / 2;
    const [ax, ay] = faceRot(x0, half, r);
    const [bx, by] = faceRot(x1, half, r);
    const a = project(ax, ay, z0), b = project(bx, by, z0),
          c = project(bx, by, z1), d = project(ax, ay, z1);
    quad(a, b, c, d, '#06060f');
    const danger = r === 0;
    const fade = Math.max(0, 1 - z0 / T.depth);
    ctx.strokeStyle = danger
      ? `rgba(255, 140, 160, ${fade * 0.7})`
      : `rgba(150, 120, 220, ${fade * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.stroke();
  }

  // --- 세그먼트 경계 링 ---
  for (let k = 0; k < numSegs; k++) {
    const z = k * T.segmentLen - offset + T.segmentLen;
    if (z <= near || z > T.depth) continue;
    const fade = 1 - z / T.depth;
    ctx.strokeStyle = `rgba(184, 169, 224, ${fade * 0.5})`;
    ctx.lineWidth = Math.max(0.6, 2.2 * fade);
    const a = project(-half, -half, z), b = project(half, -half, z),
          c = project(half, half, z), d = project(-half, half, z);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.stroke();
  }

  // --- 모서리 세로 라인 ---
  ctx.strokeStyle = 'rgba(200, 185, 250, 0.65)';
  ctx.lineWidth = 1.6;
  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
  for (const [x, y] of corners) {
    const p0 = project(x, y, near);
    const p1 = project(x, y, T.depth);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
}

// ===== 별사탕 코인 =====


function drawCoins() {
  const T = CONFIG.tunnel;
  const half = T.size / 2;
  const near = CONFIG.camera.nearZ;
  for (const c of coins) {
    if (c.taken) continue;
    const z = c.z - state.distance;
    if (z <= near || z >= T.depth) continue;
    const r = (c.face - state.surface + 4) % 4;
    const bob = Math.sin(state.time * 3 + c.z * 0.02) * 5;
    const [wx, wy] = faceRot(c.x, half - CONFIG.coin.hover - bob, r);
    const p = project(wx, wy, z);
    const R = CONFIG.coin.radius * p.s;
    if (R < 1.2) continue;
    const spin = 0.35 + 0.65 * Math.abs(Math.sin(state.time * 3.2 + c.z * 0.015));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(state.roll);
    ctx.scale(spin, 1);
    ctx.shadowColor = 'rgba(255, 226, 138, 0.8)';
    ctx.shadowBlur = 10 * Math.min(p.s, 1.4);
    drawStarShape(ctx, 0, 0, R);
    ctx.fillStyle = PAL.star;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, R * 0.14);
    ctx.strokeStyle = PAL.navy;
    ctx.stroke();
    ctx.restore();
  }
}

// ===== 침대 (골인 지점) =====
function drawBed() {
  if (!state.goalZ || state.phase === 'home') return;
  const T = CONFIG.tunnel, B = CONFIG.bed;
  const half = T.size / 2;
  const near = CONFIG.camera.nearZ;

  const z0 = state.goalZ - state.distance - B.len * 0.12;
  const z1 = z0 + B.len;
  if (z1 <= near || z0 >= T.depth) return;
  const zn = Math.max(z0, near);

  const w = B.width / 2;
  const top = half - B.height;   // 매트리스 윗면
  const base = half;             // 바닥
  const P = (x, y, z) => project(x, y, z);

  // 골인 지점 후광
  const gp = project(0, top, Math.max(z0, near));
  const R = 150 * gp.s;
  if (R > 2) {
    const gl = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, R);
    gl.addColorStop(0, 'rgba(255, 226, 138, 0.35)');
    gl.addColorStop(1, 'rgba(255, 226, 138, 0)');
    ctx.fillStyle = gl;
    ctx.fillRect(gp.x - R, gp.y - R, R * 2, R * 2);
  }

  // 헤드보드 (안쪽 끝)
  quad(P(-w, top - 46, z1), P(w, top - 46, z1), P(w, base, z1), P(-w, base, z1), '#6E5FA8');
  // 매트리스 옆면 (가까운 쪽)
  quad(P(-w, top, zn), P(w, top, zn), P(w, base, zn), P(-w, base, zn), '#8A7BC8');
  // 매트리스 윗면
  quad(P(-w, top, zn), P(w, top, zn), P(w, top, z1), P(-w, top, z1), '#FFF3D6');
  // 이불 (앞쪽 절반, 라벤더)
  const zb = zn + (z1 - zn) * 0.52;
  quad(P(-w, top - 7, zn), P(w, top - 7, zn), P(w, top - 7, zb), P(-w, top - 7, zb), '#B8A9E0');
  quad(P(-w, top - 7, zn), P(w, top - 7, zn), P(w, top + 3, zn), P(-w, top + 3, zn), '#9C8CCB');
  // 베개
  const zp = z1 - (z1 - zn) * 0.14;
  quad(P(-w * 0.62, top - 12, zp - 26), P(w * 0.62, top - 12, zp - 26),
       P(w * 0.62, top - 12, zp + 20), P(-w * 0.62, top - 12, zp + 20), '#FFFBF0');

  // 외곽선
  const a = P(-w, top, zn), b = P(w, top, zn), c = P(w, top, z1), d = P(-w, top, z1);
  ctx.strokeStyle = 'rgba(43, 45, 92, 0.75)';
  ctx.lineWidth = Math.max(1, 2 * gp.s);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.stroke();
}

function drawZzz() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const z of zzz) {
    const a = Math.max(0, z.life / z.maxLife);
    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.rotate(z.rot);
    ctx.font = `${z.size}px Jua, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(43, 45, 92, ${a * 0.8})`;
    ctx.strokeText('Z', 0, 0);
    ctx.fillStyle = `rgba(255, 243, 214, ${a})`;
    ctx.fillText('Z', 0, 0);
    ctx.restore();
  }
}

// ===== 방해요인 렌더 =====
// 말풍선 (장애물 머리 위) — 월드 단위 좌표계
function bubble(g, text, cx, cy, fill) {
  g.font = '11px Jua, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const w = Math.max(38, g.measureText(text).width + 14);
  rr(g, cx - w / 2, cy - 10, w, 20, 8);
  g.fillStyle = fill; g.fill();
  g.strokeStyle = PAL.navy; g.lineWidth = 1.8; g.stroke();
  g.beginPath();
  g.moveTo(cx - 4, cy + 9); g.lineTo(cx + 3, cy + 9); g.lineTo(cx - 1, cy + 16);
  g.closePath(); g.fillStyle = fill; g.fill(); g.stroke();
  g.fillStyle = PAL.navy;
  g.fillText(text, cx, cy);
}

function drawObstacleShape(g, o, t) {
  g.lineWidth = 2.2;
  g.lineJoin = 'round';

  if (o.type === 'sibling') {
    // 바닥에서 올라온 동생 — 정수리 + 두 손 (점프로 넘기)
    const up = 2 + Math.sin(t * 3 + o.seed) * 2;
    g.beginPath(); g.arc(0, -up, 20, Math.PI, 0); g.closePath();
    outlined(g, PAL.hair);
    for (const s of [-1, 1]) {
      g.beginPath(); g.ellipse(s * 34, -10 - up, 9, 12, s * 0.2, 0, Math.PI * 2);
      outlined(g, PAL.skin);
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(s * 34 + i * 5, -20 - up);
        g.lineTo(s * 34 + i * 5, -27 - up);
        g.strokeStyle = PAL.navy; g.lineWidth = 3; g.stroke();
      }
    }
    g.lineWidth = 2.2;
    return;
  }

  if (o.type === 'meme') {
    // 릴스 밈 — 스마트폰에서 튀어나온 반투명 유령
    const [r, gg, b] = o.meme.rgb;
    const fl = 0.55 + 0.45 * Math.abs(Math.sin(t * 5 + o.seed));
    const y = -70 + Math.sin(t * 2.4 + o.seed) * 8;
    g.save();
    g.globalAlpha = 0.9;
    g.shadowColor = `rgba(${r},${gg},${b},${fl})`;
    g.shadowBlur = 18;
    g.beginPath();
    g.arc(0, y, 26, Math.PI, 0);
    g.lineTo(26, y + 22);
    for (let i = 0; i < 3; i++) g.quadraticCurveTo(13 - i * 17, y + 34, -i * 17 - 4, y + 22);
    g.lineTo(-26, y + 22);
    g.closePath();
    g.fillStyle = `rgba(${r},${gg},${b},0.55)`;
    g.fill();
    g.strokeStyle = `rgba(255,255,255,0.8)`; g.lineWidth = 2; g.stroke();
    g.shadowBlur = 0;
    // 눈
    for (const s of [-1, 1]) {
      g.beginPath(); g.arc(s * 9, y - 2, 4, 0, Math.PI * 2);
      g.fillStyle = PAL.navy; g.fill();
    }
    g.restore();
    bubble(g, o.meme.text, 0, y - 42, `rgba(${r},${gg},${b},0.95)`);
    return;
  }

  // 사람형 방해꾼 공통 (아빠 · 조XX · 김XX)
  // 친구 시안 톤: 라벤더/퍼플 상의 · 회색 바지 · 갈색 어깨머리 · 졸린 얼굴
  const cfg = {
    dad: { body: '#8FA0C8', legs: '#5A5F92', head: PAL.skin, hair: '#3A3F63', H: 150 },
    jo:  { body: '#AEA2DA', legs: '#8C8AA0', head: PAL.skin, hair: '#5B4636', H: 144 },
    kim: { body: '#9E8FCB', legs: '#8C8AA0', head: PAL.skin, hair: '#5B4636', H: 148 },
  }[o.type];
  const friend = o.type !== 'dad';
  const sway = o.type === 'kim' ? Math.sin(t * 6 + o.seed) * 0.1 : 0;

  g.save();
  g.rotate(sway);

  // 다리 (슬림한 바지)
  for (const s of [-1, 1]) { rr(g, s * 3 + (s > 0 ? 0 : -10), -36, 10, 38, 4); outlined(g, cfg.legs); }
  // 몸통 (상의)
  rr(g, -19, -cfg.H + 42, 38, cfg.H - 78, 11);
  outlined(g, cfg.body);

  if (o.type === 'dad') {
    // 팔짱
    rr(g, -22, -cfg.H + 62, 44, 12, 6); outlined(g, cfg.body);
  } else if (o.type === 'jo') {
    // 왼팔은 내리고, 오른손은 폰을 얼굴 앞으로 ("자니?")
    rr(g, -23, -cfg.H + 52, 9, 30, 4); outlined(g, cfg.body);
    g.save();
    g.translate(19, -cfg.H + 40);
    rr(g, -5, 0, 10, 30, 4); outlined(g, cfg.body);          // 세운 팔뚝
    rr(g, -9, -18, 18, 24, 3); outlined(g, PAL.navy);        // 스마트폰
    g.fillStyle = '#9FD8FF'; g.fillRect(-6, -15, 12, 18);
    g.restore();
  } else {
    // 김XX: 두 손을 얼굴 옆으로 (안절부절 "한 판만!")
    for (const s of [-1, 1]) {
      const a = Math.sin(t * 7 + o.seed + (s > 0 ? 0 : Math.PI)) * 0.12;
      g.save();
      g.translate(s * 16, -cfg.H + 50);
      g.rotate(s * (0.8 + a));
      rr(g, -5, -28, 10, 30, 5); outlined(g, cfg.body);      // 팔
      g.beginPath(); g.arc(0, -30, 6, 0, Math.PI * 2); outlined(g, cfg.head); // 손
      g.restore();
    }
  }

  // 머리
  const hy = -cfg.H + 22;
  g.beginPath(); g.arc(0, hy, 19, 0, Math.PI * 2);
  outlined(g, cfg.head);

  // 어깨까지 내려오는 머리 (친구) — 갈색 웨이브
  if (friend) {
    g.fillStyle = cfg.hair;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 16, hy - 8);
      g.quadraticCurveTo(s * 25, hy + 6, s * 20, hy + 30);
      g.quadraticCurveTo(s * 12, hy + 18, s * 11, hy - 2);
      g.closePath(); g.fill();
    }
  }
  // 정수리 앞머리
  g.beginPath(); g.arc(0, hy - 3, 19, Math.PI * 1.02, Math.PI * 1.98);
  g.strokeStyle = cfg.hair; g.lineWidth = friend ? 8 : 9; g.stroke();
  g.lineWidth = 2.2;

  if (o.type === 'dad') {
    // 안경 + 못마땅한 입
    for (const s of [-1, 1]) {
      g.beginPath(); g.arc(s * 8, hy + 2, 6, 0, Math.PI * 2);
      g.strokeStyle = PAL.navy; g.lineWidth = 2; g.stroke();
    }
    g.beginPath(); g.moveTo(-2, hy + 2); g.lineTo(2, hy + 2); g.stroke();
    g.beginPath(); g.moveTo(-6, hy + 11); g.quadraticCurveTo(0, hy + 9, 6, hy + 11); g.stroke();
  } else if (o.type === 'kim') {
    // 졸린 눈 + 걱정스런 입 + 헤드셋
    g.strokeStyle = PAL.navy; g.lineWidth = 2; g.lineCap = 'round';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 7, hy + 1, 4, Math.PI * 0.12, Math.PI * 0.88); g.stroke(); }
    g.beginPath(); g.ellipse(0, hy + 10, 3, 2.6, 0, 0, Math.PI * 2); g.fillStyle = PAL.navy; g.fill();
    g.beginPath(); g.arc(0, hy - 2, 23, Math.PI * 1.08, Math.PI * 1.92);
    g.strokeStyle = PAL.navy; g.lineWidth = 5; g.stroke();
    for (const s of [-1, 1]) { rr(g, s * 22 - 6, hy - 7, 12, 17, 5); outlined(g, '#3A3652'); }
    g.lineWidth = 2.2;
  } else {
    // 조XX: 졸린 반쯤 감긴 눈 + 다크서클 + 옅은 미소
    g.strokeStyle = PAL.navy; g.lineWidth = 2; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 7 - 3.2, hy + 1); g.quadraticCurveTo(s * 7, hy + 3.4, s * 7 + 3.2, hy + 1); g.stroke();
    }
    g.strokeStyle = 'rgba(43,45,92,0.32)'; g.lineWidth = 1.3;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 7 - 2.6, hy + 4.6); g.quadraticCurveTo(s * 7, hy + 6, s * 7 + 2.6, hy + 4.6); g.stroke();
    }
    g.strokeStyle = PAL.navy; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-3, hy + 10); g.quadraticCurveTo(0, hy + 12, 3, hy + 10); g.stroke();
  }

  // 볼터치 (친구)
  if (friend) {
    g.fillStyle = 'rgba(255,150,170,0.45)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 11, hy + 7, 3.6, 2.3, 0, 0, Math.PI * 2); g.fill(); }
  }

  g.restore();

  const say = { dad: '아직 안 자?', jo: '자니?', kim: '한 판만!' }[o.type];
  const fill = o.type === 'jo' ? '#FFE875' : '#FFF3D6';
  bubble(g, say, 0, -cfg.H - 16, fill);
}

function drawObstacles() {
  const T = CONFIG.tunnel;
  const half = T.size / 2;
  const near = CONFIG.camera.nearZ;

  // 먼 것부터 그려서 겹침 순서 유지
  const sorted = obstacles.slice().sort((a, b) => b.z - a.z);
  for (const o of sorted) {
    const z = o.z - state.distance + o.len / 2;
    if (z <= near || z >= T.depth) continue;
    const r = (o.face - state.surface + 4) % 4;
    const [wx, wy] = faceRot(o.x, half, r);
    const p = project(wx, wy, z);
    if (p.s < 0.05) continue;

    // 거리에 따라 어두워짐 (터널 셰이딩과 톤 맞추기)
    const fade = Math.max(0.25, 1 - z / T.depth);

    ctx.save();
    ctx.globalAlpha = o.hit && OBSTACLES[o.type].lethal ? 0.35 : fade;
    ctx.translate(p.x, p.y);
    ctx.rotate(state.roll + (r * Math.PI) / 2);
    ctx.scale(p.s, p.s);
    drawObstacleShape(ctx, o, state.time);
    ctx.restore();
  }
}


// ===== 플레이어 렌더링 (스프라이트 시트 우선, 없으면 벡터) =====
function currentAnim() {
  if (state.phase === 'dying') return 'fall';
  if (state.phase === 'clear' && player.onGround) return 'sleep';
  if (!player.onGround) {
    if (player.vy < -160) return 'jumpRise';
    if (player.vy < 160) return 'jumpPeak';
    return 'jumpFall';
  }
  return 'run';
}

function drawPlayer() {
  const T = CONFIG.tunnel;
  const P = CONFIG.player;
  const floorY = T.size / 2;
  const z = P.z;
  const skin = skinByKey(wallet.equipped);
  const sleeping = state.phase === 'clear' && player.onGround;

  // 그림자
  if (state.phase !== 'dying' && !sleeping) {
    const sh = project(player.x, floorY, z);
    const shScale = Math.max(0.3, 1 - player.height / 260);
    ctx.fillStyle = `rgba(10, 10, 30, ${0.5 * shScale})`;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, P.size * sh.s * 0.55 * shScale, P.size * sh.s * 0.18 * shScale, state.roll, 0, Math.PI * 2);
    ctx.fill();
  }

  // 발바닥 기준점
  const feet = project(player.x, floorY - player.height, z);
  const alpha = state.phase === 'dying' ? Math.max(0, 1 + player.height / 420) : 1;

  // 점프 스트레치 / 착지 스쿼시
  let sx = 1, sy = 1;
  if (!player.onGround && state.phase === 'playing') {
    const k = Math.max(-0.22, Math.min(0.22, -player.vy / 900));
    sy = 1 + k * 0.6;
    sx = 1 - k * 0.4;
  }
  sy *= 1 - player.squash;
  sx *= 1 + player.squash * 0.7;

  const lean = state.phase === 'dying' ? 0 : player.lean;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(feet.x, feet.y);
  // 잠들 때는 침대에 옆으로 눕는다 (발 기준점에서 90° 회전)
  ctx.rotate(state.roll + lean + (state.phase === 'dying' ? state.dyingRot : 0) + (sleeping ? -Math.PI / 2 : 0));
  ctx.scale(feet.s * sx, feet.s * sy);

  const sheet = sprites[skin.key];
  const J = getManifest().jiyoung;
  if (sleeping && !(sheet && sheet.ok && J.anims)) {
    // 벡터 모드: 앞모습(졸린 얼굴)으로 누운 포즈 + 숨쉬기
    ctx.save();
    ctx.scale(1, 1 + Math.sin(state.time * 2.2) * 0.03);
    drawRunnerFront(ctx, skin);
    ctx.restore();
    ctx.restore();
    return;
  }

  if (sheet && sheet.ok && J.anims) {
    // 스프라이트 시트 모드 (manifest 규격 기반)
    const anim = J.anims[currentAnim()] || J.anims.run;
    const idx = Math.floor(state.time * (anim.fps || 10)) % anim.frames.length;
    const [col, row] = anim.frames[idx];
    const drawH = 60; // 월드 단위 표시 크기
    ctx.drawImage(
      sheet.img,
      col * J.frameW, row * J.frameH, J.frameW, J.frameH,
      -drawH / 2, -drawH, drawH, drawH
    );
  } else {
    drawRunnerBack(ctx, skin, currentAnim(), state.runPhase, state.time);
  }

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = `rgba(${p.rgb[0]}, ${p.rgb[1]}, ${p.rgb[2]}, ${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPops() {
  for (const p of pops) {
    const a = Math.max(0, p.life / p.maxLife);
    const scale = 1.5 - 0.5 * a; // 툭 튀어나오는 느낌
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    ctx.rotate(-0.08);
    ctx.font = '34px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = `rgba(43, 45, 92, ${a})`;
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = `rgba(255, 226, 138, ${a})`;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(12, 13, 32, 0.55)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = PAL.cream;
  ctx.font = '42px Jua, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('잠깐 쉬는 중…', view.w / 2, view.h / 2 - 20);
  ctx.font = '17px "Gowun Dodum", sans-serif';
  ctx.fillStyle = 'rgba(184, 169, 224, 0.9)';
  ctx.fillText('P 또는 ▶ 버튼으로 계속', view.w / 2, view.h / 2 + 28);
}

function render() {
  // 캔버스 버퍼는 DPR 배율 → 모든 그리기는 CSS 픽셀(view) 좌표로 통일
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

  ctx.save();
  if (state.shake > 0) {
    const s = state.shake * 26;
    ctx.translate(rand(-s, s), rand(-s, s));
  }

  drawStars();
  drawTunnel();
  drawBed();
  drawObstacles();
  drawCoins();
  if (state.phase !== 'gameover') drawPlayer();
  drawParticles();
  drawPops();
  drawZzz();

  ctx.restore();

  if (state.paused && !shopIsOpen) drawPauseOverlay();
}


// ===== 상점 (React UI가 호출) =====
let shopWasPaused = false;

function setShopOpen(open) {
  if (open) {
    shopWasPaused = state.paused;
    if (state.phase === 'playing') state.paused = true;
  } else if (state.phase === 'playing' && !shopWasPaused) {
    state.paused = false;
  }
  shopIsOpen = open;
  emit();
}

function buySkin(key) {
  const skin = skinByKey(key);
  if (wallet.owned.includes(key)) {   // 이미 있으면 장착만
    wallet.equipped = key;
  } else if (wallet.coins >= skin.price) {
    wallet.coins -= skin.price;
    wallet.owned.push(key);
    wallet.equipped = key;
  } else {
    return false;                      // 코인 부족
  }
  saveWallet();
  emit();
  return true;
}

// ===== 뽕망치 (긴급 아이템) =====
// 구매: 코인 차감, 동시 보유 1개까지(중복구매 방지)
function buyHammer() {
  if (wallet.hammers >= HAMMER.maxHold) return false; // 이미 보유 → 중복구매 X
  if (wallet.coins < HAMMER.price) return false;      // 코인 부족
  wallet.coins -= HAMMER.price;
  wallet.hammers += 1;
  saveWallet();
  emit();
  return true;
}

// 장애물의 화면 좌표 (파괴 이펙트 위치용) — drawObstacles와 동일한 투영
function obstacleScreenPos(o) {
  const half = CONFIG.tunnel.size / 2;
  const z = o.z - state.distance + o.len / 2;
  const r = (o.face - state.surface + 4) % 4;
  const [wx, wy] = faceRot(o.x, half, r);
  return project(wx, wy, z);
}

// 사용: 현재 면 앞쪽 사거리 안의 가장 가까운 치명 장애물을 부수고 지나감
function useHammer() {
  if (state.phase !== 'playing' || state.paused) return false;
  if (wallet.hammers <= 0) return false;

  const pz = state.distance + CONFIG.player.z;
  let target = null, best = Infinity;
  for (const o of obstacles) {
    if (o.hit || o.face !== state.surface) continue;
    if (!OBSTACLES[o.type].lethal) continue;          // 밈은 대상 아님(안 죽음)
    if (o.z + o.len < pz) continue;                   // 이미 지나친 건 제외 (앞/겹침만)
    const d = o.z + o.len / 2 - pz;                    // 중심까지 앞쪽 거리
    if (d > HAMMER.range) continue;                    // 사거리 밖
    if (d < best) { best = d; target = o; }
  }
  if (!target) return false;                           // 부술 대상 없으면 소모 안 함

  const p = obstacleScreenPos(target);
  obstacles = obstacles.filter((o) => o !== target);   // 뽕! 하고 사라짐
  wallet.hammers -= 1;
  saveWallet();

  spawnBurst(p.x, p.y - 22, [255, 226, 138], 30, 380);
  spawnBurst(p.x, p.y - 12, [255, 150, 170], 22, 300);
  spawnPop(p.x, p.y - 46, '뽕!');
  state.shake = Math.max(state.shake, 0.3);
  emit();
  return true;
}

// ===== 메인 루프 (deltaTime 기반, 프레임 독립적) =====
let lastTime = 0;

function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!state.paused) update(dt);
  render();
  emit();

  rafId = requestAnimationFrame(gameLoop);
}

// ===== 초기화 / 정리 (React useEffect에서 호출) =====
function init(canvasEl, onState) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  listener = onState;

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('visibilitychange', onVisibility);

  initStars();
  loadAssets().then(() => {
    if (!getManifest().skins.some((s) => s.key === wallet.equipped)) wallet.equipped = 'base';
    emit();
  });

  state.selected = wallet.unlocked;
  showHome();

  lastTime = performance.now();
  rafId = requestAnimationFrame(gameLoop);

  return destroy;
}

function destroy() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  document.removeEventListener('visibilitychange', onVisibility);
  listener = null;
  lastSnapshot = '';
}

export {
  init,
  destroy,
  startLevel,
  showHome,
  selectLevel,
  goNextLevel,
  togglePause,
  setShopOpen,
  buySkin,
  buyHammer,
  useHammer,
  setMove,
  jump,
  tap,
  LEVELS,
};
