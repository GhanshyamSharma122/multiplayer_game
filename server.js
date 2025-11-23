const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static('public'));

// Game State
const players = {};
const bullets = [];
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const TANK_SIZE = 40;
const BULLET_SPEED = 10;
const TANK_SPEED = 4.2;
const BULLET_RADIUS = 5;

io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id);

    socket.emit('init', { id: socket.id, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT });

    socket.on('join_game', (name) => {
        // Initialize new player
        players[socket.id] = {
            x: Math.random() * MAP_WIDTH,
            y: Math.random() * MAP_HEIGHT,
            rotation: 0,
            health: 100,
            score: 0,
            name: name || "Player " + socket.id.substr(0, 4),
            id: socket.id,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`
        };
    });

    socket.on('movement', (data) => {
        const player = players[socket.id];
        if (player && player.health > 0) {
            // Simple movement logic - authoritative
            if (data.up) {
                player.x += Math.cos(player.rotation) * TANK_SPEED;
                player.y += Math.sin(player.rotation) * TANK_SPEED;
            }
            if (data.down) {
                player.x -= Math.cos(player.rotation) * TANK_SPEED;
                player.y -= Math.sin(player.rotation) * TANK_SPEED;
            }
            if (data.left) {
                player.rotation -= 0.05;
            }
            if (data.right) {
                player.rotation += 0.05;
            }

            // Boundary checks
            player.x = Math.max(TANK_SIZE / 2, Math.min(MAP_WIDTH - TANK_SIZE / 2, player.x));
            player.y = Math.max(TANK_SIZE / 2, Math.min(MAP_HEIGHT - TANK_SIZE / 2, player.y));
        }
    });

    socket.on('shoot', () => {
        const player = players[socket.id];
        if (player && player.health > 0) {
            bullets.push({
                x: player.x + Math.cos(player.rotation) * (TANK_SIZE / 2 + 10),
                y: player.y + Math.sin(player.rotation) * (TANK_SIZE / 2 + 10),
                vx: Math.cos(player.rotation) * BULLET_SPEED,
                vy: Math.sin(player.rotation) * BULLET_SPEED,
                ownerId: socket.id
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected: ' + socket.id);
        delete players[socket.id];
    });
});

// Game Loop (60 TPS)
setInterval(() => {
    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // Remove if out of bounds
        if (b.x < 0 || b.x > MAP_WIDTH || b.y < 0 || b.y > MAP_HEIGHT) {
            bullets.splice(i, 1);
            continue;
        }

        // Check collisions with players
        for (const id in players) {
            const p = players[id];
            if (id !== b.ownerId && p.health > 0) {
                const dx = b.x - p.x;
                const dy = b.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < TANK_SIZE / 2 + BULLET_RADIUS) {
                    // Hit!
                    p.health -= 10;
                    bullets.splice(i, 1);

                    io.emit('explosion', { x: b.x, y: b.y });

                    if (p.health <= 0) {
                        // Kill logic
                        p.health = 0;
                        setTimeout(() => {
                            if (players[id]) {
                                players[id].health = 100;
                                players[id].x = Math.random() * MAP_WIDTH;
                                players[id].y = Math.random() * MAP_HEIGHT;
                            }
                        }, 3000);

                        // Award point to shooter
                        if (players[b.ownerId]) {
                            players[b.ownerId].score += 1;
                        }
                    }
                    break; // Bullet hit something, stop checking other players
                }
            }
        }
    }

    // Broadcast state
    io.emit('stateUpdate', { players, bullets });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});
