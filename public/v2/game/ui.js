// 꿀잠 러너 V2 — UI 레이어 (DOM). 엔진 스냅샷을 받아 화면을 그린다.
// React 이식 시: mountX() 하나가 컴포넌트 하나 (HomeScreen, Hud, Shop, ClearPanel, GameOverPanel, MemeCover, TouchControls, Settings, ProfileSetup)
import { Engine, createThumbnailer } from './engine.js';
import { STAGES, SKINS, ITEMS, OBSTACLES } from './config.js';
import { buildCharacter, poseCharacter, buildItem, buildObstacle, buildBed } from './models.js';

const $ = (s) => document.querySelector(s);
const layer = $('#layer'), hud = $('#hud'), memeEl = $('#meme'), toastEl = $('#toast');
const isTouch = matchMedia('(pointer: coarse)').matches;

/* ── 썸네일 (3D 모델 → 이미지) ── */
const th = createThumbnailer();
const T = {
  item: (k) => th.object('item_' + k, buildItem(k), { dir: [0.35, 0.2, 1] }),
  obs: (k) => th.object('obs_' + k, buildObstacle(k, { width: 2.2 }), { dir: [0.5, 0.35, 1] }),
  bed: () => th.object('bed', buildBed(), { dir: [1.2, 1.1, 1] }),
  stage: (i) => th.corridor('stage_' + i, STAGES[i]),
  skin: (k, g) => { const c = buildCharacter(SKINS.find(s => s.key === k), { gender: g }); poseCharacter(c, 0, 'idle'); return th.object(`skin_${k}_${g}`, c, { w: 256, h: 320, dir: [0.3, 0.1, 1], pad: 1.0 }); },
  head: (k, g) => { const c = buildCharacter(SKINS.find(s => s.key === k), { gender: g }); poseCharacter(c, 0, 'idle'); return th.object(`head_${k}_${g}`, c, { w: 128, h: 128, dir: [0.2, 0.05, 1], pad: 0.95, frame: c.rig.head }); },
};

const I = {
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M2 3h3l2.4 11.2A2 2 0 0 0 9.4 16h8.2a2 2 0 0 0 1.9-1.5L21.5 7H6.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="20" r="1.8"/><circle cx="17" cy="20" r="1.8"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.3 4.9-1.9.4a6.6 6.6 0 0 1-.7 1.7l1.1 1.6-1.9 1.9-1.6-1.1c-.5.3-1.1.6-1.7.7l-.4 1.9h-2.7l-.4-1.9a6.6 6.6 0 0 1-1.7-.7l-1.6 1.1-1.9-1.9 1.1-1.6a6.6 6.6 0 0 1-.7-1.7l-1.9-.4v-2.7l1.9-.4c.1-.6.4-1.2.7-1.7L4.8 6.1l1.9-1.9 1.6 1.1c.5-.3 1.1-.6 1.7-.7l.4-1.9h2.7l.4 1.9c.6.1 1.2.4 1.7.7l1.6-1.1 1.9 1.9-1.1 1.6c.3.5.6 1.1.7 1.7l1.9.4v2.7Z"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M12 3 2.5 11h2.8v9h5v-6h3.4v6h5v-9h2.8L12 3Z"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15.5 4 7.5 12l8 8" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="m8.5 4 8 8-8 8" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>',
};
const MEME_LINES = ['냐냐냥~', '좋다~ 좋아~', '파라파라!', '영혼 없는 춤', '옆자리 고르기'];

/* ── 상태 ── */
const ui = { modal: null, tab: 'skin', skinIdx: null, nick: '', gender: 'female', memeLine: '' };
let S = null, sigCur = '', hudBuilt = false, hintT = 0;
const engine = new Engine($('#game'), (s) => { S = s; render(); });
$('#boot').classList.add('gone');
window.kkuljam = engine; // 디버그용 (콘솔에서 kkuljam.start(2) 등)

