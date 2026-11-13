# 떠 있는 표면 조사 이력

이 문서는 범용 표면 계약 이전의 조사 기록이다. 아래 plugin별 구현·설치 상태와
예외는 당시 관찰이며 현재 제품 계약이 아니다. 현재 적용 범위와 책임은
[표면 모양 기준](surface-shape-standard.md)을 따른다. 삭제·Community 전환한
plugin의 예외와 Handoff 전용 관찰기는 현재 코드에서 제거했다.

범위는 `~/Foundry/bb-plugin`의 저장소 18개와 BB 공통 표면이다. 이 목록은
조사 대상을 고정한 것이며 모든 화면을 검증했다는 뜻이 아니다.

- UI 저장소: `bb-chat-ui`, `bb-plugin-agentation`, `bb-plugin-beacon`,
  `bb-plugin-codes`, `bb-plugin-focus`, `bb-plugin-genui`, `bb-plugin-handoff`,
  `bb-plugin-image`, `bb-plugin-issues`, `bb-plugin-panel-tabs`,
  `bb-plugin-quick-server-switch`, `bb-plugin-frost-ui`, `bb-plugin-tasks`,
  `bb-plugin-vault`, `bb-thread-theme`, `bb-usage`
- 공통 자원: `bb-plugin-kit`. `bb-plugin-apple-speech`는 frontend app을 확인하지 못했다.

| 표면 | 당시 소유와 상태 | 당시 남은 확인 |
|---|---|---|
| 공통 phone drawer | `frost-ui`가 Chat UI 소유를 제외한 바깥 frost와 모션을 제공 | 개별 plugin의 내부 면과 light·dark 화면 |
| Model·Prompt actions | phone dark의 새 스레드에서 frost 외부면과 내부를 확인. 큰 solid wrapper는 관찰되지 않음. Chat UI가 표면을 소유 | light·desktop 및 모든 조건부 상태와 실제 phone 키보드 |
| Permission | 새 스레드 phone dark에서 frost 외부면과 내부를 확인. 큰 solid wrapper는 관찰되지 않음 | light·desktop 및 모든 조건부 상태 |
| Project·Machine popover | host의 이름 붙은 portal에 frost 적용. `cmdk-root.bg-popover` 직접 자식의 중복 solid 제거. 좁은 desktop의 Project drawer도 별도 기기 판정 없이 frost 확인 | 전체 호출처와 실제 light 테마 |
| Project phone drawer | host 공통 drawer 안쪽 Project 검색 wrapper의 중복 solid 제거. phone dark 목록 및 dark/light 빈 검색 결과 확인 | 로딩 상태와 실제 phone 키보드 |
| Machine phone drawer | 새 스레드 phone dark에서 검색 wrapper 투명화 확인. 현재 선택 행의 배경은 상태 표시로 유지 | light·빈·로딩 상태와 실제 phone 키보드 |
| Codes Workspace | phone dark 공통 drawer는 frost, 내부 wrapper 투명. desktop dark에서 실행 중인 frost 확인 | light 화면과 다른 Workspace 상태 |
| Issues Filter | phone dark 공통 drawer는 frost, 내부 wrapper 투명. desktop dark에서 실행 중인 frost 확인 | light 화면과 다른 filter 상태 |
| Issues New issue | phone dark는 기존 drawer frost. desktop은 Issues portal 안의 `Issue title`과 `Due date` 입력을 함께 확인해 바깥면만 frost 적용 | 실제 light 테마·다른 상태·실제 iPhone |
| Vault Graph 사용법 | phone·desktop dark에서 실행 중인 frost 확인 | light 화면과 실제 기기 가독성 |
| Focus 편집 | phone dark 공통 drawer는 frost. desktop dark dialog는 고유 input으로 식별해 실행 중인 frost 확인 | light·상태별 화면 |
| Handoff 프로젝트 | 열린 Project combobox의 `aria-controls`로 연결된 listbox만 frost 적용. phone·desktop dark 실제 BB의 실행 번들 확인 | 실제 light 테마와 실제 iPhone |
| Usage·Beacon | phone·desktop dark에서 이미 frost | light 실제 테마와 다른 상태 |
| BB footer More·기본 tooltip | desktop에서 실제 More menu와 Provider usage tooltip 확인. BB 기본 menu·tooltip 표면에 frost 적용 | 다른 호출처와 실제 light 테마 |
| Agentation | phone·desktop 빈 화면만 확인 | toolbar 비활성으로 dialog·menu 미확인 |
| Panel Tabs·Thread Theme filter | phone·desktop dark에서 기존 frost 확인 | light 및 다른 상태 |
| Thread Theme actions | desktop의 `Thread actions` menu에 실행 중인 frost 확인, separator는 유지 | phone context menu·실제 light 테마 |
| BB 텍스트 선택 메뉴 | desktop 실제 채팅 선택 메뉴의 portal과 `Add to chat` 아이콘으로 식별해 바깥면에 frost 적용 | 다른 action만 있는 메뉴, 실제 phone의 텍스트 선택 |
| Thread Theme 스레드 상세 tooltip | desktop 실제 tooltip의 고유 id로 식별해 frost 적용 | phone·실제 light 테마 |
| BB 오류 toast | 실제 BB의 일반 Sonner error toast를 확인. 바깥면만 frost 적용하고 오류 아이콘·테두리는 유지 | rich-color 및 custom 오류 toast, inline 오류, 실제 phone |
| GenUI 이미지 미리보기 | phone·desktop의 어두운 전체 화면은 이미지 감상용으로 유지 | reference 상세 dialog |
| Image 미리보기 | 기존 image directive를 찾지 못해 열지 못함 | phone·desktop 실제 화면 |
| Tooltip | plugin별 별도 스타일. 일부 primary 배경은 정보 대비를 담당 | 용도별 소유자와 실제 화면 |
| Menu·select·dialog | 공통 portal과 plugin별 구현이 혼재 | 각 호출처의 소유자와 안쪽 solid 배경 |
| 독자 sheet·floating card | Vault, Panel Tabs 등 plugin이 소유 | 화면별 DOM·스타일·캡처 |
| iframe·native view | 별도 렌더링 경계 | frost 적용 가능 여부와 실제 기기 |

