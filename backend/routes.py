import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import Blueprint, current_app, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from config import Config
from models import Product, db
from supabase_client import supabase

api = Blueprint("api", __name__)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
IMAGE_BUCKET = "saree_images"
MAX_PRODUCT_IMAGES = 4


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

    # Stored image paths are converted to public Supabase Storage URLs.
    return supabase.storage.from_(IMAGE_BUCKET).get_public_url(path_value.lstrip("/"))


def _build_product_payload(product: Product):
    payload = product.to_payload()
    raw_image_url = payload.get("image_url") or ""
    image_list = [url.strip() for url in raw_image_url.split(",") if url.strip()]
    payload["images"] = [_build_image_url(url) for url in image_list]
    payload["image_url"] = payload["images"][0] if payload["images"] else ""
    return payload


def _storage_path_from_url(url: str):
    marker = f"/object/public/{IMAGE_BUCKET}/"
    index = (url or "").find(marker)
    if index == -1:
        return None
    return url[index + len(marker):]


def _delete_storage_images(urls):
    paths = [path for path in (_storage_path_from_url(url) for url in urls) if path]
    if not paths:
        return
    try:
        supabase.storage.from_(IMAGE_BUCKET).remove(paths)
    except Exception as exc:
        # Best-effort cleanup: the product record change already succeeded, so a
        # storage hiccup here shouldn't fail the request - just leave a trace.
        current_app.logger.warning("Failed to delete storage image(s) %s: %s", paths, exc)


FABRIC_TERMS = (
    "silk",
    "cotton",
    "linen",
    "organza",
    "chiffon",
    "georgette",
    "crepe",
    "net",
    "tissue",
    "velvet",
    "satin",
    "banarasi",
    "kanjivaram",
    "kanchipuram",
)

COLOR_TERMS = (
    "red",
    "maroon",
    "pink",
    "green",
    "blue",
    "yellow",
    "orange",
    "purple",
    "violet",
    "lavender",
    "black",
    "white",
    "ivory",
    "cream",
    "gold",
    "golden",
    "beige",
    "peach",
    "teal",
    "navy",
    "wine",
    "coral",
)


def _product_search_text(payload):
    return " ".join(
        str(payload.get(field) or "").lower()
        for field in ("name", "category", "description", "offer")
    )


def _matched_terms(payload, terms):
    text = _product_search_text(payload)
    return {term for term in terms if term in text}


def _similarity_key(target, candidate):
    target_price = float(target.get("price") or 0)
    candidate_price = float(candidate.get("price") or 0)
    price_delta = abs(candidate_price - target_price)

    return (
        str(candidate.get("category") or "").lower() == str(target.get("category") or "").lower(),
        bool(_matched_terms(target, FABRIC_TERMS) & _matched_terms(candidate, FABRIC_TERMS)),
        bool(_matched_terms(target, COLOR_TERMS) & _matched_terms(candidate, COLOR_TERMS)),
        -price_delta,
    )


def _save_uploaded_image(uploaded_file):
    extension = uploaded_file.filename.rsplit(".", 1)[1].lower() if "." in uploaded_file.filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        return None
    safe_name = secure_filename(uploaded_file.filename)
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    storage_path = f"products/{unique_name}"
    file_bytes = uploaded_file.read()
    content_type = uploaded_file.mimetype or f"image/{extension}"

    # Images are uploaded to Supabase Storage; the products table stores this public URL.
    supabase.storage.from_(IMAGE_BUCKET).upload(
        storage_path,
        file_bytes,
        file_options={"content-type": content_type},
    )
    return supabase.storage.from_(IMAGE_BUCKET).get_public_url(storage_path)


def _get_uploaded_images(limit=MAX_PRODUCT_IMAGES):
    uploaded_files = []
    uploaded_files.extend(request.files.getlist("image"))
    uploaded_files.extend(request.files.getlist("images"))
    image_urls = []

    for uploaded_file in uploaded_files:
        if not uploaded_file or not uploaded_file.filename:
            continue
        if len(image_urls) >= limit:
            return None, f"A product can have up to {MAX_PRODUCT_IMAGES} images in total"
        image_url = _save_uploaded_image(uploaded_file)
        if image_url is None:
            return None, "Only JPG, PNG, and WEBP images are supported"
        image_urls.append(image_url)

    return image_urls, None


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

    items = [_build_product_payload(product) for product in products]
    return jsonify({"success": True, "products": items})


