# LumiClaw Presence M0 design contract

> Maturity: `IMPLEMENTED` as a reviewable M0 shell; all business data, Agent execution, approval, connector, Receipt, and learning behavior remain `PLANNED`.

## Direction

The M0 shell is an **Evidence-first Editorial Operations Console**. It combines the legibility of a newsroom assignment desk with the strict state language of an operations ledger. The memorable element is a persistent truth layer: every screen exposes the current state, its evidence basis, and one safe Owner next step.

It deliberately avoids a purple-gradient AI dashboard, a space-station command center, fake real-time charts, glowing Agent avatars, or platform-success decoration.

## Foundations

- Paper background: warm `paper-50`, used like a working proof rather than a glossy SaaS canvas.
- Ink: near-black `ink-950` for authority and strong print-like hierarchy.
- Signal red: `signal-500` is reserved for truth boundaries, blockers, and current-position markers.
- Sage: `sage-500` appears only in neutral identity/preview placeholders.
- Display type: Iowan Old Style / Songti / Source Han Serif fallback.
- Utility type: Avenir Next / Futura / PingFang fallback.
- Evidence type: IBM Plex Mono / SFMono fallback.
- Radius is minimal except platform-preview approximations; shadows resemble raised proof sheets, not floating glass cards.

CSS variables in `apps/web/src/app/globals.css` are the implementation source for tokens. Translated labels are never token or domain identifiers.

## Information architecture

1. Campaigns / Start
2. Setup & Readiness
3. Mission Workspace
4. Review & Action Center
5. Response & Learn

Every screen must answer:

- What is the current objective?
- Where is the system now?
- What evidence or contract supports that state?
- What is the single safe next Owner action?

## Mission Workspace baseline

The desktop baseline uses three columns:

```text
ActivationUnit rail | Editable Composer | Native-like Preview
```

At narrow widths, the columns stack. M0 platform labels are X `PREPARE ONLY`, Bluesky `NOT CONNECTED`, LinkedIn `HANDOFF PLANNED`, and Xiaohongshu `HANDOFF PLANNED`. No preview implies a direct connector or account scope.

## Required states

`NEEDS_INPUT`, `PREPARING`, `NEEDS_REVIEW`, `BLOCKED`, `NEEDS_OWNER`, `UNKNOWN_RECONCILIATION_REQUIRED`, and `FOUNDATION_READY` remain stable codes. The first Storybook baseline shows `ADAPTER CONTRACT ONLY`; future stories add Empty, Running, Blocked, Needs Owner, Unknown, and Recovery without changing the underlying codes.

## Pencil review baseline

The encrypted M0 Pencil artifact contains one complete `Mission Workspace` desktop overview. It proves the shared shell, five-step journey, truth label, state ledger, three-column four-platform Composer baseline and one-next-step rule are reviewable without running the application. The other four routes and the full state matrix are represented by the Next shell and Storybook contract; separate Pencil frames remain future design work and are not claimed by SDD-000.

Pencil exports are review evidence, not production source. The `.pen` file is created and read only through Pencil tools; PNG/PDF exports live under `docs/design/exports/`.
