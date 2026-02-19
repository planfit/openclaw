# Planfit OpenClaw Fork 분석 보고서

> **분석 기준**: upstream `openclaw/openclaw` main 브랜치 대비 `planfit/openclaw` fork의 차이점
> **Fork 분기점**: `53fd26a96` (2026-02-10)
> **총 Fork 커밋 수**: 184개
> **Upstream 이후 커밋 수**: 5,095개 (아직 머지되지 않은 upstream 변경)

---

## 1. Fork에서 수행한 작업 전체 요약

### 1.1 채널 정리 (Slack/Telegram만 유지) — 13개 커밋

Slack과 Telegram을 제외한 17개 채널(WhatsApp, Discord, Matrix, Nostr, BlueBubbles 등)을 전면 삭제하는 대규모 리팩토링.

| 커밋                    | 내용                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `81fea84cc`             | core registry와 type system에서 비-Slack/Telegram 채널 제거 |
| `6d55dc1a4`             | 채널 docks, group mentions, outbound routing 제거           |
| `d432e2e07`             | 17개 채널 소스 디렉토리 및 플러그인 파일 삭제               |
| `fa4f09378`             | 17개 채널 extension 디렉토리 삭제                           |
| `afc3c528b`             | UI views, types, docs에서 제거된 채널 정리                  |
| `c2844ce72`             | dependencies, legacy config, runtime 정리                   |
| `8aa187d6e`             | 제거에 따른 테스트 mock 수정                                |
| `095e7fe46`             | 깨진 테스트 복구                                            |
| `770d514d9`             | lint 에러 해결                                              |
| `e7602300c`             | 나머지 참조 및 테스트 업데이트                              |
| `f6aa0eda1`             | type definitions, Zod schemas 정리                          |
| `9fa9780a5`             | runtime dead code 제거                                      |
| `c82d8bee1`             | string literals, metadata 정리                              |
| `1335fb676`             | proactive InboundHistory injection 제거 및 잔여 코드 정리   |
| `31b70b18e`             | 제거된 채널 test stubs 정리                                 |
| `8aa187d6e`/`8f27e9916` | 관련 UI 빌드 오류 수정                                      |

### 1.2 Claude Code / Agent SDK 통합 — 23개 커밋

OpenClaw를 Claude Code Agent SDK와 통합하는 핵심 피처.

| 커밋          | 내용                                                            |
| ------------- | --------------------------------------------------------------- |
| `32ce1ae8f`   | Claude Agent SDK integration 초기 추가                          |
| `c6f7e254b`   | subprocess 실행을 Claude Agent SDK로 교체                       |
| `30d37d352`   | SDK agent path에서 CLAUDE.md, settings 로딩 지원                |
| `74f252613`   | SDK 이벤트 로깅 (tool progress, hooks, init)                    |
| `b3944a7fc`   | Claude Code를 AgentTool로 추가 (proxy→tool 전환)                |
| `17ac4aa18`   | plan mode와 3-tier 권한 제어 추가                               |
| `873e9bdbb`   | workFolder 파라미터로 동적 cwd override                         |
| `45fccaab6`   | multi-session 구분을 위한 label 추가                            |
| `c9a2f266d`   | 중복 tool summary relay 스킵                                    |
| `c859671bc`   | Slack에서 subagent claude_code 실행 progress indicator          |
| `080ea0e1a`   | Slack relay에서 claude_code 내부 tool summary 억제              |
| `0ec8fa311`   | claude_code 내부 tool event에 file path 포함                    |
| `f47f36b8d`   | claude_code 내부 tool event를 subagent-progress로 전파          |
| `aacd8327a`   | subagent-progress 누락 tool event 해결                          |
| `fb070d0ff`   | SDK의 stale assistant usage로 인한 double compaction 방지       |
| `70c317445`   | stale SDK usage data의 spurious double compaction 취소          |
| `12888567c`   | SDK Zod validation 비호환으로 canUseTool 비활성화               |
| `7e4305140`   | resume 모드에서 SDK ZodError 방지를 위한 bypassPermissions 사용 |
| `485eb92fe`   | plan mode content에 sessionId 포함                              |
| `7d4f6e062`   | plan mode result에 assistant text 캡처                          |
| 디버그 커밋들 | SDK 초기화 지연(5-7분) 진단을 위한 로깅 추가                    |

### 1.3 Cron/스케줄링 시스템 강화 — 18개 커밋

