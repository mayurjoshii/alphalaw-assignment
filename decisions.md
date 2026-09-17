# Decisions

A running log of design decisions for the alphalaw backend, newest last.
INstruction for AI agent: Whatever decision you add, limit your input to 200 characters, in short mentioning what is the decision and why was it taken.

## 2026-09-17 — No authentication in this version

No auth: DRF permissions are `AllowAny`, every `/api/` endpoint is open. No client and no multi-tenant need yet, so auth would be unexercised scaffolding. Local dev only — do not deploy as-is.

## 2026-09-17 — attributes tables without company_id

Dropped `company_id` from attributes/attribute_values: no companies table and no multi-tenancy yet, matching the no-auth decision. Uniqueness is (attribute_key, value).

## Sticking to userflows such as department, leave, location, gender as of Now
## 2026-09-17 — Employee facts live only in employee_attributes

Dropped gender/location/country columns from employee_info; those facts are attributes now, so there is one source. joining_date stays a typed column because tenure derives from it.

## 2026-09-17 — location is the only place attribute, values US/IN

Dropped the `country` attribute and switched location's options to US/IN. Two attributes for one fact let employees hold contradictory values (location=USA, country=IN).


## 2026-09-17 — joining_date moved from employee_info to employee_attributes

Dropped the typed `joining_date` column; it's an EmployeeAttribute now like other facts. tenure_years derives from that attribute's value, not a column. Edited migration 0001 directly (solo dev, no team to desync). 
## 2026-09-17 — POC frontend resolves policies client-side

`frontend/src/lib/resolve.ts` ports functions.ts to the browser. Django has no resolution endpoint, and local eval is what lets an unsaved employee preview entitlements on blur.

## 2026-09-17 — Resolution strategy is read off option meta

Options carrying a number (meta.days) accumulate; the rest select one, CONDITIONAL over GLOBAL. Leave days stack, pay schedules cannot — so the category's data decides, not a hardcoded list.

## 2026-09-18 — Effective-dating for EmployeeAttribute and enforced Rule supersede

Mirrored `Rule`'s valid_from/valid_to pattern onto `EmployeeAttribute` (add fields, partial unique on open rows, check constraint on period). Rule/EmployeeAttribute edits now close old row (valid_to=now), create new row instead of mutating in place. Enables full history view per employee & category. No materialized assignment table — both input tables are effective-dated; "what was true at T" is reconstructible by filtering both on `valid_from <= T < valid_to-or-null` and re-resolving.

## 2026-09-18 — Timeline endpoints surface candidate rules, not resolved outcomes

`/policy-options/:id/timeline/` and `/employees/:id/timeline/` are new Django read endpoints for the dashboard's history pages. The employee one lists attribute changes plus rules referencing each changed key, but does NOT resolve which rule actually won at each past timestamp — that needs the point-in-time condition-matching engine, which per the prior "resolves client-side" decision isn't ported to Django. Full historical resolution is future work.

## 2026-09-18 — Fixed api.list() to follow DRF pagination

`api.list()` only read page 1 (PAGE_SIZE=25), silently dropping rows past it — surfaced by policy options (31 rows) rendering raw UUIDs instead of labels in the new history view. Now follows `next` until exhausted.
