# Changelog

## 1.0.0 - 2026-05-01

### Added
- Initial public release of AI Usage Tracker.
- Manual tracking via `track()`.
- Response-based tracking via `trackResponse()`.
- Wrapper-based tracking via `trackLLM()`.
- Event batching with queue limits.
- Retry handling with exponential backoff.
- Local cost estimation for supported models.
- Metadata sanitization and secret redaction.
- TypeScript definitions.

### Notes
- This release focuses on the core tracking flow and safe defaults.
- Future releases may expand integrations, reporting, and delivery options.
