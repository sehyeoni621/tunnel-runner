// 꿀잠 러너 V2 — 3D 모델 빌더 (three.js 프리미티브 조합)
// 모든 mesh/material 에 이름을 붙인다 → GLB/OBJ 익스포트 시 파트명으로 남음.
// 좌표: 미터, y-up, 발바닥/바닥 = y 0, 캐릭터 정면 = +z
import * as THREE from 'three';

const V3 = THREE.Vector3;
const cache = new Map();
export function mat(name, color, o = {}) {
  if (cache.has(name)) return cache.get(name);
  const m = new THREE.MeshStandardMaterial({
    name, color, roughness: o.r ?? 0.62, metalness: o.m ?? 0,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    transparent: o.o !== undefined, opacity: o.o ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
  });
  cache.set(name, m);
  return m;
}
function M(name, geo, material, p = [0, 0, 0], r = [0, 0, 0], s) {
  const m = new THREE.Mesh(geo, material);
  m.name = name; m.position.set(...p); m.rotation.set(...r);
  if (s) m.scale.set(...s);
  return m;
}
function G(name, p = [0, 0, 0]) { const g = new THREE.Group(); g.name = name; g.position.set(...p); return g; }
const sph = (r, w = 32, h = 20) => new THREE.SphereGeometry(r, w, h);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 20);
const cyl = (rt, rb, h, s = 32) => new THREE.CylinderGeometry(rt, rb, h, s);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const hex = (c) => c.toString(16).padStart(6, '0');

function starShape(R, r, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / n, rad = i % 2 ? r : R;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath(); return s;
}
function heartShape(k) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9 * k);
  s.bezierCurveTo(0.35 * k, -0.55 * k, 1.0 * k, -0.2 * k, 1.0 * k, 0.28 * k);
  s.bezierCurveTo(1.0 * k, 0.78 * k, 0.4 * k, 0.95 * k, 0, 0.5 * k);
  s.bezierCurveTo(-0.4 * k, 0.95 * k, -1.0 * k, 0.78 * k, -1.0 * k, 0.28 * k);
  s.bezierCurveTo(-1.0 * k, -0.2 * k, -0.35 * k, -0.55 * k, 0, -0.9 * k);
  return s;
}
const ext = (shape, depth, bevel = 0.02) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 24 });
  g.center(); return g;
};

