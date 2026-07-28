from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, escalate
import uvicorn

app = FastAPI(title="Redal Assistant Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")
app.include_router(escalate.router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
