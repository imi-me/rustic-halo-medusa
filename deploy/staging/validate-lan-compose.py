#!/usr/bin/env python3
"""Validate that only the staging storefront is reachable on the LAN."""

import json
from pathlib import Path
import sys


def validate(config: dict, lan_ip: str) -> None:
    services = config["services"]

    def ports(service: str) -> list[dict]:
        return services[service].get("ports", [])

    storefront_lan = [
        port
        for port in ports("storefront")
        if port.get("host_ip") == lan_ip
        and int(port.get("published", 0)) == 18000
        and int(port.get("target", 0)) == 8000
    ]
    if len(storefront_lan) != 1:
        raise ValueError("Expected one LAN storefront binding")

    for service in ("backend", "postgres", "redis"):
        for port in ports(service):
            if port.get("host_ip") not in (None, "127.0.0.1"):
                raise ValueError(f"Refusing LAN exposure for {service}")

    backend = ports("backend")
    if len(backend) != 1 or backend[0].get("host_ip") != "127.0.0.1":
        raise ValueError("Backend/Admin must remain loopback-only")


if __name__ == "__main__":
    validate(json.loads(Path(sys.argv[1]).read_text()), sys.argv[2])
    print("LAN_COMPOSE_VALID")
