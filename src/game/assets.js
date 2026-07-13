// 에셋 매니페스트(데이터 주도) — manifest.json이 있으면 덮어씀

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

// manifest.json을 불러와 기본값을 덮어쓴 뒤 스프라이트 시트를 로드한다
async function loadAssets() {
  try {
    const res = await fetch('manifest.json');
    if (res.ok) {
      const m = await res.json();
      if (m && m.jiyoung && Array.isArray(m.skins)) MANIFEST = m;
    }
  } catch (e) { /* 파일이 없으면 내장 기본값 사용 */ }
  loadSpriteSheets();
  return MANIFEST;
}

function getManifest() { return MANIFEST; }

export { getManifest, loadAssets, skinByKey, sprites };
