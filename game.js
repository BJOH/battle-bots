// ============================================
// BATTLE BOTS — Game Logic
// ============================================

// ---- Game State ----
const Game = {
    credits: 1000,
    ownedParts: new Set(),
    robots: [],
    currentRobotIndex: 0,
    currentArena: null,
    currentEnemy: null,

    init() {
        this.load();
        if (this.robots.length === 0) {
            this.robots.push(this.createDefaultRobot());
        }
        this.updateCreditsDisplay();
        this.showScreen('menu');
    },

    createDefaultRobot() {
        // Give starter parts as owned
        const starterParts = ['head_basic', 'torso_basic', 'arms_basic', 'legs_basic', 'weapon_blaster', 'special_none'];
        starterParts.forEach(p => this.ownedParts.add(p));

        return {
            name: 'MK-1',
            parts: {
                head: 'head_basic',
                torso: 'torso_basic',
                arms: 'arms_basic',
                legs: 'legs_basic',
                weapon: 'weapon_blaster',
                special: 'special_none'
            }
        };
    },

    createNewRobot() {
        const robot = {
            name: `MK-${this.robots.length + 1}`,
            parts: {
                head: 'head_basic',
                torso: 'torso_basic',
                arms: 'arms_basic',
                legs: 'legs_basic',
                weapon: 'weapon_blaster',
                special: 'special_none'
            }
        };
        this.robots.push(robot);
        this.currentRobotIndex = this.robots.length - 1;
        this.save();
        this.showScreen('workshop');
    },

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`screen-${screenId}`).classList.add('active');
        this.updateCreditsDisplay();

        if (screenId === 'workshop') Workshop.init();
        if (screenId === 'hangar') Hangar.render();
        if (screenId === 'arena-select') ArenaSelect.render();
    },

    updateCreditsDisplay() {
        document.querySelectorAll('#menu-credits, #workshop-credits').forEach(el => {
            el.textContent = this.credits;
        });
    },

    getCurrentRobot() {
        return this.robots[this.currentRobotIndex];
    },

    calcStats(parts) {
        const totals = { hp: 0, attack: 0, defense: 0, speed: 0, energy: 0 };
        for (const [category, partId] of Object.entries(parts)) {
            const part = this.findPart(category, partId);
            if (part) {
                for (const stat of Object.keys(totals)) {
                    totals[stat] += part.stats[stat];
                }
            }
        }
        // Minimums
        totals.hp = Math.max(totals.hp, 10);
        totals.energy = Math.max(totals.energy, 10);
        totals.speed = Math.max(totals.speed, 1);
        return totals;
    },

    findPart(category, partId) {
        if (!PARTS[category]) return null;
        return PARTS[category].find(p => p.id === partId) || null;
    },

    rematch() {
        if (this.currentArena && this.currentEnemy) {
            Battle.start(this.currentArena, this.currentEnemy);
        }
    },

    save() {
        const data = {
            credits: this.credits,
            ownedParts: [...this.ownedParts],
            robots: this.robots,
            currentRobotIndex: this.currentRobotIndex
        };
        localStorage.setItem('battlebots_save', JSON.stringify(data));
    },

    load() {
        const raw = localStorage.getItem('battlebots_save');
        if (!raw) return;
        try {
            const data = JSON.parse(raw);
            this.credits = data.credits || 1000;
            this.ownedParts = new Set(data.ownedParts || []);
            this.robots = data.robots || [];
            this.currentRobotIndex = data.currentRobotIndex || 0;
        } catch (e) {
            console.warn('Failed to load save:', e);
        }
    }
};

