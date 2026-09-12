"""
Relationship analyst for Object Soulmate.

The joke has to come from the object's REAL behaviour, not from random
one-liners. So every object is described by something actually observable
about it (it clangs, it gets stepped on, it bruises, nobody thanks it),
and that observation is converted into a human personality trait.

    real observation -> human personality -> relationship dynamic -> verdict

Objects we don't know are still handled: their personality scores from
personality.py decide which archetype they fall into, and the observation
is generated from the object's name.
"""

import random

# ═══════════════════════════════════════════════════════════════
# ARCHETYPES
# Each object is sorted into one of these. The pairing of two
# archetypes is what produces the relationship dynamic.
# ═══════════════════════════════════════════════════════════════
#   chaos     - loud, attention-seeking, dramatic
#   anchor    - steady, dependable, holds everyone up
#   worker    - overused, underappreciated, exhausted
#   fragile   - sensitive, easily damaged, moody
#   vain      - decorative, stylish, secretly shallow
#   intellect - quiet, knowledgeable, quietly judging you
#   menace    - sharp, dangerous, causes problems
#   comfort   - soothing, warm, emotionally available

OBJECTS = {
    # ── cutlery & kitchen ────────────────────────────────────────
    "spoon": {
        "obs": "announces its arrival by hitting the floor at maximum volume",
        "traits": "extroverted, dramatic and physically incapable of being subtle",
        "persona": "The extrovert who enters every room making noise",
        "arch": "chaos",
    },
    "fork": {
        "obs": "approaches every meal with four sharp opinions ready",
        "traits": "confrontational, direct and weirdly proud of it",
        "persona": "Comes at every conversation with four sharp points",
        "arch": "menace",
    },
    "knife": {
        "obs": "is trusted with the difficult jobs and handled very carefully",
        "traits": "blunt, intense and slightly threatening at dinner parties",
        "persona": "Emotionally sharp, socially dangerous",
        "arch": "menace",
    },
    "plate": {
        "obs": "holds whatever anyone puts on it and never once complains",
        "traits": "accommodating, patient and a total pushover",
        "persona": "Carries everyone else's mess without asking questions",
        "arch": "anchor",
    },
    "bowl": {
        "obs": "spends its life holding things that other people will eat",
        "traits": "nurturing, giving and quietly running on empty",
        "persona": "Gives everything away and keeps nothing",
        "arch": "comfort",
    },
    "pot": {
        "obs": "sits on open flame for an hour and emerges completely calm",
        "traits": "resilient, thick-skinned and unbothered by pressure",
        "persona": "Has been through worse and did not mention it",
        "arch": "anchor",
    },
    "pan": {
        "obs": "gets extremely hot very quickly and takes ages to cool down",
        "traits": "quick-tempered, intense and emotionally slow to recover",
        "persona": "Heats up in seconds, sulks for an hour",
        "arch": "fragile",
    },
    "cup": {
        "obs": "sits quietly while people tell it about their day",
        "traits": "calm, comforting and an excellent listener",
        "persona": "Emotional support, with a handle",
        "arch": "comfort",
    },
    "mug": {
        "obs": "is the first thing reached for when someone has had a bad morning",
        "traits": "warm, dependable and used entirely for emotional reasons",
        "persona": "Gets people through their worst mornings",
        "arch": "comfort",
    },
    "glass": {
        "obs": "is transparent about everything and shatters under the slightest stress",
        "traits": "honest to a fault and emotionally very breakable",
        "persona": "Completely transparent, completely fragile",
        "arch": "fragile",
    },
    "bottle": {
        "obs": "keeps everything sealed inside until somebody twists hard enough",
        "traits": "bottled up, private and holding a lot in",
        "persona": "Keeps it all in, literally",
        "arch": "intellect",
    },
    "kettle": {
        "obs": "screams the instant it reaches its limit",
        "traits": "expressive, honest and entirely without a filter",
        "persona": "Whistles the moment it has had enough",
        "arch": "chaos",
    },

    # ── furniture ────────────────────────────────────────────────
    "chair": {
        "obs": "has silently supported everyone's weight for years without thanks",
        "traits": "patient, stable and long overdue a holiday",
        "persona": "The quiet one holding everybody up",
        "arch": "anchor",
    },
    "table": {
        "obs": "is where every important conversation happens and never joins in",
        "traits": "steady, present and endlessly discreet",
        "persona": "Present for everything, says nothing",
        "arch": "anchor",
    },
    "sofa": {
        "obs": "absorbs people who claimed they were only sitting down for a minute",
        "traits": "comforting, welcoming and a genuinely bad influence",
        "persona": "Ruins productivity with pure warmth",
        "arch": "comfort",
    },
    "bed": {
        "obs": "is the hardest thing in the house to leave in the morning",
        "traits": "comforting, persuasive and openly enabling",
        "persona": "Makes staying feel like the right decision",
        "arch": "comfort",
    },
    "lamp": {
        "obs": "makes everyone else look good and gets stared past constantly",
        "traits": "generous, illuminating and quietly overlooked",
        "persona": "Lights up the room, nobody looks at it",
        "arch": "worker",
    },
    "fan": {
        "obs": "spins at high speed all day producing nothing but relief",
        "traits": "restless, tireless and going in circles",
        "persona": "Always spinning, never actually going anywhere",
        "arch": "worker",
    },
    "clock": {
        "obs": "reminds everyone how late they are without being asked",
        "traits": "punctual, judgmental and completely relentless",
        "persona": "Keeps score of everybody's time",
        "arch": "intellect",
    },
    "mirror": {
        "obs": "reflects people back at themselves and never offers an opinion",
        "traits": "self-absorbed by design and brutally honest",
        "persona": "Only ever shows you yourself",
        "arch": "vain",
    },
    "pillow": {
        "obs": "has absorbed more crying than any therapist in the building",
        "traits": "soft, absorbent and carrying everybody's secrets",
        "persona": "Knows things it will never repeat",
        "arch": "comfort",
    },
    "blanket": {
        "obs": "solves emotional problems purely by lying on top of them",
        "traits": "warm, clingy and aggressively comforting",
        "persona": "Fixes feelings through sheer weight",
        "arch": "comfort",
    },
    "curtain": {
        "obs": "spends all day hiding what is really going on inside",
        "traits": "private, guarded and extremely good at deflecting",
        "persona": "Nothing to see here, apparently",
        "arch": "intellect",
    },

    # ── tech ─────────────────────────────────────────────────────
    "laptop": {
        "obs": "overheats constantly and has 47 things open that it refuses to close",
        "traits": "overworked, anxious and running on 4% battery",
        "persona": "Burning out with 47 tabs of unfinished business",
        "arch": "worker",
    },
    "keyboard": {
        "obs": "gets pressed thousands of times a day by people who are stressed",
        "traits": "overworked, irritable and one bad email from snapping",
        "persona": "Being hammered on daily and saying nothing",
        "arch": "worker",
    },
    "mouse": {
        "obs": "gets dragged around all day and has no say in the direction",
        "traits": "compliant, directionless and quietly resigned",
        "persona": "Goes wherever it is pushed",
        "arch": "worker",
    },
    "phone": {
        "obs": "demands attention roughly every ninety seconds",
        "traits": "needy, addictive and utterly impossible to ignore",
        "persona": "Cannot go two minutes without being looked at",
        "arch": "chaos",
    },
    "charger": {
        "obs": "is only ever wanted when somebody is desperate",
        "traits": "used, essential and deeply taken for granted",
        "persona": "Only called when someone needs something",
        "arch": "worker",
    },
    "cable": {
        "obs": "becomes hopelessly tangled the moment it is left alone",
        "traits": "complicated, knotted and a lot to unpack",
        "persona": "Emotionally tangled beyond repair",
        "arch": "fragile",
    },
    "headphones": {
        "obs": "exists specifically to help people avoid talking to anyone",
        "traits": "introverted, enabling and anti-social by profession",
        "persona": "Professional social-avoidance equipment",
        "arch": "intellect",
    },
    "remote": {
        "obs": "goes missing constantly and reappears the moment nobody needs it",
        "traits": "unreliable, elusive and incredibly bad at commitment",
        "persona": "Never around when it actually matters",
        "arch": "menace",
    },
    "calculator": {
        "obs": "is only spoken to when somebody has a problem they cannot solve",
        "traits": "logical, unemotional and purely transactional",
        "persona": "Used for answers, never for company",
        "arch": "intellect",
    },
    "speaker": {
        "obs": "is the loudest thing in the room and knows it",
        "traits": "loud, confident and entirely without volume control",
        "persona": "Has never once read the room",
        "arch": "chaos",
    },

    # ── stationery ───────────────────────────────────────────────
    "book": {
        "obs": "sits on a shelf knowing everything and silently judging the room",
        "traits": "intelligent, introverted and mildly condescending",
        "persona": "Knows too much, says nothing",
        "arch": "intellect",
    },
    "pen": {
        "obs": "runs out at the exact moment it matters most",
        "traits": "dramatic, unreliable and a terrible sense of timing",
        "persona": "Abandons you mid-sentence",
        "arch": "menace",
    },
    "pencil": {
        "obs": "gets shorter every time it is asked to do something",
        "traits": "self-sacrificing, diminishing and far too agreeable",
        "persona": "Gives a bit of itself away every time",
        "arch": "worker",
    },
    "eraser": {
        "obs": "spends its whole existence removing other people's mistakes",
        "traits": "forgiving, thankless and wearing down fast",
        "persona": "Cleans up errors nobody admits to",
        "arch": "worker",
    },
    "stapler": {
        "obs": "holds things together permanently and with unnecessary force",
        "traits": "committed, forceful and deeply into permanence",
        "persona": "Commits instantly and irreversibly",
        "arch": "menace",
    },
    "scissors": {
        "obs": "cuts things off cleanly and never looks back",
        "traits": "decisive, ruthless and emotionally efficient",
        "persona": "Ends things without discussion",
        "arch": "menace",
    },
    "notebook": {
        "obs": "is full of plans that were abandoned around page nine",
        "traits": "ambitious, aspirational and chronically unfinished",
        "persona": "Big plans, page nine energy",
        "arch": "fragile",
    },

    # ── worn & carried ───────────────────────────────────────────
    "shoe": {
        "obs": "gets stepped on all day and keeps going anyway",
        "traits": "hardworking, restless and visibly exhausted",
        "persona": "Runs around solving everyone's problems",
        "arch": "worker",
    },
    "sock": {
        "obs": "disappears without explanation and never gives a reason",
        "traits": "flaky, mysterious and terrible at commitment",
        "persona": "Vanishes mid-relationship, every time",
        "arch": "menace",
    },
    "bag": {
        "obs": "carries everything anyone hands it until something tears",
        "traits": "dependable, overloaded and quietly at capacity",
        "persona": "Carrying more than it can handle",
        "arch": "worker",
    },
    "backpack": {
        "obs": "is loaded up with everyone's things and expected to keep up",
        "traits": "loyal, burdened and never once asked how it is doing",
        "persona": "Carries the weight, gets no credit",
        "arch": "worker",
    },
    "wallet": {
        "obs": "is opened only when something is about to be taken from it",
        "traits": "guarded, anxious and permanently bracing for loss",
        "persona": "Only ever opened to be emptied",
        "arch": "fragile",
    },
    "key": {
        "obs": "controls access to everything and hides whenever it is needed",
        "traits": "important, elusive and enjoying the power far too much",
        "persona": "Holds all the access, shares none of it",
        "arch": "menace",
    },
    "watch": {
        "obs": "is worn to look impressive by people who check their phone for the time",
        "traits": "decorative, status-driven and functionally unnecessary",
        "persona": "Purely for show and knows it",
        "arch": "vain",
    },
    "glasses": {
        "obs": "helps everyone see clearly and gets lost on top of someone's head",
        "traits": "helpful, overlooked and hiding in plain sight",
        "persona": "Clarifies everything, appreciated by nobody",
        "arch": "intellect",
    },
    "sunglasses": {
        "obs": "exists to look cool while literally hiding someone's eyes",
        "traits": "stylish, mysterious and mildly narcissistic",
        "persona": "Refuses to reveal any actual feelings",
        "arch": "vain",
    },
    "umbrella": {
        "obs": "is forgotten on every sunny day and desperately wanted in a storm",
        "traits": "dependable, seasonal and used purely for emergencies",
        "persona": "Remembered only during a crisis",
        "arch": "worker",
    },
    "hat": {
        "obs": "is worn mainly to cover up something nobody wants discussed",
        "traits": "image-conscious, secretive and strategically placed",
        "persona": "Covering something and staying quiet about it",
        "arch": "vain",
    },

    # ── food ─────────────────────────────────────────────────────
    "banana": {
        "obs": "changes colour three times in a week and bruises if you look at it",
        "traits": "emotionally unstable, sensitive and moody on a schedule",
        "persona": "A new personality every three days",
        "arch": "fragile",
    },
    "apple": {
        "obs": "looks flawless on the outside and goes brown within minutes of opening up",
        "traits": "presentable, guarded and deteriorating once vulnerable",
        "persona": "Perfect until it lets anyone in",
        "arch": "vain",
    },
    "egg": {
        "obs": "is handled with extreme care by everyone who has ever met it",
        "traits": "delicate, high-maintenance and one knock from disaster",
        "persona": "Requires careful handling at all times",
        "arch": "fragile",
    },
    "pizza": {
        "obs": "makes everybody happy immediately and disappears just as fast",
        "traits": "charming, generous and gone far too soon",
        "persona": "Universally loved, never sticks around",
        "arch": "chaos",
    },
    "onion": {
        "obs": "has many layers and makes people cry when you get into them",
        "traits": "complex, emotionally overwhelming and a lot to process",
        "persona": "Layers upon layers, all of them upsetting",
        "arch": "fragile",
    },

    # ── household ────────────────────────────────────────────────
    "brick": {
        "obs": "refuses to move, bend, or acknowledge anybody's feelings",
        "traits": "stubborn, immovable and emotionally unavailable by construction",
        "persona": "The emotional availability of a wall",
        "arch": "anchor",
    },
    "broom": {
        "obs": "cleans up everyone else's mess and gets blamed when the room is dirty",
        "traits": "responsible, hardworking and thoroughly unappreciated",
        "persona": "Fixes everything, thanked for nothing",
        "arch": "worker",
    },
    "bucket": {
        "obs": "is only brought out when something has already gone badly wrong",
        "traits": "practical, reliable and associated exclusively with disaster",
        "persona": "Shows up after the damage is done",
        "arch": "anchor",
    },
    "towel": {
        "obs": "absorbs everybody's problems and gets hung up to deal with it alone",
        "traits": "absorbent, giving and left to dry out by itself",
        "persona": "Takes it all on, processes it alone",
        "arch": "comfort",
    },
    "soap": {
        "obs": "gets smaller every single time it helps somebody",
        "traits": "selfless, slippery and actively disappearing",
        "persona": "Gives itself away until there is nothing left",
        "arch": "worker",
    },
    "toothbrush": {
        "obs": "sees everyone at their absolute worst, twice a day, without comment",
        "traits": "loyal, discreet and deeply unbothered by ugliness",
        "persona": "Has seen everything and judges nothing",
        "arch": "comfort",
    },
    "candle": {
        "obs": "burns itself down completely to make the room feel nicer",
        "traits": "romantic, self-destructive and dramatic about it",
        "persona": "Destroys itself for the atmosphere",
        "arch": "fragile",
    },
    "plant": {
        "obs": "sits quietly growing and dies the moment it is ignored for a week",
        "traits": "gentle, patient and secretly needing constant attention",
        "persona": "Low drama, extremely high needs",
        "arch": "fragile",
    },
    "bin": {
        "obs": "is handed everything nobody wants and never gets asked how it feels",
        "traits": "tolerant, overloaded and full of other people's issues",
        "persona": "Receives everybody's worst and holds it",
        "arch": "worker",
    },
    "teddy": {
        "obs": "has been cried on for years and never brought it up once",
        "traits": "loving, patient and carrying a great deal quietly",
        "persona": "Absorbs feelings, requests nothing",
        "arch": "comfort",
    },
    "ball": {
        "obs": "gets thrown, kicked and bounced and comes back every time",
        "traits": "energetic, forgiving and impossible to keep down",
        "persona": "Takes the hits and bounces back",
        "arch": "chaos",
    },
}

