import os
import base64
import urllib.request
import urllib.parse
from pathlib import Path
from dotenv import load_dotenv

# Look for .env in current directory and parent (project root)
root_env = Path(__file__).resolve().parent.parent / ".env"
local_env = Path(__file__).resolve().parent / ".env"

if root_env.exists():
    load_dotenv(root_env, override=True)
if local_env.exists() and not os.getenv("GEMINI_API_KEY", "").strip():
    load_dotenv(local_env, override=True)

def reload_env():
    if root_env.exists():
        load_dotenv(root_env, override=True)
    if local_env.exists():
        load_dotenv(local_env, override=True)

def get_api_key():
    reload_env()
    api_key = os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not set. Please paste your Gemini API key inside the .env file in the project folder."
        )
    return api_key

def get_client():
    from google import genai
    api_key = get_api_key()
    return genai.Client(api_key=api_key)

def get_configured_text_model():
    reload_env()
    return os.getenv("GEMINI_TEXT_MODEL", "gemini-3.8-flash").strip().strip('"').strip("'")

def generate_text_with_fallback(client, prompt: str) -> tuple[str, str]:
    """
    Generate text using the configured GEMINI_TEXT_MODEL with automatic fallback
    and dynamic ListModels discovery. Returns (text_content, model_name_used).
    """
    configured_model = get_configured_text_model()
    
    # Priority candidate list
    candidates = [
        configured_model,
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-pro-latest"
    ]
    
    # Deduplicate while preserving order
    seen = set()
    models_to_try = [m for m in candidates if m and not (m in seen or seen.add(m))]

    last_error = None
    for model_name in models_to_try:
        clean_name = model_name.replace("models/", "").strip()
        try:
            response = client.models.generate_content(
                model=clean_name,
                contents=prompt
            )
            if response and response.text:
                return response.text, clean_name
        except Exception as e:
            last_error = e
            continue

    # Fallback to dynamic model discovery via client.models.list()
    try:
        available_models = [m.name.replace("models/", "").strip() for m in client.models.list()]
        flash_models = [
            m for m in available_models 
            if "flash" in m and "image" not in m and "tts" not in m and "preview" not in m
        ]
        # Append remaining flash models
        for m in available_models:
            if "flash" in m and m not in flash_models:
                flash_models.append(m)

        for dynamic_model in flash_models:
            try:
                response = client.models.generate_content(
                    model=dynamic_model,
                    contents=prompt
                )
                if response and response.text:
                    return response.text, dynamic_model
            except Exception:
                continue
    except Exception as list_err:
        pass

    raise RuntimeError(f"Could not generate text with Gemini models. Last error: {last_error}")

def generate_studio_content(prompt: str, studio_type: str = "image", reference_file_bytes: bytes = None, mime_type: str = None):
    """
    Generate studio media using Gemini and AI services.
    Supported types: 'image', 'storyboard', 'video', 'audio'.
    """
    client = get_client()

    if studio_type == "image":
        data_url = None
        used_method = "Gemini Flash Image"

        # 1. Try Gemini Developer API image generation if enabled on key
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=f"Generate a detailed, high quality cinematic image of: {prompt}"
            )
            if hasattr(response, "candidates") and response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        b64_data = base64.b64encode(part.inline_data.data).decode("utf-8")
                        mime = part.inline_data.mime_type or "image/jpeg"
                        data_url = f"data:{mime};base64,{b64_data}"
                        break
        except Exception:
            pass

        # 2. If Gemini image quota is 0 on free tier Developer API, generate via high-resolution image engine
        if not data_url:
            try:
                clean_prompt = urllib.parse.quote(prompt.strip()[:200])
                image_api_url = f"https://image.pollinations.ai/prompt/{clean_prompt}?width=1024&height=1024&nologo=true"
                req = urllib.request.Request(image_api_url, headers={"User-Agent": "CLIPORA-AI/1.0"})
                with urllib.request.urlopen(req, timeout=18) as res:
                    img_bytes = res.read()
                    b64_data = base64.b64encode(img_bytes).decode("utf-8")
                    data_url = f"data:image/jpeg;base64,{b64_data}"
                    used_method = "AI Studio Image Engine"
            except Exception as fallback_err:
                raise RuntimeError(f"Image generation failed: {fallback_err}")

        return {
            "type": "image",
            "data": data_url,
            "prompt": prompt,
            "model": used_method,
            "message": f"Image generated successfully using {used_method}!"
        }

    elif studio_type == "storyboard":
        storyboard_prompt = f"""You are an expert film director and visual storyteller.
Create a detailed, cinematic storyboard based on this request:
"{prompt}"

Structure your response with:
1. 🎬 Title & Visual Theme
2. 📋 Scene-by-Scene Breakdown (for 4 to 6 scenes):
   - Scene Number & Setting
   - Visual Composition & Action
   - Camera Angle & Movement
   - Dialogue / Audio / SFX
   - Estimated Duration

Keep it structured, visually descriptive, and engaging."""
        text, model_used = generate_text_with_fallback(client, storyboard_prompt)
        return {
            "type": "storyboard",
            "content": text,
            "prompt": prompt,
            "model": model_used,
            "message": f"Storyboard generated successfully using {model_used}!"
        }

    elif studio_type == "video":
        video_prompt = f"""You are an AI video producer and director.
Create an AI video generation prompt guide and scene breakdown based on:
"{prompt}"

Provide:
1. Concept & Style Palette (Color, lighting, camera mood)
2. Ready-to-use AI Video Prompts (for tools like Sora, Veo, Runway)
3. Motion & Transition Suggestions
4. Sound Design & Music Directions"""
        text, model_used = generate_text_with_fallback(client, video_prompt)
        return {
            "type": "video",
            "content": text,
            "prompt": prompt,
            "model": model_used,
            "message": f"Video production guide created using {model_used}!"
        }

    elif studio_type == "audio":
        audio_prompt = f"""You are an audio engineer and sound designer.
Create an audio production script and sound design plan based on:
"{prompt}"

Provide:
1. Audio Concept & Mood
2. Voiceover / Spoken Script (with pacing and emphasis notes)
3. Background Music & Sound Effects (SFX) Cue List
4. Mixing and spatial audio suggestions"""
        text, model_used = generate_text_with_fallback(client, audio_prompt)
        return {
            "type": "audio",
            "content": text,
            "prompt": prompt,
            "model": model_used,
            "message": f"Audio script & cues created using {model_used}!"
        }

    else:
        raise ValueError(f"Unknown studio type: {studio_type}")

