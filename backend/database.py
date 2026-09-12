import sqlite3
import json
import os
import shutil
import uuid

def init_db():
    conn = sqlite3.connect("objects.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS objects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            object_name TEXT NOT NULL,
            image_path TEXT NOT NULL,
            personality TEXT NOT NULL
        )
    """)
    # One dating profile per object name. The database is the thing that
    # enforces it, so a duplicate cannot slip in past the API check.
    # (An existing database with duplicates needs migrate_unique_names.py
    #  run once first, or this raises IntegrityError.)
    try:
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_objects_name_key
            ON objects (LOWER(TRIM(object_name)))
        """)
    except sqlite3.IntegrityError:
        print("[objects.db] duplicate names present - run migrate_unique_names.py "
              "to enforce one profile per object")
    conn.commit()
    conn.close()

    seed_if_empty()

def save_object(object_name, image_path, personality):
    conn = sqlite3.connect("objects.db")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO objects (object_name, image_path, personality) VALUES (?, ?, ?)",
        (object_name, image_path, json.dumps(personality))
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id

def get_all_objects():
    """Return every stored object as a list of dicts, newest first.
    Used by the GET /objects endpoint to populate the gallery."""
    conn = sqlite3.connect("objects.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, object_name, image_path, personality FROM objects ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": row[0],
            "object_name": row[1],
            "image_path": row[2],
            "personality": json.loads(row[3]),
        }
        for row in rows
    ]


def normalise_name(name):
    """The canonical form used for duplicate checks: lowercase, trimmed,
    inner whitespace collapsed. 'Spoon', ' SPOON ' and 'spoon' all match."""
    return " ".join(str(name or "").lower().split())


def find_by_name(name):
    """Return the existing object with this normalized name, or None."""
    conn = sqlite3.connect("objects.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, object_name, image_path, personality FROM objects "
        "WHERE LOWER(TRIM(object_name)) = ?",
        (normalise_name(name),),
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "object_name": row[1],
        "image_path": row[2],
        "personality": json.loads(row[3]),
    }


def delete_object(object_id):
    """Delete one object by id. Returns the deleted row, or None if the id
    did not exist. The image file is intentionally left on disk."""
    conn = sqlite3.connect("objects.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, object_name, image_path FROM objects WHERE id = ?", (object_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    cursor.execute("DELETE FROM objects WHERE id = ?", (object_id,))
    conn.commit()
    conn.close()
    return {"id": row[0], "object_name": row[1], "image_path": row[2]}


# Paths are resolved from this file, not the working directory, so the
# backend behaves the same however it is started (locally or on a host).
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SEED_DIR = os.path.join(BASE_DIR, "seed")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")


def seed_if_empty():
    """Populate the dating pool from backend/seed/ when it is empty.

    Free hosting (Render's free tier, for one) gives you an ephemeral
    filesystem: uploads/ and objects.db are wiped every time the service
    restarts, redeploys or wakes from sleep. Without this, a judge who
    opens the site after it has been idle finds an empty dating pool.
    Seeding on an empty table means the pool refills itself instead.

    Does nothing if the pool already has objects, so real uploads are
    never touched and this is safe to run on every startup.
    """
    from personality import generate_personality   # local import: avoids a cycle

    conn = sqlite3.connect("objects.db")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM objects")
    if cursor.fetchone()[0] > 0:
        conn.close()
        return

    if not os.path.isdir(SEED_DIR):
        conn.close()
        print("[seed] no seed/ folder - starting with an empty dating pool")
        return

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    added = 0

    for filename in sorted(os.listdir(SEED_DIR)):
        name, ext = os.path.splitext(filename)
        if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            continue

        # Copy into uploads/ under a fresh name, exactly like a real upload,
        # so /uploads serves it and nothing special-cases seeded rows.
        dest_name = f"{uuid.uuid4().hex}{ext.lower()}"
        dest_path = os.path.join(UPLOAD_DIR, dest_name)
        try:
            shutil.copy2(os.path.join(SEED_DIR, filename), dest_path)
        except OSError as err:
            print(f"[seed] could not copy {filename}: {err}")
            continue

        # store the same relative path shape the upload endpoint uses
        stored_path = os.path.join("uploads", dest_name)
        personality = generate_personality(name)
        try:
            cursor.execute(
                "INSERT INTO objects (object_name, image_path, personality) VALUES (?,?,?)",
                (name.lower(), stored_path, json.dumps(personality)),
            )
            added += 1
        except sqlite3.IntegrityError:
            # a name that somehow already exists - skip it, never crash startup
            pass

    conn.commit()
    conn.close()
    if added:
        print(f"[seed] dating pool was empty - added {added} starter object(s)")
