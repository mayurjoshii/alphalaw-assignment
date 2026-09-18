# AlphaLaw — HR Policy Engine

A rule engine that resolves which policy value (leave days, pay schedule,
etc.) applies to a given employee, based on conditions like country, location,
or tenure. Django + DRF backend, Postgres storage, plus a React POC frontend
for browsing and editing policies/employees.

## What's in the repo

| Path | What it is |
|---|---|
| `policies/` | The Django app — the entire domain model (employees, attributes, policy categories/options, rules, conditions) |
| `config/` | Django project settings/urls |
| `frontend/` | React + Vite POC UI — see `frontend/README.md` for its own setup/screens |
| `schema.ts`, `data.ts`, `functions.ts` | TypeScript reference implementation of the same schema + rule-resolution logic (`resolveScopedRules`, `getApplicableLeaveOptions`). Not wired into any build — read as spec/pseudocode for what the Django side should do |
| `base_db_schema.sql` | Original schema sketch; `policies/models.py` is now the source of truth |
| `decisions.md` | Log of design decisions and why — **read before proposing architectural changes** |

### Domain model in one paragraph

An `EmployeeInfo` just has a name; every fact about them (country, location,
joining date) is a time-boxed `EmployeeAttribute`. A `PolicyOption` (e.g. "12
days" under the `LEAVE` category) is granted by a `Rule`, which is either
`GLOBAL` (always applies) or `CONDITIONAL` (needs matching `RuleCondition`s on
an employee's attributes). Matching CONDITIONAL rules beat GLOBAL; both rules
and attributes are effective-dated (`valid_from`/`valid_to`) so history is
kept by closing a row and inserting a new one, never mutating in place.

## Getting started (backend)

Requires Python 3.12 and a local Postgres.

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
createdb alphalaw
cp .env.example .env          # fill in SECRET_KEY and DATABASE_URL
source .venv/bin/activate
python manage.py migrate
python manage.py runserver    # http://127.0.0.1:8000/api/
```

DRF's browsable API lets you GET/POST from the browser at `/api/` — no
Postman needed. `python manage.py createsuperuser` unlocks `/admin/`.

There's no auth on any endpoint — deliberate for this stage, see
`decisions.md`.

## Getting started (frontend)

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api to Django
```

Backend must already be running — the frontend has no data of its own. Full
details (screens, how resolution works, known gaps) are in
`frontend/README.md`.

## Backend layout

| Path | Role |
|---|---|
| `config/settings.py` | env-driven config: Postgres via `DATABASE_URL`, DRF, CORS |
| `config/urls.py` | mounts `/admin/` and `/api/` |
| `policies/models.py` | tables (translation of `base_db_schema.sql`) |
| `policies/serializers.py` | request validation + JSON shape |
| `policies/views.py` | ViewSets — one class per resource, full CRUD |
| `policies/urls.py` | router that turns ViewSets into URLs |
| `policies/migrations/` | generated, checked in — never hand-edit |

## Endpoints

`/api/employees/`, `/api/policy-categories/`, `/api/policy-options/`,
`/api/rules/`, `/api/rule-conditions/`, `/api/attributes/`,
`/api/attribute-values/`, `/api/employee-attributes/` — each supports `GET`
(list), `POST` (create), and `GET/PUT/PATCH/DELETE /{id}/`.

Extras:
- `?country=US` on employees
- `?category_type=LEAVE` on policy-options
- `?active=true` and `GET /api/rules/active/` on rules
- `GET /api/policy-options/{id}/timeline/` and
  `GET /api/employees/{id}/timeline/` — history of attribute/rule changes for
  the dashboard's timeline views (candidate rules only, not point-in-time
  resolved outcomes — see `decisions.md`)

## Changing the schema

Edit `policies/models.py`, then:

```bash
python manage.py makemigrations policies
python manage.py migrate
```

Enum fields (`PolicyCategory.type`, `Rule.scope`, `RuleCondition.operator`/
`combinator`) are backed by Postgres `CHECK` constraints, so editing a
`TextChoices` class is a schema change and needs a migration.

## Tests

```bash
python manage.py test policies
```
