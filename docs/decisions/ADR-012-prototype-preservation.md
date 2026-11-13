# ADR-012 — Prototype Preservation and Relocation

**Status:** Approved (2026-11-13, product owner)
**Affects:** Application behaviour (repository structure)

## Context

The root `index.html` is the original static prototype. Vite also uses a root `index.html` as its application entry point, so the two would collide when the app is scaffolded.

## Decision

- The root `index.html` is the **original static prototype** and is preserved as a design and UX reference.
- **When the Vite application foundation is introduced**, the prototype moves to **`prototype/index.html`**, with content and behaviour preserved.
- The prototype is **never deleted**, and its assets are never mixed with the production application.
- **The move is a future action.** It has not been performed. Until the Vite foundation phase, `index.html` stays at the root, unmodified.

## Rationale

This avoids the Vite entry-point collision, keeps the design reference accessible, and makes clear that the prototype is not production code.

## Consequences

- The move should be a pure rename (`git mv`) so history is preserved and the content stays byte-identical.
- The prototype's known issues (palette, date bug, etc.; see PROJECT_STATUS §4) are not fixed in place. They are avoided in the real app.
- The production build must not include `prototype/`. Build configuration requires design review.

## References

[PROJECT_STATUS §3–4](../../PROJECT_STATUS.md) · [README](../../README.md) · [ROADMAP](../ROADMAP.md)
