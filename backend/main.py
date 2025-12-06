"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import uuid
import json
import asyncio

from . import storage
from .council import run_full_council, generate_conversation_title, stage1_collect_responses, stage2_collect_rankings, stage3_synthesize_final, calculate_aggregate_rankings, run_stage1_for_model, run_stage2_for_model
from .openrouter import fetch_available_models

app = FastAPI(title="LLM Council API")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    pass


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str
    mode: str = Field(default="auto", pattern=r"^(auto|step)$")


class UpdateTitleRequest(BaseModel):
    conversation_id: str
    title: str = Field(min_length=1, max_length=50)


class ConversationMetadata(BaseModel):
    """Conversation metadata for list view."""
    id: str
    created_at: str
    title: str
    message_count: int


class Conversation(BaseModel):
    """Full conversation with all messages."""
    id: str
    created_at: str
    title: str
    messages: List[Dict[str, Any]]
    council_models: List[str] | None = None
    chairman_model: str | None = None


class RerunRequest(BaseModel):
    """Optional new prompt for full rerun."""
    content: str | None = None


class UpdateConfigRequest(BaseModel):
    council_models: List[str] | None = None
    chairman_model: str | None = None


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


@app.get("/api/models")
async def list_models():
    models, from_cache = await fetch_available_models()
    return {"models": models, "cached": from_cache}


@app.get("/api/conversations", response_model=List[ConversationMetadata])
async def list_conversations():
    """List all conversations (metadata only)."""
    return storage.list_conversations()


@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(request: CreateConversationRequest):
    """Create a new conversation."""
    conversation_id = str(uuid.uuid4())
    conversation = storage.create_conversation(conversation_id)
    return conversation


@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    """Get a specific conversation with all its messages."""
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation

@app.patch("/api/conversations/{conversation_id}/title")
async def update_conversation_title_endpoint(conversation_id: str, request: UpdateTitleRequest):
    import re
    if conversation_id != request.conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id mismatch")
    title = request.title.strip()
    if not re.fullmatch(r"[\w\s\-_.]{1,50}", title):
        raise HTTPException(status_code=400, detail="Invalid title format")

    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    storage.update_conversation_title(conversation_id, title)
    return {"ok": True, "title": title}


@app.patch("/api/conversations/{conversation_id}/config")
async def update_conversation_config_endpoint(conversation_id: str, request: UpdateConfigRequest):
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    models_payload, _ = await fetch_available_models()
    available_ids = {m.get("id") for m in models_payload}
    updates: Dict[str, Any] = {}
    if request.council_models is not None:
        cleaned = []
        seen = set()
        for mid in request.council_models:
            if not isinstance(mid, str):
                continue
            m = mid.strip()
            if not m or m in seen:
                continue
            if m not in available_ids:
                raise HTTPException(status_code=400, detail=f"Unknown model: {m}")
            seen.add(m)
            cleaned.append(m)
        updates["council_models"] = cleaned
    if request.chairman_model is not None:
        cm = request.chairman_model.strip()
        if cm and cm not in available_ids:
            raise HTTPException(status_code=400, detail="Unknown chairman model")
        updates["chairman_model"] = cm
    storage.update_conversation_config(conversation_id, updates)
    updated = storage.get_conversation(conversation_id)
    return {"ok": True, "config": {"council_models": updated.get("council_models"), "chairman_model": updated.get("chairman_model")}}

@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    deleted = storage.delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True}


@app.post("/api/conversations/{conversation_id}/message")
async def send_message(conversation_id: str, request: SendMessageRequest):
    """
    Send a message and run the 3-stage council process.
    Returns the complete response with all stages.
    """
    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    # Add user message
    storage.add_user_message(conversation_id, request.content)

    # If this is the first message, generate a title
    if is_first_message:
        title = await generate_conversation_title(request.content)
        storage.update_conversation_title(conversation_id, title)

    # Run the 3-stage council process
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(
        request.content,
        conversation.get("council_models"),
        conversation.get("chairman_model"),
    )

    # Add assistant message with all stages
    storage.add_assistant_message(
        conversation_id,
        stage1_results,
        stage2_results,
        stage3_result
    )

    # Return the complete response with metadata
    return {
        "stage1": stage1_results,
        "stage2": stage2_results,
        "stage3": stage3_result,
        "metadata": metadata
    }


