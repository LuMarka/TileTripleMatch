// --- SISTEMA DE SONIDOS (Web Audio API) ---
const SFX = {
    ctx: null,
    init() { 
        if(!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); 
    },
    play(freq, type, duration) {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + duration);
    },
    pop() { this.play(600, 'sine', 0.1); },
    swap() { this.play(300, 'triangle', 0.1); },
    win() { this.play(900, 'sine', 0.5); },
    explosion() { this.play(150, 'sawtooth', 0.3); } 
};

// --- CONFIGURACIÓN Y ESTADO ---
const BOARD_SIZE = 8;
const FRUITS = ['🍎', '🍇', '🍊', '🍌', '🍉', '🥝', '🍓', '🍍'];

let gameState = {
    username: "",
    level: 1,
    moves: 20,
    coins: 0,
    score: 0,
    target: 200,
    board: [],
    selectedTile: null,
    isProcessing: false,
    bombs: 3 // Contador de bombas inicial
};

// --- INICIO Y LOGIN ---
document.getElementById('btn-login').onclick = () => {
    const name = document.getElementById('username-input').value.trim();
    if (!name) return;
    
    SFX.init();
    gameState.username = name;
    
    const saved = localStorage.getItem('fruitMatchSave_' + name);
    if (saved) {
        const data = JSON.parse(saved);
        gameState.level = data.level || 1;
        gameState.coins = data.coins || 0;
        // Cargamos las bombas guardadas o 3 por defecto
        gameState.bombs = data.bombs !== undefined ? data.bombs : 3;
    }

    document.getElementById('display-name').innerText = name;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-game').classList.remove('hidden');
    initLevel();
};

function initLevel() {
    gameState.target = 200 + (gameState.level * 100);
    gameState.moves = Math.max(10, 25 - Math.floor(gameState.level / 3));
    gameState.score = 0;
    gameState.selectedTile = null;
    gameState.isProcessing = false;
    
    generateValidBoard();
    renderBoard();
    updateUI();
}

function generateValidBoard() {
    gameState.board = [];
    const limit = Math.min(4 + Math.floor(gameState.level/6), 8);
    const available = FRUITS.slice(0, limit);
    for (let r = 0; r < BOARD_SIZE; r++) {
        gameState.board[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            let f;
            do { 
                f = available[Math.floor(Math.random() * available.length)]; 
            } while (
                (c >= 2 && gameState.board[r][c-1] === f && gameState.board[r][c-2] === f) ||
                (r >= 2 && gameState.board[r-1][c] === f && gameState.board[r-2][c] === f)
            );
            gameState.board[r][c] = f;
        }
    }
}

function renderBoard() {
    const boardEl = document.getElementById('game-board');
    boardEl.innerHTML = '';
    gameState.board.forEach((row, r) => row.forEach((f, c) => {
        const div = document.createElement('div');
        div.className = 'tile';
        if (gameState.selectedTile?.r === r && gameState.selectedTile?.c === c) {
            div.classList.add('selected');
        }
        div.innerText = f || '';
        div.onclick = () => handleTileClick(r, c);
        boardEl.appendChild(div);
    }));
}

async function handleTileClick(r, c) {
    if (gameState.isProcessing || gameState.moves <= 0) return;

    if (!gameState.selectedTile) {
        gameState.selectedTile = { r, c };
        SFX.swap();
        renderBoard();
    } else {
        const first = gameState.selectedTile;
        const second = { r, c };

        if (Math.abs(first.r - r) + Math.abs(first.c - c) === 1) {
            gameState.isProcessing = true;
            await swapTiles(first, second);
            
            let matches = findMatches();
            if (matches.length > 0) {
                gameState.moves--;
                await processMatches();
            } else {
                await swapTiles(first, second); 
            }
        }
        gameState.selectedTile = null;
        gameState.isProcessing = false;
        renderBoard();
        updateUI();
        checkGameStatus();
    }
}

async function swapTiles(a, b) {
    const temp = gameState.board[a.r][a.c];
    gameState.board[a.r][a.c] = gameState.board[b.r][b.c];
    gameState.board[b.r][b.c] = temp;
    renderBoard();
    await new Promise(res => setTimeout(res, 250));
}

function findMatches() {
    let m = [];
    for(let r=0; r<BOARD_SIZE; r++)
        for(let c=0; c<BOARD_SIZE-2; c++)
            if(gameState.board[r][c] && gameState.board[r][c] === gameState.board[r][c+1] && gameState.board[r][c] === gameState.board[r][c+2])
                m.push({r,c},{r,c:c+1},{r,c:c+2});
    for(let c=0; c<BOARD_SIZE; c++)
        for(let r=0; r<BOARD_SIZE-2; r++)
            if(gameState.board[r][c] && gameState.board[r][c] === gameState.board[r+1][c] && gameState.board[r][c] === gameState.board[r+2][c])
                m.push({r,c},{r:r+1,c},{r:r+2,c});
    return m;
}

