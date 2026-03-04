"""
DocuAgent AI — FastAPI backend
Endpoints: /classify  /query/stream  /action  /documents  /health
"""
import asyncio
import base64
import json
import os
import uuid
from typing import Any, AsyncIterator

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models import (
    ActionRequest,
    ActionResponse,
    ClassifyResponse,
    DocumentListItem,
    HealthResponse,
    QueryRequest,
)
import agent
import supabase_client as db

# ─── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="DocuAgent AI",
    description="Universal document intelligence platform",
    version="1.0.0",
)

# ALLOWED_ORIGINS env var: comma-separated list, or "*" for open (dev only).
# Railway example:  ALLOWED_ORIGINS=https://your-app.vercel.app
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
_allowed_origins: list[str] = (
    ["*"] if _raw_origins.strip() == "*"
    else [o.strip() for o in _raw_origins.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache: document_id → full classification context
# Falls back to Supabase automatically if a key is missing (e.g. after reload)
_document_store: dict[str, dict[str, Any]] = {}


async def get_doc_context(document_id: str) -> dict[str, Any] | None:
    """Return doc context from memory, or fetch from Supabase if not cached."""
    if document_id in _document_store:
        return _document_store[document_id]

    # Fallback: reconstruct from Supabase
    row = await db.get_document(document_id)
    if row:
        _document_store[document_id] = row  # re-cache
    return row


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    """Quick liveness check."""
    return HealthResponse(
        status="ok",
        services={
            "claude": "connected" if agent.get_anthropic() else "unconfigured",
            "supabase": "connected" if db.get_client() else "unconfigured",
        },
    )


# ─── Document library ─────────────────────────────────────────────────────────

@app.get("/documents", response_model=list[DocumentListItem])
async def list_documents():
    """Return the 20 most recent documents for the home-screen library."""
    return await db.get_documents_list()


# ─── Classify ─────────────────────────────────────────────────────────────────

@app.post("/classify", response_model=ClassifyResponse)
async def classify(file: UploadFile = File(...)):
    """
    Accept any file upload → classify with Claude + extract fields in one shot.
    Runs Supabase storage upload + DB logging as background tasks.
    """
    document_id = str(uuid.uuid4())

    # Read file bytes
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Determine media type
    media_type = file.content_type or "application/octet-stream"
    filename = file.filename or "upload"

    # Encode to base64 for Claude
    file_b64 = base64.b64encode(contents).decode("utf-8")

    # ── Parallel: classify + upload to Supabase Storage ──────────────────────
    classify_task = asyncio.create_task(
        agent.classify_document(file_b64, media_type, filename)
    )
    upload_task = asyncio.create_task(
        db.upload_file(document_id, filename, contents, media_type)
    )

    try:
        classification, file_url = await asyncio.gather(
            classify_task, upload_task, return_exceptions=False
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Classification failed: {str(e)}"
        )

    # Validate expected keys
    required = {"category", "document_type", "confidence", "summary",
                "extracted_fields", "suggested_questions", "theme_color"}
    missing = required - set(classification.keys())
    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Claude response missing keys: {missing}",
        )

    # Cache in memory
    _document_store[document_id] = {
        **classification,
        "filename": filename,
        "file_url": file_url,
    }

    # ── Fire-and-forget: log to Supabase (includes summary + theme_color) ────
    asyncio.create_task(
        db.log_document(
            document_id=document_id,
            filename=filename,
            file_url=file_url,
            category=classification["category"],
            document_type=classification["document_type"],
            confidence=classification["confidence"],
            extracted_fields=classification["extracted_fields"],
            suggested_questions=classification["suggested_questions"],
            summary=classification["summary"],
            theme_color=classification["theme_color"],
        )
    )

    return ClassifyResponse(
        document_id=document_id,
        category=classification["category"],
        document_type=classification["document_type"],
        confidence=classification["confidence"],
        summary=classification["summary"],
        extracted_fields=classification["extracted_fields"],
        suggested_questions=classification["suggested_questions"],
        theme_color=classification["theme_color"],
        file_url=file_url,
    )


# ─── Query / Stream ───────────────────────────────────────────────────────────

@app.post("/query/stream")
async def query_stream(request: QueryRequest):
    """
    Stream Claude's answer to a question about a previously classified document.
    Returns Server-Sent Events (SSE).
    Falls back to Supabase if the document was lost from memory (e.g. after reload).
    Injects conversation history so Claude can reference earlier Q&A in this session.
    """
    doc = await get_doc_context(request.document_id)
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found. Please re-upload the file.",
        )

    # Fetch last 6 Q&A turns — gives Claude memory of this conversation
    history = await db.get_conversation_history(request.document_id)

    # Collect full answer for logging (runs alongside streaming)
    answer_parts: list[str] = []

    async def event_generator() -> AsyncIterator[str]:
        try:
            async for chunk in agent.stream_query(
                question=request.question,
                document_context=doc,
                conversation_history=history if history else None,
            ):
                answer_parts.append(chunk)
                payload = json.dumps({"token": chunk})
                yield f"data: {payload}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            full_answer = "".join(answer_parts)
            asyncio.create_task(
                db.log_query(
                    document_id=request.document_id,
                    question=request.question,
                    answer=full_answer,
                    voice_used=request.voice_used,
                )
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Actions ──────────────────────────────────────────────────────────────────

@app.post("/action", response_model=ActionResponse)
async def action(request: ActionRequest):
    """
    Log a one-click action (approve / flag / export / summarize).
    """
    valid_types = {"approved", "flagged", "exported", "summarized"}
    if request.action_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"action_type must be one of {valid_types}",
        )

    result: dict[str, Any] = {
        "action_type": request.action_type,
        "document_id": request.document_id,
    }

    if request.action_type == "exported":
        doc = await get_doc_context(request.document_id)
        if doc:
            result["export"] = {
                "document_type": doc.get("document_type"),
                "category": doc.get("category"),
                "extracted_fields": doc.get("extracted_fields", {}),
            }

    asyncio.create_task(
        db.log_action(
            document_id=request.document_id,
            action_type=request.action_type,
            result=result,
        )
    )

    return ActionResponse(success=True, result=result)
