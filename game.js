// =====================================================================
// 꿀잠 러너 (Tunnel Runner) — 우주 터널 엔드리스 러너
// 순수 Canvas 2D. 소실점 원근 투영으로 3D 터널을 그린다.
//
// [중력 전환 구조]
// 물리는 항상 "현재 면이 바닥"인 로컬 좌표계에서 계산한다.
// state.surface(0~3)가 어느 월드 면 위를 달리는지 기억하고,
// 렌더링만 state.roll 각도로 회전시켜 90° 전환 연출을 만든다.
// 면 인덱스: 0=바닥, 1=왼쪽 벽, 2=천장, 3=오른쪽 벽 (월드 기준)
//
// [캐릭터/스킨 — 데이터 주도]
// 코드는 manifest.json(없으면 내장 기본값)만 참조한다.
// manifest의 sheet 경로에 PNG 스프라이트 시트가 있으면 자동 사용,
// 없으면 디자인보드 팔레트 기반 벡터 렌더러로 그린다.
// → 이미지 파일만 규격대로 넣으면 코드 수정 없이 교체됨 (기획서 8절)
// =====================================================================

'use strict';

// ===== 팔레트 (캐릭터_스킨_디자인보드 기준) =====
const PAL = {
  lavender: '#B8A9E0',
  cream: '#FFF3D6',
  navy: '#2B2D5C',
  star: '#FFE28A',
  pink: '#FFB5C0',
  skin: '#FBE3D3',
  hair: '#6B4A32',
};

// ===== 튜닝용 설정값 =====
const CONFIG = {
  // 터널 (월드 단위) — 중력 전환을 위해 정사각형 단면
  tunnel: {
    size: 380,        // 터널 단면 한 변
    depth: 4200,      // 렌더링할 깊이 (앞으로 보이는 거리)
    segmentLen: 210,  // 세그먼트(격자 한 칸) 길이
  },

  // 카메라 / 원근 투영
  camera: {
    fov: 320,         // 투영 배율 (클수록 화면이 확대됨)
    nearZ: 48,        // 이보다 가까운 건 그리지 않음
    followX: 0.55,    // 플레이어 좌우 이동을 카메라가 따라가는 비율
    followY: 0.3,     // 점프 높이를 카메라가 따라가는 비율
  },

  // 게임 진행
  run: {
    baseSpeed: 620,     // 시작 전진 속도 (월드단위/초)
    accel: 9,           // 초당 속도 증가량
    maxSpeed: 2100,     // 최고 속도
  },

  // 플레이어
  player: {
    z: 260,           // 카메라로부터의 고정 깊이
    moveSpeed: 520,   // 좌우 이동 속도
    jumpVel: 640,     // 점프 초기 속도
    gravity: 1850,    // 중력 가속도
    size: 34,         // 히트박스 크기 (월드 단위)
  },

  // 구멍(장애물)
  hole: {
    safeZone: 1800,       // 시작 직후 구멍이 안 나오는 거리
    minLen: 190,
    maxLen: 400,          // 점프 가능 거리로 자동 제한됨
    minWidth: 110,
    maxWidth: 190,
    minGap: 340,
    maxGap: 820,          // 속도 오를수록 좁아짐
    currentFaceBias: 0.5, // 현재 달리는 면에 구멍이 생길 확률
  },

  // 별사탕 코인
  coin: {
    safeZone: 900,      // 시작 후 첫 코인까지 거리
    rowMin: 4,          // 한 줄 최소 개수
    rowMax: 6,
    spacing: 92,        // 줄 안에서 코인 간격
    minGap: 480,        // 줄 사이 간격
    maxGap: 1400,
    radius: 15,         // 코인 크기 (월드 단위)
    hover: 16,          // 바닥에서 띄우는 높이
    collectDist: 48,    // 획득 판정 거리
  },

  // 중력 전환 (벽 타기)
  gravityShift: {
    rollDecay: 9,     // 회전 연출 감쇠 속도
  },

  // 방해요인(장애물) 스폰
  obstacle: {
    safeZone: 1500,   // 시작 직후 장애물이 안 나오는 거리
    minGap: 620,
    maxGap: 1250,     // 속도가 오를수록 반응 시간 확보를 위해 늘어남
  },

  // 침대(골인 지점)
  bed: {
    len: 260,         // 침대 깊이 (월드 단위)
    width: 210,
    height: 62,
  },

  stars: { count: 190 },
  score: { unitsPerMeter: 100 }, // 월드 100단위 = 1m
};

// ===== 레벨 (기획서 3절: 1~5 레벨제) =====
// goal = 침대까지의 거리(m). 레벨이 오를수록 빨라지고 방해요인이 늘어난다.
const LEVELS = [
  { name: '거실 탈출',       goal: 300,  base: 560, max: 1050, holes: false, obstacles: ['sibling'],                                 reward: 30 },
  { name: '복도의 아빠',     goal: 450,  base: 640, max: 1350, holes: true,  obstacles: ['sibling', 'dad'],                          reward: 50 },
  { name: '자니? 조XX',      goal: 600,  base: 720, max: 1600, holes: true,  obstacles: ['sibling', 'dad', 'jo'],                    reward: 80 },
  { name: '게임하자 김XX',   goal: 800,  base: 820, max: 1850, holes: true,  obstacles: ['sibling', 'dad', 'jo', 'kim'],             reward: 120 },
  { name: '새벽 3시의 릴스', goal: 1000, base: 920, max: 2100, holes: true,  obstacles: ['sibling', 'dad', 'jo', 'kim', 'meme'],     reward: 200 },
];

// ===== 방해요인 스펙 =====
// w/h = 히트박스 크기(월드 단위). h가 낮으면 점프로 넘을 수 있다 (점프 최고점 ≈ 110).
// lethal: false = 죽지 않고 감속/시야 방해만
const OBSTACLES = {
  sibling: { w: 150, h: 40,  len: 80,  lethal: true,  label: '동생',  hint: '점프로 넘기' },
  dad:     { w: 168, h: 170, len: 110, lethal: true,  label: '아빠',  hint: '좌우로 피하기' },
  jo:      { w: 118, h: 150, len: 90,  lethal: true,  label: '조XX', hint: '벽에서 튀어나옴', edge: true },
  kim:     { w: 130, h: 155, len: 90,  lethal: true,  label: '김XX', hint: '중앙에서 좌우로 흔들림', sway: 92 },
  meme:    { w: 96,  h: 118, len: 70,  lethal: false, label: '밈',   hint: '닿으면 감속 + 시야 방해', hover: 12 },
};

