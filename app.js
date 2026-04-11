// ============================================
// BATTLE BOTS — Main App
// ============================================

const SUPABASE_URL = 'https://ktestgtfkpdelyuvmsvu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SspMLcmM3Wgec_8pRoTbsg_JI7mbyoN';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- State ----
const State = {
    user: null,
    profile: null,
    robot: { name: 'MK-1', parts: { ...DEFAULT_PARTS } },
    pendingMatchId: null, // match ID from URL hash
};

// ---- Auth ----
const Auth = {
    showingSignup: true,

    async init() {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            State.user = session.user;
            await this.loadProfile();
            this.checkHashRoute();
            return;
        }

        // Check hash for match link (store for after login)
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

        const { data, error } = await sb.auth.signUp({
            email, password,
            options: { data: { username } }
        });

        if (error) { errEl.textContent = error.message; return; }

        if (data.user) {
            State.user = data.user;
            // Wait a moment for the trigger to create the profile
            await new Promise(r => setTimeout(r, 500));
            await this.loadProfile();
            this.checkHashRoute();
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
        await this.loadProfile();
        this.checkHashRoute();
    },

    async logOut() {
        await sb.auth.signOut();
        State.user = null;
        State.profile = null;
        App.showScreen('auth');
    },

    async loadProfile() {
        const { data } = await sb.from('profiles').select('*').eq('id', State.user.id).single();
        if (data) {
            State.profile = data;
            if (data.avatar_robot) {
                State.robot = data.avatar_robot;
            }
        }
    },

    checkHashRoute() {
        const hash = window.location.hash;
        if (hash.startsWith('#/match/')) {
            const matchId = hash.split('/')[2];
            JoinMatch.load(matchId);
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
    },

    refreshMenu() {
        if (State.profile) {
            document.getElementById('menu-username').textContent = State.profile.username;
            document.getElementById('menu-wins').textContent = State.profile.wins || 0;
            document.getElementById('menu-losses').textContent = State.profile.losses || 0;
        }
    },

    async createChallenge() {
        ChooseMoves.startForChallenge();
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
    }
};

// ---- Workshop ----
const Workshop = {
    currentCategory: 'head',

    init() {
        document.getElementById('robot-name').value = State.robot.name;
        this.selectCategory('head');
        this.updatePreview();
    },

    selectCategory(category) {
        this.currentCategory = category;
        document.querySelectorAll('.part-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        this.renderParts();
    },

    renderParts() {
        const list = document.getElementById('parts-list');
        const parts = PARTS[this.currentCategory];

        list.innerHTML = parts.map(part => {
            const equipped = State.robot.parts[this.currentCategory] === part.id;
            return `
                <div class="part-card ${equipped ? 'equipped' : ''}" onclick="Workshop.selectPart('${part.id}')">
                    <div class="part-icon" style="border: 2px solid ${TIER_COLORS[part.tier]}">${part.icon}</div>
                    <div class="part-info">
                        <h4>${part.name}</h4>
                        <p>${part.description}</p>
                    </div>
                    ${equipped ? '<span class="part-equipped-label">Equipped</span>' : ''}
                </div>
            `;
        }).join('');
    },

    selectPart(partId) {
        State.robot.parts[this.currentCategory] = partId;
        this.renderParts();
        this.updatePreview();
    },

    updatePreview() {
        const canvas = document.getElementById('robot-canvas');
        RobotRenderer.draw(canvas, getRenderParts(State.robot.parts), { scale: 1.3, offsetY: 10 });

        const sizeClass = getRobotSizeClass(State.robot.parts);
        const badge = document.getElementById('size-class-badge');
        badge.textContent = sizeClass.toUpperCase();
        badge.className = `size-class-badge ${sizeClass}`;
    },

    async saveRobot() {
        State.robot.name = document.getElementById('robot-name').value.trim() || 'MK-1';

        await sb.from('profiles').update({
            avatar_robot: State.robot
        }).eq('id', State.user.id);

        App.showScreen('menu');
    }
};

// ---- Choose Moves (for creating a challenge) ----
const ChooseMoves = {
    choices: [null, null, null],

    startForChallenge() {
        this.choices = [null, null, null];
        this.clearSelections('');
        document.getElementById('commit-btn').disabled = true;
        App.showScreen('choose');
    },

    pick(round, choice) {
        this.choices[round - 1] = choice;

        // Update button selection
        const container = document.getElementById(`round-${round}-choice`);
        container.querySelectorAll('.rps-btn').forEach(btn => btn.classList.remove('selected'));
        event.currentTarget.classList.add('selected');

        // Enable commit if all rounds chosen
        const allChosen = this.choices.every(c => c !== null);
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

        if (error) {
            btn.textContent = 'Error: ' + error.message;
            return;
        }

        btn.textContent = 'Lock In Choices';

        // Show share link
        const baseUrl = window.location.origin + window.location.pathname;
        const link = `${baseUrl}#/match/${data.id}`;
        document.getElementById('share-link').value = link;
        App.showScreen('challenge-created');
    },

    clearSelections(prefix) {
        for (let i = 1; i <= 3; i++) {
            const container = document.getElementById(`${prefix}round-${i}-choice`);
            if (container) {
                container.querySelectorAll('.rps-btn').forEach(btn => btn.classList.remove('selected'));
            }
        }
    }
};

// ---- Join Match ----
const JoinMatch = {
    matchData: null,
    choices: [null, null, null],

    async load(matchId) {
        // Fetch match
        const { data, error } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username)')
            .eq('id', matchId)
            .single();

        if (error || !data) {
            alert('Match not found!');
            App.showScreen('menu');
            return;
        }

        if (data.status === 'complete') {
            // Show replay
            BattlePlayback.playMatch(data);
            return;
        }

        if (data.challenger_id === State.user.id) {
            // This is your own challenge
            document.getElementById('share-link').value = window.location.href;
            App.showScreen('challenge-created');
            return;
        }

        this.matchData = data;
        this.choices = [null, null, null];

        // Show challenger info
        const info = document.getElementById('challenger-info');
        info.innerHTML = `
            <canvas id="challenger-robot-preview" width="80" height="90"></canvas>
            <div class="info">
                <h3>${data.challenger?.username || 'Unknown'}</h3>
                <p>${data.challenger_robot?.name || 'MK-1'}</p>
            </div>
        `;

        requestAnimationFrame(() => {
            const canvas = document.getElementById('challenger-robot-preview');
            if (canvas && data.challenger_robot) {
                RobotRenderer.draw(canvas, getRenderParts(data.challenger_robot.parts), { scale: 0.5, offsetY: 5 });
            }
        });

        // Clear selections
        for (let i = 1; i <= 3; i++) {
            const container = document.getElementById(`join-round-${i}-choice`);
            if (container) container.querySelectorAll('.rps-btn').forEach(btn => btn.classList.remove('selected'));
        }
        document.getElementById('join-commit-btn').disabled = true;

        App.showScreen('join');
    },

    pick(round, choice) {
        this.choices[round - 1] = choice;

        const container = document.getElementById(`join-round-${round}-choice`);
        container.querySelectorAll('.rps-btn').forEach(btn => btn.classList.remove('selected'));
        event.currentTarget.classList.add('selected');

        const allChosen = this.choices.every(c => c !== null);
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

        if (error) {
            btn.textContent = 'Error: ' + error.message;
            btn.disabled = false;
            return;
        }

        btn.textContent = '⚔️ Accept Challenge';

        // Reload match for full data
        const { data: match } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username), opponent:profiles!opponent_id(username)')
            .eq('id', this.matchData.id)
            .single();

        if (match) {
            // Update profile stats
            await Auth.loadProfile();
            BattlePlayback.playMatch(match);
        }
    }
};