| 커밋        | 내용                                                 |
| ----------- | ---------------------------------------------------- |
| `103a9a774` | CronDelivery.threadId, CronJob.targetSessionKey 추가 |
| `6bfdca8ba` | 스케줄된 작업의 기본 stagger 제어 추가               |
| `97f97af2e` | webhook POST delivery를 announce에서 분리            |
| `c95c0232b` | firing second 내 완료 시 spin loop 방지              |
| `1b1361f24` | 실행 별 model/token 사용량 로깅 + 리포트 스크립트    |
| `3e8009d85` | usage telemetry를 run log에 유지                     |
| `0d10ad699` | cron session key routing 정렬                        |
| `0ef1a1f96` | isolated session에서 agent bindings의 accountId 해결 |
| `3588022e5` | agent가 primary를 override할 때 model fallback 보존  |
| `69bb4cf69` | webhook/cron session에 기존 sessionId 재사용         |
| `51771817e` | cron announce routing 및 timeout 처리 수정           |
| `d96df55ba` | due jobs를 순차가 아닌 동시 실행으로 변경            |
| `1ba67d374` | 동시 실행 작업의 nextRunAtMs에 통합 batch time 사용  |
| `0eb1f1f24` | 동시 실행 작업의 anchorMs drift 방지                 |
| `12b2057ae` | tolerance window 내 작업의 함께 실행 허용            |
| `d1ba05283` | skipped cron jobs에서 deleteAfterRun 준수            |
| `a752217fc` | 동시 실행 디버그 로깅 추가                           |
| `d308e92da` | announce subagent의 NO_REPLY 방지                    |

### 1.4 Slack 기능 개선 — 19개 커밋

#### 네이티브 스트리밍 지원 (핵심 기능)

| 커밋        | 내용                                                 |
| ----------- | ---------------------------------------------------- |
| `de1c20912` | **네이티브 텍스트 스트리밍 지원 추가**               |
| `64e6679ef` | draft message 업데이트를 통한 partial reply 스트리밍 |
| `953b904b5` | 설정 가능한 stream modes 추가                        |
| `4adf2a10d` | 스트리밍 파이프라인을 dispatch에 통합                |
| `456340291` | 스트리밍 Zod schema 및 유닛 테스트 추가              |
| `584072890` | 스트리밍 중 block replies를 일반 메시지로 전달       |
| `01c32bb68` | chat.startStream에 recipient_team_id/user_id 전달    |
| `8dcfdbecb` | 스트리밍 routing/tests 후속 수정                     |

#### Reactions & UX

| 커밋        | 내용                                                   |
| ----------- | ------------------------------------------------------ |
| `fffbc2824` | unicode 대신 Slack emoji 이름 사용                     |
| `2514aa764` | channelId에서 channel: prefix 제거                     |
| `a03a1228b` | 정확한 NO_REPLY 감지 및 silent reply 시 즉시 ack 제거  |
| `7b43b7ad0` | followup drain 후 queued messages의 ack reactions 제거 |

#### Thread & History

| 커밋        | 내용                                                           |
| ----------- | -------------------------------------------------------------- |
| `75e9f9e20` | **새 thread session에 Slack API로 thread history 가져오기**    |
| `9507c1b4d` | queue drain routing에서 Slack string thread_ts 처리            |
| `c7e0cec8d` | extension slack outbound plugin에서 threadId→threadTs fallback |
| `60eeae571` | historyScope "first-only"에서 후속 메시지 chat history 억제    |

#### Forwarded Messages & Misc

| 커밋        | 내용                                                       |
| ----------- | ---------------------------------------------------------- |
| `5e044a305` | 전달된 메시지 attachments에서 text/media 추출              |
| `9acdbccd0` | Slack dispatcher path에 natural pacing fallback 적용       |
| `c859671bc` | subagent claude_code 실행 시 Slack progress indicator 표시 |

### 1.5 Telegram 기능 개선 — 18개 커밋

#### 스트리밍 관련

| 커밋        | 내용                                                         |
| ----------- | ------------------------------------------------------------ |
| `c294717fd` | in-place stream replies (중복 최종 전송 없이)                |
| `7d12d1e1f` | stream preview가 제자리에서 최종 완료                        |
| `8890b9d10` | streamMode off일 때 block streaming이 메시지 분할하지 않도록 |
| `db310eb28` | partial stream mode에서 중복 preview bubbles 방지            |
| `bb70b879f` | replyToMode 켜졌을 때 draft stream preview 스레딩 수정       |

#### 기능 추가

