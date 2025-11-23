const socket = io();
const canvas = document.getElementById('gameCanvas');
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
