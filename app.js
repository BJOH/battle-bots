// ============================================
// BATTLE BOTS — Main App v2
// ============================================

const SUPABASE_URL = 'https://ktestgtfkpdelyuvmsvu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SspMLcmM3Wgec_8pRoTbsg_JI7mbyoN';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- State ----
const State = {
    user: null,
    profile: null,
    robot: null,
    pendingMatchId: null,
    isNewUser: false,
};

// ---- Auth ----
const Auth = {
    showingSignup: true,

    async init() {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            State.user = session.user;
            const username = session.user.user_metadata?.username || 'Bot_' + session.user.id.slice(0, 8);
            await this.ensureProfile(username);
            await this.loadProfile();
            this.routeAfterAuth();
            return;
        }
        const hash = window.location.hash;
        if (hash.startsWith('#/match/')) {
            State.pendingMatchId = hash.split('/')[2];
        }
        App.showScreen('auth');
    },

    toggleForm() {
        this.showingSignup = !this.showingSignup;
        document.getElementById('auth-form-signup').style.display = this.showingSignup ? '' : 'none';
        document.getElementById('auth-form-login').style.display = this.showingSignup ? 'none' : '';
        document.getElementById('auth-error').textContent = '';
    },

    async signUp() {
        const username = document.getElementById('auth-username').value.trim();
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errEl = document.getElementById('auth-error');

        if (!username || username.length < 2) { errEl.textContent = 'Username must be at least 2 characters'; return; }
        if (!email) { errEl.textContent = 'Email is required'; return; }
        if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; return; }

        errEl.textContent = 'Creating account...';
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
        if (error) { errEl.textContent = error.message; return; }

        if (data.user) {
            State.user = data.user;
            await this.ensureProfile(username);
            await this.loadProfile();
            State.isNewUser = true;
            this.routeAfterAuth();
        }
    },

    async logIn() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errEl = document.getElementById('auth-error');

        if (!email || !password) { errEl.textContent = 'Email and password required'; return; }
        errEl.textContent = 'Logging in...';

        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) { errEl.textContent = error.message; return; }

        State.user = data.user;
        const username = data.user.user_metadata?.username || 'Bot_' + data.user.id.slice(0, 8);
        await this.ensureProfile(username);
        await this.loadProfile();
        this.routeAfterAuth();
    },

    async logOut() {
        await sb.auth.signOut();
        State.user = null;
        State.profile = null;
        State.robot = null;
        App.showScreen('auth');
    },

    async ensureProfile(username) {
        const { data: existing } = await sb.from('profiles').select('id').eq('id', State.user.id).single();
        if (existing) return;
        await sb.from('profiles').insert({ id: State.user.id, username });
    },

    async loadProfile() {
        const { data } = await sb.from('profiles').select('*').eq('id', State.user.id).single();
        if (data) {
            State.profile = data;
            State.robot = data.avatar_robot || null;
        }
    },

    routeAfterAuth() {
        // If no robot built yet, force workshop
        if (!State.robot) {
            State.isNewUser = true;
            Workshop.startOnboarding();
            return;
        }

        const hash = window.location.hash;
        if (hash.startsWith('#/match/')) {
            JoinMatch.load(hash.split('/')[2]);
        } else if (State.pendingMatchId) {
            JoinMatch.load(State.pendingMatchId);
            State.pendingMatchId = null;
        } else {
            App.showScreen('menu');
        }
    }
};

// ---- App ----
const App = {
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`screen-${screenId}`).classList.add('active');

        if (screenId === 'menu') this.refreshMenu();
        if (screenId === 'workshop') Workshop.init();
        if (screenId === 'matches') MatchesList.load();
        if (screenId === 'leaderboard') Leaderboard.load();
    },

    refreshMenu() {
        if (State.profile) {
            document.getElementById('menu-username').textContent = State.profile.username;
            document.getElementById('menu-wins').textContent = State.profile.wins || 0;
            document.getElementById('menu-losses').textContent = State.profile.losses || 0;

            const belt = getBelt(State.profile.wins || 0);
            const beltEl = document.getElementById('menu-belt');
            beltEl.textContent = belt.name;
            beltEl.style.color = belt.color;
            beltEl.style.background = belt.bg;
            beltEl.style.borderColor = belt.color;
        }
    },

    createChallenge() {
        if (!State.robot) {
            Workshop.startOnboarding();
            return;
        }
        ChooseMoves.start();
    },

    copyLink() {
        const input = document.getElementById('share-link');
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
            document.getElementById('copy-feedback').textContent = 'Copied!';
            setTimeout(() => document.getElementById('copy-feedback').textContent = '', 2000);
        }).catch(() => {
            document.getElementById('copy-feedback').textContent = 'Tap and hold to copy';
        });
    },

    shareByEmail() {
        const link = document.getElementById('share-link').value;
        const subject = encodeURIComponent(`${State.profile.username} challenged you to Battle Bots!`);
        const body = encodeURIComponent(`I'm challenging you to a robot battle!\n\nClick here to fight: ${link}\n\nBuild your robot and choose your strategy. Let's see who wins!`);
        window.open(`mailto:?subject=${subject}&body=${body}`);
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
};

