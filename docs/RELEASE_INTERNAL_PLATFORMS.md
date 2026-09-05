# Admin / CRM coordinated release

This source release contains the complete internal workspace upgrade: common
shell, customer records, onboarding and operations, mail reading and composition,
account recovery, MFA and separate application sessions.

Do not deploy this frontend ahead of its matching API. The API must include the
internal-access migrations, MFA tables, onboarding and operations read models,
mailbox privacy changes, and website-consultation endpoints used by the calendar.
An updated frontend alone does not change live account permissions.

The `release/internal-platforms-*` branch runs the same validation as `main`.
It is not an automatic production deployment or a release approval. Production
builds must use `VITE_API_BASE_URL=https://api.partsunion.de` and
`VITE_SCRAPER_BASE_URL=https://api.partsunion.de`. Tests intercept network calls.

Before rollout: verify an exact API revision, database backup and restore path,
migration rehearsal, separate Admin/CRM cookie origins and the actual running
services. Validate login, authorization and mail workflows against controlled
test accounts before accepting production traffic. Existing internal sessions
are deliberately revoked by the application-access migration.

The central dealer-app `services=all` release workflow currently does not include
Admin or CRM. It must not be presented as deploying these two interfaces.

Local generated test results, environment files, dependencies and build outputs
are excluded from the source release. Screenshots under `docs/` use test data.
