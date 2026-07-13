// 꿀잠 러너 — 팔레트 / 튜닝값 / 레벨 / 방해요인 스펙 (데이터 전용)

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

export { PAL, CONFIG, LEVELS, OBSTACLES, MEMES };
