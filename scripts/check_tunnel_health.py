"""Read-only ZGLAND Cloudflare Tunnel and statistics health diagnosis."""
import json
import urllib.request
import urllib.error
from dataclasses import dataclass
from typing import Optional

URLS = {
    "site": "https://zgland.com/",
    "stats_api": "https://zgland.com/api/site-stats",
    "tunnel_gateway": "https://quant.zgland.com/healthz",
}

def classify(status: Optional[int], body: str) -> tuple[str, bool]:
    if status is None:
        return "connection_failed", False
    if status == 530 and "1033" in body:
        return "cloudflare_tunnel_disconnected_1033", False
    if 200 <= status < 300:
        return "http_healthy", True
    if status == 401:
        return "authentication_required_not_business_health", True
    if status == 503:
        return "upstream_unavailable", False
    if status >= 500:
        return "server_error", False
    if status >= 400:
        return "http_error", False
    return "unexpected_status", False

def probe(url: str, timeout: int = 8) -> dict:
    status = None
    body = ""
    err = ""
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "ZGLAND-readonly-health-check/1.0"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = response.status
            body = response.read(350).decode("utf-8", "replace")
    except urllib.error.HTTPError as ex:
        status = ex.code
        body = ex.read(350).decode("utf-8", "replace")
    except Exception as ex:
        err = type(ex).__name__ + ": " + str(ex)[:150]
    category, ok = classify(status, body)
    result = {"url": url, "http_status": status, "category": category, "ok": ok}
    if err:
        result["error"] = err
    # Do not record bodies, headers, cookies, credentials or user identifiers.
    return result

def diagnose() -> dict:
    findings = {key: probe(url) for key, url in URLS.items()}
    gateway = findings["tunnel_gateway"]
    stats = findings["stats_api"]
    site = findings["site"]
    healthy = bool(site["ok"] and stats["ok"] and gateway["ok"])
    cause = ("Tunnel 1033: reconnect or repair cloudflared on the authorized server"
             if gateway["category"] == "cloudflare_tunnel_disconnected_1033"
             else "Statistics or gateway not fully reachable" if not healthy
             else "Site and statistics responding; a 401 gateway checks access only, not application health")
    return {"ok": healthy, "checks": findings, "diagnosis": cause}

if __name__ == "__main__":
    result = diagnose()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["ok"] else 1)
