# Upstream Cherry-Pick 후보 목록

> **기준**: upstream `openclaw/openclaw` main에 있으나 `planfit/openclaw` fork에 없는 커밋
> **분기점**: `53fd26a96` (2026-02-10) | **이미 cherry-pick된 커밋**: 68개
> **분석일**: 2026-02-24

---

## 우선순위 범례

- **P0 (CRITICAL)**: 보안 취약점, 데이터 손실 방지 — 즉시 적용 권장
- **P1 (HIGH)**: 안정성/버그 수정 — 가능한 빨리 적용
- **P2 (MEDIUM)**: 기능 개선 — 여유 있을 때 적용
- **P3 (LOW)**: 편의/품질 개선 — 선택적 적용

---

## 1. 보안 (P0) — 즉시 적용 권장

### 1.1 Critical 보안 취약점 수정

| 커밋        | 내용                                                                   | 영향도              |
| ----------- | ---------------------------------------------------------------------- | ------------------- |
| `b5f551d71` | **OC-06**: config includes 경로 순회(path traversal) 차단              | 설정 파일 탈취 가능 |
| `084f62102` | **OC-65**: compaction counter reset 방지 → context 소진 제한 우회 차단 | DoS 벡터            |
| `ebcf19746` | **OC-53**: 2MB prompt 크기 제한으로 ACP DoS 방지                       | 메모리 소진         |
| `63e39d7f5` | **OC-53**: prompt size guardrails 강화 (위와 쌍)                       | 메모리 소진         |
| `749e28dec` | **OC-02**: HTTP gateway에서 위험 tool 차단 + ACP auto-approval 수정    | 원격 코드 실행      |
| `ee31cd47b` | **OC-02**: ACP permission + gateway HTTP deny 추가 gap 보완            | 위와 쌍             |
| `3967ece62` | **OC-25**: OAuth state 검증으로 CSRF 공격 방지                         | 인증 우회           |
| `d306fc8ef` | **OC-07**: session history credential 노출 + webhook secret 강제       | 자격증명 유출       |
| `c275932aa` | **OC-22**: skill packaging에서 Zip Slip + symlink following 차단       | 임의 파일 쓰기      |

### 1.2 SSRF 방어

| 커밋        | 내용                                                   |
| ----------- | ------------------------------------------------------ |
| `442fdbf3d` | IPv6 transition 우회를 통한 SSRF 차단                  |
| `d51929ecb` | ISATAP bypass를 통한 SSRF 차단                         |
| `c0c0e0f9a` | full-form IPv4-mapped IPv6 SSRF 차단                   |
| `71bd15bb4` | special-use IPv4 range SSRF 차단                       |
| `26c9b37f5` | strict IPv4 literal SSRF 처리                          |
| `44dfbd23d` | host/ip block 체크 중앙화                              |
| `649826e43` | private/loopback/metadata IP 차단 (link-understanding) |
| `c5406e1d2` | gatewayUrl SSRF 방지                                   |
| `2d5647a80` | tool gatewayUrl override 제한                          |
| `99db4d13e` | cron webhook delivery SSRF 가드                        |
| `5eb72ab76` | browser SSRF 기본값 강화 + legacy key 마이그레이션     |

### 1.3 실행/샌드박스 보안

| 커밋        | 내용                                                  |
| ----------- | ----------------------------------------------------- |
| `0e28e50b4` | 난독화된 명령어의 allowlist 우회 감지                 |
| `3f0b9dbb3` | shell-wrapper line-continuation allowlist 우회 차단   |
| `92cada2ac` | unquoted heredoc body에서 command substitution 차단   |
| `f23da067f` | heredoc allowlist parsing 강화                        |
| `e80c803fa` | system.run에서 shell env allowlist 우회 차단          |
| `c6ee14d60` | grep safe-bin 파일 읽기 우회 차단                     |
| `77b89719d` | safeBins shell expansion 차단                         |
| `c2c7114ed` | HOME/ZDOTDIR env override injection 차단              |
| `2cdbadee1` | startup-file env injection 차단 (모든 host 실행 경로) |
| `fb35635c1` | `execFileSync` 사용 (shell string `execSync` 대체)    |
| `57102cbec` | 임시 파일명에 `crypto.randomBytes` 사용               |
| `c070be1bc` | sandbox fs bridge 경로 및 bind mount 정책 강화        |
| `e7eba01ef` | sandbox container `--no-sandbox` 기본 비활성화        |
| `638853c6d` | sandbox env vars 삭제 후 docker launch                |
| `4a44da7d9` | `apply_patch` workspace containment 기본 적용         |

