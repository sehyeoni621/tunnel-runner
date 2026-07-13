import { useState } from 'react';
import { getManifest } from '../game/assets.js';
import SkinCanvas from './SkinCanvas.jsx';

export default function Shop({ game, onBuy, onClose }) {
  const [denied, setDenied] = useState(null); // 코인 부족 → 흔들기
  const skins = getManifest().skins;

  const handleClick = (skin) => {
    const ok = onBuy(skin.key);
    if (!ok) {
      setDenied(null);
      requestAnimationFrame(() => setDenied(skin.key));
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
