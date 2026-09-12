/* ═══════════════════════════════════════════════════════════
   OBJECT SOULMATE — frontend logic
   Talks to the existing FastAPI backend. No frameworks.

   Backend contract (unchanged):
     POST /upload   { file, object_name }
        -> { object_name, filename, image_path, personality, soulmate|null }
     GET  /objects  -> { objects: [ {id, object_name, image_path, personality} ] }
     GET  /uploads/<file>  -> the image
   ═══════════════════════════════════════════════════════════ */

const API_URL = "http://127.0.0.1:8000";   // ← change to your Render URL when you deploy

/* Raw compatibility from the backend only ever lands between ~57 and ~96,
   because it is "100 - average trait difference" over random traits.
   Left alone, every match would read 70-96% and the low-score reactions
   would never appear. We stretch that real range across 0-100 for DISPLAY
   only — the true score stays untouched in the database. */
const RAW_MIN = 55;
const RAW_MAX = 97;

function displayScore(raw) {
  const pct = ((raw - RAW_MIN) / (RAW_MAX - RAW_MIN)) * 100;
  return Math.max(1, Math.min(100, Math.round(pct)));
}

/* ───────── element lookup ───────── */
const $ = (id) => document.getElementById(id);

const screens = document.querySelectorAll(".screen");
const navLinks = document.querySelectorAll(".nav-link");

const nameInput   = $("object-name");
const dropzone    = $("dropzone");
const dzEmpty     = $("dz-empty");
const objectCard  = $("object-card");
const previewImg  = $("preview-img");
const clearPhoto  = $("clear-photo");
const cameraInput = $("camera-input");
const galleryInput= $("gallery-input");
const analyzeBtn  = $("analyze-btn");
const errorMsg    = $("error-msg");

/* ───────── app state ───────── */
let selectedFile = null;   // the File the user picked
let localPreview = null;   // object URL for that file
let result       = null;   // the whole /upload response
let soundOn      = true;

/* ═══════════════════════════════════════════
   SCREEN ROUTER
   ═══════════════════════════════════════════ */

function showScreen(name) {
  screens.forEach((s) => s.classList.toggle("is-active", s.id === `screen-${name}`));
  navLinks.forEach((l) => l.classList.toggle("is-active", l.dataset.go === name));
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name === "gallery") loadGallery();
  if (name === "about")   animateUsefulness();
}

document.querySelectorAll("[data-go]").forEach((el) => {
  el.addEventListener("click", () => {
    initAudio();                 // any click is a valid gesture to unlock audio
    showScreen(el.dataset.go);
  });
});

/* ═══════════════════════════════════════════
   BACKGROUND SYMBOLS  ❤ ✨ ⭐ 💫
   ═══════════════════════════════════════════ */

(function seedSymbols() {
  const field = $("symbol-field");
  const glyphs = ["❤️", "✨", "⭐", "💫", "💕"];
  for (let i = 0; i < 18; i++) {
    const s = document.createElement("span");
    s.className = "symbol";
    s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    s.style.left = Math.random() * 100 + "%";
    s.style.bottom = "-40px";
    s.style.fontSize = 11 + Math.random() * 14 + "px";
    s.style.animationDuration = 14 + Math.random() * 16 + "s";
    s.style.animationDelay = -Math.random() * 25 + "s";
    field.appendChild(s);
  }
})();

/* ═══════════════════════════════════════════
   SOUND — synthesized with the Web Audio API.
   No audio files, so nothing to download or lose.
   The context can only start after a user gesture,
   so initAudio() is called from click handlers.
   ═══════════════════════════════════════════ */

let audioCtx = null;

function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (err) {
    console.warn("Web Audio unavailable, continuing silently:", err);
  }
}

/** One note. type = waveform, t = start offset in seconds. */
function note(freq, startAt, duration, type = "sine", peak = 0.16) {
  if (!audioCtx || !soundOn) return;
  const t = audioCtx.currentTime + startAt;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  // quick attack, smooth decay — keeps it pleasant, never harsh
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** Happy magical chime: a major arpeggio plus sparkle on top. */
function playMatchSound() {
  if (!audioCtx || !soundOn) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    note(f, i * 0.09, 0.55, "triangle", 0.15);
  });
  [1568, 2093, 2637].forEach((f, i) => {
    note(f, 0.42 + i * 0.07, 0.3, "sine", 0.06);   // sparkle
  });
}

/** Comedic failure: descending wobble, sad-trombone flavoured. */
function playFailSound() {
  if (!audioCtx || !soundOn) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(392, t);
  osc.frequency.linearRampToValueAtTime(349.23, t + 0.22);
  osc.frequency.linearRampToValueAtTime(293.66, t + 0.45);
  osc.frequency.linearRampToValueAtTime(196, t + 0.9);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.13, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 1.05);
}

/** Soft tick used during the matchmaking reel. */
function playTick() {
  note(880, 0, 0.06, "square", 0.04);
}

/* sound toggle — remembered for the session */
const soundToggle = $("sound-toggle");
const soundIcon   = $("sound-icon");
const soundLabel  = $("sound-label");

try {
  soundOn = sessionStorage.getItem("os-sound") !== "off";
} catch (err) {
  soundOn = true;   // private mode etc. — just default to on
}
paintSoundToggle();

soundToggle.addEventListener("click", () => {
  soundOn = !soundOn;
  initAudio();
  try { sessionStorage.setItem("os-sound", soundOn ? "on" : "off"); } catch (err) { /* ignore */ }
  paintSoundToggle();
  if (soundOn) note(880, 0, 0.12, "triangle", 0.1);
});

function paintSoundToggle() {
  soundIcon.textContent = soundOn ? "🔊" : "🔇";
  soundLabel.textContent = soundOn ? "Sound ON" : "Sound OFF";
  soundToggle.classList.toggle("is-off", !soundOn);
  soundToggle.setAttribute("aria-pressed", String(soundOn));
}

/* ═══════════════════════════════════════════
   TRAIT HELPER
   The object's highest-scoring trait drives its
   quote and its gallery label.
   ═══════════════════════════════════════════ */

function getDominantTrait(personality) {
  return Object.entries(personality).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

/* ═══════════════════════════════════════════
   DATING-PROFILE GENERATOR
   The backend returns only trait numbers, so the
   profile text is built here. It is SEEDED off the
   object name, meaning the same object always gets
   the same profile — otherwise the gallery and the
   reveal would contradict each other.
   ═══════════════════════════════════════════ */

function seedFrom(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
const pick = (arr, seed, salt = 0) => arr[(seed + salt * 7919) % arr.length];

const OCCUPATIONS = ["Professional sitter", "Soup enthusiast", "Full-time clutter",
  "Freelance disappointment", "Certified dust collector", "Emotional support item",
  "Retired from usefulness", "Part-time obstacle"];
const LOVE_LANGUAGES = ["Being useful", "Physical touch (handling)", "Quality shelf time",
  "Words of affirmation", "Acts of service", "Being picked first", "Not being dropped"];
const FEARS = ["The dishwasher", "Being replaced by a newer model", "The bin",
  "Commitment", "Direct sunlight", "Being lent to a friend", "The floor", "Loud noises"];
const AGES = ["Classified", "Older than it admits", "Suspiciously new", "Unknown",
  "Ancient", "Refuses to say"];
const RED_FLAGS = ["Attention seeking", "Thinks it's the main character", "Never texts back",
  "Emotionally unavailable", "Dramatic over nothing", "Keeps disappearing", "Too clingy"];
const GREEN_FLAGS = ["Always ready to help", "Reliable in a crisis", "Genuinely low maintenance",
  "Great listener", "Shows up every time", "Never complains", "Surprisingly deep"];

const QUOTES = {
  Dramatic: (n) => `${n} thinks every single day is about them.`,
  Chaotic:  (n) => `${n} has never once made a good decision, and refuses to start.`,
  Calm:     (n) => `${n} has achieved inner peace. Nobody asked it to.`,
  Serious:  (n) => `${n} does not find any of this funny.`,
  Social:   (n) => `${n} has met everyone in the drawer and has opinions about all of them.`,
  Reliable: (n) => `${n} will be exactly where you left it. Forever.`,
  Friendly: (n) => `${n} likes everyone. That is its whole personality.`
};

function buildProfile(name, personality) {
  const seed = seedFrom(name.toLowerCase().trim());
  const trait = getDominantTrait(personality);
  const nice = name.charAt(0).toUpperCase() + name.slice(1);
  return {
    quote: (QUOTES[trait] || QUOTES.Reliable)(nice),
    age: pick(AGES, seed, 1),
    occupation: pick(OCCUPATIONS, seed, 2),
    loveLanguage: pick(LOVE_LANGUAGES, seed, 3),
    fear: pick(FEARS, seed, 4),
    redFlag: pick(RED_FLAGS, seed, 5),
    greenFlag: pick(GREEN_FLAGS, seed, 6),
    label: `${trait} ${pick(["romantic", "disaster", "presence", "energy", "icon"], seed, 8)}`
  };
}

/* ═══════════════════════════════════════════
   UPLOAD SCREEN
   ═══════════════════════════════════════════ */

function showError(msg, technical) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  if (technical) console.error("[Object Soulmate]", technical);
}
const hideError = () => { errorMsg.hidden = true; };

function updateAnalyzeState() {
  analyzeBtn.disabled = !(nameInput.value.trim() && selectedFile);
}

function handleFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showError("That isn't a photo. Your object deserves a real portrait.");
    return;
  }
  hideError();
  selectedFile = file;
  if (localPreview) URL.revokeObjectURL(localPreview);
  localPreview = URL.createObjectURL(file);
  previewImg.src = localPreview;
  dzEmpty.hidden = true;
  objectCard.hidden = false;
  objectCard.classList.remove("pop-in");
  void objectCard.offsetWidth;              // restart the animation
  objectCard.classList.add("pop-in");
  updateAnalyzeState();
}

cameraInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
galleryInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
nameInput.addEventListener("input", updateAnalyzeState);

clearPhoto.addEventListener("click", () => {
  selectedFile = null;
  cameraInput.value = "";
  galleryInput.value = "";
  objectCard.hidden = true;
  dzEmpty.hidden = false;
  updateAnalyzeState();
});

/* drag & drop */
["dragenter", "dragover"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragging");
  })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragging");
  })
);
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  handleFile(file);
});

/* ═══════════════════════════════════════════
   ANALYSIS SEQUENCE
   The backend request runs while the theatre plays.
   ═══════════════════════════════════════════ */

const ANALYSIS_STEPS = [
  "🔍 Scanning object…",
  "🧠 Studying its personality…",
  "💭 Detecting emotional baggage…",
  "❤️ Measuring romantic potential…",
  "🧬 Comparing questionable traits…",
  "🔮 Consulting the algorithm of destiny…",
  "⚠️ This object has issues."
];

analyzeBtn.addEventListener("click", async () => {
  initAudio();
  hideError();

  if (!selectedFile || !nameInput.value.trim()) {
    showError("Your object cannot date if you don't introduce it.");
    return;
  }

  const objectName = nameInput.value.trim();
  $("analyze-img").src = localPreview;
  showScreen("analyze");

  const msgEl  = $("analyze-msg");
  const barEl  = $("analyze-progress");
  const pctEl  = $("analyze-pct");
  const STEP_MS = 850;

  let step = 0;
  msgEl.textContent = ANALYSIS_STEPS[0];
  barEl.style.width = "6%";
  pctEl.textContent = "6%";

  const ticker = setInterval(() => {
    step++;
    if (step < ANALYSIS_STEPS.length) {
      msgEl.textContent = ANALYSIS_STEPS[step];
      msgEl.style.animation = "none";
      void msgEl.offsetWidth;
      msgEl.style.animation = "";
      const pct = Math.round(((step + 1) / ANALYSIS_STEPS.length) * 92);
      barEl.style.width = pct + "%";
      pctEl.textContent = pct + "%";
      playTick();
    }
  }, STEP_MS);

  // The request and the animation run together; we wait for whichever
  // finishes last, so the sequence never gets cut short and a slow
  // backend never leaves the user staring at a frozen bar.
  const minimumShow = new Promise((r) => setTimeout(r, STEP_MS * ANALYSIS_STEPS.length));

  try {
    const form = new FormData();
    form.append("file", selectedFile);
    form.append("object_name", objectName);

    const [res] = await Promise.all([
      fetch(`${API_URL}/upload`, { method: "POST", body: form }),
      minimumShow
    ]);

    clearInterval(ticker);

    // 409 = this object name already has a profile. Not an error state:
    // send them back with the backend's own message.
    if (res.status === 409) {
      const body = await res.json().catch(() => null);
      const msg = (body && body.detail && body.detail.message)
        || "That object already has a dating profile.";
      showScreen("upload");
      showError(msg);
      return;
    }

    if (!res.ok) throw new Error(`Backend responded ${res.status}`);
    result = await res.json();
    $("offline-bar").hidden = true;   // clearly reachable, so clear any stale warning

    barEl.style.width = "100%";
    pctEl.textContent = "100%";
    setTimeout(() => renderProfile(), 420);

  } catch (err) {
    clearInterval(ticker);
    showScreen("upload");
    if (err instanceof TypeError) {
      showError("Oops. The AI got emotionally confused. Is the backend running on port 8000?", err);
    } else {
      showError("We couldn't understand your object. It may be hiding its feelings.", err);
    }
  }
});

/* ═══════════════════════════════════════════
   PERSONALITY / DATING PROFILE SCREEN
   ═══════════════════════════════════════════ */

function renderProfile() {
  const { object_name, personality } = result;
  const profile = buildProfile(object_name, personality);

  $("profile-img").src = localPreview;
  $("profile-name").textContent = object_name;
  $("profile-quote").textContent = `“${profile.quote}”`;

  $("chip-status").textContent = "Relationship status: Single 🥲";
  $("chip-red").textContent    = `🚩 ${profile.redFlag}`;
  $("chip-green").textContent  = `💚 ${profile.greenFlag}`;

  // trait bars — built at 0% then animated up
  const bars = $("trait-bars");
  bars.innerHTML = "";
  Object.entries(personality)
    .sort((a, b) => b[1] - a[1])
    .forEach(([trait, value]) => {
      const row = document.createElement("div");
      row.className = "trait";
      row.innerHTML = `
        <span class="trait-name">${trait}</span>
        <span class="trait-val">${value}%</span>
        <div class="trait-track"><div class="trait-bar"></div></div>`;
      bars.appendChild(row);
      requestAnimationFrame(() => {
        setTimeout(() => { row.querySelector(".trait-bar").style.width = value + "%"; }, 60);
      });
    });

  // dating dossier
  $("dossier-list").innerHTML = `
    <dt>Age</dt><dd>${profile.age}</dd>
    <dt>Occupation</dt><dd>${profile.occupation}</dd>
    <dt>Love language</dt><dd>${profile.loveLanguage}</dd>
    <dt>Biggest fear</dt><dd>${profile.fear}</dd>`;

  showScreen("profile");
}

/* ═══════════════════════════════════════════
   MATCHMAKING SEQUENCE
   ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   OBJECT LORE  (frontend copy)

   The backend already reasons about objects in
   explanations.py, but only for the two matched
   objects. The rejected-candidate lines and the
   future timeline need the same kind of knowledge
   for objects the backend was never asked about,
   and /objects returns only names + personality
   scores. Rather than invent an endpoint, the short
   lines live here. Anything not listed falls back to
   its dominant personality trait.
   ═══════════════════════════════════════════ */

