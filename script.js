//  CATCHING BONES — Physics Edition
//  This game demonstrates real physics concepts using falling bones on different planets.  Each planet has its own gravity value derived from Newton's law of gravitation (g = GM/r²), so the bone falls at a different speed on every level.
//
// Physics concepts shown:
// Newton's 2nd Law: F = m * a
// Kinematics: v = u + a*t  (velocity builds each frame)
// Inelastic bounce: v_after = -e * v_before  (energy lost on impact)
// Orbital gravity: g = GM / r²  (each planet's real surface gravity)
// 


//  PLANET DATA
//
//  Each planet has a real surface gravity g (m/s²).
//  The formula g = GM/r² comes from Newton's law of gravitation:
//    G = gravitational constant  (6.674 × 10⁻¹¹ N·m²/kg²)
//    M = planet mass (kg)
//    r = planet radius (m)
//  A larger or denser planet has stronger g, so the bone falls faster.
// -------------------------------------------------------------
const PLANETS = [
  { name: "Mercury", g: 3.7,   bg: '#d9d9d9', emoji: '☿' },
  { name: "Venus",   g: 8.87,  bg: '#f5e6c8', emoji: '♀' },
  { name: "Earth",   g: 9.81,  bg: '#d9edf8', emoji: '🌍' },
  { name: "Mars",    g: 3.72,  bg: '#f4c09a', emoji: '♂' },
  { name: "Jupiter", g: 24.8,  bg: '#f7e0b0', emoji: '♃' },
  { name: "Saturn",  g: 10.4,  bg: '#fdf6d0', emoji: '♄' },
  { name: "Uranus",  g: 8.87,  bg: '#d0f5f5', emoji: '⛢' },
  { name: "Neptune", g: 11.15, bg: '#c9d9f7', emoji: '♆' },
];


// -------------------------------------------------------------
//  PHYSICS SCALE
//
//  The screen is measured in pixels but physics equations use
//  metres and seconds.  SCALE (50 px/m) converts between them.
//  DT is the time step per frame — at 60 FPS each frame is
//  1/60 of a second.  Multiplying g by SCALE and DT² gives the
//  correct pixel-per-frame² acceleration.
// -------------------------------------------------------------
const SCALE = 50;        // 1 metre = 50 pixels
const FPS   = 60;
const DT    = 1 / FPS;  // ~0.0167 seconds per frame


// -------------------------------------------------------------
//  BONE PHYSICS CONSTANTS
//
//  BONE_MASS (0.5 kg)
//    We need mass to calculate force.  Newton's 2nd Law says
//    F = m * a.  Gravity accelerates all objects equally (a = g),
//    but the FORCE acting on the bone still depends on its mass —
//    a heavier bone is pushed down harder.  We track mass so the
//    HUD can show F = 0.5 * g and you can explain to your
//    professor that force and acceleration are different things.
//    On Jupiter (g = 24.8 m/s²) the force on a 0.5 kg bone is
//    F = 0.5 × 24.8 = 12.4 N — compared to only 4.9 N on Earth.
//
//  BOUNCE_COEF (0.55) — coefficient of restitution
//    When the bone hits the floor, not all kinetic energy converts
//    back to motion — some is lost as heat, sound, and deformation.
//    The coefficient of restitution (e) models that loss:
//      v_after = -e × v_before
//    e = 1.0 → perfect elastic bounce (no energy lost, unrealistic)
//    e = 0.0 → the bone sticks on impact (totally inelastic)
//    e = 0.55 means the bone bounces back at 55% of impact speed,
//    losing 45% of its kinetic energy each time it hits the floor.
//
//  FLOOR_STOP (2.5 px/frame)
//    Once bounce speed drops below this the bone is "at rest."
//    Raised well above zero because on high-gravity planets like
//    Jupiter, gravity re-accelerates the bone so fast that a low
//    threshold (e.g. 0.6) would cause endless micro-bouncing —
//    the bone bounces up 1 pixel, gravity pulls it back down, repeat.
//
//  MAX_FLOOR_HITS (4)
//    A secondary safety check.  If the bone contacts the floor
//    4 times in quick succession without gaining real height,
//    it is force-settled regardless of speed.  This completely
//    eliminates the jitter loop seen on Jupiter's level.
// -------------------------------------------------------------
const BONE_MASS      = 0.5;   // kg — for F = m*a
const DOG_MASS       = 5.0;   // kg — the dog is 10x heavier than the bone.
                               // Used in the impulse formula: the bigger the
                               // mass ratio (DOG_MASS / BONE_MASS), the harder
                               // the dog knocks the bone when it runs into it.
