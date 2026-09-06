const ROOT_DOMAIN = "zgland.com";
const ROOT_SITE_HOSTS = new Set([ROOT_DOMAIN, `www.${ROOT_DOMAIN}`, `hzct.${ROOT_DOMAIN}`]);

function mappedDirectory(hostname) {
  if (ROOT_SITE_HOSTS.has(hostname) || !hostname.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const prefix = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!/^[a-z0-9-]{1,63}$/.test(prefix)) return null;
  return prefix;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const hostname = url.hostname.toLowerCase();
  const directory = mappedDirectory(hostname);

  if (!directory || url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return context.next();
  }

  const prefix = `/${directory}`;
  if (!url.pathname.startsWith(`${prefix}/`) && url.pathname !== prefix) {
    url.pathname = url.pathname === "/" ? `${prefix}/` : `${prefix}${url.pathname}`;
  }

  return context.env.ASSETS.fetch(new Request(url, context.request));
}