function sig(s) {
  const m = ui.modal ? `${ui.modal}|${ui.tab}|${ui.skinIdx}|${s.wallet}|${s.owned.length}|${s.equipped}|${s.hammers}|${s.melatonin}|${ui.gender}` : '';
  if (!s.nick) return 'setup|' + ui.gender;
  switch (s.screen) {
    case 'home': return `home|${s.stageIdx}|${s.wallet}|${s.unlocked}|${s.equipped}|${s.best}|${s.nick}|${m}`;
    case 'playing': return 'playing';
    case 'paused': return 'paused|' + m;
    case 'dying': return 'dying';
    case 'gameover': return `go|${s.canRevive}|${s.melatonin}|${s.reason}`;
    case 'clear': return `clear|${s.clearDone}|${m}`;
  }
}
function render() {
  const s = S, g = sig(s);
  if (g !== sigCur) { sigCur = g; layer.innerHTML = !s.nick ? viewSetup() : view(s); }
  patchHud(s); patchMeme(s); patchToast(s);
}
function view(s) {
  let base = '';
  if (s.screen === 'home') base = viewHome(s);
  if (s.screen === 'paused' && !ui.modal) base = viewPause();
  if (s.screen === 'gameover') base = viewGameOver(s);
  if (s.screen === 'clear' && s.clearDone) base = viewClear(s);
  if (ui.modal === 'shop') base += viewShop(s);
  if (ui.modal === 'settings') base += viewSettings(s);
  return base;
}

/* ── 화면: 프로필 설정 (최초 1회) ── */
function viewSetup() {
  return `<div class="modal-bg"><div class="modal panel" style="width:min(460px,100%)">
    ${logo()}
    <div class="field"><label for="nick">닉네임</label><input id="nick" maxlength="12" placeholder="최대 12자" value="${esc(ui.nick)}"></div>
    <div class="field"><label>캐릭터</label><div class="seg">
      <button data-act="gender" data-v="female" class="${ui.gender === 'female' ? 'on' : ''}">여자</button>
      <button data-act="gender" data-v="male" class="${ui.gender === 'male' ? 'on' : ''}">남자</button></div></div>
    <button class="cta" data-act="setup">시작하기</button>
  </div></div>`;
}
function logo() {
  return `<div class="logo"><div class="logo-row"><span class="moon"></span><h1>꿀잠 <b>러너</b></h1><span class="star">★</span></div><div class="sub">달려라, 더 좋은 꿈을 위해!</div></div>`;
}

/* ── 화면: 홈 ── */
function viewHome(s) {
  const cards = STAGES.map((st, i) => {
    const locked = i + 1 > s.unlocked, done = s.cleared.includes(st.key);
    return `<button class="stage ${i === s.stageIdx ? 'on' : ''} ${locked ? 'locked' : ''}" data-act="stage" data-i="${i}">
      <img src="${T.stage(i)}" alt="">${locked ? `<span class="lock">${I.lock}</span>` : ''}${done ? '<span class="done">클리어</span>' : ''}
      <div class="meta"><div class="name">${i + 1}. ${st.name}${i === 0 ? ' (기본)' : ''}</div><div class="desc">${st.desc}</div></div></button>`;
  }).join('');
  return `<div class="home">
    <div class="home-left">${logo()}<div class="tagline">방해꾼을 피해 침대까지 달려가<br>꿀잠을 자는 실내 → 꿈나라 원근 터널 러너!</div></div>
    <div class="home-right">
      <div class="topbar"><div class="coin-pill"><img src="${T.item('coin')}" alt="">${s.wallet.toLocaleString()}</div>
        <button class="icon-btn" data-act="settings" aria-label="설정">${I.gear}</button></div>
      <div class="stage-panel panel"><div class="pill-title">스테이지 선택</div>
        <div class="stages">${cards}</div>
        <div class="stats"><span>${esc(s.nick)}</span><span>최고 기록 <b>${s.best}m</b></span><span>뽕망치 <b>${s.hammers}</b></span><span>멜라토닌 <b>${s.melatonin}</b></span></div>
        <div class="home-actions"><button class="icon-btn" data-act="shop" aria-label="상점">${I.cart}</button><button class="cta" data-act="start">달리기 시작</button></div>
      </div>
    </div></div>`;
}