const BOUNCE_COEF    = 0.55;  // coefficient of restitution
const FLOOR_STOP     = 2.5;   // px/frame settle threshold
const MAX_FLOOR_HITS = 4;     // force-settle after this many rapid contacts


// -------------------------------------------------------------
//  LEVEL / SCORING
// -------------------------------------------------------------
const SCORE_PER_LEVEL = 5;
const TOTAL_LEVELS    = PLANETS.length;
const WIN_SCORE       = TOTAL_LEVELS * SCORE_PER_LEVEL; // 40


// -------------------------------------------------------------
//  GAME STATE
//  Variables that change while the game is running.
// -------------------------------------------------------------
let catcher, fallingBone;
let score       = 0;
let misses      = 0;
let screen      = 0;        // 0=home  1=play  2=win  3=lose
let planetIndex = 0;

let deadBones      = [];    // bones settled on the floor
let boneHasBounced = false; // true once the active bone has bounced
let floorHitCount  = 0;     // rapid floor contacts — anti-jitter counter

let levelStartTime = 0;     // millis() when the current level started
let catchTimes     = [];    // timestamps of each successful catch
let lastVelY       = 0;     // previous-frame velocity (to display live acceleration)

let playButton, retryButton;
let boneImg, dog2Img;


// -------------------------------------------------------------
//  PRELOAD
//  p5.js calls this before setup().
//  All images must be loaded here — they are not ready until
//  this function finishes.
// -------------------------------------------------------------
function preload() {
  dog2Img = loadImage("assets/dog2.png");
  boneImg = loadImage('assets/bone.png');
  console.log("[PRELOAD] Images loaded.");
}


// -------------------------------------------------------------
//  SETUP
//  Runs once on page load.  Creates the canvas, sprites, buttons.
//  Nothing moves yet — motion happens inside draw().
// -------------------------------------------------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(FPS);

  boneImg.resize(60, 0);
  dog2Img.resize(50, 0);

  // 'k' = kinematic sprite — we set its velocity ourselves each frame
  // instead of letting the physics engine handle it.  This is needed
  // because each planet has a custom gravity value.
  catcher = new Sprite(dog2Img, width / 2, height - 60, 110, 22, 'k');

  fallingBone = new Sprite(boneImg, width / 2, -60, 14);
  fallingBone.vel.y        = 0;
  fallingBone.rotationLock = true;
  fallingBone.collider     = 'k';

  playButton  = createUISprite(width / 2, height / 2 + 110, 120, 55, "PLAY",  '#7c4dff', 20);
  retryButton = createUISprite(-300, -300, 130, 55, "RETRY", '#ffffff', 18);
  retryButton.textColor = '#333';

  console.log("[SETUP] Canvas:", width, "x", height);
  console.log("[SETUP] Win score:", WIN_SCORE, "| Levels:", TOTAL_LEVELS);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  console.log("[RESIZE]", windowWidth, "x", windowHeight);
}