/* ───────────────────────── 캐릭터 ───────────────────────── */
// skin: config.SKINS 항목. opts.gender: 'female' | 'male'
// 반환 group.rig: { armL, armR, legL, legR, head, body } — 애니메이션용 피벗
export function buildCharacter(skin, opts = {}) {
  const k = skin.key;
  const root = G('character_' + k);
  const body = mat(`kigurumi_${k}`, skin.body, { r: 0.85 });
  const inner = mat(`kigurumi_inner_${k}`, skin.inner, { r: 0.85 });
  const accent = mat(`kigurumi_accent_${k}`, skin.accent, { r: 0.7 });
  const skinTone = mat('skin', 0xffe1cf, { r: 0.7 });
  const hair = mat('hair_' + hex(skin.hair ?? 0x3b2a22), skin.hair ?? 0x3b2a22, { r: 0.55 });
  const eye = mat('eye', 0x2a1a14, { r: 0.25 });
  const white = mat('eye_highlight', 0xffffff, { r: 0.2, e: 0xffffff, ei: 0.4 });
  const blush = mat('blush', 0xff9fb0, { r: 0.8 });
  const dark = mat('ink', 0x2a1a20, { r: 0.6 });

  // 다리
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = G(sx < 0 ? 'legL' : 'legR', [0.1 * sx, 0.3, 0]);
    leg.add(M('leg', cap(0.085, 0.14), body, [0, -0.15, 0]));
    leg.add(M('foot', sph(0.1), skin.beak ? accent : inner === body ? body : body, [0, -0.25, 0.04], [0, 0, 0], [1, 0.62, 1.3]));
    leg.add(M('sole', sph(0.08), skin.beak ? accent : inner, [0, -0.29, 0.05], [0, 0, 0], [1, 0.3, 1.25]));
    root.add(leg); legs.push(leg);
  }
  // 몸통
  const torso = G('body', [0, 0, 0]);
  torso.add(M('torso', cap(0.2, 0.16), body, [0, 0.47, 0], [0, 0, 0], [1, 1, 0.88]));
  if (['bear', 'penguin', 'shark', 'tiger', 'dino', 'panda'].includes(k))
    torso.add(M('belly', sph(0.16), k === 'bear' ? accent : inner, [0, 0.44, 0.1], [0, 0, 0], [1, 1.15, 0.55]));
  else {
    torso.add(M('button', sph(0.022, 12, 8), inner, [0, 0.53, 0.18]));
    torso.add(M('button', sph(0.022, 12, 8), inner, [0, 0.44, 0.18]));
  }
  if (k === 'panda') { // 팔다리 검정
    body.userData.panda = true;
  }
  if (skin.helmet) torso.add(M('backpack', box(0.3, 0.3, 0.14), mat('suit_pack', 0xd4d9e8, { r: 0.5 }), [0, 0.5, -0.2]));
  if (skin.helmet) torso.add(M('suit_badge', cyl(0.05, 0.05, 0.02), mat('suit_badge', 0x4a7cf0, { e: 0x2244aa, ei: 0.4 }), [0.08, 0.55, 0.17], [Math.PI / 2, 0, 0]));
  if (skin.wings) for (const sx of [-1, 1]) torso.add(M('wing', sph(0.2), mat('wing', 0xffffff, { r: 0.9, e: 0xfff6e0, ei: 0.25 }), [0.16 * sx, 0.56, -0.2], [0.2, 0.5 * sx, 0.5 * sx], [0.35, 1, 0.12]));
  root.add(torso);
  // 꼬리 (뒷모습에서 잘 보이도록 크게)
  const tailMat = k === 'panda' ? accent : k === 'tiger' ? body : body;
  if (skin.tail === 'puff') torso.add(M('tail', sph(0.075), k === 'rabbit' ? mat('tail_white', 0xffffff, { r: 0.95 }) : tailMat, [0, 0.36, -0.2]));
  if (skin.tail === 'long') { const t = M('tail', cap(0.035, 0.34), body, [0.06, 0.45, -0.28], [0.9, 0, -0.35]); torso.add(t); }
  if (skin.tail === 'dino') torso.add(M('tail', new THREE.ConeGeometry(0.12, 0.42, 24), body, [0, 0.3, -0.3], [-1.9, 0, 0]));
  if (skin.tail === 'shark') { torso.add(M('tail', new THREE.ConeGeometry(0.1, 0.34, 24), body, [0, 0.33, -0.28], [-1.9, 0, 0])); torso.add(M('tail_fin', box(0.03, 0.2, 0.12), body, [0, 0.36, -0.45], [0.3, 0, 0])); }
  if (skin.tail === 'tiger') { torso.add(M('tail', cap(0.04, 0.32), body, [0, 0.42, -0.3], [1.0, 0, 0])); torso.add(M('tail_tip', sph(0.046), accent, [0, 0.54, -0.44])); }
  if (skin.tail === 'devil') { torso.add(M('tail', cap(0.022, 0.36), dark, [0.04, 0.4, -0.3], [0.9, 0, -0.3])); torso.add(M('tail_tip', new THREE.ConeGeometry(0.06, 0.1, 3), skin.body === 0xc62f3c ? mat('devil_tip', 0xc62f3c) : dark, [0.1, 0.55, -0.44], [0.9, 0, 0])); }
  // 팔
  const arms = [];
  const limbMat = skin.panda ? accent : body;
  for (const sx of [-1, 1]) {
    const arm = G(sx < 0 ? 'armL' : 'armR', [0.2 * sx, 0.6, 0]);
    arm.add(M('arm', cap(0.068, 0.15), limbMat, [0.04 * sx, -0.13, 0], [0, 0, 0.35 * sx]));
    arm.add(M('hand', sph(0.06), skinTone, [0.1 * sx, -0.25, 0.01]));
    root.add(arm); arms.push(arm);
  }
  if (skin.panda) legs.forEach(l => l.children[0].material = accent);
  // 머리
  const head = G('head', [0, 0.66, 0]);
  const hy = 0.27;
  head.add(M('hood', sph(0.34), body, [0, hy, -0.03]));
  head.add(M('hood_rim', new THREE.TorusGeometry(0.255, 0.05, 16, 40), k === 'penguin' || k === 'shark' ? body : body, [0, hy - 0.01, 0.2]));
  head.add(M('face', sph(0.262), skinTone, [0, hy - 0.02, 0.1]));
  // 앞머리/옆머리
  head.add(M('bangs', new THREE.SphereGeometry(0.272, 32, 16, 0, Math.PI * 2, 0, 0.8), hair, [0, hy - 0.02, 0.1], [0.42, 0, 0]));
  if (opts.gender !== 'male') for (const sx of [-1, 1]) head.add(M('side_hair', cap(0.05, 0.07), hair, [0.225 * sx, hy - 0.03, 0.1], [0.1, 0, 0.1 * sx]));
  // 눈
  const eyeClosed = skin.sleepy;
  for (const sx of [-1, 1]) {
    if (eyeClosed) head.add(M('eye_closed', new THREE.TorusGeometry(0.04, 0.011, 8, 20, Math.PI), eye, [0.095 * sx, hy - 0.04, 0.345], [0, 0, Math.PI]));
    else {
      head.add(M('eye', sph(0.056), eye, [0.098 * sx, hy - 0.04, 0.33], [0, 0.25 * sx, 0], [0.9, 1.08, 0.5]));
      head.add(M('eye_shine', sph(0.018, 12, 8), white, [0.098 * sx + 0.018, hy - 0.015, 0.36]));
      head.add(M('eye_shine2', sph(0.009, 10, 6), white, [0.098 * sx - 0.015, hy - 0.07, 0.36]));
    }
    head.add(M('cheek', sph(0.045, 16, 10), blush, [0.165 * sx, hy - 0.11, 0.3], [0, 0.5 * sx, 0], [1, 0.6, 0.4]));
  }
  head.add(M('mouth', sph(0.024, 16, 10), mat('mouth', 0xc8505e), [0, hy - 0.14, 0.345], [0, 0, 0], [1.2, 0.7, 0.5]));
  // 스킨별 머리 장식
  const earInner = inner;
  if (skin.ears === 'rabbit') for (const sx of [-1, 1]) {
    const e = G('ear', [0.13 * sx, hy + 0.3, -0.04]); e.rotation.z = -0.18 * sx; e.rotation.x = -0.15;
    e.add(M('ear_outer', cap(0.07, 0.3), body, [0, 0.17, 0], [0, 0, 0], [1, 1, 0.6]));
    e.add(M('ear_inner', cap(0.04, 0.24), earInner, [0, 0.17, 0.035], [0, 0, 0], [1, 1, 0.35]));
    head.add(e);
  }
  if (skin.ears === 'round') for (const sx of [-1, 1]) {
    const em = skin.panda ? accent : body;
    head.add(M('ear_outer', sph(0.1), em, [0.23 * sx, hy + 0.24, -0.02], [0, 0, 0], [1, 1, 0.6]));
    if (!skin.panda) head.add(M('ear_inner', sph(0.055), k === 'tiger' ? accent : inner, [0.23 * sx, hy + 0.24, 0.035], [0, 0, 0], [1, 1, 0.4]));
  }
  if (skin.ears === 'cat') for (const sx of [-1, 1]) {
    head.add(M('ear_outer', new THREE.ConeGeometry(0.1, 0.2, 24), body, [0.19 * sx, hy + 0.3, 0], [0, 0, -0.35 * sx], [1, 1, 0.6]));
    head.add(M('ear_inner', new THREE.ConeGeometry(0.055, 0.12, 24), inner, [0.185 * sx, hy + 0.29, 0.03], [0, 0, -0.35 * sx], [1, 1, 0.4]));
  }
  if (skin.ears === 'horns') for (const sx of [-1, 1]) head.add(M('horn', new THREE.ConeGeometry(0.06, 0.2, 24), dark, [0.17 * sx, hy + 0.32, 0.02], [0, 0, -0.4 * sx]));
  if (skin.ears === 'fin') head.add(M('dorsal_fin', new THREE.ConeGeometry(0.1, 0.26, 4), body, [0, hy + 0.38, -0.1], [0, 0, 0], [0.35, 1, 1.2]));
  if (skin.ears === 'stem') {
    head.add(M('stem', cap(0.018, 0.16), mat('cherry_stem', 0x5a8a2a), [0.03, hy + 0.42, 0], [0, 0, -0.25]));
    head.add(M('leaf', sph(0.08), accent, [0.12, hy + 0.44, 0], [0, 0, -0.6], [1.3, 0.35, 0.6]));
  }
  if (skin.spikes) for (let i = 0; i < 5; i++) {
    const a = -0.2 + i * 0.5;
    head.add(M('dino_spike', new THREE.ConeGeometry(0.055, 0.12, 16), accent, [0, hy + Math.cos(a) * 0.35, -0.03 - Math.sin(a) * 0.35], [-a, 0, 0]));
  }
  if (skin.spikes) for (let i = 0; i < 3; i++) torso.add(M('dino_spike', new THREE.ConeGeometry(0.045, 0.1, 16), accent, [0, 0.6 - i * 0.12, -0.19], [-1.4, 0, 0]));
  if (skin.teeth) for (let i = -3; i <= 3; i++) {
    const a = i * 0.28;
    head.add(M('tooth', new THREE.ConeGeometry(0.02, 0.05, 8), accent, [Math.sin(a) * 0.25, hy + Math.cos(a) * 0.25 - 0.03, 0.25], [0, 0, Math.PI + a * -1]));
  }
  if (skin.beak) head.add(M('beak', new THREE.ConeGeometry(0.06, 0.12, 24), accent, [0, hy + 0.28, 0.2], [1.5, 0, 0], [1.3, 1, 0.6]));
  if (k === 'penguin') head.add(M('face_patch', sph(0.3), inner, [0, hy - 0.03, 0.02], [0, 0, 0], [1, 1, 0.9]));
  if (skin.stripes) for (const a of [-0.35, 0, 0.35]) head.add(M('stripe', box(0.04, 0.02, 0.14), accent, [Math.sin(a) * 0.33, hy + Math.cos(a) * 0.33, 0.08], [0.25, 0, -a]));
  if (skin.panda) for (const sx of [-1, 1]) head.add(M('eye_patch', sph(0.07), accent, [0.1 * sx, hy - 0.04, 0.3], [0, 0.25 * sx, 0.5 * sx], [1, 1.25, 0.45]));
  if (skin.halo) head.add(M('halo', new THREE.TorusGeometry(0.16, 0.022, 12, 40), mat('halo', 0xffd34d, { e: 0xffc020, ei: 0.8, r: 0.3 }), [0, hy + 0.46, -0.02], [Math.PI / 2 - 0.2, 0, 0]));
  if (skin.helmet) {
    head.add(M('helmet_ring', new THREE.TorusGeometry(0.27, 0.035, 16, 40), inner, [0, hy - 0.01, 0.22]));
    head.add(M('antenna', cyl(0.012, 0.012, 0.14, 8), mat('suit_pack', 0xd4d9e8), [0.2, hy + 0.34, -0.02], [0, 0, -0.4]));
    head.add(M('antenna_tip', sph(0.028, 12, 8), mat('antenna_tip', 0xff5566, { e: 0xff2244, ei: 0.8 }), [0.24, hy + 0.41, -0.02]));
  }
  root.add(head);
  // 애니메이션 리그 (userData 는 GLB extras 로 직렬화되므로 사용하지 않음)
  root.rig = { armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], head, body: torso };
  return root;
}

