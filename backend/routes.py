import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

import jwt
from flask import Blueprint, current_app, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from config import Config
from models import Product, db
from supabase_client import supabase

api = Blueprint("api", __name__)
UPLOAD_FOLDER = Path(__file__).resolve().parent / "uploads"
UPLOAD_FOLDER.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


def _json_error(message: str, status: int = 400):
    return jsonify({"success": False, "error": message}), status


def _normalize_text(value):
    if value is None:
        return ""
    cleaned = re.sub(r"<[^>]+>", "", str(value)).strip()
    return " ".join(cleaned.split())


def _build_image_url(path_value: str):
    if not path_value:
        return ""
    if path_value.startswith("http://") or path_value.startswith("https://"):
        return path_value
    return f"http://127.0.0.1:5000{path_value}" if not path_value.startswith("/") else f"http://127.0.0.1:5000{path_value}"


def _get_request_payload():
    if request.is_json:
        payload = request.get_json(silent=True)
        if isinstance(payload, dict):
            return payload

    payload = request.form.to_dict(flat=True)
    if payload:
        return payload

    return {}


def _get_token():
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header.split(" ", 1)[1].strip()
    return request.cookies.get("token")


def _decode_token(token):
    if not token:
        return None
    try:
        return jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
    except Exception:
        return None


def require_admin_auth(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        token = _get_token()
        payload = _decode_token(token)
        if not payload:
            return _json_error("Authentication required", 401)
        request.admin_user = payload
        return func(*args, **kwargs)

    return wrapper


def ensure_schema():
    if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
        current_app.logger.warning("Supabase configuration is missing; schema checks skipped")
        return False

    current_app.logger.info("Checking Supabase connectivity for admin and product tables")
    for table_name in ("admins", "products"):
        try:
            supabase.table(table_name).select("id").limit(1).execute()
            current_app.logger.info("Supabase table '%s' is available", table_name)
        except Exception as exc:
            current_app.logger.warning("Supabase table '%s' probe failed: %s", table_name, exc)
            return False

    return True


def ensure_default_admin():
    if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
        current_app.logger.warning("Supabase configuration is missing; skipping remote admin seed")
        return True

    try:
        response = supabase.table("admins").select("id").limit(1).execute()
        if response.data:
            current_app.logger.info("Existing remote admin records found; skipping default admin seed")
            return True
    except Exception as exc:
        current_app.logger.warning("Unable to read remote admins table while seeding default admin: %s", exc)
        return True

    default_username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
    default_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@sirisarees.com")
    default_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "SiriSareesAdmin2026")
    default_hash = generate_password_hash(default_password)

    try:
        supabase.table("admins").insert({
            "username": default_username,
            "email": default_email,
            "password_hash": default_hash,
        }).execute()
        current_app.logger.info("Remote default admin created successfully")
        return True
    except Exception as exc:
        current_app.logger.warning("Remote default admin seed skipped: %s", exc)
        return True


def init_backend():
    with current_app.app_context():
        schema_ready = ensure_schema()
        if schema_ready:
            current_app.logger.info("Schema initialization checks completed successfully")
        else:
            current_app.logger.warning("Schema initialization checks did not complete; continuing with auth flow")
        ensure_default_admin()


@api.get("/status")
def status():
    return jsonify({"status": "Backend Ready"})


@api.get("/test-db")
def test_db():
    try:
        response = supabase.table("products").select("*").limit(1).execute()
        return jsonify({"success": True, "message": "Supabase connected successfully!", "data": response.data})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@api.post("/auth/login")
def login():
    payload = _get_request_payload()
    current_app.logger.info("Login request received with content-type=%s body=%s", request.content_type, request.get_data(as_text=True)[:200])
    identifier = _normalize_text(payload.get("username") or payload.get("email") or "")
    password = _normalize_text(payload.get("password") or "")

    current_app.logger.info("Login request received for identifier=%s", identifier)

    if not identifier or not password:
        current_app.logger.warning("Login rejected because identifier or password was missing")
        return _json_error("Username/email and password are required", 400)

    admins = []
    try:
        current_app.logger.info("Looking up admin user in Supabase")
        response = supabase.table("admins").select("id, username, email, password_hash").execute()
        admins = response.data or []
        current_app.logger.info("Admin lookup returned %s record(s)", len(admins))
    except Exception as exc:
        current_app.logger.warning("Admin lookup failed in Supabase: %s", exc)
        return _json_error("Unable to access admin records", 500)

    admin = None
    for item in admins:
        if item.get("username") == identifier or item.get("email") == identifier:
            admin = item
            break

    if not admin:
        current_app.logger.warning("Admin lookup failed for identifier=%s", identifier)
        return _json_error("Invalid login credentials", 401)

    stored_hash = admin.get("password_hash", "") or ""
    password_valid = bool(stored_hash) and check_password_hash(stored_hash, password)
    current_app.logger.info("Password verification for %s: %s", admin.get("username"), password_valid)

    if not password_valid:
        current_app.logger.warning("Password verification failed for %s", admin.get("username"))
        return _json_error("Invalid login credentials", 401)

    current_app.logger.info("Generating JWT for %s", admin.get("username"))
    token = jwt.encode(
        {
            "sub": str(admin.get("id")),
            "username": admin.get("username"),
            "email": admin.get("email"),
            "exp": datetime.now(timezone.utc) + timedelta(hours=8),
        },
        Config.SECRET_KEY,
        algorithm="HS256",
    )

    response = jsonify({"success": True, "message": "Login successful", "user": {"username": admin.get("username"), "email": admin.get("email")}})
    response.set_cookie("token", token, httponly=True, samesite="Lax", secure=False, max_age=8 * 3600)
    return response