// -------------------------------------------------------------
//  DRAW  (~60 times per second)
//
//  Main game loop.  Each frame it:
//    1. Routes to the correct screen (home / play / win / lose)
//    2. Applies gravity and reads player input
//    3. Handles floor bouncing and bone catching
//    4. Checks win/lose conditions and level transitions
//    5. Draws the HUD on top of everything
// -------------------------------------------------------------
function draw() {

  if (screen === 0) {
    drawHomeScreen();
    hoverCursor(playButton);
    if (playButton.mouse.presses()) startGame();
    return;
  }
  if (screen === 2) {
    drawWinScreen();
    hoverCursor(retryButton);
    if (retryButton.mouse.presses()) resetGame();
    return;
  }
  if (screen === 3) {
    drawLoseScreen();
    hoverCursor(retryButton);
    if (retryButton.mouse.presses()) resetGame();
    return;
  }

  // --- GAMEPLAY ---
  const planet = PLANETS[planetIndex];
  background(planet.bg);

  for (let db of deadBones) drawDeadBone(db);

  applyGravity(planet.g);
  moveCatcher();

  if (fallingBone.y >= height - 10) handleFloorBounce(planet.g);
  if (rectsOverlap(fallingBone, catcher)) handleCatch(planet);

  applyDogPushToBones();
  simulateDeadBones();

  if (misses >= 5)        { triggerLose(); return; }
  if (score >= WIN_SCORE) { triggerWin();  return; }

  let newIdx = Math.floor(score / SCORE_PER_LEVEL);
  if (newIdx !== planetIndex && newIdx < TOTAL_LEVELS) changePlanet(newIdx);

  drawHUD(planet);
}


// =============================================================
//  PHYSICS
// =============================================================

// -------------------------------------------------------------
//  applyGravity
//
//  Applies Newton's 2nd Law to the bone every frame.
//  Since the only force is gravity: F = m*g, and a = F/m = g.
//
//  We convert g (m/s²) to pixels per frame² with:
//    a_px = g × SCALE × DT²
//
//  Then we add that to vel.y so the bone speeds up as it falls:
//    v_new = v_old + a_px    (kinematic equation: v = u + at)
//
//  p5play automatically moves the sprite by vel each frame,
//  so we only need to update the velocity here.
// -------------------------------------------------------------
function applyGravity(g_mps2) {
  let a_px = g_mps2 * SCALE * DT * DT;
  lastVelY = fallingBone.vel.y;
  fallingBone.vel.y += a_px;
  fallingBone.vel.y  = min(fallingBone.vel.y, 40); // cap so it stays catchable
}


// -------------------------------------------------------------
//  handleFloorBounce
//
//  Called every frame the bone is at or below the floor line.
//  Applies the inelastic bounce formula:
//    v_after = -BOUNCE_COEF × v_before
//
//  The negative sign flips direction (now moving upward).
//  Multiplying by 0.55 removes 45% of the speed — energy lost
//  to the collision.  After enough bounces the speed falls below
//  FLOOR_STOP (or MAX_FLOOR_HITS is reached) and the bone settles.
//
//  boneHasBounced stays true between bounces so the player can
//  still catch the bone while it is in mid-air after a bounce.
// -------------------------------------------------------------
function handleFloorBounce(g_mps2) {
  fallingBone.y = height - 10;
  let speed = abs(fallingBone.vel.y);
  floorHitCount++;

  if (speed < FLOOR_STOP || floorHitCount >= MAX_FLOOR_HITS) {
    // Not enough energy left — bone comes to rest, counts as a miss
    fallingBone.vel.y = 0;
    fallingBone.vel.x = 0;
    deadBones.push({ x: fallingBone.x, y: height - 18,
                     img: boneImg, vx: 0, vy: 0, settled: true });
    misses++;
    boneHasBounced = false;
    floorHitCount  = 0;
    console.log(`[MISS] Bone settled. speed=${speed.toFixed(2)} hits=${floorHitCount}. Misses: ${misses}`);
    respawnBone(g_mps2);
  } else {
    // Still has energy — flip velocity upward and reduce by bounce coefficient
    fallingBone.vel.y = -speed * BOUNCE_COEF;
    boneHasBounced    = true;
    let v_ms = (abs(fallingBone.vel.y) / (SCALE * DT)).toFixed(2);
    console.log(`[BOUNCE #${floorHitCount}] v_after=${v_ms} m/s  (e=${BOUNCE_COEF}) — still catchable!`);
  }
}