| 커밋        | 내용                                                           |
| ----------- | -------------------------------------------------------------- |
| `bdd2eb0ff` | **사용자 메시지 reactions 수신 및 표면화**                     |
| `dccc9c59c` | **인라인 버튼 스타일 지원**                                    |
| `049529abc` | sendPollTelegram을 채널 action handler에 연결                  |
| `b3d665031` | blockquotes를 네이티브 `<blockquote>` 태그로 렌더링            |
| `8151cebef` | **DM에서 음성 메모 전사(transcription) 활성화 + CLI fallback** |

#### 버그 수정

| 커밋        | 내용                                                  |
| ----------- | ----------------------------------------------------- |
| `61de93413` | channels remove --delete 시 update offset 정리        |
| `541334ca5` | DM topic thread id를 replies에 포함                   |
| `f37872b1c` | non-abort slash 명령이 chat replies와 race하지 않도록 |
| `6cc49d32d` | Telegram API용 native command names sanitize          |
| `158c10b08` | Node.js 22+에서 autoSelectFamily 기본 활성화          |
| `8f27e9916` | 큰 파일 getFile 에러 graceful 처리                    |
| `d4897c890` | model picker editMessageText에서 no-text 메시지 처리  |

### 1.6 보안 개선 — 3개 커밋

| 커밋        | 내용                                                              |
| ----------- | ----------------------------------------------------------------- |
| `5ce5a306c` | **OC-09: 환경 변수 인젝션을 통한 credential theft 수정**          |
| `68a31028c` | include confinement edge cases 강화                               |
| `f4460e5db` | subagent read-tool overflow guards 및 sticky reply threading 강화 |

### 1.7 전체적인 기능/안정성 개선 — 나머지 커밋

#### 컨텍스트/메모리/컴팩션

| 커밋        | 내용                                                                   |
| ----------- | ---------------------------------------------------------------------- |
| `6a46ccd7d` | 컴팩션 instruction에 active workflow state 주입                        |
| `e3dbb4622` | stale tokens 컴팩션 cycle 방지 (race condition)                        |
| `e394fd2b1` | cache-ttl entry의 guard bypass로 인한 double compaction 방지           |
| `8cd258c7b` | stale totalTokens → memory flush → auto-compaction 무한 루프 차단      |
| `a9bd99352` | memory flush를 temp session file로 분리, compaction에 memory refs 추가 |
| `f3916333f` | compaction status messages 즉시 전달 + followup pacing                 |
| `276f4c269` | /new 이후 rotated transcript fallback                                  |
| `a21c48754` | claude-opus-4-6 contextWindow을 200K로 설정 (beta header 없을 때)      |

#### 모델 지원

| 커밋        | 내용                                                             |
| ----------- | ---------------------------------------------------------------- |
| `17f342cc1` | Anthropic Sonnet 4.6 모델 지원                                   |
| `bfa8d3c60` | Anthropic 1M context beta header 지원                            |
| `b48ab77e7` | Opus 4.6 forward-compat + thinking signature sanitization bypass |
| `a4a84f063` | Sonnet 4.6, Opus 4.6 setup-token 모델 테스트                     |

#### Gateway/Session 안정성

| 커밋        | 내용                                                     |
| ----------- | -------------------------------------------------------- |
| `72c2d68ce` | restart 전 active turns drain으로 메시지 손실 방지       |
| `92d345221` | WebSocket max payload를 5MB로 증가 (이미지 업로드용)     |
| `cfd5cfcef` | stale session lock 해제 + hung API call 감시             |
| `7f03e5c2f` | atomic session store writes로 Windows 컨텍스트 손실 방지 |
| `99f6f2725` | gateway agent handler에서 sessionFile 보존               |
| `4325fcdbb` | chat.history payload 크기 제한                           |
| `fe463c091` | stale threadId가 non-thread session에 누출 방지          |

#### Subagent/라우팅

| 커밋        | 내용                                                            |
| ----------- | --------------------------------------------------------------- |
| `63741847b` | `/subagents spawn` 커맨드 추가                                  |
| `d676291b1` | `/subagents spawn`에 group context 전달                         |
| `338abf8b0` | executor subagent 실시간 progress reporting                     |
| `f25d2b46e` | subagent spawn에 timeout=0 (무제한) 허용                        |
| `cd5af233e` | SessionsPatchParamsSchema에 spawnDepth 추가                     |
| `4819ac21a` | stall detection (3분 timeout) + progress report에 last activity |
| `4a3447c52` | 메시지 끝에서 NO_REPLY 감지 (정확 매칭 대신)                    |

#### UX/Pacing

| 커밋        | 내용                                                     |
| ----------- | -------------------------------------------------------- |
| `153011a4a` | 외부 채널 block payload routing에 humanDelay pacing 추가 |
| `b2a51093c` | 메인 agent 최종 payload routing에 humanDelay pacing 추가 |
| `245ddc04f` | 외부 채널 routing에 natural pacing fallback 적용         |