// 달리기/점프/대기 포즈 적용. t=시간(s), mode: 'run' | 'jump' | 'idle' | 'sleep'
export function poseCharacter(ch, t, mode = 'run', speed = 1) {
  const u = ch.rig; if (!u) return;
  const s = Math.sin(t * 13 * speed);
  if (mode === 'run') {
    u.legL.rotation.x = s * 0.9; u.legR.rotation.x = -s * 0.9;
    u.armL.rotation.x = -s * 1.0; u.armR.rotation.x = s * 1.0;
    u.armL.rotation.z = 0; u.armR.rotation.z = 0;
    u.body.position.y = Math.abs(Math.cos(t * 13 * speed)) * 0.04; u.head.position.y = 0.66 + u.body.position.y;
    u.head.rotation.x = 0.06; u.head.rotation.z = s * 0.05;
  } else if (mode === 'jump') {
    u.legL.rotation.x = 0.7; u.legR.rotation.x = -0.3;
    u.armL.rotation.x = -2.4; u.armR.rotation.x = -2.4; u.armL.rotation.z = -0.3; u.armR.rotation.z = 0.3;
    u.head.rotation.x = -0.1;
  } else {
    const b = Math.sin(t * 2.4);
    u.legL.rotation.x = 0; u.legR.rotation.x = 0;
    u.armL.rotation.x = 0; u.armR.rotation.x = 0; u.armL.rotation.z = -0.1 - b * 0.05; u.armR.rotation.z = 0.1 + b * 0.05;
    u.body.position.y = 0; u.head.position.y = 0.66 + b * 0.008; u.head.rotation.z = b * 0.05; u.head.rotation.x = 0;
  }
}

