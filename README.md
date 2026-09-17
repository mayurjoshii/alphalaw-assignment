# alphalaw backend

Django + Django REST Framework over local Postgres.

## Setup (first time)

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
createdb alphalaw
cp .env.example .env          # then edit DATABASE_URL
.venv/bin/python manage.py migrate
```

## Run

```bash
source .venv/bin/activate     # or prefix every command with .venv/bin/
python manage.py runserver    # http://127.0.0.1:8000/api/
```

DRF serves a browsable HTML API at `/api/` — you can POST from the browser
without Postman. `python manage.py createsuperuser` unlocks `/admin/`.

## Layout

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
`/api/rules/`, `/api/rule-conditions/` — each supports
`GET` (list), `POST` (create), and `GET/PUT/PATCH/DELETE /{id}/`.

Extras: `?country=US` on employees, `?category_type=LEAVE` on policy-options,
`?active=true` and `GET /api/rules/active/` on rules.

## Changing the schema

Edit `policies/models.py`, then:

```bash
python manage.py makemigrations && python manage.py migrate
```