// -------------------------------------------------------------
//  handleCatch
//  Scores a point and logs all live physics values to the terminal.
// -------------------------------------------------------------
function handleCatch(planet) {
  score++;
  catchTimes.push(millis());

  let type = boneHasBounced ? "BOUNCE CATCH" : "DIRECT CATCH";
  let v_ms = (abs(fallingBone.vel.y) / (SCALE * DT)).toFixed(2);
  let F_N  = (BONE_MASS * planet.g).toFixed(2);

  console.log(`── [${type} #${score}] ─────────────────`);
  console.log(`  Planet   : ${planet.name}  g=${planet.g} m/s²`);
  console.log(`  Velocity : ${v_ms} m/s at catch`);
  console.log(`  Force    : F = ${BONE_MASS}kg × ${planet.g} = ${F_N} N`);
  console.log(`  Score    : ${score}/${WIN_SCORE}   Misses: ${misses}/5`);
  console.log(`──────────────────────────────────────`);

  boneHasBounced = false;
  respawnBone(planet.g);
}


// -------------------------------------------------------------
//  respawnBone
//  Resets the bone to a new random position above the screen.
//  Starts with a tiny downward nudge so gravity has something
//  to build on from the very first frame.
// -------------------------------------------------------------
function respawnBone(g_mps2) {
  fallingBone.x     = random(80, width - 80);
  fallingBone.y     = -50;
  fallingBone.vel.y = 0.3 * SCALE * DT;
  fallingBone.vel.x = 0;
  boneHasBounced    = false;
  floorHitCount     = 0;
}


// =============================================================
//  PLAYER & INTERACTION
// =============================================================

// -------------------------------------------------------------
//  moveCatcher
//  Arrow keys set the dog's horizontal velocity.
//  constrain() prevents the dog from sliding off screen edges.
// -------------------------------------------------------------
function moveCatcher() {
  if      (kb.pressing("left"))  catcher.vel.x = -9;
  else if (kb.pressing("right")) catcher.vel.x =  9;
  else                           catcher.vel.x =  0;
  catcher.x = constrain(catcher.x, catcher.w / 2, width - catcher.w / 2);
}


// -------------------------------------------------------------
//  applyDogPushToBones
//
//  When the dog runs close to a settled bone it gets an impulse —
//  a brief force applied in the direction away from the dog.
//  This models Newton's 3rd Law: every action has an equal and
//  opposite reaction.  The dog pushes the bone, the bone moves.
//
//  Impulse strength = dogSpeed × 2.5 × (1 − dist/pushRadius)
//  Closer distance and higher dog speed = stronger push.
// -------------------------------------------------------------
function applyDogPushToBones() {
  for (let db of deadBones) {
    if (!db.settled) continue;
    let dx   = db.x - catcher.x;
    let dy   = db.y - catcher.y;
    let dist = sqrt(dx * dx + dy * dy);
    let pushRadius = catcher.w * 0.85;
    if (dist < pushRadius && dist > 0) {
      let dogSpeed = abs(catcher.vel.x);
      let dir      = dx / dist;
      // Real momentum transfer: p = m*v
      // The impulse the bone receives scales with the mass ratio —
      // a 5 kg dog hitting a 0.5 kg bone passes 10x its speed as force.
      let impulse  = (DOG_MASS / BONE_MASS) * dogSpeed * (1 - dist / pushRadius);
      db.vx     += dir * impulse;
      db.vy      = -2.5;
      db.settled = false;
      console.log(`[PUSH] Bone at (${db.x.toFixed(0)},${db.y.toFixed(0)}) impulse=${impulse.toFixed(2)} (DOG_MASS=${DOG_MASS}kg / BONE_MASS=${BONE_MASS}kg)`);
    }
  }
}