const LORE = {
  spoon:     { e: "🥄", arch: "chaos",     reject: "Makes noise in every single room it enters." },
  fork:      { e: "🍴", arch: "menace",    reject: "Brings four sharp opinions to every conversation." },
  knife:     { e: "🔪", arch: "menace",    reject: "Too sharp. Emotionally and otherwise." },
  plate:     { e: "🍽️", arch: "anchor",    reject: "Lets absolutely everyone walk over it." },
  bowl:      { e: "🥣", arch: "comfort",   reject: "Gives everything away and keeps nothing." },
  pot:       { e: "🍲", arch: "anchor",    reject: "Has been through too much to talk about it." },
  pan:       { e: "🍳", arch: "fragile",   reject: "Heats up in seconds over nothing." },
  cup:       { e: "☕", arch: "comfort",   reject: "Gets attached way too easily." },
  mug:       { e: "☕", arch: "comfort",   reject: "Only shows up when someone is sad." },
  glass:     { e: "🥛", arch: "fragile",   reject: "Shatters under the slightest pressure." },
  bottle:    { e: "🍾", arch: "intellect", reject: "Keeps everything bottled up inside." },
  kettle:    { e: "🫖", arch: "chaos",     reject: "Screams the moment it reaches its limit." },
  chair:     { e: "🪑", arch: "anchor",    reject: "Has not moved from that spot in years." },
  table:     { e: "🪵", arch: "anchor",    reject: "Present for everything, contributes nothing." },
  sofa:      { e: "🛋️", arch: "comfort",   reject: "A genuinely terrible influence." },
  bed:       { e: "🛏️", arch: "comfort",   reject: "Nobody who gets involved ever leaves." },
  lamp:      { e: "💡", arch: "worker",    reject: "Makes everyone else look good, gets ignored." },
  fan:       { e: "🌀", arch: "worker",    reject: "Spins all day and goes nowhere." },
  clock:     { e: "⏰", arch: "intellect", reject: "Constantly reminds everyone they are late." },
  mirror:    { e: "🪞", arch: "vain",      reject: "Only ever talks about whoever is in front of it." },
  pillow:    { e: "🛏️", arch: "comfort",   reject: "Knows far too many secrets already." },
  blanket:   { e: "🧣", arch: "comfort",   reject: "Suffocatingly affectionate." },
  laptop:    { e: "💻", arch: "worker",    reject: "Already has 47 unresolved things open." },
  keyboard:  { e: "⌨️", arch: "worker",    reject: "Already gets pressed enough." },
  mouse:     { e: "🖱️", arch: "worker",    reject: "Goes wherever it is dragged. No opinions." },
  phone:     { e: "📱", arch: "chaos",     reject: "Demands attention every ninety seconds." },
  charger:   { e: "🔌", arch: "worker",    reject: "Only ever wanted in an emergency." },
  cable:     { e: "🔗", arch: "fragile",   reject: "Far too tangled to get into right now." },
  headphones:{ e: "🎧", arch: "intellect", reject: "Exists specifically to avoid other people." },
  remote:    { e: "📺", arch: "menace",    reject: "Disappears exactly when it is needed." },
  speaker:   { e: "🔊", arch: "chaos",     reject: "Has never once read the room." },
  book:      { e: "📚", arch: "intellect", reject: "Silently judging everyone from the shelf." },
  pen:       { e: "🖊️", arch: "menace",    reject: "Runs out at the worst possible moment." },
  pencil:    { e: "✏️", arch: "worker",    reject: "Gives away a bit of itself every time." },
  eraser:    { e: "🧽", arch: "worker",    reject: "Spends its life fixing other people's mistakes." },
  stapler:   { e: "📎", arch: "menace",    reject: "Commits instantly and permanently. Alarming." },
  scissors:  { e: "✂️", arch: "menace",    reject: "Ends things without any discussion." },
  shoe:      { e: "👟", arch: "worker",    reject: "Always running away from something." },
  sock:      { e: "🧦", arch: "menace",    reject: "Vanishes without explanation. Every time." },
  bag:       { e: "👜", arch: "worker",    reject: "Already carrying more than it can handle." },
  backpack:  { e: "🎒", arch: "worker",    reject: "Loaded with everyone else's baggage." },
  wallet:    { e: "👛", arch: "fragile",   reject: "Only opens up in order to be emptied." },
  key:       { e: "🔑", arch: "menace",    reject: "Holds all the access and shares none of it." },
  watch:     { e: "⌚", arch: "vain",      reject: "Entirely decorative at this point." },
  glasses:   { e: "👓", arch: "intellect", reject: "Sees everything and mentions all of it." },
  sunglasses:{ e: "😎", arch: "vain",      reject: "Refuses to reveal any actual feelings." },
  umbrella:  { e: "☂️", arch: "worker",    reject: "Forgotten until the exact moment of crisis." },
  banana:    { e: "🍌", arch: "fragile",   reject: "Changes personality every three days." },
  apple:     { e: "🍎", arch: "vain",      reject: "Perfect outside, brown within minutes." },
  egg:       { e: "🥚", arch: "fragile",   reject: "Far too much careful handling required." },
  pizza:     { e: "🍕", arch: "chaos",     reject: "Universally loved, never sticks around." },
  onion:     { e: "🧅", arch: "fragile",   reject: "Too many layers, all of them upsetting." },
  brick:     { e: "🧱", arch: "anchor",    reject: "The emotional availability of a wall." },
  broom:     { e: "🧹", arch: "worker",    reject: "Always cleaning up everyone else's problems." },
  bucket:    { e: "🪣", arch: "anchor",    reject: "Only appears after something has gone wrong." },
  towel:     { e: "🧻", arch: "comfort",   reject: "Absorbs everything and is left to dry alone." },
  soap:      { e: "🧼", arch: "worker",    reject: "Gets smaller every time it helps somebody." },
  toothbrush:{ e: "🪥", arch: "comfort",   reject: "Has seen far too much already." },
  candle:    { e: "🕯️", arch: "fragile",   reject: "Burns itself down for the atmosphere." },
  plant:     { e: "🪴", arch: "fragile",   reject: "Low drama, impossibly high needs." },
  bin:       { e: "🗑️", arch: "worker",    reject: "Already full of other people's issues." },
  teddy:     { e: "🧸", arch: "comfort",   reject: "Has absorbed years of crying without comment." },
  ball:      { e: "⚽", arch: "chaos",     reject: "Bounces back no matter how badly treated." }
};

const LORE_ALIASES = {
  "teddy bear": "teddy", "soft toy": "teddy", "mobile": "phone", "iphone": "phone",
  "computer": "laptop", "pc": "laptop", "earphones": "headphones", "earbuds": "headphones",
  "couch": "sofa", "cushion": "pillow", "trash": "bin", "dustbin": "bin", "shades": "sunglasses",
  "sneaker": "shoe", "trainer": "shoe", "boot": "shoe", "purse": "wallet", "handbag": "bag",
  "water bottle": "bottle", "coffee cup": "cup", "mop": "broom", "screen": "laptop"
};

const TRAIT_ARCH = {
  Dramatic: "chaos", Social: "chaos", Chaotic: "menace", Reliable: "anchor",
  Serious: "intellect", Calm: "comfort", Friendly: "comfort"
};

const GENERIC_REJECT = {
  chaos:     "Demands more attention than anyone can provide.",
  anchor:    "Has not moved, emotionally or otherwise, in years.",
  worker:    "Already far too overworked for a relationship.",
  fragile:   "Emotionally far too delicate for this.",
  vain:      "Mostly interested in how the pairing would look.",
  intellect: "Quietly judging this entire process.",
  menace:    "Known to cause problems. Repeatedly.",
  comfort:   "Gets attached far too quickly."
};

/** Resolve an object name to its lore, falling back to its personality. */
function loreFor(name, personality) {
  let k = String(name || "").toLowerCase().trim();
  k = LORE_ALIASES[k] || k;
  if (LORE[k]) return LORE[k];

  if (k.endsWith("s")) {
    const sing = LORE_ALIASES[k.slice(0, -1)] || k.slice(0, -1);
    if (LORE[sing]) return LORE[sing];
  }
  for (const word of k.split(" ")) if (LORE[word]) return LORE[word];

  const dominant = personality ? getDominantTrait(personality) : "Reliable";
  const arch = TRAIT_ARCH[dominant] || "anchor";
  return { e: "📦", arch, reject: GENERIC_REJECT[arch] };
}

/* ═══════════════════════════════════════════
   FEATURE 3 — THEIR RIDICULOUS FUTURE
   Built from both objects' archetypes, so the
   timeline actually reflects these two.
   ═══════════════════════════════════════════ */

const F_6M = {
  chaos:     (a) => `🏠 ${a} moves in and immediately rearranges everything.`,
  anchor:    (a) => `🏠 ${a} agrees to move in, then does not move again.`,
  worker:    (a) => `🧹 ${a} moves in and quietly starts doing all the chores.`,
  fragile:   (a) => `📦 ${a} moves in with a concerning amount of baggage.`,
  vain:      (a) => `🪞 ${a} moves in and claims the entire mirror.`,
  intellect: (a) => `📚 ${a} moves in and says very little about it.`,
  menace:    (a) => `🚪 ${a} moves in. Something breaks in the first week.`,
  comfort:   (a) => `🫂 ${a} moves in and the place feels warmer immediately.`
};

const F_2Y = {
  chaos:     (a, b) => `💢 ${b} points out that ${a} has not stopped talking in two years.`,
  anchor:    (a, b) => `💢 ${b} complains that ${a} has never expressed a single feeling.`,
  worker:    (a, b) => `😮‍💨 ${a} is too exhausted to go anywhere. ${b} stops asking.`,
  fragile:   (a, b) => `💢 ${a} has a crisis every other week. ${b} is keeping count.`,
  vain:      (a, b) => `📸 ${a} spends longer getting ready than ${b} spends caring.`,
  intellect: (a, b) => `💢 ${a} keeps correcting ${b} in front of other people.`,
  menace:    (a, b) => `🚨 ${a} has caused three separate incidents. ${b} covered for two.`,
  comfort:   (a, b) => `💢 ${b} needs space. ${a} does not understand the concept.`
};

const F_5Y = {
  chaos:     (b) => `🔊 ${b} finally says everything, all at once, very loudly.`,
  anchor:    (b) => `🪑 ${b} finally snaps. Nobody saw it coming.`,
  worker:    (b) => `✈️ ${b} takes a very long holiday. Alone.`,
  fragile:   (b) => `💔 ${b} falls apart completely and blames the weather.`,
  vain:      (b) => `😎 ${b} leaves for something considerably more photogenic.`,
  intellect: (b) => `📓 ${b} writes it all down instead of ever saying it.`,
  menace:    (b) => `🚨 One of them mysteriously disappears. ${b} does not comment.`,
  comfort:   (b) => `🫂 ${b} forgives it again. Everyone involved is concerned.`
};

const F_10Y = [
  "❓ Nobody remembers how this started.",
  "👵 They tell everyone they simply grew apart.",
  "🏠 Still together. Still not speaking.",
  "📦 They end up in the same drawer. Neither mentions it.",
  "🕰️ Officially still a couple. Unofficially, furniture."
];

