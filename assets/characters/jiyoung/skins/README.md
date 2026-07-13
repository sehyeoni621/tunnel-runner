# 에셋 넣는 곳 (이미지 교체 가이드)

코드는 `manifest.json`만 참조합니다 (데이터 주도). 아래 규격대로 PNG를 넣으면
**코드 수정 없이** 벡터 렌더러 대신 스프라이트 시트가 자동 사용됩니다.

## 경로

| 파일 | 경로 |
|---|---|
| 지영 기본 시트 | `assets/characters/jiyoung/base_sheet.png` |
| 스킨 시트 12종 | `assets/characters/jiyoung/skins/{key}_sheet.png` (bear, rabbit, cat, dog, chick, pony, penguin, shark, walrus, dino, giraffe, unicorn) |

## 규격 (기획서 2절)

- 1024×1024px, 256px 4×4 그리드, 배경 투명(PNG-24)
- 발바닥 중앙 하단 앵커, 모든 프레임 발 위치 동일
- 프레임 배치 (manifest.json `anims` 기준):
  - 1행: 달리기 1~4
  - 2행: 달리기 5~6 + 점프 상승 + 점프 정점
  - 3행: 점프 낙하 + 넘어짐 2
  - 4행: 잠들기 2 + 여백 2

클로드 디자인 프로젝트(캐릭터 및 스킨 디자인)의 `assets/` 폴더에서
`jiyoung_base_sheet.png` 등을 다운로드해 위 경로에 넣으세요.
경로를 바꾸고 싶으면 `manifest.json`의 `sheet` 값만 수정하면 됩니다.
