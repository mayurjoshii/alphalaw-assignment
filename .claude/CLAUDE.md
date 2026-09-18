# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Take care of frontend aesthetics
<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this
creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive
frontends that surprise and delight.

Focus on:
- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic
fonts like Arial and Inter; opt instead for distinctive choices that elevate the
frontend's aesthetics.
- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency.
Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw
from IDE themes and cultural aesthetics for inspiration.
- Motion: Use animations for effects and micro-interactions. Prioritize CSS-only
solutions for HTML. Use Motion library for React when available. Focus on high-impact
moments: one well-orchestrated page load with staggered reveals (animation-delay)
creates more delight than scattered micro-interactions.
- Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer
CSS gradients, use geometric patterns, or add contextual effects that match the overall
aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the
context. Vary between light and dark themes, different fonts, different aesthetics. You
still tend to converge on common choices (Space Grotesk, for example) across
generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>

Refer to: `beui-components-analysis.md` in order to see what we can use initially.

# General Instructions
Keep your responses short between 400-600 characters unless asked to explain in detail. DO NOT explain in detail unless asked.

## Decisions log — read this first

`decisions.md` at the repo root records the design decisions taken on this
project and **why**, newest last. Read it before proposing architectural
changes: it explains deliberate omissions that would otherwise look like gaps
to be filled. Do not "fix" something the log records as an intentional choice.

When a new design decision is made in a session, append an entry to
`decisions.md`: a `## YYYY-MM-DD — <decision>` heading, then a body of **at most
200 characters** saying what the decision is and why. Keep it that short.

## What this is

AlphaLaw is a Django + DRF backend for an **HR policy engine**: a rule engine
that resolves which policy value (leave days, pay schedule, etc.) applies to
a given employee, based on conditions like country or tenure. The `policies`
app is the only local app and holds the entire domain model.

Alongside the Django app, the repo root has a **TypeScript reference
implementation** of the same schema (`schema.ts`, `data.ts`, `functions.ts`)
and a design note (`beui-components-analysis.md`) for a future POC frontend.
These `.ts` files are not wired into the Django app or any build — they're a
runnable spec/prototype of the rule-resolution logic that `policies/models.py`
implements in Django, useful for understanding intended behavior before
implementing it server-side (e.g. `resolveScopedRules`,
`getApplicableLeaveOptions` in `functions.ts` show how GLOBAL vs CONDITIONAL
rule precedence and additive tenure-bonus rules should resolve).
`base_db_schema.sql` is the original schema sketch (DBML-ish) that
`policies/models.py` translates into Django ORM form — Django models are now
the source of truth; regenerate migrations rather than hand-editing SQL.

## Commands

Activate the venv first (already created at `.venv/`):

```bash
source .venv/bin/activate
```

Common Django commands:

```bash
python manage.py runserver              # dev server
python manage.py makemigrations policies # after changing policies/models.py
python manage.py migrate                 # apply migrations
python manage.py test policies           # run tests (policies/tests.py is currently empty)
python manage.py shell                   # e.g. to run get_random_secret_key()
```

Setup: copy `.env.example` to `.env` and fill in `SECRET_KEY` and
`DATABASE_URL` (Postgres — `psycopg` v3 is the driver). `DEBUG` and
`ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` also come from `.env` via
`django-environ`.

There is no JS/TS package.json — the `.ts` files at the repo root are not
built or run; treat them as reference pseudocode, not a live app.

## Architecture

### Domain model (`policies/models.py`)

- `EmployeeInfo` — identity only (`name`). Every other fact, including
  `country`, `location`, and `joining_date`, lives in `EmployeeAttribute`.
  `tenure_years` is *not* a stored field; it's derived at evaluation time from
  the `joining_date` attribute value (see `functions.ts:calculateTenureYears`
  for the reference calculation — greater_than/less_than comparisons against
  `tenure_years` need the same derivation on the Django side).
- `PolicyCategory` — a named axis of policy (`LEAVE`, `PAY_SCHEDULE`, ...),
  one row per `PolicyCategoryName` enum value.
- `PolicyOption` — one possible value within a category (e.g. "12 days" under
  `LEAVE`), with a free-form `meta` JSONField whose shape depends on the
  category (`LeaveMeta`, `PayScheduleMeta` in `schema.ts` document the
  per-category shapes).
- `Rule` — links a `PolicyOption` (the outcome) to a validity window
  (`valid_from`/`valid_to`, `valid_to=null` meaning currently active) and a
  `scope`: `GLOBAL` (always applies) or `CONDITIONAL` (needs matching
  `RuleCondition`s). History is kept by closing out a rule's `valid_to` and
  inserting a new row rather than mutating in place.
- `RuleCondition` — one condition on a `CONDITIONAL` rule
  (`employee_attribute` `operator` `value`), chained to sibling conditions on
  the same rule via `combinator` (AND/OR).

Enum-valued columns (`PolicyCategory.type`, `Rule.scope`,
`RuleCondition.operator`/`combinator`) are enforced by Postgres `CHECK`
constraints, not just Django `TextChoices` — so **editing a `TextChoices` class
is a schema change** and needs a migration. Migration `0002` adds these, plus a
`valid_to > valid_from` check on `Rule`.

Rule resolution precedence (see `functions.ts:resolveScopedRules` for the
reference logic, not yet ported to Django): among rules for a category,
matching CONDITIONAL rules take precedence over GLOBAL; GLOBAL is only a
fallback when no CONDITIONAL rule matches. Tenure-based rules are additive
bonuses layered on top of the resolved base rule, not mutually exclusive
alternatives to it — don't fold them into the same precedence resolution.

### API layer (`policies/views.py`, `policies/serializers.py`)

Each model has a DRF `ModelViewSet` giving full CRUD for free. Notable
non-default behavior:
- `EmployeeInfoViewSet` — `?country=` filter.
- `PolicyOptionViewSet` — `?category_type=` filter (matches against
  `PolicyCategory.type`).
- `RuleViewSet` — `?active=true` filters to currently-valid rules
  (`valid_from <= now` and (`valid_to` null or `> now`)); `GET
  /api/rules/active/` is the same filter as a dedicated route.
- `RuleSerializer` nests `RuleCondition`s inline on create (one POST writes a
  rule and its conditions atomically) and cross-validates: a `GLOBAL` rule
  must have zero conditions, a `CONDITIONAL` rule must have at least one,
  and `valid_to` must be after `valid_from`.

Routing: `policies/urls.py` registers every viewset on a DRF `DefaultRouter`,
included from `config/urls.py` under `/api/` — so `/api/employees/`,
`/api/policy-categories/`, `/api/policy-options/`, `/api/rules/`, and
`/api/rule-conditions/` are live, alongside `/admin/`.

**No auth, by design.** `REST_FRAMEWORK` permissions are `AllowAny` everywhere
and every endpoint is open. This is a recorded decision, not an oversight — see
`decisions.md`. Do not add authentication, permission classes, or per-user
scoping unless asked.

### Settings (`config/settings.py`)

Config is env-driven via `django-environ`, reading `.env` at `BASE_DIR`.
`policies` is the only custom `INSTALLED_APPS` entry. CORS is open to
`localhost:3000`/`localhost:5173` by default for a future local frontend.