function buildFuture(nameA, persA, nameB, persB, pct) {
  const A = loreFor(nameA, persA);
  const B = loreFor(nameB, persB);
  const a = nameA.charAt(0).toUpperCase() + nameA.slice(1);
  const b = nameB.charAt(0).toUpperCase() + nameB.slice(1);
  const seed = seedFrom(`${nameA}|${nameB}`);

  const survival = Math.max(1, Math.min(42, Math.round(pct / 11)));
  const quip =
    survival >= 12 ? "Honestly, that's higher than expected."
    : survival >= 6 ? "The algorithm has seen worse. Not many, but some."
    : "We ran the numbers twice. It got worse.";

  return {
    steps: [
      { when: "6 MONTHS", what: (F_6M[A.arch] || F_6M.anchor)(a) },
      { when: "2 YEARS",  what: (F_2Y[A.arch] || F_2Y.anchor)(a, b) },
      { when: "5 YEARS",  what: (F_5Y[B.arch] || F_5Y.anchor)(b) },
      { when: "10 YEARS", what: F_10Y[seed % F_10Y.length] }
    ],
    survival,
    quip
  };
}

function renderFuture(nameA, persA, nameB, persB, pct) {
  const fut = buildFuture(nameA, persA, nameB, persB, pct);
  const list = $("timeline");
  list.innerHTML = "";

  fut.steps.forEach((s, i) => {
    const li = document.createElement("li");
    li.style.animationDelay = 140 + i * 160 + "ms";
    li.innerHTML = `<span class="tl-when">${s.when}</span><span class="tl-what">${s.what}</span>`;
    list.appendChild(li);
  });

  $("sv-value").textContent = "0%";
  $("sv-fill").style.width = "0%";
  $("sv-quip").textContent = `"${fut.quip}"`;
  $("future-card").hidden = false;

  // count the survival chance up once the timeline has finished drawing
  setTimeout(() => {
    $("sv-fill").style.width = fut.survival + "%";
    let c = 0;
    const t = setInterval(() => {
      c += 1;
      if (c >= fut.survival) { c = fut.survival; clearInterval(t); }
      $("sv-value").textContent = c + "%";
    }, 45);
  }, 900);
}

/* ═══════════════════════════════════════════
   THE MATCHMAKING SEQUENCE
   search -> rejected candidates -> destiny beats -> reveal
   ~9s total. The soulmate already arrived with /upload,
   so nothing in here waits on the network.
   ═══════════════════════════════════════════ */

const SEARCH_STEPS = [
  "Analyzing emotional damage…",
  "Measuring personality chemistry…",
  "Checking physical attraction…",
  "Calculating chaos…",
  "Rejecting reasonable choices…",
  "Ignoring common sense…",
  "Consulting the algorithm…"
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Short buzz when a candidate gets stamped. */
function playReject() {
  note(180, 0, 0.16, "square", 0.05);
}

/** Up to 4 stored objects to reject — never the actual soulmate. */
async function pickRejected(soulmateId, ownName) {
  let pool = [];
  try {
    const res = await fetch(`${API_URL}/objects`);
    if (res.ok) pool = (await res.json()).objects;
  } catch (err) {
    console.warn("[Object Soulmate] could not load candidates:", err);
    return [];
  }

  const own = String(ownName || "").toLowerCase().trim();
  const seen = new Set();
  return pool
    .filter((o) => o.id !== soulmateId && o.object_name.toLowerCase().trim() !== own)
    .filter((o) => {                      // one card per name reads better
      const n = o.object_name.toLowerCase().trim();
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    })
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);
}

function candidateCard(obj) {
  const lore = loreFor(obj.object_name, obj.personality);
  const card = document.createElement("div");
  card.className = "cand-card";
  card.innerHTML = `
    <div class="cand-photo">${lore.e}</div>
    <div class="cand-body">
      <p class="cand-name"></p>
      <p class="cand-reason"></p>
    </div>
    <span class="cand-stamp">❌ REJECTED</span>`;
  card.querySelector(".cand-name").textContent = obj.object_name;
  card.querySelector(".cand-reason").textContent = `"${lore.reject}"`;

  // swap in the real photo when it loads; emoji stays as the fallback
  if (obj.image_path) {
    const img = new Image();
    img.alt = obj.object_name;
    img.onload = () => { card.querySelector(".cand-photo").replaceChildren(img); };
    img.src = toStaticUrl(obj.image_path);
  }
  return card;
}

/** One dramatic full-screen line. */
async function beat(text, ms, cls) {
  const veil = $("destiny-veil");
  const line = $("destiny-line");
  veil.hidden = false;
  line.className = "destiny-line" + (cls ? " " + cls : "");
  line.textContent = text;
  line.style.animation = "none";
  void line.offsetWidth;
  line.style.animation = "";
  await wait(ms);
}

$("find-soulmate-btn").addEventListener("click", async () => {
  initAudio();

  if (!result || !result.soulmate) {
    showError("Nobody is available. This town is emotionally unavailable.");
    showScreen("upload");
    return;
  }

  const mate = result.soulmate;
  showScreen("match");

  const reel = $("reel-track");
  const reelWindow = $("reel-window");
  const candidates = $("candidates");
  const candStage = $("cand-stage");
  const msgEl = $("matchmaking-msg");

  reelWindow.hidden = false;
  candidates.hidden = true;
  candStage.innerHTML = "";
  $("matchmaking-title").textContent = "🔍 SEARCHING FOR SOULMATE…";

  const pool = ["🥄", "🍌", "👟", "🪑", "☕", "⌨️", "📚", "🧸", "🔌", "🧦", "🪥", "🕯️", "📎", "🍕"];
  reel.innerHTML = "";
  for (let i = 0; i < 40; i++) {
    const sp = document.createElement("span");
    sp.textContent = pool[Math.floor(Math.random() * pool.length)];
    reel.appendChild(sp);
  }
  let offset = 0;
  const spin = setInterval(() => {
    offset -= 26;
    if (offset < -900) offset = 0;
    reel.style.transform = `translateX(${offset}px)`;
  }, 45);

  // candidates load while the search messages play
  const rejectedPromise = pickRejected(mate.soulmate_id, result.object_name);

  // ── 1. searching messages (~2.5s) ──
  for (const step of SEARCH_STEPS) {
    msgEl.textContent = step;
    msgEl.style.animation = "none";
    void msgEl.offsetWidth;
    msgEl.style.animation = "";
    playTick();
    await wait(360);
  }
  clearInterval(spin);

  // ── 2. rejected candidates (~3.4s) ──
  const rejected = await rejectedPromise;
  if (rejected.length) {
    reelWindow.hidden = true;
    candidates.hidden = false;
    $("matchmaking-title").textContent = "REVIEWING THE POOL";
    msgEl.textContent = "Considering everyone else first…";

    for (const obj of rejected) {
      const card = candidateCard(obj);
      candStage.replaceChildren(card);
      await wait(330);
      card.classList.add("rejected");     // stamp and shake land together
      playReject();
      await wait(420);
      card.classList.add("out");
      await wait(150);
    }
    candStage.innerHTML = "";
  }

  // ── 3. destiny beats (~3.1s) ──
  await beat("⚠️ WAIT…", 950, "warn");
  await beat("SOMETHING HAS GONE TERRIBLY RIGHT", 1300);
  await beat("❤️ DESTINY DETECTED", 900, "reveal");

  const veil = $("destiny-veil");
  veil.classList.add("fading");
  setTimeout(() => {
    veil.hidden = true;
    veil.classList.remove("fading");
  }, 380);

  revealSoulmate();
});

/* ═══════════════════════════════════════════
   SOULMATE REVEAL
   ═══════════════════════════════════════════ */

/** Turn a stored Windows-style path into a URL the browser can fetch.
    Handles backslashes and spaces in old filenames. */
function toStaticUrl(path) {
  const clean = String(path).replace(/\\/g, "/");
  return `${API_URL}/${clean.split("/").map(encodeURIComponent).join("/")}`;
}

const VERDICTS = [
  { min: 90, label: "💍 SOULMATES",               bad: false },
  { min: 75, label: "❤️ PERFECT MATCH",            bad: false },
  { min: 60, label: "💕 SURPRISINGLY COMPATIBLE",  bad: false },
  { min: 45, label: "😏 IT'S COMPLICATED",         bad: false },
  { min: 30, label: "😂 TOXIC BUT INTERESTING",    bad: true  },
  { min: 15, label: "🚩 RED FLAG COUPLE",          bad: true  },
  { min: 0,  label: "💀 ABSOLUTELY NOT",           bad: true  }
];

const FAIL_LINES = [
  "The algorithm strongly recommends staying friends.",
  "There was chemistry. Unfortunately, it was toxic.",
  "These two should never be left alone together."
];

