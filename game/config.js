// 꿀잠 러너 V2 — 데이터 전용 설정 (튜닝값·스테이지·장애물·아이템·스킨)
// 단위: 미터(m), 초(s). 게임 로직은 이 파일의 선언만 참조한다(데이터 주도).

export const TUNNEL = { width: 4.4, height: 3.6, segLen: 6, segCount: 16, laneX: [-1.35, 0, 1.35], clampX: 1.7 };

export const PLAYER = {
  lateralSpeed: 7.5, jumpVel: 7.4, gravity: 21, maxHp: 3,
  hitHalfW: 0.28, hitHeight: 0.95, hitHalfD: 0.28,
  invulnAfterHit: 1.2, invulnAfterRevive: 2.0, maxRevives: 2,
};

export const RUN = { accel: 0.14, bootsMul: 1.45, memeSlowMul: 0.8, pickupDist: 0.85, magnetDist: 6.5 };

// 5개 테마 스테이지 (시안: 맵 디자인)
export const STAGES = [
  { key: 'bedroom', name: '침실', desc: '처음 시작하는 아늑한 공간', goal: 400, base: 9.5, max: 14, holes: false, gravityMul: 1, reward: 30,
    obstacles: ['spike', 'fall', 'drink'],
    theme: { bg: 0x241a52, fogNear: 18, fogFar: 78, sky: 0xb9a4ff, ground: 0x2a2060,
      floorA: 0x3d63d8, floorB: 0x39b8cf, floorC: 0x6b4fd0, wall: 0x5a3aa6, wall2: 0x7a4cc0, ceil: 0x2c1e62, trim: 0xff8fd0, glow: 0xffc86a, deco: 'bedroom' } },
  { key: 'school', name: '학교', desc: '책상과 사물함이 있는 복도', goal: 550, base: 10.5, max: 15.5, holes: true, gravityMul: 1, reward: 50,
    obstacles: ['spike', 'rotate', 'fall', 'drink', 'meme'],
    theme: { bg: 0x2a3f7a, fogNear: 20, fogFar: 82, sky: 0xcfe4ff, ground: 0x6a4a2c,
      floorA: 0xc88c55, floorB: 0xb07443, floorC: 0x9fd45e, wall: 0x3b6ec6, wall2: 0xe9e4d6, ceil: 0xd8d4c8, trim: 0x86e0ff, glow: 0xfff1b8, deco: 'school' } },
  { key: 'subway', name: '지하철', desc: '지하철 객차를 달리는 터널', goal: 700, base: 11.5, max: 17, holes: true, gravityMul: 1, reward: 80,
    obstacles: ['spike', 'rotate', 'laser', 'fall', 'drink', 'ghost'],
    theme: { bg: 0x141a3a, fogNear: 18, fogFar: 80, sky: 0xaec2ff, ground: 0x2a2f48,
      floorA: 0x5d6380, floorB: 0x4c5270, floorC: 0xffd23a, wall: 0x2d3a6a, wall2: 0xdfe6f2, ceil: 0x1d2446, trim: 0xffb13a, glow: 0xfff0c8, deco: 'subway' } },
  { key: 'space', name: '우주', desc: '중력 반전이 있는 우주 터널', goal: 850, base: 12.5, max: 18.5, holes: true, gravityMul: 0.62, reward: 120,
    obstacles: ['spike', 'rotate', 'laser', 'fall', 'ghost', 'meme', 'drink'],
    theme: { bg: 0x0a0826, fogNear: 22, fogFar: 90, sky: 0x8a7cff, ground: 0x120c38,
      floorA: 0x1c1558, floorB: 0x281c78, floorC: 0x4de2ff, wall: 0x1a1250, wall2: 0x2d1f80, ceil: 0x0e0a30, trim: 0xff5fd8, glow: 0xffe16a, deco: 'space' } },
  { key: 'dream', name: '꿈나라', desc: '구름과 별이 가득한 환상적인 공간', goal: 1000, base: 13, max: 19.5, holes: true, gravityMul: 0.85, reward: 200,
    obstacles: ['spike', 'rotate', 'laser', 'fall', 'ghost', 'meme', 'drink'],
    theme: { bg: 0xc98ae8, fogNear: 16, fogFar: 70, sky: 0xfff0ff, ground: 0xd9a0f0,
      floorA: 0xf7c4ee, floorB: 0xe8a8f0, floorC: 0xffffff, wall: 0xd38ff0, wall2: 0xf6c8ff, ceil: 0xb87ae0, trim: 0xffffff, glow: 0xfff6a8, deco: 'dream' } },
];

