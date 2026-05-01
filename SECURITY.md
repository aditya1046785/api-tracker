# Security Policy

## Supported versions

Only the current public release and the latest patch release are supported.

## Reporting a vulnerability

If you find a security issue, please report it privately through the GitHub security tab or open an issue only if the report does not contain sensitive details.

Please include:
- affected version
- steps to reproduce
- impact assessment
- suggested fix if available

## Security principles

- Prompts and responses are never intentionally tracked.
- API keys are not read from provider responses.
- Metadata is sanitized before sending.
- Error details are opt-in only.