function revealSoulmate() {
  const mate = result.soulmate;
  const pct = displayScore(mate.compatibility);
  const verdict = VERDICTS.find((v) => pct >= v.min);
  const failed = pct < 35;

  const pair = $("pair");
  const kicker = $("reveal-kicker");
  const heart = $("heart-core");
  const ring = $("ring-fill");

  // fill both sides
  $("reveal-user-img").src = localPreview;
  $("reveal-user-name").textContent = result.object_name;

  const mateImg = $("reveal-soulmate-img");
  mateImg.src = toStaticUrl(mate.soulmate_image);
  mateImg.onerror = () => {
    // an old row whose file went missing shouldn't break the reveal
    console.warn("Soulmate image missing:", mate.soulmate_image);
    mateImg.style.opacity = "0.12";
  };
  $("reveal-soulmate-name").textContent = mate.soulmate_name;

  // reset to the "before" state
  kicker.textContent = "DESTINY IS DECIDING…";
  pair.classList.add("apart");
  pair.classList.remove("failed");
  heart.classList.remove("broken");
  heart.style.opacity = "0";
  ring.classList.toggle("bad", failed);
  ring.style.strokeDashoffset = "326.7";
  $("ring-percent").textContent = "0%";
  $("verdict").style.opacity = "0";
  $("confetti-field").innerHTML = "";
  $("future-card").hidden = true;

  showScreen("reveal");

  // …then the sequence
  setTimeout(() => {
    kicker.textContent = failed ? "💔 LOVE HAS FAILED" : "IT'S A MATCH";
    pair.classList.remove("apart");
    if (failed) pair.classList.add("failed");

    heart.style.transition = "opacity .5s ease";
    heart.style.opacity = "1";
    heart.textContent = failed ? "💔" : "❤️";
    if (failed) heart.classList.add("broken");

    if (failed) {
      playFailSound();
    } else {
      playMatchSound();
      flashScreen();
      launchConfetti();
    }

    // ring + number
    const circumference = 326.7;
    ring.style.strokeDashoffset = circumference - (circumference * pct) / 100;
    animateNumber(pct);

    setTimeout(() => {
      const v = $("verdict");
      const label = $("verdict-label");
      label.textContent = verdict.label;
      label.classList.toggle("bad", verdict.bad);
      // The backend now returns a structured analysis. Fall back to the
      // plain explanation string if an older backend is answering.
      const an = mate.analysis;
      if (an) {
        $("verdict-text").textContent = an.why;
        $("an-persona-a").textContent = an.persona_a;
        $("an-persona-b").textContent = an.persona_b;
        $("an-dynamic").textContent   = an.dynamic;
        $("an-verdict").textContent   = failed
          ? FAIL_LINES[Math.floor(Math.random() * FAIL_LINES.length)]
          : an.verdict;
        $("analysis").hidden = false;
      } else {
        $("verdict-text").textContent = failed
          ? FAIL_LINES[Math.floor(Math.random() * FAIL_LINES.length)]
          : mate.explanation;
        $("analysis").hidden = true;
      }
      v.style.transition = "opacity .6s ease";
      v.style.opacity = "1";

      // FEATURE 3 lands just after the verdict, so the whole thing
      // reads as one continuous sequence rather than a separate card.
      setTimeout(() => {
        renderFuture(
          result.object_name, result.personality,
          mate.soulmate_name, mate.soulmate_personality,
          pct
        );
      }, 650);
    }, 1500);

  }, 1100);
}

function animateNumber(target) {
  const el = $("ring-percent");
  let current = 0;
  const step = Math.max(1, Math.round(target / 34));
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current + "%";
  }, 40);
}

function flashScreen() {
  const f = document.createElement("div");
  f.className = "screen-flash";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 700);
}

function launchConfetti() {
  const field = $("confetti-field");
  const colors = ["#FFD23F", "#FF2E93", "#FFFFFF", "#A855F7", "#21E6FF"];
  const hearts = ["❤️", "💖", "💕", "✨"];

  for (let i = 0; i < 70; i++) {
    const piece = document.createElement("div");
    const isHeart = i % 4 === 0;
    piece.className = "confetti-piece" + (isHeart ? " heart" : "");
    if (isHeart) {
      piece.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    } else {
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    }
    piece.style.left = Math.random() * 100 + "%";
    piece.style.animationDuration = 2.2 + Math.random() * 1.8 + "s";
    piece.style.animationDelay = Math.random() * 0.5 + "s";
    field.appendChild(piece);
  }
  setTimeout(() => { field.innerHTML = ""; }, 4800);
}

/* start over */
$("again-btn").addEventListener("click", () => {
  result = null;
  selectedFile = null;
  nameInput.value = "";
  cameraInput.value = "";
  galleryInput.value = "";
  objectCard.hidden = true;
  dzEmpty.hidden = false;
  hideError();
  updateAnalyzeState();
  showScreen("upload");
});

/* ═══════════════════════════════════════════
   THE DATING POOL

   Every object in the database becomes a dating
   profile. Compatibility between any two of them is
   computed here from their stored personality scores
   plus how their archetypes actually interact — so a
   spoon can match a chair, a banana or a keyboard,
   and the reason is never a generic joke.
   ═══════════════════════════════════════════ */

/* Short observable behaviour per object, used to build match reasons.
   Kept alongside LORE rather than inside it so the table stays readable. */
const BEHAVIOUR = {
  spoon: "makes noise in every room it enters",
  fork: "brings four sharp opinions to every meal",
  knife: "is trusted with the difficult jobs and handled carefully",
  plate: "lets everyone pile their problems on top of it",
  bowl: "holds things other people are going to consume",
  pot: "sits on an open flame and stays completely calm",
  pan: "heats up in seconds and takes an hour to cool down",
  cup: "sits quietly while people describe their day to it",
  mug: "gets reached for on everybody's worst mornings",
  glass: "is completely transparent and completely breakable",
  bottle: "keeps everything sealed in until somebody twists hard",
  kettle: "screams the second it reaches its limit",
  chair: "has silently held everybody up for years",
  table: "is present for every argument and joins in none",
  sofa: "absorbs people who said they were staying five minutes",
  bed: "is the hardest thing in the house to leave",
  lamp: "makes everyone else look good and gets looked past",
  fan: "spins all day and arrives precisely nowhere",
  clock: "tells everyone how late they are without being asked",
  mirror: "only ever shows people themselves",
  pillow: "has absorbed more crying than most therapists",
  blanket: "solves emotional problems by lying on top of them",
  laptop: "overheats with 47 things open that it will not close",
  keyboard: "gets hammered on all day by stressed people",
  mouse: "gets dragged around with no say in the direction",
  phone: "demands attention every ninety seconds",
  charger: "is only ever wanted when somebody is desperate",
  cable: "becomes hopelessly tangled the moment it is left alone",
  headphones: "exists to help people avoid talking to anyone",
  remote: "vanishes constantly and returns when nobody needs it",
  speaker: "is the loudest thing in the room and knows it",
  book: "sits on a shelf knowing everything and judging quietly",
  pen: "runs out at the exact moment it matters",
  pencil: "gets shorter every time it is asked for something",
  eraser: "spends its life removing other people's mistakes",
  stapler: "binds things together permanently and with force",
  scissors: "cuts things off cleanly and never looks back",
  shoe: "gets stepped on all day and keeps going",
  sock: "disappears without explanation and offers no reason",
  bag: "carries whatever it is handed until something tears",
  backpack: "is loaded with everyone's things and told to keep up",
  wallet: "is only opened when something is being taken",
  key: "controls access to everything and hides when needed",
  watch: "is worn to look impressive by people who check their phone",
  glasses: "helps everyone see and gets lost on someone's head",
  sunglasses: "looks cool while literally hiding someone's eyes",
  umbrella: "is forgotten every sunny day and begged for in a storm",
  banana: "changes colour three times a week and bruises on sight",
  apple: "looks flawless until the moment it is opened up",
  egg: "is handled carefully by everybody who meets it",
  pizza: "makes everyone happy instantly and vanishes just as fast",
  onion: "has many layers and makes people cry inside them",
  brick: "refuses to move, bend or acknowledge any feelings",
  broom: "cleans up everyone's mess and gets blamed anyway",
  bucket: "only appears once something has already gone wrong",
  towel: "absorbs everyone's problems and is hung up alone",
  soap: "gets smaller every single time it helps somebody",
  toothbrush: "sees everyone at their worst twice a day",
  candle: "burns itself down to make the room feel nicer",
  plant: "grows quietly and dies if ignored for a week",
  bin: "is handed everything nobody wants and never asked how it feels",
  teddy: "has been cried on for years and never mentioned it",
  ball: "gets thrown and kicked and comes back every time"
};