# a few names that mean the same thing
ALIASES = {
    "mobile": "phone", "smartphone": "phone", "cellphone": "phone", "iphone": "phone",
    "computer": "laptop", "pc": "laptop", "macbook": "laptop", "notebook computer": "laptop",
    "specs": "glasses", "spectacles": "glasses", "eyeglasses": "glasses",
    "cushion": "pillow", "duvet": "blanket", "quilt": "blanket",
    "trash": "bin", "dustbin": "bin", "garbage": "bin", "trashcan": "bin", "waste bin": "bin",
    "teddy bear": "teddy", "soft toy": "teddy", "stuffed animal": "teddy", "plush": "teddy",
    "couch": "sofa", "settee": "sofa",
    "earphones": "headphones", "earbuds": "headphones", "airpods": "headphones",
    "water bottle": "bottle", "flask": "bottle",
    "coffee cup": "cup", "tea cup": "cup", "teacup": "cup",
    "sneaker": "shoe", "shoes": "shoe", "boot": "shoe", "trainer": "shoe", "sandal": "shoe",
    "socks": "sock", "purse": "wallet", "handbag": "bag", "rucksack": "backpack",
    "keys": "key", "pens": "pen", "spoons": "spoon", "books": "book",
    "timepiece": "watch", "wristwatch": "watch", "shades": "sunglasses",
    "monitor": "mirror", "screen": "laptop", "tv remote": "remote", "controller": "remote",
    "chairs": "chair", "stool": "chair", "bench": "chair",
    "pot plant": "plant", "houseplant": "plant", "flower": "plant",
    "mop": "broom", "brush": "broom", "duster": "broom",
}