### 1.4 인증/프로토콜 보안

| 커밋        | 내용                                                          |
| ----------- | ------------------------------------------------------------- |
| `f1e1ad73a` | SHA-256 해시 후 timingSafeEqual (length leak 방지)            |
| `baf4a799a` | YAML core schema로 type coercion 방지                         |
| `9edec67a1` | non-loopback 주소에 plaintext WebSocket 차단                  |
| `e0aaf2d39` | deepMerge에서 prototype-polluting key 차단                    |
| `95dab6e01` | config prototype-key guard 강화                               |
| `fe609c0c7` | webhook template getByPath에서 prototype-chain traversal 차단 |
| `f97c0922e` | account-key에서 prototype pollution 방어                      |
| `30b6eccae` | gateway auth rate-limiting 및 brute-force 방어                |
| `054366dea` | first-time TLS pin에 명시적 신뢰 요구                         |
| `48b3d7096` | device pairing token 생성/검증 강화                           |

### 1.5 기타 보안

| 커밋        | 내용                                                              |
| ----------- | ----------------------------------------------------------------- |
| `f3adf142c` | HTML gallery XSS 방지 (stored XSS)                                |
| `7fab4d128` | OTEL log export에서 민감 데이터 노출 방지 (CWE-532)               |
| `44727dc3a` | web_fetch에서 숨겨진 콘텐츠 제거 (indirect prompt injection 방지) |
| `9c87b53c8` | CLI config get에서 민감 값 노출 차단                              |
| `ee6d0bd32` | exec-approval command preview에서 backtick escape                 |
| `6c4c53581` | Unicode angle bracket homoglyph 콘텐츠 sanitization               |
| `d3aee8449` | skills install에 `--ignore-scripts` 추가                          |
| `f4dd0577b` | hook transform symlink escape 차단                                |
| `4b226b74f` | archive extraction에서 zip symlink escape 차단                    |
| `cf6990701` | Telegram 에러 메시지에서 bot token 노출 차단                      |
| `ba84b1253` | pre-commit hook option injection 방어                             |
| `a7eb0dd9a` | Windows child process spawning 강화                               |

---

## 2. Slack 개선 (P1~P2)

### 2.1 P1 — 버그 수정 (안정성)

| 커밋        | 내용                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `5e73f3344` | thread session fork/history 컨텍스트가 첫 turn 후 유실되는 문제 수정     |
| `9f7c1686b` | extension에서 thread ID가 read + outbound delivery에서 보존 안 되는 문제 |
| `89a1e9981` | replyToMode off일 때 threading 동작 확정                                 |
| `cd7b2814a` | string thread context가 queue + DM route에서 보존 안 되는 문제           |
| `af9881b9c` | user ID를 DM channel로 resolve 후 files.uploadV2 호출                    |
| `d6226355e` | interaction payload 검증 + malformed action 처리                         |
| `67250f059` | attachment extraction을 forwarded share로만 스코프 제한                  |
| `dfd5a7963` | draft final chat.update에 account token 전달                             |
| `c76288bdf` | multi-image 메시지에서 모든 파일 다운로드                                |
| `620cf381f` | Slack channel ID lowercase 하지 않도록                                   |
| `ce1f12ff3` | Zod default groupPolicy가 multi-account config 깨는 문제                 |
| `e2e10b3da` | restart sentinel 알림에서 threadId→replyToId 매핑                        |

### 2.2 P2 — 기능 추가

