import sys
from pathlib import Path

from flask import Flask

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes import _json_error


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