# ═══════════════════════════════════════════════════════════════
# FALLBACK — objects that are not in the table above.
# Their personality scores decide the archetype, and the
# observation is written around the object's own name.
# ═══════════════════════════════════════════════════════════════

TRAIT_TO_ARCH = {
    "Dramatic": "chaos",
    "Social": "chaos",
    "Chaotic": "menace",
    "Reliable": "anchor",
    "Serious": "intellect",
    "Calm": "comfort",
    "Friendly": "comfort",
}

GENERIC = {
    "chaos": {
        "arch": "chaos",
        "obs": "cannot be in a room for ten seconds without everybody noticing",
        "traits": "loud, theatrical and allergic to being ignored",
        "persona": "Demands the spotlight in every room",
    },
    "anchor": {
        "arch": "anchor",
        "obs": "has been exactly where you left it, every single time, for years",
        "traits": "steady, dependable and completely taken for granted",
        "persona": "Always there, never thanked",
    },
    "worker": {
        "arch": "worker",
        "obs": "gets picked up, used, and put back down again without a word of thanks",
        "traits": "overworked, useful and running on empty",
        "persona": "Constantly used, never appreciated",
    },
    "fragile": {
        "arch": "fragile",
        "obs": "shows visible damage from things that happened a very long time ago",
        "traits": "sensitive, marked-up and still processing it",
        "persona": "Carries every scratch it ever got",
    },
    "vain": {
        "arch": "vain",
        "obs": "is kept around mostly because of how it looks",
        "traits": "decorative, confident and functionally optional",
        "persona": "Chosen for looks, not for use",
    },
    "intellect": {
        "arch": "intellect",
        "obs": "sits quietly in the corner having opinions about everyone",
        "traits": "observant, reserved and quietly judgmental",
        "persona": "Says little, notices everything",
    },
    "menace": {
        "arch": "menace",
        "obs": "has caused at least one problem that was never properly resolved",
        "traits": "unpredictable, difficult and suspiciously proud of it",
        "persona": "A known source of problems",
    },
    "comfort": {
        "arch": "comfort",
        "obs": "is what people reach for when the day has gone badly",
        "traits": "warm, patient and emotionally available",
        "persona": "The one people turn to",
    },
}

