# Personalization Rebalance V2 Rollout Runbook

## Scope
This runbook applies to backend rollout of the personalization rebalance that introduces event counters, confidence-based ranking, and slot composition caps.

## Preconditions
- Deployment target has `PERSONALIZATION_ENABLED=false`.
- Database migration `20260301162000_personalization_term_event_counters` has been applied.

## Rollout Steps
1. Deploy backend code and schema migration with personalization disabled.
2. Execute one-time profile reset:

```sql
DELETE FROM visitor_interest_term;
DELETE FROM visitor_profile;
```

3. Verify reset counts are zero:

```sql
SELECT COUNT(*) AS visitor_profiles FROM visitor_profile;
SELECT COUNT(*) AS visitor_terms FROM visitor_interest_term;
```

4. Enable personalization with production defaults:

```bash
PERSONALIZATION_ENABLED=true
PERSONALIZATION_MAX_PERSONALIZED_SHARE=0.6
PERSONALIZATION_MODEL_MAX_SHARE=0.25
PERSONALIZATION_MAKE_MAX_SHARE=0.4
PERSONALIZATION_MODEL_OPEN_THRESHOLD=3
PERSONALIZATION_MAKE_OPEN_THRESHOLD=2
PERSONALIZATION_BODYTYPE_OPEN_THRESHOLD=2
PERSONALIZATION_GENERIC_OPEN_THRESHOLD=3
PERSONALIZATION_CONTACT_THRESHOLD=1
PERSONALIZATION_SEARCH_CANDIDATE_MULTIPLIER=5
PERSONALIZATION_SEARCH_CANDIDATE_MAX=500
PERSONALIZATION_MOST_WANTED_CANDIDATES=24
```

## Validation
1. Verify logs include:
- `personalization.search.compose`
- `personalization.most_wanted.compose`

2. Validate behavior manually:
- Single open does not dominate default feed.
- After repeated opens (>=3), model influence appears.
- Default feed keeps freshness mix (no hard domination).
- Most-wanted respects caps and still returns 4 rows.

## Rollback
- Set `PERSONALIZATION_ENABLED=false`.
- No schema rollback required for disabling behavior.
