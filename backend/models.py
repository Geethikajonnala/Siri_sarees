from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import declarative_base

from supabase_client import supabase

Base = declarative_base()


class Product(Base):
    __tablename__ = "products"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    category = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    offer = Column(String(255), nullable=True)
    price = Column(Float, nullable=False)
    stock = Column(Integer, nullable=False)
    image_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=True)

    def to_payload(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "description": self.description or "",
            "offer": self.offer or "",
            "price": self.price,
            "stock": self.stock,
            "image_url": self.image_url or "",
            "created_at": self._format_datetime(self.created_at),
            "updated_at": self._format_datetime(self.updated_at),
        }

    @staticmethod
    def _format_datetime(value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)

    @classmethod
    def from_payload(cls, payload: Optional[dict[str, Any]]) -> Optional["Product"]:
        if not payload:
            return None

        product = cls(
            id=str(payload.get("id") or uuid.uuid4()),
            name=str(payload.get("name") or ""),
            category=str(payload.get("category") or ""),
            description=payload.get("description") or "",
            offer=payload.get("offer") or "",
            price=float(payload.get("price", 0) or 0),
            stock=int(payload.get("stock", 0) or 0),
            image_url=payload.get("image_url") or "",
        )

        created_at = payload.get("created_at")
        updated_at = payload.get("updated_at")
        if created_at:
            product.created_at = cls._parse_datetime(created_at)
        if updated_at:
            product.updated_at = cls._parse_datetime(updated_at)

        return product

    @staticmethod
    def _parse_datetime(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            text = value.replace("Z", "+00:00")
            normalized = re.sub(r"(\.\d{1,6})(?=[+-]\d{2}:\d{2}$)", lambda match: match.group(1).ljust(7, "0"), text)
            return datetime.fromisoformat(normalized)
        return datetime.now(timezone.utc)

    @classmethod
    def list_products(cls) -> list["Product"]:
        response = supabase.table("products").select("*").order("created_at", desc=True).execute()
        return [item for item in (cls.from_payload(payload) for payload in (response.data or [])) if item is not None]

    @classmethod
    def get_product(cls, product_id: str) -> Optional["Product"]:
        response = supabase.table("products").select("*").eq("id", product_id).single().execute()
        return cls.from_payload(response.data)


class SupabaseSession:
    def __init__(self) -> None:
        self._pending: list[tuple[str, Product]] = []

    def add(self, instance: Product) -> Product:
        self._pending.append(("upsert", instance))
        return instance

    def delete(self, instance: Product) -> Product:
        self._pending.append(("delete", instance))
        return instance

    def commit(self) -> None:
        try:
            for action, instance in self._pending:
                payload = instance.to_payload()
                if action == "delete":
                    supabase.table("products").delete().eq("id", instance.id).execute()
                else:
                    supabase.table("products").upsert(payload).execute()
            self._pending.clear()
        except Exception:
            self.rollback()
            raise

    def rollback(self) -> None:
        self._pending.clear()


class Database:
    def __init__(self) -> None:
        self.session = SupabaseSession()


db = Database()