/* ── 모달: 일시정지 / 게임오버 / 클리어 ── */
function viewPause() {
  return `<div class="modal-bg"><div class="modal panel" style="width:min(400px,100%)"><div class="pill-title">일시정지</div>
    <h2>잠깐 쉬는 중</h2>
    <button class="cta" data-act="resume">계속하기</button>
    <div class="row"><button class="btn2" data-act="shop">상점</button><button class="btn2" data-act="settings">설정</button><button class="btn2" data-act="home">홈으로</button></div>
  </div></div>`;
}
function viewGameOver(s) {
  return `<div class="modal-bg"><div class="modal panel" style="width:min(440px,100%)"><div class="pill-title">게임 오버</div>
    <h2>앗, 잠이 깼어요!</h2><div class="reason">${esc(s.reason)}</div>
    <div class="result"><span>달린 거리</span><b>${s.dist}m / ${s.goal}m</b><span>점수</span><b>${s.score.toLocaleString()}</b><span>최고 기록</span><b>${s.best}m</b></div>
    <div class="revive"><img src="${T.item('melatonin')}" alt=""><button class="btn2" data-act="revive" ${s.canRevive ? '' : 'disabled'}>멜라토닌 ${s.reviveCost}개로 부활</button><span class="muted">보유 ${s.melatonin}</span></div>
    <div class="row"><button class="cta" data-act="retry">다시 달리기</button><button class="btn2" data-act="home">홈으로</button></div>
  </div></div>`;
}
function viewClear(s) {
  const r = s.reward || { coins: 0, bonus: 0, keys: 0, stars: 0, total: 0 };
  const next = s.stageIdx + 1 < STAGES.length;
  return `<div class="modal-bg" style="place-items:center end;background:linear-gradient(90deg,transparent 30%,rgba(5,8,30,.55))"><div class="modal panel" style="width:min(420px,100%)"><div class="pill-title">스테이지 클리어</div><div class="zzz">Z z z</div>
    <h2>꿀잠 성공!</h2>
    <div class="clear-stars">${[0, 1, 2].map(i => `<span class="${i < r.stars ? '' : 'off'}">★</span>`).join('')}</div>
    <div class="result"><span>별사탕</span><b>+${r.coins}</b><span>스테이지 보상</span><b>+${r.bonus - r.keys * ITEMS.key.bonus}</b>${r.keys ? `<span>열쇠 보너스 ×${r.keys}</span><b>+${r.keys * ITEMS.key.bonus}</b>` : ''}<span>합계</span><b style="color:var(--gold)">+${r.total}</b></div>
    <div class="row">${next ? '<button class="cta" data-act="next">다음 스테이지</button>' : ''}<button class="btn2" data-act="home">홈으로</button></div>
  </div></div>`;
}

/* ── 모달: 상점 (스킨 미리보기 + 아이템) ── */
function viewShop(s) {
  if (ui.skinIdx === null) ui.skinIdx = Math.max(0, SKINS.findIndex(k => k.key === s.equipped));
  const sk = SKINS[ui.skinIdx], owned = s.owned.includes(sk.key), eq = s.equipped === sk.key;
  const skinTab = `
    <div class="preview"><button class="arrow l" data-act="skinPrev" aria-label="이전">${I.left}</button><button class="arrow r" data-act="skinNext" aria-label="다음">${I.right}</button>
      <div class="figure"><span class="pedestal"></span><img src="${T.skin(sk.key, s.gender)}" alt=""></div>
      <div class="nm">${sk.name}</div></div>
    <div class="row">${eq ? '<button class="btn2" disabled>착용중</button>' : owned ? '<button class="cta" data-act="equip">착용하기</button>' : `<button class="cta" data-act="buySkin" ${s.wallet < sk.price ? 'disabled' : ''}>★ ${sk.price} 구매</button>`}</div>
    <div class="carousel">${SKINS.map((k, i) => `<button class="${i === ui.skinIdx ? 'on' : ''} ${s.owned.includes(k.key) ? '' : 'lockd'}" data-act="skin" data-i="${i}" title="${k.short}"><img src="${T.head(k.key, s.gender)}" alt="${k.short}"></button>`).join('')}</div>`;
  const itemCard = (k, have) => { const it = ITEMS[k]; return `<div class="item-card"><img src="${T.item(k)}" alt=""><div class="t">${it.name}</div><div class="d">${it.desc} · 보유 ${have}/${it.max}</div>
    <button class="cta" style="font-size:18px;padding:10px 22px" data-act="buyItem" data-k="${k}" ${s.wallet < it.price || have >= it.max ? 'disabled' : ''}>★ ${it.price}</button></div>`; };
  const itemTab = `<div class="items">${itemCard('hammer', s.hammers)}${itemCard('melatonin', s.melatonin)}</div>`;
  return `<div class="modal-bg"><div class="modal panel shop"><div class="pill-title">상점</div>
    <button class="icon-btn close" data-act="closeModal" aria-label="닫기">${I.close}</button>
    <div class="modal-body"><div class="tabs"><button class="${ui.tab === 'skin' ? 'on' : ''}" data-act="tab" data-v="skin">스킨</button><button class="${ui.tab === 'item' ? 'on' : ''}" data-act="tab" data-v="item">아이템</button>
      <div class="coin-pill" style="margin-left:auto"><img src="${T.item('coin')}" alt="">${s.wallet.toLocaleString()}</div></div>
    ${ui.tab === 'skin' ? skinTab : itemTab}
  </div></div></div>`;
}

