"""
Ingestion script for the Redal RAG Assistant.

Parses the structured Markdown FAQ file, extracts Q/A pairs with
category and subcategory metadata, chunks them, generates embeddings
using bge-m3, and stores them in ChromaDB.
"""
import os
import sys
import re
from typing import Optional

# Add parent directory (backend) to sys.path so config can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_core.documents import Document
from langchain_chroma import Chroma
from config import logger
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

DB_DIR = "./chroma_db"

embeddings = OllamaEmbeddings(
    model="bge-m3:latest",
    base_url=os.getenv("OLLAMA_HOST", "http://localhost:11434")
)

# Maps h2 headings (##) to categories
CATEGORY_MAP: dict[str, str] = {
    "commerciale": "commerciale",
    "technique": "technique",
}

# Maps h3 headings (###) to subcategories per category
SUBCATEGORIES: dict[str, list[str]] = {
    "commerciale": [
        "branchement",
        "abonnement",
        "résiliation",
        "tarification",
        "solutions de paiement",
        "services digitaux",
        "service sms",
        "demande d'attestations",
        "réseau commercial",
    ],
    "technique": [
        "branchement",
        "assainissement",
        "eau",
        "électricité",
        "coupure des fournitures",
    ],
}


def parse_markdown_faq(file_path: str) -> list[Document]:
    """
    Parse a structured Markdown FAQ file into LangChain Document objects.

    The expected Markdown structure is:
        ## Category (Commerciale / Technique)
        ### Subcategory
        #### Q : Question text
        **R :** Answer text (can be multi-line)

    Each Q/A pair is extracted with its category and subcategory metadata.
    Long answers are split into chunks of 300-500 tokens with overlap.

    Args:
        file_path: Path to the Markdown FAQ file.

    Returns:
        A list of LangChain Document objects ready for embedding.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.split("\n")

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100,
        length_function=len,
    )

    docs: list[Document] = []
    current_category: Optional[str] = None
    current_subcategory: Optional[str] = None
    current_question: Optional[str] = None
    current_answer_lines: list[str] = []

    def flush_qa() -> None:
        """Flush the current Q/A pair into Document chunks."""
        nonlocal current_answer_lines, current_question

        if current_question and current_category and current_subcategory:
            answer_text = "\n".join(current_answer_lines).strip()

            if len(answer_text) >= 20:
                chunks = text_splitter.split_text(answer_text)

                for chunk in chunks:
                    # Prepend the question to the chunk content so
                    # the embedding captures both Q and A semantics.
                    enriched_content = f"Question: {current_question}\nRéponse: {chunk}"
                    docs.append(Document(
                        page_content=enriched_content,
                        metadata={
                            "category": current_category,
                            "subcategory": current_subcategory,
                            "question": current_question,
                            "source": "faq_md",
                        }
                    ))

        current_answer_lines = []

    for line in lines:
        stripped = line.strip()

        # Skip empty lines and horizontal rules (---)
        if not stripped or stripped == "---":
            continue

        # Detect h2 heading: ## Category
        h2_match = re.match(r"^##\s+(.+)$", stripped)
        if h2_match and not stripped.startswith("###"):
            heading = h2_match.group(1).strip().lower()
            if heading in CATEGORY_MAP:
                flush_qa()
                current_category = CATEGORY_MAP[heading]
                current_subcategory = None
                current_question = None
            continue

        # Detect h3 heading: ### Subcategory
        h3_match = re.match(r"^###\s+(.+)$", stripped)
        if h3_match and not stripped.startswith("####"):
            heading = h3_match.group(1).strip().lower()
            if current_category and heading in SUBCATEGORIES.get(current_category, []):
                flush_qa()
                current_subcategory = heading
                current_question = None
            continue

        # Detect h4 heading: #### Q : Question text
        h4_match = re.match(r"^####\s+Q\s*:\s*(.+)$", stripped)
        if h4_match:
            flush_qa()
            current_question = h4_match.group(1).strip().lower()
            continue

        # Skip non-question h4 headings (e.g. "#### Facture digitale", "#### E-relance")
        if re.match(r"^####\s+", stripped):
            continue

        # Skip the main h1 title
        if re.match(r"^#\s+", stripped):
            continue

        # Skip blockquotes (> **N.B.**) - these are notes, not answers
        if stripped.startswith(">"):
            # Include the note content as part of the answer if we're inside a Q/A
            if current_question:
                # Strip the blockquote marker
                note_text = re.sub(r"^>\s*", "", stripped)
                current_answer_lines.append(note_text)
            continue

        # Detect answer start: **R :** or **R:**
        r_match = re.match(r"^\*\*R\s*:\*\*\s*(.*)", stripped)
        if r_match:
            answer_start = r_match.group(1).strip()
            if answer_start:
                current_answer_lines.append(answer_start)
            continue

        # Accumulate answer lines (everything else while inside a Q/A)
        if current_question:
            current_answer_lines.append(stripped)

    # Flush any remaining Q/A pair
    flush_qa()

    return docs


def ingest_data() -> None:
    """
    Main ingestion pipeline.

    Parses the Markdown FAQ, generates embeddings, and stores
    the resulting documents in ChromaDB with metadata for filtering.
    """
    file_path = "../data/faq.md"

    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return

    docs = parse_markdown_faq(file_path)

    if not docs:
        logger.warning("No structured documents parsed.")
        return

    logger.info(f"Parsed {len(docs)} chunks from Markdown FAQ.")
    logger.info(f"Storing {len(docs)} chunks in ChromaDB...")

    vectorstore = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        persist_directory=DB_DIR
    )

    logger.info(f"Ingestion complete at {DB_DIR}")


if __name__ == "__main__":
    ingest_data()
