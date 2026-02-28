# Vehicle API Documentation

## Purpose
This documentation set is the primary technical reference for `vehicle-api` behavior, ownership, runtime controls, and troubleshooting.

It is designed so maintainers can answer:
- what happens
- why it happens
- where it happens in code
- how to verify/fix it

## How To Use
1. Start with `ARCHITECTURE.md` for system map and runtime flows.
2. Use `ENVIRONMENT_VARIABLES.md` for configuration behavior.
3. Use `modules/*.md` for module-level details.
4. Use `BEHAVIOR_CATALOG.md` for symptom -> owner mapping.
5. Use `RUNBOOKS.md` for operational actions and recovery.
6. Use `DATA_MODEL_AND_STATE_TRANSITIONS.md` for lifecycle/state logic.
7. Use `adr/` for architecture decisions and rationale.
8. Use `INTEGRATION_TEST_COVERAGE.md` for integration test scope and gap map.
9. Treat integration tests (`npm run test:int`) as the parity and regression source of truth.

## Stability Levels
- `Authoritative`: `ARCHITECTURE.md`, `ENVIRONMENT_VARIABLES.md`, `modules/*.md`, `DATA_MODEL_AND_STATE_TRANSITIONS.md`, `RUNBOOKS.md`, `BEHAVIOR_CATALOG.md`, `adr/*`
- `Historical / Implementation tracking`: `MAINTAINABILITY_AUDIT_IMPLEMENTATION_PLAN.md`, `migration/*`, `VENDOR_ONLY_IDENTITY_MIGRATION_PLAN.md`

## Documentation Index
- `ARCHITECTURE.md`
- `ENVIRONMENT_VARIABLES.md`
- `DATA_MODEL_AND_STATE_TRANSITIONS.md`
- `BEHAVIOR_CATALOG.md`
- `RUNBOOKS.md`
- `INTEGRATION_TEST_COVERAGE.md`
- `IMPLEMENTED_CHANGES_BY_MODULE.md`
- `modules/cross-cutting.md`
- `modules/imports.md`
- `modules/legacy-group-a.md`
- `modules/legacy-group-b.md`
- `modules/legacy-ap.md`
- `modules/legacy-data.md`
- `modules/legacy-search.md`
- `modules/legacy-sitemap.md`
- `modules/legacy-auth.md`
- `modules/legacy-admin.md`
- `modules/legacy-payments.md`
- `modules/legacy-docs.md`
- `modules/legacy-favourites.md`
- `adr/README.md`

## Scope Rules
- Behavior claims in these docs must map to code files.
- Secret values must never be documented.
- Env var docs include default behavior and impact.
- Every module doc includes at least one failure mode.

## Doc Update Checklist (for every behavior-changing PR)
- Update affected module file in `docs/modules/`.
- Update `ENVIRONMENT_VARIABLES.md` if config behavior changes.
- Update `DATA_MODEL_AND_STATE_TRANSITIONS.md` if state flow changes.
- Update `RUNBOOKS.md` if operation/recovery changes.
- Add/update ADR when architecture decision changed.
- Update `IMPLEMENTED_CHANGES_BY_MODULE.md` for significant cross-cutting changes.
- Update `INTEGRATION_TEST_COVERAGE.md` when integration test coverage changes.
- Update `INTEGRATION_TEST_COVERAGE.md` immediately after each implementation step touching test scope.
- Do not add/restore contract-diff suites; expand integration coverage instead.
