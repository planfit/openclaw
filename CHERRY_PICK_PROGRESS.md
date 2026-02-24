# Cherry-Pick Progress: Upstream Security P0

> Branch: `cherry-pick/upstream-security-p0`
> Started: 2026-02-24
> Completed: 2026-02-24

## Phase A — OC Critical 취약점

| #   | Commit      | Subject                                   | Status                                                         |
| --- | ----------- | ----------------------------------------- | -------------------------------------------------------------- |
| 1   | `b5f551d71` | OC-06: config includes path traversal     | already-fixed (fork에 isPathInside 사용한 더 강력한 구현 존재) |
| 2   | `084f62102` | OC-65: compaction counter reset           | applied                                                        |
| 3   | `ebcf19746` | OC-53: prompt size limit                  | conflict-resolved                                              |
| 4   | `63e39d7f5` | OC-53: harden ACP prompt size guardrails  | conflict-resolved                                              |
| 5   | `3967ece62` | OC-25: OAuth CSRF                         | conflict-resolved                                              |
| 6   | `d306fc8ef` | OC-07: session history credential         | conflict-resolved                                              |
| 7   | `c275932aa` | OC-22: Zip Slip skill packaging           | applied                                                        |
| 8   | `749e28dec` | OC-02: gateway HTTP deny                  | applied                                                        |
| 9   | `ee31cd47b` | OC-02: ACP permission + gateway HTTP deny | conflict-resolved (CHANGELOG only)                             |

## Phase B — SSRF 방어

| #   | Commit      | Subject                   | Status                                                  |
| --- | ----------- | ------------------------- | ------------------------------------------------------- |
| 10  | `442fdbf3d` | IPv6 transition SSRF      | conflict-resolved                                       |
| 11  | `d51929ecb` | ISATAP SSRF               | conflict-resolved                                       |
| 12  | `c0c0e0f9a` | IPv4-mapped IPv6 SSRF     | conflict-resolved (이전 커밋에 이미 포함, HEAD 유지)    |
| 13  | `71bd15bb4` | special-use IPv4 SSRF     | conflict-resolved                                       |
| 14  | `44dfbd23d` | host/ip block 중앙화      | skipped (복잡한 리팩토링, 핵심 로직은 10-13에서 적용됨) |
| 15  | `c5406e1d2` | gatewayUrl SSRF           | conflict-resolved                                       |
| 16  | `2d5647a80` | gatewayUrl overrides 제한 | conflict-resolved (CHANGELOG only)                      |

## Phase C — 인증/프로토콜

| #   | Commit      | Subject                          | Status                             |
| --- | ----------- | -------------------------------- | ---------------------------------- |
| 17  | `f1e1ad73a` | SHA-256 timingSafeEqual          | applied                            |
| 18  | `e0aaf2d39` | deepMerge prototype pollution    | applied                            |
| 19  | `95dab6e01` | config prototype-key guard       | conflict-resolved                  |
| 20  | `fe609c0c7` | webhook template prototype-chain | conflict-resolved (CHANGELOG only) |
| 21  | `57102cbec` | crypto.randomBytes temp files    | conflict-resolved (import)         |
| 22  | `fb35635c1` | execFileSync (no shell)          | applied                            |

## Post Cherry-Pick 수정

cherry-pick 과정에서 누락된 파일 및 테스트 호환성 문제 수정:

| 문제                                                             | 해결                                             |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| `src/config/prototype-keys.ts` 누락                              | `src/infra/prototype-keys.ts` + re-export 생성   |
| `src/infra/http-body.ts` 누락                                    | upstream에서 복사                                |
| `ssrf.ts` 중복 `parseIpv6Hextets`, `extractIpv4FromEmbeddedIpv6` | 이전 inline 버전 제거, rule-based 버전 유지      |
| `chutes-oauth.test.ts` bare code 테스트                          | CSRF 수정에 맞춰 full redirect URL 반환으로 변경 |
| `auth-choice.test.ts` bare code mock                             | state 캡처 후 full redirect URL 구성             |
| `hooks-mapping.test.ts` `createGmailAgentMapping` 미정의         | 헬퍼 함수 추가                                   |
| `message.test.ts` `createMattermostLikePlugin` 미정의            | 헬퍼 함수 + import 추가                          |

## Summary

- **Total**: 22 commits
- **Applied (clean)**: 6
- **Conflict-resolved**: 13
- **Already-fixed**: 1 (#1 — fork에 더 강력한 구현 존재)
- **Skipped**: 2 (#14 — 복잡한 리팩토링, 핵심 로직은 이미 적용됨)
- **Tests**: 853 passed, 0 failed (전체 suite 통과)
