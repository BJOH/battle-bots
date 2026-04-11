// ============================================
// BATTLE BOTS — Robot Renderer (Canvas)
// ============================================

const RobotRenderer = {
    // Draw a robot on a canvas given equipped parts
    draw(canvas, parts, options = {}) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const scale = options.scale || 1;
        const offsetX = options.offsetX || 0;
        const offsetY = options.offsetY || 0;
        const flip = options.flip || false;

        ctx.save();
        if (!options.noClear) {
            ctx.clearRect(0, 0, w, h);
        }

        ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
        ctx.scale(scale, scale);
        if (flip) ctx.scale(-1, 1);

        // Get tier colors for each part
        const colors = {};
        for (const [slot, partId] of Object.entries(parts)) {
            const partData = this.findPart(slot, partId);
            colors[slot] = TIER_COLORS[partData ? partData.tier : 1];
        }

        this.drawLegs(ctx, parts.legs, colors.legs);
        this.drawTorso(ctx, parts.torso, colors.torso);
        this.drawArms(ctx, parts.arms, colors.arms, parts.weapon, colors.weapon);
        this.drawHead(ctx, parts.head, colors.head);
        this.drawSpecial(ctx, parts.special, colors.special);

        ctx.restore();
    },

    findPart(category, partId) {
        if (!PARTS[category]) return null;
        return PARTS[category].find(p => p.id === partId) || null;
    },

    drawHead(ctx, headId, color) {
        ctx.save();
        ctx.translate(0, -55);

        const c = color || '#aab';

        if (headId === 'head_heavy' || headId === 'head_omega') {
            // Bulky helmet
            ctx.fillStyle = c;
            this.roundRect(ctx, -22, -22, 44, 40, 6);
            ctx.fill();
            // Visor
            ctx.fillStyle = this.brighten(c, 0.5);
            this.roundRect(ctx, -16, -10, 32, 12, 3);
            ctx.fill();
            // Top ridge
            ctx.fillStyle = this.darken(c, 0.3);
            this.roundRect(ctx, -10, -26, 20, 8, 3);
            ctx.fill();
        } else if (headId === 'head_ai' || headId === 'head_sensor') {
            // Sleek head
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(-18, 18);
            ctx.lineTo(-22, -8);
            ctx.lineTo(-12, -22);
            ctx.lineTo(12, -22);
            ctx.lineTo(22, -8);
            ctx.lineTo(18, 18);
            ctx.closePath();
            ctx.fill();
            // Eye
            ctx.fillStyle = this.brighten(c, 0.8);
            ctx.beginPath();
            ctx.arc(0, -2, 7, 0, Math.PI * 2);
            ctx.fill();
            // Antenna
            ctx.strokeStyle = c;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -22);
            ctx.lineTo(0, -32);
            ctx.stroke();
            ctx.fillStyle = this.brighten(c, 0.6);
            ctx.beginPath();
            ctx.arc(0, -33, 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Basic head
            ctx.fillStyle = c;
            this.roundRect(ctx, -16, -18, 32, 34, 5);
            ctx.fill();
            // Eyes
            ctx.fillStyle = this.brighten(c, 0.6);
            ctx.fillRect(-10, -6, 7, 5);
            ctx.fillRect(3, -6, 7, 5);
        }

        ctx.restore();
    },

    drawTorso(ctx, torsoId, color) {
        ctx.save();
        const c = color || '#aab';

        if (torsoId === 'torso_tank' || torsoId === 'torso_omega') {
            // Wide heavy torso
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(-30, -35);
            ctx.lineTo(30, -35);
            ctx.lineTo(35, 25);
            ctx.lineTo(-35, 25);
            ctx.closePath();
            ctx.fill();
            // Center plate
            ctx.fillStyle = this.darken(c, 0.2);
            this.roundRect(ctx, -15, -20, 30, 35, 4);
            ctx.fill();
            // Core glow
            ctx.fillStyle = this.brighten(c, 0.5);
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
        } else if (torsoId === 'torso_reactor') {
            // Reactor chassis
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(-25, -35);
            ctx.lineTo(25, -35);
            ctx.lineTo(28, 25);
            ctx.lineTo(-28, 25);
            ctx.closePath();
            ctx.fill();
            // Reactor core
            ctx.fillStyle = '#ff6b35';
            ctx.beginPath();
            ctx.arc(0, -2, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(0, -2, 6, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Standard torso
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(-22, -35);
            ctx.lineTo(22, -35);
            ctx.lineTo(26, 25);
            ctx.lineTo(-26, 25);
            ctx.closePath();
            ctx.fill();
            // Detail lines
            ctx.strokeStyle = this.darken(c, 0.3);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-12, -25);
            ctx.lineTo(-12, 15);
            ctx.moveTo(12, -25);
            ctx.lineTo(12, 15);
            ctx.stroke();
        }

        ctx.restore();
    },

    drawArms(ctx, armsId, armColor, weaponId, weaponColor) {
        ctx.save();
        const ac = armColor || '#aab';
        const wc = weaponColor || '#aab';

        // Left arm
        this.drawSingleArm(ctx, -1, armsId, ac, weaponId, wc);
        // Right arm
        this.drawSingleArm(ctx, 1, armsId, ac, weaponId, wc);

        ctx.restore();
    },

    drawSingleArm(ctx, side, armsId, armColor, weaponId, weaponColor) {
        ctx.save();
        const x = side * 35;

        if (armsId === 'arms_claws') {
            // Claw arm
            ctx.fillStyle = armColor;
            this.roundRect(ctx, x - 6, -25, 12, 40, 4);
            ctx.fill();
            // Claw
            ctx.fillStyle = this.brighten(armColor, 0.3);
            ctx.beginPath();
            ctx.moveTo(x - 8, 15);
            ctx.lineTo(x - 12, 30);
            ctx.lineTo(x - 2, 22);
            ctx.lineTo(x, 32);
            ctx.lineTo(x + 2, 22);
            ctx.lineTo(x + 12, 30);
            ctx.lineTo(x + 8, 15);
            ctx.closePath();
            ctx.fill();
        } else if (armsId === 'arms_shield') {
            // Shield arm
            ctx.fillStyle = armColor;
            this.roundRect(ctx, x - 6, -25, 12, 45, 4);
            ctx.fill();
            // Shield plate
            ctx.fillStyle = this.brighten(armColor, 0.3);
            this.roundRect(ctx, x - 14, -15, 28, 35, 6);
            ctx.fill();
            ctx.fillStyle = this.brighten(armColor, 0.6);
            this.roundRect(ctx, x - 8, -8, 16, 20, 3);
            ctx.fill();
        } else if (armsId === 'arms_cannon' || armsId === 'arms_omega') {
            // Cannon arm
            ctx.fillStyle = armColor;
            this.roundRect(ctx, x - 8, -25, 16, 35, 4);
            ctx.fill();
            // Barrel
            ctx.fillStyle = weaponColor;
            this.roundRect(ctx, x - 6, 5, 12, 28, 3);
            ctx.fill();
            ctx.fillStyle = this.brighten(weaponColor, 0.5);
            ctx.beginPath();
            ctx.arc(x, 33, 5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Basic arm
            ctx.fillStyle = armColor;
            this.roundRect(ctx, x - 5, -25, 10, 40, 4);
            ctx.fill();
            // Hand/weapon mount
            ctx.fillStyle = weaponColor;
            this.roundRect(ctx, x - 7, 12, 14, 10, 3);
            ctx.fill();
        }

        ctx.restore();
    },

    drawLegs(ctx, legsId, color) {
        ctx.save();
        ctx.translate(0, 25);
        const c = color || '#aab';

        if (legsId === 'legs_treads') {
            // Tank treads
            ctx.fillStyle = c;
            this.roundRect(ctx, -30, 5, 20, 40, 5);
            ctx.fill();
            this.roundRect(ctx, 10, 5, 20, 40, 5);
            ctx.fill();
            // Tread detail
            ctx.strokeStyle = this.darken(c, 0.3);
            ctx.lineWidth = 2;
            for (let y = 12; y < 42; y += 8) {
                ctx.beginPath();
                ctx.moveTo(-28, y); ctx.lineTo(-12, y);
                ctx.moveTo(12, y); ctx.lineTo(28, y);
                ctx.stroke();
            }
        } else if (legsId === 'legs_boost') {
            // Jet legs
            ctx.fillStyle = c;
            this.roundRect(ctx, -18, 0, 10, 35, 3);
            ctx.fill();
            this.roundRect(ctx, 8, 0, 10, 35, 3);
            ctx.fill();
            // Thrusters
            ctx.fillStyle = '#ff6b35';
            ctx.beginPath();
            ctx.moveTo(-18, 35);
            ctx.lineTo(-8, 35);
            ctx.lineTo(-13, 48);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(8, 35);
            ctx.lineTo(18, 35);
            ctx.lineTo(13, 48);
            ctx.closePath();
            ctx.fill();
        } else if (legsId === 'legs_spider') {
            // Spider legs
            ctx.strokeStyle = c;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            const legAngles = [-0.6, -0.2, 0.2, 0.6];
            for (const a of legAngles) {
                ctx.beginPath();
                const lx = Math.sin(a) * 10;
                ctx.moveTo(lx, 5);
                ctx.lineTo(lx + Math.sin(a) * 25, 20);
                ctx.lineTo(lx + Math.sin(a) * 35, 40);
                ctx.stroke();
            }
        } else if (legsId === 'legs_omega') {
            // Hover legs (gravity drives)
            ctx.fillStyle = c;
            this.roundRect(ctx, -14, 0, 8, 20, 3);
            ctx.fill();
            this.roundRect(ctx, 6, 0, 8, 20, 3);
            ctx.fill();
            // Hover disc
            ctx.fillStyle = this.brighten(c, 0.3);
            ctx.beginPath();
            ctx.ellipse(0, 30, 25, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#448aff';
            ctx.beginPath();
            ctx.ellipse(0, 30, 16, 5, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Basic bipedal legs
            ctx.fillStyle = c;
            this.roundRect(ctx, -14, 0, 8, 35, 3);
            ctx.fill();
            this.roundRect(ctx, 6, 0, 8, 35, 3);
            ctx.fill();
            // Feet
            ctx.fillStyle = this.darken(c, 0.2);
            this.roundRect(ctx, -18, 32, 16, 8, 3);
            ctx.fill();
            this.roundRect(ctx, 2, 32, 16, 8, 3);
            ctx.fill();
        }

        ctx.restore();
    },

    drawSpecial(ctx, specialId, color) {
        if (!specialId || specialId === 'special_none') return;

        ctx.save();
        const c = color || '#aab';

        // Draw a small module on the robot's back/shoulder
        ctx.translate(0, -25);

        if (specialId === 'special_shield') {
            ctx.strokeStyle = '#448aff';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, 45, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        } else if (specialId === 'special_overcharge') {
            ctx.fillStyle = '#ff1744';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(-28, -15, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(28, -15, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        } else if (specialId === 'special_repair') {
            ctx.fillStyle = '#00e676';
            ctx.globalAlpha = 0.5;
            // Small cross
            ctx.fillRect(-3, -42, 6, 14);
            ctx.fillRect(-7, -38, 14, 6);
            ctx.globalAlpha = 1;
        } else if (specialId === 'special_emp') {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.5;
            // Lightning bolt hint
            ctx.beginPath();
            ctx.moveTo(-5, -40);
            ctx.lineTo(2, -33);
            ctx.lineTo(-2, -33);
            ctx.lineTo(5, -26);
            ctx.stroke();
            ctx.globalAlpha = 1;
        } else if (specialId === 'special_omega') {
            ctx.fillStyle = '#7c4dff';
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    },

    // Helper: rounded rectangle
    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },

    brighten(hex, amount) {
        const rgb = this.hexToRgb(hex);
        return `rgb(${Math.min(255, rgb.r + amount * 255)}, ${Math.min(255, rgb.g + amount * 255)}, ${Math.min(255, rgb.b + amount * 255)})`;
    },

    darken(hex, amount) {
        const rgb = this.hexToRgb(hex);
        return `rgb(${Math.max(0, rgb.r - amount * 255)}, ${Math.max(0, rgb.g - amount * 255)}, ${Math.max(0, rgb.b - amount * 255)})`;
    },

    hexToRgb(hex) {
        if (hex.startsWith('rgb')) {
            const m = hex.match(/(\d+)/g);
            return { r: +m[0], g: +m[1], b: +m[2] };
        }
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return { r: 170, g: 170, b: 187 };
        return {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        };
    }
};
