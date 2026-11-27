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
  // The live dashboard is served by the existing authenticated local service.
  // No public static admin asset or alternative hostname can bypass this gate.
  let decoded=url.pathname;
  try {for(let i=0;i<4;i++){const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;}} catch {return new Response('Bad request',{status:400});}
  const parts=[];
  for(const part of decoded.replace(/\\/g,'/').split('/')){if(!part||part==='.')continue;if(part==='..')parts.pop();else parts.push(part);}
  const clean='/'+parts.join('/');
  if(hostname==='admin.zgland.com'||clean.toLowerCase()==='/admin'||clean.toLowerCase().startsWith('/admin/')){
    const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'};
    if(clean.toLowerCase().startsWith('/admin/api/'))return Response.json({ok:false,message:'Use the authenticated management service.'},{status:401,headers});
    if(!['GET','HEAD'].includes(context.request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
    return new Response(null,{status:303,headers:{...headers,Location:'https://files.zgland.com/admin/'}});
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