@api.get("/products/<product_id>")
def get_product(product_id):
    try:
        product = Product.get_product(product_id)
    except Exception as exc:
        return _json_error(f"Unable to load product: {exc}", 500)

    if not product:
        return _json_error("Product not found", 404)

    payload = _build_product_payload(product)
    return jsonify({"success": True, "product": payload})


@api.get("/products/<product_id>/similar")
def get_similar_products(product_id):
    try:
        target_product = Product.get_product(product_id)
        products = Product.list_products()
    except Exception as exc:
        return _json_error(f"Unable to load similar products: {exc}", 500)

    if not target_product:
        return _json_error("Product not found", 404)

    target = _build_product_payload(target_product)
    candidates = [
        _build_product_payload(product)
        for product in products
        if str(product.id) != str(product_id)
    ]
    similar_products = sorted(candidates, key=lambda item: _similarity_key(target, item), reverse=True)[:8]
    return jsonify({"success": True, "products": similar_products})


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

    try:
        uploaded_images, upload_error = _get_uploaded_images()
    except Exception as exc:
        current_app.logger.warning("Supabase image upload failed: %s", exc)
        return _json_error(f"Unable to upload image: {exc}", 500)
    if upload_error:
        return _json_error(upload_error, 400)

    image_url = data.get("image_url") or ""
    image_urls = uploaded_images or ([image_url] if image_url else [])
    if image_urls:
        image_url = ",".join(image_urls)

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
        return jsonify({"success": True, "message": "Product created", "product": _build_product_payload(product)})
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

    try:
        product = Product.get_product(product_id)
    except Exception as exc:
        return _json_error(f"Unable to load product: {exc}", 500)

    if not product:
        return _json_error("Product not found", 404)

    current_images = _build_product_payload(product).get("images", [])

    # `keep_images` lists which of the product's existing images the admin kept
    # (its per-image "x" button removes one), in left-to-right slot order.
    # `image_order` is a comma list of MAX_PRODUCT_IMAGES tokens ("keep"/"new"/"empty"),
    # one per image slot in the admin UI, so a newly uploaded photo dropped into the
    # first slot is respected as the main image instead of always trailing the kept
    # ones. Without it (older/other callers) we fall back to keep-then-append.
    keep_images_raw = data.get("keep_images")
    images_requested = keep_images_raw is not None
    if images_requested:
        keep_urls = [url.strip() for url in keep_images_raw.split(",") if url.strip()]
        keep_urls = [url for url in keep_urls if url in current_images]
    else:
        keep_urls = list(current_images)

    remaining_slots = MAX_PRODUCT_IMAGES - len(keep_urls)
    if remaining_slots < 0:
        return _json_error(f"A product can have up to {MAX_PRODUCT_IMAGES} images in total", 400)

    try:
        uploaded_images, upload_error = _get_uploaded_images(limit=remaining_slots)
    except Exception as exc:
        current_app.logger.warning("Supabase image upload failed: %s", exc)
        return _json_error(f"Unable to upload image: {exc}", 500)
    if upload_error:
        return _json_error(upload_error, 400)

    final_images = current_images
    if images_requested or uploaded_images:
        order_raw = data.get("image_order")
        if order_raw:
            keep_iter = iter(keep_urls)
            new_iter = iter(uploaded_images)
            final_images = []
            for token in (t.strip() for t in order_raw.split(",")):
                if token == "keep":
                    url = next(keep_iter, None)
                    if url:
                        final_images.append(url)
                elif token == "new":
                    url = next(new_iter, None)
                    if url:
                        final_images.append(url)
        else:
            final_images = keep_urls + uploaded_images
        payload["image_url"] = ",".join(final_images)

    if not payload:
        return _json_error("No valid fields to update", 400)

    for field, value in payload.items():
        setattr(product, field, value)
    product.updated_at = datetime.now(timezone.utc)

    try:
        db.session.add(product)
        db.session.commit()
        removed_images = [url for url in current_images if url not in final_images]
        if removed_images:
            _delete_storage_images(removed_images)
        return jsonify({"success": True, "message": "Product updated", "product": _build_product_payload(product)})
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

    product_images = _build_product_payload(product).get("images", [])

    try:
        db.session.delete(product)
        db.session.commit()
        if product_images:
            _delete_storage_images(product_images)
        return jsonify({"success": True, "message": "Product deleted"})
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning("Supabase product delete failed: %s", exc)
        return _json_error(f"Unable to delete product: {exc}", 500)