# ═══════════════════════════════════════════════════════════════
# DYNAMICS — what happens when two archetypes meet.
# Keyed by an unordered pair, so (chaos, anchor) == (anchor, chaos).
# ═══════════════════════════════════════════════════════════════

DYNAMICS = {
    # same archetype
    ("chaos", "chaos"):         "Two extroverts competing for the same spotlight. Nobody is listening to anybody.",
    ("anchor", "anchor"):       "Both are immovable. This relationship has not progressed in four years and both are fine with it.",
    ("worker", "worker"):       "Both are exhausted, both are unpaid, and neither has taken a day off. This is a union, not a romance.",
    ("fragile", "fragile"):     "Two sensitive souls handling each other with extreme care. One wrong word and they both shatter.",
    ("vain", "vain"):           "Both are stunning, both are shallow, and neither has asked the other a single question.",
    ("intellect", "intellect"): "Two quiet observers judging the entire room in perfect, silent agreement.",
    ("menace", "menace"):       "Partners in crime. Whatever happens next is going to be somebody else's problem.",
    ("comfort", "comfort"):     "Endlessly supportive of each other and completely incapable of leaving the house.",

    # chaos pairs
    ("anchor", "chaos"):    "One brings the chaos, the other absorbs it without flinching. Classic. Exhausting. Works perfectly.",
    ("chaos", "worker"):    "One demands constant attention, the other is far too tired to provide it, and somehow it holds together.",
    ("chaos", "fragile"):   "One is loud and relentless, the other bruises easily. This will end in tears, probably today.",
    ("chaos", "vain"):      "Both need to be looked at. Neither has ever looked at the other.",
    ("chaos", "intellect"): "One will not stop talking. The other stopped listening three weeks ago and never mentioned it.",
    ("chaos", "menace"):    "One causes a scene, the other causes damage. Together they are a formal safety hazard.",
    ("chaos", "comfort"):   "One arrives mid-crisis at full volume, the other makes tea and lets it happen.",

    # anchor pairs
    ("anchor", "worker"):    "One holds everything up, the other does all the running. Between them they are carrying the entire household.",
    ("anchor", "fragile"):   "One is completely unshakeable, the other falls apart weekly. Somehow this is the healthiest thing here.",
    ("anchor", "vain"):      "One has substance, the other has style, and they have agreed never to discuss it.",
    ("anchor", "intellect"): "One is silent because it is steady, the other is silent because it is judging. Very peaceful evenings.",
    ("anchor", "menace"):    "One causes problems, the other refuses to be moved by them. An unstoppable force met a deeply unbothered object.",
    ("anchor", "comfort"):   "One provides the structure, the other provides the feelings. Genuinely functional, which is disappointing.",

    # worker pairs
    ("fragile", "worker"):   "One is exhausted, the other is emotionally delicate, and neither has the energy for this.",
    ("vain", "worker"):      "One does all the work, the other takes all the photos. Somehow the second one is happier.",
    ("intellect", "worker"): "One works non-stop, the other explains why the work was inefficient. Deeply irritating for everyone.",
    ("menace", "worker"):    "One makes the mess, the other cleans it up. This is not a relationship, it is an unpaid internship.",
    ("comfort", "worker"):   "One is burnt out, the other specialises in burnt-out people. This is therapy, and it is working.",

    # fragile pairs
    ("fragile", "vain"):      "One is falling apart, the other is worried about how that looks.",
    ("fragile", "intellect"): "One needs emotional reassurance, the other offers a well-reasoned analysis instead. It is not landing.",
    ("fragile", "menace"):    "One breaks easily, the other breaks things. The algorithm advises against this and did it anyway.",
    ("comfort", "fragile"):   "One is sensitive, the other is endlessly patient. This is the closest thing to a healthy match we have.",

    # vain pairs
    ("intellect", "vain"): "One is all substance, the other is all surface, and both are convinced they are winning.",
    ("menace", "vain"):    "One looks incredible, the other is a liability. Together they are a very stylish disaster.",
    ("comfort", "vain"):   "One wants to be admired, the other just wants everyone to be okay. Only one of them is trying.",

    # remaining
    ("intellect", "menace"): "One plans quietly, the other acts recklessly. Whatever they are building, it is not safe.",
    ("comfort", "intellect"): "One offers warmth, the other offers facts. Every conversation ends in a stalemate and a hug.",
    ("comfort", "menace"):   "One causes chaos, the other forgives it immediately. Concerning, but sweet.",
}

