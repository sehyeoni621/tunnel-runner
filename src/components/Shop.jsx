import { useState } from 'react';
import { getManifest } from '../game/assets.js';
import { HAMMER, MELATONIN } from '../game/config.js';
import SkinCanvas from './SkinCanvas.jsx';

// 멜라토닌 — 죽어도 그 자리에서 다시 이어 달리는 부활 아이템
const PillThumb = () => (
  <div className="pill-thumb">
    <svg viewBox="0 0 64 64" width="72" height="72">
      <g transform="rotate(-35 32 32)">
        <rect x="14" y="22" width="36" height="20" rx="10" fill="#9FD8FF" stroke="#2B2D5C" strokeWidth="3.5" />
        <path d="M32 22 L32 42" stroke="#2B2D5C" strokeWidth="3" />
        <path d="M14 32 a10 10 0 0 1 10 -10 h8 v20 h-8 a10 10 0 0 1 -10 -10 Z" fill="#FFF3D6" stroke="#2B2D5C" strokeWidth="3.5" />
      </g>
      <text x="32" y="58" textAnchor="middle" fontSize="11" fill="#2B2D5C" fontFamily="Jua, sans-serif">z z Z</text>
    </svg>
  </div>
);

const HammerThumb = () => (
  <div className="hammer-thumb">
    <svg viewBox="0 0 64 64" width="72" height="72">
      <rect x="10" y="8" width="44" height="22" rx="8" fill="#FF8FB0" stroke="#2B2D5C" strokeWidth="3.5" />
      <line x1="21" y1="13" x2="21" y2="25" stroke="#2B2D5C" strokeWidth="2.6" />
      <line x1="43" y1="13" x2="43" y2="25" stroke="#2B2D5C" strokeWidth="2.6" />
      <rect x="28" y="28" width="8" height="30" rx="4" fill="#FFF3D6" stroke="#2B2D5C" strokeWidth="3.5" />
    </svg>
  </div>
);

export default function Shop({ game, onBuy, onBuyHammer, onBuyMelatonin, onClose }) {
  const [denied, setDenied] = useState(null); // 코인 부족 → 흔들기
  const skins = getManifest().skins;
  const hammerOwned = game.hammers > 0;

  const handleClick = (skin) => {
    const ok = onBuy(skin.key);
    if (!ok) {
      setDenied(null);
      requestAnimationFrame(() => setDenied(skin.key));
    }
  };

  const handleHammer = () => {
    if (hammerOwned) return; // 중복구매 X
    const ok = onBuyHammer();
    if (!ok) {
      setDenied(null);
      requestAnimationFrame(() => setDenied('__hammer'));
    }
  };

  const handleMelatonin = () => {
    const ok = onBuyMelatonin();   // 여러 개 구매 가능
    if (!ok) {
      setDenied(null);
      requestAnimationFrame(() => setDenied('__melatonin'));
    }
  };

  return (
    <div id="shop" onClick={(e) => e.target.id === 'shop' && onClose()}>
      <div id="shop-panel">
        <div id="shop-head">
          <h2>키구루미 상점</h2>
          <div id="shop-wallet">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                d="M12 2 L14.6 8.2 L21.5 8.8 L16.3 13.2 L17.9 20 L12 16.4 L6.1 20 L7.7 13.2 L2.5 8.8 L9.4 8.2 Z"
                fill="#FFE28A" stroke="#2B2D5C" strokeWidth="1.6" strokeLinejoin="round"
              />
            </svg>
            <span id="shop-coins">{game.coins}</span>
          </div>
          <button id="shop-close" onClick={onClose}>✕</button>
        </div>

        <div id="shop-grid">
          {/* 부활 아이템: 멜라토닌 (여러 개 구매 가능) */}
          <div
            className={`shop-item pill-item${game.melatonin > 0 ? ' equipped' : ''}${denied === '__melatonin' ? ' denied' : ''}`}
            onClick={handleMelatonin}
            onAnimationEnd={() => denied === '__melatonin' && setDenied(null)}
          >
            <div className="no">아이템</div>
            <PillThumb />
            <div className="name">멜라토닌</div>
            <div className="tag">죽어도 그 자리에서 부활 · 한 판에 2번까지</div>
            <div className={`price${game.coins < MELATONIN.price ? ' locked' : ''}`}>⭐ {MELATONIN.price}</div>
            {game.melatonin > 0 && <div className="own-badge">보유 {game.melatonin}개</div>}
          </div>

          {/* 긴급 아이템: 뽕망치 (1개만 보유, 중복구매 X) */}
          <div
            className={`shop-item hammer-item${hammerOwned ? ' equipped' : ''}${denied === '__hammer' ? ' denied' : ''}`}
            onClick={handleHammer}
            onAnimationEnd={() => denied === '__hammer' && setDenied(null)}
          >
            <div className="no">아이템</div>
            <HammerThumb />
            <div className="name">뽕망치</div>
            <div className="tag">위급할 때 앞 장애물을 부숴요 · H</div>
            {hammerOwned ? (
              <div className="price owned">보유중 · 1개</div>
            ) : (
              <div className={`price${game.coins < HAMMER.price ? ' locked' : ''}`}>⭐ {HAMMER.price}</div>
            )}
          </div>

          {skins.map((skin, i) => {
            const owned = game.owned.includes(skin.key);
            const equipped = game.equipped === skin.key;
            const classes = ['shop-item'];
            if (equipped) classes.push('equipped');
            if (denied === skin.key) classes.push('denied');

            return (
              <div
                key={skin.key}
                className={classes.join(' ')}
                onClick={() => handleClick(skin)}
                onAnimationEnd={() => denied === skin.key && setDenied(null)}
              >
                <div className="no">No.{String(i + 1).padStart(2, '0')}</div>
                <SkinCanvas skin={skin} />
                <div className="name">{skin.name}</div>
                <div className="tag">{skin.tag || ''}</div>
                {equipped ? (
                  <div className="price equipped-label">장착중</div>
                ) : owned ? (
                  <div className="price owned">보유중 · 장착</div>
                ) : (
                  <div className={`price${game.coins < skin.price ? ' locked' : ''}`}>⭐ {skin.price}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
