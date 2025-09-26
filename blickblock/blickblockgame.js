/* ==================================================
   Textured, Fully-Responsive Tetris (No backend)
   Board has background image; pieces use textures.
   ================================================== */

// ---------- Config ----------
const COLS = 10;
const ROWS = 20;

// DOM refs
const wrapper = document.getElementById('game-wrapper');
const gameEl  = document.getElementById('game');
const canvas  = document.getElementById('board');
const ctx     = canvas.getContext('2d');

const nextCanvas = document.getElementById('next');
const nctx       = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub   = document.getElementById('overlay-sub');

const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnRestart = document.getElementById('btn-restart');

// Game state
let BLOCK = 24; // computed dynamically to fit screen
let board;
let current, nextPiece;
let score = 0, lines = 0, level = 1;
let dropInterval = 800;
let lastTime = 0;
let dropCounter = 0;
let running = false;
let paused = false;

// Assets (set your actual file paths)
const boardBg = new Image();
boardBg.src = 'img/board-bg.png'; // background image for the board

const textures = {
  I: new Image(),
  O: new Image(),
  T: new Image(),
  S: new Image(),
  Z: new Image(),
  J: new Image(),
  L: new Image(),
};
textures.I.src = 'img/block-I.png';
textures.O.src = 'img/block-O.png';
textures.T.src = 'img/block-T.png';
textures.S.src = 'img/block-S.png';
textures.Z.src = 'img/block-Z.png';
textures.J.src = 'img/block-J.png';
textures.L.src = 'img/block-L.png';

const PIECES = {
  I: { key:'I', shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  O: { key:'O', shape: [[1,1],[1,1]] },
  T: { key:'T', shape: [[0,1,0],[1,1,1],[0,0,0]] },
  S: { key:'S', shape: [[0,1,1],[1,1,0],[0,0,0]] },
  Z: { key:'Z', shape: [[1,1,0],[0,1,1],[0,0,0]] },
  J: { key:'J', shape: [[1,0,0],[1,1,1],[0,0,0]] },
  L: { key:'L', shape: [[0,0,1],[1,1,1],[0,0,0]] }
};
const KEYS = Object.keys(PIECES);

// ---------- Utilities ----------
function createMatrix(w, h){
  const m = [];
  while (h--) m.push(new Array(w).fill(0));
  return m;
}
function cloneShape(s){ return s.map(r => r.slice()); }
function randPiece(){
  const key = KEYS[(Math.random()*KEYS.length)|0];
  const base = PIECES[key];
  return {
    key,
    shape: cloneShape(base.shape),
    x: (COLS/2|0) - (base.shape[0].length/2|0),
    y: 0
  };
}
function resetBoard(){ board = createMatrix(COLS, ROWS); }

// ---------- Collisions / Merging ----------
function collide(b, p){
  const s = p.shape;
  for (let y=0; y<s.length; y++){
    for (let x=0; x<s[y].length; x++){
      if (!s[y][x]) continue;
      const nx = p.x + x;
      const ny = p.y + y;
      if (ny < 0) continue; // allow above top
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (b[ny][nx]) return true;
    }
  }
  return false;
}
function merge(b, p){
  p.shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val && p.y + y >= 0) b[p.y + y][p.x + x] = p.key;
    });
  });
}
function rotate(matrix, dir){
  for (let y=0; y<matrix.length; y++){
    for (let x=0; x<y; x++){
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}
function playerRotate(dir){
  const oldX = current.x;
  let offset = 1;
  rotate(current.shape, dir);
  while (collide(board, current)){
    current.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (Math.abs(offset) > current.shape[0].length){
      rotate(current.shape, -dir);
      current.x = oldX;
      return;
    }
  }
}

// ---------- Lines / Scoring ----------
function clearLines(){
  let rowsCleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y--){
    for (let x = 0; x < COLS; x++){
      if (!board[y][x]) continue outer;
    }
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    y++;
    rowsCleared++;
  }
  if (!rowsCleared) return;
  const points = [0, 40, 100, 300, 1200][rowsCleared] * level;
  score += points;
  lines += rowsCleared;
  if (lines >= level * 10){
    level++;
    dropInterval = Math.max(80, Math.floor(dropInterval * 0.85));
  }
  updateHUD();
}
function updateHUD(){
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

// ---------- Drawing ----------
function drawBoardBg(){
  if (!boardBg.complete) return;
  ctx.drawImage(boardBg, 0, 0, COLS*BLOCK, ROWS*BLOCK);
}
function drawCellTex(x, y, key, context=ctx, size=BLOCK){
  const img = textures[key];
  if (img && img.complete) {
    context.drawImage(img, x*size, y*size, size, size);
  } else {
    context.fillStyle = '#444';
    context.fillRect(x*size, y*size, size, size);
  }
}
function drawBoard(){
  ctx.clearRect(0, 0, COLS*BLOCK, ROWS*BLOCK);
  drawBoardBg();
  for (let y=0; y<ROWS; y++){
    for (let x=0; x<COLS; x++){
      const cellKey = board[y][x];
      if (cellKey) drawCellTex(x,y,cellKey);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.strokeRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
    }
  }
}
function drawPiece(p){
  p.shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val && p.y + y >= 0) drawCellTex(p.x + x, p.y + y, p.key);
    });
  });
}
function drawNext(){
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  const s = nextPiece.shape;
  const cell = Math.floor(Math.min(nextCanvas.width, nextCanvas.height) / 5);
  const w = s[0].length * cell;
  const h = s.length * cell;
  const ox = ((nextCanvas.width - w) / 2 / cell) | 0;
  const oy = ((nextCanvas.height - h) / 2 / cell) | 0;

  s.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val) drawCellTex(x+ox, y+oy, nextPiece.key, nctx, cell);
    });
  });
}

