# Bitrix24 Marketplace Registration

Use `spike/app-manifest.json` as the base manifest.

Required values:

- Install URL: `https://<app-domain>/oauth/install`
- App URL: `https://<app-domain>/app#/inbox`
- Settings URL: `https://<app-domain>/app#/settings`
- Scopes: `imopenlines`, `imconnector`, `imbot`, `im`, `crm`, `user`, `disk`, `event`, `placement`

Before publishing, complete `docs/spike-report.md` and confirm R1, R4, R5, and R7 are PASS or MITIGATED.