/* ── 모달: 설정 + 도감 ── */
function viewSettings(s) {
  const obs = Object.entries(OBSTACLES).map(([k, o]) => `<div><img src="${T.obs(k)}" alt=""><b>${o.name}</b>${o.desc}</div>`).join('');
  const its = Object.entries(ITEMS).map(([k, o]) => `<div><img src="${T.item(k)}" alt=""><b>${o.name}</b>${o.desc}</div>`).join('');
  return `<div class="modal-bg"><div class="modal panel shop"><div class="pill-title">설정</div>
    <button class="icon-btn close" data-act="closeModal" aria-label="닫기">${I.close}</button>
    <div class="modal-body"><div class="field" style="margin-top:8px"><label for="nick">닉네임</label><input id="nick" maxlength="12" value="${esc(ui.nick || s.nick)}"></div>
    <div class="field"><label>캐릭터</label><div class="seg"><button data-act="gender" data-v="female" class="${ui.gender === 'female' ? 'on' : ''}">여자</button><button data-act="gender" data-v="male" class="${ui.gender === 'male' ? 'on' : ''}">남자</button></div></div>
    <button class="btn2" data-act="saveSettings">저장</button>
    <div class="field"><label>조작법</label><div class="muted" style="font-size:14px;line-height:1.6">PC: ← → 이동 · Space 점프 · H 뽕망치 · P 일시정지<br>모바일: 좌우로 드래그 이동 · 탭/위로 스와이프 점프</div></div>
    <div class="field"><label>장애물</label><div class="guide">${obs}</div></div>
    <div class="field"><label>아이템</label><div class="guide">${its}</div></div>
    <button class="danger" data-act="reset">저장 데이터 초기화</button>
  </div></div></div>`;
}