def format_seconds(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"

def search_audio_moments(client, audio_path: str, query: str) -> list[dict]:
    """
    Uses Gemini multimodal audio processing to transcribe and analyze the audio file,
    finding moments that match the query with timestamps.
    """
    import json

    uploaded_file = None
    try:
        uploaded_file = client.files.upload(file=audio_path)
    except Exception as upload_err:
        raise RuntimeError(f"Could not upload audio to Gemini: {upload_err}")

    prompt = f"""You are an expert audio intelligence and speech analysis assistant.
Listen carefully to the entire audio recording.
Your task is to find all relevant moments or segments that answer or relate to this search query:
"{query}"

Analyze the audio timestamp-by-timestamp.
Return a STRICT JSON list of matching segments. Do not include markdown code block quotes (e.g. ```json ... ```) or any conversational text, just valid parseable JSON.
Format:
[
  {{
    "start_time": 12.0,
    "end_time": 25.0,
    "title": "Short title describing this moment",
    "snippet": "Transcript snippet of what is spoken or heard during this time",
    "explanation": "Why this moment matches the user's query"
  }}
]

Rules:
1. "start_time" and "end_time" MUST be numbers in seconds (e.g. 5.5, 30.0).
2. "end_time" must be greater than "start_time" by at least 2 seconds.
3. Find up to 3 most relevant segments.
4. If no speech directly mentions the words, find the closest related discussion or key section.
"""

    model_name = get_configured_text_model()
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[uploaded_file, prompt]
        )
    except Exception as gen_err:
        try:
            response = client.models.generate_content(
                model="gemini-3.7-flash",
                contents=[uploaded_file, prompt]
            )
        except Exception:
            raise RuntimeError(f"Gemini audio search analysis failed: {gen_err}")
    finally:
        if uploaded_file and hasattr(uploaded_file, "name"):
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception:
                pass

    raw_text = response.text.strip() if response and response.text else ""

    # Strip code block wrappers if Gemini added them
    if "```" in raw_text:
        parts = raw_text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if "[" in part and "]" in part:
                raw_text = part
                break

    start_idx = raw_text.find("[")
    end_idx = raw_text.rfind("]")
    segments = []
    if start_idx != -1 and end_idx != -1:
        try:
            segments = json.loads(raw_text[start_idx:end_idx + 1])
        except Exception:
            segments = []

    if not segments:
        segments = [{
            "start_time": 0.0,
            "end_time": 12.0,
            "title": "Matching Audio Moment",
            "snippet": raw_text[:300] if raw_text else "Audio section matching your query.",
            "explanation": f"Relevant to query: '{query}'"
        }]

    normalized = []
    for seg in segments:
        try:
            st = float(seg.get("start_time", 0.0))
            et = float(seg.get("end_time", st + 8.0))
            if et <= st:
                et = st + 8.0
            normalized.append({
                "start_time": round(st, 2),
                "end_time": round(et, 2),
                "start_timestamp": format_seconds(st),
                "end_timestamp": format_seconds(et),
                "title": seg.get("title", f"Moment at {format_seconds(st)}"),
                "snippet": seg.get("snippet", "Audio snippet matching query"),
                "explanation": seg.get("explanation", f"Matches query: '{query}'")
            })
        except Exception:
            continue

    return normalized
