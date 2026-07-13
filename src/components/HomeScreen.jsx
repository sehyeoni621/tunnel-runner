import { useState } from 'react';
import { LEVELS } from '../game/config.js';
import { getManifest, skinByKey } from '../game/assets.js';
import SkinCanvas from './SkinCanvas.jsx';

export default function HomeScreen({ game, onStart, onSelect, onShop }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const skin = skinByKey(game.equipped);
  // 매니페스트가 늦게 로드돼도 스킨 이름이 갱신되도록 참조만 해 둔다
  getManifest();

  return (
    <div id="home">
      <div id="home-inner">
        <div id="home-title">
          <p id="zzz">z z Z</p>
          <h1>꿀잠 러너</h1>
          <p id="tagline">방해꾼을 피해 침대까지 — 오늘은 꼭 꿀잠</p>
        </div>

        <div id="home-body">
          <div id="home-char">
            <SkinCanvas skin={skin} size={180} scale={1.95} background={false} className="home-skin" />
            <div id="home-skin-name">{skin.name}</div>
          </div>

          <div id="home-side">
            <div id="home-stats">
              <div className="stat">
                <span className="k">최고 기록</span>
                <span className="v">{game.bestM} m</span>
              </div>
              <div className="stat">
                <span className="k">별사탕</span>
                <span className="v gold">{game.coins}</span>
              </div>
            </div>

            <div id="level-select">
              {LEVELS.map((lv, i) => {
                const n = i + 1;
                const locked = n > game.unlocked;
                const classes = ['level-card'];
                if (locked) classes.push('locked');
                if (!locked && game.selected === n) classes.push('selected');
                return (
                  <div
                    key={lv.name}
                    className={classes.join(' ')}
                    onClick={() => !locked && onSelect(n)}
                    onDoubleClick={() => !locked && onStart(n)}
                  >
                    <div className="lv">{locked ? '🔒' : n}</div>
                    <div className="nm">{lv.name}</div>
                    <div className="goal">{lv.goal} m</div>
                    {game.cleared.includes(n) && <div className="cleared">🌙</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div id="home-buttons">
          <button id="start-btn" onClick={() => onStart(game.selected)}>잠들러 가기</button>
          <button className="ghost" onClick={onShop}>키구루미 상점</button>
          <button className="ghost" onClick={() => setHelpOpen((v) => !v)}>조작법</button>
        </div>

        {helpOpen && (
          <div id="home-help">
            <p><b>← →</b> 좌우 이동 · <b>Space</b> 점프 · 벽에 붙어 계속 밀면 <b>그 벽으로 올라타기</b></p>
            <p><b>동생</b>은 점프로 넘고, <b>아빠 · 조혜민 · 김예은</b>는 좌우로 피하세요.</p>
            <p><b>밈</b>은 안 죽지만 시야를 가리고 느려지게 만들어요. 구멍은 점프!</p>
            <p>상점에서 <b>뽕망치</b>를 사두면 위급할 때 <b>H</b>(모바일은 🔨 버튼)로 앞 장애물을 부술 수 있어요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