/* ───────────────────────── 장애물 ───────────────────────── */
export function buildObstacle(key, opts = {}) {
  const g = G('obstacle_' + key);
  if (key === 'spike') {
    const red = mat('spike_block_red', 0xe0303c, { r: 0.45 });
    const steel = mat('spike_steel', 0xe8ecf4, { r: 0.3, m: 0.3 });
    const s = 0.72; g.add(M('block', new THREE.BoxGeometry(s, s, s, 1, 1, 1), red, [0, s / 2, 0]));
    const cone = new THREE.ConeGeometry(0.08, 0.2, 16);
    const faces = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    for (const f of faces) for (const a of [-0.2, 0.2]) for (const b of [-0.2, 0.2]) {
      const n = new V3(...f); const pos = n.clone().multiplyScalar(s / 2 + 0.09);
      const t1 = Math.abs(f[1]) ? new V3(1, 0, 0) : new V3(0, 1, 0); const t2 = new V3().crossVectors(n, t1);
      pos.add(t1.multiplyScalar(a)).add(t2.multiplyScalar(b)); pos.y += s / 2;
      const c = M('spike', cone, steel, pos.toArray()); c.quaternion.setFromUnitVectors(new V3(0, 1, 0), n); g.add(c);
    }
  }
  if (key === 'rotate') {
    const purple = mat('rotate_block_purple', 0x6a3fd0, { r: 0.4 });
    const edge = mat('rotate_block_edge', 0x3a2290, { r: 0.4 });
    const glow = mat('rotate_arrow_glow', 0xc9a8ff, { e: 0xa070ff, ei: 1.2 });
    const spin = G('spinner', [0, 0.45, 0]);
    spin.add(M('block', box(0.82, 0.82, 0.82), purple));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) spin.add(M('edge', box(0.86, 0.08, 0.08), edge, [0, 0.41 * sy, 0.41 * sx]));
    for (const dz of [0.415, -0.415]) {
      spin.add(M('arrow_arc', new THREE.TorusGeometry(0.22, 0.035, 10, 32, Math.PI * 1.5), glow, [0, 0, dz]));
      const tip = M('arrow_tip', new THREE.ConeGeometry(0.07, 0.14, 3), glow, [0.22, 0.02, dz], [0, 0, 0]); spin.add(tip);
    }
    g.add(spin);
  }
  if (key === 'platform') {
    const top = mat('platform_steel', 0x9aa3b8, { r: 0.35, m: 0.3 });
    const yel = mat('hazard_yellow', 0xffc62a, { r: 0.5 });
    const blk = mat('hazard_black', 0x1d1d26, { r: 0.5 });
    const glow = mat('platform_glow', 0x5fe0ff, { e: 0x2bc8ff, ei: 1.4 });
    const w = (opts.halfW ?? 0.85) * 2;
    g.add(M('deck', box(w, 0.08, 1.6), top, [0, 0.16, 0]));
    const n = 8;
    for (let i = 0; i < n; i++) for (const dz of [0.8, -0.8]) g.add(M('stripe', box(w / n, 0.12, 0.02), i % 2 ? yel : blk, [-w / 2 + w / n * (i + 0.5), 0.06, dz]));
    for (const sx of [-1, 1]) g.add(M('side', box(0.02, 0.12, 1.6), yel, [sx * w / 2, 0.06, 0]));
    g.add(M('thruster', cyl(0.28, 0.14, 0.18), blk, [0, -0.08, 0]));
    g.add(M('thruster_glow', cyl(0.12, 0.05, 0.3), glow, [0, -0.3, 0]));
  }
  if (key === 'laser') {
    const w = opts.width ?? 4.4;
    const post = mat('laser_post', 0x2a2d44, { r: 0.4, m: 0.3 });
    const cap_ = mat('laser_emitter', 0xff5a6a, { e: 0xff2040, ei: 1.2 });
    const beam = mat('laser_beam', 0xff4060, { e: 0xff1a3c, ei: 2.2, o: 0.95 });
    for (const sx of [-1, 1]) {
      g.add(M('post', box(0.16, 1.1, 0.2), post, [sx * (w / 2 - 0.08), 0.55, 0]));
      for (const y of [0.25, 0.5, 0.75]) g.add(M('emitter', cyl(0.07, 0.07, 0.06, 20), cap_, [sx * (w / 2 - 0.17), y, 0], [0, 0, Math.PI / 2]));
    }
    const beams = G('beams');
    for (const y of [0.25, 0.5, 0.75]) {
      beams.add(M('beam', cyl(0.035, 0.035, w - 0.3, 12), beam, [0, y, 0], [0, 0, Math.PI / 2]));
      beams.add(M('beam_halo', cyl(0.08, 0.08, w - 0.3, 12), mat('laser_halo', 0xff3050, { e: 0xff2040, ei: 1, o: 0.25 }), [0, y, 0], [0, 0, Math.PI / 2]));
    }
    g.add(beams);
  }
  if (key === 'fall') {
    const stone = mat('fall_block_stone', 0x7c7f8e, { r: 0.8 });
    const band = mat('fall_block_band', 0x4a4d5c, { r: 0.4, m: 0.3 });
    const arrow = mat('fall_arrow', 0xff4a5a, { e: 0xff2030, ei: 1.1 });
    const b = G('block', [0, 0.5, 0]);
    b.add(M('stone', box(0.92, 0.92, 0.92), stone));
    for (const y of [-0.34, 0.34]) b.add(M('band', box(0.96, 0.1, 0.96), band, [0, y, 0]));
    for (const dz of [0.47, -0.47]) {
      b.add(M('arrow_shaft', box(0.1, 0.26, 0.02), arrow, [0, 0.08, dz]));
      const t = M('arrow_head', new THREE.ConeGeometry(0.14, 0.18, 3), arrow, [0, -0.1, dz], [0, 0, Math.PI], [1, 1, 0.12]); b.add(t);
    }
    for (const sx of [-1, 1]) b.add(M('rivet', sph(0.04, 12, 8), band, [sx * 0.3, 0, 0.47]));
    g.add(b);
  }
  if (key === 'ghost') {
    const w = mat('ghost_white', 0xf4f0ff, { r: 0.5, e: 0xb8a8ff, ei: 0.35 });
    const pts = [];
    for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI * 0.5; pts.push(new THREE.Vector2(Math.sin(a) * 0.36, 0.55 + Math.cos(a) * 0.36)); }
    pts.push(new THREE.Vector2(0.38, 0.2), new THREE.Vector2(0.42, 0.02));
    const bodyG = new THREE.LatheGeometry(pts.reverse(), 40);
    const inner = G('ghost', [0, 0.35, 0]);
    inner.add(M('ghost_body', bodyG, w));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; inner.add(M('ghost_hem', sph(0.1, 16, 10), w, [Math.sin(a) * 0.36, 0.03, Math.cos(a) * 0.36])); }
    for (const sx of [-1, 1]) {
      inner.add(M('ghost_eye', sph(0.055, 16, 10), mat('ink', 0x2a1a20), [0.12 * sx, 0.6, 0.31], [0, 0, 0], [0.85, 1.2, 0.5]));
      inner.add(M('ghost_blush', sph(0.04, 12, 8), mat('blush', 0xff9fb0), [0.2 * sx, 0.5, 0.29], [0, 0, 0], [1, 0.6, 0.4]));
      inner.add(M('ghost_arm', sph(0.08, 16, 10), w, [0.4 * sx, 0.38, 0.05], [0, 0, 0.6 * sx], [0.6, 1, 0.6]));
    }
    inner.add(M('ghost_mouth', sph(0.035, 12, 8), mat('ink', 0x2a1a20), [0, 0.48, 0.34], [0, 0, 0], [1, 1.3, 0.5]));
    g.add(inner);
  }
  if (key === 'meme') {
    const yel = mat('banana_yellow', 0xffd84a, { r: 0.5 });
    const tip = mat('banana_tip', 0x6a4a22, { r: 0.6 });
    const curve = new THREE.QuadraticBezierCurve3(new V3(0.12, 0.05, 0), new V3(-0.32, 0.65, 0), new V3(0.1, 1.25, 0));
    g.add(M('banana', new THREE.TubeGeometry(curve, 40, 0.19, 24, false), yel));
    g.add(M('banana_end', sph(0.19), yel, [0.12, 0.05, 0]));
    g.add(M('banana_end', sph(0.19), yel, [0.1, 1.25, 0]));
    g.add(M('banana_stem', cyl(0.05, 0.07, 0.16, 12), tip, [0.14, 1.42, 0], [0, 0, -0.3]));
    const glass = mat('sunglasses', 0x121218, { r: 0.15, m: 0.3 });
    for (const sx of [-1, 1]) g.add(M('lens', box(0.17, 0.1, 0.03), glass, [-0.1 + sx * 0.1, 0.78, 0.17]));
    g.add(M('bridge', box(0.06, 0.025, 0.02), glass, [-0.1, 0.8, 0.18]));
    g.add(M('smile', new THREE.TorusGeometry(0.06, 0.013, 8, 20, Math.PI), mat('ink', 0x2a1a20), [-0.12, 0.63, 0.15], [0, 0, Math.PI]));
    for (const sx of [-1, 1]) g.add(M('banana_arm', cap(0.025, 0.2), tip, [-0.1 + sx * 0.24, 0.55, 0.05], [0, 0, 0.7 * sx]));
  }
  if (key === 'drink') {
    const cup = mat('drink_cup', 0xffc4d4, { r: 0.25, o: 0.8 });
    const tea = mat('drink_tea', 0xff7a96, { r: 0.4 });
    const lid = mat('drink_lid', 0xfff4f8, { r: 0.3, o: 0.9 });
    const pearl = mat('drink_pearl', 0x3a2030, { r: 0.3 });
    g.add(M('cup', cyl(0.2, 0.16, 0.52, 32), cup, [0, 0.26, 0]));
    g.add(M('tea', cyl(0.18, 0.145, 0.44, 32), tea, [0, 0.24, 0]));
    for (let i = 0; i < 8; i++) { const a = i * 0.8; g.add(M('pearl', sph(0.035, 12, 8), pearl, [Math.cos(a) * 0.1, 0.07 + (i % 2) * 0.05, Math.sin(a) * 0.1 + 0.02])); }
    g.add(M('lid', new THREE.SphereGeometry(0.21, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), lid, [0, 0.52, 0], [0, 0, 0], [1, 0.45, 1]));
    g.add(M('straw', cyl(0.025, 0.025, 0.42, 12), mat('drink_straw', 0x9a5ae0), [0.06, 0.72, 0], [0, 0, -0.25]));
    for (const sx of [-1, 1]) {
      g.add(M('angry_eye', sph(0.032, 12, 8), mat('ink', 0x2a1a20), [0.07 * sx, 0.33, 0.19], [0, 0, 0], [1, 1, 0.4]));
      g.add(M('angry_brow', box(0.07, 0.015, 0.01), mat('ink', 0x2a1a20), [0.07 * sx, 0.39, 0.19], [0, 0, 0.4 * sx]));
    }
    g.add(M('angry_mouth', new THREE.TorusGeometry(0.035, 0.01, 8, 16, Math.PI), mat('ink', 0x2a1a20), [0, 0.23, 0.19]));
  }
  return g;
}

