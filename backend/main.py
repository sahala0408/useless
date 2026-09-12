import os
import uuid
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import (init_db, save_object, get_all_objects,
                      find_by_name, delete_object, normalise_name)
from personality import generate_personality
from matching import find_soulmate
init_db()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
def home():
    return {"message": "Object Soulmate backend is running!"}

@app.post("/upload")
async def upload_object(file: UploadFile = File(...), object_name: str = Form(...)):
    clean_name = normalise_name(object_name)
    if not clean_name:
        raise HTTPException(status_code=400, detail={
            "error": "empty_name",
            "message": "Your object cannot date if you don't introduce it.",
        })

    # One profile per object name. Checked here so the response is friendly,
    # and enforced by a UNIQUE index in the database so it cannot be bypassed.
    existing = find_by_name(clean_name)
    if existing:
        raise HTTPException(status_code=409, detail={
            "error": "duplicate",
            "object_name": existing["object_name"],
            "existing_id": existing["id"],
            "message": f"{existing['object_name'].capitalize()} already has a dating "
                       f"profile. One {existing['object_name']} is enough drama.",
        })

    contents = await file.read()

    # Store under a random name so two phones uploading "IMG_1234.jpg"
    # cannot overwrite each other.
    ext = os.path.splitext(file.filename)[1]
    image_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    with open(image_path, "wb") as f:
        f.write(contents)

    personality = generate_personality(object_name)
    new_id = save_object(object_name, image_path, personality)
    soulmate = find_soulmate(new_id, object_name, personality)
    return {
        "object_name": object_name,
        "filename": file.filename,
        "image_path": image_path,
        "personality": personality,
        "soulmate": soulmate
    }


@app.get("/objects")
def list_objects():
    """All uploaded objects, for the gallery."""
    return {"objects": get_all_objects()}


@app.delete("/objects/{object_id}")
def remove_object(object_id: int):
    """Remove one object from the dating pool.
    FastAPI rejects a non-integer id with 422 before this runs."""
    removed = delete_object(object_id)
    if removed is None:
        raise HTTPException(status_code=404, detail={
            "error": "not_found",
            "message": "That object is not in the dating pool. It may have already left.",
        })
    return {
        "success": True,
        "message": f"{removed['object_name'].capitalize()} has left the dating pool.",
        "deleted": removed,
    }
