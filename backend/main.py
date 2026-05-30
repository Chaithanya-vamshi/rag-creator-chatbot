import os
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl
import uvicorn
import logging

from scraper import get_video_metadata
from rag_engine import ingest_videos, generate_rag_stream, clear_session

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG Creator Chatbot Backend", version="1.0.0")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    url_a: str
    url_b: str

class ChatRequest(BaseModel):
    query: str
    openai_api_key: str = None
    gemini_api_key: str = None

@app.get("/api/health")
def health_check():
    """Verify backend status."""
    return {"status": "healthy", "service": "RAG Creator Chatbot"}

@app.post("/api/analyze")
async def analyze_videos(request: AnalyzeRequest):
    """
    Extract metadata and transcripts for both social URLs,
    compute statistics, and ingest into the RAG memory context.
    """
    url_a = str(request.url_a).strip()
    url_b = str(request.url_b).strip()

    if not url_a or not url_b:
        raise HTTPException(status_code=400, detail="Both Video A and Video B URLs must be provided.")

    logger.info(f"Received analysis request: Video A={url_a}, Video B={url_b}")

    try:
        # Clear active session before ingesting new videos
        clear_session()
        
        # Analyze Video A (YouTube)
        logger.info("Analyzing Video A...")
        video_a_data = get_video_metadata(url_a, is_video_a=True)
        
        # Analyze Video B (Instagram Reels)
        logger.info("Analyzing Video B...")
        video_b_data = get_video_metadata(url_b, is_video_a=False)
        
        # Ingest both datasets into the session RAG memory
        logger.info("Ingesting video data into RAG Engine...")
        ingest_videos(video_a_data, video_b_data)
        
        return {
            "success": True,
            "video_a": video_a_data,
            "video_b": video_b_data
        }
        
    except Exception as e:
        logger.exception("Failed to analyze videos")
        raise HTTPException(status_code=500, detail=f"Scraping/Analysis failed: {str(e)}")

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    RAG Streaming Chat endpoint.
    Streams token-by-token using Server-Sent Events (SSE) alongside sources and citations.
    """
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    logger.info(f"Received RAG query: {query}")
    
    # Read API keys from body or environment
    openai_key = request.openai_api_key or os.getenv("OPENAI_API_KEY")
    gemini_key = request.gemini_api_key or os.getenv("GEMINI_API_KEY")
    
    try:
        generator = generate_rag_stream(
            query=query,
            openai_api_key=openai_key,
            gemini_api_key=gemini_key
        )
        return StreamingResponse(generator, media_type="text/event-stream")
    except Exception as e:
        logger.exception("RAG streaming pipeline failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clear")
async def clear_session_endpoint():
    """Clear active workspace session."""
    clear_session()
    return {"success": True, "message": "Active session cleared successfully."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
