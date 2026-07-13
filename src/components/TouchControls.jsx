import { useEffect, useRef } from 'react';

// 모바일 · 태블릿 조작 패드 (터치 기기에서만 CSS로 표시)
// 좌우 버튼은 "누르고 있는 동안" 이동 → 벽에 붙여 두면 그대로 벽 타기까지 이어진다.
export default function TouchControls({ onMove, onJump }) {
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
      <button
        className="touch-btn jump"
        aria-label="점프"
        onPointerDown={(e) => { e.preventDefault(); onJump(); }}
      >
        점프
      </button>
    </div>
  );
}
