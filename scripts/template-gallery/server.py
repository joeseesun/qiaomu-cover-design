"""Serves the template gallery page and the bundled fonts, and saves contact sheets the page posts back.

Only listens on 127.0.0.1. Sheets land in artifacts/template-gallery/ (git-ignored)."""
import base64, http.server, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FONTS = os.path.join(ROOT, 'assets', 'fonts')
OUT = os.path.join(ROOT, 'artifacts', 'template-gallery')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4377


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=HERE, **k)

    def translate_path(self, path):
        if path.startswith('/fonts/'):
            return os.path.join(FONTS, os.path.basename(path.split('?')[0]))
        return super().translate_path(path)

    def do_POST(self):
        name = os.path.basename(self.path)
        if not self.path.startswith('/save/') or not re.fullmatch(r'[\w.-]+\.png', name):
            self.send_error(400); return
        body = self.rfile.read(int(self.headers['Content-Length'])).decode()
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(base64.b64decode(body.split(',', 1)[1]))
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')

    def log_message(self, *a):
        pass


print(f'Template gallery: http://localhost:{PORT}/  (options: ?sizes=xhs,youtube,wechat&only=folio,riso&all=1&t=标题&s=副标题&b=标签)')
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
