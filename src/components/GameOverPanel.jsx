export default function GameOverPanel({ info, onRetry, onHome }) {
  return (
    <div id="game-over">
      <h1>앗, 잠 깼어!</h1>
      <p id="fail-reason">{info.reason}</p>
      <p id="final-score">{info.meters} m / {info.goal} m</p>
      <p id="run-coins">⭐ +{info.runCoins}</p>
      {info.newRecord && <p id="new-record">🏆 최고 기록 갱신!</p>}
      <div className="btn-row">
        <button id="restart-btn" onClick={onRetry}>다시 자러 가기</button>
        <button className="ghost" onClick={onHome}>홈으로</button>
      </div>
    </div>
  );
}
