# Security

## Reporting a vulnerability

Please report security issues privately through GitHub's
[private vulnerability reporting](../../security/advisories/new) — the
**Report a vulnerability** button on this repository's Security tab — rather
than as a public issue. You should hear back within seven days.

There is no bug bounty; credit in the release notes is offered instead, if you
would like it.

## Scope

- The web app (`app.js`, the service worker, everything served from `dist/`)
- The leaderboard API (`leaderboard-api/`)
- The container images and compose files

Things that are by design and not vulnerabilities: the leaderboard accepts any
name and time it is given (it is a friendly board, not an anti-cheat system),
and puzzle solutions are computed client-side and therefore visible to anyone
who opens the developer tools.

## Supported versions

The latest release and the `main` branch. Older tags receive no fixes.
