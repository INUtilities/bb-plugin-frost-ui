# frost-ui 표면 모양 기준

표면의 색·blur·곡률 값은 frost-ui가 소유한다. Kit는 기기 판정과 표준
컴포넌트의 구조·동작을 소유한다. 새로운 표면은 실제 DOM과 의미를 확인한 뒤
공통 primitive 또는 아래의 명시 표식으로 연결한다. plugin 이름으로 식별하지 않는다.

| 표면 | 지원 브라우저 기본 모양 | 미지원 시 | 현재 범위 |
|---|---|---|---|
| 공통 popover·menu·dialog 바깥면 | `22px`, `corner-shape: squircle` | `22px` 둥근 모서리 | 공통 portal·Radix 표식이 있는 대상. 부모 메뉴와 하위 메뉴에 같은 값을 사용한다. 카드는 이번 범위에서 제외한다. |
| tooltip 바깥면 | 공통 wrapper는 `38px` squircle, 명시한 직접 tooltip은 `18px` squircle. 기존 BB tooltip은 현행 유지 | 공통 wrapper·직접 tooltip은 `18px` 둥근 모서리, 기존 BB tooltip은 현행 유지 | 접근성 텍스트용 자식과 실제 바깥 표면을 구분한다. |
| phone 공통 drawer | 시작 위치 `48px`, 곡선 조절점 `14px`인 `shape()` 곡선. 펼친 상태에서도 유지 | `shape()` 미지원 시 squircle 또는 `48px` 둥근 모서리 | 공통 persistent drawer. `shape()`는 그림자를 자를 수 있고 실제 iPhone 화면·터치 검증 필요 |
| 목록의 hover·선택 행 | `12px` 둥근 모서리 | `12px` 둥근 모서리 | 공통 menu·listbox 역할과 `data-bb-frost-item`으로 선언한 목록 행 |
| 일반 버튼·입력·강조 면 | 기존 크기와 상태 유지 | 기존 값 | 목록 항목으로 식별되지 않은 요소에는 적용하지 않음 |

색상과 한 겹의 frost는 kit 디자인 기준을 따른다. 메뉴 안의 submenu가
잘리지 않도록 별도 배경 pseudo-element를 쓰는 경우 바깥면의 모양을
상속한다. 기존 의미별 색, 선택·hover·disabled 면은 보존한다. 목록 행은
표면별 별도 값 대신 공통 규칙을 쓰고, 높이가 작으면 브라우저가 모서리를
크기에 맞게 제한한다. 색·패딩·focus 표시·클릭 영역은 변경하지 않는다.
글자·행 높이·안쪽 간격은 Command 목록도 Kit 기준과 소유 컴포넌트가 제공한다.
Frost는 이 값을 전역으로 덮지 않으며 선택 상태의 배경은 유지한다.

## 공통 표면 표식

기본 BB portal·Radix popover는 기존 의미와 구조로 식별한다. 직접 만든
표면은 아래 표식을 사용할 수 있다. 이 표식은 디자인만 제공하며 ARIA 역할,
키보드 탐색, 이벤트, 기기 판정이나 열기·닫기를 대신 구현하지 않는다.

| 표식 | 적용 위치와 조건 | 결과 |
|---|---|---|
| `data-bb-frost-surface="popover"` | 실제 떠 있는 표면의 `role="dialog"`, `menu`, `listbox` 요소 | 기존 공통 22px, 지원 시 squircle. 이름이나 plugin id로 식별하지 않음 |
| `data-bb-frost-surface="tooltip"` | tooltip 바깥 요소 자체가 `role="tooltip"`인 경우 | 기존 직접 tooltip의 18px, 지원 시 squircle 및 공통 blur. 숨겨진 접근성 텍스트만 있는 자식은 표면으로 취급하지 않음 |
| `data-bb-frost-surface="none"` | 이미지·전체 화면 등 Frost 표면을 쓰지 않을 popup·tooltip 요소 | 해당 표면의 Frost 스타일을 적용하지 않음. 안에 별도로 선언한 독립 popup·tooltip은 적용 가능 |
| `data-bb-frost-item` | 공통 popup 또는 phone persistent drawer 안에서 실제 목록 행인 요소 | 12px 일반 곡선. `div`·`button` 모두 가능하며 내부 button을 추가 선택하지 않음 |
| `data-bb-frost-content` | 공통 popup·drawer 안에서 표면 배경만 중복하는 내부 래퍼 | 중복 solid 배경만 투명하게 처리 |

`data-bb-frost-content`를 선택 행이나 입력 자체에 붙이지 않는다. 선택·눌림·
비활성·경고·입력 배경은 의미가 있으므로 유지한다. `data-bb-frost-item`을
일반 button 전체에 붙이거나 디자인을 위해 ARIA 역할을 바꾸지 않는다.

공통 wrapper tooltip의 기존 38px 규칙은 그대로다. 직접 tooltip을 wrapper
tooltip으로 바꾸면 모양이 달라질 수 있으므로 현행 유지 검수 없이 전환하지
않는다. `none`은 popup·tooltip 표면 제외용이며 공통 phone drawer의 높이와
제스처 계약을 끄는 설정은 아니다.

열린 submenu가 Radix wrapper 안에 있는 공통 menu는 부모의 blur를 배경
가상 요소로 분리한다. plugin 소유 여부와 관계없이 부모 밖으로 나온 submenu가
잘리지 않게 하며, 부모와 자식의 22px 곡선을 유지한다. 스크롤하는 menu의
잘림 규칙은 유지한다.

## 책임과 검수 경계

- plugin은 Kit의 기기 판정과 표준 popup↔drawer 컴포넌트를 사용하고, 내용·간격·검색·선택·접근성·focus·닫기 동작을 소유한다. 모바일 drawer의 시각 닫기 X는 소유 plugin에서 생성하지 않는다. Frost가 특정 X를 찾아 숨기지 않는다.
- Frost는 공통 BB portal·Radix 표면, persistent drawer, 명시 표식만으로 디자인을 적용한다. 특정 plugin id·자체 class·입력 이름·tooltip id를 따라 스타일이나 높이를 바꾸지 않는다. BB의 Project·Machine 선택기, 텍스트 선택 메뉴와 오류 toast는 해당 의미를 확인한 host 계약을 유지한다.
- Chat UI·Composer·일반 Card는 이번 개별 수정 범위에서 제외한다. Chat UI의 기존 phone 표면 소유 인계는 유지하며 카드나 컴포저 내부를 새로 일반화하지 않는다. Community plugin과 삭제된 plugin을 위한 전용 코드·관찰기는 두지 않는다. BB 공통 primitive를 사용하는 표면에는 같은 범용 처리가 적용된다.
- iframe·native view와 공통 표식이 없는 별도 표면은 자동으로 Frost 대상으로 확대하지 않는다. 이미지 미리보기·전체 화면의 의미 있는 어두운 배경은 `none`으로 유지한다. 강조·선택·입력 면은 투명한 래퍼와 구분한다.
- 각 소유자의 marker 전환을 실행본에서 먼저 확인한 뒤 기존 예외를 제거한다. 격리 fixture의 곡률·선택색 비교는 실제 plugin의 모든 상태·기기 검수를 대신하지 않는다. 실제 iPhone·OS keyboard·native WebView와 일부 로딩·빈·오류 상태는 별도 확인 대상이다.
