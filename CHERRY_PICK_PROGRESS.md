# Cherry-Pick Progress: Upstream Security P0

> Branch: `cherry-pick/upstream-security-p0`
> Started: 2026-02-24

## Phase A — OC Critical 취약점

| #   | Commit      | Subject                                   | Status  |
| --- | ----------- | ----------------------------------------- | ------- |
| 1   | `b5f551d71` | OC-06: config includes path traversal     | pending |
| 2   | `084f62102` | OC-65: compaction counter reset           | pending |
| 3   | `ebcf19746` | OC-53: prompt size limit                  | pending |
| 4   | `63e39d7f5` | OC-53: harden ACP prompt size guardrails  | pending |
| 5   | `3967ece62` | OC-25: OAuth CSRF                         | pending |
| 6   | `d306fc8ef` | OC-07: session history credential         | pending |
| 7   | `c275932aa` | OC-22: Zip Slip skill packaging           | pending |
| 8   | `749e28dec` | OC-02: gateway HTTP deny                  | pending |
| 9   | `ee31cd47b` | OC-02: ACP permission + gateway HTTP deny | pending |

## Phase B — SSRF 방어

| #   | Commit      | Subject                   | Status  |
| --- | ----------- | ------------------------- | ------- |
| 10  | `442fdbf3d` | IPv6 transition SSRF      | pending |
| 11  | `d51929ecb` | ISATAP SSRF               | pending |
| 12  | `c0c0e0f9a` | IPv4-mapped IPv6 SSRF     | pending |
| 13  | `71bd15bb4` | special-use IPv4 SSRF     | pending |
| 14  | `44dfbd23d` | host/ip block 중앙화      | pending |
| 15  | `c5406e1d2` | gatewayUrl SSRF           | pending |
| 16  | `2d5647a80` | gatewayUrl overrides 제한 | pending |

## Phase C — 인증/프로토콜

| #   | Commit      | Subject                          | Status  |
| --- | ----------- | -------------------------------- | ------- |
| 17  | `f1e1ad73a` | SHA-256 timingSafeEqual          | pending |
| 18  | `e0aaf2d39` | deepMerge prototype pollution    | pending |
| 19  | `95dab6e01` | config prototype-key guard       | pending |
| 20  | `fe609c0c7` | webhook template prototype-chain | pending |
| 21  | `57102cbec` | crypto.randomBytes temp files    | pending |
| 22  | `fb35635c1` | execFileSync (no shell)          | pending |

## Notes

- 충돌 해결이 복잡한 경우 `skipped`로 표시하고 사유 기록
- 쌍으로 적용해야 하는 커밋: (3,4), (8,9), (15,16)