// 밈 라인업 (기획서 5절 — 실존 인물/영상 없이 정서만 패러디)
const MEMES = [
  { text: '냐냐냥!!!',      rgb: [186, 132, 255] },
  { text: '좋🤙다👍',       rgb: [255, 214, 120] },
  { text: '파라파라~',      rgb: [130, 200, 255] },
  { text: '영혼 없는 춤…',  rgb: [180, 160, 240] },
  { text: '옆자리 고를래?', rgb: [255, 150, 190] },
];

// ===== 에셋 매니페스트 (manifest.json이 있으면 덮어씀) =====
let MANIFEST = {
  jiyoung: {
    sheet: 'assets/characters/jiyoung/base_sheet.png',
    frameW: 256, frameH: 256, cols: 4, rows: 4,
    anims: {
      run:      { frames: [[0,0],[1,0],[2,0],[3,0],[0,1],[1,1]], fps: 12 },
      jumpRise: { frames: [[2,1]] },
      jumpPeak: { frames: [[3,1]] },
      jumpFall: { frames: [[0,2]] },
      fall:     { frames: [[2,2],[3,2]], fps: 8 },
      sleep:    { frames: [[0,3],[1,3]], fps: 4 },
    },
    hitboxScale: 0.7,
  },
  skins: [
    { key:'base',    name:'지영 기본', tag:'크림 키구루미 · 부스스 머리', price:0,   hood:'#FFF3D6', inner:'#F7E9D2', accent:'#B8A9E0', sheet:'assets/characters/jiyoung/base_sheet.png' },
    { key:'bear',    name:'곰돌이',   tag:'둥근 귀 · 흰 주둥이',   price:100, hood:'#E5CDA6', inner:'#FFF7EA', accent:'#8A6A46', sheet:'assets/characters/jiyoung/skins/bear_sheet.png' },
    { key:'rabbit',  name:'토끼',     tag:'긴 귀 · 분홍 안감',     price:100, hood:'#F1ECF3', inner:'#FFB5C0', accent:'#E39AAB', sheet:'assets/characters/jiyoung/skins/rabbit_sheet.png' },
    { key:'cat',     name:'고양이',   tag:'세모 귀 · 꼬리',        price:150, hood:'#A9AEC3', inner:'#8B90A8', accent:'#6E7288', sheet:'assets/characters/jiyoung/skins/cat_sheet.png' },
    { key:'dog',     name:'강아지',   tag:'늘어진 귀 · 혀',        price:150, hood:'#EEDCB4', inner:'#B98A5C', accent:'#8A6A46', sheet:'assets/characters/jiyoung/skins/dog_sheet.png' },
    { key:'chick',   name:'병아리',   tag:'작은 부리 · 볏',        price:150, hood:'#FFDD73', inner:'#FF9F45', accent:'#E8890C', sheet:'assets/characters/jiyoung/skins/chick_sheet.png' },
    { key:'pony',    name:'조랑말',   tag:'갈기 · 콧등',           price:200, hood:'#C89A6B', inner:'#FFF3D6', accent:'#7A5232', sheet:'assets/characters/jiyoung/skins/pony_sheet.png' },
    { key:'penguin', name:'펭귄',     tag:'주황 부리 · 빨간 볏',   price:200, hood:'#3A3F63', inner:'#FFF7EA', accent:'#E85D5D', sheet:'assets/characters/jiyoung/skins/penguin_sheet.png' },
    { key:'shark',   name:'상어',     tag:'등지느러미 · 이빨',     price:200, hood:'#7FC5E6', inner:'#FFF7EA', accent:'#5FA8CC', sheet:'assets/characters/jiyoung/skins/shark_sheet.png' },
    { key:'walrus',  name:'바다코끼리', tag:'상아 · 수염',         price:250, hood:'#B08968', inner:'#FFF7EA', accent:'#E85D5D', sheet:'assets/characters/jiyoung/skins/walrus_sheet.png' },
    { key:'dino',    name:'공룡',     tag:'골판 · 이빨 · 꼬리',    price:250, hood:'#6F9B4E', inner:'#4E7A38', accent:'#3A3F63', sheet:'assets/characters/jiyoung/skins/dino_sheet.png' },
    { key:'giraffe', name:'기린',     tag:'뿔 · 갈기',             price:300, hood:'#F3E2BE', inner:'#E8A25C', accent:'#8A6A46', sheet:'assets/characters/jiyoung/skins/giraffe_sheet.png' },
    { key:'unicorn', name:'유니콘',   tag:'금 뿔 · 무지개 (프리미엄)', price:500, hood:'#FBFAFF', inner:'#F5C542', accent:'#B98BEA', sheet:'assets/characters/jiyoung/skins/unicorn_sheet.png' },
  ],
  coin: { sheet: 'assets/coin_sheet.png', frameW: 128, frames: 4, fps: 10 },
};

// 스프라이트 시트 이미지 (로드 성공 시에만 사용, 실패하면 벡터 렌더러)
const sprites = {}; // key → { img, ok }

function loadSpriteSheets() {
  for (const s of MANIFEST.skins) {
    if (!s.sheet) continue;
    const img = new Image();
    const entry = { img, ok: false };
    img.onload = () => { entry.ok = true; };
    img.src = s.sheet;
    sprites[s.key] = entry;
  }
}

function skinByKey(key) {
  return MANIFEST.skins.find((s) => s.key === key) || MANIFEST.skins[0];
}