// ---- Workshop ----
const Workshop = {
    currentCategory: 'head',
    onboarding: false,
    onboardingStep: 0,
    STEPS: ['head', 'torso', 'arms', 'legs', 'weapon', 'special'],

    startOnboarding() {
        this.onboarding = true;
        this.onboardingStep = 0;
        State.robot = { name: 'MK-1', parts: {} };
        App.showScreen('workshop');
        document.getElementById('workshop-back-btn').style.display = 'none';
        document.getElementById('workshop-save-btn').textContent = 'Next →';
        this.selectCategory(this.STEPS[0]);
        this.updateStepIndicator();
    },

    init() {
        if (!this.onboarding) {
            document.getElementById('workshop-back-btn').style.display = '';
            document.getElementById('workshop-save-btn').textContent = 'Save Robot';
            document.getElementById('workshop-steps').innerHTML = '';
        }
        if (State.robot) {
            document.getElementById('robot-name').value = State.robot.name || 'MK-1';
        }
        this.selectCategory(this.onboarding ? this.STEPS[this.onboardingStep] : 'head');
        this.updatePreview();
    },

    updateStepIndicator() {
        const el = document.getElementById('workshop-steps');
        if (!this.onboarding) { el.innerHTML = ''; return; }
        el.innerHTML = this.STEPS.map((step, i) => {
            const cls = i < this.onboardingStep ? 'done' : i === this.onboardingStep ? 'active' : '';
            return `<span class="step-dot ${cls}"></span>`;
        }).join('');
    },

    selectCategory(category) {
        this.currentCategory = category;
        document.querySelectorAll('.part-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        if (this.onboarding) {
            document.querySelectorAll('.part-tab').forEach(tab => {
                tab.style.pointerEvents = tab.dataset.category === category ? '' : 'none';
                tab.style.opacity = tab.dataset.category === category ? '1' : '0.3';
            });
        } else {
            document.querySelectorAll('.part-tab').forEach(tab => {
                tab.style.pointerEvents = '';
                tab.style.opacity = '';
            });
        }
        this.renderParts();
    },

    renderParts() {
        const list = document.getElementById('parts-list');
        const parts = PARTS[this.currentCategory];

        list.innerHTML = parts.map(part => {
            const equipped = State.robot && State.robot.parts[this.currentCategory] === part.id;
            return `
                <div class="part-card ${equipped ? 'equipped' : ''}" onclick="Workshop.selectPart('${part.id}')">
                    <div class="part-icon" style="border: 2px solid ${TIER_COLORS[part.tier]}">${part.icon}</div>
                    <div class="part-info">
                        <h4>${part.name}</h4>
                        <p>${part.description}</p>
                    </div>
                    ${equipped ? '<span class="part-equipped-label">✓</span>' : ''}
                </div>
            `;
        }).join('');
    },

    selectPart(partId) {
        if (!State.robot) State.robot = { name: 'MK-1', parts: {} };
        State.robot.parts[this.currentCategory] = partId;
        this.renderParts();
        this.updatePreview();
    },

    updatePreview() {
        const canvas = document.getElementById('robot-canvas');
        const displayParts = { ...DEFAULT_PARTS, ...(State.robot ? State.robot.parts : {}) };
        RobotRenderer.draw(canvas, getRenderParts(displayParts), { scale: 1.3, offsetY: 10 });

        const sizeClass = getRobotSizeClass(displayParts);
        const badge = document.getElementById('size-class-badge');
        badge.textContent = sizeClass.toUpperCase();
        badge.className = `size-class-badge ${sizeClass}`;
    },

    async saveRobot() {
        if (!State.robot) return;
        State.robot.name = document.getElementById('robot-name').value.trim() || 'MK-1';

        if (this.onboarding) {
            if (!State.robot.parts[this.currentCategory]) {
                // Must pick a part
                return;
            }
            this.onboardingStep++;
            if (this.onboardingStep < this.STEPS.length) {
                this.selectCategory(this.STEPS[this.onboardingStep]);
                this.updateStepIndicator();
                if (this.onboardingStep === this.STEPS.length - 1) {
                    document.getElementById('workshop-save-btn').textContent = 'Finish Build';
                }
                return;
            }
            // Onboarding complete — fill in any missing parts with defaults
            for (const [key, val] of Object.entries(DEFAULT_PARTS)) {
                if (!State.robot.parts[key]) State.robot.parts[key] = val;
            }
            this.onboarding = false;
            document.getElementById('workshop-back-btn').style.display = '';
            document.getElementById('workshop-save-btn').textContent = 'Save Robot';
            document.querySelectorAll('.part-tab').forEach(tab => {
                tab.style.pointerEvents = '';
                tab.style.opacity = '';
            });
            document.getElementById('workshop-steps').innerHTML = '';
        }

        await sb.from('profiles').update({ avatar_robot: State.robot }).eq('id', State.user.id);
        App.showScreen('menu');
    }
};

