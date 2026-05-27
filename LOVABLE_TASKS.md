# Lovable Tasks — `MindLumi/MindLumi` (backend)

> ⚠️ **This repo is the canonical backend** (Supabase Edge Functions, migrations, OpenAI Assistants, RAG, safety system). **Lovable cannot operate here** — Lovable only writes frontend UI code; it does not deploy edge functions or write SQL migrations.
>
> **Purpose of this file:** mirror open backend issues in a Lovable-style queue so a non-Lovable agent (human, Codex, Copilot CLI) can pick them up independently and Lovable in the frontend repo knows when its blocked tasks become unblocked.

---

## How to use this file

1. Pick the highest-priority unblocked task.
2. Read the linked GitHub issue for full context.
3. Implement → run `supabase db reset` (for migrations) or `supabase functions serve` (for fns) locally to verify → open PR.
4. After merge, comment on any frontend issue that was blocked on this one (`MindLumi/lumi-bece0d49#N — unblocked`).

---

## Priority queue

| Order | Issue | Priority | Title | Blocks | Notes |
|------:|------:|:--------:|-------|--------|-------|
| 1 | [#1](https://github.com/MindLumi/MindLumi/issues/1)  | P0 | Adopt Circle / Metrics / Consents schema from `lumi-bece0d49` | FE#5, FE#8, FE#9, BE#5, BE#6, BE#11 | Largest schema change; tackle first |
| 2 | [#2](https://github.com/MindLumi/MindLumi/issues/2)  | P0 | Adopt Whoop + Narrative schema from `lumi-bece0d49` | FE#5, BE#3 | After #1 |
| 3 | [#3](https://github.com/MindLumi/MindLumi/issues/3)  | P0 | Absorb `transcribe-narrative` edge function | FE#6, BE#12 | After #2 (depends on `multimodal_sessions` table) |
| 4 | [#4](https://github.com/MindLumi/MindLumi/issues/4)  | P1 | Document schema / migration ownership policy | — | Standalone doc; can ship anytime |
| 5 | [#5](https://github.com/MindLumi/MindLumi/issues/5)  | P1 | Add `metrics` + `circle` edge functions | FE#8, FE#9 | After #1 |
| 6 | [#6](https://github.com/MindLumi/MindLumi/issues/6)  | P1 | Nightly `user_baselines` recompute (scheduled fn) | BE#11 | After #1 |
| 7 | [#7](https://github.com/MindLumi/MindLumi/issues/7)  | P1 | Surface M3 milestone doc in README / Skill.md | — | Standalone doc |
| 8 | [#11](https://github.com/MindLumi/MindLumi/issues/11) | P1 | Factor scoring pipeline (3-dimension wellness model) | FE#15 | After #1, #6 |
| 9 | [#12](https://github.com/MindLumi/MindLumi/issues/12) | P2 | Multi-modal signal extraction (voice biomarkers, behavior patterns) | — | After #3, #11 |
| 10 | [#8](https://github.com/MindLumi/MindLumi/issues/8)  | P2 | Retire `lumi-ui/` test console | — | After FE#4 ships and is deployed |
| 11 | [#9](https://github.com/MindLumi/MindLumi/issues/9)  | P2 | Update `ALLOWED_ORIGINS` for canonical frontend domain | — | After FE#13 repo rename |
| 12 | [#10](https://github.com/MindLumi/MindLumi/issues/10) | meta | Cross-repo consolidation tracker | — | Meta — update after each milestone, do not implement |

---

## Critical path

```
#1 (schema)  ─┬─►  #5 (edge fns)  ─►  FE#8, FE#9 unblock
              ├─►  #6 (baselines) ─►  #11 (factors)  ─►  FE#15 unblock
              └─►  #2 (whoop)     ─►  #3 (transcribe) ─►  FE#6 unblock
                                                       └─►  #12 (voice biomarkers)
```

Once #1, #2, #3 merge: **frontend's blocked queue opens up**. Notify by commenting on the linked FE issues.

---

## Task prompts (top of queue)

### Task #1 — Adopt Circle / Metrics / Consents schema

> Port these tables from `MindLumi/lumi-bece0d49/supabase/migrations/` into this repo's `supabase/migrations/`, with timestamps that respect the existing ordering:
> - **Metrics:** `metric_definitions`, `user_metrics`, `user_baselines`, `user_goals`, `user_devices`, `user_consents`, `audit_log`
> - **Circle/Support:** `support_relationships`, `support_permissions`, `support_checkins`, `support_messages`, `shared_goals`, `support_alerts`, `support_audit_log`
>
> **Reconcile** any column changes the frontend repo made to canonical tables (`user_profiles`, `therapy_sessions`, `session_messages`, `mood_journal`, `progress_tracking`, `safety_events`). Preserve the stricter version in **this** repo; the frontend duplicates will be deleted (tracked in `lumi-bece0d49#5`).
>
> **Preserve** the RLS hardening from the FE migrations: `REVOKE EXECUTE … FROM anon, authenticated, public` on helper functions.
>
> **Update** `Skill.md` schema section to reflect the new tables.
>
> **Verify:** `supabase db reset` applies cleanly; RLS works for every new user-facing table (test with anon vs authenticated vs service role).

---

### Task #2 — Adopt Whoop + Narrative schema

> Port these migrations from `MindLumi/lumi-bece0d49/supabase/migrations/`:
> - `whoop_daily` (wearable daily metrics)
> - `multimodal_sessions` (narrative check-in substrate)
> - `lumi_baseline`
>
> Land in canonical timestamp order. Verify RLS. Review storage bucket policies for any associated media (used by `transcribe-narrative` in task #3).

---

### Task #3 — Absorb `transcribe-narrative` edge function

> Move `supabase/functions/transcribe-narrative/` from `MindLumi/lumi-bece0d49` into this repo.
>
> **Refactor** to use `_shared/` modules: `cors.ts`, `auth.ts`, `response.ts`, `ai-provider.ts`.
> **Safety pass:** route the transcript through `safety-guard.ts` before persistence or downstream AI call.
> **Document** the storage bucket layout and PHI handling in the README.
> **Deploy loop:** add to README's edge-function deploy list.
>
> **Verify:** `supabase functions deploy transcribe-narrative` succeeds. Sending audio returns a transcript with safety annotations. No raw transcript text in application logs.

---

### Task #4 — Schema ownership doc

> Add `docs/SCHEMA_OWNERSHIP.md` (linked from `README.md` + `Skill.md`) that establishes:
> - `MindLumi/MindLumi` is the single source of truth for all DB migrations.
> - Frontend repos **must not** redeclare tables — they consume the schema.
> - To propose a schema change: open a PR here; do not modify frontend `supabase/migrations/`.
> - Frontends regenerate types from this repo's deployed Supabase project (`supabase gen types typescript`).
>
> Cross-reference from `MindLumi/lumi-bece0d49/README.md` (covered by FE#7).

---

### Task #5 — `metrics` + `circle` edge functions

> Add server-side endpoints so the frontend stops writing tables directly.
>
> **`supabase/functions/metrics/index.ts`** — actions:
> - `record` (POST a metric value, writes `user_metrics` + `audit_log`)
> - `history` (GET range query for a metric_key)
> - `latest-by-key` (GET latest value per metric_key for the user)
> - `factors` (GET latest factor scores — added in task #11)
>
> **`supabase/functions/circle/index.ts`** — actions:
> - `invite-create`, `invite-redeem`
> - `list-relationships`, `supporter-view` (gated by `has_circle_access`)
>
> All endpoints use `_shared/` modules (`auth.ts`, `cors.ts`, `response.ts`, `safety-guard.ts` where relevant). Service-role writes that honor RLS semantics. Write `audit_log` row on every mutation.
>
> **Document** the endpoints in the README endpoint table.

---

### Task #6 — Nightly baselines recompute

> Add a scheduled edge function `supabase/functions/recompute-baselines/index.ts` that:
> - Iterates users with ≥1 metric in last 30 days.
> - Computes 30-day rolling mean + stddev per `(user_id, metric_key)`.
> - Upserts into `user_baselines`.
> - Idempotent (safe to re-run).
> - Logs success/failure counts (no PHI).
>
> Wire to Supabase scheduled triggers (daily 03:00 UTC).
>
> Aligns with M3 P1 in `lumi-bece0d49/docs/milestones/M3-circle-and-metrics.md`.

---

### Task #7 — M3 milestone in README / Skill.md

> The M3 (Circle + Longitudinal Metrics) milestone is documented only in the frontend repo. Mirror or link from this canonical repo so the roadmap is discoverable here.
>
> Update `README.md` Roadmap section with a link to `lumi-bece0d49/docs/milestones/M3-circle-and-metrics.md` (or copy the doc into `docs/milestones/` here).
> Update `Skill.md` roadmap section similarly.

---

### Task #11 — Factor scoring pipeline (P1, blocked by #1 + #6)

> Implement the 3-dimension wellness model per `mindlumi-factor-analysis-explained.md`.
>
> **Schema:** new migration adding `user_factor_scores (id, user_id, factor_key TEXT, score NUMERIC, contributing_metrics JSONB, computed_at TIMESTAMPTZ)`.
>
> **Weights:** add `factor_weights` table (or `assistant_config` entry) mapping `metric_key → factor_key + weight`. Seed with heuristic equal weights within each factor:
> 1. **Emotional Distress** — mood, anxiety, sadness, irritability, voice-tone metrics
> 2. **Physiological Regulation** — HRV, sleep quality, RHR, recovery, activity
> 3. **Social & Behavioral Stability** — Circle engagement, missed check-ins, isolation signals
>
> **Compute fn:** extend `recompute-baselines` (or new `compute-factors` scheduled fn) to: fetch user's 7-day metrics → normalize against `user_baselines` → weighted sum → upsert `user_factor_scores`.
>
> **API:** `metrics?action=factors` returns latest scores for the auth'd user (add to task #5 fn).
>
> **Safety integration:** if `Emotional Distress > 0.8 AND Physiological Regulation < 0.3`, insert `support_alerts` row and flag next chat as `safety_level >= 1`.
>
> **Verify:** factor scores populate nightly for users with ≥3 metrics; API returns them; threshold alert generates on synthetic data; no raw metric values in logs.

---

## Lower-priority / cleanup

- **#8** — Retire `lumi-ui/` test console. After `MindLumi/lumi-bece0d49#4` (Chat wiring) ships and is deployed, remove (or move to `examples/`) the `lumi-ui/` dir and update README to point at the new frontend.
- **#9** — Update `ALLOWED_ORIGINS` secret to include the canonical frontend domain. Do **after** `lumi-bece0d49` is renamed to `lumi-app` (FE#13). Document in README env-var table.
- **#12** — Multi-modal signal extraction (voice biomarkers from `transcribe-narrative`, behavior patterns). P2 — only start after #3 and #11.

## Meta

- **#10** — Cross-repo consolidation tracker. Update the checklist after each milestone; do not implement directly.

---

_Last synced from GitHub Issues: 2026-05-27. Re-sync when issue list changes._