/* ── HUD (게임 중 상시) ── */
function buildHud() {
  hud.innerHTML = `
    <div class="tl"><div class="coin-pill"><img src="${T.item('coin')}" alt=""><span id="h-coins">0</span></div><div class="hearts" id="h-hearts"></div><div class="effects" id="h-eff"></div></div>
    <div class="tc"><div class="stage-name" id="h-stage"></div><div class="progress"><div class="fill" id="h-fill"></div><div class="star" id="h-star">★</div><img class="bed" src="${T.bed()}" alt=""></div><div class="dist" id="h-dist"></div></div>
    <div class="tr"><button class="icon-btn" data-act="pause" aria-label="일시정지">${I.pause}</button><button class="icon-btn" data-act="shop" aria-label="상점">${I.cart}</button></div>
    <div class="br"><button class="hammer-btn" data-act="hammer" aria-label="뽕망치"><img src="${T.item('hammer')}" alt=""><span id="h-ham">0</span></button>${isTouch ? '<button class="jump-btn" data-press="jump">점프</button>' : ''}</div>
    ${isTouch ? `<div class="touch-pad"><button data-hold="-1" aria-label="왼쪽">${I.left}</button><button data-hold="1" aria-label="오른쪽">${I.right}</button></div>` : '<div class="keyhint" id="h-hint">← → 이동 · Space 점프 · H 뽕망치 · P 일시정지</div>'}`;
  hudBuilt = true;
}
let hudCache = {};
function patchHud(s) {
  const show = ['playing', 'paused', 'dying', 'gameover'].includes(s.screen);
  hud.hidden = !show; if (!show) { hintT = 0; return; }
  if (!hudBuilt) buildHud();
  const set = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } };
  set('#h-coins', s.runCoins); set('#h-stage', `${s.stageIdx + 1}. ${s.stageName}`); set('#h-dist', `${s.dist}m / ${s.goal}m`); set('#h-ham', s.hammers);
  $('#h-fill').style.width = s.progress * 100 + '%'; $('#h-star').style.left = `calc(${3 + s.progress * 94}% )`;
  const hk = s.hp + '/' + s.maxHp;
  if (hudCache.hp !== hk) { hudCache.hp = hk; $('#h-hearts').innerHTML = Array.from({ length: s.maxHp }, (_, i) => `<img src="${T.item('heart')}" class="${i < s.hp ? '' : 'off'}" alt="">`).join(''); }
  const ek = JSON.stringify(s.eff);
  if (hudCache.eff !== ek) { hudCache.eff = ek; $('#h-eff').innerHTML = Object.entries(s.eff).filter(([, v]) => v > 0).map(([k, v]) => `<div class="eff" title="${ITEMS[k].name}"><img src="${T.item(k)}" alt=""><span>${v}</span></div>`).join(''); }
  const hb = $('.hammer-btn'); hb.disabled = s.hammers <= 0;
  const hint = $('#h-hint'); if (hint && s.screen === 'playing') { hintT++; hint.style.opacity = hintT > 400 ? 0 : 1; }
}
function patchMeme(s) {
  if (s.meme && memeEl.hidden) { ui.memeLine = MEME_LINES[Math.floor(Math.random() * MEME_LINES.length)]; memeEl.innerHTML = `<div class="wrap"><img src="${T.obs('meme')}" alt=""><div class="bubble">${ui.memeLine}</div></div>`; }
  memeEl.hidden = !s.meme;
}
let lastToast = null;
function patchToast(s) {
  if (s.toast !== lastToast) { lastToast = s.toast; toastEl.hidden = !s.toast; if (s.toast) { toastEl.textContent = s.toast; toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = ''; } }
}
function esc(t) { return String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function rerender() { sigCur = ''; render(); }

/* ── 이벤트 ── */
function act(a, el) {
  const s = S;
  switch (a) {
    case 'gender': ui.gender = el.dataset.v; break;
    case 'setup': { const n = ($('#nick')?.value || '').trim(); if (!n) { $('#nick').focus(); return; } engine.setProfile(n, ui.gender); break; }
    case 'stage': engine.selectStage(+el.dataset.i); break;
    case 'start': engine.start(); break;
    case 'shop': if (s.screen === 'playing') engine.pause(); ui.modal = 'shop'; ui.skinIdx = null; break;
    case 'settings': ui.modal = 'settings'; ui.nick = s.nick; ui.gender = s.gender; break;
    case 'closeModal': ui.modal = null; break;
    case 'tab': ui.tab = el.dataset.v; break;
    case 'skin': ui.skinIdx = +el.dataset.i; break;
    case 'skinPrev': ui.skinIdx = (ui.skinIdx + SKINS.length - 1) % SKINS.length; break;
    case 'skinNext': ui.skinIdx = (ui.skinIdx + 1) % SKINS.length; break;
    case 'equip': case 'buySkin': engine.buySkin(SKINS[ui.skinIdx].key); break;
    case 'buyItem': engine.buyItem(el.dataset.k); break;
    case 'saveSettings': { const n = ($('#nick')?.value || '').trim() || s.nick; engine.setProfile(n, ui.gender); ui.modal = null; break; }
    case 'reset': if (confirm('저장 데이터를 모두 지울까요?')) { engine.resetSave(); ui.modal = null; } break;
    case 'pause': engine.pause(); break;
    case 'resume': engine.resume(); break;
    case 'home': ui.modal = null; engine.goHome(); break;
    case 'retry': engine.start(s.stageIdx); break;
    case 'next': engine.start(s.stageIdx + 1); break;
    case 'revive': engine.revive(); break;
    case 'hammer': engine.useHammer(); break;
  }
  rerender();
}
for (const root of [layer, hud]) root.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (el && !el.disabled) act(el.dataset.act, el); });
layer.addEventListener('input', (e) => { if (e.target.id === 'nick') ui.nick = e.target.value; });
layer.addEventListener('keydown', (e) => { if (e.target.id === 'nick' && e.key === 'Enter') act(S.nick ? 'saveSettings' : 'setup'); });
hud.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('[data-hold]'); if (h) { e.preventDefault(); engine.setAxis(+h.dataset.hold); h.setPointerCapture(e.pointerId); }
  if (e.target.closest('[data-press="jump"]')) { e.preventDefault(); engine.jump(); }
});
hud.addEventListener('pointerup', (e) => { if (e.target.closest('[data-hold]')) engine.setAxis(0); });
hud.addEventListener('pointercancel', () => engine.setAxis(0));

// 캔버스 제스처: 좌우 드래그 = 이동, 탭/위 스와이프 = 점프
const canvas = $('#game'); let g0 = null;
canvas.addEventListener('pointerdown', (e) => { if (S?.screen !== 'playing') return; g0 = { x: e.clientX, y: e.clientY, t: performance.now(), jumped: false, moved: false }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!g0) return; const dx = e.clientX - g0.x, dy = e.clientY - g0.y;
  if (Math.abs(dx) > 14) { engine.setAxis(Math.sign(dx)); g0.moved = true; if (Math.abs(dx) > 60) g0.x = e.clientX - Math.sign(dx) * 60; }
  if (dy < -40 && !g0.jumped) { engine.jump(); g0.jumped = true; }
});
const g1 = () => { if (g0 && !g0.moved && !g0.jumped && performance.now() - g0.t < 250) engine.jump(); engine.setAxis(0); g0 = null; };
canvas.addEventListener('pointerup', g1); canvas.addEventListener('pointercancel', g1);
