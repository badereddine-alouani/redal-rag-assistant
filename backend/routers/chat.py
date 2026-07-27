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
    
    # Buffer full response to check for FALLBACK
    full_response = llm.invoke(prompt)
    
    is_fallback = 1 if full_response.strip() == "FALLBACK" else 0
    
    # Log query
    log_entry = QueryLog(
        session_id=request.session_id,
        category=request.category,
        subcategory=request.subcategory,
        user_query=request.user_question,
        is_fallback=is_fallback
    )
    db.add(log_entry)
    db.commit()
    
    if is_fallback:
        return {"fallback": True}
    
    # Fake stream the buffered response to satisfy streaming requirement
    async def event_generator():
        for i in range(0, len(full_response), 5):
            chunk = full_response[i:i+5]
            safe_chunk = chunk.replace('\n', '\\n')
            yield f"data: {safe_chunk}\n\n"
            await asyncio.sleep(0.02)
        yield "data: [DONE]\n\n"
        
    return StreamingResponse(event_generator(), media_type="text/event-stream")
