# Production Readiness Roadmap (Reference-First)

## 1) Context and Current-State Snapshot

### Why this service is not yet production-ready for high-confidence public traffic
- Security posture is improved but still incomplete for hardened production defaults (headers, strict DTO enforcement strategy, and production CORS hardening need completion).
- Operational readiness is incomplete (health/readiness/liveness contracts and graceful shutdown controls are not fully standardized).
- Observability is not yet production-grade (no complete error tracking + metrics + alerting pipeline in place for incident response and SLO monitoring).
- Performance and scalability are not gate-controlled (no enforced load baseline and threshold policy in CI/nightly).
- Deployment safety controls on current single VPS/PM2 flow need stronger rollback automation and smoke gating.

### Current strengths
- Integration coverage is strong and now the active parity/regression source of truth.
- Legacy contract behavior is preserved and protected in high-risk areas.
- Core write/search/payment parity flows have meaningful test depth.

### Key gaps by priority
- `P0`: security hardening, health/readiness coverage, observability baseline, incident detection readiness.
- `P1`: performance gates, deployment safety depth, compatibility smoke controls against deployed environments.

## 2) Goals and Non-Goals

### Primary objective
- Achieve P0 production safety first, then close P1 controls for stable ongoing operation.

### Goals
- Reduce security and operational risk before increasing traffic confidence.
- Add minimal, high-value runtime surfaces needed for safe operation.
- Preserve legacy compatibility contracts while hardening.
- Make rollout and rollback deterministic on single VPS/PM2.

### Non-goals
- No Kubernetes/ECS migration in this roadmap.
- No API contract redesign away from legacy envelopes.
- No broad refactor unrelated to production safety outcomes.

## 3) Public APIs / Interfaces / Types Impacted

### Planned endpoint additions
- `GET /health/live`
  - Public endpoint.
  - Scope: process liveness only (no downstream dependency checks).
- `GET /health/ready`
  - Internal/protected endpoint.
  - Scope: readiness checks including DB connectivity.
- `GET /metrics`
  - Internal/protected endpoint for Prometheus scraping.

### Planned header/config behavior
- Request correlation:
  - Accept `X-Request-Id` if provided.
  - Generate one when absent.
  - Echo in response headers.
- CORS:
  - Production allowlist only via environment configuration.
  - No broad permissive production fallback.
- Proxy policy:
  - Explicit trust proxy setting via configuration (no implicit trust).

### Planned validation behavior
- Route-by-route strict DTO rollout on sensitive mutation paths.
- Strategy: start with highest-risk write endpoints and expand after passing integration coverage.

## 4) Four-Week Phased Roadmap

### Week 1: Security Hardening (P0)
- Add secure HTTP headers baseline (`helmet`) with explicit exceptions only where required.
- Enforce production CORS allowlist policy.
- Implement explicit trust proxy policy configuration.
- Begin strict DTO enforcement route-by-route for sensitive endpoints.
- Preserve legacy response envelopes in validation error mappings where required by compatibility.

### Week 2: Health, Readiness, Shutdown, Correlation (P0)
- Implement `GET /health/live` and `GET /health/ready`.
- Add DB ping in readiness check.
- Enable graceful shutdown hooks and verify clean resource shutdown.
- Add request correlation middleware (`X-Request-Id`) and propagate into logs.
- Update runbook behavior for operational checks and failure handling.

### Week 3: Metrics, Alerts, Deploy Safety, Rollback (P0/P1)
- Expose Prometheus-compatible metrics endpoint.
- Instrument baseline service metrics (request rate/latency/errors, DB timing).
- Integrate Sentry for exception capture and request-context tagging.
- Define dashboards and SLO-aligned alerts.
- Upgrade deploy flow with preflight checks + post-deploy smoke + automatic rollback triggers.

### Week 4: Performance Baselines + Compatibility Smokes (P1)
- Add performance/load scenarios for hottest endpoints.
- Define nightly thresholds and regression detection policy.
- Add post-deploy consumer compatibility smoke pack (5-10 FE-critical response shapes).
- Make nightly perf gate blocking; keep PR perf runs informational while baselines mature.

## 5) CI/CD and Deployment Safety Model

### Current deployment constraints
- Topology: single VPS with PM2.
- Deployment entrypoint: shell-driven rollout using current deploy flow.
- Constraint: no native canary/blue-green in current environment.

### Required safety controls
- Preflight checks before deploy:
  - environment sanity and required values,
  - migration safety checks,
  - build/start readiness preconditions.
- Post-deploy gates:
  - readiness check must pass,
  - compatibility smoke must pass.
- Automatic rollback policy:
  - rollback to previous known-good revision on failed readiness/smoke,
  - redeploy previous process state and verify health.

### CI model
- Keep unit/integration PR gates active.
- Add post-deploy smoke workflow for deployed environment verification.
- Add nightly performance workflow with enforced thresholds.

## 6) Observability Standard

### Selected stack
- Metrics/alerts/dashboards: Prometheus + Grafana (self-hosted).
- Error monitoring: Sentry free tier.