// ---- Matches List ----
const MatchesList = {
    async load() {
        const list = document.getElementById('matches-list');
        list.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px">Loading...</p>';

        const { data, error } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username), opponent:profiles!opponent_id(username)')
            .or(`challenger_id.eq.${State.user.id},opponent_id.eq.${State.user.id}`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error || !data || data.length === 0) {
            list.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px">No matches yet. Create a challenge!</p>';
            return;
        }

        list.innerHTML = data.map(match => {
            const isChallenger = match.challenger_id === State.user.id;
            const opponentName = isChallenger
                ? (match.opponent?.username || 'Waiting...')
                : (match.challenger?.username || 'Unknown');

            let statusClass = 'waiting';
            let statusText = 'Waiting for opponent';

            if (match.status === 'complete') {
                if (match.winner_id === null) {
                    statusClass = 'draw';
                    statusText = 'Draw';
                } else if (match.winner_id === State.user.id) {
                    statusClass = 'won';
                    statusText = 'Victory!';
                } else {
                    statusClass = 'lost';
                    statusText = 'Defeated';
                }
            }

            return `
                <div class="match-card" onclick="MatchesList.viewMatch('${match.id}')">
                    <h3>vs ${this.escapeHtml(opponentName)}</h3>
                    <div class="match-status ${statusClass}">${statusText}</div>
                </div>
            `;
        }).join('');
    },

    async viewMatch(matchId) {
        const { data } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username), opponent:profiles!opponent_id(username)')
            .eq('id', matchId)
            .single();

        if (data && data.status === 'complete') {
            BattlePlayback.playMatch(data);
        } else if (data && data.status === 'waiting') {
            const baseUrl = window.location.origin + window.location.pathname;
            document.getElementById('share-link').value = `${baseUrl}#/match/${matchId}`;
            App.showScreen('challenge-created');
        }
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
};

