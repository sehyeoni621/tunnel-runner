import { useEffect, useRef } from 'react';
import { drawRunnerFront, lighten } from '../game/characters.js';

// 스킨 앞모습을 캔버스에 그려주는 공용 컴포넌트 (홈 미리보기 · 상점 썸네일)
export default function SkinCanvas({ skin, size = 150, scale = 1.55, background = true, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const g = ref.current.getContext('2d');
    g.clearRect(0, 0, size, size);
    if (background) {
      g.fillStyle = lighten(skin.hood, 0.78);
      g.fillRect(0, 0, size, size);
    }
    g.save();
    g.translate(size / 2, size * 0.86);
    g.scale(scale, scale);
    drawRunnerFront(g, skin);
    g.restore();
  }, [skin, size, scale, background]);

  return <canvas ref={ref} width={size} height={size} className={className} />;
}
