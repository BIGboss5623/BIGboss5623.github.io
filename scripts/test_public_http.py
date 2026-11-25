from pathlib import Path
from urllib.request import Request
from urllib.error import URLError
from unittest.mock import patch
from types import SimpleNamespace
import ssl,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import public_http
fake=object()
opener=SimpleNamespace(open=lambda req,timeout:fake)
with patch.object(public_http,'urlopen',side_effect=URLError(ssl.SSLError('handshake failed'))):
    with patch.object(public_http,'build_opener',return_value=opener) as built:
        assert public_http.open_public(Request('https://zgland.com/guides/')) is fake
        assert built.call_count==1
    with patch.object(public_http,'build_opener') as built:
        try:
            public_http.open_public(Request('https://example.com/'))
        except URLError:
            pass
        else:
            raise AssertionError('Non-allowlisted host bypassed proxy')
        assert built.call_count==0
with patch.object(public_http,'urlopen',return_value=fake):
    assert public_http.open_public(Request('https://zgland.com/')) is fake

with patch.object(public_http,'urlopen',side_effect=URLError(ssl.SSLError('proxy TLS failed'))):
    direct=SimpleNamespace(open=lambda req,timeout:(_ for _ in ()).throw(URLError(ssl.SSLError('direct Python TLS failed'))))
    with patch.object(public_http,'build_opener',return_value=direct):
        with patch.object(public_http.shutil,'which',return_value='curl.exe'):
            fake_result=SimpleNamespace(returncode=0,stdout=b'public content\nZGLAND_HTTP_STATUS:200',stderr=b'')
            with patch.object(public_http.subprocess,'run',return_value=fake_result) as called:
                with public_http.open_public(Request('https://zgland.com/guides/')) as response:
                    assert response.status==200 and response.read()==b'public content'
                args=called.call_args.args[0]
                assert '--noproxy' in args and '--insecure' not in args and '-k' not in args

assert public_http._approved_public_url('https://quant.zgland.com/healthz')
assert not public_http._approved_public_url('https://quant.zgland.com/')
assert not public_http._approved_public_url('https://quant.zgland.com/private-admin')
print('PASS HTTPS fallback: allowed first-party only; TLS validation retained; unexpected hosts do not bypass proxy')
