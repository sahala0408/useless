import random

# These are the possible personality traits every object can have
TRAITS = ["Dramatic", "Calm", "Chaotic", "Reliable", "Social", "Serious", "Friendly"]

# Some objects get a "starting nudge" toward certain traits, to make results feel intentional.
# If the object name isn't in this list, it just gets fully random traits.
TRAIT_HINTS = {
    "spoon": {"Dramatic": 20, "Social": 15},
    "chair": {"Calm": 20, "Reliable": 20},
    "shoe": {"Chaotic": 15, "Social": 10},
    "banana": {"Chaotic": 25, "Friendly": 15},
    "keyboard": {"Serious": 15, "Reliable": 10},
    "book": {"Serious": 20, "Calm": 10},
    "bottle": {"Reliable": 15, "Calm": 10},
    "brick": {"Reliable": 25, "Serious": 15},
}

def generate_personality(object_name: str) -> dict:
    object_name = object_name.lower().strip()
    hints = TRAIT_HINTS.get(object_name, {})

    personality = {}
    for trait in TRAITS:
        base_value = random.randint(10, 60)       # random base score
        bonus = hints.get(trait, 0)                # extra nudge if this object has a hint for this trait
        score = base_value + bonus
        score = min(score, 99)                     # cap at 99 so nothing hits a boring 100%
        personality[trait] = score

    return personality