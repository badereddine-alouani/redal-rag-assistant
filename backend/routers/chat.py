import asyncio
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db, QueryLog
from schemas import ChatRequest
from config import PROMPT_TEMPLATE, OLLAMA_HOST
from scripts.ingestion import DB_DIR, embeddings
from langchain_chroma import Chroma
from langchain_ollama import OllamaLLM

router = APIRouter()

llm = OllamaLLM(model="qwen3:latest", base_url=OLLAMA_HOST)

@router.post("/chat")
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
    
    # Metadata filter
    filter_dict = {
        "$and": [
            {"category": request.category.strip().lower()},
            {"subcategory": request.subcategory.strip().lower()}
        ]
    }
    
    # Top-K retrieval
    retriever = vectorstore.as_retriever(
        search_kwargs={"k": 5, "filter": filter_dict}
    )
    
    # Query construction
    query_text = f"{request.user_question} {request.category} {request.subcategory}"
    docs = retriever.invoke(query_text)
    
    retrieved_context = "\n\n".join([d.page_content for d in docs])
    
    prompt = PROMPT_TEMPLATE.format(
        retrieved_context=retrieved_context,
        question=request.user_question
    )
    
    async def event_generator():
        fallback_target = "FALLBACK"
        buffer = ""
        is_fallback_mode = True
        full_response = ""
        is_fallback_result = 0
        
        async for chunk in llm.astream(prompt):
            full_response += chunk
            if is_fallback_mode:
                buffer += chunk
                
                # Strip leading whitespace which LLMs sometimes output
                stripped_buffer = buffer.strip()
                
                if stripped_buffer == fallback_target:
                    # Perfect match, it's a fallback!
                    is_fallback_result = 1
                    yield "data: [FALLBACK]\n\n"
                    break
                elif fallback_target.startswith(stripped_buffer):
                    # Still a potential fallback, hold the buffer
                    continue
                else:
                    # Deviation detected! Not a fallback.
                    is_fallback_mode = False
                    # Flush the full unstripped buffer to the client
                    safe_buffer = buffer.replace('\n', '\\n')
                    if safe_buffer:
                        yield f"data: {safe_buffer}\n\n"
                    buffer = ""
            else:
                # Normal streaming mode
                safe_chunk = chunk.replace('\n', '\\n')
                if safe_chunk:
                    yield f"data: {safe_chunk}\n\n"
                
        if not is_fallback_result:
            yield "data: [DONE]\n\n"
            
        # Log query after stream completes
        log_entry = QueryLog(
            session_id=request.session_id,
            category=request.category,
            subcategory=request.subcategory,
            user_query=request.user_question,
            is_fallback=is_fallback_result
        )
        db.add(log_entry)
        db.commit()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