#### 기타

| 커밋        | 내용                                                               |
| ----------- | ------------------------------------------------------------------ |
| `7b26c8ad9` | before_agent_start hook에 modelOverride/providerOverride 추가      |
| `57d768944` | Docker 이미지에 Chromium + Xvfb 선택적 설치                        |
| `56220ad2d` | FTS 모드용 LLM 기반 query expansion                                |
| `1b93d3ee6` | embedding provider 없을 때 FTS fallback 활성화                     |
| `06e8fc710` | FTS query builder에서 unicode token 지원                           |
| `5e7c0201e` | graceful process tree termination (SIGTERM → SIGKILL)              |
| `a90c2bf02` | token usage reporting에서 last-turn total 분리                     |
| `ee32565cf` | trusted metadata에 inbound message identifiers 노출                |
| `10822cbb0` | trusted system metadata에 sender_id 노출                           |
| `689ac58be` | replyToModeByChatType을 자동 agent 응답에 적용                     |
| `638571932` | config provider type 변경 시 stale session providerOverride 무효화 |
| `e44497531` | Read/Write/Edit path display에 file_path fallback 추가             |
| `cb7521a9e` | tool results에서 MEDIA: token parsing을 line start로 제한          |

---

## 2. 카테고리별 정리

### 채널 제거 (제외 대상) — 약 15개 커밋

Slack과 Telegram만 남기고 WhatsApp, Discord, Matrix, Nostr, BlueBubbles, Twilio, LINE, WeChat 등 17개 채널을 제거한 작업. **이 문서에서는 상세 분석 대상에서 제외.**

### 보안 개선 — 3개 커밋

1. **OC-09 환경 변수 인젝션** (`5ce5a306c`): 환경 변수를 통한 credential 탈취 취약점 수정
2. **Include confinement** (`68a31028c`): 파일 include 경계 조건 강화
3. **Subagent read-tool overflow** (`f4460e5db`): read-tool overflow guard 강화, sticky reply threading 보안

### 전체적인 기능 개선 — 핵심 항목

1. **Claude Code Agent SDK 통합** (23개 커밋): subprocess에서 SDK 기반으로 전환, plan mode, 3-tier 권한, progress reporting
2. **Cron 동시 실행** (18개 커밋): 순차→동시 실행, stagger 제어, usage telemetry, session routing
3. **컴팩션 안정성** (8개 커밋): double compaction, 무한 루프, race condition 등 다수의 컴팩션 버그 수정
4. **Gateway 안정성** (6개 커밋): 메시지 손실 방지, session lock, payload 크기 제한
5. **모델 지원** (4개 커밋): Sonnet/Opus 4.6, 1M context beta header
6. **Subagent 개선** (7개 커밋): spawn 커맨드, progress reporting, stall detection

### Slack 기능 개선 — 핵심 항목

1. **네이티브 스트리밍** (8개 커밋): 실시간 텍스트 스트리밍, draft message 업데이트, 설정 가능한 stream modes
2. **Thread history** (4개 커밋): Slack API에서 thread history 가져오기, historyScope 지원
3. **Reactions** (3개 커밋): emoji 이름 사용, 정확한 NO_REPLY 감지, ack 관리
4. **Claude Code 통합** (3개 커밋): progress indicator, tool summary 관리
5. **Forwarded messages** (1개 커밋): 전달 메시지에서 text/media 추출

### Telegram 기능 개선 — 핵심 항목

1. **스트리밍 안정화** (5개 커밋): in-place replies, 중복 방지, thread 모드 호환성
2. **새 기능** (4개 커밋): reactions 수신, 인라인 버튼, 투표, blockquote 렌더링
3. **음성 메모** (1개 커밋): DM에서 음성 전사 활성화
4. **버그 수정** (7개 커밋): thread id, slash command race, 큰 파일 처리, Node.js 22+ 호환

---

## 3. Upstream에서 아직 가져오지 않은 주요 변경 (참고)

Upstream에는 fork 분기 이후 **5,095개 커밋**이 추가되었으며, 주요 내용은:

- 보안 감사 커버리지 업그레이드 시리즈
- Secrets 관리 시스템 (8개 PR 시리즈)
- UI dashboard v2
- Client-side security
- 다수의 dead code 정리
- Volcengine 지원
- Session path rollup

> ⚠️ upstream 머지 시 채널 제거와의 충돌이 예상됨

---

_생성일: 2026-02-24_
_분석 도구: git log, git diff, git merge-base_
