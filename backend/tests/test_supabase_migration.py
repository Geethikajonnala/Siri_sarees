import sys
from pathlib import Path

from flask import Flask

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from models import Product
from routes import IMAGE_BUCKET, _build_product_payload, _json_error


def test_json_error_helper_still_exists():
    app = Flask(__name__)
    with app.app_context():
        response = _json_error("boom", 400)
    assert response[1] == 400


def test_no_json_storage_fallbacks_remain():
    route_source = Path(__file__).resolve().parents[1] / "routes.py"
    source = route_source.read_text(encoding="utf-8")
    assert "import json" not in source
    assert "local store" not in source.lower()
    assert "falling back to local" not in source.lower()


def test_runtime_code_does_not_query_product_images_table():
    backend_dir = Path(__file__).resolve().parents[1]
    runtime_source = "\n".join(
        (backend_dir / filename).read_text(encoding="utf-8")
        for filename in ("routes.py", "models.py")
    )
    assert "product_images" not in runtime_source
    assert "ProductImage" not in runtime_source


def test_product_payload_uses_products_image_url_only():
    product = Product(
        id="product-1",
        name="Silk Saree",
        category="Silk",
        description="",
        offer="",
        price=1200,
        stock=3,
        image_url="https://example.com/saree.jpg",
    )

    payload = _build_product_payload(product)

    assert payload["image_url"] == "https://example.com/saree.jpg"
    assert payload["images"] == ["https://example.com/saree.jpg"]


def test_supabase_storage_bucket_name_matches_existing_bucket():
    assert IMAGE_BUCKET == "saree_images"
