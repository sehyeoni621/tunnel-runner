import { useCallback, useEffect, useRef, useState } from 'react';
import * as engine from './game/engine.js';
import HomeScreen from './components/HomeScreen.jsx';
import Hud from './components/Hud.jsx';
import Shop from './components/Shop.jsx';
import ClearPanel from './components/ClearPanel.jsx';
import GameOverPanel from './components/GameOverPanel.jsx';
import MemeCover from './components/MemeCover.jsx';
import TouchControls from './components/TouchControls.jsx';
import { attachTouchGestures } from './game/touch.js';

// 캔버스 게임 엔진(60fps 루프)은 React 밖에서 돌고,
// React는 엔진이 통지하는 스냅샷으로 UI 레이어만 그린다.
export default function App() {
  const canvasRef = useRef(null);
  const [game, setGame] = useState(null);      // 엔진 스냅샷
  const [shopOpen, setShopOpen] = useState(false);

  useEffect(() => engine.init(canvasRef.current, setGame), []);

  // 캔버스 위 터치 제스처 — 끌면 이동, 톡 치면 점프 (조작 버튼이 안 먹는 기기 대비)
  useEffect(() => attachTouchGestures(canvasRef.current, {
    onMove: engine.setMove,
    onJump: engine.tap,
  }), []);

  // 상점은 UI 상태 + 엔진 일시정지가 함께 움직인다
  const openShop = useCallback(() => { setShopOpen(true); engine.setShopOpen(true); }, []);
  const closeShop = useCallback(() => { setShopOpen(false); engine.setShopOpen(false); }, []);

  useEffect(() => {
    if (!shopOpen) return;
    const onEsc = (e) => { if (e.code === 'Escape') closeShop(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [shopOpen, closeShop]);

  return (
    <>
      {/* 터치 조작은 attachTouchGestures가 담당 (끌기=이동, 탭=점프) */}
      <canvas id="game-canvas" ref={canvasRef} />

      <div id="ui-layer">
        {game && (
          <>
            {game.phase === 'playing' && !shopOpen && (
              <TouchControls
                onMove={engine.setMove}
                onJump={engine.jump}
                hammers={game.hammers}
                onHammer={engine.useHammer}
              />
            )}

            {game.phase === 'home' && (
              <HomeScreen game={game} onStart={engine.startLevel} onSelect={engine.selectLevel} onShop={openShop} />
            )}

            {game.phase !== 'home' && (
              <Hud game={game} onPause={engine.togglePause} onShop={openShop} onHammer={engine.useHammer} />
            )}

            {game.meme && <MemeCover meme={game.meme} />}

            {game.clear?.ready && (
              <ClearPanel info={game.clear} onNext={engine.goNextLevel} onHome={engine.showHome} />
            )}

            {game.over && (
              <GameOverPanel
                info={game.over}
                game={game}
                onRevive={engine.useMelatonin}
                onRetry={() => engine.startLevel(game.level)}
                onHome={engine.showHome}
              />
            )}

            {shopOpen && (
              <Shop
                game={game}
                onBuy={engine.buySkin}
                onBuyHammer={engine.buyHammer}
                onBuyMelatonin={engine.buyMelatonin}
                onClose={closeShop}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
