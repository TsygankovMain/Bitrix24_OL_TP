# Integration tests

Integration coverage is intentionally separated from unit tests because it needs a real or containerized Postgres, mock IMAP/SMTP services, and recorded Bitrix24/VibeCode fixtures.

Required scenarios:

- Prisma migration smoke against Postgres.
- IMAP raw message -> parser -> `imconnector.send.messages` mock -> `email_message_map`.
- `OnImConnectorMessageAdd` webhook -> SMTP mock -> outbound `email_message_map`.
- Attachment URL flow through public storage before calling `imconnector.send.messages`.