BRIDGES = {
    "high": [
        "They understand each other completely, which is honestly the worrying part.",
        "Somehow, this works. Nobody involved can explain it.",
        "Against all reasonable judgement, they fit.",
    ],
    "mid": [
        "They are still figuring each other out, loudly.",
        "It is not perfect, but neither of them is leaving.",
        "There is potential here, buried under several issues.",
    ],
    "low": [
        "This was never going to work, and both of them know it.",
        "The algorithm has seen this before and it did not end well.",
        "There is chemistry. There is also a great deal of damage.",
    ],
}

VERDICTS = {
    "high": [
        "Scientifically questionable. Emotionally undeniable.",
        "The algorithm regrets nothing.",
        "We did not expect this to work either.",
        "Statistically absurd. Romantically airtight.",
    ],
    "mid": [
        "One needs therapy. The other needs patience.",
        "Honestly, we're surprised too.",
        "Promising, in a concerning sort of way.",
        "Proceed, but keep expectations low.",
    ],
    "low": [
        "The algorithm strongly recommends staying friends.",
        "Compatible on paper. Catastrophic in practice.",
        "We ran this twice. It got worse.",
        "Absolutely not. And yet, here we are.",
    ],
}


def _normalise(name):
    n = " ".join(str(name).lower().strip().split())
    n = ALIASES.get(n, n)
    if n in OBJECTS:
        return n
    # "sneakers" -> "sneaker" -> alias -> "shoe"; "glasses" stays as it is
    for singular in (n[:-1] if n.endswith("s") else None,
                     n[:-2] if n.endswith("es") else None):
        if singular:
            cand = ALIASES.get(singular, singular)
            if cand in OBJECTS:
                return cand
    return n