@app.post("/api/conversations/{conversation_id}/message/stream")
async def send_message_stream(conversation_id: str, request: SendMessageRequest):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    """
    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    async def event_generator():
        try:
            # Add user message
            storage.add_user_message(conversation_id, request.content)

            # Start title generation in parallel (don't await yet)
            title_task = None
            if is_first_message:
                title_task = asyncio.create_task(generate_conversation_title(request.content))

            # Stage 1: Collect responses
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = await stage1_collect_responses(request.content, conversation.get("council_models"))
            yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # If step mode, persist partial result and pause
            if request.mode == "step":
                # Title generation completion
                if title_task:
                    title = await title_task
                    storage.update_conversation_title(conversation_id, title)
                    yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

                # Save partial assistant message (Stage 1 only)
                storage.add_assistant_message(
                    conversation_id,
                    stage1_results,
                    None,
                    None,
                )

                # Persist paused state so UI can show Continue across sessions
                try:
                    conv = storage.get_conversation(conversation_id)
                    if conv and isinstance(conv.get("messages"), list) and len(conv["messages"]) > 0:
                        last_index = len(conv["messages"]) - 1
                        storage.update_message(conversation_id, last_index, {
                            "paused": True,
                            "pausedStage": "stage1",
                        })
                except Exception:
                    # Non-fatal; continue streaming paused event
                    pass

                # Emit paused event and stop stream
                yield f"data: {json.dumps({'type': 'paused', 'stage': 'stage1'})}\n\n"
                return

            # Stage 2: Collect rankings
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            stage2_results, label_to_model = await stage2_collect_rankings(request.content, stage1_results, conversation.get("council_models"))
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: Synthesize final answer
            yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
            stage3_result = await stage3_synthesize_final(request.content, stage1_results, stage2_results, conversation.get("chairman_model"))
            yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Wait for title generation if it was started
            if title_task:
                title = await title_task
                storage.update_conversation_title(conversation_id, title)
                yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

            # Save complete assistant message
            storage.add_assistant_message(
                conversation_id,
                stage1_results,
                stage2_results,
                stage3_result
            )

            # Send completion event
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@app.post("/api/conversations/{conversation_id}/messages/{message_index}/continue")
async def continue_to_next_stage(conversation_id: str, message_index: int):
    """
    Continue step-by-step execution to the next stage for a specific assistant message.
    """
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg = storage.get_message(conversation_id, message_index)
    if msg is None or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="Assistant message not found")

    # Find the user prompt (assumed to be previous message)
    if message_index - 1 < 0:
        raise HTTPException(status_code=400, detail="Invalid message index")
    user_msg = storage.get_message(conversation_id, message_index - 1)
    if user_msg is None or user_msg.get("role") != "user":
        raise HTTPException(status_code=400, detail="Previous user message not found")

    user_query = user_msg.get("content", "")

    # Decide which stage to run next
    if msg.get("stage1") is not None and msg.get("stage2") is None:
        # Run Stage 2
        stage2_results, label_to_model = await stage2_collect_rankings(user_query, msg["stage1"])
        aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
        storage.update_message(conversation_id, message_index, {
            "stage2": stage2_results,
            "metadata": {
                "label_to_model": label_to_model,
                "aggregate_rankings": aggregate_rankings,
            },
            "paused": True,
            "pausedStage": "stage2",
        })
        return {
            "stage": "stage2",
            "data": stage2_results,
            "metadata": {
                "label_to_model": label_to_model,
                "aggregate_rankings": aggregate_rankings,
            }
        }

    if msg.get("stage2") is not None and msg.get("stage3") is None:
        # Run Stage 3
        stage3_result = await stage3_synthesize_final(user_query, msg["stage1"], msg["stage2"], conversation.get("chairman_model"))
        storage.update_message(conversation_id, message_index, {
            "stage3": stage3_result,
            "paused": False,
            "pausedStage": None,
        })
        return {
            "stage": "stage3",
            "data": stage3_result
        }

    # Nothing to do
    return {"stage": "complete"}


@app.post("/api/conversations/{conversation_id}/messages/{message_index}/rerun")
async def rerun_full(conversation_id: str, message_index: int, request: RerunRequest):
    """
    Full rerun of all stages for a specific assistant message.
    Optionally replace the preceding user message content.
    """
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Validate assistant message index
    msg = storage.get_message(conversation_id, message_index)
    if msg is None or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="Assistant message not found")

    # Get the preceding user message
    if message_index - 1 < 0:
        raise HTTPException(status_code=400, detail="Invalid message index")
    user_msg = storage.get_message(conversation_id, message_index - 1)
    if user_msg is None or user_msg.get("role") != "user":
        raise HTTPException(status_code=400, detail="Previous user message not found")

    # Override prompt if provided
    user_query = request.content if (request.content is not None and request.content.strip() != "") else user_msg.get("content", "")
    if request.content is not None and request.content.strip() != "":
        storage.update_message(conversation_id, message_index - 1, {"content": request.content})

    # Run full council
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(user_query, conversation.get("council_models"), conversation.get("chairman_model"))

    # Update assistant message
    storage.update_message(conversation_id, message_index, {
        "stage1": stage1_results,
        "stage2": stage2_results,
        "stage3": stage3_result,
        "metadata": metadata,
    })

    return {
        "stage1": stage1_results,
        "stage2": stage2_results,
        "stage3": stage3_result,
        "metadata": metadata,
    }


@app.post("/api/conversations/{conversation_id}/messages/{message_index}/stage1/model/{model_name:path}")
async def rerun_stage1_model(conversation_id: str, message_index: int, model_name: str):
    """
    Rerun Stage 1 for a specific model and update the assistant message.
    """
    # Validate
    msg = storage.get_message(conversation_id, message_index)
    if msg is None or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="Assistant message not found")
    user_msg = storage.get_message(conversation_id, message_index - 1)
    if user_msg is None or user_msg.get("role") != "user":
        raise HTTPException(status_code=400, detail="Previous user message not found")

    user_query = user_msg.get("content", "")

    # Run single model
    entry = await run_stage1_for_model(user_query, model_name)

    # Replace or append in stage1
    stage1 = msg.get("stage1") or []
    replaced = False
    for i, r in enumerate(stage1):
        if r.get("model") == model_name:
            stage1[i] = entry
            replaced = True
            break
    if not replaced:
        stage1.append(entry)

    storage.update_message(conversation_id, message_index, {"stage1": stage1})
    return {"stage1": stage1}


@app.post("/api/conversations/{conversation_id}/messages/{message_index}/stage2/model/{model_name:path}")
async def rerun_stage2_model(conversation_id: str, message_index: int, model_name: str):
    """
    Rerun Stage 2 for a specific model and update the assistant message.
    Also recalculates aggregate rankings.
    """
    msg = storage.get_message(conversation_id, message_index)
    if msg is None or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="Assistant message not found")
    user_msg = storage.get_message(conversation_id, message_index - 1)
    if user_msg is None or user_msg.get("role") != "user":
        raise HTTPException(status_code=400, detail="Previous user message not found")

    user_query = user_msg.get("content", "")
    stage1_results = msg.get("stage1") or []

    # Run single ranking
    entry, label_to_model = await run_stage2_for_model(user_query, stage1_results, model_name)

    # Replace or append in stage2
    stage2 = msg.get("stage2") or []
    replaced = False
    for i, r in enumerate(stage2):
        if r.get("model") == model_name:
            stage2[i] = entry
            replaced = True
            break
    if not replaced:
        stage2.append(entry)

    aggregate_rankings = calculate_aggregate_rankings(stage2, label_to_model)

    storage.update_message(conversation_id, message_index, {
        "stage2": stage2,
        "metadata": {
            "label_to_model": label_to_model,
            "aggregate_rankings": aggregate_rankings,
        }
    })

    return {
        "stage2": stage2,
        "metadata": {
            "label_to_model": label_to_model,
            "aggregate_rankings": aggregate_rankings,
        }
    }


@app.post("/api/conversations/{conversation_id}/messages/{message_index}/stage3")
async def rerun_stage3(conversation_id: str, message_index: int):
    """
    Rerun Stage 3 (final verdict) and update the assistant message.
    """
    msg = storage.get_message(conversation_id, message_index)
    if msg is None or msg.get("role") != "assistant":
        raise HTTPException(status_code=404, detail="Assistant message not found")
    user_msg = storage.get_message(conversation_id, message_index - 1)
    if user_msg is None or user_msg.get("role") != "user":
        raise HTTPException(status_code=400, detail="Previous user message not found")

    user_query = user_msg.get("content", "")

    stage3_result = await stage3_synthesize_final(user_query, msg.get("stage1") or [], msg.get("stage2") or [])
    storage.update_message(conversation_id, message_index, {"stage3": stage3_result})
    return {"stage3": stage3_result}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
