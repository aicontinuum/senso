# Pre-Launch TODO

## Security

- [ ] **Tighten `customers_update_own_record` RLS policy** — current policy allows customers to UPDATE any column on their own row. The API only passes through `contact_name`, `phone`, and `alert_recipients`, but the DB policy is broader. Before go-live, restrict it to only those three columns using a Postgres function or column-level grants, so a direct API call can't touch `email`, `name`, or `billing_status`.

- [ ] **Secure the ingest API (`POST /api/ingest`)** — currently authenticates gateways by MAC address alone. Any party who knows a registered MAC can post readings. Before go-live, replace with HMAC-signed payloads or a per-gateway shared secret header so only the physical device can ingest data.
