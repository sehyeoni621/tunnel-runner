export default function ClearPanel({ info, onNext, onHome }) {
  return (
    <div id="clear">
      <h1>꿀잠 성공!</h1>
      <p id="clear-level">{info.levelName}</p>
      <p id="clear-score">{info.meters} m 완주</p>
      <p id="clear-coins">⭐ +{info.runCoins} · 클리어 보상 +{info.reward}</p>
      {info.unlockedNew && <p id="clear-unlock">🔓 새 스테이지 해금!</p>}
      <div className="btn-row">
        {!info.isLast && <button id="next-btn" onClick={onNext}>다음 스테이지</button>}
        <button className="ghost" onClick={onHome}>홈으로</button>
      </div>
    </div>
  );
}
