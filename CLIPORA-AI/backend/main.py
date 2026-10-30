import os
import sys
import uuid
from pathlib import Path

# Ensure backend directory is in Python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from gemini_service import generate_studio_content, get_client, search_audio_moments
from media_service import cut_audio_clip

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
CLIPS_DIR = BASE_DIR / "clips"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
CLIPS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="CLIPORA AI Backend",
    description="Context-Aware Smart Media Studio Backend API",
    version="1.0.0"
)

# Enable CORS for local development and file:// origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded media and generated clips
app.mount("/clips", StaticFiles(directory=str(CLIPS_DIR)), name="clips")
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

@app.get("/")
def root():
    return {
        "app": "CLIPORA AI Backend",
        "status": "online",
        "docs": "/docs"
    }

@app.get("/api/health")
def health_check():
    from gemini_service import reload_env, get_configured_text_model
    reload_env()
    api_key_set = bool(os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'"))
    return {
        "status": "ok",
        "api_key_configured": api_key_set,
        "text_model": get_configured_text_model()
    }

@app.post("/api/studio/generate")
async def studio_generate(
    prompt: str = Form(...),
    studio_type: str = Form("image"),
    file: UploadFile = File(None)
):
    if not prompt or not prompt.strip():
        raise HTTPException(status_code=400, detail="Please enter a description or prompt.")

    file_bytes = None
    mime_type = None

    if file:
        file_bytes = await file.read()
        mime_type = file.content_type

    try:
        result = generate_studio_content(
            prompt=prompt.strip(),
            studio_type=studio_type.strip().lower(),
            reference_file_bytes=file_bytes,
            mime_type=mime_type
        )
        return JSONResponse(content=result)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/search/audio")
async def search_audio(
    file: UploadFile = File(...),
    query: str = Form(...)
):
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Please enter what you want to find in the query box.")

    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Please upload an audio file to search.")

    file_id = uuid.uuid4().hex[:8]
    ext = Path(file.filename).suffix or ".mp3"
    safe_name = f"audio_{file_id}{ext}"
    saved_path = UPLOADS_DIR / safe_name

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded audio file is empty.")
        with open(saved_path, "wb") as f_out:
            f_out.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save audio file: {e}")

    try:
        client = get_client()
        moments = search_audio_moments(client, str(saved_path), query.strip())

        extracted_matches = []
        for i, m in enumerate(moments):
            clip_name = f"clip_{file_id}_{i+1}.mp3"
            clip_path = CLIPS_DIR / clip_name
            clip_url = None
            try:
                cut_audio_clip(str(saved_path), str(clip_path), m["start_time"], m["end_time"])
                clip_url = f"http://127.0.0.1:8000/clips/{clip_name}"
            except Exception as cut_err:
                m["clip_error"] = str(cut_err)

            clean_title = m.get("title", f"Moment_{i+1}").replace(" ", "_").replace("/", "-")
            extracted_matches.append({
                **m,
                "clip_url": clip_url,
                "download_name": f"{clean_title}.mp3"
            })

        return JSONResponse(content={
            "status": "success",
            "query": query.strip(),
            "filename": file.filename,
            "total_matches": len(extracted_matches),
            "matches": extracted_matches
        })
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