// ---- Round Chooser UI (shared between create & join) ----
function buildRoundsUI(containerId, prefix) {
    const container = document.getElementById(containerId);
    container.innerHTML = [1, 2, 3].map(r => `
        <div class="round-block">
            <h3>Round ${r}</h3>
            <div class="attack-defense-row">
                <div class="choice-group">
                    <label>Attack</label>
                    <div class="position-buttons">
                        ${POSITIONS.map(p => `
                            <button class="pos-btn attack-btn" data-round="${r}" data-type="attack" data-pos="${p}"
                                onclick="${prefix}.pick(${r},'attack','${p}', this)">
                                ${POSITION_ICONS[p]}<span>${POSITION_LABELS[p]}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="choice-group">
                    <label>Defense</label>
                    <div class="position-buttons">
                        ${POSITIONS.map(p => `
                            <button class="pos-btn defense-btn" data-round="${r}" data-type="defense" data-pos="${p}"
                                onclick="${prefix}.pick(${r},'defense','${p}', this)">
                                ${POSITION_ICONS[p]}<span>${POSITION_LABELS[p]}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// ---- Choose Moves (Create Challenge) ----
const ChooseMoves = {
    choices: [{}, {}, {}],

    start() {
        this.choices = [{}, {}, {}];
        buildRoundsUI('rounds-chooser', 'ChooseMoves');
        document.getElementById('commit-btn').disabled = true;
        document.getElementById('commit-btn').textContent = 'Lock In Strategy';
        App.showScreen('choose');
    },

    pick(round, type, pos, btn) {
        this.choices[round - 1][type] = pos;
        // Highlight selected
        const siblings = btn.parentElement.querySelectorAll('.pos-btn');
        siblings.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        // Check if all chosen
        const allChosen = this.choices.every(c => c.attack && c.defense);
        document.getElementById('commit-btn').disabled = !allChosen;
    },

    async commit() {
        const btn = document.getElementById('commit-btn');
        btn.disabled = true;
        btn.textContent = 'Creating challenge...';

        const { data, error } = await sb.from('matches').insert({
            challenger_id: State.user.id,
            challenger_robot: State.robot,
            challenger_choices: this.choices
        }).select().single();

        if (error) { btn.textContent = 'Error: ' + error.message; return; }
        btn.textContent = 'Lock In Strategy';

        const baseUrl = window.location.origin + window.location.pathname;
        document.getElementById('share-link').value = `${baseUrl}#/match/${data.id}`;
        document.getElementById('copy-feedback').textContent = '';
        App.showScreen('challenge-created');
    }
};

// ---- Join Match ----
const JoinMatch = {
    matchData: null,
    choices: [{}, {}, {}],

    async load(matchId) {
        const { data, error } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username, wins)')
            .eq('id', matchId).single();

        if (error || !data) { alert('Match not found!'); App.showScreen('menu'); return; }

        if (data.status === 'complete') {
            BattlePlayback.playMatch(data);
            return;
        }

        if (data.challenger_id === State.user.id) {
            const baseUrl = window.location.origin + window.location.pathname;
            document.getElementById('share-link').value = `${baseUrl}#/match/${matchId}`;
            App.showScreen('challenge-created');
            return;
        }

        if (!State.robot) {
            State.pendingMatchId = matchId;
            Workshop.startOnboarding();
            return;
        }

        this.matchData = data;
        this.choices = [{}, {}, {}];

        // Show challenger info
        const belt = getBelt(data.challenger?.wins || 0);
        document.getElementById('challenger-info').innerHTML = `
            <canvas id="challenger-robot-preview" width="80" height="90"></canvas>
            <div class="info">
                <h3>${App.escapeHtml(data.challenger?.username)}</h3>
                <p>${App.escapeHtml(data.challenger_robot?.name || 'MK-1')}</p>
                <span class="belt-badge small" style="color:${belt.color};background:${belt.bg};border-color:${belt.color}">${belt.name}</span>
            </div>
        `;

        requestAnimationFrame(() => {
            const canvas = document.getElementById('challenger-robot-preview');
            if (canvas && data.challenger_robot) {
                RobotRenderer.draw(canvas, getRenderParts(data.challenger_robot.parts), { scale: 0.5, offsetY: 5 });
            }
        });

        // Head-to-head record
        await this.loadH2H(data.challenger_id);

        buildRoundsUI('join-rounds-chooser', 'JoinMatch');
        document.getElementById('join-commit-btn').disabled = true;
        document.getElementById('join-commit-btn').textContent = '⚔️ Accept Challenge';
        App.showScreen('join');
    },

    async loadH2H(opponentId) {
        const el = document.getElementById('h2h-record');
        const { data } = await sb.from('matches')
            .select('winner_id')
            .eq('status', 'complete')
            .or(`and(challenger_id.eq.${State.user.id},opponent_id.eq.${opponentId}),and(challenger_id.eq.${opponentId},opponent_id.eq.${State.user.id})`);

        if (!data || data.length === 0) {
            el.innerHTML = '<p class="text-dim">First match against this opponent!</p>';
            return;
        }

        let myWins = 0, theirWins = 0, draws = 0;
        for (const m of data) {
            if (m.winner_id === State.user.id) myWins++;
            else if (m.winner_id === null) draws++;
            else theirWins++;
        }
        el.innerHTML = `<p class="h2h-text">Head-to-head: <span class="h2h-wins">${myWins}W</span> - <span class="h2h-draws">${draws}D</span> - <span class="h2h-losses">${theirWins}L</span></p>`;
    },

    pick(round, type, pos, btn) {
        this.choices[round - 1][type] = pos;
        const siblings = btn.parentElement.querySelectorAll('.pos-btn');
        siblings.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const allChosen = this.choices.every(c => c.attack && c.defense);
        document.getElementById('join-commit-btn').disabled = !allChosen;
    },

    async commit() {
        const btn = document.getElementById('join-commit-btn');
        btn.disabled = true;
        btn.textContent = 'Resolving match...';

        const { data, error } = await sb.rpc('join_match', {
            p_match_id: this.matchData.id,
            p_choices: this.choices,
            p_robot: State.robot
        });

        if (error) { btn.textContent = 'Error: ' + error.message; btn.disabled = false; return; }
        btn.textContent = '⚔️ Accept Challenge';

        const { data: match } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username, wins), opponent:profiles!opponent_id(username, wins)')
            .eq('id', this.matchData.id).single();

        if (match) {
            await Auth.loadProfile();
            BattlePlayback.playMatch(match);
        }
    }
};

