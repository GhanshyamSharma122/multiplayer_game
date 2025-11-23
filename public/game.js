const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let myId = null;
let mapWidth = 2000;
let mapHeight = 2000;

// Input state
const movement = {
    up: false,
    down: false,
    left: false,
    right: false
};

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

socket.on('connect', () => {
    console.log('Connected to server');
});

// Login Logic
const loginOverlay = document.getElementById('login-overlay');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');

joinBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim() || "Unknown Soldier";
    socket.emit('join_game', name);
    loginOverlay.style.display = 'none';
});

socket.on('init', (data) => {
    myId = data.id;
    mapWidth = data.mapWidth;
    mapHeight = data.mapHeight;
});

socket.on('stateUpdate', (state) => {
    render(state);
    updateLeaderboard(state.players);
    updateHealth(state.players);
});

// Input Handling
document.addEventListener('keydown', (e) => {
    if (loginOverlay.style.display !== 'none') return; // Disable input during login
    switch (e.code) {
        case 'KeyW':
        case 'ArrowUp': movement.up = true; break;
        case 'KeyS':
        case 'ArrowDown': movement.down = true; break;
        case 'KeyA':
        case 'ArrowLeft': movement.left = true; break;
        case 'KeyD':
        case 'ArrowRight': movement.right = true; break;
        case 'Space': socket.emit('shoot'); break;
    }
    socket.emit('movement', movement);
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW':
        case 'ArrowUp': movement.up = false; break;
        case 'KeyS':
        case 'ArrowDown': movement.down = false; break;
        case 'KeyA':
        case 'ArrowLeft': movement.left = false; break;
        case 'KeyD':
        case 'ArrowRight': movement.right = false; break;
    }
    socket.emit('movement', movement);
});

document.addEventListener('mousedown', () => {
    if (loginOverlay.style.display !== 'none') return;
    socket.emit('shoot');
});

// Background Image
const bgImage = new Image();
bgImage.src = 'war_background.png';

function render(state) {
    // Clear screen
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera follow logic
    let camX = 0;
    let camY = 0;
    if (myId && state.players[myId]) {
        const me = state.players[myId];
        camX = canvas.width / 2 - me.x;
        camY = canvas.height / 2 - me.y;
    }

    ctx.save();
    ctx.translate(camX, camY);

    // Calculate visible area in world coordinates
    const startX = -camX;
    const startY = -camY;
    const endX = startX + canvas.width;
    const endY = startY + canvas.height;

    // Draw Background (Infinite Tiling)
    if (bgImage.complete) {
        const pattern = ctx.createPattern(bgImage, 'repeat');
        ctx.fillStyle = pattern;

        ctx.save();
        const matrix = new DOMMatrix();
        matrix.translateSelf(0, 0);
        pattern.setTransform(matrix);

        ctx.fillStyle = pattern;
        // Fill the entire visible screen with background, regardless of map boundaries
        ctx.fillRect(startX, startY, canvas.width, canvas.height);
        ctx.restore();
    } else {
        // Fallback grid
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;

        const gridSize = 100;
        const startGridX = Math.floor(startX / gridSize) * gridSize;
        const startGridY = Math.floor(startY / gridSize) * gridSize;

        for (let x = startGridX; x <= endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }
        for (let y = startGridY; y <= endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
    }

    // Draw Map Boundary
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, mapWidth, mapHeight);

    // Draw Players
    for (const id in state.players) {
        const p = state.players[id];
        if (p.health <= 0) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        // Tank Body
        ctx.fillStyle = p.color;
        ctx.fillRect(-20, -20, 40, 40);

        // Tracks
        ctx.fillStyle = '#222';
        ctx.fillRect(-22, -18, 4, 36);
        ctx.fillRect(18, -18, 4, 36);

        // Tank Turret
        ctx.fillStyle = '#000';
        ctx.fillRect(0, -5, 30, 10);
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Name Tag (Moved higher to avoid overlap)
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(p.name, p.x, p.y - 55);
        ctx.shadowBlur = 0;

        // Health Bar above tank
        ctx.fillStyle = 'red';
        ctx.fillRect(p.x - 20, p.y - 45, 40, 5);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(p.x - 20, p.y - 45, 40 * (p.health / 100), 5);
    }

    // Draw Bullets
    ctx.fillStyle = '#ff0';
    for (const b of state.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw Particles
    updateAndDrawParticles(ctx);

    ctx.restore();
}

const particles = [];

socket.on('explosion', (data) => {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: data.x,
            y: data.y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            color: `hsl(${Math.random() * 60 + 10}, 100%, 50%)` // Orange/Yellow fire
        });
    }
});

function updateAndDrawParticles(ctx) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function updateLeaderboard(players) {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';

    const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);

    sortedPlayers.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.name}: ${p.score}`;
        if (p.id === myId) {
            li.style.fontWeight = 'bold';
            li.style.color = '#0f0';
        }
        list.appendChild(li);
    });
}

function updateHealth(players) {
    if (myId && players[myId]) {
        const healthBar = document.getElementById('health-bar');
        healthBar.style.width = players[myId].health + '%';
    }
}
