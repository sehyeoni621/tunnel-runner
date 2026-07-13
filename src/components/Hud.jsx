const CoinIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path
      d="M12 2 L14.6 8.2 L21.5 8.8 L16.3 13.2 L17.9 20 L12 16.4 L6.1 20 L7.7 13.2 L2.5 8.8 L9.4 8.2 Z"
      fill="#FFE28A" stroke="#2B2D5C" strokeWidth="1.6" strokeLinejoin="round"
    />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 64 64" width="22" height="22">
    <path d="M42 8 A24 24 0 1 0 42 56 A18 18 0 1 1 42 8 Z" fill="#FFE28A" stroke="#2B2D5C" strokeWidth="3" strokeLinejoin="round" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 64 64" width="18" height="18"><path d="M20 12 L52 32 L20 52 Z" fill="#FFF3D6" /></svg>
);

const ShopIcon = () => (
  <svg viewBox="0 0 64 64" width="22" height="22">
    <circle cx="32" cy="14" r="5" fill="none" stroke="#FFF3D6" strokeWidth="4" />
    <path d="M32 19 L32 26" stroke="#FFF3D6" strokeWidth="4" />
    <path d="M12 46 L32 26 L52 46 Z" fill="rgba(184,169,224,0.35)" stroke="#FFF3D6" strokeWidth="4" strokeLinejoin="round" />
    <line x1="12" y1="46" x2="52" y2="46" stroke="#FFF3D6" strokeWidth="4" />
  </svg>
);

const HammerIcon = ({ size = 24 }) => (
  <svg viewBox="0 0 64 64" width={size} height={size}>
    <rect x="12" y="9" width="40" height="20" rx="7" fill="#FF8FB0" stroke="#2B2D5C" strokeWidth="3" />
    <line x1="22" y1="14" x2="22" y2="24" stroke="#2B2D5C" strokeWidth="2.4" />
    <line x1="42" y1="14" x2="42" y2="24" stroke="#2B2D5C" strokeWidth="2.4" />
    <rect x="28" y="27" width="8" height="28" rx="4" fill="#FFF3D6" stroke="#2B2D5C" strokeWidth="3" />
  </svg>
);

export default function Hud({ game, onPause, onShop, onHammer }) {
  return (
    <>
      <div id="hud">
        <div id="score-box">
          <span id="score">{game.scoreM} m</span>
          <span id="best">BEST {game.bestM} m</span>
          <div id="coin-hud">
            <CoinIcon />
            <span id="coin-count">{game.coins}</span>
          </div>
        </div>

        <div id="level-hud">
          <span id="level-name">{game.levelName}</span>
          <div id="progress-track">
            <div id="progress-fill" style={{ width: `${(game.progress * 100).toFixed(1)}%` }} />
            <div id="progress-bed">🛏️</div>
          </div>
        </div>

        <div id="hud-buttons">
          {game.hammers > 0 && (
            <button id="hammer-btn" title="뽕망치 사용 (H)" onClick={onHammer}>
              <HammerIcon />
              <span className="hammer-count">{game.hammers}</span>
            </button>
          )}
          <button id="shop-btn" title="상점" onClick={onShop}><ShopIcon /></button>
          <button id="pause-btn" title="일시정지" onClick={onPause}>
            {game.paused ? <PlayIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {/* 런이 바뀔 때마다(key) 힌트 페이드 애니메이션을 다시 재생 */}
      {game.phase === 'playing' && (
        <div id="hint" key={game.runId}>
          <span className="hint-keyboard">
            ← → 이동 · Space 점프 · 벽에 붙어 계속 밀면 벽 타기
            {game.hammers > 0 && ' · H 뽕망치로 앞 장애물 부수기'}
          </span>
          <span className="hint-touch">
            ◀ ▶ 눌러서 이동 · 화면 탭 또는 점프 버튼 · 벽에 붙인 채 누르면 벽 타기
            {game.hammers > 0 && ' · 🔨 버튼으로 앞 장애물 부수기'}
          </span>
        </div>
      )}
    </>
  );
}
