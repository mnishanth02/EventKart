---
description: "Use when implementing EventKart work from docs/impl-plan or docs/v1-implementation-plan. Covers progress.md, v1 status, task markers, and plan archiving."
applyTo: "docs/impl-plan/**/*.md|docs/v1-implementation-plan.md|progress.md"
---

# Implementation Progress Tracking

These rules apply whenever you implement features from `docs/impl-plan/` or `docs/v1-implementation-plan.md`.

## When to Update `progress.md` (repo root)

- When you implement work from any file in `docs/impl-plan/`
- When you implement a module or phase from `docs/v1-implementation-plan.md`
- Do NOT add entries for small discussions, minor fixes, or exploratory work
- Only track significant implementation work (new features, infrastructure, refactoring from plans)

## When to Update `docs/v1-implementation-plan.md`

- Update the "Current State" table when a component status changes (e.g., Not started → In progress → Complete)
- Mark individual feature IDs (I-x.x.x) as complete when their implementation is done

## Sync Rules — All Three Documents Must Stay Consistent

- `progress.md` tracks WHAT is being worked on and WHAT is done
- `docs/v1-implementation-plan.md` "Current State" reflects actual completion status
- `docs/impl-plan/*.md` task tables have completion markers (✅) for finished tasks with completion dates

## Archiving Completed Plans

- When ALL tasks in a `docs/impl-plan/` file are complete, move it to `docs/archived/`
- Update `progress.md` to reflect the new archived location
- Update any cross-references in other documents
