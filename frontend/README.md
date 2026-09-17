# Policy Desk — POC frontend

React + Tailwind front end for the AlphaLaw policy engine. Covers the four
flows in `beui-components-analysis.md`: add an employee, add a policy
category, edit an employee's values, and view the entitlements the rule engine
resolved for them in a table beside the open panel.

## Running it

The Django API must be up first — it is the only data source.

```bash
# terminal 1, from the repo root
source .venv/bin/activate
python manage.py runserver        # 127.0.0.1:8000

# terminal 2, from frontend/
npm install
npm run dev                       # localhost:5173
```

Vite proxies `/api` to `127.0.0.1:8000` (see `vite.config.ts`), so the browser
only ever talks to one origin — no CORS preflight, no API base URL to
configure. Change `DJANGO_ORIGIN` there if the backend moves.

```bash
npm run typecheck    # tsc, no emit
npm run build        # production bundle into dist/
```

## Screens

**Directory** (`components/employees/`) — every employee with their attributes,
derived tenure, and headline entitlement. Clicking a row opens the panel;
`+ New employee` opens the same panel empty.

**Employee panel** — a wide right-hand drawer split in two: the edit form on
the left, the resolved-policy table on the right. Changing a value on the left
re-runs the engine and the right side moves. Evaluation fires **on blur** for
typed fields and immediately for pickers, per the decision recorded in
`MJ-api-endpoints.md` — a selection is already a finished decision, a
half-typed date is not.

**Policy studio** (`components/policies/`) — the active rule set grouped by
category, each option showing the conditions that grant it. `+ New category`
opens a composer that writes the category, its options, and a rule per option
in dependency order.

## How resolution works

`lib/resolve.ts` is a client-side port of the reference engine in the repo
root's `functions.ts`, adapted to the attributes model. It runs in the browser
because Django has no resolution endpoint yet — and because that is what lets
an unsaved employee show their entitlements live.

Given an employee's facts it filters to rules in force today
(`valid_from`/`valid_to`), evaluates each rule's conditions (folding
`combinator` left to right), and then resolves per category using a strategy
read off the data rather than hardcoded:

| Options look like | Strategy | Behaviour |
| --- | --- | --- |
| carry a number (`meta.days`) | `accumulate` | every matching rule stacks — global allowance + location top-up + tenure bonus |
| anything else | `select-one` | a matching `CONDITIONAL` rule beats the `GLOBAL` fallback; exactly one wins |

That split is deliberate: leave days add up (MJ-api-endpoints.md), but nobody
is paid biweekly *and* monthly (`functions.ts:resolveScopedRules`).

`tenure_years` is derived from `joining_date` at evaluation time and never
stored. It has no `Attribute` row server-side, so `types/domain.ts` supplies a
synthetic one — otherwise the condition builder could not author a tenure
rule.

## Layout

```
src/
├─ components/
│  ├─ ui/              Drawer, Accordion, CountUp, Toast, primitives
│  ├─ employees/       Directory, Panel, Form, ResolvedPolicyTable
│  └─ policies/        PolicyStudio, CategoryComposer, RuleBuilder
├─ lib/
│  ├─ api.ts           fetch wrapper, unwraps DRF pagination
│  ├─ queries.ts       React Query hooks, one per resource
│  └─ resolve.ts       the rule engine
└─ types/domain.ts     mirrors policies/serializers.py
```

The `ui/` set is the beUI mapping from `beui-components-analysis.md` — written
here in the project's own palette rather than pasted with beUI's defaults, so
the aesthetic stays consistent.

## Design

An "archival ledger": bone paper, ink-black type, oxblood for chrome, brass
for anything additive, verdigris for a resolved outcome. Bricolage Grotesque
for display, IBM Plex Mono for data — values a rule engine computed read as
data, not prose. Tokens live in `src/index.css` under `@theme`; change them
there and the whole app follows.

## Known gaps

- Resolution is client-side. Once Django grows a `/api/employees/{id}/policies/`
  endpoint, `lib/resolve.ts` becomes the reference implementation for it and
  the panel switches to fetching.
- The category composer creates; it does not yet edit or supersede an existing
  rule (closing `valid_to` and inserting a replacement).
- `meta` is a free-form JSONField, so an option can hold `{"days": "ten"}`.
  `resolve.ts` only sums real numbers; the composer only writes them.