// ---- Matches List ----
const MatchesList = {
    async load() {
        const list = document.getElementById('matches-list');
        list.innerHTML = '<p class="text-dim" style="padding:40px">Loading...</p>';

        const { data } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username), opponent:profiles!opponent_id(username)')
            .or(`challenger_id.eq.${State.user.id},opponent_id.eq.${State.user.id}`)
            .order('created_at', { ascending: false }).limit(30);

        if (!data || data.length === 0) {
            list.innerHTML = '<p class="text-dim" style="padding:40px">No matches yet. Create a challenge!</p>';
            return;
        }

        list.innerHTML = data.map(match => {
            const isChallenger = match.challenger_id === State.user.id;
            const opponentName = isChallenger
                ? (match.opponent?.username || 'Waiting...')
                : (match.challenger?.username || 'Unknown');

            let statusClass, statusText;
            if (match.status === 'waiting') {
                statusClass = 'waiting';
                statusText = 'Waiting for opponent';
            } else {
                // Don't spoil the result — say "Watch match" instead
                statusClass = 'ready';
                statusText = 'Match ready — watch now!';
            }

            return `
                <div class="match-card" onclick="MatchesList.viewMatch('${match.id}')">
                    <h3>vs ${App.escapeHtml(opponentName)}</h3>
                    <div class="match-status ${statusClass}">${statusText}</div>
                </div>
            `;
        }).join('');
    },

    async viewMatch(matchId) {
        const { data } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username, wins), opponent:profiles!opponent_id(username, wins)')
            .eq('id', matchId).single();

        if (data && data.status === 'complete') {
            BattlePlayback.playMatch(data);
        } else if (data && data.status === 'waiting') {
            const baseUrl = window.location.origin + window.location.pathname;
            document.getElementById('share-link').value = `${baseUrl}#/match/${matchId}`;
            App.showScreen('challenge-created');
        }
    }
};

