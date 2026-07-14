import { useEffect, useRef } from 'react';

const HammerIcon = () => (
  <svg viewBox="0 0 64 64" width="30" height="30">
    <rect x="12" y="9" width="40" height="20" rx="7" fill="#FF8FB0" stroke="#2B2D5C" strokeWidth="3" />
    <line x1="22" y1="14" x2="22" y2="24" stroke="#2B2D5C" strokeWidth="2.4" />
    <line x1="42" y1="14" x2="42" y2="24" stroke="#2B2D5C" strokeWidth="2.4" />
    <rect x="28" y="27" width="8" height="28" rx="4" fill="#FFF3D6" stroke="#2B2D5C" strokeWidth="3" />
  </svg>
);

// 모바일 · 태블릿 조작 패드 (터치 기기에서만 CSS로 표시)
// 좌우 버튼은 "누르고 있는 동안" 이동 → 벽에 붙여 두면 그대로 벽 타기까지 이어진다.
//
// [기기 호환성]
// 안드로이드(갤럭시) 크롬에서 Pointer 이벤트가 취소되거나 setPointerCapture가 실패해
// 좌우 이동이 먹통이 되는 사례가 있어, touch 이벤트를 1차로 쓰고 pointer는 보조로 둔다.
// 두 경로가 겹쳐 두 번 처리되지 않도록 touch가 잡은 버튼은 pointer 쪽에서 무시한다.
export default function TouchControls({ onMove, onJump, hammers, onHammer }) {
  const heldRef = useRef(0);        // 현재 누르고 있는 방향
  const touchOwnedRef = useRef(false); // touch 이벤트가 처리 중이면 pointer는 건너뜀

  const press = (dir) => {
    heldRef.current = dir;
    onMove(dir);
  };

  const release = () => {
    if (!heldRef.current) return;
    heldRef.current = 0;
    onMove(0);
  };

  // 손가락이 버튼 밖으로 미끄러지거나, 앱이 백그라운드로 가도 반드시 멈추게 한다
  useEffect(() => {
    const stop = () => release();
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('touchend', stop);
    window.addEventListener('touchcancel', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('touchend', stop);
      window.removeEventListener('touchcancel', stop);
      window.removeEventListener('blur', stop);
    };
  }, [onMove]);

  const hold = (dir) => ({
    onTouchStart: (e) => {
      e.preventDefault();          // 스크롤·확대·마우스 이벤트 합성 방지
      touchOwnedRef.current = true;
      press(dir);
    },
    onTouchEnd: (e) => { e.preventDefault(); release(); },
    onTouchCancel: () => release(),
    onPointerDown: (e) => {
      if (touchOwnedRef.current || e.pointerType === 'touch') return; // touch 경로가 담당
      press(dir);
    },
    onPointerUp: () => release(),
    onPointerCancel: () => release(),
    onContextMenu: (e) => e.preventDefault(),   // 길게 누를 때 뜨는 메뉴 차단
  });

  // 점프·뽕망치는 누르는 즉시 1회 발동 (touch 우선, 마우스는 pointer)
  const tapOnce = (fn) => ({
    onTouchStart: (e) => { e.preventDefault(); touchOwnedRef.current = true; fn(); },
    onPointerDown: (e) => { if (e.pointerType !== 'touch') fn(); },
    onContextMenu: (e) => e.preventDefault(),
  });

  return (
    <div id="touch-controls">
      <div className="touch-move">
        <button className="touch-btn" aria-label="왼쪽" {...hold(-1)}>◀</button>
        <button className="touch-btn" aria-label="오른쪽" {...hold(1)}>▶</button>
      </div>
      <div className="touch-actions">
        {/* 뽕망치는 보유 중일 때만 — 엄지로 바로 닿는 위치에 둔다 */}
        {hammers > 0 && (
          <button className="touch-btn hammer" aria-label="뽕망치" {...tapOnce(onHammer)}>
            <HammerIcon />
            <span className="hammer-count">{hammers}</span>
          </button>
        )}
        <button className="touch-btn jump" aria-label="점프" {...tapOnce(onJump)}>
          점프
        </button>
      </div>
    </div>
  );
}
