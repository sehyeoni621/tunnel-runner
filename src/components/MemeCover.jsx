// 화면을 잠깐 가리는 말풍선 (token이 바뀌면 팝 애니메이션 재생)
// kind: 'meme' = 릴스 밈 / 'younggi' = 영기의 폭언 → 2초간 폭주
export default function MemeCover({ meme }) {
  return (
    <div
      id="meme-cover"
      className={meme.kind === 'younggi' ? 'younggi' : ''}
      key={meme.token}
    >
      {meme.text}
    </div>
  );
}