선택·hover·disabled·입력·코드·sticky heading은 의미와 가독성을 확인하기
전에는 투명화하지 않는다. `data-bb-portaled-overlay`나 `role`만으로 전체
표면을 대상으로 삼지 않는다. 이 표의 미확인 항목은 전수 검수 완료가 아니다.

모서리 기본값과 적용·미적용 범위는 [표면 모양 기준](surface-shape-standard.md)에
기록한다. Chat UI 정보 카드와 자체 frost를 가진 일부 plugin 표면은 별도 소유이며,
이번 공통 squircle 적용에서 빠져 있다. 화면별 확인 전까지 적용 완료로 보지 않는다.

## 당시 Handoff Project 선택기 조사

새 스레드 화면에서 `Continue a session from another agent` → `Browse recent
sessions` → `Project`를 열어 desktop dark DOM을 확인했다. Handoff의 열린
`[role="combobox"][aria-label="Project"]`가 가진 `aria-controls`로 같은
문서의 `id`를 조회하면 `[data-bb-plugin="handoff"][role="listbox"]`에
연결된다. 조회한 listbox의 바깥면은 solid이며 blur가 없었다.

이 연결을 읽어 Project listbox를 좁게 구분한다. listbox 자체에는
Project 전용 표식이 없어 role과 plugin id만 쓰면 다른 Handoff 선택기도
대상에 들어간다. id는 동적으로 생기므로 고정 선택자로 쓰지 않는다.
연결된 열린 listbox에만 임시 표식을 붙이고 닫힘·제거·해제 때 지운다.
phone emulation에서 listbox의 접근과 실행 중인 frost를 확인했다. 같은 화면의
Machine listbox에는 표식이 붙지 않았다. 실제 iPhone과
여러 선택기 동시 열림의 실제 화면은 확인하지 못했다.

18개 저장소의 소스 목록과 검색은 완료했다. 저장소별 모든 조건부 화면,
실제 light 테마, loading·empty 상태와 실제 iPhone 검수는 완료하지 않았다.
