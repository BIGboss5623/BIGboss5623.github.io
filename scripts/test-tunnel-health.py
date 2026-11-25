"""Offline classification tests; no network requests."""
import importlib.util
from pathlib import Path
path = Path(__file__).with_name("check_tunnel_health.py")
spec = importlib.util.spec_from_file_location("tunnel", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
c = module.classify
assert c(530, "error code: 1033") == ("cloudflare_tunnel_disconnected_1033", False)
assert c(530, "other 530") == ("server_error", False)
assert c(503, "") == ("upstream_unavailable", False)
assert c(401, "") == ("authentication_required_not_business_health", True)
assert c(200, "") == ("http_healthy", True)
assert c(None, "") == ("connection_failed", False)
print("PASS tunnel failure classification and conservative gateway status")
