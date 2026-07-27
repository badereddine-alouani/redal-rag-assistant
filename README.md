# Redal Virtual Assistant (RAG Chatbot)

An intelligent virtual assistant for **Redal (Groupe Veolia)** customer support, built with a **Retrieval-Augmented Generation (RAG)** architecture. The system answers customer questions from pre-indexed FAQ documents and escalates unresolved queries to human support.

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite |
| **Backend** | Python, FastAPI |
| **RAG Framework** | LangChain |
| **Vector Database** | ChromaDB |
| **Embeddings** | `bge-m3:latest` (via Ollama) |
| **LLM** | `qwen3:latest` (via Ollama) |
| **Relational DB** | SQLite |
| **Containerization**| Docker, Docker Compose, Nginx |

## Project Structure

```
redal-rag/
├── data/                          # FAQ source documents (PDF, DOCX)
├── backend/
│   ├── main.py                    # FastAPI entrypoint
│   ├── config.py                  # Logger, prompt template, env config
│   ├── database.py                # SQLAlchemy models (QueryLog, Reclamation)
│   ├── schemas.py                 # Pydantic request models
│   ├── routers/
│   │   ├── chat.py                # /api/chat - RAG Q&A endpoint (SSE)
│   │   └── escalate.py            # /api/escalate - Claim submission
│   ├── services/
│   │   └── email_service.py       # Excel export + Gmail SMTP
│   └── scripts/
│       └── ingestion.py           # One-time FAQ indexing pipeline
└── frontend/
    └── src/
        ├── App.tsx                # Main app orchestrator
        ├── types.ts               # Shared TypeScript types
        ├── index.css              # Design system (Dark/Light mode)
        └── components/
            ├── ChatMessage.tsx    # Message bubble (Markdown + streaming)
            ├── ChatOptions.tsx    # Category/subcategory pill buttons
            ├── EscalationForm.tsx # Phone + CIL claim form
            └── ThemeToggle.tsx    # Dark/Light mode toggle
```

## Getting Started

### Prerequisites

- **Ollama** running locally with `bge-m3:latest` and `qwen3:latest` models pulled
- **Docker Desktop** (for production/containerized deployment)
- *Optional:* Python 3.10+ and Node.js 18+ (for local development without Docker)

### Option 1: Docker Deployment (Recommended)

1. Create a `backend/.env` file (copy from `backend/.env.example`).
2. Build and start the containers:
   ```bash
   docker compose up --build -d
   ```
3. The app is fully live at **`http://localhost:3000`** (Nginx handles React + API reverse proxying).

### Option 2: Local Development (Without Docker)

#### 1. Backend Setup

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
source venv/bin/activate       # macOS/Linux

pip install -r requirements.txt
```

#### 2. Environment Variables

Create a `backend/.env` file (see `.env.example`).

#### 3. Ingest FAQ Documents

```bash
cd backend
python scripts/ingestion.py
```

#### 4. Start the Backend

```bash
cd backend
python main.py
```

The API server will start at `http://localhost:8000`.

#### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`. Vite is configured to automatically proxy `/api` requests to the local backend.

## Features

- **RAG-powered Q&A** with metadata-filtered vector search
- **Real-time streaming** responses via Server-Sent Events (SSE)
- **Prompt injection protection** with strict LLM guardrails
- **Automated escalation** with claim tracking and email notifications
- **Dark/Light mode** with official Redal/Veolia branding
- **Moroccan phone validation** (06/07 format)
