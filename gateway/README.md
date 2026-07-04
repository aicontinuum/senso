# Senso Gateway — Wi-Fi Resilience Kit

Keeps a Raspberry Pi gateway (running **NetworkManager**) online across Wi-Fi
drops of any length, and recovers on its own instead of needing a manual
power-cycle.

## Three layers

1. **Stop the drop** — `wifi-powersave-off.conf` disables Wi-Fi power management.
   The Pi Zero 2W's radio can sleep after an AP drop and not wake cleanly; this
   is the single biggest cause of gateways that go silent and stay silent.
2. **Auto-reconnect** — `setup.sh` sets the Wi-Fi connection to `autoconnect`
   with **unlimited retries** (`autoconnect-retries 0`), so whenever the access
   point comes back — after 5, 10, or 30 minutes — the Pi rejoins on its own.
3. **Watchdog** — `net-watchdog.sh` (run every minute by `net-watchdog.timer`)
   pings a target and, if it stays unreachable, escalates: force-reconnect →
   restart NetworkManager → reboot. This catches the case where the driver or
   NetworkManager itself gets wedged and won't reconnect even though the AP is
   back.

Pairs with the hardware watchdog (see the repo's `TODO.md`) for total hangs.

## Install

Copy this folder to the Pi (e.g. `scp -r gateway senso@senso-gateway-01:~/`),
then on the Pi:

```bash
cd gateway
sudo ./setup.sh
sudo reboot
```

The reboot applies the power-save setting cleanly. `setup.sh` deliberately does
**not** restart NetworkManager, so running it over an SSH-over-Wi-Fi session
won't drop your connection mid-setup.

## Verify

```bash
iw dev wlan0 get power_save                 # expect: Power save: off
nmcli -f connection.autoconnect,connection.autoconnect-retries connection show <your-wifi>
                                            # expect: yes / 0
systemctl status net-watchdog.timer         # expect: active (waiting)
journalctl -t net-watchdog --since "10 min ago"   # watchdog activity
```

Real-world test: switch the router/Wi-Fi off for ~10 minutes, then back on. The
Pi should rejoin by itself, readings resume, and the gateway flips back to
**Online** on the dashboard within a few minutes.

## Tuning

Thresholds live at the top of `net-watchdog.sh`:

| Variable | Default | Meaning |
|----------|---------|---------|
| `PING_TARGET`   | `1.1.1.1` | Host that defines "connected". A router IP works for LAN-only checks. |
| `BOUNCE_AFTER`  | `2`  | Minutes down before forcing a reconnect. |
| `RESTART_AFTER` | `5`  | Minutes down before restarting NetworkManager. |
| `REBOOT_AFTER`  | `15` | Minutes down before rebooting. Set to `0` to never reboot. |

After editing, re-run `sudo ./setup.sh` (or copy the script to
`/usr/local/bin/net-watchdog.sh`).
