// 화면 터치 제스처 — 조작 버튼이 안 먹는 기기에서도 플레이할 수 있게 하는 안전망
//
// · 화면을 좌/우로 끌면(드래그) 그 방향으로 이동 — 손가락을 붙인 채 유지하면 벽 타기까지 이어짐
// · 짧게 톡 치면(탭) 점프
// · 두 손가락도 지원: 왼손으로 방향을 잡은 채 오른손으로 탭해서 점프
//
// touch 이벤트를 직접 쓰는 이유: 안드로이드(갤럭시) 일부 기기에서 Pointer 이벤트가
// 스크롤 판정 등으로 취소돼 이동이 먹통이 되는 사례가 있어서다.

const DRAG = 16;      // 이 픽셀 이상 끌면 '이동'으로 본다 (그 아래는 탭 후보)
const TAP_MS = 300;   // 이 시간 안에 떼면 탭(점프)
const TAP_SLOP = 18;  // 탭으로 인정하는 최대 이동 거리

// 이동 조작을 맡고 있는 손가락 (한 번에 하나)
let steerId = null;
let steerX = 0;
let steerDir = 0;

// 탭(점프) 판정용 — 손가락별 시작 정보
const touches = new Map();

function attachTouchGestures(el, { onMove, onJump }) {
  const clearSteer = () => {
    if (steerId === null) return;
    steerId = null;
    steerDir = 0;
    onMove(0);
  };

  const onStart = (e) => {
    for (const t of e.changedTouches) {
      touches.set(t.identifier, { x: t.clientX, y: t.clientY, t: performance.now() });
    }
    e.preventDefault();
  };

  const onMoveEvt = (e) => {
    for (const t of e.changedTouches) {
      const start = touches.get(t.identifier);
      if (!start) continue;

      // 아직 이동 담당 손가락이 없고, 좌우로 충분히 끌었으면 이 손가락이 조종간을 잡는다
      if (steerId === null && Math.abs(t.clientX - start.x) > DRAG) {
        steerId = t.identifier;
        steerX = start.x;
      }

      if (steerId === t.identifier) {
        // 시작점 대비 좌우 위치로 방향 결정 (되돌리면 즉시 반대로 꺾인다)
        const dx = t.clientX - steerX;
        const dir = dx > DRAG / 2 ? 1 : dx < -DRAG / 2 ? -1 : 0;
        if (dir !== steerDir) {
          steerDir = dir;
          onMove(dir);
        }
        // 손가락을 계속 끌면 기준점도 따라가서, 화면 끝까지 가도 조작이 유지된다
        if (dx > 90) steerX = t.clientX - 90;
        if (dx < -90) steerX = t.clientX + 90;
      }
    }
    e.preventDefault();
  };

  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      const start = touches.get(t.identifier);
      touches.delete(t.identifier);

      if (steerId === t.identifier) {
        steerId = null;
        steerDir = 0;
        onMove(0);
        continue;
      }
      if (!start) continue;

      // 짧고 거의 움직이지 않은 터치 = 점프
      const dt = performance.now() - start.t;
      const moved = Math.hypot(t.clientX - start.x, t.clientY - start.y);
      if (dt < TAP_MS && moved < TAP_SLOP) onJump();
    }
    e.preventDefault();
  };

  const onCancel = () => {
    touches.clear();
    clearSteer();
  };

  el.addEventListener('touchstart', onStart, { passive: false });
  el.addEventListener('touchmove', onMoveEvt, { passive: false });
  el.addEventListener('touchend', onEnd, { passive: false });
  el.addEventListener('touchcancel', onCancel, { passive: false });
  window.addEventListener('blur', onCancel);

  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMoveEvt);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('touchcancel', onCancel);
    window.removeEventListener('blur', onCancel);
    onCancel();
  };
}

export { attachTouchGestures };
