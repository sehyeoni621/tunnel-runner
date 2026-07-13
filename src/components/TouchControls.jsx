import { useEffect, useRef } from 'react';

// 모바일 · 태블릿 조작 패드 (터치 기기에서만 CSS로 표시)
// 좌우 버튼은 "누르고 있는 동안" 이동 → 벽에 붙여 두면 그대로 벽 타기까지 이어진다.
const HammerIcon = () => (
  <svg viewBox="0 0 64 64" width="30" height="30">
    <rect x="12" y="9" width="40" height="20" rx="7" fill="#FF8FB0" stroke="#2B2D5C" strokeWidth="3" />
    <line x1="22" y1="14" x2="22" y2="24" stroke="#2B2D5C" strokeWidth="2.4" />
    <line x1="42" y1="14" x2="42" y2="24" stroke="#2B2D5C" strokeWidth="2.4" />
    <rect x="28" y="27" width="8" height="28" rx="4" fill="#FFF3D6" stroke="#2B2D5C" strokeWidth="3" />
  </svg>
);

export default function TouchControls({ onMove, onJump, hammers, onHammer }) {
  const heldRef = useRef(0);

  // 버튼 위에서 손가락이 미끄러져 나가도 이동이 멈추도록 안전장치
  useEffect(() => {
    const release = () => { if (heldRef.current) { heldRef.current = 0; onMove(0); } };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, [onMove]);

  const hold = (dir) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      heldRef.current = dir;
      onMove(dir);
    },
    onPointerUp: () => { heldRef.current = 0; onMove(0); },
    onPointerCancel: () => { heldRef.current = 0; onMove(0); },
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
          <button
            className="touch-btn hammer"
            aria-label="뽕망치"
            onPointerDown={(e) => { e.preventDefault(); onHammer(); }}
          >
            <HammerIcon />
            <span className="hammer-count">{hammers}</span>
          </button>
        )}
        <button
          className="touch-btn jump"
          aria-label="점프"
          onPointerDown={(e) => { e.preventDefault(); onJump(); }}
        >
          점프
        </button>
      </div>
    </div>
  );
}