| 커밋        | 내용                                                               |
| ----------- | ------------------------------------------------------------------ |
| `087edec93` | draft preview cleanup lifecycle                                    |
| `51296e770` | **thread-ownership** 기능 추가                                     |
| `2b9d5e6e3` | thread metadata (thread_ts, parent_user_id)를 agent context에 포함 |
| `b93ad2cd4` | 기존 thread history로 thread session 채우기                        |
| `3696b15ab` | default replyToMode를 "off"→"all"로 변경                           |
| `2aa957046` | @mention으로 시작하는 메시지에서 control commands 감지             |
| `b3b49bed8` | voice messages에서 video/* MIME을 audio/*로 override               |
| `3d921b615` | emoji-list action에 limit 파라미터 적용                            |
| `f19eabee5` | DM slash command 인가 게이트                                       |

---

## 3. Telegram 개선 (P1~P2)

### 3.1 P1 — 버그 수정 (안정성)

| 커밋        | 내용                                                                |
| ----------- | ------------------------------------------------------------------- |
| `e33d7fcd1` | update offset 건너뛰기로 queued updates 유실 방지                   |
| `beb2b74b5` | **모든 streamMode 설정에서 silent message loss 방지**               |
| `8e821a061` | polling offset을 봇별로 스코프 + shared runner stop 대기            |
| `4d0ca7c31` | 처리되지 않은 네트워크 에러 후 stalled polling 재시작               |
| `81384daeb` | polling retry 설정/해체 순서 강화                                   |
| `63b4c500d` | preview stream cross-edit race 방지                                 |
| `8b1fe0d1e` | assistant block별 streaming preview 분리                            |
| `ab256b8ec` | reasoning과 answer draft stream 분리                                |
| `d833dcd73` | cron/heartbeat 메시지가 target topic 대신 잘못된 chat으로 가는 문제 |
| `ace835714` | media group에서 실패한 photo download 시 전체 그룹 드롭 대신 skip   |
| `53adae9ce` | Node 22+에서 fetch 실패 수정 (dnsResultOrder=ipv4first)             |
| `273932850` | undici fetch 에러를 recoverable로 분류하여 retry                    |
| `4f700e96a` | DM last-route metadata 누출 수정                                    |
| `5a475259b` | reasoning off일 때 reasoning-only 내용 누출 억제                    |
| `dddb1bc94` | extended thinking 모델의 streaming 메시지 덮어쓰기 수정             |
| `c1b75ab8e` | reaction 처리 soft-fail + message-id 복원력                         |
| `80abb5ab9` | voice message getFile 네트워크 에러 시 드롭 방지                    |
| `f032ade9c` | webhook timeout 응답 반환으로 retry storm 방지                      |

### 3.2 P2 — 기능 추가

| 커밋        | 내용                                                      |
| ----------- | --------------------------------------------------------- |
| `f42e13c17` | **포럼 토픽 생성 지원**                                   |
| `32d12fcae` | **channel_post 지원** (봇 간 통신)                        |
| `8e5689a84` | sendPoll 지원 (투표 전송)                                 |
| `7cbf607a8` | /compact 명령 네이티브 메뉴 노출                          |
| `5801c4f98` | outbound sanitizer leak 코퍼스 + 문서                     |
| `337eef55d` | forwarded messages에 comments 연결                        |
| `7ffc8f9f7` | 초기 메시지 debounce로 push 알림 개선                     |
| `b65b3c6ff` | voice transcript을 raw audio 대신 body text에 포함        |
| `2fc479b42` | telegram voice transcript body substitution               |
| `2649e9e04` | Telegram 지원 status reaction variant 사전 선택           |
| `1055e71c4` | .md 파일 참조를 backtick으로 auto-wrap (URL preview 방지) |

### 3.3 P2 — 인프라/설정

| 커밋        | 내용                                                        |
| ----------- | ----------------------------------------------------------- |
| `d0e676326` | webhookPort를 config/startup에서 직접 연결                  |
| `5069250fa` | polling 시작 전 webhook state 클리어                        |
| `1a9b5840d` | abort까지 webhook monitor 유지                              |
| `4b40bdb98` | token 변경 시 offset 클리어                                 |
| `e3b432e48` | allowlist auth에 sender id 필수                             |
| `ad96c126e` | default replyToMode를 "first"→"off"로 변경                  |
| `1d01bb1c8` | resolved agent 범위로 default account skill commands 스코프 |
| `11ab1c693` | Telegram 100-command 제한 적용 + 경고                       |

---

## 4. 컴팩션/메모리 (P1)

| 커밋        | 내용                                                           |
| ----------- | -------------------------------------------------------------- |
| `ea47ab29b` | summarization 실패 시 history 자르기 대신 compaction 취소      |
| `01380f49f` | safeguard summaries에 runtime model 전달                       |
| `b703ea367` | compaction "prompt too long" 에러 방지                         |
| `c0cd3c3c0` | session.compact()에 safety timeout (lane deadlock 방지)        |
| `e6f67d5f3` | compaction 중 timeout 시 session lock deadlock 방지            |
| `957b88308` | overflow compaction retry 및 session context accounting 안정화 |
| `a10f228a5` | compaction 후 last-call usage로 totalTokens 업데이트           |
| `35a3e1b78` | post-compaction workspace context를 system event로 주입        |
| `c4f829411` | compaction summary에 workspace critical rules 추가             |
| `3b5a9c14d` | session compaction 후 per-agent exec override 보존             |
| `068b9c974` | compaction generateSummary를 retryAsync로 래핑                 |
| `ffbcb3734` | memory flush prompt에 runtime date-time 주입                   |
| `1410d15c5` | production build에서 compaction safeguard extension 로딩 수정  |
| `3fff266d5` | reset transcript recovery 강화                                 |
| `83b1ae895` | orphaned OpenAI reasoning block 항상 제거                      |

---

## 5. 모델/프로바이더 (P2)

### 5.1 기존 프로바이더 수정 (중요)

| 커밋        | 내용                                                      |
| ----------- | --------------------------------------------------------- |
| `be6f0b8c8` | Bedrock Anthropic cacheRetention 기본값/pass-through      |
| `c52b2ad5c` | OpenRouter Anthropic에 cache_control 시스템 프롬프트 주입 |
| `99cfb3dab` | OpenRouter에 thinking level 기반 reasoning.effort 전달    |
| `39bb1b332` | rate-limit cooldown 후 primary model 자동 복구            |
| `c211fd112` | sessions_spawn tool에 model fallback 지원                 |
| `2af3415fa` | HTTP 503을 failover 대상으로 처리                         |
| `9757d2bb6` | strict openai-compatible turn ordering 정규화             |
| `42795b87a` | thinking 활성 시 auto-reasoning 비활성화                  |
| `4f340b881` | reasoning-required 에러를 context overflow로 오분류 방지  |
| `671f91312` | 모델별 thinkingDefault override 지원                      |
| `67d25c653` | messaging tool text에서 `<think>` 태그 제거               |
| `feccac672` | GitHub Copilot Claude 모델의 thinking block sanitize      |

### 5.2 새 프로바이더 (선택적)

| 커밋        | 내용                               |
| ----------- | ---------------------------------- |
| `310104723` | **Gemini 3.1 지원**                |
| `d92ba4f8a` | **Mistral 전체 지원**              |
| `13f32e2f7` | **Kilo Gateway 프로바이더**        |
| `559736a5a` | Volcengine & Byteplus 프로바이더   |
| `c640b5f86` | NVIDIA API 프로바이더              |
| `a36b9be24` | LiteLLM 프로바이더                 |
| `11702290f` | Ollama native /api/chat 프로바이더 |

---

## 6. Gateway/Session (P1~P2)

### 6.1 P1 — 안정성

| 커밋        | 내용                                              |
| ----------- | ------------------------------------------------- |
| `dd07c06d0` | gateway restart loop 처리 강화                    |
| `9c30243c8` | restart child spawn 전 gateway lock 해제          |
| `0b8b95f2c` | self-update 실패 후 gateway crash loop 방지       |
| `e6383a2c1` | stale lock recovery를 위한 port liveness probe    |
| `1becebe18` | session lock contention 및 cleanup 강화           |
| `81fd771cb` | hard cap 하에서 chat.history context 보존         |
| `96f7d35dd` | cross-session fallback 차단 (node event delivery) |
| `ae93bc9f5` | stale token cleanup을 non-fatal로 처리            |
| `3efb75212` | sessions.reset 중 active runs abort               |
| `ab4a08a82` | 모든 reply 전송 완료 후 gateway restart 대기      |
| `4225206f0` | session key casing 정규화로 ghost session 방지    |

### 6.2 P2 — 기능

| 커밋        | 내용                                                    |
| ----------- | ------------------------------------------------------- |
| `497e2d76a` | channel health monitor + auto-restart                   |
| `1fb52b4d7` | trusted-proxy auth 모드                                 |
| `2b02e8a7a` | thinking event 스트리밍 + tool event를 verbose에서 분리 |
| `c5698caca` | default gateway auth bootstrap + explicit mode none     |

---

## 7. Cron (P1~P2)

### 7.1 P1 — 버그 수정

| 커밋        | 내용                                                  |
| ----------- | ----------------------------------------------------- |
| `fec4be8de` | daily job이 하루 건너뛰는 문제 (48h jump)             |
| `9cf445e37` | restart 후 interval cadence 복원                      |
| `556af3f08` | timeout된 run에서 side effect 전에 취소               |
| `ace5e33ce` | active job 실행 중 onTimer 발생 시 timer 재장전       |
| `dd6047d99` | 여러 job 동시 trigger 시 중복 fire 방지               |
| `04f695e56` | 하나의 bad job이 전체 job을 깨뜨리지 않도록 에러 격리 |
| `7417c3626` | timer loop에서 maxConcurrentRuns 준수                 |
| `a88ea42ec` | one-shot at job이 skip/error 후 재시작 시 재실행 방지 |
| `ea95e88dd` | isolated job + announce mode에서 중복 delivery 방지   |
| `39e3d58fe` | nextRunAtMs 전진 시 execution 건너뛰기 방지           |

### 7.2 P2 — 기능

| 커밋        | 내용                                             |
| ----------- | ------------------------------------------------ |
| `115cfb443` | cron finished-run webhook 추가                   |
| `c12f693c5` | cron prompt에 실제 event text 내장               |
| `91944ede4` | isolated sessions에 auth-profile resolution 전파 |
| `09d5f508b` | delivery 상태를 job state에 persist              |
| `a73ccf2b5` | cron output을 explicit target에 전달             |

---

## 8. Subagent (P1~P2)

### 8.1 P1

| 커밋        | 내용                                               |
| ----------- | -------------------------------------------------- |
| `a6c741eb4` | max attempts + expiry로 무한 retry loop 차단       |
| `ade11ec89` | deterministic idempotency key로 중복 announce 방지 |
| `e85bbe01f` | subagent timeout을 'timed out'으로 올바르게 보고   |
| `c211fd112` | sessions_spawn tool에 model fallback 지원          |
| `1152b2586` | subagent flow에서 trim crash 방어                  |

### 8.2 P2

| 커밋        | 내용                                                 |
| ----------- | ---------------------------------------------------- |
| `b8f66c260` | nested subagent orchestration 제어 + token 낭비 감소 |
| `2a66c8d67` | subagent alsoAllow grants 준수                       |
| `320cf8eb3` | configurable announce timeout 복원                   |

---

## 9. Web UI / Control UI / TUI (P2~P3)

### 9.1 Control UI — 보안 (P0~P1)

| 커밋        | 내용                                                             |
| ----------- | ---------------------------------------------------------------- |
| `223d7dc23` | **breaking**: non-loopback control-ui origins에 명시적 허용 필요 |
| `6ac89757b` | Control UI static path containment 강화                          |
| `7c500ff62` | control-ui static path resolution 강화                           |
| `40a292619` | **Insecure Auth Bypass**: HTTP에서 Token-Only Auth 허용 차단     |
| `981d26648` | webchat session mutators 차단                                    |
| `14b0d2b81` | control-ui auth flow 강화 + insecure-flag 감사                   |
| `adc818db4` | Control UI bootstrap config JSON 엔드포인트 + CSP lock down      |

### 9.2 Control UI — Dashboard (P2)

| 커밋        | 내용                                                               |
| ----------- | ------------------------------------------------------------------ |
| `3bbbe33a1` | **gateway dashboard + glassmorphism 테마 시스템**                  |
| `e697ec273` | dashboard 개선 — agents overview, chat toolbar, debug & login UX   |
| `77c3b142a` | cron edit parity, all-jobs run history, compact filters            |
| `2ddc13cdb` | control dashboard에 업데이트 경고 배너 추가                        |
| `264131eb9` | Canvas A2UI asset resolution + empty state 개선                    |
| `a948212ca` | session selector에 session labels 표시 + session key prefix 표준화 |
| `14fb2c05b` | abort 시 partial output 보존                                       |
| `4b17ce7f4` | **i18n 지원** (영어, 중국어, 포르투갈어)                           |
| `cf44a0c4c` | language selector 로컬라이즈 + stored locale 검증                  |

### 9.3 Webchat (P1~P2)

| 커밋        | 내용                                                    |
| ----------- | ------------------------------------------------------- |
| `baa3bf270` | streaming/final reply에서 NO_REPLY 토큰 필터링          |
| `dc6afeb4f` | final event 시 불필요한 full history reload 스킵 (성능) |
| `f2e998681` | active chat에서 out-of-band final payload 추가          |
| `8264d4521` | history wait 없이 final assistant payload 렌더링        |
| `19046e0cf` | /new reset 후 session label 보존                        |
| `8a83ca54a` | internal turn 시 session channel routing 보존           |
| `e24e465c0` | reply/audio directive tag 렌더 전 제거                  |
| `c4d2061a7` | markdown 이미지 렌더링을 위한 DOMPurify img 태그 허용   |
| `bebba124e` | chat message에서 raw HTML escape (XSS 방지)             |
| `ae7e37774` | Hebrew/Arabic 텍스트 RTL 지원                           |

### 9.4 TUI (Terminal UI) (P2~P3)

| 커밋        | 내용                                           |
| ----------- | ---------------------------------------------- |
| `331b728b8` | wrapped URL에 OSC 8 하이퍼링크 추가            |
| `b4cdffc7a` | Ctrl+C 종료 동작 안정화                        |
| `b9e9fbc97` | 터미널 출력에서 RTL 텍스트 순서 보존           |
| `68cb4fc8a` | sending/waiting indicator 즉시 렌더링          |
| `a10d68986` | macOS 터미널에서 multiline paste submit 통합   |
| `4550a5200` | model picker에 allowlisted 모델만 필터         |
| `1cc226357` | chat-log 증가 제한으로 render overflow 방지    |
| `222784098` | heartbeat ACK 노이즈 필터링                    |
| `d7a7ebb75` | 중복 backspace 이벤트 제거                     |
| `5cd9e210f` | final payload regression 시 streamed text 보존 |
| `35be87b09` | user message에서 inbound metadata block 제거   |
| `7d7ab8a09` | tool boundary delta 사이 streamed text 보존    |
| `750a7146e` | binary-heavy history 텍스트 렌더 전 sanitize   |
| `61228639c` | concurrent run final 중 active stream 보존     |
| `56b38d2fb` | global scope에서 explicit session key 준수     |

### 9.5 Browser / Extension (P2)

| 커밋        | 내용                                                      |
| ----------- | --------------------------------------------------------- |
| `039fc1e04` | 커스텀 Chrome launch arguments를 위한 extraArgs config    |
| `89503e145` | reCAPTCHA v3 감지에서 navigator.webdriver 숨기기          |
| `3bda3df72` | gateway 시작 후 추가된 profile hot-reload                 |
| `1f1fc095a` | config 변경 시 browser container 자동 재생성              |
| `cb9a5e1cb` | browser container용 separate bind mounts                  |
| `39881a318` | relay port 점유 시 extension relay 재사용                 |
| `fc6d82161` | blocked CDP attach 시 single-page target lookup hang 방지 |

---

## 10. 적용 전략 제안

### Phase 1: 보안 (즉시)

섹션 1의 P0 커밋들 + 섹션 9.1의 Control UI 보안. 특히 OC-XX 시리즈와 SSRF 방어는 높은 우선순위.

> 주의: 보안 커밋들이 매우 많고 서로 의존하는 경우가 있어, 개별 cherry-pick보다 **보안 관련 커밋 일괄 적용**이 효율적일 수 있음.

### Phase 2: 안정성 (1주 내)

- 컴팩션/메모리 수정 (섹션 4)
- Telegram 메시지 유실 버그 (3.1의 `beb2b74b5`, `e33d7fcd1`)
- Slack thread context 유실 (2.1의 `5e73f3344`)
- Cron 핵심 버그 (7.1)
- Gateway crash/lock 수정 (6.1)
- Webchat 핵심 버그 (9.3의 `baa3bf270` NO_REPLY 필터, `bebba124e` XSS)

### Phase 3: 기능 (여유 시)

- Slack/Telegram 새 기능 (섹션 2.2, 3.2)
- 모델/프로바이더 개선 (섹션 5)
- Subagent 개선 (섹션 8)
- Dashboard 및 i18n (섹션 9.2)
- TUI 개선 (섹션 9.4)

### 충돌 예상 영역

- **채널 제거와 충돌**: upstream 커밋 중 다수가 제거된 채널 코드를 참조. cherry-pick 시 수동 해결 필요.
- **보안 리팩토링**: upstream에서 보안 코드를 대규모로 재구조화함 (중앙화, dedupe). 개별 pick이 어려울 수 있음.
- **모델 관련**: 새 프로바이더 추가는 비교적 독립적이라 충돌 위험 낮음.

---

_생성일: 2026-02-24_
