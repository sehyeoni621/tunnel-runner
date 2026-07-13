// 밈에 닿으면 화면을 잠깐 가리는 말풍선 (token이 바뀌면 팝 애니메이션 재생)
export default function MemeCover({ meme }) {
  return <div id="meme-cover" key={meme.token}>{meme.text}</div>;
}
