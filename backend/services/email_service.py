import os
import smtplib
from email.message import EmailMessage
from openpyxl import Workbook
from sqlalchemy.orm import Session
from database import SessionLocal, Reclamation
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_excel(db: Session, filepath: str):
    reclamations = db.query(Reclamation).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Reclamations"
    
    # Headers
    headers = ["ID", "Numéro Réclamation", "Question Posée", "Numéro Téléphone", "Numéro CIL", "Date"]
    ws.append(headers)
    
    for r in reclamations:
        ws.append([
            r.id,
            r.numero_reclamation,
            r.question_posee,
            r.numero_telephone,
            r.numero_cil,
            str(r.created_at)
        ])
    
    wb.save(filepath)

def send_email_with_excel(filepath: str, max_retries=3):
    email_user = os.getenv("EMAIL_USER")
    email_pass = os.getenv("EMAIL_PASSWORD")
    to_email = "theone2023g@gmail.com"
    
    if not email_user or not email_pass:
        logger.error("Email credentials not found in environment. Skipping email sending.")
        return False
        
    msg = EmailMessage()
    msg['Subject'] = 'Nouvelles Réclamations - Assistant Virtuel Redal'
    msg['From'] = email_user
    msg['To'] = to_email
    msg.set_content("Veuillez trouver ci-joint le fichier mis à jour des réclamations.")
    
    with open(filepath, 'rb') as f:
        file_data = f.read()
    
    msg.add_attachment(file_data, maintype='application', subtype='vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename='reclamations_export.xlsx')
    
    for attempt in range(max_retries):
        try:
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(email_user, email_pass)
                smtp.send_message(msg)
            logger.info("Email sent successfully.")
            return True
        except Exception as e:
            logger.error(f"Attempt {attempt + 1} failed: {e}")
            time.sleep(2 ** attempt)
            
    logger.error("Failed to send email after multiple attempts.")
    return False

def process_escalation():
    db = SessionLocal()
    try:
        filepath = "reclamations_export.xlsx"
        generate_excel(db, filepath)
        send_email_with_excel(filepath)
    except Exception as e:
        logger.error(f"Error in process_escalation: {e}")
    finally:
        db.close()
        if os.path.exists("reclamations_export.xlsx"):
            os.remove("reclamations_export.xlsx")