// ---- Leaderboard ----
const Leaderboard = {
    async load() {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '<p class="text-dim" style="padding:40px">Loading...</p>';

        const { data } = await sb.from('profiles')
            .select('id, username, wins, losses')
            .order('wins', { ascending: false }).limit(50);

        if (!data || data.length === 0) {
            list.innerHTML = '<p class="text-dim" style="padding:40px">No players yet.</p>';
            return;
        }

        list.innerHTML = data.map((player, i) => {
            const belt = getBelt(player.wins);
            const isYou = player.id === State.user?.id;
            const rank = i + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

            return `
                <div class="leaderboard-row ${isYou ? 'is-you' : ''}">
                    <span class="lb-rank">${medal}</span>
                    <span class="lb-name">${App.escapeHtml(player.username)}${isYou ? ' (you)' : ''}</span>
                    <span class="belt-badge small" style="color:${belt.color};background:${belt.bg};border-color:${belt.color}">${belt.name}</span>
                    <span class="lb-record">${player.wins}W ${player.losses}L</span>
                </div>
            `;
        }).join('');
    }
};

// ---- Battle Playback ----
const BattlePlayback = {
    matchData: null,
    roundResults: null,
    currentRound: 0,
    playerScore: 0,
    opponentScore: 0,
    isChallenger: false,

    playMatch(match) {
        this.matchData = match;
        this.roundResults = match.round_results || [];
        this.currentRound = 0;
        this.playerScore = 0;
        this.opponentScore = 0;
        this.isChallenger = match.challenger_id === State.user?.id;

        const playerName = this.isChallenger ? match.challenger?.username : match.opponent?.username;
        const opponentName = this.isChallenger ? match.opponent?.username : match.challenger?.username;
        const playerRobot = this.isChallenger ? match.challenger_robot : match.opponent_robot;
        const opponentRobot = this.isChallenger ? match.opponent_robot : match.challenger_robot;

        document.getElementById('battle-player-name').textContent = playerName || 'You';
        document.getElementById('battle-opponent-name').textContent = opponentName || 'Opponent';
        document.getElementById('battle-player-score').textContent = '0';
        document.getElementById('battle-opponent-score').textContent = '0';

        requestAnimationFrame(() => {
            const pc = document.getElementById('battle-player-canvas');
            const oc = document.getElementById('battle-opponent-canvas');
            if (playerRobot) RobotRenderer.draw(pc, getRenderParts(playerRobot.parts), { scale: 0.55, offsetY: 5 });
            if (opponentRobot) RobotRenderer.draw(oc, getRenderParts(opponentRobot.parts), { scale: 0.55, offsetY: 5 });
        });

        this.drawBattleScene(playerRobot, opponentRobot);
        document.getElementById('round-display').innerHTML = '<p class="text-dim">Get ready...</p>';
        App.showScreen('battle');

        setTimeout(() => this.playNextRound(), 1500);
    },

    drawBattleScene(playerRobot, opponentRobot) {
        const canvas = document.getElementById('battle-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#2a3a5c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 270);
        ctx.lineTo(600, 270);
        ctx.stroke();

        if (playerRobot) {
            RobotRenderer.draw(canvas, getRenderParts(playerRobot.parts), {
                scale: 1.0, offsetX: -140, offsetY: -10, noClear: true
            });
        }
        if (opponentRobot) {
            RobotRenderer.draw(canvas, getRenderParts(opponentRobot.parts), {
                scale: 1.0, offsetX: 140, offsetY: -10, flip: true, noClear: true
            });
        }
    },

    playNextRound() {
        if (this.currentRound >= this.roundResults.length) {
            this.showFinisher();
            return;
        }

        const round = this.roundResults[this.currentRound];
        const display = document.getElementById('round-display');

        // Determine from perspective of current user
        const playerAttack = this.isChallenger ? round.challenger_attack : round.opponent_attack;
        const playerDefense = this.isChallenger ? round.challenger_defense : round.opponent_defense;
        const opponentAttack = this.isChallenger ? round.opponent_attack : round.challenger_attack;
        const opponentDefense = this.isChallenger ? round.opponent_defense : round.challenger_defense;
        const playerHit = this.isChallenger ? round.challenger_hit : round.opponent_hit;
        const opponentHit = this.isChallenger ? round.opponent_hit : round.challenger_hit;

        // Show round starting
        display.innerHTML = `<div class="round-label">Round ${this.currentRound + 1}</div><div class="round-subtitle">Engaging...</div>`;

        // Animate the battle canvas
        const canvas = document.getElementById('battle-canvas');
        const playerRobot = this.isChallenger ? this.matchData.challenger_robot : this.matchData.opponent_robot;
        const opponentRobot = this.isChallenger ? this.matchData.opponent_robot : this.matchData.challenger_robot;
        const weaponType = playerRobot ? getWeaponType(playerRobot.parts) : 'energy';
        const oppWeaponType = opponentRobot ? getWeaponType(opponentRobot.parts) : 'energy';

        // After short delay, show attacks
        setTimeout(() => {
            // Draw attack animations on canvas
            this.animateRoundAttack(canvas, playerAttack, opponentAttack, playerDefense, opponentDefense, playerHit, opponentHit, weaponType, oppWeaponType, playerRobot, opponentRobot);

            // Show results
            const yourResult = playerHit ? '💥 HIT!' : '🛡️ BLOCKED';
            const theirResult = opponentHit ? '💥 HIT!' : '🛡️ BLOCKED';

            if (playerHit) this.playerScore++;
            if (opponentHit) this.opponentScore++;

            document.getElementById('battle-player-score').textContent = this.playerScore;
            document.getElementById('battle-opponent-score').textContent = this.opponentScore;

            display.innerHTML = `
                <div class="round-label">Round ${this.currentRound + 1}</div>
                <div class="round-attacks">
                    <div class="round-attack-col">
                        <div class="atk-label">Your ATK ${POSITION_ICONS[playerAttack]}</div>
                        <div class="atk-result ${playerHit ? 'hit' : 'blocked'}">${yourResult}</div>
                    </div>
                    <div class="round-vs">vs</div>
                    <div class="round-attack-col">
                        <div class="atk-label">Their ATK ${POSITION_ICONS[opponentAttack]}</div>
                        <div class="atk-result ${opponentHit ? 'hit' : 'blocked'}">${theirResult}</div>
                    </div>
                </div>
            `;

            canvas.classList.add('shake');
            setTimeout(() => canvas.classList.remove('shake'), 300);

            this.currentRound++;
            setTimeout(() => this.playNextRound(), 2500);
        }, 1000);
    },

    animateRoundAttack(canvas, pAtk, oAtk, pDef, oDef, pHit, oHit, pWeapon, oWeapon, pRobot, oRobot) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Floor
        ctx.strokeStyle = '#2a3a5c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 270);
        ctx.lineTo(600, 270);
        ctx.stroke();

        // Draw robots
        if (pRobot) RobotRenderer.draw(canvas, getRenderParts(pRobot.parts), { scale: 1.0, offsetX: -120, offsetY: -10, noClear: true });
        if (oRobot) RobotRenderer.draw(canvas, getRenderParts(oRobot.parts), { scale: 1.0, offsetX: 120, offsetY: -10, flip: true, noClear: true });

        // Attack position Y offsets
        const atkY = { high: 130, mid: 185, low: 240 };

        // Draw attack projectiles / strikes
        this.drawAttackEffect(ctx, 220, atkY[pAtk], 1, pWeapon, pHit);
        this.drawAttackEffect(ctx, 380, atkY[oAtk], -1, oWeapon, oHit);

        // Draw defense indicators
        this.drawDefenseIndicator(ctx, 400, atkY[pDef], !oHit);
        this.drawDefenseIndicator(ctx, 200, atkY[oDef], !pHit);
    },

    drawAttackEffect(ctx, x, y, dir, weaponType, isHit) {
        ctx.save();
        const endX = x + dir * 80;

        if (weaponType === 'beam') {
            ctx.strokeStyle = isHit ? '#ff1744' : '#ff174480';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
            ctx.fillStyle = '#ff174460';
            ctx.beginPath();
            ctx.arc(endX, y, 8, 0, Math.PI * 2);
            ctx.fill();
        } else if (weaponType === 'plasma') {
            ctx.fillStyle = isHit ? '#ff6b35' : '#ff6b3580';
            ctx.beginPath();
            ctx.arc((x + endX) / 2, y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffd70080';
            ctx.beginPath();
            ctx.arc((x + endX) / 2, y, 6, 0, Math.PI * 2);
            ctx.fill();
        } else if (weaponType === 'kinetic') {
            ctx.fillStyle = isHit ? '#aab' : '#aab80';
            for (let i = 0; i < 5; i++) {
                const px = x + dir * (i * 16 + 5);
                const py = y + (Math.random() - 0.5) * 12;
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // energy
            ctx.fillStyle = isHit ? '#00d4ff' : '#00d4ff80';
            ctx.beginPath();
            ctx.arc((x + endX) / 2, y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = isHit ? '#00d4ff' : '#00d4ff60';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }

        // Impact spark if hit
        if (isHit) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(endX, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    drawDefenseIndicator(ctx, x, y, blocked) {
        ctx.save();
        if (blocked) {
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 15, -0.5, 0.5);
            ctx.stroke();
            ctx.fillStyle = '#00d4ff30';
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    showFinisher() {
        const won = this.playerScore > this.opponentScore;
        const draw = this.playerScore === this.opponentScore;

        if (draw) {
            const display = document.getElementById('round-display');
            display.innerHTML = `
                <div class="round-result draw" style="font-size:1.5rem">IT'S A DRAW!</div>
                <div style="margin-top:16px;display:flex;gap:12px">
                    <button class="btn btn-primary" onclick="App.showScreen('menu')">Main Menu</button>
                </div>
            `;
            return;
        }

        const winnerRobot = won
            ? (this.isChallenger ? this.matchData.challenger_robot : this.matchData.opponent_robot)
            : (this.isChallenger ? this.matchData.opponent_robot : this.matchData.challenger_robot);
        const loserRobot = won
            ? (this.isChallenger ? this.matchData.opponent_robot : this.matchData.challenger_robot)
            : (this.isChallenger ? this.matchData.challenger_robot : this.matchData.opponent_robot);
        const winnerName = won
            ? (this.isChallenger ? this.matchData.challenger?.username : this.matchData.opponent?.username)
            : (this.isChallenger ? this.matchData.opponent?.username : this.matchData.challenger?.username);

        const winnerSize = getRobotSizeClass(winnerRobot.parts);
        const loserSize = getRobotSizeClass(loserRobot.parts);

        App.showScreen('finisher');

        Finisher.play(winnerRobot.parts, loserRobot.parts, winnerSize, loserSize, () => {
            const overlay = document.getElementById('finisher-overlay');
            const text = document.getElementById('finisher-text');
            const winner = document.getElementById('finisher-winner');

            text.textContent = won ? 'VICTORY' : 'DESTROYED';
            text.className = `finisher-text ${won ? 'victory' : ''}`;
            winner.textContent = `${winnerName} wins!`;
            overlay.classList.add('visible');
        });
    },

    replay() {
        if (this.matchData) {
            document.getElementById('finisher-overlay').classList.remove('visible');
            Finisher.stop();
            this.playMatch(this.matchData);
        }
    }
};

// ---- Hash routing ----
window.addEventListener('hashchange', () => {
    if (State.user) Auth.routeAfterAuth();
});

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => Auth.init());