// ===== 캔버스 / DOM =====
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const coinCountEl = document.getElementById('coin-count');
const pauseBtn = document.getElementById('pause-btn');
const shopBtn = document.getElementById('shop-btn');
const shopEl = document.getElementById('shop');
const shopGridEl = document.getElementById('shop-grid');
const shopCoinsEl = document.getElementById('shop-coins');
const shopCloseBtn = document.getElementById('shop-close');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const failReasonEl = document.getElementById('fail-reason');
const runCoinsEl = document.getElementById('run-coins');
const newRecordEl = document.getElementById('new-record');
const restartBtn = document.getElementById('restart-btn');

// 홈 화면
const homeEl = document.getElementById('home');
const homeBestEl = document.getElementById('home-best');
const homeCoinsEl = document.getElementById('home-coins');
const homeSkinEl = document.getElementById('home-skin');
const homeSkinNameEl = document.getElementById('home-skin-name');
const levelSelectEl = document.getElementById('level-select');
const startBtn = document.getElementById('start-btn');
const homeShopBtn = document.getElementById('home-shop-btn');
const homeHelpBtn = document.getElementById('home-help-btn');
const homeHelpEl = document.getElementById('home-help');
const overHomeBtn = document.getElementById('over-home-btn');

// 인게임 HUD / 레벨 진행도
const hudEl = document.getElementById('hud');
const hintEl = document.getElementById('hint');
const levelNameEl = document.getElementById('level-name');
const progressFillEl = document.getElementById('progress-fill');
const memeCoverEl = document.getElementById('meme-cover');

// 클리어 화면
const clearEl = document.getElementById('clear');
const clearLevelEl = document.getElementById('clear-level');
const clearScoreEl = document.getElementById('clear-score');
const clearCoinsEl = document.getElementById('clear-coins');
const clearUnlockEl = document.getElementById('clear-unlock');
const nextBtn = document.getElementById('next-btn');
const clearHomeBtn = document.getElementById('clear-home-btn');

const ICON_MOON = '<svg viewBox="0 0 64 64" width="22" height="22"><path d="M42 8 A24 24 0 1 0 42 56 A18 18 0 1 1 42 8 Z" fill="#FFE28A" stroke="#2B2D5C" stroke-width="3" stroke-linejoin="round"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 64 64" width="18" height="18"><path d="M20 12 L52 32 L20 52 Z" fill="#FFF3D6"/></svg>';

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ===== 저장 데이터 (최고 기록 + 지갑/스킨) =====
const BEST_KEY = 'tunnelRunner.best';
const SAVE_KEY = 'kkuljam.save';
let bestMeters = 0;
try { bestMeters = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}

// unlocked = 해금된 최고 레벨(1~5), cleared = 클리어한 레벨 번호 목록
let wallet = { coins: 0, owned: ['base'], equipped: 'base', unlocked: 1, cleared: [] };
try {
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (raw && Array.isArray(raw.owned)) {
    wallet = {
      coins: raw.coins | 0,
      owned: raw.owned,
      equipped: raw.equipped || 'base',
      unlocked: Math.min(Math.max(raw.unlocked | 0, 1), LEVELS.length),
      cleared: Array.isArray(raw.cleared) ? raw.cleared : [],
    };
  }
} catch (e) {}

function saveBest(m) {
  bestMeters = m;
  try { localStorage.setItem(BEST_KEY, String(m)); } catch (e) {}
}
function saveWallet() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(wallet)); } catch (e) {}
}
function syncCoinHud() {
  coinCountEl.textContent = wallet.coins;
  shopCoinsEl.textContent = wallet.coins;
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
    x: canvas.width / 2 + (rx - cam.x) * s,
    y: canvas.height / 2 + (ry - cam.y) * s,
    s,
  };
}

function playerScreenPos() {
  const half = CONFIG.tunnel.size / 2;
  const cy = half - player.height - CONFIG.player.size / 2;
  return project(player.x, cy, CONFIG.player.z);
}

// ===== 입력 =====
const shopOpen = () => !shopEl.classList.contains('hidden');

window.addEventListener('keydown', (e) => {
  if (shopOpen()) {
    if (e.code === 'Escape') closeShop();
    return;
  }

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
  if (e.code === 'Escape') {
    if (state.phase === 'gameover') showHome();
    else togglePause();
  }
  if (e.code === 'KeyR' && state.phase === 'gameover') startLevel(state.level);
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase === 'playing') state.paused = true;
  syncPauseBtn();
});

pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', () => startLevel(state.level));
shopBtn.addEventListener('click', openShop);
shopCloseBtn.addEventListener('click', closeShop);

startBtn.addEventListener('click', () => startLevel(state.selected));
homeShopBtn.addEventListener('click', openShop);
homeHelpBtn.addEventListener('click', () => homeHelpEl.classList.toggle('hidden'));
overHomeBtn.addEventListener('click', showHome);
clearHomeBtn.addEventListener('click', showHome);
nextBtn.addEventListener('click', goNextLevel);

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
  syncPauseBtn();
}

function syncPauseBtn() {
  pauseBtn.innerHTML = state.paused ? ICON_PLAY : ICON_MOON;
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
  player.x = 0;
  player.height = 0;
  player.vy = 0;
  player.onGround = true;
  holes = [];
  coins = [];
  obstacles = [];
  particles = [];
  zzz = [];
  nextSpawnZ = CONFIG.hole.safeZone;
  nextCoinZ = CONFIG.coin.safeZone;
  nextObsZ = CONFIG.obstacle.safeZone;
  input.left = false;
  input.right = false;

  gameOverEl.classList.add('hidden');
  clearEl.classList.add('hidden');
  newRecordEl.classList.add('hidden');
  clearUnlockEl.classList.add('hidden');
  memeCoverEl.classList.add('hidden');
  bestEl.textContent = `BEST ${bestMeters} m`;
  levelNameEl.textContent = `${level}. ${lv.name}`;
  progressFillEl.style.width = '0%';
  syncPauseBtn();
  syncCoinHud();
}