// -------------------------------------------------------------
//  simulateDeadBones
//
//  Bones on the floor still follow gravity and friction after
//  being pushed.  We apply a reduced gravity fraction each frame,
//  then use the same bounce coefficient (at 40% strength) when
//  they hit the floor again, plus horizontal friction so they
//  slow down and come to rest naturally.
// -------------------------------------------------------------
function simulateDeadBones() {
  for (let db of deadBones) {
    if (db.settled) continue;
    db.vy += PLANETS[planetIndex].g * SCALE * DT * DT * 0.6;
    db.x  += db.vx;
    db.y  += db.vy;
    if (db.y >= height - 18) {
      db.y   = height - 18;
      db.vy *= -BOUNCE_COEF * 0.4;
      db.vx *= 0.78;
      if (abs(db.vy) < 0.3 && abs(db.vx) < 0.2) {
        db.vy = 0; db.vx = 0; db.settled = true;
      }
    }
    if (db.x < 20)         { db.x = 20;          db.vx =  abs(db.vx) * 0.5; }
    if (db.x > width - 20) { db.x = width - 20;  db.vx = -abs(db.vx) * 0.5; }
  }
}


// =============================================================
//  GAME STATE
// =============================================================

function changePlanet(newIdx) {
  let prev = PLANETS[planetIndex];
  let next = PLANETS[newIdx];
  planetIndex    = newIdx;
  levelStartTime = millis();
  catchTimes     = [];
  console.log(`\n[LEVEL ${newIdx + 1}] ${prev.name} g=${prev.g} → ${next.name} g=${next.g} m/s² (g=GM/r²)\n`);
  respawnBone(next.g);
}

function startGame() {
  screen         = 1;
  planetIndex    = 0;
  levelStartTime = millis();
  playButton.pos = { x: -300, y: -300 };
  respawnBone(PLANETS[0].g);
  console.log("[START] Planet:", PLANETS[0].name);
}

function triggerWin() {
  screen = 2;
  retryButton.pos = { x: -300, y: -300 }; // drawWinScreen positions it
  catcher.pos     = { x: -300, y: -300 };
  fallingBone.pos = { x: -300, y: -300 };
  console.log("[WIN] Final score:", score);
}

function triggerLose() {
  screen = 3;
  retryButton.pos = { x: -300, y: -300 }; // drawLoseScreen positions it
  catcher.pos     = { x: -300, y: -300 };
  fallingBone.pos = { x: -300, y: -300 };
  console.log("[LOSE] Misses:", misses, "Score:", score);
}

function resetGame() {
  score          = 0;
  misses         = 0;
  planetIndex    = 0;
  screen         = 1;
  deadBones      = [];
  catchTimes     = [];
  boneHasBounced = false;
  floorHitCount  = 0;
  levelStartTime = millis();
  catcher.pos    = { x: width / 2, y: height - 60 };
  catcher.vel.x  = 0;
  retryButton.pos = { x: -300, y: -300 };
  respawnBone(PLANETS[0].g);
  console.log("[RESET] Back to Level 1 —", PLANETS[0].name);
}


// =============================================================
//  HUD  (drawn every gameplay frame on top of everything)
// =============================================================

