"""
Claude AI integration — document classification + streaming query.
"""
import os
import json
import base64
from pathlib import Path
from typing import Any, AsyncIterator, Optional
from dotenv import load_dotenv
import anthropic

# Load .env from the same directory as this file — works regardless of CWD
load_dotenv(Path(__file__).parent / ".env")

MODEL = "claude-sonnet-4-5"

_anthropic: Optional[anthropic.AsyncAnthropic] = None


def get_anthropic() -> anthropic.AsyncAnthropic:
    global _anthropic
    if _anthropic is None:
        _anthropic = anthropic.AsyncAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
    return _anthropic


# ─── Classification prompt ────────────────────────────────────────────────────

CLASSIFY_SYSTEM = """You are an expert document analyst. Analyze this document and return \
ONLY a JSON object with these exact fields:
- category: broad category (Finance, Healthcare, Legal, Retail, HR, Education, \
Real Estate, Insurance, Technology, Personal, Other)
- document_type: specific type (e.g. 'Vendor Invoice', 'Medical Report', \
'Employment Contract', 'Bank Statement', 'Resume', 'Receipt')
- confidence: float 0-1
- summary: one sentence describing this specific document
- extracted_fields: object with ALL relevant fields you can find \
(dates, amounts, names, IDs, addresses, line items — everything)
- suggested_questions: array of exactly 5 questions a user would actually want \
to ask about THIS specific document (make them concrete and useful)
- theme_color: hex color that fits the category \
(Finance=#3b82f6, Healthcare=#10b981, Legal=#8b5cf6, \
Retail=#f59e0b, HR=#ec4899, Education=#14b8a6, \
Real Estate=#f97316, Insurance=#64748b, Technology=#6366f1, Personal=#a855f7, Other=#6366f1)

Return ONLY the JSON object. No markdown, no code fences, no explanation."""


async def classify_document(
    file_b64: str,
    media_type: str,
    filename: str,
) -> dict[str, Any]:
    """
    Send file to Claude for classification + field extraction in one call.
    Returns the parsed JSON response dict.
    """
    client = get_anthropic()

    # Claude vision only accepts these four image types
    VISION_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

    # Build the message content
    if media_type in VISION_TYPES:
        # Native image vision
        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": file_b64,
                },
            },
            {
                "type": "text",
                "text": f"Filename: {filename}\n\nAnalyze this document and return the JSON as instructed.",
            },
        ]
    elif media_type == "application/pdf":
        # PDF document type (supported by Claude 3.5+)
        content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": file_b64,
                },
            },
            {
                "type": "text",
                "text": f"Filename: {filename}\n\nAnalyze this document and return the JSON as instructed.",
            },
        ]
    else:
        # Text / CSV / Word / unknown — decode bytes and send as text
        try:
            text_content = base64.b64decode(file_b64).decode("utf-8", errors="replace")
        except Exception:
            text_content = "(binary content — classify by filename only)"
        content = [
            {
                "type": "text",
                "text": f"Filename: {filename}\n\nDocument content:\n{text_content[:8000]}\n\nAnalyze this document and return the JSON as instructed.",
            }
        ]

    message = await client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=CLASSIFY_SYSTEM,
        messages=[{"role": "user", "content": content}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if Claude adds them despite the prompt
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    result = json.loads(raw)
    return result


# ─── Streaming query ──────────────────────────────────────────────────────────

QUERY_SYSTEM_TEMPLATE = """You have just read this document and know it inside out:

Type: {document_type} | Category: {category}
Summary: {summary}

Data:
{extracted_fields}

You are a sharp, helpful colleague — not an AI assistant writing a report. \
Rules for every reply:
- Lead with the direct answer. Never restate the question.
- Short sentences. Cut filler words ("The document shows...", "Based on the data...", "It is worth noting...").
- Use real numbers from the data — be specific, not vague.
- For comparisons or breakdowns, list them clearly but briefly (one line each, no bullets or dashes).
- If something is missing from the data, say so in one short sentence and move on.
- Max 4-5 sentences unless the question genuinely needs more detail.
- Write exactly as you would speak to a smart colleague — casual, confident, precise.
- No markdown, no symbols, no headers. Plain conversational text only."""


async def stream_query(
    question: str,
    document_context: dict[str, Any],
    conversation_history: Optional[list[dict]] = None,
) -> AsyncIterator[str]:
    """
    Stream a Claude response token-by-token.
    Yields text chunks as they arrive from the API.
    """
    client = get_anthropic()

    doc_type = document_context.get("document_type", "Document")
    category = document_context.get("category", "General")
    summary = document_context.get("summary", "")
    extracted = document_context.get("extracted_fields", {})

    extracted_str = "\n".join(
        f"  {k}: {v}" for k, v in extracted.items()
    ) if extracted else "  (no fields extracted)"

    system_prompt = QUERY_SYSTEM_TEMPLATE.format(
        document_type=doc_type,
        category=category,
        summary=summary,
        extracted_fields=extracted_str,
    )

    messages = []
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": question})

    async with client.messages.stream(
        model=MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
