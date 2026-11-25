"""Resilient public HTTPS checks when a Windows proxy changes networks.

Attempts the user's configured path. On SSL handshake failure only, retries
direct Python HTTPS, then a certificate-verified OS curl direct GET for a
strict list of first-party public hosts. No insecure TLS, credential use,
system proxy mutation, requests to private APIs, or unrestricted bypass.
"""
import io,ssl,subprocess,shutil
from urllib.request import urlopen,build_opener,ProxyHandler
from urllib.error import URLError
from urllib.parse import urlsplit

PUBLIC_HOSTS=frozenset({'zgland.com','hzct.zgland.com','hzyx.zgland.com'})
class PublicResponse(io.BytesIO):
    def __init__(self,body,status):
        super().__init__(body)
        self.status=status

def _curl_direct(req,timeout):
    executable=shutil.which('curl.exe') or shutil.which('curl')
    if not executable:
        raise URLError('HTTPS direct retry requires a certificate-verifying curl binary')
    url=req.full_url
    parsed=urlsplit(url)
    if parsed.scheme!='https' or parsed.hostname not in PUBLIC_HOSTS or parsed.username or parsed.password:
        raise ValueError('Direct fallback only accepts approved public HTTPS hosts')
    # --proto and --proto-redir enforce HTTPS even across redirects. No -k/--insecure.
    args=[executable,'--noproxy','*','--proto','=https','--proto-redir','=https',
          '--location','--max-redirs','3','--silent','--show-error',
          '--max-time',str(int(timeout)),'--write-out','\nZGLAND_HTTP_STATUS:%{http_code}',url]
    try:
        process=subprocess.run(args,capture_output=True,timeout=int(timeout)+5)
    except (OSError,subprocess.TimeoutExpired) as exc:
        raise URLError('Certificate-checked direct GET failed: '+type(exc).__name__) from exc
    if process.returncode:
        raise URLError('Certificate-checked direct curl failed: code '+str(process.returncode)+' '+process.stderr.decode('utf-8','replace')[:180])
    marker=b'\nZGLAND_HTTP_STATUS:'
    if marker not in process.stdout:
        raise URLError('Direct curl response status unavailable')
    body,status=process.stdout.rsplit(marker,1)
    try:status=int(status.strip())
    except (ValueError,TypeError) as exc:raise URLError('Invalid HTTP status from curl') from exc
    return PublicResponse(body,status)

def open_public(req,timeout=12):
    try:
        return urlopen(req,timeout=timeout)
    except URLError as exc:
        if urlsplit(req.full_url).hostname not in PUBLIC_HOSTS or not isinstance(exc.reason,ssl.SSLError):
            raise
    print('NOTICE: default HTTPS proxy handshake failed; checking first-party direct HTTPS',flush=True)
    try:
        return build_opener(ProxyHandler({})).open(req,timeout=timeout)
    except URLError as exc:
        if not isinstance(exc.reason,ssl.SSLError):
            raise
    print('NOTICE: Python direct TLS also failed; retrying OS certificate-checked curl GET',flush=True)
    return _curl_direct(req,timeout)