function startLevel(level) {
  level = Math.min(Math.max(level, 1), LEVELS.length);
  if (level > wallet.unlocked) return; // 잠긴 스테이지
  resetRun(level);
  state.phase = 'playing';
  homeEl.classList.add('hidden');
  hudEl.classList.remove('hidden');

  // 힌트 애니메이션 다시 재생
  hintEl.classList.remove('hidden');
  hintEl.style.animation = 'none';
  void hintEl.offsetWidth;
  hintEl.style.animation = '';
}

function showHome() {
  resetRun(state.selected);
  state.phase = 'home';
  homeEl.classList.remove('hidden');
  hudEl.classList.add('hidden');
  hintEl.classList.add('hidden');
  homeHelpEl.classList.add('hidden');
  refreshHome();
}

function selectLevel(level) {
  level = Math.min(Math.max(level, 1), LEVELS.length);
  if (level > wallet.unlocked) return;
  state.selected = level;
  buildLevelSelect();
}

function buildLevelSelect() {
  levelSelectEl.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const n = i + 1;
    const locked = n > wallet.unlocked;
    const card = document.createElement('div');
    card.className = 'level-card'
      + (locked ? ' locked' : '')
      + (state.selected === n && !locked ? ' selected' : '');
    card.innerHTML = `
      <div class="lv">${locked ? '🔒' : n}</div>
      <div class="nm">${lv.name}</div>
      <div class="goal">${lv.goal} m</div>
      ${wallet.cleared.includes(n) ? '<div class="cleared">🌙</div>' : ''}
    `;
    if (!locked) {
      card.addEventListener('click', () => selectLevel(n));
      card.addEventListener('dblclick', () => startLevel(n));
    }
    levelSelectEl.appendChild(card);
  });
}

function refreshHome() {
  homeBestEl.textContent = `${bestMeters} m`;
  homeCoinsEl.textContent = wallet.coins;

  const skin = skinByKey(wallet.equipped);
  homeSkinNameEl.textContent = skin.name;
  const g = homeSkinEl.getContext('2d');
  g.clearRect(0, 0, homeSkinEl.width, homeSkinEl.height);
  g.save();
  g.translate(homeSkinEl.width / 2, homeSkinEl.height - 22);
  g.scale(1.95, 1.95);
  drawRunnerFront(g, skin);
  g.restore();

  if (state.selected > wallet.unlocked) state.selected = wallet.unlocked;
  buildLevelSelect();
}

// ===== 사망 / 클리어 =====
function die(cause) {
  if (state.phase !== 'playing') return;
  state.phase = 'dying';
  state.deathBy = cause;
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
  memeCoverEl.classList.add('hidden');

  const lv = currentLevel();
  const meters = Math.floor(state.distance / CONFIG.score.unitsPerMeter);
  if (meters > bestMeters) saveBest(meters);

  // 보상 + 다음 스테이지 해금
  wallet.coins += lv.reward;
  if (!wallet.cleared.includes(state.level)) wallet.cleared.push(state.level);
  const unlockedNew = state.level === wallet.unlocked && wallet.unlocked < LEVELS.length;
  if (unlockedNew) wallet.unlocked = state.level + 1;
  saveWallet();
  syncCoinHud();

  clearLevelEl.textContent = `${state.level}. ${lv.name}`;
  clearScoreEl.textContent = `${meters} m 완주`;
  clearCoinsEl.textContent = `⭐ +${state.runCoins} · 클리어 보상 +${lv.reward}`;
  clearUnlockEl.classList.toggle('hidden', !unlockedNew);
  nextBtn.classList.toggle('hidden', state.level >= LEVELS.length);
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

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 500 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
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

  memeCoverEl.textContent = o.meme.text;
  memeCoverEl.classList.remove('hidden');
  memeCoverEl.style.animation = 'none';
  void memeCoverEl.offsetWidth;
  memeCoverEl.style.animation = '';

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
    if (spec.lethal) { die(spec.label); return; }
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
      syncCoinHud();
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

  if (state.clearT > 1.9) clearEl.classList.remove('hidden');
}