def _lookup(name, personality):
    """Find the object's profile, or build one from its personality scores."""
    key = _normalise(name)
    if key in OBJECTS:
        return OBJECTS[key]

    # a loose match helps with things like "wooden chair" or "coffee mug"
    for known in OBJECTS:
        if known in key.split() or key.endswith(known):
            return OBJECTS[known]

    dominant = max(personality, key=personality.get) if personality else "Reliable"
    return GENERIC[TRAIT_TO_ARCH.get(dominant, "anchor")]


def _band(compatibility):
    if compatibility >= 85:
        return "high"
    if compatibility >= 70:
        return "mid"
    return "low"


def build_explanation(name_a, personality_a, name_b, personality_b, compatibility):
    """Return the structured relationship analysis for a pair of objects."""
    a = _lookup(name_a, personality_a)
    b = _lookup(name_b, personality_b)
    band = _band(compatibility)

    dynamic = DYNAMICS.get(
        tuple(sorted((a["arch"], b["arch"]))),
        "Two very different problems that happen to enjoy each other's company.",
    )

    why = (
        f"The {name_a} {a['obs']} — {a['traits']}. "
        f"The {name_b} {b['obs']} — {b['traits']}. "
        f"{random.choice(BRIDGES[band])}"
    )

    return {
        "why": why,
        "persona_a": a["persona"],
        "persona_b": b["persona"],
        "dynamic": dynamic,
        "verdict": random.choice(VERDICTS[band]),
        # plain-text version, kept so anything reading `explanation` still works
        "text": f"{why} {dynamic}",
    }
