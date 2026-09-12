import sqlite3
import json
import random
from explanations import build_explanation

def get_all_objects(exclude_id=None):
    conn = sqlite3.connect("objects.db")
    cursor = conn.cursor()
    if exclude_id:
        cursor.execute("SELECT * FROM objects WHERE id != ?", (exclude_id,))
    else:
        cursor.execute("SELECT * FROM objects")
    rows = cursor.fetchall()
    conn.close()
    return rows

def calculate_compatibility(personality1, personality2):
    # Lower difference in traits = higher compatibility
    total_diff = 0
    for trait in personality1:
        total_diff += abs(personality1[trait] - personality2[trait])

    max_possible_diff = 100 * len(personality1)
    similarity = 100 - (total_diff / max_possible_diff * 100)
    return round(similarity)

def find_soulmate(new_object_id, new_object_name, new_personality):
    candidates = get_all_objects(exclude_id=new_object_id)

    if not candidates:
        return None  # no other objects to match with yet

    # The whole point is matching UNRELATED objects, so prefer candidates
    # with a different name. If a spoon is the only thing ever uploaded,
    # fall back to the full pool rather than returning nothing.
    unrelated = [c for c in candidates if c[1].lower().strip() != new_object_name.lower().strip()]
    soulmate = random.choice(unrelated or candidates)
    soulmate_id, soulmate_name, soulmate_image, soulmate_personality_json = soulmate
    soulmate_personality = json.loads(soulmate_personality_json)

    compatibility = calculate_compatibility(new_personality, soulmate_personality)
    analysis = build_explanation(
        new_object_name, new_personality,
        soulmate_name, soulmate_personality,
        compatibility,
    )

    return {
        "soulmate_id": soulmate_id,
        "soulmate_name": soulmate_name,
        "soulmate_image": soulmate_image,
        "soulmate_personality": soulmate_personality,
        "compatibility": compatibility,
        "explanation": analysis["text"],   # plain text, kept for compatibility
        "analysis": analysis               # structured version for the reveal screen
    }