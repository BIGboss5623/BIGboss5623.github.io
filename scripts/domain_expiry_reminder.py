#!/usr/bin/env python3
"""Check zgland.com expiry and send a reminder through the site's mail service."""

from __future__ import annotations

import argparse
import calendar
import json
import re
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone


DOMAIN = "zgland.com"
RECIPIENT = "648974542@qq.com"
ALIYUN_CONSOLE = "https://dc.console.aliyun.com/next/index#/domain-list/all"
RDAP_URL = f"https://rdap.verisign.com/com/v1/domain/{DOMAIN}"
FALLBACK_EXPIRY = datetime(2027, 8, 9, 13, 24, 13, tzinfo=timezone.utc)


def request_json(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None) -> dict:
    request_headers = {"User-Agent": "zgland-domain-reminder/1.0"}
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, data=data, headers=request_headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def expiry_from_rdap() -> datetime:
    payload = request_json(RDAP_URL, headers={"Accept": "application/rdap+json"})
    for event in payload.get("events", []):
        if event.get("eventAction") == "expiration":
            return datetime.fromisoformat(event["eventDate"].replace("Z", "+00:00"))
    raise RuntimeError("RDAP response has no expiration event")


def expiry_from_whois() -> datetime:
    with socket.create_connection(("whois.verisign-grs.com", 43), timeout=20) as connection:
        connection.sendall(f"{DOMAIN}\r\n".encode("ascii"))
        chunks: list[bytes] = []
        while True:
            chunk = connection.recv(8192)
            if not chunk:
                break
            chunks.append(chunk)
    text = b"".join(chunks).decode("utf-8", errors="replace")
    match = re.search(r"Registry Expiry Date:\s*(\S+)", text, re.IGNORECASE)
    if not match:
        raise RuntimeError("WHOIS response has no registry expiry date")
    return datetime.fromisoformat(match.group(1).replace("Z", "+00:00"))


def get_expiry() -> tuple[datetime, str]:
    try:
        return expiry_from_rdap(), "Verisign RDAP"
    except Exception as rdap_error:
        print(f"RDAP query failed: {rdap_error}", file=sys.stderr)
    try:
        return expiry_from_whois(), "Verisign WHOIS"
    except Exception as whois_error:
        print(f"WHOIS query failed: {whois_error}", file=sys.stderr)
    return FALLBACK_EXPIRY, "local fallback"


def one_calendar_month_before(value: date) -> date:
    year = value.year
    month = value.month - 1
    if month == 0:
        month = 12
        year -= 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def send_email(subject: str, message: str) -> None:
    endpoint = f"https://formsubmit.co/ajax/{urllib.parse.quote(RECIPIENT)}"
    form = urllib.parse.urlencode(
        {
            "_subject": subject,
            "_template": "table",
            "_captcha": "false",
            "域名": DOMAIN,
            "提醒内容": message,
            "管理入口": ALIYUN_CONSOLE,
        }
    ).encode("utf-8")
    result = request_json(
        endpoint,
        data=form,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
    )
    if result.get("success") not in (True, "true"):
        raise RuntimeError(f"mail service rejected the reminder: {result}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--send-test", action="store_true", help="send a test email immediately")
    args = parser.parse_args()

    expiry, source = get_expiry()
    expiry_date = expiry.astimezone(timezone.utc).date()
    today = datetime.now(timezone.utc).date()
    days_left = (expiry_date - today).days
    month_before = one_calendar_month_before(expiry_date)
    print(f"domain={DOMAIN} expiry={expiry_date} days_left={days_left} source={source}")

    if args.send_test:
        send_email(
            f"测试：{DOMAIN} 域名到期提醒已启用",
            f"自动提醒测试成功。当前登记到期日为 {expiry_date}，到期前一个月将自动发信。",
        )
        print("test reminder sent")
        return 0

    if today == month_before:
        stage = "一个月"
    elif days_left == 7:
        stage = "7天"
    elif days_left == 1:
        stage = "1天"
    else:
        print("no reminder is due today")
        return 0

    send_email(
        f"【域名到期提醒】{DOMAIN} 将在{stage}后到期",
        f"{DOMAIN} 当前登记到期日为 {expiry_date}，距离到期约 {stage}。请登录阿里云域名控制台检查续费和自动续费状态。",
    )
    print(f"{stage} reminder sent")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