// ---------- Flow ----------
function isAnyCellAboveTop(p){
  for (let y = 0; y < p.shape.length; y++){
    for (let x = 0; x < p.shape[y].length; x++){
      if (p.shape[y][x] && (p.y + y) < 0) return true;
    }
  }
  return false;
}

function spawn(){
  current = nextPiece || randPiece();
  nextPiece = randPiece();
  current.x = (COLS/2|0) - (current.shape[0].length/2|0);
  current.y = -2;
  if (collide(board, current)) {
    gameOver();
    return;
  }
  drawNext();
}
function hardDrop(){
  while (!collide(board, current)) current.y++;
  current.y--;
  lock();
}
function lock(){
  if (isAnyCellAboveTop(current)) {
    gameOver();
    return;
  }
  merge(board, current);
  clearLines();
  spawn();
}
function update(time = 0){
  if (!running || paused) return;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval){
    current.y++;
    if (collide(board, current)){
      current.y--;
      lock();
    }
    dropCounter = 0;
  }
  drawBoard();
  drawPiece(current);
  requestAnimationFrame(update);
}
function gameOver(){
  running = false;
  paused = false;
  overlayTitle.textContent = 'Game Over';
  overlaySub.textContent = `Final Score: ${score}\nPress Restart to play again`;
  overlay.classList.remove('hidden');
}

// ---------- Controls ----------
window.addEventListener('keydown', (e) => {
  if (!running || paused){
    if (e.key.toLowerCase() === 'p') togglePause();
    if (e.key.toLowerCase() === 'r') restart();
    return;
  }
  switch(e.key){
    case 'ArrowLeft':
      current.x--; if (collide(board, current)) current.x++;
      break;
    case 'ArrowRight':
      current.x++; if (collide(board, current)) current.x--;
      break;
    case 'ArrowDown':
      current.y++; if (collide(board, current)) current.y--;
      dropCounter = 0;
      break;
    case 'ArrowUp':
      playerRotate(1);
      break;
    case ' ':
      e.preventDefault();
      hardDrop();
      break;
    case 'p': case 'P':
      togglePause(); break;
    case 'r': case 'R':
      restart(); break;
  }
});

btnStart.addEventListener('click', start);
btnPause.addEventListener('click', togglePause);
btnRestart.addEventListener('click', restart);

function start(){
  if (running && !paused) return;
  overlay.classList.add('hidden');
  running = true; paused = false;
  lastTime = 0; dropCounter = 0;
  if (!current){
    resetBoard();
    score = 0; lines = 0; level = 1; dropInterval = 800;
    updateHUD();
    nextPiece = randPiece();
    spawn();
  }
  requestAnimationFrame(update);
}
function togglePause(){
  if (!running) return;
  paused = !paused;
  overlayTitle.textContent = paused ? 'Paused' : '';
  overlaySub.textContent   = paused ? 'Press Start or P to resume' : '';
  overlay.classList.toggle('hidden', !paused);
  if (!paused){
    lastTime = 0; dropCounter = 0;
    requestAnimationFrame(update);
  }
}
function restart(){
  running = false; paused = false; current = null; nextPiece = null;
  resetBoard();
  score = 0; lines = 0; level = 1; dropInterval = 800;
  updateHUD();
  drawBoard(); nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  overlayTitle.textContent = 'Ready';
  overlaySub.textContent   = 'Press Start to play';
  overlay.classList.remove('hidden');
}

// ---------- Responsiveness ----------
function resizeAll(){
  const sidebar = document.getElementById('sidebar');
  const styles = getComputedStyle(gameEl);
  const gap = parseInt(styles.getPropertyValue('gap')) || 16;

  const totalW = gameEl.clientWidth;
  const totalH = gameEl.clientHeight;

  const sidebarW = sidebar.offsetWidth;
  const boardMaxW = Math.max(0, totalW - sidebarW - gap);
  const boardMaxH = totalH;

  const blockByW = Math.floor(boardMaxW / COLS);
  const blockByH = Math.floor(boardMaxH / ROWS);
  BLOCK = Math.max(8, Math.min(blockByW, blockByH));

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width  = COLS * BLOCK * dpr;
  canvas.height = ROWS * BLOCK * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  canvas.style.width  = `${COLS * BLOCK}px`;
  canvas.style.height = `${ROWS * BLOCK}px`;

  const nextSize = Math.max(100, Math.min(sidebarW - 24, 160));
  nextCanvas.width  = nextSize * dpr;
  nextCanvas.height = nextSize * dpr;
  nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  nextCanvas.style.width  = `${nextSize}px`;
  nextCanvas.style.height = `${nextSize}px`;

  drawBoard();
  if (current) drawPiece(current);
  if (nextPiece) drawNext();
}

// Wait for all textures & background to load before enabling Start
function loadImages(imgs){
  return Promise.all(Object.values(imgs).map(img => {
    return new Promise(res => {
      if (img.complete) return res();
      img.onload = () => res();
      img.onerror = () => res();
    });
  }));
}

(async function init(){
  await loadImages({ boardBg, ...textures });

  resetBoard();
  overlayTitle.textContent = 'Ready';
  overlaySub.textContent   = 'Press Start to play';
  overlay.classList.remove('hidden');

  resizeAll();
})();

window.addEventListener('resize', resizeAll);
