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