# frost-ui

폰과 데스크톱의 떠 있는 UI에 공통 frost 디자인을 적용하고, 폰 패널 모션과 햅틱을 제공하는 플러그인이다. 전역 색상 테마와 일반 카드 꾸밈은 등록하지 않는다.

- BB portal·Radix의 popover·menu·listbox와 명시적으로 선언한 표면을 같은 규칙으로 처리한다. plugin 이름이나 내부 class·입력 이름으로 디자인을 고르지 않는다.
- popover·menu 바깥면은 22px, 지원 브라우저에서는 squircle이다. 목록 항목은 8px 일반 곡선이다. tooltip은 현행 wrapper·직접 표면 기준을 유지한다.
- phone persistent drawer는 좌우·아래 8px의 떠 있는 표면이다. 바깥 곡선은 시작 위치 48px·조절점 14px의 `shape()`를 사용하고, 미지원 환경은 48px squircle 또는 둥근 모서리로 대체한다. 펼친 상태에서도 같은 곡선을 유지한다.
- 겹친 solid 배경은 공통 검색 wrapper와 `data-bb-frost-content`로 선언한 내부 래퍼에서만 제거한다. 선택·눌림·비활성·입력 등 의미 있는 배경은 유지한다.
- 패널과 drawer를 열거나 드래그를 시작할 때 지원 native bridge로 햅틱을 요청한다. 단순 손잡이 접촉, 취소된 동작과 중복 입력을 구분하고 동작 줄이기 설정을 존중한다.
- phone 패널 위치에 따라 채팅 화면의 모서리·그림자·음영을 조정한다. 오른쪽 패널의 탭·이전/다음·파일 선택 등에 햅틱을 더하지만 실제 내비게이션과 탭 전환은 BB가 담당한다.

## 구조와 디자인의 책임

소유 plugin과 Kit는 기기 판정, popup↔drawer 전환, 내용·간격·검색·선택·접근성·닫기·focus를 담당한다. 모바일 drawer의 시각 닫기 X는 소유 plugin에서 생성하지 않는다. Frost가 특정 plugin의 X를 찾아 숨기지 않는다.

Frost는 공통 표면과 phone 모션·햅틱을 담당한다. 직접 만든 popup·tooltip·목록 행과 표면 제외 표식은 [표면 모양 기준](docs/surface-shape-standard.md)을 따른다. Chat UI·Composer·일반 Card는 이번 개별 수정 범위에서 제외하며 기존 phone 표면 소유 인계는 유지한다. Community·삭제된 plugin의 전용 코드와 관찰기는 두지 않는다.

## Phone drawer 동작

내용이 짧으면 그대로 열리고, 소유 plugin이 초기 상한을 선언한 내용 기반 drawer는 그 상한까지 열린다. 기존 고정 높이 drawer의 초기 높이를 바꾸지 않는다. 스크롤이 끝나지 않은 내용의 하단에만 흐림을 표시하고 끝에 도달하면 제거한다.

본문이 스크롤 중이면 먼저 스크롤을 따른다. 별도 제스처를 가진 컨트롤·입력·텍스트 편집·가로 스크롤은 원래 동작을 유지한다. 위 드래그로 내용과 safe area 안에서 확장하고 아래 드래그로 축소·닫는다. 중첩 drawer는 부모 상태를 보존하며, 공통 controller에 연결한 plugin은 pointer와 keyboard 상태를 함께 사용한다. 연결과 fallback은 [controller 계약](docs/drawer-expansion-controller.md)을 따른다.

기기 판정이 phone인 경우에만 패널 위치 추적과 phone 동작을 실행한다. 좁은 desktop을 phone으로 취급하지 않으며 phone의 narrow·넓은 가로 화면 구분을 유지한다. 실제 iPhone touch·OS keyboard·native view는 별도 검증 대상이다.

## 개발과 적용

`npm test`, `npm run typecheck`, `bb plugin build .`로 검증한다. 실제 설치 소스는 `bb plugin source frost-ui --json`으로 확인한다. path 설치의 `dist`는 실행 중인 자산일 수 있으므로 검증 build는 격리 사본에서 수행한다. 적용은 사전 백업과 단독 reload 절차로 검증된 산출물을 옮기며 kit의 `docs/install.md`를 따른다.

표시 이름과 plugin id는 `frost-ui`, package name은 `bb-plugin-frost-ui`다. 검증 커밋·실행 번들·phone·desktop 캡처와 미확인 범위를 함께 보고하며 최종 화면은 사용자가 판단한다.
