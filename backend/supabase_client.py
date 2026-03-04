"""
Supabase client — all writes are fire-and-forget to keep latency low.
"""
import os
import asyncio
from pathlib import Path
from typing import Any, Optional
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

_client = None


def get_client():
    """Lazily initialise the Supabase client (avoids import-time failures)."""
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        return None  # gracefully degrade when env vars are missing

    try:
        from supabase import create_client
        _client = create_client(url, key)
    except Exception:
        _client = None

    return _client


# ─── Documents ────────────────────────────────────────────────────────────────

async def log_document(
    document_id: str,
    filename: str,
    file_url: Optional[str],
    category: str,
    document_type: str,
    confidence: float,
    extracted_fields: dict[str, Any],
    suggested_questions: list[str],
    summary: str = "",
    theme_color: str = "#6366f1",
) -> None:
    """Fire-and-forget insert into the documents table.

    summary and theme_color are stored inside extracted_fields under __meta
    so we can reconstruct the full context without schema changes.
    """
    client = get_client()
    if client is None:
        return

    # Embed meta into extracted_fields JSONB — no schema change needed
    fields_with_meta = {
        **extracted_fields,
        "__meta": {"summary": summary, "theme_color": theme_color},
    }

    def _insert():
        try:
            client.table("documents").insert({
                "id": document_id,
                "filename": filename,
                "file_url": file_url,
                "category": category,
                "document_type": document_type,
                "confidence": confidence,
                "extracted_fields": fields_with_meta,
                "suggested_questions": suggested_questions,
            }).execute()
        except Exception as e:
            print(f"[Supabase] log_document error: {e}")

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _insert)


async def get_document(document_id: str) -> Optional[dict[str, Any]]:
    """Fetch a document row and reconstruct the full context dict."""
    client = get_client()
    if client is None:
        return None

    def _fetch():
        try:
            result = (
                client.table("documents")
                .select("*")
                .eq("id", document_id)
                .single()
                .execute()
            )
            return result.data
        except Exception as e:
            print(f"[Supabase] get_document error: {e}")
            return None

    loop = asyncio.get_event_loop()
    row = await loop.run_in_executor(None, _fetch)
    if row is None:
        return None

    # Extract __meta back out of extracted_fields
    fields: dict[str, Any] = dict(row.get("extracted_fields") or {})
    meta: dict[str, Any] = fields.pop("__meta", {})

    return {
        "document_id": row["id"],
        "filename": row.get("filename", ""),
        "file_url": row.get("file_url"),
        "category": row.get("category", ""),
        "document_type": row.get("document_type", ""),
        "confidence": row.get("confidence", 0.0),
        "summary": meta.get("summary", ""),
        "theme_color": meta.get("theme_color", "#6366f1"),
        "extracted_fields": fields,
        "suggested_questions": row.get("suggested_questions") or [],
    }


async def get_documents_list(limit: int = 20) -> list[dict[str, Any]]:
    """Fetch recent documents for the home-screen library."""
    client = get_client()
    if client is None:
        return []

    def _fetch():
        try:
            result = (
                client.table("documents")
                .select("id, filename, category, document_type, confidence, extracted_fields, suggested_questions, created_at")
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            print(f"[Supabase] get_documents_list error: {e}")
            return []

    loop = asyncio.get_event_loop()
    rows = await loop.run_in_executor(None, _fetch)

    items = []
    for row in rows:
        fields: dict[str, Any] = dict(row.get("extracted_fields") or {})
        meta: dict[str, Any] = fields.pop("__meta", {})
        items.append({
            "document_id": row["id"],
            "filename": row.get("filename", ""),
            "category": row.get("category", ""),
            "document_type": row.get("document_type", ""),
            "confidence": row.get("confidence", 1.0),
            "summary": meta.get("summary", ""),
            "theme_color": meta.get("theme_color", "#6366f1"),
            "created_at": str(row.get("created_at", "")),
            "extracted_fields": fields,
            "suggested_questions": row.get("suggested_questions") or [],
        })
    return items


async def get_conversation_history(
    document_id: str, limit: int = 6
) -> list[dict[str, str]]:
    """Fetch last N Q&A turns and return in Claude multi-turn message format."""
    client = get_client()
    if client is None:
        return []

    def _fetch():
        try:
            result = (
                client.table("queries")
                .select("question, answer")
                .eq("document_id", document_id)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            print(f"[Supabase] get_conversation_history error: {e}")
            return []

    loop = asyncio.get_event_loop()
    rows = await loop.run_in_executor(None, _fetch)

    history: list[dict[str, str]] = []
    for row in rows:
        if row.get("question"):
            history.append({"role": "user", "content": row["question"]})
        if row.get("answer"):
            history.append({"role": "assistant", "content": row["answer"]})
    return history


# ─── Queries ──────────────────────────────────────────────────────────────────

async def log_query(
    document_id: str,
    question: str,
    answer: str,
    voice_used: bool,
) -> None:
    """Fire-and-forget insert into the queries table."""
    client = get_client()
    if client is None:
        return

    def _insert():
        try:
            client.table("queries").insert({
                "document_id": document_id,
                "question": question,
                "answer": answer,
                "voice_used": voice_used,
            }).execute()
        except Exception as e:
            print(f"[Supabase] log_query error: {e}")

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _insert)


# ─── Actions ──────────────────────────────────────────────────────────────────

async def log_action(
    document_id: str,
    action_type: str,
    result: dict[str, Any],
) -> None:
    """Fire-and-forget insert into the actions table."""
    client = get_client()
    if client is None:
        return

    def _insert():
        try:
            client.table("actions").insert({
                "document_id": document_id,
                "action_type": action_type,
                "result": result,
            }).execute()
        except Exception as e:
            print(f"[Supabase] log_action error: {e}")

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _insert)


# ─── Storage ──────────────────────────────────────────────────────────────────

async def upload_file(
    document_id: str,
    filename: str,
    data: bytes,
    content_type: str,
) -> Optional[str]:
    """Upload file to Supabase Storage and return its public URL."""
    client = get_client()
    if client is None:
        return None

    def _upload():
        try:
            bucket = "documents"
            path = f"{document_id}/{filename}"
            client.storage.from_(bucket).upload(
                path,
                data,
                {"content-type": content_type, "upsert": "true"},
            )
            response = client.storage.from_(bucket).get_public_url(path)
            return response
        except Exception as e:
            print(f"[Supabase] upload_file error: {e}")
            return None

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _upload)
