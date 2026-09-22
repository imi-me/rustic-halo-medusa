# Staging access from the local network

The staging storefront may be exposed on the VM's VLAN 69 address for review
from another device on the local network:

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
