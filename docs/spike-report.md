# Sprint 0 Risk Report

Status: not executed. This report is the checklist to run once Bitrix24 app credentials, VibeCode key, Postgres, and test mailboxes are available.

| Risk                                         | Result  | Mitigation                                                          | Impact                                               |
| -------------------------------------------- | ------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| R1 Webhook reachability                      | PENDING | Fallback to Bitrix24 event polling where supported                  | Must be resolved before Sprint 2 webhooks            |
| R2 Persistent FS                             | PENDING | Keep all persistent data in Postgres/storage                        | Current architecture already assumes external DB     |
| R3 Auto-sleep                                | PENDING | Disable sleep or configure external ping                            | Must be resolved before IMAP poller production       |
| R4 Outbound IMAP/SMTP networking             | PENDING | Restrict supported mail providers or use relay                      | Blocks email connector if outbound ports are blocked |
| R5 VibeCode Bot API/OpenClaw multi-tenancy   | PENDING | Register one bot per portal through Bot API                         | Blocks Sprint 4 final architecture                   |
| R6 Supabase/Postgres capacity                | PENDING | Move to paid Supabase or Neon                                       | Non-blocking for first pilot                         |
| R7 Existing Bitrix24 email tracker detection | PENDING | Remove hard refusal, show warning, document unsupported coexistence | Must be resolved before enforcing tracker conflict   |

## Go/No-Go

NO-GO until R1, R4, R5, and R7 have PASS or explicit MITIGATED decisions.

## Commands

Use the scripts in `spike/`:

- `npm run spike:r1` for webhook reachability server.
- `npm run spike:r4` for IMAP/SMTP outbound networking.
- `npm run spike:r5` for VibeCode Bot API registration/polling.