// -------------------------------------------------------------
//  drawHUD
//
//  Left panel  — game info: planet, level, score, misses, timer
//  Right panel — live physics values updated every frame
//
//  Panel heights are now calculated from the number of text rows
//  so the dark background always fits the text tightly —
//  both panels use the same row count so they match in height.
// -------------------------------------------------------------
function drawHUD(planet) {
  let elapsed    = ((millis() - levelStartTime) / 1000).toFixed(1);
  let v_ms       = (fallingBone.vel.y / (SCALE * DT)).toFixed(2);
  let a_ms2      = planet.g.toFixed(2);
  let F_N        = (BONE_MASS * planet.g).toFixed(2);
  let levelScore = score - planetIndex * SCORE_PER_LEVEL;

  noStroke();
  textSize(14);
  textAlign(LEFT, TOP);

  let ls = 21;   // pixels between text rows
  let rows = 6;    // both panels have exactly 6 rows
  let panelH = 14 + rows * ls;  // background height matches text height
  let padX = 10;   // gap from sprite text to panel edge

  // Left panel
  fill(0, 0, 0, 120);
  rect(10, 10, 250, panelH, 10);
  fill(255);
  let lx = 20, ly = 18;
  text(`${planet.emoji}  Planet: ${planet.name}`,           lx, ly);
  text(`Level: ${planetIndex + 1} / ${TOTAL_LEVELS}`,       lx, ly + ls);
  text(`Score: ${score} / ${WIN_SCORE}`,                    lx, ly + ls * 2);
  text(`Level catches: ${levelScore} / ${SCORE_PER_LEVEL}`, lx, ly + ls * 3);
  text(`Misses: ${misses} / 5`,                             lx, ly + ls * 4);
  text(`⏱ Level time: ${elapsed} s`,                       lx, ly + ls * 5);

  // Right panel
  fill(0, 0, 0, 120);
  rect(width - 260, 10, 250, panelH, 10);
  fill(255);
  let rx = width - 248, ry = 18;
  text(`⚡ Physics`,                            rx, ry);
  text(`g = ${a_ms2} m/s²`,                    rx, ry + ls);
  text(`v = ${v_ms} m/s (downward)`,           rx, ry + ls * 2);
  text(`F = ${F_N} N  (${BONE_MASS}kg × g)`,   rx, ry + ls * 3);
  text(`e = ${BOUNCE_COEF} (bounce coeff)`,     rx, ry + ls * 4);
  text(`g = GM/r² (orbital law)`,              rx, ry + ls * 5);

  // Arrow key reminder at the bottom center
  fill(0, 0, 0, 90);
  rect(width / 2 - 90, height - 40, 180, 28, 6);
  fill(255);
  textSize(12);
  textAlign(CENTER);
  text("← → Arrow keys to move", width / 2, height - 28);
  textAlign(LEFT, BASELINE);
}


// =============================================================
//  SCREEN RENDERERS
// =============================================================

