import random
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db, Reclamation, QueryLog
from schemas import EscalateRequest
from services.email_service import process_escalation

router = APIRouter()

@router.post("/escalate")
async def escalate_endpoint(request: EscalateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Validate phone
    if not request.phone_number.startswith(("06", "07")) or len(request.phone_number) != 10:
        raise HTTPException(status_code=400, detail="Numéro de téléphone invalide.")
        
    claim_id = str(random.randint(100000, 999999))
    
    # Resolve actual question from request payload or session logs
    question_text = request.user_question
    if not question_text and request.session_id:
        last_log = db.query(QueryLog).filter(QueryLog.session_id == request.session_id).order_by(QueryLog.id.desc()).first()
        if last_log:
            question_text = last_log.user_query

    if not question_text:
        question_text = "Demande d'escalade directe"

    new_claim = Reclamation(
        numero_reclamation=claim_id,
        question_posee=question_text,
        numero_telephone=request.phone_number,
        numero_cil=request.cil
    )
    db.add(new_claim)
    db.commit()
    
    # Trigger background task for Excel + Email
    background_tasks.add_task(process_escalation)
    
    return {"claim_id": claim_id}
