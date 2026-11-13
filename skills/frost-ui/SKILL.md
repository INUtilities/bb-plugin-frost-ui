---
name: frost-ui
description: frost-ui의 떠 있는 표면과 phone 패널 모션·햅틱을 변경하거나 sidebar 설치를 점검할 때 사용한다.
---

# frost-ui

표시 이름은 `frost-ui`, plugin id는 `frost-ui`다. 실제 설치 소스는 `bb plugin source frost-ui --json`으로 확인한다.

## 제품 계약과 경계

- 표면 모양의 현재 기준과 예외는 `docs/surface-shape-standard.md`를 따른다. 공통 popover·menu 바깥면은 22px이며 지원 브라우저에서는 squircle을 쓴다. tooltip과 phone drawer의 별도 기준은 유지한다.
- `app.tsx`는 content script와 기기 브리지를 등록한다. 공통 BB portal·Radix 및 명시적으로 선언한 표면을 식별하며 전역 테마는 등록하지 않는다.
- 직접 만든 표면은 `docs/surface-shape-standard.md`의 `data-bb-frost-surface`·`data-bb-frost-item`·`data-bb-frost-content` 계약을 따른다. ARIA·키보드·기기 판정은 소유 컴포넌트가 유지하고 Frost는 디자인만 적용한다. 삭제되거나 Community로 전환한 plugin을 위해 별도 관찰기를 등록하지 않는다.
- 공통 tooltip과 명시한 직접 tooltip, 확인된 BB 텍스트 선택 메뉴 및 일반 Sonner 오류 toast의 바깥면을 frost로 표시한다. tooltip 현행 반경과 별도 색을 쓰는 오류·다른 알림은 유지한다. 특정 plugin id·class·입력 이름·tooltip id를 지목하지 않는다.
- phone 공통 drawer는 본문을 위로 밀어 최대 높이까지 펼칠 수 있다. 스크롤 가능한 본문을 아래로 밀어 축소하거나 닫지 않으며 handle·기존 바깥 탭·Escape로 조작한다. 실제 최대 높이에서만 내부 세로 스크롤을 허용하고 handle로 줄이면 스크롤한 상태에서도 잠근다. 키보드 inset으로 작아진 동안은 예외다. 화면 밖 항목으로 keyboard focus가 가면 먼저 확장하고 전환 종료 후 해당 항목을 보이게 한다. 실제 닫기·재열기 때 세로 위치를 초기화하며, 중첩 화면의 부모 가림과 키보드 변경은 닫기로 취급하지 않는다. `touch-action: none` 등 자체 제스처·입력·텍스트 편집·가로 스크롤은 유지한다.
- 공통 Vaul bottom drawer의 최대 높이는 화면 높이에서 상단 safe area·8px·keyboard inset을 뺀 값으로 제한한다. 특정 plugin의 별도 높이를 강제하지 않는다. 초기 고정 높이는 유지하며 내부 세로 스크롤은 위의 높이·키보드 규칙을 따른다.
- 모바일 drawer의 시각 닫기 X는 소유 plugin에서 생성하지 않는다. Frost는 plugin 내부 경로로 X를 숨기지 않는다. 키보드 닫기와 접근성 닫기·focus 복귀는 소유 컴포넌트가 유지한다.
- 열린 phone 공통 drawer의 스크롤이 끝에 닿거나 바깥에서 스크롤할 때 뒤쪽 패널로 전달되지 않도록 막는다. drawer 내부에서 가능한 스크롤과 desktop 동작은 유지한다. 공통 drawer 표식이 없는 별도 sheet와 iframe·native view는 별도로 확인한다.
- phone drawer 안에서 아래에 스크롤할 내용이 남은 영역의 끝에만 터치를 가로채지 않는 흐림을 표시한다. 내용이 짧거나 끝에 도달하면 제거하고, drawer 밖과 desktop에는 표시하지 않는다.
- 내용에 맞춰 열리는 drawer는 소유 plugin이 `--bb-drawer-initial-max-height: 66.666dvh`를 지정할 수 있다. 지정하지 않으면 기존 상한을 유지하고, frost가 확장하는 동안 초기 상한을 해제한다. 자체 keyboard 확장을 가진 plugin은 확장 중 값을 `100dvh`로 바꿔 viewport·keyboard 안전 상한을 유지한다.
- drawer를 열 때와 위·아래 드래그가 시작될 때 각각 햅틱을 한 번 요청한다. 단순 handle 접촉·놓기에는 요청하지 않는다. 공통 drawer는 내용이 보이는 높이까지만 확장하고 최대 24px의 임시 overdrag 후 탄력 있게 돌아온다. 아래로 닫는 동작은 유지한다. 목록의 터치 중 배경은 이동·취소 시 해제한다. 닫힐 때 같은 drawer 안의 `aria-controls`로 연결된 펼침 행은 접는다. 중첩 drawer가 열리면 이전 drawer를 아래로 내렸다가 복귀시킨다.
- `lib/sidebar-depth.ts`는 phone 드로어·shelf 위치에 따른 화면 효과와 패널 조작 햅틱을 소유한다. 위치 추적·입력 이벤트 감시는 phone에서만 실행한다.
- `lib/sidebar-chrome.ts`는 기기 상태와 phone gate를 전달한다. narrow phone과 넓은 가로 화면의 기존 구분을 유지한다.
- 패널·탭 전환은 BB가 담당한다. 탭 스와이프 감지는 햅틱을 요청할 뿐 내비게이션을 대신하지 않는다.
- 저장된 배치·플레이스홀더와 활성 페인 강조는 이 플러그인의 범위 밖이다.

## 주의점

- package name `bb-plugin-frost-ui`에서 plugin id `frost-ui`가 결정된다. BB의 sidebar DOM 표식과 내부 동작 식별자는 plugin 이름과 별개다.
- 좁은 desktop 창은 phone이 아니다. kit에서 복사한 `lib/device.ts`, `lib/use-device.ts`는 원본을 따른다.
- native bridge의 `capabilities`에 `haptic`이 있을 때만 햅틱을 요청한다. 연타·취소·두 번째 손가락을 기존 동작과 구분한다.
- Browser native view와 Terminal WebGL을 보호하기 위해 오른쪽 패널이 열린 뒤에는 resting filter·transform을 유지하지 않는다.
- `openMode`·`desktopLayout` 등 예전 설정은 읽지 않는다.

## 확인과 적용

`npm test`, `npm run typecheck`, `bb plugin build .`를 실행한다. phone 가로·세로와 desktop의 대상 표면을 비교하고 desktop·tablet의 패널 위치 추적이 비활성인지 확인한다.

실제 적용 요청에서는 `bb plugin reload frost-ui` 후 설치 경로와 실행 번들 해시를 확인한다. 비활성 플러그인을 임의로 켜지 않는다. phone native haptics와 native Browser·Terminal은 별도 검증 대상이다.

검증 커밋, 실행 번들, desktop·phone 캡처, 미확인을 보고하며 화면 완료는 사용자가 판단한다.