// -------------------------------------------------------------
//  drawHomeScreen
//
//  Title and how-to-play text are centred at the top.
//  Below that: two side-by-side panels.
//    Left  → planet gravity reference table
//    Right → physics explanation (gravity, force, velocity, bounce)
//  The dark backgrounds are sized to tightly fit the content.
//  Play button is centred below both panels.
// -------------------------------------------------------------
function drawHomeScreen() {
  background('#dcd0ea');
  textStyle(NORMAL);
  noStroke();

  // Title
  fill('#4a0080');
  textAlign(CENTER);
  textSize(40);
  textStyle(BOLD);
  text("🦴 Catching Bones! — Physics Edition", width / 2, height / 2 - 320);
  textStyle(NORMAL);

  // How to play
  let mx = width / 2;
  let my = height / 2 - 275;
  let ls = 19;

  fill('#4a0080');
  textSize(14);
  textStyle(BOLD);
  text("— HOW TO PLAY —", mx, my);
  textStyle(NORMAL);
  fill('#222');
  textSize(13);
  text("Use the ← → arrow keys to slide the dog left and right.", mx, my + ls);
  text("Catch falling bones before they hit the ground. Miss 5 and it's over.", mx, my + ls * 2);
  text(`Catch ${SCORE_PER_LEVEL} bones to advance to the next planet. Catch all ${WIN_SCORE} to win!`, mx, my + ls * 3);
  text("Dead bones stay on the floor — the dog can knock them around!", mx, my + ls * 4);
  text("Bones that bounce off the floor can still be caught for a point!", mx, my + ls * 5);

  // Two-column layout
  let colTop  = my + ls * 7;
  let leftCX  = width * 0.25;
  let rightCX = width * 0.75;
  let colW    = width * 0.42;
  let rowH    = ls + 3;

  // Left column: header (2 rows) + one row per planet
  let leftRows = 2 + PLANETS.length;
  let leftColH = leftRows * rowH + 16;

  // Define sections data first so we can compute the right panel height
  let sections = [
    {
      title: "🌍  GRAVITY  (g, m/s²)",
      lines: ["Each planet pulls the bone down at a different rate.",
              "g = GM/r²  — depends on planet mass and radius."]
    },
    {
      title: "⚡  FORCE  F = m × a  (Newtons)",
      lines: ["Bone mass = 0.5 kg.  F = 0.5 × g each second.",
              "More gravity → bigger force → faster acceleration."]
    },
    {
      title: "📈  VELOCITY  v = u + a·t",
      lines: ["Starts near zero, grows every frame (Δt = 1/60 s).",
              "The HUD shows live speed in m/s as it falls."]
    },
    {
      title: "🔁  BOUNCE  e = 0.55",
      lines: ["v_after = −0.55 × v_before  (inelastic collision).",
              "45% of speed lost each hit. Catchable mid-bounce!"]
    }
  ];

  // Left panel background
  fill(30, 0, 60, 130);
  rect(leftCX - colW / 2, colTop - 14, colW, leftColH, 8);

  // Left: Planet gravity table
  textAlign(CENTER);
  fill('#dab0ff');
  textSize(13);
  textStyle(BOLD);
  text("🪐  Planet Gravity Reference", leftCX, colTop + 2);
  text("g = GM / r²", leftCX, colTop + rowH);
  textStyle(NORMAL);
  fill(255);
  textSize(12);
  for (let i = 0; i < PLANETS.length; i++) {
    let p = PLANETS[i];
    text(`${p.emoji}  ${p.name}   —   g = ${p.g.toFixed(2)} m/s²`,
         leftCX, colTop + rowH * 2 + i * rowH);
  }

  // Right: Physics explanations
  // Each section = 1 title + 2 body lines + 1 gap.
  // Compute layout FIRST so we can draw the background to the right size.
  let lineH = 13;   // pixels between lines within a section
  let gapH = 12;   // extra space between sections
  let sectionBlock = lineH * 3 + gapH;  // total height one section occupies
  let physHeaderH  = rowH * 1.3;        // space for "The Physics" header
  let startY = colTop + physHeaderH; // y where first section begins

  // True right panel height: header + all sections + small bottom pad
  let rightColH = physHeaderH + sections.length * sectionBlock + 18;

  // Draw right panel background now that we know the true height
  fill(0, 30, 60, 130);
  rect(rightCX - colW / 2, colTop - 14, colW, rightColH, 8);

  // Draw "The Physics" header
  textAlign(CENTER);
  fill('#a0d4ff');
  textSize(13);
  textStyle(BOLD);
  text("⚡  The Physics", rightCX, colTop + 2);
  textStyle(NORMAL);
  fill(255);
  textSize(12);

  // Draw each section with explicit positions — no compression
  for (let s = 0; s < sections.length; s++) {
    let sy = startY + s * sectionBlock;
    fill('#ffe08a');
    textStyle(BOLD);
    text(sections[s].title, rightCX, sy);
    textStyle(NORMAL);
    fill(255);
    for (let l = 0; l < sections[s].lines.length; l++) {
      text(sections[s].lines[l], rightCX, sy + lineH * (l + 1));
    }
  }

  // Play button centred below both panels
  let btnY = colTop + leftColH + 40;
  playButton.pos = { x: mx, y: btnY };

  textAlign(LEFT, BASELINE);
  textStyle(NORMAL);
}