// ---- Hangar ----
const Hangar = {
    render() {
        const list = document.getElementById('hangar-list');
        if (Game.robots.length === 0) {
            list.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px;">No robots yet. Create one!</p>';
            return;
        }

        list.innerHTML = Game.robots.map((robot, i) => {
            const stats = Game.calcStats(robot.parts);
            const isSelected = i === Game.currentRobotIndex;
            return `
                <div class="hangar-card ${isSelected ? 'selected' : ''}" onclick="Hangar.select(${i})">
                    <canvas class="hangar-thumb" width="80" height="90" data-robot-index="${i}"></canvas>
                    <div class="hangar-card-info">
                        <h3>${this.escapeHtml(robot.name)}</h3>
                        <p>HP ${stats.hp} · ATK ${stats.attack} · DEF ${stats.defense} · SPD ${stats.speed}</p>
                    </div>
                    <div class="hangar-card-actions">
                        <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); Hangar.edit(${i})">Edit</button>
                        ${Game.robots.length > 1 ? `<button class="btn btn-small btn-tertiary" onclick="event.stopPropagation(); Hangar.remove(${i})">✕</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Draw thumbnails
        requestAnimationFrame(() => {
            document.querySelectorAll('.hangar-thumb').forEach(canvas => {
                const i = parseInt(canvas.dataset.robotIndex);
                RobotRenderer.draw(canvas, Game.robots[i].parts, { scale: 0.5, offsetY: 5 });
            });
        });
    },

    select(index) {
        Game.currentRobotIndex = index;
        Game.save();
        this.render();
    },

    edit(index) {
        Game.currentRobotIndex = index;
        Game.showScreen('workshop');
    },

    remove(index) {
        if (Game.robots.length <= 1) return;
        Game.robots.splice(index, 1);
        if (Game.currentRobotIndex >= Game.robots.length) {
            Game.currentRobotIndex = Game.robots.length - 1;
        }
        Game.save();
        this.render();
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// ---- Workshop ----
const Workshop = {
    currentCategory: 'head',

    init() {
        const robot = Game.getCurrentRobot();
        document.getElementById('robot-name').value = robot.name;
        this.selectCategory('head');
        this.updatePreview();
        this.updateStats();
    },

    selectCategory(category) {
        this.currentCategory = category;
        document.querySelectorAll('.part-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        this.renderParts();
    },

    renderParts() {
        const robot = Game.getCurrentRobot();
        const list = document.getElementById('parts-list');
        const parts = PARTS[this.currentCategory];

        list.innerHTML = parts.map(part => {
            const owned = Game.ownedParts.has(part.id) || part.cost === 0;
            const equipped = robot.parts[this.currentCategory] === part.id;
            const canAfford = Game.credits >= part.cost;

            return `
                <div class="part-card ${equipped ? 'equipped' : ''} ${!owned && !canAfford ? 'locked' : ''}"
                     onclick="Workshop.selectPart('${part.id}')">
                    <div class="part-icon" style="border: 2px solid ${TIER_COLORS[part.tier]}">${part.icon}</div>
                    <div class="part-info">
                        <h4>${part.name}</h4>
                        <p>${part.description}</p>
                        <div class="part-stats">
                            ${this.renderPartStats(part.stats)}
                        </div>
                    </div>
                    <div class="part-cost ${owned ? 'owned' : ''}">
                        ${equipped ? '✓ Equipped' : owned ? 'Owned' : `⚡${part.cost}`}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderPartStats(stats) {
        return Object.entries(stats)
            .filter(([, v]) => v !== 0)
            .map(([k, v]) => {
                const cls = v > 0 ? 'positive' : 'negative';
                const prefix = v > 0 ? '+' : '';
                return `<span class="part-stat ${cls}">${k.toUpperCase()} ${prefix}${v}</span>`;
            }).join('');
    },

    selectPart(partId) {
        const robot = Game.getCurrentRobot();
        const part = Game.findPart(this.currentCategory, partId);
        if (!part) return;

        const owned = Game.ownedParts.has(part.id) || part.cost === 0;

        if (!owned) {
            if (Game.credits < part.cost) return;
            Game.credits -= part.cost;
            Game.ownedParts.add(part.id);
            Game.updateCreditsDisplay();
        }

        robot.parts[this.currentCategory] = partId;
        Game.save();
        this.renderParts();
        this.updatePreview();
        this.updateStats();
    },

    updatePreview() {
        const robot = Game.getCurrentRobot();
        const canvas = document.getElementById('robot-canvas');
        RobotRenderer.draw(canvas, robot.parts, { scale: 1.3, offsetY: 10 });
    },

    updateStats() {
        const robot = Game.getCurrentRobot();
        const stats = Game.calcStats(robot.parts);
        const container = document.getElementById('total-stats');

        container.innerHTML = Object.entries(stats).map(([key, val]) => {
            const max = STAT_MAX[key];
            const pct = Math.min(100, (val / max) * 100);
            return `
                <div class="stat-row">
                    <span class="stat-label">${key}</span>
                    <div class="stat-bar-bg">
                        <div class="stat-bar-fill ${key}" style="width: ${pct}%"></div>
                    </div>
                    <span class="stat-value">${val}</span>
                </div>
            `;
        }).join('');
    },

    saveRobot() {
        const robot = Game.getCurrentRobot();
        const nameInput = document.getElementById('robot-name');
        robot.name = nameInput.value.trim() || 'Unnamed';
        Game.save();
        Game.showScreen('menu');
    }
};

// ---- Arena Select ----
const ArenaSelect = {
    render() {
        const list = document.getElementById('arena-list');
        list.innerHTML = ARENAS.map(arena => {
            return `
                <div class="arena-card" onclick="ArenaSelect.select('${arena.id}')" style="border-left: 4px solid ${arena.color}">
                    <h3>${arena.name}</h3>
                    <div class="difficulty">${arena.difficulty}</div>
                    <p style="color: var(--text-dim); margin-bottom: 8px;">${arena.description}</p>
                    <div class="reward">⚡ ${arena.reward} credits</div>
                </div>
            `;
        }).join('');
    },

    select(arenaId) {
        const arena = ARENAS.find(a => a.id === arenaId);
        if (!arena) return;
        const enemy = arena.enemies[Math.floor(Math.random() * arena.enemies.length)];
        Game.currentArena = arena;
        Game.currentEnemy = enemy;
        Battle.start(arena, enemy);
    }
};

// ---- Battle System ----
const Battle = {
    player: null,
    enemy: null,
    round: 0,
    isPlayerTurn: true,
    battleOver: false,
    playerDefending: false,
    enemyDefending: false,
    playerBuffs: {},
    enemyBuffs: {},
    aiLevel: 0.5,

    start(arena, enemyTemplate) {
        const playerRobot = Game.getCurrentRobot();
        const playerStats = Game.calcStats(playerRobot.parts);
        const enemyStats = Game.calcStats(enemyTemplate.parts);

        this.player = {
            name: playerRobot.name,
            parts: { ...playerRobot.parts },
            maxHp: playerStats.hp,
            hp: playerStats.hp,
            maxEnergy: playerStats.energy,
            energy: playerStats.energy,
            attack: playerStats.attack,
            defense: playerStats.defense,
            speed: playerStats.speed
        };

        this.enemy = {
            name: enemyTemplate.name,
            parts: { ...enemyTemplate.parts },
            maxHp: enemyStats.hp,
            hp: enemyStats.hp,
            maxEnergy: enemyStats.energy,
            energy: enemyStats.energy,
            attack: enemyStats.attack,
            defense: enemyStats.defense,
            speed: enemyStats.speed
        };

        this.round = 1;
        this.battleOver = false;
        this.playerDefending = false;
        this.enemyDefending = false;
        this.playerBuffs = {};
        this.enemyBuffs = {};
        this.aiLevel = arena.aiLevel;

        Game.showScreen('battle');
        this.updateHUD();
        this.drawBattleScene();
        this.clearLog();
        this.log(`Battle begins! ${this.player.name} vs ${this.enemy.name}`, 'info');

        // Determine first turn by speed
        this.isPlayerTurn = this.player.speed >= this.enemy.speed;
        if (!this.isPlayerTurn) {
            this.log(`${this.enemy.name} is faster and strikes first!`, 'info');
            this.setActionsEnabled(false);
            setTimeout(() => this.enemyTurn(), 1000);
        } else {
            this.setActionsEnabled(true);
        }
    },

    doAction(action) {
        if (this.battleOver || !this.isPlayerTurn) return;
        this.setActionsEnabled(false);
        this.playerDefending = false;

        switch (action) {
            case 'attack': this.performAttack(this.player, this.enemy, false); break;
            case 'defend': this.performDefend(this.player, true); break;
            case 'special': this.performSpecial(this.player, this.enemy, true); break;
            case 'repair': this.performRepair(this.player, true); break;
        }

        this.updateHUD();
        this.drawBattleScene();

        if (this.checkBattleEnd()) return;

        // Enemy turn
        this.isPlayerTurn = false;
        setTimeout(() => this.enemyTurn(), 800);
    },

    enemyTurn() {
        if (this.battleOver) return;
        this.enemyDefending = false;

        const action = this.chooseEnemyAction();

        switch (action) {
            case 'attack': this.performAttack(this.enemy, this.player, false); break;
            case 'defend': this.performDefend(this.enemy, false); break;
            case 'special': this.performSpecial(this.enemy, this.player, false); break;
            case 'repair': this.performRepair(this.enemy, false); break;
        }

        this.updateHUD();
        this.drawBattleScene();

        if (this.checkBattleEnd()) return;

        this.round++;
        document.getElementById('battle-round').textContent = `Round ${this.round}`;

        // Tick buffs
        this.tickBuffs();

        this.isPlayerTurn = true;
        this.setActionsEnabled(true);
    },

    chooseEnemyAction() {
        const e = this.enemy;
        const p = this.player;
        const special = Game.findPart('special', e.parts.special);
        const hasSpecial = special && special.ability;
        const canSpecial = hasSpecial && e.energy >= special.ability.energyCost;
        const hpRatio = e.hp / e.maxHp;

        // Smart AI based on aiLevel
        if (Math.random() < this.aiLevel) {
            // Strategic choice
            if (hpRatio < 0.3 && e.energy >= 15) return 'repair';
            if (canSpecial && hpRatio > 0.5) return 'special';
            if (p.attack > e.defense * 1.5 && !this.enemyDefending) return 'defend';
            return 'attack';
        }

        // Random choice
        const actions = ['attack', 'attack', 'defend'];
        if (canSpecial) actions.push('special');
        if (hpRatio < 0.7) actions.push('repair');
        return actions[Math.floor(Math.random() * actions.length)];
    },

    performAttack(attacker, defender, isPlayer) {
        let damage = Math.max(1, attacker.attack - defender.defense * 0.5);

        // Overcharge buff
        const buffs = isPlayer ? this.playerBuffs : this.enemyBuffs;
        if (buffs.overcharge) {
            damage *= 2;
            delete buffs.overcharge;
            this.log(`${attacker.name}'s overcharged attack!`, 'damage');
        }

        // Defending reduces damage
        const isDefending = isPlayer ? this.enemyDefending : this.playerDefending;
        if (isDefending) {
            damage *= 0.4;
        }

        // Shield buff on defender
        const defBuffs = isPlayer ? this.enemyBuffs : this.playerBuffs;
        if (defBuffs.shield) {
            damage *= (1 - defBuffs.shield.reduction);
        }

        // Randomize slightly
        damage = Math.round(damage * (0.85 + Math.random() * 0.3));
        damage = Math.max(1, damage);

        defender.hp = Math.max(0, defender.hp - damage);
        this.log(`${attacker.name} attacks for ${damage} damage!`, 'damage');

        // Shake animation
        this.shakeRobot(!isPlayer);
    },

    performDefend(fighter, isPlayer) {
        if (isPlayer) {
            this.playerDefending = true;
        } else {
            this.enemyDefending = true;
        }
        this.log(`${fighter.name} takes a defensive stance!`, 'info');
        // Recover a bit of energy
        fighter.energy = Math.min(fighter.maxEnergy, fighter.energy + 5);
    },

    performSpecial(attacker, defender, isPlayer) {
        const specialPart = Game.findPart('special', attacker.parts.special);
        if (!specialPart || !specialPart.ability) {
            this.log(`${attacker.name} has no special module!`, 'info');
            this.performAttack(attacker, defender, isPlayer);
            return;
        }

        const ability = specialPart.ability;
        if (attacker.energy < ability.energyCost) {
            this.log(`${attacker.name} doesn't have enough energy! Attacking instead.`, 'info');
            this.performAttack(attacker, defender, isPlayer);
            return;
        }

        attacker.energy -= ability.energyCost;
        const buffs = isPlayer ? this.playerBuffs : this.enemyBuffs;

        switch (ability.type) {
            case 'shield':
                buffs.shield = { reduction: ability.reduction, turns: ability.duration };
                this.log(`${attacker.name} activates energy shield!`, 'info');
                break;
            case 'overcharge':
                buffs.overcharge = true;
                this.log(`${attacker.name} overcharges weapons! Next attack deals 2x damage!`, 'info');
                break;
            case 'repair_boost': {
                const heal = Math.round(attacker.maxHp * 0.3 * ability.healMultiplier);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                this.log(`${attacker.name}'s nanobots restore ${heal} HP!`, 'heal');
                break;
            }
            case 'emp': {
                const drain = Math.min(defender.energy, ability.energyDrain);
                defender.energy -= drain;
                this.log(`${attacker.name} fires EMP! Drained ${drain} energy from ${defender.name}!`, 'damage');
                this.shakeRobot(!isPlayer);
                break;
            }
            case 'singularity': {
                const dmg = ability.damage;
                defender.hp = Math.max(0, defender.hp - dmg);
                attacker.hp = Math.max(1, attacker.hp - ability.selfDamage);
                this.log(`${attacker.name} unleashes a singularity for ${dmg} damage! (${ability.selfDamage} self-damage)`, 'damage');
                this.shakeRobot(!isPlayer);
                break;
            }
        }
    },

    performRepair(fighter, isPlayer) {
        const energyCost = 15;
        if (fighter.energy < energyCost) {
            this.log(`${fighter.name} doesn't have enough energy to repair!`, 'info');
            return;
        }
        fighter.energy -= energyCost;
        const heal = Math.round(fighter.maxHp * 0.2);
        fighter.hp = Math.min(fighter.maxHp, fighter.hp + heal);
        this.log(`${fighter.name} repairs for ${heal} HP!`, 'heal');
    },

    tickBuffs() {
        for (const buffs of [this.playerBuffs, this.enemyBuffs]) {
            if (buffs.shield) {
                buffs.shield.turns--;
                if (buffs.shield.turns <= 0) delete buffs.shield;
            }
        }
    },

    checkBattleEnd() {
        if (this.enemy.hp <= 0) {
            this.battleOver = true;
            this.log(`${this.enemy.name} destroyed!`, 'info');
            setTimeout(() => this.showResult(true), 1000);
            return true;
        }
        if (this.player.hp <= 0) {
            this.battleOver = true;
            this.log(`${this.player.name} destroyed!`, 'info');
            setTimeout(() => this.showResult(false), 1000);
            return true;
        }
        return false;
    },

    showResult(victory) {
        const title = document.getElementById('result-title');
        const details = document.getElementById('result-details');

        if (victory) {
            const reward = Game.currentArena.reward;
            Game.credits += reward;
            Game.save();

            title.textContent = 'VICTORY!';
            title.className = 'result-title victory';
            details.innerHTML = `
                <p>${this.player.name} defeated ${this.enemy.name} in ${this.round} rounds!</p>
                <p class="reward-line">⚡ +${reward} Credits</p>
                <p>Total: ⚡ ${Game.credits} Credits</p>
            `;
        } else {
            title.textContent = 'DEFEATED';
            title.className = 'result-title defeat';
            details.innerHTML = `
                <p>${this.player.name} was destroyed by ${this.enemy.name}.</p>
                <p>Upgrade your robot and try again!</p>
            `;
        }

        Game.showScreen('result');
    },

    // ---- HUD ----
    updateHUD() {
        const p = this.player;
        const e = this.enemy;

        document.getElementById('player-name').textContent = p.name;
        document.getElementById('enemy-name').textContent = e.name;

        this.updateBar('player-hp-bar', p.hp, p.maxHp);
        this.updateBar('enemy-hp-bar', e.hp, e.maxHp);
        this.updateBar('player-energy-bar', p.energy, p.maxEnergy);
        this.updateBar('enemy-energy-bar', e.energy, e.maxEnergy);

        document.getElementById('player-hp-text').textContent = `${Math.round(p.hp)}/${p.maxHp}`;
        document.getElementById('enemy-hp-text').textContent = `${Math.round(e.hp)}/${e.maxHp}`;
        document.getElementById('player-energy-text').textContent = `${Math.round(p.energy)}/${p.maxEnergy}`;
        document.getElementById('enemy-energy-text').textContent = `${Math.round(e.energy)}/${e.maxEnergy}`;
    },

    updateBar(id, current, max) {
        const pct = Math.max(0, (current / max) * 100);
        document.getElementById(id).style.width = pct + '%';
    },

    setActionsEnabled(enabled) {
        document.querySelectorAll('.btn-action').forEach(btn => {
            btn.disabled = !enabled;
        });
    },

    // ---- Battle Canvas ----
    drawBattleScene() {
        const canvas = document.getElementById('battle-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Floor line
        ctx.strokeStyle = '#2a3a5c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 230);
        ctx.lineTo(600, 230);
        ctx.stroke();

        // Draw player robot (left)
        if (this.player) {
            RobotRenderer.draw(canvas, this.player.parts, {
                scale: 1.0,
                offsetX: -140,
                offsetY: -15,
                noClear: true
            });
        }

        // Draw enemy robot (right, flipped)
        if (this.enemy) {
            RobotRenderer.draw(canvas, this.enemy.parts, {
                scale: 1.0,
                offsetX: 140,
                offsetY: -15,
                flip: true,
                noClear: true
            });
        }
    },

    shakeRobot(isEnemy) {
        const canvas = document.getElementById('battle-canvas');
        canvas.classList.add('shake');
        setTimeout(() => canvas.classList.remove('shake'), 300);
    },

    // ---- Battle Log ----
    log(message, type = 'info') {
        const log = document.getElementById('battle-log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    },

    clearLog() {
        document.getElementById('battle-log').innerHTML = '';
    }
};

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => Game.init());
