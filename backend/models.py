from pydantic import BaseModel
from typing import Any, Optional


# ─── Classification ───────────────────────────────────────────────────────────

class ClassifyResponse(BaseModel):
    document_id: str
    category: str
    document_type: str
    confidence: float
    summary: str
    extracted_fields: dict[str, Any]
    suggested_questions: list[str]
    theme_color: str
    file_url: Optional[str] = None


# ─── Document library ─────────────────────────────────────────────────────────

class DocumentListItem(BaseModel):
    document_id: str
    filename: str
    category: str
    document_type: str
    summary: str
    theme_color: str
    created_at: str
    confidence: float = 1.0
    extracted_fields: dict[str, Any] = {}
    suggested_questions: list[str] = []


# ─── Query / Streaming ────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    document_id: str
    question: str
    voice_used: bool = False
    context: Optional[dict[str, Any]] = None


# ─── Actions ──────────────────────────────────────────────────────────────────

class ActionRequest(BaseModel):
    document_id: str
    action_type: str  # "approved" | "flagged" | "exported" | "summarized"
    details: Optional[dict[str, Any]] = None


class ActionResponse(BaseModel):
    success: bool
    result: dict[str, Any] = {}


# ─── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    services: dict[str, str] = {}
