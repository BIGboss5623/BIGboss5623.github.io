import {adminRequest} from '../operations/admin-auth.js';
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
  // Guard before any hostname mapping or ASSETS.fetch. Encoded aliases
  // are redirected rather than passed through to static asset routing.
  let normalized=url.pathname;
  try { for(let i=0;i<3;i++){const next=decodeURIComponent(normalized);if(next===normalized)break;normalized=next;} }
  catch { return new Response('Bad request',{status:400}); }
  normalized=normalized.replace(/\\/g,'/').replace(/\/+/g,'/');
  const parts=[];
  for(const part of normalized.split('/')){if(!part||part==='.')continue;if(part==='..')parts.pop();else parts.push(part);}
  const clean='/'+parts.join('/');
  const isAdmin=clean.toLowerCase()==='/admin'||clean.toLowerCase().startsWith('/admin/');
  if(hostname==='admin.zgland.com'||isAdmin){
    if(hostname!=='zgland.com'||!/^\/admin(?:\/|$)/.test(url.pathname)||normalized!==url.pathname){
      return new Response(null,{status:303,headers:{Location:'https://zgland.com/admin/','Cache-Control':'no-store'}});
    }
    return adminRequest(context);
  }

  // The Cloudflare Pages project serves several distinct canonical hosts.
  // Supply each company host's own sitemap and robots file without touching
  // existing APIs or the independent files/quant tunnels.
  const seoAssets = {
    "hzct.zgland.com": {"/sitemap.xml":"/sitemap-hzct.xml", "/robots.txt":"/robots-hzct.txt"},
    "hzyx.zgland.com": {"/sitemap.xml":"/sitemap-hzyx.xml", "/robots.txt":"/robots-hzyx.txt"}
  };
  // Public IndexNow verification key for the company's canonical subdomain.
  if (hostname === "hzyx.zgland.com" && url.pathname === "/47d8029e6c48af3610458266e4207970.txt") {
    url.pathname = "/hzyx/47d8029e6c48af3610458266e4207970.txt";
    return context.env.ASSETS.fetch(new Request(url, context.request));
  }
  const seoPath = seoAssets[hostname]?.[url.pathname];
  if (seoPath) {
    url.pathname = seoPath;
    return context.env.ASSETS.fetch(new Request(url, context.request));
  }
  // Keep company assets and legacy root-level pages at their existing paths.
  // Only the company's home document differs from the navigation portal.
  if (hostname === `hzct.${ROOT_DOMAIN}` && ["/", "/index.html"].includes(url.pathname)) {
    // Pages redirects explicit .html URLs; use its clean asset URL internally.
    url.pathname = "/company-home";
    return context.env.ASSETS.fetch(new Request(url, context.request));
  }
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
