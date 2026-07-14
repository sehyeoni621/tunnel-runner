// 저장 데이터 (localStorage) — 최고 기록 · 지갑 · 스킨 · 레벨 해금

const BEST_KEY = 'tunnelRunner.best';
const SAVE_KEY = 'kkuljam.save';

function loadBest() {
  try {
    return parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
  } catch (e) {
    return 0;
  }
}

function saveBest(meters) {
  try {
    localStorage.setItem(BEST_KEY, String(meters));
  } catch (e) { /* 사파리 프라이빗 모드 등 */ }
}

// unlocked = 해금된 최고 레벨, cleared = 클리어한 레벨 번호 목록
function loadWallet(levelCount) {
  const fallback = { coins: 0, owned: ['base'], equipped: 'base', unlocked: 1, cleared: [], hammers: 0, melatonin: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw || !Array.isArray(raw.owned)) return fallback;
    return {
      coins: raw.coins | 0,
      owned: raw.owned,
      equipped: raw.equipped || 'base',
      unlocked: Math.min(Math.max(raw.unlocked | 0, 1), levelCount),
      cleared: Array.isArray(raw.cleared) ? raw.cleared : [],
      hammers: Math.max(0, raw.hammers | 0),
      melatonin: Math.max(0, raw.melatonin | 0),
    };
  } catch (e) {
    return fallback;
  }
}

function saveWallet(wallet) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(wallet));
  } catch (e) { /* 무시 */ }
}

export { loadBest, saveBest, loadWallet, saveWallet };
