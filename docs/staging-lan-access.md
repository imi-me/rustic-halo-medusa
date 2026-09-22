# Staging access from the local network

The staging storefront is exposed on the VM's VLAN 69 address for review from
another device on the local network:

- Storefront: `http://10.20.69.159:18000/us`
- Medusa Admin: not exposed on the LAN
- PostgreSQL and Redis: not exposed on the LAN

The public protected staging address remains
`https://staging.rustichalo.com/us`. Use the public HTTPS address for checkout
and payment testing. Direct LAN access uses HTTP and is intended for visual and
catalog review only.

The optional `compose.lan.yaml` adds a second storefront binding while
preserving the existing loopback binding. `enable-lan-storefront.sh` verifies
that the address is private and currently assigned to the VM, renders the full
Compose configuration, rejects LAN exposure of backend/Admin, PostgreSQL, or
Redis, starts only the storefront service, and checks the resulting page.

Run on the staging VM:

```sh
sudo /home/shawnhouse/rustic-halo-staging/enable-lan-storefront.sh
```

If the VM's reserved address changes, set `LAN_STOREFRONT_IP` explicitly and
update this document. The VM should retain its UniFi fixed-address reservation.
Do not add router port forwarding for port 18000.

## Verification — September 22, 2026

The staging VM's setup command reported `LAN_COMPOSE_VALID` and
`LAN_STOREFRONT_READY`. A separate request from the Mac received HTTP 200 at
`http://10.20.69.159:18000/us`. The same Mac could not connect to
`10.20.69.159:19000`, confirming that Admin was not published on the VM's LAN
address. A second Mac still needs a direct browser check; its network or VLAN
rules could differ from the first Mac's.
