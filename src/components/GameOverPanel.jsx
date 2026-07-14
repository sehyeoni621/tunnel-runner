const PillIcon = () => (
  <svg viewBox="0 0 64 64" width="20" height="20" style={{ verticalAlign: '-3px' }}>
    <g transform="rotate(-35 32 32)">
      <rect x="14" y="22" width="36" height="20" rx="10" fill="#9FD8FF" stroke="#2B2D5C" strokeWidth="4" />
      <path d="M14 32 a10 10 0 0 1 10 -10 h8 v20 h-8 a10 10 0 0 1 -10 -10 Z" fill="#FFF3D6" stroke="#2B2D5C" strokeWidth="4" />
    </g>
  </svg>
);

export default function GameOverPanel({ info, game, onRevive, onRetry, onHome }) {
  // 부활: 첫 번째는 멜라토닌 1개, 두 번째는 2개 (한 판에 최대 2번)
  const revivesLeft = 2 - game.reviveCost + 1;

  return (
    <div id="game-over">
      <h1>앗, 잠 깼어!</h1>
      <p id="fail-reason">{info.reason}</p>
      <p id="final-score">{info.meters} m / {info.goal} m</p>
      <p id="run-coins">⭐ +{info.runCoins}</p>
      {info.newRecord && <p id="new-record">🏆 최고 기록 갱신!</p>}

      {game.canRevive && (
        <button id="revive-btn" onClick={onRevive}>
          <PillIcon /> 멜라토닌 {game.reviveCost}개로 부활
          <span className="revive-sub">보유 {game.melatonin}개 · 이번 판 {revivesLeft}번 더 가능</span>
        </button>
      )}

      <div className="btn-row">
        <button id="restart-btn" onClick={onRetry}>다시 자러 가기</button>
        <button className="ghost" onClick={onHome}>홈으로</button>
      </div>
    </div>
  );
}