/* ───────────────────────── 아이템 ───────────────────────── */
export function buildItem(key) {
  const g = G('item_' + key);
  const gold = mat('gold', 0xffc53a, { r: 0.3, m: 0.35, e: 0x5a3a00, ei: 0.4 });
  const goldLight = mat('gold_light', 0xffe27a, { r: 0.3, m: 0.25, e: 0x805800, ei: 0.4 });
  if (key === 'coin') {
    g.add(M('coin', cyl(0.3, 0.3, 0.08, 40), gold, [0, 0, 0], [Math.PI / 2, 0, 0]));
    g.add(M('coin_rim', new THREE.TorusGeometry(0.28, 0.03, 12, 40), goldLight));
    for (const dz of [0.045, -0.045]) g.add(M('coin_star', ext(starShape(0.17, 0.075), 0.02, 0.012), goldLight, [0, 0, dz]));
  }
  if (key === 'hammer') {
    const red = mat('hammer_red', 0xe8323e, { r: 0.35 });
    const redL = mat('hammer_red_light', 0xff6a6a, { r: 0.35 });
    const h = G('hammer', [0, 0, 0]); h.rotation.z = 0.5;
    h.add(M('head', cyl(0.17, 0.17, 0.42, 32), red, [0, 0.3, 0], [0, 0, Math.PI / 2]));
    for (const sx of [-1, 1]) h.add(M('cap', cyl(0.19, 0.19, 0.06, 32), redL, [sx * 0.22, 0.3, 0], [0, 0, Math.PI / 2]));
    h.add(M('handle', cyl(0.045, 0.05, 0.55, 16), mat('hammer_handle', 0x3a78e0, { r: 0.4 }), [0, -0.12, 0]));
    h.add(M('grip', cyl(0.06, 0.06, 0.08, 16), mat('hammer_grip', 0x2a58b0), [0, -0.36, 0]));
    g.add(h);
  }
  if (key === 'melatonin') {
    const jar = mat('melatonin_jar', 0x8a4fe0, { r: 0.25, e: 0x3a1a90, ei: 0.3 });
    g.add(M('jar', cyl(0.2, 0.2, 0.42, 32), jar));
    g.add(M('lid', cyl(0.215, 0.215, 0.1, 32), mat('melatonin_lid', 0x5a2fb0), [0, 0.25, 0]));
    g.add(M('label', cyl(0.205, 0.205, 0.2, 32, 1), mat('melatonin_label', 0xf0e8ff), [0, -0.02, 0]));
    g.add(M('moon', new THREE.TorusGeometry(0.06, 0.02, 10, 24, Math.PI * 1.3), mat('moon_gold', 0xffd34d, { e: 0xffb000, ei: 0.5 }), [0, -0.02, 0.21], [0, 0, 0.9]));
  }
  if (key === 'boots') {
    const blue = mat('boots_blue', 0x3a7cf0, { r: 0.45 });
    const sole = mat('boots_sole', 0xf4f4f8, { r: 0.6 });
    g.add(M('sole', box(0.26, 0.07, 0.5), sole, [0, -0.2, 0.05]));
    g.add(M('toe', cap(0.11, 0.22), blue, [0, -0.1, 0.1], [Math.PI / 2, 0, 0], [1.1, 1, 0.9]));
    g.add(M('shaft', cyl(0.12, 0.13, 0.32, 24), blue, [0, 0.05, -0.1]));
    g.add(M('cuff', cyl(0.135, 0.135, 0.06, 24), mat('boots_cuff', 0xffc53a), [0, 0.22, -0.1]));
    for (let i = 0; i < 3; i++) g.add(M('lace', box(0.16, 0.02, 0.02), sole, [0, -0.02 + i * 0.07, 0.03 - i * 0.02]));
    g.add(M('wing', sph(0.1), mat('boots_wing', 0xffffff, { e: 0xaaddff, ei: 0.3 }), [0.14, 0.08, -0.14], [0, 0, 0.5], [0.3, 0.9, 0.9]));
  }
  if (key === 'shield') {
    const s = new THREE.Shape();
    s.moveTo(0, 0.42); s.quadraticCurveTo(0.2, 0.34, 0.34, 0.36); s.quadraticCurveTo(0.36, -0.1, 0, -0.42); s.quadraticCurveTo(-0.36, -0.1, -0.34, 0.36); s.quadraticCurveTo(-0.2, 0.34, 0, 0.42);
    g.add(M('shield', ext(s, 0.08, 0.03), mat('shield_blue', 0x2f7cf0, { r: 0.3, m: 0.2 })));
    g.add(M('shield_face', ext(s, 0.04, 0.01), mat('shield_light', 0x7ac6ff, { r: 0.25, e: 0x2a70c0, ei: 0.3 }), [0, 0, 0.05], [0, 0, 0], [0.78, 0.78, 1]));
  }
  if (key === 'magnet') {
    const red = mat('magnet_red', 0xe8323e, { r: 0.35 });
    const blue = mat('magnet_blue', 0x3a6ff0, { r: 0.35 });
    const steel = mat('magnet_steel', 0xe8ecf4, { r: 0.25, m: 0.35 });
    g.add(M('arc_red', new THREE.TorusGeometry(0.22, 0.09, 20, 32, Math.PI / 2), red, [0, 0.05, 0], [0, 0, Math.PI / 2]));
    g.add(M('arc_blue', new THREE.TorusGeometry(0.22, 0.09, 20, 32, Math.PI / 2), blue, [0, 0.05, 0], [0, 0, 0]));
    for (const sx of [-1, 1]) {
      g.add(M('leg', cyl(0.09, 0.09, 0.16, 24), sx < 0 ? red : blue, [0.22 * sx, -0.03, 0]));
      g.add(M('tip', cyl(0.092, 0.092, 0.1, 24), steel, [0.22 * sx, -0.16, 0]));
    }
    g.rotation.z = -0.35;
  }
  if (key === 'heart') g.add(M('heart', ext(heartShape(0.34), 0.14, 0.06), mat('heart_pink', 0xff3f7a, { r: 0.3, e: 0x800020, ei: 0.3 })));
  if (key === 'key') {
    g.add(M('bow', new THREE.TorusGeometry(0.14, 0.05, 16, 36), gold, [0, 0.24, 0]));
    g.add(M('shaft', cyl(0.04, 0.04, 0.5, 16), gold, [0, -0.1, 0]));
    g.add(M('tooth', box(0.14, 0.06, 0.06), gold, [0.07, -0.25, 0]));
    g.add(M('tooth', box(0.1, 0.06, 0.06), gold, [0.05, -0.14, 0]));
    g.rotation.z = -0.6;
  }
  return g;
}