/* Archetype identity — drives the dating-app persona. */
const IDENTITY = {
  chaos: {
    title: "The Loud Extrovert",
    tagline: "I don't enter a room. I make an entrance.",
    short: "loud, dramatic and desperate for attention",
    looking: "Someone patient",
    secret: (n) => `Deep down, ${n} is terrified of being ignored for even one afternoon.`,
    green: ["Never lets a silence happen", "Excellent at starting conversations", "Genuinely fun at gatherings"],
    red: ["Makes unnecessary noise", "Wants to be involved in everything", "Cannot stay out of other people's business"]
  },
  anchor: {
    title: "The Emotional Supporter",
    tagline: "I've been supporting people my entire life.",
    short: "steady, dependable and completely unshakeable",
    looking: "Someone who actually stays",
    secret: (n) => `${n} has wanted to move for eleven years and has told absolutely nobody.`,
    green: ["Extremely reliable", "Always exactly where you left it", "Handles pressure without complaint"],
    red: ["Never communicates", "Has not changed since the day you met", "Emotionally immovable"]
  },
  worker: {
    title: "The Overworked One",
    tagline: "I'll rest when everything else is finished.",
    short: "hardworking, useful and running on empty",
    looking: "Someone with manageable problems",
    secret: (n) => `${n} has not had a day off since it arrived and is far too polite to bring it up.`,
    green: ["Always ready when you need it", "Never complains about anything", "Gets things done quietly"],
    red: ["Physically incapable of resting", "Says yes to everything", "Quietly resentful about all of it"]
  },
  fragile: {
    title: "The Drama Queen",
    tagline: "My personality changes with the temperature.",
    short: "sensitive, unpredictable and emotionally weather-dependent",
    looking: "Someone who can handle the drama",
    secret: (n) => `${n} rehearses arguments it will never have. Frequently.`,
    green: ["Deeply emotionally honest", "Feels everything sincerely", "Never pretends to be fine"],
    red: ["Extremely sensitive", "New personality every few days", "Breaks under mild pressure"]
  },
  vain: {
    title: "The One Who Knows",
    tagline: "I'm not shallow. I'm just well presented.",
    short: "stylish, confident and mostly surface",
    looking: "Someone photogenic",
    secret: (n) => `${n} has no idea what it would be without the attention.`,
    green: ["Makes everything look better", "Enormously confident", "Great first impression"],
    red: ["Refuses to reveal actual feelings", "Chooses image over honesty", "Has never asked a follow-up question"]
  },
  intellect: {
    title: "The Silent Judge",
    tagline: "I've formed an opinion. I won't be sharing it.",
    short: "observant, private and quietly judgmental",
    looking: "Someone who doesn't need constant talking",
    secret: (n) => `${n} has opinions about everyone in this room and will take them to the grave.`,
    green: ["Notices absolutely everything", "Calm in any situation", "Never repeats what it hears"],
    red: ["Says almost nothing", "Silently critical", "Emotionally unreadable"]
  },
  menace: {
    title: "The Red Flag",
    tagline: "I'm not a problem. I'm an experience.",
    short: "unpredictable, difficult and suspiciously proud of it",
    looking: "Someone with a high tolerance",
    secret: (n) => `${n} knows exactly what it did and would do it again immediately.`,
    green: ["Never boring", "Decisive under pressure", "Fully committed to the bit"],
    red: ["Causes problems on purpose", "Disappears without warning", "Has been asked to leave before"]
  },
  comfort: {
    title: "The Emotional Support Object",
    tagline: "Tell me everything. I have nowhere to be.",
    short: "warm, patient and endlessly available",
    looking: "Someone who doesn't leave after one use",
    secret: (n) => `${n} has absorbed everybody's problems and has never once been asked about its own.`,
    green: ["Genuinely good listener", "Makes everything feel survivable", "Available at any hour"],
    red: ["Gets attached far too quickly", "Has no boundaries whatsoever", "Forgives things it should not"]
  }
};

/* A few object-specific taglines so the best-known objects feel hand-written. */
const TAGLINES = {
  spoon: "I don't enter a room. I make an entrance.",
  chair: "I've been supporting people my entire life.",
  banana: "My personality changes with the temperature.",
  cup: "People tell me things. I hold them.",
  broom: "I clean up after everyone. Nobody cleans up after me.",
  keyboard: "Everyone presses my buttons. Literally.",
  shoe: "I've walked away from better than you.",
  book: "I know things. I'm choosing not to say them.",
  laptop: "I have 47 tabs open and 3% battery. Emotionally.",
  sock: "I'll be honest, I probably won't be here tomorrow.",
  brick: "I have been emotionally unavailable since construction.",
  mirror: "Let's talk about you. Specifically, how you look.",
  fan: "I go in circles. It's a whole personality."
};

/* How two archetypes actually get along: score adjustment + the punchline. */
const PAIR = {
  "chaos|anchor":    [ 14, "One talks. One listens. Neither has considered swapping."],
  "chaos|chaos":     [ -6, "Two extroverts, one spotlight. Nobody in this pairing is listening."],
  "chaos|worker":    [  6, "One demands attention, the other is too tired to give it, and somehow it holds."],
  "chaos|fragile":   [  4, "One is relentless, the other bruises on contact. Volatile, but never boring."],
  "chaos|vain":      [ -4, "Both need to be looked at. Neither has looked at the other once."],
  "chaos|intellect": [  8, "One will not stop talking. The other stopped listening and never mentioned it."],
  "chaos|menace":    [ -8, "One makes the scene, the other makes the damage. A formal safety hazard."],
  "chaos|comfort":   [ 13, "One arrives mid-crisis at full volume. The other puts the kettle on."],
  "anchor|anchor":   [ -2, "Neither will move first. This has been going on for four years."],
  "anchor|worker":   [ 10, "One holds everything up, the other does all the running. Between them, the household survives."],
  "anchor|fragile":  [ 11, "One is unshakeable, the other falls apart weekly. Somehow the healthiest thing here."],
  "anchor|vain":     [  2, "One has substance, the other has style, and they have agreed never to discuss it."],
  "anchor|intellect":[  6, "One is quiet because it is steady, the other because it is judging. Peaceful evenings."],
  "anchor|menace":   [  5, "An unstoppable force met a profoundly unbothered object."],
  "anchor|comfort":  [ 12, "One provides the structure, the other provides the feelings. Disappointingly functional."],
  "worker|worker":   [  3, "Both exhausted, both unpaid, neither has taken a day off. This is a union, not a romance."],
  "worker|fragile":  [ -3, "One is running on empty, the other needs constant reassurance. Bad timing all round."],
  "worker|vain":     [ -5, "One does all the work. The other takes all the photographs."],
  "worker|intellect":[  1, "One works without stopping, the other explains why the method was inefficient."],
  "worker|menace":   [ -7, "One makes the mess, the other clears it. That is not romance, it is unpaid overtime."],
  "worker|comfort":  [ 14, "One is burnt out, the other specialises in burnt-out people. This is therapy with extra steps."],
  "fragile|fragile": [  0, "Two sensitive souls handling each other with enormous care and zero stability."],
  "fragile|vain":    [ -6, "One is falling apart. The other is concerned about how that looks."],
  "fragile|intellect":[ -2, "One needs reassurance, the other offers a well-reasoned analysis. It is not landing."],
  "fragile|menace":  [-10, "One breaks easily. The other breaks things. Our legal team recommends caution."],
  "fragile|comfort": [ 15, "One feels everything, the other absorbs it all. The closest thing to healthy in this pool."],
  "vain|vain":       [ -4, "Both stunning, both shallow, neither has asked a single question."],
  "vain|intellect":  [ -1, "All surface meets all substance. Both are convinced they are winning."],
  "vain|menace":     [ -3, "A very stylish disaster, photographed extensively throughout."],
  "vain|comfort":    [  7, "One wants admiring, the other just wants everyone to be alright. Only one is trying."],
  "intellect|intellect": [ 4, "Two quiet observers judging the room in perfect silent agreement."],
  "intellect|menace":[ -5, "One plans quietly, the other acts recklessly. Whatever they are building is not safe."],
  "intellect|comfort":[ 9, "One offers facts, the other offers warmth. Every discussion ends in a stalemate and a hug."],
  "menace|menace":   [ -9, "Partners in crime. Whatever happens next becomes somebody else's problem."],
  "menace|comfort":  [  8, "One causes chaos, the other forgives it instantly. Concerning, but sweet."],
  "comfort|comfort": [ 11, "Endlessly supportive of one another and completely incapable of leaving the house."]
};

/* The lookup key is built with .sort(), so normalise every key here once.
   Writing "chaos|anchor" by hand would silently never match "anchor|chaos". */
const PAIR_SORTED = {};
Object.keys(PAIR).forEach((k) => {
  PAIR_SORTED[k.split("|").sort().join("|")] = PAIR[k];
});

/* Funny relationship labels, picked by score. */
const POOL_LABELS = [
  [88, "❤️ POTENTIAL SOULMATE"],
  [78, "💕 SURPRISINGLY GOOD"],
  [68, "😏 THERE IS CHEMISTRY"],
  [58, "🔥 SUSPICIOUS CHEMISTRY"],
  [46, "😂 THIS COULD BE FUNNY"],
  [34, "🧪 SCIENTIFICALLY QUESTIONABLE"],
  [22, "🤨 WE DON'T KNOW EITHER"],
  [12, "🚩 DANGEROUSLY COMPATIBLE"],
  [0,  "💀 PLEASE DON'T"]
];

function poolLabel(score) {
  return (POOL_LABELS.find((l) => score >= l[0]) || POOL_LABELS[POOL_LABELS.length - 1])[1];
}

