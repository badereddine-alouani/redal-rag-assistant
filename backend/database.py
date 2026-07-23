from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
import datetime

DATABASE_URL = "sqlite:///./reclamations.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Reclamation(Base):
    __tablename__ = "reclamations"

    id = Column(Integer, primary_key=True, index=True)
    numero_reclamation = Column(String(6), index=True)
    question_posee = Column(Text)
    numero_telephone = Column(String(15))
    numero_cil = Column(String(50))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class QueryLog(Base):
    __tablename__ = "query_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True)
    category = Column(String(100))
    subcategory = Column(String(100))
    user_query = Column(Text)
    is_fallback = Column(Integer, default=0) # 0 for False, 1 for True
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