/* ───────────────────────── 골인 침대 ───────────────────────── */
export function buildBed() {
  const g = G('goal_bed');
  const wood = mat('bed_wood', 0xb8744a, { r: 0.6 });
  const woodD = mat('bed_wood_dark', 0x8a5232, { r: 0.6 });
  const sheet = mat('bed_sheet', 0xfff4f8, { r: 0.9 });
  const blanket = mat('bed_blanket', 0xff8fc8, { r: 0.85 });
  const pillow = mat('bed_pillow', 0xffffff, { r: 0.95 });
  const moon = mat('moon_gold', 0xffd34d, { e: 0xffb000, ei: 0.8 });
  g.add(M('frame', box(2.3, 0.36, 3.0), wood, [0, 0.3, 0]));
  g.add(M('mattress', box(2.14, 0.3, 2.86), sheet, [0, 0.62, 0]));
  g.add(M('blanket', box(2.22, 0.18, 1.8), blanket, [0, 0.74, 0.5]));
  g.add(M('blanket_fold', cap(0.12, 2.0), mat('bed_blanket_fold', 0xffb4dc), [0, 0.84, -0.4], [0, 0, Math.PI / 2]));
  for (const sx of [-1, 1]) g.add(M('pillow', sph(0.4), pillow, [sx * 0.5, 0.86, -1.05], [0, 0, 0], [1, 0.38, 0.62]));
  g.add(M('headboard', box(2.5, 1.5, 0.18), woodD, [0, 0.9, -1.55]));
  g.add(M('headboard_cap', cap(0.1, 2.3), wood, [0, 1.66, -1.55], [0, 0, Math.PI / 2]));
  g.add(M('moon', new THREE.TorusGeometry(0.24, 0.07, 16, 40, Math.PI * 1.25), moon, [0, 1.05, -1.45], [0, 0, 0.7]));
  for (const sx of [-1, 1]) for (const dz of [-1.4, 1.4]) g.add(M('leg', cyl(0.07, 0.07, 0.14, 12), woodD, [sx * 1.05, 0.07, dz]));
  return g;
}