// 장애물 (시안: 장애물 디자인). effect: damage=체력 -1, kill=즉시 게임오버, cover=화면 가림
// hit: 충돌 박스 반폭/높이/반깊이 — 실루엣보다 작게 잡아 아슬아슬한 스침을 허용
export const OBSTACLES = {
  spike:  { name: '가시 블록', desc: '접촉 시 데미지', effect: 'damage', hit: [0.36, 0.72, 0.34], avoid: '좌우·점프' },
  rotate: { name: '회전 블록', desc: '회전하며 이동', effect: 'damage', hit: [0.4, 0.8, 0.38], avoid: '좌우·점프', sway: 1.35, swaySpeed: 1.6 },
  platform:{ name: '이동 플랫폼', desc: '타이밍 맞춰 점프', effect: 'hole', holeLen: 5.2, platHalfW: 0.85, sway: 1.3, swaySpeed: 1.4 },
  laser:  { name: '레이저 벽', desc: '지속적인 데미지', effect: 'damage', hit: [9, 0.8, 0.12], avoid: '점프·꺼질 때 통과', onTime: 1.3, offTime: 0.8 },
  fall:   { name: '낙하 블록', desc: '일정 시간 후 떨어짐', effect: 'damage', hit: [0.44, 0.9, 0.42], avoid: '좌우', triggerDist: 15, startY: 3.0 },
  ghost:  { name: '유령', desc: '접촉 시 게임 오버', effect: 'kill', hit: [0.38, 1.5, 0.3], avoid: '좌우', sway: 1.0, swaySpeed: 1.1 },
  meme:   { name: '밈', desc: '접촉 시 화면 가림', effect: 'cover', hit: [0.4, 1.3, 0.3], avoid: '좌우', coverTime: 2.2 },
  drink:  { name: '함정 음료', desc: '체력 감소', effect: 'damage', hit: [0.3, 0.7, 0.3], avoid: '줍지 않기', pickup: true },
};

// 아이템 (시안: 아이템 디자인). source: run=인게임 픽업, shop=상점 구매
export const ITEMS = {
  coin:      { name: '별사탕 (코인)', desc: '점수 획득', source: 'run', value: 1 },
  hammer:    { name: '뽕망치', desc: '장애물 파괴 (일정 시간)', source: 'shop', price: 80, max: 3, range: 28 },
  melatonin: { name: '멜라토닌', desc: '부활 아이템', source: 'shop', price: 100, max: 5 },
  boots:     { name: '스피드 부츠', desc: '일시적 속도 증가', source: 'run', duration: 5 },
  shield:    { name: '보호막', desc: '일정 시간 무적', source: 'run', duration: 6 },
  magnet:    { name: '자석', desc: '코인 자동 수집', source: 'run', duration: 8 },
  heart:     { name: '체력 회복', desc: '체력 회복', source: 'run', heal: 1 },
  key:       { name: '열쇠', desc: '특별 보상 해금', source: 'run', bonus: 50 },
};
export const RUN_ITEM_POOL = ['boots', 'shield', 'magnet', 'heart', 'key', 'hammer'];

// 스킨 12종 (시안: 스킨 디자인). body=옷, inner=배/귀 안감, accent=포인트
export const SKINS = [
  { key: 'rabbit',    name: '토끼 키구루미', short: '기본 (지영)', price: 0,   body: 0xf8c8d8, inner: 0xff9ec0, accent: 0xffffff, ears: 'rabbit', tail: 'puff' },
  { key: 'bear',      name: '곰돌이',  short: '곰돌이', price: 100, body: 0x2c2834, inner: 0x4c4656, accent: 0xf2efe8, ears: 'round', tail: 'puff', sleepy: true },
  { key: 'cat',       name: '고양이',  short: '고양이', price: 150, body: 0x6f7080, inner: 0xf4bccb, accent: 0xffffff, ears: 'cat', tail: 'long' },
  { key: 'dino',      name: '공룡',    short: '공룡',   price: 200, body: 0x49b04c, inner: 0xf3e07a, accent: 0xf6a53a, ears: 'none', tail: 'dino', spikes: true },
  { key: 'astronaut', name: '우주복',  short: '우주복', price: 250, body: 0xf1f3fa, inner: 0x4a7cf0, accent: 0xd8404a, ears: 'none', tail: 'none', helmet: true },
  { key: 'devil',     name: '악마',    short: '악마',   price: 250, body: 0xc62f3c, inner: 0x3a1c26, accent: 0x2a1820, ears: 'horns', tail: 'devil' },
  { key: 'angel',     name: '천사',    short: '천사',   price: 300, body: 0xfbf0e2, inner: 0xffe6a8, accent: 0xffd34d, ears: 'none', tail: 'none', halo: true, wings: true, hair: 0xe6c27c },
  { key: 'cherry',    name: '체리',    short: '체리',   price: 200, body: 0xe23a4a, inner: 0xff8a96, accent: 0x3fae4b, ears: 'stem', tail: 'none' },
  { key: 'penguin',   name: '펭귄',    short: '펭귄',   price: 200, body: 0x2b303e, inner: 0xffffff, accent: 0xf59a2a, ears: 'none', tail: 'none', beak: true },
  { key: 'shark',     name: '상어',    short: '상어',   price: 250, body: 0x5a9fe0, inner: 0xf4f7ff, accent: 0xffffff, ears: 'fin', tail: 'shark', teeth: true, sleepy: true },
  { key: 'tiger',     name: '호랑이',  short: '호랑이', price: 250, body: 0xf29a3a, inner: 0xfff3df, accent: 0x2a1c14, ears: 'round', tail: 'tiger', stripes: true },
  { key: 'panda',     name: '판다',    short: '판다',   price: 300, body: 0xf6f6f4, inner: 0x24232a, accent: 0x24232a, ears: 'round', tail: 'puff', panda: true },
];

export const SAVE_KEY = 'kkuljam.v2.save';
export const DEFAULT_SAVE = { coins: 300, owned: ['rabbit'], equipped: 'rabbit', unlocked: 1, cleared: [], best: 0, hammers: 1, melatonin: 1, nick: '', gender: 'female' };
