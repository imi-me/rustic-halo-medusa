# Restricted staging operations

Prepared for the owner's September 21 request to reduce repeated administrator
password prompts. Installed and verified on September 21.

Installed commands (no additional arguments permitted):

- `sudo -n /usr/local/sbin/rustic-halo-ops status`
- `sudo -n /usr/local/sbin/rustic-halo-ops deploy storefront`
- `sudo -n /usr/local/sbin/rustic-halo-ops deploy backend`
- `sudo -n /usr/local/sbin/rustic-halo-ops restart storefront`
- `sudo -n /usr/local/sbin/rustic-halo-ops restart backend`

The installer snapshots and validates the existing staging app configuration,
including current environment values, into root-only storage. It installs a
reviewed Dockerfile and isolated Python helper owned by root. Runtime operations
never read user-writable Compose configuration or execute user-supplied scripts
as host root. App containers run as node; only fixed loopback ports are allowed.
No bind mounts, devices, privileged containers or extra capabilities are allowed.
The backend remains off the preview network. Database/Redis containers are not
included in the managed configuration and are never restarted by this helper.

Deployment packages the source tree using shawnhouse's permissions, rejects
symlinks, hard links and special files, and extracts regular files into a
root-owned build context. Build outputs execute application code and therefore
retain normal application access to its database and service credentials. This
is deployment authority for the app, not a claim of isolating malicious app code
from its own data. Storefront build networking preserves the existing host-build
network needed by its build-time backend requests. Host administration, new
privileged scripts, Compose/Dockerfile changes, and credential updates still need
an administrator-reviewed installation change.

Each operation takes a root-owned lock and writes sanitized progress to
/var/lib/rustic-halo-ops/status.json, readable via the status command. Build logs
stay root-only. Deployment tags the prior image before rebuilding. It does not
automatically roll back database changes or retry a failed deployment. Health
checks use fixed local URLs and bounded retries. No orders or emails are sent
by the helper itself.

Five local tests passed: exact argument allowlist, host privilege rejection,
build privilege rejection, loopback-only exposure, and frozen build paths/literal
environment preservation. Python parsing and shell syntax checks passed.
Installation validates sudoers before granting access and cleans up this new
installation if validation fails. It does not add shawnhouse to the Docker group.

After the owner installs, verify status succeeds without a password and an
unlisted invocation is rejected; then use the helper for the next required app
deployment instead of creating new password commands. No deployment is needed
merely to test installation. Avoid polling unchanged builds more than necessary.

Verification at 2026-09-21T14:23:47.708250+00:00 confirmed the restricted
status command runs without a password, the storefront is running, and the
backend is running and healthy. A database deployment invocation was rejected
by sudo. The executable is root-owned mode 0755, its configuration directory
and state directory are root-owned mode 0700, and the sudoers rule is root-owned
mode 0440. The normal account cannot inspect or modify the frozen configuration.

To revoke access, an administrator can remove only
/etc/sudoers.d/rustic-halo-ops. Root-owned helper/config/state can be retained for
review or removed separately. Do not loosen the allowlist to accept arbitrary
shell commands or user-writable scripts.