@api.get("/auth/me")
@require_admin_auth
def auth_me():
    return jsonify({"success": True, "user": request.admin_user})


@api.post("/auth/logout")
def logout():
    response = jsonify({"success": True, "message": "Logged out"})
    response.delete_cookie("token")
    return response


@api.get("/products")
def get_products():
    try:
        products = Product.list_products()
    except Exception as exc:
        current_app.logger.warning("Unable to load products from Supabase: %s", exc)
        return _json_error(f"Unable to load products: {exc}", 500)

    items = [product.to_payload() for product in products]
    for item in items:
        item["image_url"] = _build_image_url(item.get("image_url"))
    return jsonify({"success": True, "products": items})


@api.get("/products/<product_id>")
def get_product(product_id):
    try:
        product = Product.get_product(product_id)
    except Exception as exc:
        return _json_error(f"Unable to load product: {exc}", 500)

    if not product:
        return _json_error("Product not found", 404)

    payload = product.to_payload()
    payload["image_url"] = _build_image_url(payload.get("image_url"))
    return jsonify({"success": True, "product": payload})


@api.post("/products")
@require_admin_auth
def create_product():
    if request.is_json:
        data = request.get_json(silent=True) or {}
    else:
        data = request.form.to_dict(flat=True)

    name = _normalize_text(data.get("name"))
    category = _normalize_text(data.get("category"))
    description = _normalize_text(data.get("description"))
    offer = _normalize_text(data.get("offer"))

    if not name or not category:
        return _json_error("Name and category are required", 400)

    try:
        price = float(data.get("price"))
        stock = int(data.get("stock"))
    except (TypeError, ValueError):
        return _json_error("Price and stock must be valid numbers", 400)

    if price <= 0:
        return _json_error("Price must be greater than zero", 400)
    if stock < 0:
        return _json_error("Stock cannot be negative", 400)

    image_url = data.get("image_url") or ""
    uploaded_file = None
    if "image" in request.files:
        uploaded_file = request.files["image"]

    if uploaded_file and uploaded_file.filename:
        extension = uploaded_file.filename.rsplit(".", 1)[1].lower() if "." in uploaded_file.filename else ""
        if extension not in ALLOWED_EXTENSIONS:
            return _json_error("Only JPG, PNG, and WEBP images are supported", 400)
        safe_name = secure_filename(uploaded_file.filename)
        unique_name = f"{uuid.uuid4().hex}_{safe_name}"
        saved_path = UPLOAD_FOLDER / unique_name
        uploaded_file.save(saved_path)
        image_url = f"/uploads/{unique_name}"

    product = Product(
        id=str(uuid.uuid4()),
        name=name,
        category=category,
        description=description,
        offer=offer,
        price=price,
        stock=stock,
        image_url=image_url,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    try:
        db.session.add(product)
        db.session.commit()
        return jsonify({"success": True, "message": "Product created", "product": product.to_payload()})
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning("Supabase product create failed: %s", exc)
        return _json_error(f"Unable to create product: {exc}", 500)


@api.put("/products/<product_id>")
@require_admin_auth
def update_product(product_id):
    if request.is_json:
        data = request.get_json(silent=True) or {}
    else:
        data = request.form.to_dict(flat=True)

    if not data:
        return _json_error("No update data provided", 400)

    payload = {}
    for field in ["name", "category", "description", "offer", "price", "stock"]:
        if field in data:
            value = data.get(field)
            if field in {"price", "stock"}:
                try:
                    if field == "price":
                        numeric_value = float(value)
                        if numeric_value <= 0:
                            return _json_error("Price must be greater than zero", 400)
                        payload[field] = numeric_value
                    else:
                        numeric_value = int(value)
                        if numeric_value < 0:
                            return _json_error("Stock cannot be negative", 400)
                        payload[field] = numeric_value
                except (TypeError, ValueError):
                    return _json_error(f"{field.title()} must be a valid number", 400)
            else:
                payload[field] = _normalize_text(value)

    uploaded_file = None
    if "image" in request.files:
        uploaded_file = request.files["image"]
    if uploaded_file and uploaded_file.filename:
        extension = uploaded_file.filename.rsplit(".", 1)[1].lower() if "." in uploaded_file.filename else ""
        if extension not in ALLOWED_EXTENSIONS:
            return _json_error("Only JPG, PNG, and WEBP images are supported", 400)
        safe_name = secure_filename(uploaded_file.filename)
        unique_name = f"{uuid.uuid4().hex}_{safe_name}"
        saved_path = UPLOAD_FOLDER / unique_name
        uploaded_file.save(saved_path)
        payload["image_url"] = f"/uploads/{unique_name}"

    try:
        product = Product.get_product(product_id)
    except Exception as exc:
        return _json_error(f"Unable to load product: {exc}", 500)

    if not product:
        return _json_error("Product not found", 404)

    if not payload:
        return _json_error("No valid fields to update", 400)

    for field, value in payload.items():
        setattr(product, field, value)
    product.updated_at = datetime.now(timezone.utc)

    try:
        db.session.add(product)
        db.session.commit()
        return jsonify({"success": True, "message": "Product updated", "product": product.to_payload()})
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning("Supabase product update failed: %s", exc)
        return _json_error(f"Unable to update product: {exc}", 500)


@api.delete("/products/<product_id>")
@require_admin_auth
def delete_product(product_id):
    try:
        product = Product.get_product(product_id)
    except Exception as exc:
        return _json_error(f"Unable to load product: {exc}", 500)

    if not product:
        return _json_error("Product not found", 404)

    try:
        db.session.delete(product)
        db.session.commit()
        return jsonify({"success": True, "message": "Product deleted"})
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning("Supabase product delete failed: %s", exc)
        return _json_error(f"Unable to delete product: {exc}", 500)


@api.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)