function behaviourOf(name) {
  let k = String(name || "").toLowerCase().trim();
  k = LORE_ALIASES[k] || k;
  if (BEHAVIOUR[k]) return BEHAVIOUR[k];
  if (k.endsWith("s")) {
    const sing = LORE_ALIASES[k.slice(0, -1)] || k.slice(0, -1);
    if (BEHAVIOUR[sing]) return BEHAVIOUR[sing];
  }
  for (const w of k.split(" ")) if (BEHAVIOUR[w]) return BEHAVIOUR[w];
  return null;
}

function identityOf(name, personality) {
  const lore = loreFor(name, personality);
  const id = IDENTITY[lore.arch] || IDENTITY.anchor;
  const k = String(name || "").toLowerCase().trim();
  return {
    arch: lore.arch,
    emoji: lore.e,
    title: id.title,
    tagline: TAGLINES[k] || id.tagline,
    short: id.short,
    looking: id.looking,
    secret: id.secret,
    green: id.green,
    red: id.red
  };
}

/* Average trait difference — the same idea the backend uses. */
function traitSimilarity(pa, pb) {
  const keys = Object.keys(pa);
  let diff = 0;
  keys.forEach((k) => { diff += Math.abs(pa[k] - (pb[k] || 0)); });
  return 100 - (diff / (100 * keys.length)) * 100;
}

/**
 * Compatibility between any two pool objects.
 * Blends raw personality similarity (stretched, since the raw values
 * bunch up) with how the two archetypes actually interact, plus a small
 * deterministic wobble so the pool isn't mechanical. Stable per pair.
 */
function poolCompatibility(a, b) {
  const ia = identityOf(a.object_name, a.personality);
  const ib = identityOf(b.object_name, b.personality);
  const key = [ia.arch, ib.arch].sort().join("|");
  const [bonus, punchline] = PAIR_SORTED[key] || [0, "Two entirely different problems that enjoy each other's company."];

  const similarity = displayScore(traitSimilarity(a.personality, b.personality));
  const seed = seedFrom(`${a.object_name}|${b.object_name}|${a.id}|${b.id}`);
  const wobble = (seed % 15) - 7;

  // Weighted so the archetype pairing matters more than raw trait
  // similarity, which bunches up near the top. That keeps the low,
  // funny scores reachable instead of everything reading as 80%+.
  const score = Math.max(8, Math.min(97, Math.round(similarity * 0.42 + 26 + bonus * 2.0 + wobble)));
  return { score, punchline, ia, ib };
}

/** Two-line reason built from what the objects actually do. */
function pairReason(a, b) {
  const { score, punchline, ia, ib } = poolCompatibility(a, b);
  const na = a.object_name.charAt(0).toUpperCase() + a.object_name.slice(1);
  const nb = b.object_name.charAt(0).toUpperCase() + b.object_name.slice(1);

  const ba = behaviourOf(a.object_name);
  const bb = behaviourOf(b.object_name);

  const lead = (ba && bb)
    ? `${na} ${ba}; ${nb} ${bb}.`
    : `${na} is ${ia.short}; ${nb} is ${ib.short}.`;

  return { score, text: `${lead} ${punchline}`, label: poolLabel(score) };
}

/* ═══════════════════════════════════════════
   RENDERING
   ═══════════════════════════════════════════ */

let POOL = [];          // every object, cached for the modal

function photoInto(el, obj) {
  if (!obj.image_path) return;
  const img = new Image();
  img.alt = obj.object_name;
  img.onload = () => el.replaceChildren(img);
  img.src = toStaticUrl(obj.image_path);
}

async function loadGallery() {
  const grid = $("gallery-grid");
  const empty = $("gallery-empty");
  grid.innerHTML = "";
  empty.hidden = true;

  try {
    const res = await fetch(`${API_URL}/objects`);
    if (!res.ok) throw new Error(`Backend responded ${res.status}`);
    POOL = (await res.json()).objects;

    if (!POOL.length) {
      renderEmptyPool();
      return;
    }

    POOL.forEach((obj, i) => {
      const id = identityOf(obj.object_name, obj.personality);
      const profile = buildProfile(obj.object_name, obj.personality);

      const card = document.createElement("div");
      card.className = "pool-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.style.animationDelay = Math.min(i * 45, 600) + "ms";
      card.innerHTML = `
        <span class="pc-heart">❤️</span>
        <button class="pc-del" type="button" title="Remove from the dating pool" aria-label="Remove">🗑️</button>
        <div class="pc-photo">${id.emoji}</div>
        <p class="pc-name"></p>
        <p class="pc-title"></p>
        <p class="pc-tagline"></p>
        <div class="pc-flags">
          <span class="pc-flag">❤️ <span><b>Looking for:</b> <span class="lf"></span></span></span>
          <span class="pc-flag">🚩 <span><b>Red flag:</b> <span class="rf"></span></span></span>
        </div>
        <p class="pc-peek">TAP TO SEE THE FULL PROFILE →</p>`;

      card.querySelector(".pc-name").textContent = obj.object_name;
      card.querySelector(".pc-title").textContent = id.title;
      card.querySelector(".pc-tagline").textContent = `"${id.tagline}"`;
      card.querySelector(".lf").textContent = id.looking;
      card.querySelector(".rf").textContent = profile.redFlag;
      photoInto(card.querySelector(".pc-photo"), obj);

      const open = () => openProfile(obj);
      card.addEventListener("click", open);
      card.querySelector(".pc-del").addEventListener("click", (e) => {
        e.stopPropagation();          // never open the profile behind it
        askDelete(obj, card);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });

      grid.appendChild(card);
    });

  } catch (err) {
    empty.textContent = "Nobody is here. The dating pool is unreachable right now.";
    empty.hidden = false;
    console.error("[Object Soulmate] dating pool failed:", err);
  }
}

/** Best 2-4 partners for this object. Never returns nothing. */
function potentialSoulmates(obj) {
  const others = POOL.filter((o) => o.id !== obj.id);
  if (!others.length) return [];

  const scored = others
    .map((o) => ({ obj: o, ...pairReason(obj, o) }))
    .sort((x, y) => y.score - x.score);

  // Keep the top few, but always include one lower-scoring pairing when we
  // can — the bad matches are the funny ones and they must never be hidden.
  const top = scored.slice(0, 3);
  if (scored.length > 3) top.push(scored[scored.length - 1]);
  return top;
}

function openProfile(obj) {
  initAudio();
  const id = identityOf(obj.object_name, obj.personality);
  const profile = buildProfile(obj.object_name, obj.personality);
  const nice = obj.object_name.charAt(0).toUpperCase() + obj.object_name.slice(1);

  $("pm-name").textContent = obj.object_name;
  $("pm-title").textContent = id.title;
  $("pm-tagline").textContent = `"${id.tagline}"`;
  $("pm-status").textContent = "Relationship status: Single 🥲";
  $("pm-secret").textContent = `"${id.secret(nice)}"`;

  const photo = $("pm-photo");
  photo.replaceChildren(document.createTextNode(id.emoji));
  photo.style.display = "flex";
  photo.style.alignItems = "center";
  photo.style.justifyContent = "center";
  photo.style.fontSize = "48px";
  photoInto(photo, obj);

  // personality bars, animated from zero
  const traits = $("pm-traits");
  traits.innerHTML = "";
  Object.entries(obj.personality)
    .sort((a, b) => b[1] - a[1])
    .forEach(([trait, value]) => {
      const row = document.createElement("div");
      row.className = "trait";
      row.innerHTML = `
        <span class="trait-name"></span>
        <span class="trait-val"></span>
        <div class="trait-track"><div class="trait-bar"></div></div>`;
      row.querySelector(".trait-name").textContent = trait;
      row.querySelector(".trait-val").textContent = value + "%";
      traits.appendChild(row);
      requestAnimationFrame(() => {
        setTimeout(() => { row.querySelector(".trait-bar").style.width = value + "%"; }, 80);
      });
    });

  $("pm-dossier").innerHTML = `
    <dt>Occupation</dt><dd class="d1"></dd>
    <dt>Love language</dt><dd class="d2"></dd>
    <dt>Biggest fear</dt><dd class="d3"></dd>
    <dt>Looking for</dt><dd class="d4"></dd>`;
  $("pm-dossier").querySelector(".d1").textContent = profile.occupation;
  $("pm-dossier").querySelector(".d2").textContent = profile.loveLanguage;
  $("pm-dossier").querySelector(".d3").textContent = profile.fear;
  $("pm-dossier").querySelector(".d4").textContent = id.looking;

  const greens = $("pm-green");
  const reds = $("pm-red");
  greens.innerHTML = "";
  reds.innerHTML = "";
  id.green.forEach((g) => { const li = document.createElement("li"); li.textContent = g; greens.appendChild(li); });
  id.red.forEach((r) => { const li = document.createElement("li"); li.textContent = r; reds.appendChild(li); });

  // ── potential soulmates ──
  const list = $("pm-match-list");
  const noneMsg = $("pm-match-empty");
  list.innerHTML = "";
  const matches = potentialSoulmates(obj);

  if (!matches.length) {
    noneMsg.hidden = false;
  } else {
    noneMsg.hidden = true;
    matches.forEach((m) => {
      const mid = identityOf(m.obj.object_name, m.obj.personality);
      const row = document.createElement("div");
      row.className = "match-row";
      row.innerHTML = `
        <div class="mr-photo">${mid.emoji}</div>
        <div class="mr-body">
          <div class="mr-top">
            <span class="mr-name"></span>
            <span class="mr-score"></span>
            <span class="mr-label"></span>
          </div>
          <p class="mr-why">
            <span class="why-text"></span>
            <span class="mr-type"></span>
          </p>
        </div>
        <button class="why-btn" type="button">💘 WHY YOU TWO?</button>`;

      row.querySelector(".mr-name").textContent = m.obj.object_name;
      row.querySelector(".mr-score").textContent = m.score + "%";
      row.querySelector(".mr-label").textContent = m.label;
      row.querySelector(".why-text").textContent = `"${m.text}"`;
      row.querySelector(".mr-type").textContent = `RELATIONSHIP TYPE — ${m.label}`;
      photoInto(row.querySelector(".mr-photo"), m.obj);

      const btn = row.querySelector(".why-btn");
      btn.addEventListener("click", () => {
        const open = row.classList.toggle("open");
        btn.textContent = open ? "▲ HIDE" : "💘 WHY YOU TWO?";
        if (open) note(660, 0, 0.1, "triangle", 0.07);
      });

      list.appendChild(row);
    });
  }

  $("profile-modal").hidden = false;
  document.body.style.overflow = "hidden";
  $("pm-close").focus();
  note(880, 0, 0.1, "triangle", 0.06);
}