/* ───────────────────────── 터널(맵) 세그먼트 ───────────────────────── */
// theme: config.STAGES[i].theme · idx: 세그먼트 번호(교차 패턴용) · W/H/L: 폭/높이/길이
export function buildSegment(theme, idx, W = 4.4, H = 3.6, L = 6, rnd = Math.random) {
  const g = G('segment_' + theme.deco);
  const T = theme.deco;
  const fA = mat(`floor_a_${T}`, theme.floorA, { r: 0.55 });
  const fB = mat(`floor_b_${T}`, theme.floorB, { r: 0.55 });
  const wall = mat(`wall_${T}`, theme.wall, { r: 0.85 });
  const wall2 = mat(`wall2_${T}`, theme.wall2, { r: 0.8 });
  const ceil = mat(`ceil_${T}`, theme.ceil, { r: 0.9 });
  const trim = mat(`trim_${T}`, theme.trim, { e: theme.trim, ei: 1.3 });
  const glow = mat(`glow_${T}`, theme.glow, { e: theme.glow, ei: 1.5 });
  const accent = mat(`floorC_${T}`, theme.floorC, { e: T === 'space' ? theme.floorC : 0, ei: 1.2, r: 0.5 });
  const tw = W / 3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++)
    g.add(M('floor_tile', box(tw - 0.03, 0.1, L / 2 - 0.03), (i + j + idx) % 2 ? fA : fB, [-W / 2 + tw * (i + 0.5), -0.05, j ? -L / 4 : L / 4]));
  for (const sx of [-1, 1]) {
    g.add(M('wall', box(0.1, H, L), wall, [sx * (W / 2 + 0.05), H / 2, 0]));
    g.add(M('trim', box(0.06, 0.06, L), trim, [sx * (W / 2 - 0.02), 0.04, 0]));
    g.add(M('trim_top', box(0.06, 0.05, L), trim, [sx * (W / 2 - 0.02), H - 0.05, 0]));
  }
  g.add(M('ceiling', box(W + 0.2, 0.1, L), ceil, [0, H + 0.05, 0]));

  if (T === 'bedroom') {
    g.add(M('rug', box(1.8, 0.02, 2.6), mat('rug_bedroom', 0x3346b8, { r: 1 }), [0, 0.012, 0]));
    g.add(M('ceiling_beam', box(W, 0.14, 0.3), wall2, [0, H - 0.07, -L / 2 + 0.2]));
    const side = idx % 2 ? 1 : -1;
    const shelf = G('bookshelf', [side * (W / 2 - 0.2), 0, rnd() * 2 - 1]);
    shelf.add(M('shelf_frame', box(0.3, 2.2, 1.4), mat('shelf_wood', 0x7a4a8a), [0, 1.1, 0]));
    const bookCols = [0xff7aa8, 0x6ad0ff, 0xffd35a, 0x9c7aff, 0x5ae0b0];
    for (let r = 0; r < 3; r++) for (let b = 0; b < 5; b++)
      shelf.add(M('book', box(0.22, 0.4 + (b % 3) * 0.06, 0.18), mat('book_' + b, bookCols[b], { r: 0.7 }), [0.05 * -side, 0.35 + r * 0.68, -0.5 + b * 0.24]));
    g.add(shelf);
    const win = G('window', [-side * (W / 2 + 0.0), 1.8, 0]);
    win.add(M('window_frame', box(0.06, 1.2, 1.3), mat('window_frame', 0xe8d8ff), [0, 0, 0]));
    win.add(M('window_night', box(0.07, 1.05, 1.15), mat('window_night', 0x2a3a9a, { e: 0x1a2a8a, ei: 0.8 }), [0, 0, 0]));
    win.add(M('window_moon', sph(0.16, 20, 12), glow, [side * 0.05, 0.22, 0.25]));
    g.add(win);
    if (idx % 3 === 0) {
      const lamp = G('lamp', [-side * (W / 2 - 0.35), 0, 1.8]);
      lamp.add(M('lamp_table', box(0.5, 0.6, 0.5), mat('shelf_wood', 0x7a4a8a), [0, 0.3, 0]));
      lamp.add(M('lamp_stem', cyl(0.03, 0.03, 0.4, 10), mat('lamp_metal', 0xd8c8a8), [0, 0.8, 0]));
      lamp.add(M('lamp_shade', cyl(0.12, 0.22, 0.26, 24), glow, [0, 1.08, 0]));
      g.add(lamp);
    }
  }
  if (T === 'school') {
    const side = -1;
    for (let i = 0; i < 4; i++) {
      const lk = G('locker', [side * (W / 2 - 0.18), 0, -L / 2 + 0.75 + i * 1.5]);
      lk.add(M('locker_body', box(0.34, 2.1, 1.42), wall, [0, 1.05, 0]));
      for (let v = 0; v < 3; v++) lk.add(M('locker_vent', box(0.02, 0.03, 0.6), mat('locker_vent', 0x244a90), [0.18, 1.75 - v * 0.08, 0]));
      lk.add(M('locker_handle', box(0.03, 0.18, 0.04), mat('locker_handle', 0xd0d8e8, { m: 0.3 }), [0.18, 1.1, 0.5]));
      g.add(lk);
    }
    g.add(M('wall_lower', box(0.06, 1.0, L), wall2, [W / 2 - 0.02, 0.5, 0]));
    g.add(M('window_pane', box(0.05, 1.3, L * 0.7), mat('school_window', 0xbfe4ff, { e: 0x9ad0ff, ei: 0.9 }), [W / 2 - 0.02, 2.0, 0]));
    g.add(M('ceiling_light', box(0.6, 0.04, 1.8), glow, [0, H - 0.02, 0]));
    if (idx % 2 === 0) {
      const desk = G('desk', [W / 2 - 0.5, 0, 1.6]);
      desk.add(M('desk_top', box(0.7, 0.06, 0.5), mat('desk_wood', 0xd89a5a), [0, 0.72, 0]));
      desk.add(M('desk_leg', box(0.05, 0.7, 0.05), mat('lamp_metal', 0xd8c8a8), [0, 0.35, 0]));
      for (let b = 0; b < 3; b++) desk.add(M('book', box(0.36, 0.07, 0.26), mat('book_' + b, [0xff7aa8, 0x6ad0ff, 0xffd35a][b]), [0, 0.79 + b * 0.07, 0], [0, b * 0.3, 0]));
      g.add(desk);
    }
  }
  if (T === 'subway') {
    const car = G('train_car', [-(W / 2 - 0.35), 0, 0]);
    car.add(M('car_body', box(0.6, 2.7, L - 0.2), wall2, [0, 1.45, 0]));
    car.add(M('car_stripe', box(0.62, 0.16, L - 0.2), mat('car_stripe', 0xe0404a), [0, 1.0, 0]));
    car.add(M('car_stripe2', box(0.62, 0.06, L - 0.2), mat('car_stripe2', 0xffc62a), [0, 0.86, 0]));
    for (let i = 0; i < 2; i++) car.add(M('car_window', box(0.62, 0.8, 1.9), mat('car_window', 0xfff0c8, { e: 0xffd890, ei: 0.9 }), [0.01, 1.85, -1.4 + i * 2.8]));
    g.add(car);
    g.add(M('platform_edge', box(0.35, 0.02, L), accent, [-(W / 2 - 0.9), 0.012, 0]));
    for (const sx of [0.4, 1.4]) g.add(M('lane_dash', box(0.06, 0.02, L * 0.5), mat('lane_white', 0xe8ecf8), [sx, 0.012, 0]));
    g.add(M('tube_light', cyl(0.05, 0.05, L * 0.8, 12), glow, [0.8, H - 0.12, 0], [Math.PI / 2, 0, 0]));
    if (idx % 2) g.add(M('pillar', box(0.3, H, 0.4), mat('pillar_tile', 0x3a4a80), [W / 2 - 0.15, H / 2, 0]));
  }
  if (T === 'space') {
    for (const sx of [-1, 1]) {
      g.add(M('neon_rail', box(0.05, 0.05, L), sx < 0 ? trim : accent, [sx * 1.1, 0.02, 0]));
      g.add(M('porthole', cyl(0.5, 0.5, 0.06, 32), mat('porthole', 0x2a1a8a, { e: 0x3a2ad0, ei: 0.7 }), [sx * (W / 2 - 0.01), 1.9, 0], [0, 0, Math.PI / 2]));
      g.add(M('porthole_rim', new THREE.TorusGeometry(0.5, 0.06, 12, 40), wall2, [sx * (W / 2 - 0.02), 1.9, 0], [0, Math.PI / 2, 0]));
      for (let s = 0; s < 3; s++) g.add(M('star_dot', sph(0.03, 8, 6), glow, [sx * (W / 2 - 0.05), 1.7 + rnd() * 0.5, -0.3 + rnd() * 0.6]));
    }
    g.add(M('ceiling_strip', box(0.08, 0.04, L), trim, [0, H - 0.02, 0]));
  }
  if (T === 'dream') {
    const cloud = mat('cloud', 0xffffff, { r: 1, e: 0xffe8ff, ei: 0.35 });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++)
      g.add(M('cloud_puff', sph(0.35 + rnd() * 0.25, 20, 14), cloud, [sx * (W / 2 - 0.15), 0.15 + rnd() * 0.3, -L / 2 + i * 2 + rnd()]));
    for (let i = 0; i < 2; i++) g.add(M('ceiling_cloud', sph(0.32, 20, 14), cloud, [(rnd() < 0.5 ? -1 : 1) * (1.2 + rnd() * 0.6), H - 0.05, -2 + i * 3], [0, 0, 0], [1.4, 0.45, 1]));
    if (idx % 2) g.add(M('dream_star', ext(starShape(0.22, 0.1), 0.06), glow, [(rnd() - 0.5) * 2.6, 2.2 + rnd() * 0.8, 0], [0, 0, rnd()]));
  }
  return g;
}
