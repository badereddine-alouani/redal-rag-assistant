from pydantic import BaseModel

class ChatRequest(BaseModel):
    session_id: str
    category: str
    subcategory: str
    user_question: str

class EscalateRequest(BaseModel):
    phone_number: str
    cil: str
    user_question: str | None = None
    session_id: str | None = None