function closeProfile() {
  $("profile-modal").hidden = true;
  document.body.style.overflow = "";
}

$("pm-close").addEventListener("click", closeProfile);
$("profile-modal").addEventListener("click", (e) => {
  if (e.target === $("profile-modal")) closeProfile();   // click the backdrop
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("profile-modal").hidden) closeProfile();
});

/* ═══════════════════════════════════════════
   ABOUT — usefulness meter
   ═══════════════════════════════════════════ */

function animateUsefulness() {
  const fill = $("um-fill");
  fill.style.width = "0%";
  setTimeout(() => { fill.style.width = "0.3%"; }, 250);
}

/* ═══════════════════════════════════════════
   BOOT — live object count on the hero
   ═══════════════════════════════════════════ */

/** Ping the backend. Shows a banner when it's down so a silent failure
    never looks like "the page is broken". */
async function checkBackend(attempts = 2) {
  const bar = $("offline-bar");
  $("ob-url").textContent = API_URL;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${API_URL}/objects`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const { objects } = await res.json();
      $("stat-objects").textContent = objects.length;
      bar.hidden = true;
      return true;
    } catch (err) {
      // The first request right after page load sometimes loses a race with
      // a backend that is still warming up. Give it one more go before
      // telling the user anything is wrong.
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      $("stat-objects").textContent = "—";
      bar.hidden = false;
      console.error("[Object Soulmate] backend unreachable at", API_URL, err);
      return false;
    }
  }
  return false;
}

$("ob-retry").addEventListener("click", async () => {
  const btn = $("ob-retry");
  btn.textContent = "Checking…";
  const ok = await checkBackend(1);
  btn.textContent = "Retry";
  if (ok) console.log("[Object Soulmate] backend is up.");
});

checkBackend();

updateAnalyzeState();

/* ═══════════════════════════════════════════
   DATING POOL MANAGEMENT
   Delete a profile (with a confirmation the object
   would object to), plus toast notifications and the
   empty-pool state. The backend owns the actual
   deletion; this only presents it.
   ═══════════════════════════════════════════ */

/* Object-specific goodbyes. Anything not listed falls back to archetype. */
const FAREWELL = {
  banana: "Banana has been through enough. Are you sure?",
  spoon: "Spoon will make a lot of noise about this.",
  chair: "Chair has supported everyone. Maybe give it another chance?",
  brick: "Brick has no feelings. Probably.",
  broom: "Broom cleaned up after everyone and this is how it ends?",
  cup: "Cup has listened to all your problems. This seems harsh.",
  keyboard: "Keyboard has taken enough hits already.",
  shoe: "Shoe was going to leave anyway.",
  book: "Book saw this coming and wrote it down.",
  teddy: "Teddy has absorbed years of crying. Think carefully.",
  sock: "Sock was going to disappear on its own eventually.",
  pen: "Pen was running out anyway.",
  laptop: "Laptop has 47 tabs of unfinished business. Closing all of them?",
  plant: "Plant will not survive being ignored. That is the whole point of Plant.",
  mirror: "Mirror will take this personally. Mirror takes everything personally.",
  candle: "Candle was burning itself down for you specifically."
};

const FAREWELL_BY_ARCH = {
  chaos: (n) => `${n} is going to be extremely loud about this.`,
  anchor: (n) => `${n} has held everything together. Are you sure?`,
  worker: (n) => `${n} never took a day off and this is the thanks it gets.`,
  fragile: (n) => `${n} will not take this well. At all.`,
  vain: (n) => `${n} assumed it would be the one doing the leaving.`,
  intellect: (n) => `${n} will say nothing and remember everything.`,
  menace: (n) => `${n} caused problems, yes. But it was never boring.`,
  comfort: (n) => `${n} has been there for everyone. Removing it anyway?`
};

function farewellLine(name, personality) {
  const k = String(name || "").toLowerCase().trim();
  if (FAREWELL[k]) return FAREWELL[k];
  const lore = loreFor(name, personality);
  const nice = name.charAt(0).toUpperCase() + name.slice(1);
  return (FAREWELL_BY_ARCH[lore.arch] || FAREWELL_BY_ARCH.anchor)(nice);
}

/* ── toast ── */

function toast(message, kind) {
  const host = $("toast-host");
  const el = document.createElement("div");
  el.className = "toast" + (kind ? " " + kind : "");
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 350);
  }, 3400);
}

/* ── confirmation ── */

let pendingDelete = null;   // { obj, card }

function askDelete(obj, card) {
  initAudio();
  pendingDelete = { obj, card };
  const nice = obj.object_name.charAt(0).toUpperCase() + obj.object_name.slice(1);

  $("cf-title").textContent = "DELETE THIS OBJECT?";
  $("cf-lead").textContent =
    `Are you sure you want to remove ${nice} from the dating pool?`;
  $("cf-flavour").textContent = `"${farewellLine(obj.object_name, obj.personality)}"`;

  const modal = $("confirm-modal");
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  $("cf-cancel").focus();
}

function closeConfirm() {
  $("confirm-modal").hidden = true;
  pendingDelete = null;
  // the profile modal may still be open underneath
  if ($("profile-modal").hidden) document.body.style.overflow = "";
}

async function confirmDelete() {
  if (!pendingDelete) return;
  const { obj, card } = pendingDelete;
  const btn = $("cf-confirm");
  btn.disabled = true;
  btn.textContent = "Removing…";

  try {
    const res = await fetch(`${API_URL}/objects/${obj.id}`, { method: "DELETE" });

    if (res.status === 404) {
      toast("That object had already left the pool.", "warn");
    } else if (!res.ok) {
      throw new Error(`Backend responded ${res.status}`);
    } else {
      const data = await res.json();
      toast("🗑️ " + (data.message || `${obj.object_name} has left the dating pool.`));
      note(330, 0, 0.14, "triangle", 0.06);
    }

    // Drop it from the cached pool so it can never be offered as a
    // candidate again, and take the card out without a page reload.
    POOL = POOL.filter((o) => o.id !== obj.id);
    if (card) {
      card.classList.add("removing");
      setTimeout(() => {
        card.remove();
        if (!POOL.length) renderEmptyPool();
      }, 320);
    }
    // if the profile modal was showing this object, close it
    if (!$("profile-modal").hidden) closeProfile();

  } catch (err) {
    console.error("[Object Soulmate] delete failed:", err);
    toast("The breakup failed. The object refuses to leave.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "🗑️ Remove Forever";
    closeConfirm();
  }
}

$("cf-cancel").addEventListener("click", closeConfirm);
$("cf-confirm").addEventListener("click", confirmDelete);
$("confirm-modal").addEventListener("click", (e) => {
  if (e.target === $("confirm-modal")) closeConfirm();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("confirm-modal").hidden) closeConfirm();
});

/* ── empty pool ── */

function renderEmptyPool() {
  const grid = $("gallery-grid");
  const empty = $("gallery-empty");
  grid.innerHTML = "";
  empty.hidden = false;
  empty.innerHTML = `
    <span class="es-big">😭 THE DATING POOL IS EMPTY</span>
    <span class="es-line">"Congratulations. You have successfully destroyed everyone's love life."</span>
    <button class="cta es-cta" type="button" id="es-add">
      <span class="cta-inner">📷 ADD AN OBJECT</span>
    </button>`;
  $("es-add").addEventListener("click", () => showScreen("upload"));
}
