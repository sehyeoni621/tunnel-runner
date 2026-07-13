// 벡터 캐릭터 렌더러 — 스프라이트 시트가 없을 때 사용 (상점/홈 썸네일도 공용)

import { PAL } from './config.js';

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


function lighten(hex, w) {
  const n = parseInt(hex.slice(1), 16);
  const m = (c) => Math.round(c + (255 - c) * w);
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}


export { rr, outlined, drawHoodFeatures, drawRunnerBack, drawRunnerFront, drawStarShape, lighten };