async function processMatches() {
    let m = findMatches();
    while(m.length > 0) {
        SFX.pop();
        m.forEach(p => {
            if(gameState.board[p.r][p.c]) {
                gameState.score += 10; 
                gameState.coins += 1;
                gameState.board[p.r][p.c] = null;
            }
        });
        renderBoard();
        await new Promise(r => setTimeout(r, 250));
        dropTiles();
        renderBoard();
        await new Promise(r => setTimeout(r, 250));
        m = findMatches();
    }
}

function dropTiles() {
    const limit = Math.min(4 + Math.floor(gameState.level/6), 8);
    const available = FRUITS.slice(0, limit);
    for (let c = 0; c < BOARD_SIZE; c++) {
        let empty = BOARD_SIZE - 1;
        for (let r = BOARD_SIZE - 1; r >= 0; r--) {
            if (gameState.board[r][c] !== null) {
                gameState.board[empty][c] = gameState.board[r][c];
                if (empty !== r) gameState.board[r][c] = null;
                empty--;
            }
        }
        for (let r = empty; r >= 0; r--) {
            gameState.board[r][c] = available[Math.floor(Math.random() * available.length)];
        }
    }
}

function updateUI() {
    document.getElementById('level-val').innerText = gameState.level;
    document.getElementById('moves-val').innerText = gameState.moves;
    document.getElementById('coins-val').innerText = gameState.coins;
    document.getElementById('score-val').innerText = gameState.score;
    document.getElementById('target-msg').innerText = `Objetivo: ${gameState.target} pts`;
    
    // Actualizar contador visual de bombas
    const bombCountSpan = document.getElementById('bomb-count');
    if (bombCountSpan) bombCountSpan.innerText = gameState.bombs;
}

function checkGameStatus() {
    if (gameState.score >= gameState.target) {
        SFX.win();
        gameState.level++;

        // RECARGA DE BOMBAS: Cada 10 niveles (al pasar al 11, 21, 31, etc.)
        if (gameState.level > 1 && (gameState.level - 1) % 10 === 0) {
            gameState.bombs = 3;
        }

        saveProgress();
        document.getElementById('modal-title').innerText = "¡NIVEL COMPLETADO!";
        document.getElementById('modal-msg').innerText = `¡Excelente! Pasas al nivel ${gameState.level}`;
        document.getElementById('overlay').classList.remove('hidden');
    } else if (gameState.moves <= 0) {
        document.getElementById('modal-title').innerText = "¡GAME OVER!";
        document.getElementById('modal-msg').innerText = "Te quedaste sin movimientos.";
        document.getElementById('overlay').classList.remove('hidden');
    }
}

function saveProgress() {
    const data = { 
        level: gameState.level, 
        coins: gameState.coins,
        bombs: gameState.bombs 
    };
    localStorage.setItem('fruitMatchSave_' + gameState.username, JSON.stringify(data));
}

document.getElementById('btn-next').onclick = () => {
    document.getElementById('overlay').classList.add('hidden');
    initLevel();
};

// --- POWER-UPS ---

// BOTÓN BOMBA (Detonación 3x3 con Temblor y Rellenado)
document.getElementById('btn-auto-match').onclick = async () => {
    if (gameState.isProcessing) return;

    // Verificar disponibilidad de bombas
    if (gameState.bombs <= 0) {
        alert("¡No tienes más bombas! Espera al nivel " + (Math.ceil(gameState.level / 10) * 10 + 1) + " para recargar.");
        return;
    }
    
    gameState.isProcessing = true;
    gameState.bombs--; // Consumir bomba
    SFX.explosion();

    // 1. Temblor visual
    const boardEl = document.getElementById('game-board');
    boardEl.classList.add('shake');
    setTimeout(() => boardEl.classList.remove('shake'), 400);

    // 2. Elegir centro aleatorio
    const centerR = Math.floor(Math.random() * (BOARD_SIZE - 2)) + 1;
    const centerC = Math.floor(Math.random() * (BOARD_SIZE - 2)) + 1;

    // 3. Detonación
    for (let r = centerR - 1; r <= centerR + 1; r++) {
        for (let c = centerC - 1; c <= centerC + 1; c++) {
            if (gameState.board[r][c]) {
                gameState.score += 15;
                gameState.coins += 2;
                gameState.board[r][c] = null;
            }
        }
    }

    renderBoard();
    await new Promise(r => setTimeout(r, 300));

    // 4. Rellenado automático y caída
    dropTiles(); 
    renderBoard();
    
    // 5. Procesar combos resultantes
    await processMatches();
    
    gameState.isProcessing = false;
    updateUI();
    checkGameStatus();
};

document.getElementById('btn-shuffle').onclick = async () => {
    if (gameState.isProcessing) return;
    gameState.isProcessing = true;
    
    SFX.swap();
    generateValidBoard();
    renderBoard();
    
    await processMatches();
    gameState.isProcessing = false;
    updateUI();
};

document.getElementById('btn-reset-game').onclick = () => {
    if (confirm("¿Reiniciar progreso al Nivel 1? Se borrarán tus monedas, nivel y bombas.")) {
        gameState.level = 1;
        gameState.coins = 0;
        gameState.score = 0;
        gameState.bombs = 3;
        localStorage.removeItem('fruitMatchSave_' + gameState.username);
        initLevel();
        if(SFX.ctx) SFX.swap();
    }
};