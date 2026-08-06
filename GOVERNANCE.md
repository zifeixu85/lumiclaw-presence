# LumiClaw Presence Governance

LumiClaw Presence is an Apache-2.0 open-source project in pre-alpha. The project welcomes focused bug reports, design discussions, documentation improvements, connector contract research, and reviewed code contributions.

## How decisions are made

- Product direction, user workflows, public claims, and Owner acceptance are maintained by the product owner.
- Architecture, migrations, AgentTeams integration, provider and connector boundaries, and engineering evidence are maintained by technical maintainers.
- Community proposals begin in Discussions or an issue. Changes that affect architecture, security, permissions, persisted contracts, or public actions require a scoped SDD before implementation.
- Maintainers seek evidence and rough consensus. When consensus is not available, the product owner decides product scope and the relevant technical maintainer decides implementation safety. The reasoning should be recorded publicly when it is safe to do so.

## Contribution path

1. Start with a Discussion for early or broad ideas, or an issue for a reproducible and bounded problem.
2. Agree on the boundary and acceptance criteria before substantial implementation.
3. Work on a focused branch and open a pull request using the repository template.
4. Pass required checks, resolve review conversations, and obtain at least one maintainer approval.
5. A maintainer merges the change. Direct pushes to `main` are reserved for documented emergency recovery.

Maintainers may close proposals that bypass platform policy, weaken human authorization, expose sensitive data, misrepresent evidence maturity, or fall outside the project direction.

## Evidence and safety

Synthetic fixtures, engineering verification, external user calibration, and business outcomes are different maturity levels. A pull request must claim only the level its evidence supports. Never include secrets, private messages, customer data, proprietary account material, or unsafe production traces.

Public actions remain permission-aware and fail closed. A successful model or Agent run is not an approved publication or a business result.

## Maintainers and releases

Current ownership is declared in `.github/CODEOWNERS`. Additional maintainers may be added after sustained, trusted contributions and agreement on their domain responsibilities.

Until a supported release is announced, `main` is the integration branch and may change incompatibly. Releases will use tagged versions, published notes, and explicit migration guidance.

Security reports follow [SECURITY.md](SECURITY.md). Community behavior follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