### Minimum required metrics
- HTTP:
  - request count by route/method/status,
  - latency histogram (including p95/p99),
  - 5xx/error rate.
- Dependency:
  - DB query latency and DB failure count.
- Platform:
  - readiness status,
  - process/runtime health signals.

### Alert threshold minimums (initial)
- Elevated 5xx rate above defined threshold for sustained window.
- Latency regressions on critical endpoints above threshold window.
- Readiness failures over consecutive checks.
- DB connectivity/query-failure spikes.

### Dashboard minimums
- Service overview (traffic, errors, latency).
- Endpoint-focused latency panels for critical routes.
- DB health panel.
- Incident drill-down view with request correlation linkage.

## 7) Testing and Acceptance Criteria

### Security acceptance
- Production CORS rejects non-allowlisted origins and allows configured origins.
- Secure headers are present and policy-compliant in production.
- Strict DTO routes reject unknown fields as designed.

### Operational acceptance
- `/health/live` indicates process liveness without downstream dependency checks.
- `/health/ready` reflects DB dependency status and fails when DB is unavailable.
- Graceful shutdown closes DB/process resources cleanly.

### Observability acceptance
- `X-Request-Id` is available in request logs and response headers.
- Unhandled exceptions are captured in Sentry with route/request context.
- Metrics endpoint is scrapeable and dashboards render expected panels.
- Alert routing fires correctly in controlled fault injection.

### Deployment safety acceptance
- Failed readiness triggers rollback.
- Failed post-deploy smoke triggers rollback.
- Rollback process restores previous known-good revision and healthy state.

### Performance acceptance
- Nightly load suite runs against selected hot endpoints.
- Nightly thresholds fail on regression.
- PR performance checks remain informational.

### Compatibility acceptance
- Post-deploy FE-facing smoke pack passes for selected high-risk response shapes.
- Smoke failures block promotion and trigger rollback policy when configured.

## 8) Risk Register and Mitigations

### Risk: parity break from stricter validation
- Impact: medium/high.
- Mitigation:
  - route-by-route rollout,
  - keep integration coverage as parity guardrail,
  - preserve legacy envelope behavior where required.

### Risk: false-positive rollback from brittle smoke tests
- Impact: medium.
- Mitigation:
  - keep smoke suite focused and deterministic,
  - add retry policy for transient failures,
  - tune rollback triggers with observed data.

### Risk: monitoring overhead / noisy signals
- Impact: medium.
- Mitigation:
  - start with essential metrics,
  - set conservative alert thresholds first,
  - iterate alert quality weekly.

## 9) Ownership, Sequencing, and Tracking

### Suggested owner lanes
- Platform/DevOps:
  - deployment gating, rollback automation, Prometheus/Grafana plumbing.
- Backend/API:
  - health endpoints, validation hardening, correlation IDs, metrics instrumentation.
- QA/Quality:
  - compatibility smokes, regression coverage, acceptance verification.

### Dependency order
1. Security and config hardening foundations.
2. Health/readiness/shutdown and correlation.
3. Metrics + error monitoring instrumentation.
4. Deploy safety controls and rollback automation.
5. Performance baselines and post-deploy compatibility smoke pack.

### Milestone checkpoints
- End Week 1: production hardening controls merged and verified.
- End Week 2: health/readiness/correlation + graceful shutdown verified.
- End Week 3: observability + rollback safety operational.
- End Week 4: perf baselines + compatibility smokes active and gated.

## 10) Decision Log (Locked for This Plan)

1. Timeline:
- 4 weeks.

2. Priority:
- P0 production safety first.

3. Deployment topology:
- single VPS + PM2.

4. Validation strategy:
- route-by-route strict DTO rollout.

5. Health endpoint exposure:
- `/health/live` public, `/health/ready` internal/protected.

6. Observability stack:
- Prometheus/Grafana self-hosted + Sentry free tier.

7. Performance gate policy:
- nightly blocking, PR informational.

8. Rollback policy:
- automatic rollback on failed readiness or smoke.

## Test Cases and Scenarios (Explicit Coverage Set)

1. CORS allowlist rejection/allow tests in production mode.
2. Strict DTO rejection tests for sensitive mutation routes.
3. `/health/live` and `/health/ready` success/failure behavior, including DB-down scenario.
4. Deploy rollback simulation on failed readiness or smoke.
5. Nightly performance thresholds for `/car-details/search` and order capture.
6. Post-deploy consumer compatibility smoke for 5-10 FE-critical endpoints.

## Assumptions and Defaults

1. Timeline: 4 weeks.
2. Priority: P0 production safety first.
3. Deployment topology: single VPS with PM2.
4. Validation strategy: route-by-route strictness rollout.
5. Health exposure: `live` public, `ready` internal/protected.
6. Observability stack: Prometheus/Grafana + Sentry free tier.
7. Performance gate policy: nightly blocking, PR informational.
8. Rollback policy: automatic rollback on failed readiness/smoke.
