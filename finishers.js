// ============================================
// BATTLE BOTS — Finisher Animations
// ============================================

const Finisher = {
    canvas: null,
    ctx: null,
    particles: [],
    frame: 0,
    animId: null,
    winnerParts: null,
    loserParts: null,
    winnerSize: 'medium',
    loserSize: 'medium',
    phase: 'intro', // intro, strike, destroy, oil, settle
    phaseTimer: 0,
    onComplete: null,

    play(opts) {
        // Options: { leftParts, rightParts, leftSize, rightSize, winnerOnLeft, onComplete }
        this.canvas = document.getElementById('finisher-canvas');
        this.canvas.width = 600;
        this.canvas.height = 400;
        this.ctx = this.canvas.getContext('2d');
        const winnerParts = opts.winnerOnLeft ? opts.leftParts : opts.rightParts;
        const loserParts = opts.winnerOnLeft ? opts.rightParts : opts.leftParts;
        const winnerSize = opts.winnerOnLeft ? opts.leftSize : opts.rightSize;
        const loserSize = opts.winnerOnLeft ? opts.rightSize : opts.leftSize;
        this.winnerParts = getRenderParts(winnerParts);
        this.loserParts = getRenderParts(loserParts);
        this.winnerSize = winnerSize;
        this.loserSize = loserSize;
        this.flipped = !opts.winnerOnLeft; // player lost → mirror canvas
        this.onComplete = opts.onComplete;
        this.particles = [];
        this.frame = 0;
        this.phase = 'intro';
        this.phaseTimer = 0;
        this.winnerX = -100;
        this.loserX = 700;
        this.loserY = 0;
        this.loserAngle = 0;
        this.loserScale = 1;
        this.impactFlash = 0;
        this.screenShake = 0;

        document.getElementById('finisher-overlay').classList.remove('visible');

        if (this.animId) cancelAnimationFrame(this.animId);
        this.animate();
    },

    playDraw(leftParts, rightParts, leftSize, rightSize, onComplete) {
        this.canvas = document.getElementById('finisher-canvas');
        this.canvas.width = 600;
        this.canvas.height = 400;
        this.ctx = this.canvas.getContext('2d');
        this._leftParts = getRenderParts(leftParts);
        this._rightParts = getRenderParts(rightParts);
        this.particles = [];
        this.frame = 0;
        this.phase = 'draw';
        this.phaseTimer = 0;
        this.flipped = false;
        this.screenShake = 0;
        this.impactFlash = 0;
        this.onComplete = onComplete;
        document.getElementById('finisher-overlay').classList.remove('visible');
        if (this.animId) cancelAnimationFrame(this.animId);
        this.animateDraw();
    },

    animateDraw() {
        this.frame++;
        this.phaseTimer++;
        const ctx = this.ctx;
        ctx.save();

        if (this.screenShake > 0) {
            ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        ctx.fillStyle = '#050810';
        ctx.fillRect(-20, -20, 640, 440);
        ctx.fillStyle = '#0a1020';
        ctx.fillRect(-20, 300, 640, 120);
        ctx.strokeStyle = '#1a2a4a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-20, 300);
        ctx.lineTo(640, 300);
        ctx.stroke();

        // Both robots leaning in, weapons locked at center — ~1.5s of clash, then recoil
        const t = Math.min(1, this.phaseTimer / 45);
        const leanL = 180 + 40 * this.easeIn(t);
        const leanR = 420 - 40 * this.easeIn(t);
        this.drawRobot(this._leftParts, leanL, 0, 1.2, false);
        this.drawRobot(this._rightParts, leanR, 0, 1.2, true);

        // Sparks flying between them while they clash
        if (this.phaseTimer > 30 && this.phaseTimer % 3 === 0) {
            for (let i = 0; i < 3; i++) this.spawnSpark(300 + (Math.random() - 0.5) * 60, 190 + (Math.random() - 0.5) * 40);
            if (this.phaseTimer % 12 === 0) this.screenShake = 6;
        }

        // Clash flash
        if (this.phaseTimer > 40 && this.phaseTimer < 55) {
            const a = 1 - (this.phaseTimer - 40) / 15;
            ctx.fillStyle = `rgba(255,215,0,${a * 0.4})`;
            ctx.beginPath();
            ctx.arc(300, 200, 80, 0, Math.PI * 2);
            ctx.fill();
        }

        this.updateParticles();
        ctx.restore();

        if (this.phaseTimer >= 90) {
            if (this.onComplete) { this.onComplete(); this.onComplete = null; }
        }
        if (this.phase === 'draw') {
            this.animId = requestAnimationFrame(() => this.animateDraw());
        }
    },

    animate() {
        this.frame++;
        this.phaseTimer++;
        this.ctx.save();

        // Screen shake
        if (this.screenShake > 0) {
            const sx = (Math.random() - 0.5) * this.screenShake;
            const sy = (Math.random() - 0.5) * this.screenShake;
            this.ctx.translate(sx, sy);
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        // Dark background
        this.ctx.fillStyle = '#050810';
        this.ctx.fillRect(-20, -20, 640, 440);

        // Mirror the canvas so player stays on left when they lost
        if (this.flipped) {
            this.ctx.translate(600, 0);
            this.ctx.scale(-1, 1);
        }

        // Floor
        this.ctx.fillStyle = '#0a1020';
        this.ctx.fillRect(-20, 300, 640, 120);
        this.ctx.strokeStyle = '#1a2a4a';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(-20, 300);
        this.ctx.lineTo(640, 300);
        this.ctx.stroke();

        switch (this.phase) {
            case 'intro': this.phaseIntro(); break;
            case 'approach': this.phaseApproach(); break;
            case 'strike': this.phaseStrike(); break;
            case 'destroy': this.phaseDestroy(); break;
            case 'oil': this.phaseOil(); break;
            case 'settle': this.phaseSettle(); break;
        }

        // Draw particles
        this.updateParticles();

        // Impact flash
        if (this.impactFlash > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.impactFlash})`;
            this.ctx.fillRect(-20, -20, 640, 440);
            this.impactFlash -= 0.05;
        }

        this.ctx.restore();

        if (this.phase !== 'done') {
            this.animId = requestAnimationFrame(() => this.animate());
        }
    },

    phaseIntro() {
        // Robots slide in from sides
        this.winnerX = this.lerp(-100, 180, this.phaseTimer / 40);
        this.loserX = this.lerp(700, 420, this.phaseTimer / 40);

        this.drawRobot(this.winnerParts, this.winnerX, 0, 1.2, false);
        this.drawRobot(this.loserParts, this.loserX, 0, 1.2, true);

        if (this.phaseTimer >= 50) {
            this.phase = 'approach';
            this.phaseTimer = 0;
        }
    },

    phaseApproach() {
        // Winner approaches menacingly
        const t = Math.min(1, this.phaseTimer / 30);
        const matchup = this.getMatchup();

        if (matchup === 'big-vs-small') {
            // Big winner stomps toward small loser
            this.winnerX = this.lerp(180, 260, t);
            const bounce = Math.abs(Math.sin(this.phaseTimer * 0.3)) * 5;
            this.drawRobot(this.winnerParts, this.winnerX, -bounce, 1.4, false);
            this.drawRobot(this.loserParts, this.loserX, 0, 0.9, true);
            if (this.phaseTimer % 10 === 0) this.screenShake = 4;
        } else if (matchup === 'small-vs-big') {
            // Small winner darts forward quickly
            this.winnerX = this.lerp(180, 280, this.easeIn(t));
            this.drawRobot(this.winnerParts, this.winnerX, 0, 0.9, false);
            this.drawRobot(this.loserParts, this.loserX, 0, 1.4, true);
        } else {
            // Even matchup — both advance
            this.winnerX = this.lerp(180, 240, t);
            this.loserX = this.lerp(420, 360, t);
            this.drawRobot(this.winnerParts, this.winnerX, 0, 1.2, false);
            this.drawRobot(this.loserParts, this.loserX, 0, 1.2, true);
        }

        if (this.phaseTimer >= 40) {
            this.phase = 'strike';
            this.phaseTimer = 0;
        }
    },

    phaseStrike() {
        const matchup = this.getMatchup();
        const t = Math.min(1, this.phaseTimer / 15);

        if (matchup === 'big-vs-small') {
            // Crushing overhead strike
            this.winnerX = this.lerp(260, 340, this.easeIn(t));
            const winY = t < 0.5 ? -30 * t * 2 : -30 + 60 * (t - 0.5) * 2;
            this.drawRobot(this.winnerParts, this.winnerX, winY, 1.4, false);
            this.drawRobot(this.loserParts, this.loserX, 0, 0.9, true);
        } else if (matchup === 'small-vs-big') {
            // Quick dash through
            this.winnerX = this.lerp(280, 450, this.easeIn(t));
            this.drawRobot(this.loserParts, this.loserX, 0, 1.4, true);
            this.drawRobot(this.winnerParts, this.winnerX, -10, 0.9, false);
        } else {
            // Powerful punch
            this.winnerX = this.lerp(240, 320, this.easeIn(t));
            this.drawRobot(this.winnerParts, this.winnerX, 0, 1.2, false);
            this.drawRobot(this.loserParts, this.loserX, 0, 1.2, true);
        }

        if (this.phaseTimer >= 15) {
            this.impactFlash = 0.8;
            this.screenShake = 20;
            this.spawnImpactParticles(this.loserX, 200);
            this.phase = 'destroy';
            this.phaseTimer = 0;
        }
    },

    phaseDestroy() {
        const t = Math.min(1, this.phaseTimer / 40);
        const matchup = this.getMatchup();

        // Winner stands victorious
        const winScale = matchup === 'big-vs-small' ? 1.4 : matchup === 'small-vs-big' ? 0.9 : 1.2;

        // Loser gets knocked back and broken
        this.loserX = this.lerp(420, 500, t);
        this.loserY = -80 * Math.sin(t * Math.PI);
        this.loserAngle = t * 0.5;
        this.loserScale = 1.2 * (1 - t * 0.3);

        this.drawRobot(this.winnerParts, this.winnerX, 0, winScale, false);

        // Draw loser tumbling
        this.ctx.save();
        this.ctx.translate(this.loserX, 200 + this.loserY);
        this.ctx.rotate(this.loserAngle);
        const ls = matchup === 'small-vs-big' ? 1.4 * this.loserScale : matchup === 'big-vs-small' ? 0.9 * this.loserScale : 1.2 * this.loserScale;
        RobotRenderer.draw(this.canvas, this.loserParts, {
            scale: ls * 0.5,
            offsetX: 0,
            offsetY: -60,
            flip: true,
            noClear: true
        });
        this.ctx.restore();

        // Spawn oil/sparks during tumble
        if (this.phaseTimer % 3 === 0) {
            this.spawnOilDrop(this.loserX + (Math.random() - 0.5) * 40, 200 + this.loserY);
            this.spawnSpark(this.loserX + (Math.random() - 0.5) * 30, 200 + this.loserY);
        }

        if (this.phaseTimer >= 50) {
            this.phase = 'oil';
            this.phaseTimer = 0;
        }
    },

    phaseOil() {
        const t = Math.min(1, this.phaseTimer / 60);

        // Winner poses
        const matchup = this.getMatchup();
        const winScale = matchup === 'big-vs-small' ? 1.4 : matchup === 'small-vs-big' ? 0.9 : 1.2;

        this.drawRobot(this.winnerParts, this.winnerX, 0, winScale, false);

        // Loser on the ground, sparking
        this.ctx.save();
        this.ctx.translate(500, 270);
        this.ctx.rotate(1.2);
        const ls = matchup === 'small-vs-big' ? 0.8 : matchup === 'big-vs-small' ? 0.5 : 0.65;
        RobotRenderer.draw(this.canvas, this.loserParts, {
            scale: ls,
            offsetX: 0,
            offsetY: -30,
            flip: true,
            noClear: true
        });
        this.ctx.restore();

        // Oil pool spreading
        this.ctx.fillStyle = 'rgba(20, 20, 25, 0.8)';
        this.ctx.beginPath();
        this.ctx.ellipse(500, 310, 30 + t * 40, 5 + t * 10, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Oil sheen
        this.ctx.fillStyle = 'rgba(40, 40, 60, 0.5)';
        this.ctx.beginPath();
        this.ctx.ellipse(490, 308, 20 + t * 25, 3 + t * 6, -0.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Occasional sparks from wreck
        if (this.phaseTimer % 8 === 0) {
            this.spawnSpark(490 + Math.random() * 30, 260 + Math.random() * 20);
        }

        // Smoke
        if (this.phaseTimer % 5 === 0) {
            this.particles.push({
                x: 495 + Math.random() * 20,
                y: 250,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -1 - Math.random(),
                life: 60,
                maxLife: 60,
                size: 8 + Math.random() * 12,
                type: 'smoke'
            });
        }

        if (this.phaseTimer >= 80) {
            this.phase = 'settle';
            this.phaseTimer = 0;
            if (this.onComplete) this.onComplete();
        }
    },

    phaseSettle() {
        // Final pose — keep drawing the scene
        const matchup = this.getMatchup();
        const winScale = matchup === 'big-vs-small' ? 1.4 : matchup === 'small-vs-big' ? 0.9 : 1.2;

        this.drawRobot(this.winnerParts, this.winnerX, 0, winScale, false);

        // Loser wreck
        this.ctx.save();
        this.ctx.translate(500, 270);
        this.ctx.rotate(1.2);
        const ls = matchup === 'small-vs-big' ? 0.8 : matchup === 'big-vs-small' ? 0.5 : 0.65;
        RobotRenderer.draw(this.canvas, this.loserParts, {
            scale: ls, offsetX: 0, offsetY: -30, flip: true, noClear: true
        });
        this.ctx.restore();

        // Oil pool
        this.ctx.fillStyle = 'rgba(20, 20, 25, 0.8)';
        this.ctx.beginPath();
        this.ctx.ellipse(500, 310, 70, 15, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = 'rgba(40, 40, 60, 0.5)';
        this.ctx.beginPath();
        this.ctx.ellipse(490, 308, 45, 9, -0.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Sparse smoke
        if (this.phaseTimer % 12 === 0) {
            this.particles.push({
                x: 495 + Math.random() * 20, y: 250,
                vx: (Math.random() - 0.5) * 0.3, vy: -0.5 - Math.random() * 0.5,
                life: 40, maxLife: 40, size: 6 + Math.random() * 8, type: 'smoke'
            });
        }

        if (this.phaseTimer >= 30) {
            this.phase = 'done';
        }
    },

    drawRobot(parts, x, y, scale, flip) {
        RobotRenderer.draw(this.canvas, parts, {
            scale: scale * 0.55,
            offsetX: x - 300,
            offsetY: y - 80,
            flip: flip,
            noClear: true
        });
    },

    getMatchup() {
        if (this.winnerSize === 'heavy' && this.loserSize === 'light') return 'big-vs-small';
        if (this.winnerSize === 'light' && this.loserSize === 'heavy') return 'small-vs-big';
        return 'even';
    },

    spawnImpactParticles(x, y) {
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                size: 2 + Math.random() * 4,
                type: Math.random() > 0.4 ? 'spark' : 'oil'
            });
        }
        // Metal chunks
        for (let i = 0; i < 8; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
            const speed = 3 + Math.random() * 5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 40 + Math.random() * 20,
                maxLife: 60,
                size: 4 + Math.random() * 6,
                type: 'chunk',
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.3
            });
        }
    },

    spawnOilDrop(x, y) {
        this.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 3,
            vy: -2 - Math.random() * 3,
            life: 40,
            maxLife: 40,
            size: 3 + Math.random() * 5,
            type: 'oil'
        });
    },

    spawnSpark(x, y) {
        for (let i = 0; i < 3; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: -3 - Math.random() * 3,
                life: 15 + Math.random() * 10,
                maxLife: 25,
                size: 1 + Math.random() * 2,
                type: 'spark'
            });
        }
    },

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15; // gravity
            p.life--;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            const alpha = Math.min(1, p.life / (p.maxLife * 0.3));

            if (p.type === 'spark') {
                this.ctx.fillStyle = `rgba(255, ${150 + Math.random() * 105}, 0, ${alpha})`;
                this.ctx.fillRect(p.x, p.y, p.size, p.size);
            } else if (p.type === 'oil') {
                this.ctx.fillStyle = `rgba(20, 22, 30, ${alpha * 0.9})`;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                // Oil sheen
                this.ctx.fillStyle = `rgba(60, 60, 90, ${alpha * 0.4})`;
                this.ctx.beginPath();
                this.ctx.arc(p.x - 1, p.y - 1, p.size * 0.6, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (p.type === 'chunk') {
                this.ctx.save();
                this.ctx.translate(p.x, p.y);
                p.rotation += p.rotSpeed;
                this.ctx.rotate(p.rotation);
                this.ctx.fillStyle = `rgba(120, 130, 160, ${alpha})`;
                this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                this.ctx.restore();
            } else if (p.type === 'smoke') {
                const grow = 1 + (1 - p.life / p.maxLife) * 2;
                this.ctx.fillStyle = `rgba(40, 45, 60, ${alpha * 0.3})`;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size * grow, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    },

    lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); },
    easeIn(t) { return t * t; },

    stop() {
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
    }
};