// ---- Battle Playback ----
const BattlePlayback = {
    matchData: null,
    currentRound: 0,
    playerScore: 0,
    opponentScore: 0,
    isChallenger: false,

    playMatch(match) {
        this.matchData = match;
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

        // Draw robot thumbnails
        requestAnimationFrame(() => {
            const pc = document.getElementById('battle-player-canvas');
            const oc = document.getElementById('battle-opponent-canvas');
            if (playerRobot) RobotRenderer.draw(pc, getRenderParts(playerRobot.parts), { scale: 0.55, offsetY: 5 });
            if (opponentRobot) RobotRenderer.draw(oc, getRenderParts(opponentRobot.parts), { scale: 0.55, offsetY: 5 });
        });

        // Draw battle scene
        this.drawBattleScene(playerRobot, opponentRobot);

        document.getElementById('round-display').innerHTML = '<p class="text-dim">Get ready...</p>';
        App.showScreen('battle');

        setTimeout(() => this.playNextRound(), 1500);
    },

    drawBattleScene(playerRobot, opponentRobot) {
        const canvas = document.getElementById('battle-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Floor
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
        if (this.currentRound >= 3) {
            this.showFinisher();
            return;
        }

        const round = this.currentRound;
        const playerChoices = this.isChallenger ? this.matchData.challenger_choices : this.matchData.opponent_choices;
        const opponentChoices = this.isChallenger ? this.matchData.opponent_choices : this.matchData.challenger_choices;

        const playerChoice = playerChoices[round];
        const opponentChoice = opponentChoices[round];

        const display = document.getElementById('round-display');

        // Show round label
        display.innerHTML = `<div class="round-label">Round ${round + 1}</div><div class="round-choices">❓ vs ❓</div>`;

        // Reveal after delay
        setTimeout(() => {
            const result = this.resolveRPS(playerChoice, opponentChoice);

            if (result === 'win') this.playerScore++;
            else if (result === 'lose') this.opponentScore++;

            document.getElementById('battle-player-score').textContent = this.playerScore;
            document.getElementById('battle-opponent-score').textContent = this.opponentScore;

            const resultText = result === 'win' ? 'YOU WIN' : result === 'lose' ? 'YOU LOSE' : 'DRAW';

            display.innerHTML = `
                <div class="round-label">Round ${round + 1}</div>
                <div class="round-choices">${RPS_ICONS[playerChoice]} vs ${RPS_ICONS[opponentChoice]}</div>
                <div class="round-result ${result === 'win' ? 'win' : result === 'lose' ? 'lose' : 'draw'}">${resultText}</div>
            `;

            // Shake on impact
            document.getElementById('battle-canvas').classList.add('shake');
            setTimeout(() => document.getElementById('battle-canvas').classList.remove('shake'), 300);

            this.currentRound++;

            setTimeout(() => this.playNextRound(), 2000);
        }, 1200);
    },

    resolveRPS(a, b) {
        if (a === b) return 'draw';
        if ((a === 'rock' && b === 'scissors') || (a === 'scissors' && b === 'paper') || (a === 'paper' && b === 'rock')) {
            return 'win';
        }
        return 'lose';
    },

    showFinisher() {
        const won = this.playerScore > this.opponentScore;
        const draw = this.playerScore === this.opponentScore;

        if (draw) {
            // No finisher on draw
            const display = document.getElementById('round-display');
            display.innerHTML = `
                <div class="round-result draw" style="font-size:1.5rem">IT'S A DRAW!</div>
                <div style="margin-top: 16px; display: flex; gap: 12px;">
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
            // Show overlay
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
    if (State.user) {
        Auth.checkHashRoute();
    }
});

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => Auth.init());
