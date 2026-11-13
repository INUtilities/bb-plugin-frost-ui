# Phone drawer 확장 controller 계약

이 계약은 Frost `df42002`와 Panel Tabs `77c671c`의 실행본에 적용됐으며 이후 변경에서도 유지한다. version `1` 연결을 사용하는 현재 계약이고, 모든 plugin·기기에 대한 안정 API 보장을 뜻하지 않는다.

## 연결과 소유권

열린 phone drawer element에서 bubbling `CustomEvent("bb-frost-drawer-connect", { detail })`를 보낸다. `detail.onClose`는 필수이며, `onState`와 `onDisconnect`는 선택 사항이다. Frost가 해당 drawer 전체의 pointer 높이 조절과 아래 drag 닫기를 소유할 수 있을 때에만 동기적으로 `detail.controller`를 채운다. 응답이 없거나 version이 `1`이 아니면 plugin이 기존 fallback을 유지한다. 연결 전후에 두 controller가 동시에 geometry를 변경하지 않도록 plugin이 자체 pointer·keyboard handler와 inline geometry를 정리한다.

`controller.getState()`는 `{ expanded, canExpand }`를 반환한다. 연결 직후 초기 상태를 읽고, `onState(state)`는 이후 상태 변화만 전달한다. `canExpand`는 접힌 상태에서 펼칠 내용이 있거나, 이미 펼쳐져 있어 다시 접을 수 있음을 뜻한다. `toggle()`은 확장 가능할 때만 펼치고 펼쳐져 있으면 접는다. `disconnect()`는 자발적으로 연결을 해제한다. 해제된 controller의 명령은 무효다. `onClose()`는 아래 drag로 drawer 자체를 닫으라는 요청이며, plugin은 자신의 기존 닫기·focus 복귀 절차를 실행한다.

Frost가 늦게 활성화되거나 상태가 바뀌면 document에 `bb-frost-drawer-availability` event와 `{ version: 1, available }`를 보낸다. Plugin은 열린 해당 drawer에 다시 연결을 시도하고, 강제 해제의 `onDisconnect()`에서는 fallback으로 복귀한다. Phone viewport 변경은 가능한 경우 연결과 확장 상태를 유지하고 크기를 재측정한다. Desktop 전환, drawer 닫기·제거, frost 종료 시 연결을 해제한다.

## 중첩과 콘텐츠

각 연결은 하나의 drawer element에 속한다. `inert` 또는 `aria-hidden`으로 덮인 부모는 명령과 pointer를 받지 않으며, 자식이 닫힐 때까지 확장 상태를 유지한다. 덮개가 해제되면 콘텐츠를 다시 측정한다. 자식의 아래 drag는 자식의 `onClose`만 호출한다. Escape, backdrop과 focus 복귀의 의미는 각 plugin이 소유한다.

짧은 콘텐츠는 불필요하게 펼치지 않는다. 스크롤 콘텐츠의 변경, 이미지·글꼴 load와 크기 변경을 관찰해 상태와 확장 높이를 갱신한다. 펼친 flex 스크롤 영역의 `scrollHeight`가 영역 자체의 높이보다 작아질 수 없을 때는, 이전에 측정한 접힌 높이로 동기 측정한 뒤 원래 inline 스타일과 priority를 복원한다. 이 측정의 실제 화면·성능 영향은 별도 검증한다. 검증되지 않은 내부 `data-bb-mobile-sheet-stage` 값을 plugin의 공개 계약으로 사용하지 않는다.

## 본문 스크롤과 focus

공통 phone drawer의 본문 세로 스크롤은 실제 최대 높이에 도달한 뒤 허용한다. 소유 컴포넌트의 CSS가 확장 목표보다 작은 최대 높이를 지정하면 그 제한을 반영한다. 본문 위 drag는 먼저 확장한다. 아래 drag는 터치 지점의 세로 스크롤 조상 중 하나라도 맨 위가 아니면 내부 스크롤을 우선하며, 모두 맨 위이면 handle과 같은 축소·닫기 동작을 시작한다. 줄이면 현재 스크롤 위치에서 잠그며 실제 닫기·재열기 때 0으로 초기화한다. 키보드 inset 동안에는 본문 drag로 높이를 바꾸지 않고 스크롤을 허용한다. 중첩 화면으로 가려짐이나 키보드 변경은 닫기로 보지 않는다.

접힌 본문 밖 항목으로 keyboard focus 또는 `aria-activedescendant`가 이동하면 잠금을 우회하지 않는다. 먼저 최대 확장하고 전환이 끝난 후 현재 focus 항목을 보이게 한다. 이미 보이는 항목과 덮인 부모는 불필요하게 움직이지 않고, focus가 옮겨갔으면 이전 항목을 다시 스크롤하지 않는다.

열림 애니메이션 중의 native translate는 초기 높이 측정에서 제외한다. 확장 상한은 실제 visual viewport 안으로 제한하여, 화면 아래에서 올라오는 중의 좌표가 최대 높이로 저장되지 않게 한다. 이러한 내부 계산과 스크롤 guard는 public version1 연결의 필드를 늘리지 않는다.

## 확인한 범위와 남은 검증

JSDOM 연결 시험과 실제 React Panel Tabs shell을 사용한 Chrome phone 모사에서 pointer↔keyboard 상태·aria 동기화, nested 취소·Escape·focus 복귀, 긴 콘텐츠 확장과 짧아진 콘텐츠 축소, frost on/off 인계를 확인했다. desktop popup 유지도 확인했다.

실제 iPhone의 물리 touch·OS keyboard inset과 모든 plugin 조합은 미확인이다. 실제 다중 탭·기존 페이지 cache 및 위 동기 측정의 성능 영향도 별도 검증 대상이다. 이 한계를 이유로 연결이 이미 배포됐다는 사실을 미배포 prototype으로 표현하지 않는다.
