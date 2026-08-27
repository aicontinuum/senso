# Senso Network Server — Self-Hosted ChirpStack

The LoRaWAN Network Server sitting between customer-site gateways and our backend.
**Live since 2026-08-22.** See `MIGRATION.md` at the repo root for the overall
Pi → LoRaWAN migration context.

This is an **as-built** record of what is actually deployed — not a plan.
For the uplink JSON this server emits to our backend, see **`UPLINK-FORMAT.md`**.

> Repo is private. This file names hosts, paths, and ports (no credentials — those live in
> the password manager). Scrub before the repo ever goes public; same caveat as the
> corresponding item in `TODO.md`.

---

## 1. What's deployed

| | |
|---|---|
| Provider | Hostinger KVM, **Mumbai** |
| OS | Ubuntu 24.04.4 LTS |
| Hostname | `srv1922115` |
| Public IP | `187.127.218.61` |
| Access | `ssh root@187.127.218.61` — key-based (ed25519 `senso-vps`, passphrase). Root password in the password manager as a Hostinger-console fallback if SSH ever breaks. |
| Stack dir | `/opt/senso/chirpstack-docker/` |
| Dashboard | **https://lns.sensoqa.com** — user `admin`, password changed from the default ✓ |

Mumbai is ~2,000 km from Doha — closer than the European regions originally considered.

## 2. Install method — Docker (not native apt/systemd)

Deployed from the official **`github.com/chirpstack/chirpstack-docker`** into
`/opt/senso/chirpstack-docker/`. Docker 29.7.2 / Compose v5.5.0, pre-installed on the
Hostinger image. Edited files have local backups alongside them
(`docker-compose.yml.bak`, `chirpstack.toml.bak`).

**8 containers:**

| Container | Role |
|---|---|
| `chirpstack` | Network + application server (v4 single binary); UI/API on :8080 |
| `chirpstack-gateway-bridge` | Semtech UDP packet-forwarder listener (**UDP 1700**) — what the M2 talks to |
| `chirpstack-gateway-bridge-basicstation` | Basics Station listener — unused today, future upgrade path |
| `chirpstack-rest-api` | REST wrapper over the gRPC API |
| `postgres` (14-alpine) | Device / gateway / join state — **not** sensor readings |
| `redis` (7-alpine) | Cache |
| `mosquitto` (eclipse-mosquitto:2) | Internal MQTT bus |
| `caddy` (caddy:2) | Reverse proxy + automatic HTTPS (hand-added as the 8th service) |

## 3. TLS + DNS

Caddy fronts ChirpStack so port 8080 is never exposed directly.
`/opt/senso/chirpstack-docker/Caddyfile`:

```
lns.sensoqa.com {
    reverse_proxy chirpstack:8080
}
```

Let's Encrypt certificate issued and auto-renewing.

**DNS (Cloudflare):** `lns.sensoqa.com` → A → `187.127.218.61`, **grey cloud (DNS only)**.

> ⚠️ **Keep it grey.** Switching to orange (proxied) collides with Caddy's certificate
> handling and breaks HTTPS unless Caddy is reconfigured for that first.

Harmless log noise, safe to ignore: `Caddyfile is not formatted` (cosmetic) and
`failed to increase receive buffer size` (UDP buffer note).

## 4. ⚠️ Region rule — register every Qatar device as `eu868`

`configuration/chirpstack/chirpstack.toml` has **all regions enabled**, deliberately, to
keep future expansion open. That removes the config-level guardrail, so the safeguard
moves to registration time:

**Every device and gateway registered for Qatar must have `eu868` selected explicitly.**
Both the SenseCAP M2 and the Dragino LHT65N-E3 are EU868 hardware; anything registered
under the wrong region will not work correctly.

## 5. Firewall (ufw)

Active, enabled on boot. Default **deny incoming / allow outgoing**. Open: `22/tcp`,
`80/tcp`, `443/tcp` (IPv4 + IPv6).

> ⚠️ **Known gap — deferred, not yet audited.** Docker writes its own iptables rules that
> **bypass ufw**, so any port published in `docker-compose.yml` is reachable from the
> internet regardless of what ufw says. That is how UDP 1700 reaches the gateway-bridge
> despite not appearing in the ufw allow-list — and it means ufw is **not** a second layer
> in front of Postgres/Redis. If those are published in the compose file, they are
> internet-exposed on whatever credentials they carry.
>
> To audit, on the box:
> ```bash
> cd /opt/senso/chirpstack-docker
> docker compose ps                      # look for 0.0.0.0: bindings in PORTS
> ss -tulnp | grep -E '5432|6379'
> ```
> From another machine: `nc -zv 187.127.218.61 5432`. Fix if exposed: remove those
> `ports:` entries — containers still reach each other over the internal Docker network
> without them.

