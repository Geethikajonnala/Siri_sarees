from html import escape
from pathlib import Path

from flask import Flask, current_app, jsonify, request, send_from_directory
from flask_cors import CORS

from models import Product
from routes import api, init_backend, _build_product_payload
from config import Config


FRONTEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_PRODUCT_IMAGE = "https://images.pexels.com/photos/27575174/pexels-photo-27575174.jpeg?auto=compress&cs=tinysrgb&w=700"


def _replace_meta(html: str, name: str, content: str, *, attr: str = "property") -> str:
    escaped_content = escape(content or "", quote=True)
    marker = f'<meta {attr}="{name}" content="'
    start = html.find(marker)
    if start == -1:
        return html
    value_start = start + len(marker)
    value_end = html.find('"', value_start)
    if value_end == -1:
        return html
    return f"{html[:value_start]}{escaped_content}{html[value_end:]}"


def _replace_title(html: str, title: str) -> str:
    return html.replace("<title>Siri Saree Divine Product</title>", f"<title>{escape(title, quote=False)}</title>", 1)


def _product_page_url(product_id: str | None) -> str:
    public_site_url = (current_app.config.get("PUBLIC_SITE_URL") or "").rstrip("/")
    if not public_site_url:
        return request.url

    product_url = f"{public_site_url}/product.html"
    if product_id:
        product_url = f"{product_url}?id={product_id}"
    return product_url


def _product_share_payload(product_id: str | None):
    title = "Siri Saree Divine Product"
    description = "View this premium saree from Siri Saree Divine."
    image_url = DEFAULT_PRODUCT_IMAGE

    if not product_id:
        return title, description, image_url

    try:
        product = Product.get_product(product_id)
    except Exception:
        product = None

    if product:
        payload = _build_product_payload(product)
        title = f"{payload.get('name')} | Siri Saree Divine"
        description = payload.get("description") or f"{payload.get('name')} for Rs. {payload.get('price')}."
        image_url = payload.get("image_url") or image_url

    return title, description, image_url


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:5000", "null"]}},
        supports_credentials=True,
    )
    app.register_blueprint(api, url_prefix="/api")
    with app.app_context():
        init_backend()

    @app.get("/")
    def health_check():
        return jsonify({"message": "Siri Sarees Backend Running"})

    @app.get("/product.html")
    def product_page():
        html = (FRONTEND_DIR / "product.html").read_text(encoding="utf-8")
        product_id = request.args.get("id")
        title, description, image_url = _product_share_payload(product_id)
        html = _replace_title(html, title)
        html = _replace_meta(html, "description", description, attr="name")
        html = _replace_meta(html, "og:title", title)
        html = _replace_meta(html, "og:description", description)
        html = _replace_meta(html, "og:image", image_url)
        html = _replace_meta(html, "og:url", _product_page_url(product_id))
        return html

    @app.get("/style.css")
    @app.get("/config.js")
    @app.get("/index.html")
    @app.get("/product.js")
    @app.get("/script.js")
    def frontend_file():
        return send_from_directory(FRONTEND_DIR, request.path.lstrip("/"))

    @app.get("/assets/<path:filename>")
    def frontend_asset(filename):
        return send_from_directory(FRONTEND_DIR / "assets", filename)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
