# Object Soulmate 💘

## Basic Details

### Team Name: Elyra

### Team Members
- Team Lead: Rahamath Sahala K P - Calicut University Institute of Engineering and Technology
- Member 2: Sreeminnika K N - Calicut University Institute of Engineering and Technology

### Project Description

Object Soulmate is an AI-style dating application for physical objects. You photograph a spoon, type its name, and the system gives it a personality, drops it into a dating pool, rejects several unsuitable candidates on its behalf, and matches it with a completely unrelated object. It then explains the relationship in far more detail than anyone requested, and predicts how it ends.

### The Problem (that doesn't exist)

Billions of household objects sit in drawers, on desks and under sofas, living quietly parallel lives, completely unaware of one another. Your spoon has never met your chair. Your keyboard has no idea your broom exists. They share a home, they share a life, and they have never been formally introduced.

Nobody has ever asked the truly important question: who would your stapler date?

Worse still, objects have no way of expressing their emotional needs. A banana changes personality three times a week and not one person checks in on it. A chair has silently supported everyone in the house for eleven years and has never once been thanked.

### The Solution (that nobody asked for)

We built a fully functional dating platform for inanimate objects.

Upload a photo, type what it is, and the backend generates a personality across seven traits. The object gets a dating profile — occupation, love language, biggest fear, green flags, red flags, and a secret it has never told anyone. It then enters the dating pool and is matched against every other object ever uploaded.

The matching is not random. Every object maps to one of eight personality archetypes derived from how humans actually interact with it: a spoon makes noise in every room it enters, so it is a loud extrovert; a chair has held everyone up for years, so it is reliable and emotionally exhausted. Compatibility comes from how those archetypes collide, which is why Spoon ❤️ Chair scores well and the explanation writes itself:

> *"One talks. One listens. Neither has considered swapping."*

Then, because an instant result would be undignified, we reject four other candidates with reasons, stall dramatically, announce that **SOMETHING HAS GONE TERRIBLY RIGHT**, reveal the soulmate with confetti and a synthesized chime, and finish with a ten-year relationship forecast and a survival percentage that is almost always in single digits.

It solves absolutely nothing. That is the entire point.

## Technical Details

### Technologies/Components Used

For Software:

- **Languages used:** Python, JavaScript, HTML, CSS
- **Frameworks used:** FastAPI, Uvicorn
- **Libraries used:** python-multipart, sqlite3, json, uuid, random, shutil (Python standard library). No JavaScript libraries at all — every animation is hand-written CSS, every sound is generated live with the Web Audio API.
- **Tools used:** Git, GitHub, VS Code, Live Server, SQLite, Render, Netlify

### Implementation

For Software:

# Installation

```bash
git clone https://github.com/sahala0408/useless.git
cd useless/backend

python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt
```

On macOS/Linux, activate with `source venv/bin/activate` instead.

# Run

```bash
uvicorn main:app --reload
```

The API starts on `http://127.0.0.1:8000` and seeds the dating pool with seven starter objects on first run.

Then open the frontend: in VS Code, right-click `frontend/index.html` → **Open with Live Server**.

### Project Documentation

For Software:

# Screenshots (Add at least 3)

![Screenshot1](assets/screenshot-1-home.png)
*The home screen. Floating objects drift around the title, each labelled with the emotional baggage it brings to the dating pool — "emotionally unavailable", "probably toxic", "looking for stability".*

![Screenshot2](assets/screenshot-2-profile.png)
*An object's dating profile after analysis. Seven personality traits with animated bars, an occupation, a love language, a biggest fear, and colour-coded green and red flags — presented with total sincerity.*

![Screenshot3](assets/screenshot-3-reveal.png)
*The soulmate reveal. Compatibility counts up to its final score, the two objects slide toward each other, and the relationship analyst explains exactly why these two unrelated things belong together.*

# Diagrams

```mermaid
flowchart TD
    A["📷 User uploads a photo<br/>and types the object name"] --> B{"Name already<br/>in the pool?"}
    B -->|Yes| B1["409 — one profile per object<br/>'One spoon is enough drama.'"]
    B -->|No| C["POST /upload<br/>FastAPI receives image + name"]

    C --> D["personality.py<br/>generates 7 traits,<br/>biased by object hints"]
    D --> E["database.py<br/>saves to SQLite,<br/>image stored under a UUID"]
    E --> F["matching.py<br/>picks a candidate with a<br/>DIFFERENT name, scores it"]
    F --> G["explanations.py<br/>maps both objects to archetypes<br/>and writes the analysis"]
    G --> H["JSON response:<br/>personality + soulmate<br/>+ compatibility + analysis"]

    H --> I["🎭 Frontend theatre<br/>(all data already in hand)"]
    I --> J["💔 Four candidates rejected,<br/>with reasons"]
    J --> K["⚠️ WAIT…<br/>SOMETHING HAS GONE TERRIBLY RIGHT"]
    K --> L["❤️ DESTINY DETECTED<br/>score counts up, confetti, chime"]
    L --> M["🔮 Ten-year forecast<br/>+ survival chance"]

    style A fill:#FF2E93,stroke:#fff,color:#fff
    style H fill:#21E6FF,stroke:#fff,color:#000
    style L fill:#FFD23F,stroke:#fff,color:#000
```

*The backend does all the real work — personality, matching, compatibility and the written explanation — and returns everything in a single response. The frontend never invents a match; the entire dramatic sequence is theatre performed over data it is already holding, which is why the reveal never stalls waiting on the network.*

### Project Demo

# Video

[Add your demo video link here]

*The video shows the full journey: uploading an object, watching the personality generate, browsing the dating pool and opening a profile, then running a match — the rejected candidates, the destiny reveal, the compatibility count-up, and the ridiculous future prediction.*

# Additional Demos

- **Live site:** https://object-soulmate-elyra.netlify.app
- **API:** https://object-soulmate-api.onrender.com

*The backend runs on a free tier and sleeps after 15 minutes of inactivity, so the first request may take up to a minute to wake it. The dating pool seeds itself, so it is never empty.*

## Team Contributions

- Rahamath Sahala K P & Sreeminnika K N: Built the whole thing together — backend, frontend, and every bad decision in between.

---
Made with ❤️ at TinkerHub Useless Projects

![Static Badge](https://img.shields.io/badge/TinkerHub-24?color=%23000000&link=https%3A%2F%2Fwww.tinkerhub.org%2F)
![Static Badge](https://img.shields.io/badge/UselessProjects--26-26?link=https%3A%2F%2Ftinkerhub.org%2Fevents%2F1M8ORET9A1%2Fuseless-projects-3.0)