// -------------------------------------------------------------
//  drawWinScreen
//  Retry button is placed just below the last line of text.
// -------------------------------------------------------------
function drawWinScreen() {
  background('#77dd77');
  textAlign(CENTER);
  noStroke();

  fill('#003300');
  textSize(52);
  textStyle(BOLD);
  text("🏆 YOU WIN!", width / 2, height / 2 - 80);
  textStyle(NORMAL);

  fill('#004400');
  textSize(20);
  text(`You caught all ${WIN_SCORE} bones across ${TOTAL_LEVELS} planets!`, width / 2, height / 2 - 28);

  fill('#003300');
  textSize(16);
  text("You experienced gravity from Mercury all the way to Neptune.", width / 2, height / 2 + 6);
  text("Newton's 2nd Law, kinematics, and bounces — all in one game.", width / 2, height / 2 + 27);

  fill('#005500');
  textSize(14);
  let lastY = height / 2 + 54;
  text("Press RETRY to play again from Level 1.", width / 2, lastY);

  // Retry button sits just below the last text line
  retryButton.pos = { x: width / 2, y: lastY + 38 };

  textAlign(LEFT, BASELINE);
}


// -------------------------------------------------------------
//  drawLoseScreen
//  Skull replaced with sad face emoji.
//  Retry button is placed just below the last line of text.
// -------------------------------------------------------------
function drawLoseScreen() {
  background('#b30000');
  textAlign(CENTER);
  noStroke();

  fill('#ffffff');
  textSize(52);
  textStyle(BOLD);
  text("😢 YOU LOSE!", width / 2, height / 2 - 80);
  textStyle(NORMAL);

  fill('#ffe0e0');
  textSize(20);
  text("You missed 5 bones — gravity won this round.", width / 2, height / 2 - 28);

  textSize(16);
  text(`You caught ${score} out of ${WIN_SCORE} bones.`, width / 2, height / 2 + 6);
  text(`You reached: ${PLANETS[planetIndex].emoji} ${PLANETS[planetIndex].name}  (Level ${planetIndex + 1}).`, width / 2, height / 2 + 28);

  fill('#ffcccc');
  textSize(14);
  text("Higher planet gravity = faster fall. Try catching early!", width / 2, height / 2 + 56);
  let lastY = height / 2 + 76;
  text("Press RETRY to try again from Level 1.", width / 2, lastY);

  // Retry button sits just below the last text line
  retryButton.pos = { x: width / 2, y: lastY + 38 };

  textAlign(LEFT, BASELINE);
}


// =============================================================
//  HELPERS
// =============================================================

// Creates a coloured rectangle sprite — used for buttons
function createUISprite(x, y, w, h, label, col, tSize) {
  let s      = new Sprite(x, y);
  s.w        = w;
  s.h        = h;
  s.collider = 'k';
  s.color    = col;
  s.text     = label;
  s.textSize = tSize;
  return s;
}

// Shows a pointer cursor when the mouse hovers a button
function hoverCursor(btn) {
  cursor(btn.mouse.hovering() ? 'pointer' : 'default');
}

// Draws a dead bone image at its stored position
function drawDeadBone(db) {
  imageMode(CENTER);
  image(db.img, db.x, db.y);
  imageMode(CORNER);
}

// -------------------------------------------------------------
//  rectsOverlap  (manual AABB collision)
//
//  p5play's .collides() only works when at least one sprite is
//  dynamic.  Both the catcher and the bone are kinematic ('k'),
//  so we check manually using AABB (Axis-Aligned Bounding Box).
//
//  Two rectangles overlap when:
//    horizontal distance < sum of half-widths  AND
//    vertical distance   < sum of half-heights
// -------------------------------------------------------------
function rectsOverlap(a, b) {
  let aHW = (a.w || 60)  / 2;
  let aHH = (a.h || 20)  / 2;
  let bHW = (b.w || 110) / 2;
  let bHH = (b.h || 22)  / 2;
  return abs(a.x - b.x) < aHW + bHW &&
         abs(a.y - b.y) < aHH + bHH;
}
