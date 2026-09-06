const API_BASE = "https://api.cloudflare.com/client/v4";
const ROOT_DOMAIN = "zgland.com";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function normalizeHostname(value) {
  return String(value || "").trim().toLowerCase().replace(/\.$/, "");
}

function validManagedHostname(hostname) {
  if (!hostname || hostname === ROOT_DOMAIN || !hostname.endsWith(`.${ROOT_DOMAIN}`)) return false;
  if (hostname.length > 253 || hostname.includes("*")) return false;
  return hostname.split(".").every((label) => /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(label));
}

async function sameSecret(left, right) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(left || ""))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(right || ""))),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i += 1) {
    diff |= (aa[i] || 0) ^ (bb[i] || 0);
  }
  return diff === 0;
}

async function cloudflare(env, path, init = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const message = (payload.errors || []).map((item) => item.message).filter(Boolean).join("；");
    throw new Error(message || `Cloudflare API 请求失败（HTTP ${response.status}）`);
  }
  return payload;
}

function requiredEnv(env) {
  return [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ZONE_ID",
    "CLOUDFLARE_PAGES_PROJECT",
    "CLOUDFLARE_PAGES_TARGET",
    "DOMAIN_CONSOLE_PASSWORD",
  ].filter((key) => !env[key]);
}

async function inspectDomain(env, hostname) {
  const dns = await cloudflare(
    env,
    `/zones/${encodeURIComponent(env.CLOUDFLARE_ZONE_ID)}/dns_records?name=${encodeURIComponent(hostname)}&per_page=100`,
  );
  const pages = await cloudflare(
    env,
    `/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/pages/projects/${encodeURIComponent(env.CLOUDFLARE_PAGES_PROJECT)}/domains`,
  );
  const records = Array.isArray(dns.result) ? dns.result : [];
  const domains = Array.isArray(pages.result) ? pages.result : [];
  const conflicts = records.filter((record) => record.type !== "CNAME");
  const cname = records.find((record) => record.type === "CNAME") || null;
  const pagesDomain = domains.find((domain) => normalizeHostname(domain.name) === hostname) || null;
  return { records, conflicts, cname, pagesDomain };
}

async function handleRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ ok: false, message: "仅支持 POST 请求。" }, 405);

  const missing = requiredEnv(env);
  if (missing.length) {
    return json({ ok: false, message: "控制台尚未完成首次配置。", missing }, 503);
  }

  const body = await request.json().catch(() => null);
  if (!body || !(await sameSecret(body.password, env.DOMAIN_CONSOLE_PASSWORD))) {
    return json({ ok: false, message: "控制台密码不正确。" }, 401);
  }

  const action = body.action === "apply" ? "apply" : "plan";
  const hostname = normalizeHostname(body.hostname);
  if (!validManagedHostname(hostname)) {
    return json({ ok: false, message: `只允许管理 ${ROOT_DOMAIN} 的普通子域名，且禁止根域名和通配符。` }, 400);
  }

  const target = normalizeHostname(env.CLOUDFLARE_PAGES_TARGET);
  if (!target.endsWith(".pages.dev")) {
    return json({ ok: false, message: "CLOUDFLARE_PAGES_TARGET 必须是当前项目的 pages.dev 主机名。" }, 503);
  }

  const current = await inspectDomain(env, hostname);
  if (current.conflicts.length) {
    return json({
      ok: false,
      message: "发现非 CNAME 的同名记录，已按安全规则停止，未修改任何内容。",
      conflicts: current.conflicts.map(({ id, type, name, content }) => ({ id, type, name, content })),
    }, 409);
  }
  if (current.records.filter((record) => record.type === "CNAME").length > 1) {
    return json({ ok: false, message: "发现多个同名 CNAME，已停止，请先在 Cloudflare 后台人工核对。" }, 409);
  }

  const operations = [];
  if (!current.cname) operations.push({ area: "DNS", operation: "create", detail: `${hostname} → ${target}` });
  else if (normalizeHostname(current.cname.content) !== target || current.cname.proxied !== true) {
    operations.push({ area: "DNS", operation: "update", detail: `${hostname} → ${target}（已代理）` });
  } else operations.push({ area: "DNS", operation: "none", detail: "CNAME 已正确配置" });

  if (!current.pagesDomain) operations.push({ area: "Pages", operation: "create", detail: `绑定 ${hostname}` });
  else operations.push({ area: "Pages", operation: "none", detail: `已绑定，状态：${current.pagesDomain.status || "未知"}` });

  if (action === "plan") {
    return json({ ok: true, mode: "plan", hostname, target, changed: false, operations });
  }

  const dnsOperation = operations.find((item) => item.area === "DNS");
  if (dnsOperation.operation === "create") {
    await cloudflare(env, `/zones/${encodeURIComponent(env.CLOUDFLARE_ZONE_ID)}/dns_records`, {
      method: "POST",
      body: JSON.stringify({ type: "CNAME", name: hostname, content: target, ttl: 1, proxied: true }),
    });
  } else if (dnsOperation.operation === "update") {
    await cloudflare(env, `/zones/${encodeURIComponent(env.CLOUDFLARE_ZONE_ID)}/dns_records/${encodeURIComponent(current.cname.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ type: "CNAME", name: hostname, content: target, ttl: 1, proxied: true }),
    });
  }

  if (!current.pagesDomain) {
    await cloudflare(
      env,
      `/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/pages/projects/${encodeURIComponent(env.CLOUDFLARE_PAGES_PROJECT)}/domains`,
      { method: "POST", body: JSON.stringify({ name: hostname }) },
    );
  }

  const verified = await inspectDomain(env, hostname);
  return json({
    ok: true,
    mode: "apply",
    hostname,
    target,
    changed: operations.some((item) => item.operation !== "none"),
    operations,
    result: {
      dns: verified.cname ? { type: verified.cname.type, content: verified.cname.content, proxied: verified.cname.proxied } : null,
      pages: verified.pagesDomain ? { name: verified.pagesDomain.name, status: verified.pagesDomain.status } : null,
    },
  });
}

export async function onRequestPost(context) {
  try {
    return await handleRequest(context);
  } catch (error) {
    return json({ ok: false, message: error instanceof Error ? error.message : "服务器处理失败。" }, 500);
  }
}

export function onRequestGet() {
  return json({ ok: true, service: "zgland-domain-console", root: ROOT_DOMAIN, methods: ["POST"] });
}