## 6. Common operations

```bash
cd /opt/senso/chirpstack-docker

docker compose ps                              # what's running + published ports
docker compose logs -f chirpstack              # follow one service's logs
docker compose restart <service>
docker compose pull && docker compose up -d    # update images
```

## 7. Resilience checklist

- [x] **Auto-restart** — the upstream compose file sets restart policies on its services.
      **Still verify the hand-added `caddy` service has one** — without it, a Caddy crash
      takes the dashboard and HTTPS down and they stay down.
- [ ] **Automated database backups** — scheduled `pg_dump` of the `postgres` container,
      stored off the VPS. *(The `.bak` files in the stack dir are config backups only —
      they are not database backups.)*
- [ ] **VPS snapshots** — Hostinger-level scheduled snapshots, so a dead server is a
      restore rather than a rebuild.
- [ ] **External uptime monitor** — UptimeRobot / Healthchecks.io hitting
      `https://lns.sensoqa.com` every minute and alerting on failure. This is what makes
      an outage *loud* rather than a silent gap in the compliance record.
- [ ] **Backend consumer resilience** — Phase 4 work: the ingest path must not silently
      drop uplinks during its own restarts or deploys.

Our 15-min reading cadence and 35-min sensor-staleness threshold already absorb a short
NS blip with no customer-visible effect. The goal is "recovers well inside that window,
and pages someone if it doesn't" — not literal zero downtime, which nobody has.

## 8. Tenancy model

ChirpStack has two grouping levels:

- **Tenant = customer.** Gateways live at tenant level, shared across that customer's
  applications.
- **Application = branch/site** (a device group inside a tenant).

Customers never see ChirpStack — they only ever see senso.com. The customer-facing
grouping must therefore exist in **our** schema too: `customers → sites → gateways/sensors`
(a `sites`/`branches` table is a Phase 5 consideration).

## 9. Registered objects (test)

All under the default tenant `ChirpStack` (`ae2e1b59-bf1e-420f-a733-bfbf08eb8aca`) —
real customers get their own tenants.

| Object | Name | ID |
|---|---|---|
| Application | `senso-test` | `635fda7b-0428-495e-812f-027490bcaf9d` |
| Device profile | `Dargino LHT65N` *(typo, to fix)* | `bc0b05d1-d5ec-4126-9451-42403f143a9f` |
| Device | `sensor0` | DevEUI `a840419edb62011c` · DevAddr `01087309` · Class A |
| Gateway | `gateway1` | EUI `2cf7f11081400088` |

**Device profile:** EU868 · LoRaWAN 1.0.3 · regional params A (RP001 1.0.3) · OTAA ·
expected uplink interval 1200 s *(→ 900 s once the 15-min downlink applies)* · payload
codec = official Dragino **ChirpStack 4.0** decoder
(`github.com/dragino/dragino-end-node-decoder`).

> ⚠️ Use the **v4** decoder. v3-era decoders throw `UPLINK_CODEC` errors on ChirpStack v4.

**Changing a device's reporting interval:** downlink command `0x01` + 3 bytes of seconds,
on **fPort 1**. 15 min = 900 s = HEX `01000384`. Enqueue under Device → Queue (HEX).
Class A devices only listen right after an uplink, so a queued downlink stays pending
until the next one — that's normal, not a failure.

Device AppKeys are **not** stored in this repo — they live in the founder's password
manager.

## 10. Migration flexibility (for later)

Self-host now; move to managed hosting (e.g. chirphost) later if upkeep gets old — same
ChirpStack software either direction, no rebuild. Moving means: re-register devices and
gateways (scriptable via the ChirpStack API, or manual re-entry at small scale — we hold
every DevEUI/AppKey ourselves as a fallback), re-point each physical gateway's server
address, and re-point our backend integration. Effort scales with the number of gateways
deployed at the time.

Because gateways point at **`lns.sensoqa.com`** rather than a raw IP, moving the server
itself is a DNS change rather than a visit to every gateway.