// ===== 업데이트 =====
function update(dt) {
  state.time += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);

  // 밈 말풍선이 화면을 가리는 시간
  if (state.coverT > 0) {
    state.coverT -= dt;
    if (state.coverT <= 0) memeCoverEl.classList.add('hidden');
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

    scoreEl.textContent = `${Math.floor(state.distance / CONFIG.score.unitsPerMeter)} m`;
    const p = Math.min(1, (state.distance + CONFIG.player.z) / state.goalZ) * 100;
    progressFillEl.style.width = `${p.toFixed(1)}%`;
  } else if (state.phase === 'dying') {
    player.vy += CONFIG.player.gravity * dt;
    player.height -= player.vy * dt;
    state.dyingRot += dt * 7; // 넘어지며 빙글 도는 연출
    if (player.height < -420) {
      state.phase = 'gameover';
      const lv = currentLevel();
      const meters = Math.floor(state.distance / CONFIG.score.unitsPerMeter);
      finalScoreEl.textContent = `${meters} m / ${lv.goal} m`;
      failReasonEl.textContent = state.deathBy === 'hole'
        ? '구멍에 빠져 잠이 확 깼어요'
        : `${state.deathBy}에게 붙잡혔어요`;
      runCoinsEl.textContent = `⭐ +${state.runCoins}`;
      if (meters > bestMeters) {
        saveBest(meters);
        newRecordEl.classList.remove('hidden');
      }
      saveWallet();
      memeCoverEl.classList.add('hidden');
      gameOverEl.classList.remove('hidden');
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
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const s of stars) {
    const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * s.twinkle + s.phase));
    ctx.fillStyle = `rgba(210, 225, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
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
  const glowR = Math.max(canvas.width, canvas.height) * 0.09;
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
function drawStarShape(g, cx, cy, R) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? R : R * 0.46;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}

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

  const z0 = state.goalZ - state.distance - B.len * 0.4;
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
  const cfg = {
    dad: { body: '#8FA0C8', head: PAL.skin, hair: '#3A3F63', H: 150 },
    jo:  { body: '#FFB5C0', head: PAL.skin, hair: '#4A3A55', H: 132 },
    kim: { body: '#8FD1BA', head: PAL.skin, hair: '#5A3E2B', H: 136 },
  }[o.type];
  const sway = o.type === 'kim' ? Math.sin(t * 6 + o.seed) * 0.12 : 0;

  g.save();
  g.rotate(sway);

  // 다리
  for (const s of [-1, 1]) { rr(g, s * 4 + (s > 0 ? 0 : -11), -34, 11, 34, 4); outlined(g, '#4A4E7A'); }
  // 몸통
  rr(g, -20, -cfg.H + 40, 40, cfg.H - 74, 12);
  outlined(g, cfg.body);

  if (o.type === 'dad') {
    // 팔짱
    rr(g, -22, -cfg.H + 62, 44, 12, 6); outlined(g, cfg.body);
  } else if (o.type === 'jo') {
    // 스마트폰 든 손
    rr(g, 16, -cfg.H + 52, 9, 26, 4); outlined(g, cfg.body);
    rr(g, 20, -cfg.H + 46, 13, 20, 3); outlined(g, '#2B2D5C');
    g.fillStyle = '#9FD8FF'; g.fillRect(22, -cfg.H + 49, 9, 14);
  } else {
    // 김XX: 양손 흔들기 (게임하자!)
    for (const s of [-1, 1]) {
      const a = Math.sin(t * 8 + o.seed + (s > 0 ? 0 : Math.PI)) * 0.5;
      g.save();
      g.translate(s * 20, -cfg.H + 54);
      g.rotate(s * (0.5 + a));
      rr(g, -5, -24, 10, 26, 5); outlined(g, cfg.body);
      g.restore();
    }
  }

  // 머리
  const hy = -cfg.H + 22;
  g.beginPath(); g.arc(0, hy, 20, 0, Math.PI * 2);
  outlined(g, cfg.head);
  g.beginPath(); g.arc(0, hy - 4, 20, Math.PI * 1.05, Math.PI * 1.95);
  g.strokeStyle = cfg.hair; g.lineWidth = 9; g.stroke();
  g.lineWidth = 2.2;

  if (o.type === 'dad') {
    // 안경
    for (const s of [-1, 1]) {
      g.beginPath(); g.arc(s * 8, hy + 2, 6, 0, Math.PI * 2);
      g.strokeStyle = PAL.navy; g.lineWidth = 2; g.stroke();
    }
    g.beginPath(); g.moveTo(-2, hy + 2); g.lineTo(2, hy + 2); g.stroke();
  } else if (o.type === 'kim') {
    // 헤드셋
    g.beginPath(); g.arc(0, hy - 2, 22, Math.PI * 1.1, Math.PI * 1.9);
    g.strokeStyle = PAL.navy; g.lineWidth = 4; g.stroke();
    for (const s of [-1, 1]) { rr(g, s * 22 - 5, hy - 6, 10, 14, 4); outlined(g, '#2B2D5C'); }
  } else {
    // 조XX: 졸린 눈웃음
    for (const s of [-1, 1]) {
      g.beginPath(); g.arc(s * 7, hy + 2, 4, Math.PI, 0);
      g.strokeStyle = PAL.navy; g.lineWidth = 2; g.stroke();
    }
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

// ===== 캐릭터 렌더러 (벡터) =====
// 좌표계: 발바닥 중앙 = (0,0), 위가 -y, 단위 = 월드 단위
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function outlined(g, fill) {
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = PAL.navy;
  g.stroke();
}

// 후드 장식 (뒷모습/앞모습 공용 — 머리 중심 hx,hy 반지름 hr)
function drawHoodFeatures(g, skin, hx, hy, hr, front, t) {
  const k = skin.key;
  const H = skin.hood, I = skin.inner, A = skin.accent;
  g.lineWidth = 2;

  if (k === 'base') {
    // 부스스 묶은 갈색 머리 (후드 내림)
    g.beginPath(); g.arc(hx, hy, hr, Math.PI, 0); g.closePath(); outlined(g, PAL.hair);
    g.beginPath(); g.arc(hx + hr * 0.15, hy - hr - 3, 5.5, 0, Math.PI * 2); outlined(g, PAL.hair); // 똥머리
    g.beginPath(); g.moveTo(hx - hr * 0.7, hy - hr * 0.55); g.quadraticCurveTo(hx - hr - 4, hy - hr * 0.9, hx - hr - 2, hy - hr * 0.2);
    g.strokeStyle = PAL.hair; g.lineWidth = 2.4; g.stroke(); // 잔머리
  } else if (k === 'bear') {
    for (const s of [-1, 1]) {
      g.beginPath(); g.arc(hx + s * hr * 0.68, hy - hr * 0.72, hr * 0.34, 0, Math.PI * 2); outlined(g, H);
      g.beginPath(); g.arc(hx + s * hr * 0.68, hy - hr * 0.72, hr * 0.17, 0, Math.PI * 2); g.fillStyle = I; g.fill();
    }
    if (front) { // 흰 주둥이 + 검은 코
      g.beginPath(); g.ellipse(hx, hy + hr * 0.42, hr * 0.34, hr * 0.26, 0, 0, Math.PI * 2); outlined(g, I);
      g.beginPath(); g.ellipse(hx, hy + hr * 0.32, 3, 2.2, 0, 0, Math.PI * 2); g.fillStyle = PAL.navy; g.fill();
    }
  } else if (k === 'rabbit') {
    for (const s of [-1, 1]) { // 달릴 때 뒤로 팔랑이는 긴 귀
      const sway = front ? 0 : Math.sin(t * 10 + s) * 0.12;
      g.save(); g.translate(hx + s * hr * 0.4, hy - hr * 0.8); g.rotate(s * 0.22 + sway);
      g.beginPath(); g.ellipse(0, -hr * 0.62, hr * 0.24, hr * 0.72, 0, 0, Math.PI * 2); outlined(g, H);
      g.beginPath(); g.ellipse(0, -hr * 0.62, hr * 0.11, hr * 0.5, 0, 0, Math.PI * 2); g.fillStyle = I; g.fill();
      g.restore();
    }
    if (front) { g.beginPath(); g.ellipse(hx, hy + hr * 0.34, 3, 2.4, 0, 0, Math.PI * 2); g.fillStyle = I; g.fill(); }
  } else if (k === 'cat') {
    for (const s of [-1, 1]) { // 세모 귀
      g.beginPath();
      g.moveTo(hx + s * hr * 0.32, hy - hr * 0.82);
      g.lineTo(hx + s * hr * 1.02, hy - hr * 1.28);
      g.lineTo(hx + s * hr * 0.95, hy - hr * 0.42);
      g.closePath(); outlined(g, H);
    }
    // 줄무늬
    g.strokeStyle = I; g.lineWidth = 2.6;
    for (const o of [-hr * 0.35, 0, hr * 0.35]) {
      g.beginPath(); g.moveTo(hx + o - 3, hy - hr * 0.75); g.lineTo(hx + o + 3, hy - hr * 0.4); g.stroke();
    }
  } else if (k === 'dog') {
    for (const s of [-1, 1]) { // 늘어진 갈색 귀
      g.beginPath(); g.ellipse(hx + s * hr * 0.88, hy - hr * 0.05, hr * 0.26, hr * 0.6, s * 0.25, 0, Math.PI * 2); outlined(g, I);
    }
    if (front) { // 혀 내민 입
      g.beginPath(); g.ellipse(hx, hy + hr * 0.5, 3.4, 4.4, 0, 0, Math.PI * 2); g.fillStyle = PAL.pink; g.fill();
    }
  } else if (k === 'chick') {
    // 병아리 볏 (깃털 3개)
    for (const o of [-0.28, 0, 0.28]) {
      g.beginPath(); g.ellipse(hx + o * hr, hy - hr * 0.95, 3.2, 7, o * 0.8, 0, Math.PI * 2); outlined(g, I);
    }
    if (front) { // 작은 주황 부리
      g.beginPath(); g.moveTo(hx - 4, hy + hr * 0.3); g.lineTo(hx + 4, hy + hr * 0.3); g.lineTo(hx, hy + hr * 0.48); g.closePath(); outlined(g, I);
    }
  } else if (k === 'pony') {
    for (const s of [-1, 1]) {
      g.beginPath(); g.ellipse(hx + s * hr * 0.6, hy - hr * 0.78, hr * 0.18, hr * 0.32, s * 0.3, 0, Math.PI * 2); outlined(g, H);
    }
    // 갈색 갈기 (정수리→뒤통수)
    g.beginPath(); g.ellipse(hx, hy - hr * 0.62, hr * 0.28, hr * 0.55, 0, 0, Math.PI * 2); outlined(g, A);
    if (front) { g.beginPath(); g.ellipse(hx, hy + hr * 0.42, hr * 0.32, hr * 0.24, 0, 0, Math.PI * 2); outlined(g, I); }
  } else if (k === 'penguin') {
    // 빨간 볏 포인트
    g.beginPath(); g.ellipse(hx, hy - hr * 0.95, 4.4, 6.2, 0, 0, Math.PI * 2); outlined(g, A);
    if (front) {
      g.beginPath(); g.ellipse(hx, hy + hr * 0.05, hr * 0.62, hr * 0.68, 0, 0, Math.PI * 2); g.fillStyle = I; g.fill(); // 흰 얼굴판
      g.beginPath(); g.moveTo(hx - 4.4, hy + hr * 0.3); g.lineTo(hx + 4.4, hy + hr * 0.3); g.lineTo(hx, hy + hr * 0.5); g.closePath(); outlined(g, '#FF9F45');
    } else {
      for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + s * hr * 0.72, hy + hr * 0.1, hr * 0.2, 0, Math.PI * 2); g.fillStyle = I; g.fill(); }
    }
  } else if (k === 'shark') {
    // 등지느러미
    g.beginPath();
    g.moveTo(hx - 2, hy - hr * 0.7);
    g.quadraticCurveTo(hx + 2, hy - hr * 1.6, hx + hr * 0.55, hy - hr * 1.28);
    g.quadraticCurveTo(hx + hr * 0.3, hy - hr * 0.85, hx + hr * 0.35, hy - hr * 0.55);
    g.closePath(); outlined(g, A);
    // 후드 가장자리 흰 이빨
    const teethY = front ? hy + hr * 0.55 : hy + hr * 0.62;
    g.beginPath();
    for (let i = -2; i <= 2; i++) {
      const tx = hx + i * hr * 0.3;
      g.moveTo(tx - hr * 0.14, teethY);
      g.lineTo(tx, teethY - hr * 0.2);
      g.lineTo(tx + hr * 0.14, teethY);
    }
    g.fillStyle = I; g.fill(); g.strokeStyle = PAL.navy; g.lineWidth = 1.4; g.stroke();
  } else if (k === 'walrus') {
    if (front) {
      g.beginPath(); g.ellipse(hx, hy + hr * 0.36, 4.4, 3.4, 0, 0, Math.PI * 2); outlined(g, A); // 빨간 코
    }
    for (const s of [-1, 1]) { // 상아 2개
      g.beginPath(); g.ellipse(hx + s * hr * 0.34, hy + hr * (front ? 0.78 : 0.7), 2.6, hr * 0.34, s * 0.12, 0, Math.PI * 2); outlined(g, I);
    }
  } else if (k === 'dino') {
    // 정수리 골판
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(hx + i * hr * 0.5 - hr * 0.2, hy - hr * 0.72);
      g.lineTo(hx + i * hr * 0.5, hy - hr * 1.22 + Math.abs(i) * 4);
      g.lineTo(hx + i * hr * 0.5 + hr * 0.2, hy - hr * 0.68);
      g.closePath(); outlined(g, I);
    }
    if (front) { // 후드 챙 흰 이빨
      g.beginPath();
      for (let i = -2; i <= 2; i++) {
        const tx = hx + i * hr * 0.3;
        g.moveTo(tx - hr * 0.13, hy - hr * 0.28);
        g.lineTo(tx, hy - hr * 0.06);
        g.lineTo(tx + hr * 0.13, hy - hr * 0.28);
      }
      g.fillStyle = '#FFF7EA'; g.fill(); g.strokeStyle = PAL.navy; g.lineWidth = 1.4; g.stroke();
    }
  } else if (k === 'giraffe') {
    for (const s of [-1, 1]) { // 뿔 2개 (오시콘)
      g.beginPath(); g.moveTo(hx + s * hr * 0.35, hy - hr * 0.8); g.lineTo(hx + s * hr * 0.42, hy - hr * 1.25);
      g.strokeStyle = PAL.navy; g.lineWidth = 2.6; g.stroke();
      g.beginPath(); g.arc(hx + s * hr * 0.43, hy - hr * 1.3, 3.4, 0, Math.PI * 2); outlined(g, A);
    }
    // 주황 얼룩
    g.fillStyle = I;
    g.beginPath(); g.ellipse(hx - hr * 0.45, hy - hr * 0.15, 4.5, 3.6, 0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(hx + hr * 0.5, hy - hr * 0.4, 3.8, 3, -0.3, 0, Math.PI * 2); g.fill();
  } else if (k === 'unicorn') {
    // 금색 뿔
    g.beginPath();
    g.moveTo(hx - 4, hy - hr * 0.78);
    g.lineTo(hx + 4, hy - hr * 0.78);
    g.lineTo(hx, hy - hr * 1.5);
    g.closePath(); outlined(g, I);
    // 무지개 갈기
    const RB = ['#FF9AA2', '#FFD782', '#9FE3B4', '#9ED8F0', '#C3AEF0'];
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(hx - hr * 0.15, hy - hr * 0.1, hr * (0.98 - i * 0.1), Math.PI * 0.62, Math.PI * 1.06);
      g.strokeStyle = RB[i]; g.lineWidth = 3; g.stroke();
    }
  }
}

// 뒷모습 러너 (게임 내) — g는 이미 발 중심으로 translate/rotate/scale 된 상태
function drawRunnerBack(g, skin, pose, phase, t) {
  const body = skin.key === 'dino' ? '#3A3F63' : skin.hood; // 공룡: 네이비 몸통
  g.lineWidth = 2.2;
  g.lineJoin = 'round';

  // 상하 반동 (한 걸음마다 1회) + 점프 시엔 반동 없음
  const bob = pose === 'run' ? Math.sin(phase * 2 - Math.PI / 2) * 1.6 : 0;

  // 꼬리 (뒷모습에서 보이는 스킨만)
  if (['cat', 'dino', 'pony', 'unicorn'].includes(skin.key)) {
    const sway = Math.sin(t * 6) * 4;
    g.beginPath();
    g.moveTo(6, -10 + bob);
    g.quadraticCurveTo(18 + sway, -6, 16 + sway, 6);
    g.strokeStyle = PAL.navy; g.lineWidth = 7.5; g.stroke();
    g.strokeStyle = skin.key === 'unicorn' ? '#C3AEF0' : skin.hood; g.lineWidth = 4.5; g.stroke();
    g.lineWidth = 2.2;
  }

  // 다리 (달릴 땐 좌우 교대로 매끄럽게 순환, 점프 땐 웅크림)
  for (const s of [-1, 1]) {
    const a = phase + (s > 0 ? 0 : Math.PI);
    let lift = 0, swing = 0;
    if (pose === 'run') {
      lift = (Math.sin(a) * 0.5 + 0.5) * 8;      // 0↔8 사이를 끊김 없이 오감
      swing = Math.cos(a) * 3.2;                  // 앞뒤로 뻗기
    } else if (pose === 'jumpRise' || pose === 'jumpPeak') {
      lift = 8; swing = s * 1.5;
    } else if (pose === 'jumpFall') {
      lift = 3; swing = -s * 1.5;
    }
    rr(g, s * 2 + (s > 0 ? 0 : -9) + swing, -13 - lift + bob, 9, 13, 4);
    outlined(g, body);
    if (lift > 3) { // 들린 발바닥 (핑크 발싸개)
      g.beginPath(); g.ellipse(s * 6.5 + swing, -1.5 - lift + bob + 12, 4, 2.4, 0, 0, Math.PI * 2);
      g.fillStyle = PAL.pink; g.fill();
    }
  }

  // 몸통 (키구루미)
  rr(g, -12, -33 + bob, 24, 23, 8);
  outlined(g, body);
  // 등 재봉선
  g.beginPath(); g.moveTo(0, -31 + bob); g.lineTo(0, -13 + bob);
  g.strokeStyle = 'rgba(43,45,92,0.25)'; g.lineWidth = 1.6; g.stroke();
  g.lineWidth = 2.2;

  // 팔 (어깨를 축으로 회전 — 다리와 반대 위상)
  for (const s of [-1, 1]) {
    const a = phase + (s > 0 ? Math.PI : 0);
    const rot = pose === 'run' ? Math.sin(a) * 0.55 : (pose.startsWith('jump') ? -0.9 * s : 0);
    g.save();
    g.translate(s * 12, -29 + bob);
    g.rotate(rot);
    rr(g, s > 0 ? 0 : -7, -1, 7, 14, 3.5);
    outlined(g, body);
    g.restore();
  }

  // 머리 (후드)
  const hy = -46 + bob;
  g.beginPath(); g.arc(0, hy, 14, 0, Math.PI * 2);
  outlined(g, skin.key === 'base' ? PAL.skin : skin.hood);

  drawHoodFeatures(g, skin, 0, hy, 14, false, t);
}

// 앞모습 (상점 썸네일) — 졸린 지영 얼굴 보임
function drawRunnerFront(g, skin) {
  const body = skin.key === 'dino' ? '#3A3F63' : skin.hood;
  g.lineWidth = 2.2;
  g.lineJoin = 'round';

  // 다리
  for (const s of [-1, 1]) {
    rr(g, s * 2 + (s > 0 ? 0 : -9), -13, 9, 13, 4);
    outlined(g, body);
  }
  // 몸통 + 지퍼
  rr(g, -12, -33, 24, 23, 8);
  outlined(g, body);
  g.beginPath(); g.moveTo(0, -31); g.lineTo(0, -13);
  g.strokeStyle = 'rgba(43,45,92,0.4)'; g.lineWidth = 1.8; g.stroke();
  g.lineWidth = 2.2;
  // 팔
  for (const s of [-1, 1]) {
    rr(g, s * 12 + (s > 0 ? 0 : -7), -30, 7, 14, 3.5);
    outlined(g, body);
  }

  // 머리: 후드 링 + 얼굴
  const hy = -46;
  g.beginPath(); g.arc(0, hy, 14, 0, Math.PI * 2);
  outlined(g, skin.key === 'base' ? PAL.hair : skin.hood);
  g.beginPath(); g.arc(0, hy + 1, 10.5, 0, Math.PI * 2);
  g.fillStyle = PAL.skin; g.fill();

  if (skin.key === 'base') {
    // 앞머리
    g.beginPath(); g.arc(0, hy - 2, 10.5, Math.PI * 1.05, Math.PI * 1.95); g.lineTo(0, hy - 6);
    g.fillStyle = PAL.hair; g.fill();
  }

  // 졸린 얼굴: 반쯤 감긴 눈 + 다크서클 + 볼터치 + 입
  g.strokeStyle = PAL.navy; g.lineWidth = 1.8; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(s * 6.4 - 2.4, hy + 1.5); g.quadraticCurveTo(s * 6.4, hy + 3.6, s * 6.4 + 2.4, hy + 1.5); g.stroke();
    g.beginPath(); g.moveTo(s * 6.4 - 1.8, hy + 5.2); g.quadraticCurveTo(s * 6.4, hy + 6.4, s * 6.4 + 1.8, hy + 5.2);
    g.strokeStyle = 'rgba(43,45,92,0.28)'; g.lineWidth = 1.3; g.stroke();
    g.strokeStyle = PAL.navy; g.lineWidth = 1.8;
    g.beginPath(); g.ellipse(s * 7.4, hy + 7.6, 2.6, 1.5, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,181,192,0.75)'; g.fill();
  }
  g.beginPath(); g.moveTo(-1.6, hy + 8.4); g.quadraticCurveTo(0, hy + 9.6, 1.6, hy + 8.4); g.stroke();

  drawHoodFeatures(g, skin, 0, hy, 14, true, 0);
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
  const J = MANIFEST.jiyoung;
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

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(12, 13, 32, 0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = PAL.cream;
  ctx.font = '42px Jua, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('잠깐 쉬는 중…', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '17px "Gowun Dodum", sans-serif';
  ctx.fillStyle = 'rgba(184, 169, 224, 0.9)';
  ctx.fillText('P 또는 ▶ 버튼으로 계속', canvas.width / 2, canvas.height / 2 + 28);
}

function render() {
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
  drawZzz();

  ctx.restore();

  if (state.paused && !shopOpen()) drawPauseOverlay();
}

// ===== 상점 =====
function lighten(hex, w) {
  const n = parseInt(hex.slice(1), 16);
  const m = (c) => Math.round(c + (255 - c) * w);
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}

let shopWasPaused = false;

function openShop() {
  shopWasPaused = state.paused;
  if (state.phase === 'playing') state.paused = true;
  syncPauseBtn();
  shopEl.classList.remove('hidden');
  buildShop();
}

function closeShop() {
  shopEl.classList.add('hidden');
  if (state.phase === 'playing' && !shopWasPaused) state.paused = false;
  if (state.phase === 'home') refreshHome(); // 장착 스킨 미리보기 갱신
  syncPauseBtn();
}

function buildShop() {
  shopGridEl.innerHTML = '';
  syncCoinHud();
  if (state.phase === 'home') refreshHome();
  MANIFEST.skins.forEach((skin, i) => {
    const item = document.createElement('div');
    item.className = 'shop-item' + (wallet.equipped === skin.key ? ' equipped' : '');

    const no = document.createElement('div');
    no.className = 'no';
    no.textContent = 'No.' + String(i + 1).padStart(2, '0');

    const thumb = document.createElement('canvas');
    thumb.width = 150; thumb.height = 150;
    const g = thumb.getContext('2d');
    g.fillStyle = lighten(skin.hood, 0.78);
    g.fillRect(0, 0, 150, 150);
    g.save();
    g.translate(75, 128);
    g.scale(1.55, 1.55);
    drawRunnerFront(g, skin);
    g.restore();

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = skin.name;

    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = skin.tag || '';

    const price = document.createElement('div');
    const owned = wallet.owned.includes(skin.key);
    if (wallet.equipped === skin.key) {
      price.className = 'price equipped-label';
      price.textContent = '장착중';
    } else if (owned) {
      price.className = 'price owned';
      price.textContent = '보유중 · 장착';
    } else {
      price.className = 'price' + (wallet.coins < skin.price ? ' locked' : '');
      price.innerHTML = `⭐ ${skin.price}`;
    }

    item.append(no, thumb, name, tag, price);
    item.addEventListener('click', () => {
      if (wallet.owned.includes(skin.key)) {
        wallet.equipped = skin.key;
        saveWallet();
        buildShop();
      } else if (wallet.coins >= skin.price) {
        wallet.coins -= skin.price;
        wallet.owned.push(skin.key);
        wallet.equipped = skin.key;
        saveWallet();
        syncCoinHud();
        buildShop();
      } else {
        item.classList.remove('denied');
        void item.offsetWidth; // 애니메이션 재시작 트릭
        item.classList.add('denied');
      }
    });
    shopGridEl.appendChild(item);
  });
}

// ===== 매니페스트 로드 → 초기화 =====
fetch('manifest.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((m) => {
    if (m && m.jiyoung && Array.isArray(m.skins)) MANIFEST = m;
  })
  .catch(() => {})
  .finally(() => {
    loadSpriteSheets();
    if (!MANIFEST.skins.some((s) => s.key === wallet.equipped)) wallet.equipped = 'base';
    if (state.phase === 'home') refreshHome();
  });

// ===== 메인 루프 (deltaTime 기반, 프레임 독립적) =====
let lastTime = performance.now();

function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!state.paused) update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

state.selected = wallet.unlocked;
showHome();
requestAnimationFrame(gameLoop);
