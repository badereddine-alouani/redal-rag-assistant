import random
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db, Reclamation
from schemas import EscalateRequest
from services.email_service import process_escalation

router = APIRouter()

@router.post("/escalate")
async def escalate_endpoint(request: EscalateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Validate phone (already done in frontend, but good practice in backend)
    if not request.phone_number.startswith(("06", "07")) or len(request.phone_number) != 10:
        raise HTTPException(status_code=400, detail="Numéro de téléphone invalide.")
        
    claim_id = str(random.randint(100000, 999999))
    
    new_claim = Reclamation(
        numero_reclamation=claim_id,
        question_posee="Voir logs pour le contexte (escalade directe)", # or fetch from logs
        numero_telephone=request.phone_number,
        numero_cil=request.cil
    )
    db.add(new_claim)
    db.commit()
    
    # Trigger background task for Excel + Email
    background_tasks.add_task(process_escalation, db)
    
    return {"claim_id": claim_id}
