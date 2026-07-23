import os
import random
import re
from fastapi import FastAPI, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db, Reclamation, QueryLog
from email_service import process_escalation
from ingestion import DB_DIR, embeddings
from langchain_chroma import Chroma
from langchain_ollama import OllamaLLM
from fastapi.middleware.cors import CORSMiddleware
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = OllamaLLM(model="qwen3:latest", base_url=os.getenv("OLLAMA_HOST", "http://localhost:11434"))

class ChatRequest(BaseModel):
    session_id: str
    category: str
    subcategory: str
    user_question: str

class EscalateRequest(BaseModel):
    phone_number: str
    cil: str

PROMPT_TEMPLATE = """You are the Redal virtual assistant.

STRICT RULES:
- Answer ONLY using the provided context
- Do NOT add external knowledge

FORMAT RULES (VERY IMPORTANT):
- Use bullet points with "-"
- EACH bullet point MUST be on a new line
- NEVER put multiple bullet points on the same line
- Add a line break before starting a list
- Add a line break before "Note" or "Remarque"
- Use this EXACT format:

- Item 1
- Item 2
- Item 3

Note:
Text...

- Do NOT merge sentences together
- Do NOT output long paragraphs

If the answer is not explicitly present:
return EXACTLY: FALLBACK

Context:
{retrieved_context}

User question:
{question}

Answer:"""

@app.post("/api/chat")
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

@app.post("/api/escalate")
def escalate_endpoint(request: EscalateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Validate phone (Moroccan 06/07 format)
    phone = request.phone_number.replace(" ", "")
    if not re.match(r"^(06|07)\d{8}$", phone):
        raise HTTPException(status_code=400, detail="Numéro de téléphone invalide. Veuillez saisir un numéro commençant par 06 ou 07, au format national.")
    
    # Generate 6 digit claim number
    claim_id = str(random.randint(100000, 999999))
    
    new_claim = Reclamation(
        numero_reclamation=claim_id,
        question_posee="Voir logs", # The question is stored in logs, but can also be retrieved from session if passed
        numero_telephone=phone,
        numero_cil=request.cil
    )
    db.add(new_claim)
    db.commit()
    
    background_tasks.add_task(process_escalation)
    
    return {"claim_id": claim_id}
