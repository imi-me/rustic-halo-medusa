"""Forward Stripe test events locally and save the signing secret without printing it."""
import os
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
env_file = root / "apps/backend/.env"
values = dict(
    line.split("=", 1) for line in env_file.read_text().splitlines()
    if "=" in line and not line.lstrip().startswith("#")
)
key = values.get("STRIPE_API_KEY", "").strip().strip("\"'")
if not key.startswith("sk_test_"):
    raise SystemExit("A saved Stripe test secret key is required.")
env = os.environ.copy()
env["STRIPE_API_KEY"] = key
env["PATH"] = str(root / ".local/node-v22.23.2-darwin-arm64/bin") + os.pathsep + env["PATH"]
process = subprocess.Popen([
    str(root / ".local/stripe-cli/node_modules/.bin/stripe"),
    "--config", str(root / ".local/config/stripe.toml"),
    "listen", "--skip-update", "--events-from", "@self",
    "--events", "payment_intent.succeeded,payment_intent.payment_failed,payment_intent.amount_capturable_updated,payment_intent.canceled",
    "--forward-to", "http://127.0.0.1:9000/hooks/payment/stripe_stripe",
], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    for line in process.stdout:
        match = re.search(r"whsec_[A-Za-z0-9]+", line)
        if match:
            content = env_file.read_text()
            setting = "STRIPE_WEBHOOK_SECRET=" + match.group()
            if re.search(r"^STRIPE_WEBHOOK_SECRET=.*$", content, re.M):
                content = re.sub(r"^STRIPE_WEBHOOK_SECRET=.*$", setting, content, flags=re.M)
            else:
                content += "\n" + setting + "\n"
            env_file.write_text(content)
            env_file.chmod(0o600)
            print("Stripe test listener ready; signing secret saved privately. Restart the backend if the secret changed.", flush=True)
        else:
            print(re.sub(r"(?:sk|pk|whsec)_[A-Za-z0-9_]+", "[redacted]", line), end="", flush=True)
    raise SystemExit(process.wait())
finally:
    if process.poll() is None:
        process.terminate()
