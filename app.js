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
    showingSignup: false,

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
        // Subscribe to realtime updates once per session
        Notifications.subscribe();

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

// ---- Realtime notifications ----
const Notifications = {
    channel: null,

    subscribe() {
        if (this.channel) return;
        this.channel = sb.channel('match-updates-' + State.user.id)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'matches',
                filter: `challenger_id=eq.${State.user.id}`,
            }, (payload) => this.onMyChallengeUpdated(payload.new))
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'matches',
                filter: `target_opponent_id=eq.${State.user.id}`,
            }, (payload) => this.onIncomingChallenge(payload.new))
            .subscribe();
    },

    onMyChallengeUpdated(match) {
        if (match.status === 'complete') {
            Toast.show(`⚡ Your challenge was accepted — new result waiting!`, 'success');
            this.refreshMenuBadges();
        } else if (match.status === 'declined') {
            Toast.show(`Your challenge was declined.`, 'info');
        }
    },

    onIncomingChallenge(match) {
        Toast.show(`⚔️ New incoming challenge!`, 'accent');
        this.refreshMenuBadges();
    },

    async refreshMenuBadges() {
        // Count incoming + new results for menu badge
        const { data } = await sb.from('matches')
            .select('id, status, challenger_id, challenger_viewed_at, opponent_viewed_at, target_opponent_id, winner_id')
            .or(`challenger_id.eq.${State.user.id},target_opponent_id.eq.${State.user.id}`);
        let incoming = 0, results = 0;
        for (const m of (data || [])) {
            const iAmChallenger = m.challenger_id === State.user.id;
            if (m.status === 'waiting' && !iAmChallenger) incoming++;
            else if (m.status === 'complete') {
                const viewed = iAmChallenger ? m.challenger_viewed_at : m.opponent_viewed_at;
                if (!viewed) results++;
            }
        }
        const badge = document.getElementById('menu-matches-badge');
        if (badge) {
            const total = incoming + results;
            badge.textContent = total > 0 ? total : '';
            badge.style.display = total > 0 ? '' : 'none';
        }
    }
};

// ---- Toast ----
const Toast = {
    show(msg, variant = 'info') {
        let el = document.getElementById('toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toast';
            el.className = 'toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.className = `toast visible ${variant}`;
        clearTimeout(this._t);
        this._t = setTimeout(() => { el.className = 'toast'; }, 4000);
    }
};

// ---- App ----
const App = {
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`screen-${screenId}`).classList.add('active');

        if (screenId === 'menu') { this.refreshMenu(); Notifications.refreshMenuBadges(); }
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

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
};

// ===== PvE TEST BOT (remove later) =====
const PveBot = {
    NAMES: ['TrainerBot', 'SparBot', 'DummyMk2', 'PracticeUnit', 'Testbot-9000'],

    randomRobot() {
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        return {
            name: this.NAMES[Math.floor(Math.random() * this.NAMES.length)],
            parts: {
                head: pick(PARTS.head).id,
                torso: pick(PARTS.torso).id,
                arms: pick(PARTS.arms).id,
                legs: pick(PARTS.legs).id,
                weapon: pick(PARTS.weapon).id,
                special: pick(PARTS.special).id,
            }
        };
    },

    play() {
        if (!State.robot) {
            Workshop.startOnboarding();
            return;
        }
        ChooseMoves.start();
        // Override commit button to play vs bot instead of creating a challenge
        const btn = document.getElementById('commit-btn');
        btn.textContent = 'Fight TestBot';
        btn.onclick = () => this.fight();
    },

    fight() {
        const playerChoices = ChooseMoves.choices.slice();
        const moves = ['rock', 'paper', 'scissors'];
        const botChoices = [0, 1, 2].map(() => moves[Math.floor(Math.random() * 3)]);
        const botRobot = this.randomRobot();

        // Resolve locally
        const roundResults = [];
        let cWins = 0, oWins = 0;
        for (let i = 0; i < 3; i++) {
            const cm = playerChoices[i], om = botChoices[i];
            let winner;
            if (cm === om) winner = 'draw';
            else if ((cm === 'rock' && om === 'scissors') ||
                     (cm === 'paper' && om === 'rock') ||
                     (cm === 'scissors' && om === 'paper')) {
                winner = 'challenger'; cWins++;
            } else { winner = 'opponent'; oWins++; }
            roundResults.push({ round: i + 1, challenger_move: cm, opponent_move: om, winner });
        }

        const fakeMatch = {
            id: 'pve-test',
            challenger_id: State.user.id,
            challenger_robot: State.robot,
            challenger_choices: playerChoices,
            opponent_id: 'bot',
            opponent_robot: botRobot,
            opponent_choices: botChoices,
            status: 'complete',
            winner_id: cWins > oWins ? State.user.id : (oWins > cWins ? 'bot' : null),
            round_results: roundResults,
            challenger: { username: State.profile?.username || 'You', wins: State.profile?.wins || 0 },
            opponent: { username: botRobot.name, wins: 0 },
        };

        // Restore default commit button behavior for future use
        const btn = document.getElementById('commit-btn');
        btn.onclick = () => ChooseMoves.commit();
        btn.textContent = 'Lock In Strategy';

        BattlePlayback.playMatch(fakeMatch);
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
            <div class="rps-buttons">
                ${RPS_MOVES.map(m => `
                    <button class="rps-btn" data-round="${r}" data-move="${m.id}"
                        onclick="${prefix}.pick(${r},'${m.id}', this)">
                        <span class="rps-icon">${m.icon}</span>
                        <span class="rps-label">${m.label}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ---- Shared helpers ----
async function fetchProfileByUsername(username) {
    const { data } = await sb.from('profiles')
        .select('id, username, wins, losses')
        .ilike('username', username)
        .maybeSingle();
    return data;
}

async function fetchH2H(opponentId) {
    const { data } = await sb.from('matches')
        .select('winner_id')
        .eq('status', 'complete')
        .or(`and(challenger_id.eq.${State.user.id},opponent_id.eq.${opponentId}),and(challenger_id.eq.${opponentId},opponent_id.eq.${State.user.id})`);
    let myWins = 0, theirWins = 0, draws = 0;
    for (const m of (data || [])) {
        if (m.winner_id === State.user.id) myWins++;
        else if (m.winner_id === null) draws++;
        else theirWins++;
    }
    return { myWins, theirWins, draws, total: (data || []).length };
}

function renderH2H(el, stats, opponentName) {
    if (!stats.total) {
        el.innerHTML = `<p class="text-dim">First match against ${App.escapeHtml(opponentName || 'this opponent')}!</p>`;
        return;
    }
    el.innerHTML = `
        <p class="h2h-text">vs ${App.escapeHtml(opponentName || 'opponent')}:
            <span class="h2h-wins">${stats.myWins}W</span> -
            <span class="h2h-draws">${stats.draws}D</span> -
            <span class="h2h-losses">${stats.theirWins}L</span>
        </p>`;
}

// ---- Choose Moves (Create Challenge) ----
const ChooseMoves = {
    choices: [null, null, null],
    targetProfile: null,
    h2hDebounce: null,

    start() {
        this.choices = [null, null, null];
        this.targetProfile = null;
        buildRoundsUI('rounds-chooser', 'ChooseMoves');
        document.getElementById('commit-btn').disabled = true;
        document.getElementById('commit-btn').textContent = 'Send Challenge';
        document.getElementById('choose-error').textContent = '';
        const input = document.getElementById('opponent-username');
        input.value = '';
        input.oninput = () => this.onUsernameChange();
        document.getElementById('choose-h2h-record').innerHTML = '';
        App.showScreen('choose');
    },

    onUsernameChange() {
        this.targetProfile = null;
        this.updateCommitState();
        const name = document.getElementById('opponent-username').value.trim();
        document.getElementById('choose-h2h-record').innerHTML = '';
        if (this.h2hDebounce) clearTimeout(this.h2hDebounce);
        if (!name || name.length < 2) return;
        this.h2hDebounce = setTimeout(async () => {
            const profile = await fetchProfileByUsername(name);
            if (!profile) {
                document.getElementById('choose-h2h-record').innerHTML = `<p class="text-dim">No player named "${App.escapeHtml(name)}".</p>`;
                return;
            }
            if (profile.id === State.user.id) {
                document.getElementById('choose-h2h-record').innerHTML = `<p class="text-dim">You can't challenge yourself.</p>`;
                return;
            }
            this.targetProfile = profile;
            const stats = await fetchH2H(profile.id);
            renderH2H(document.getElementById('choose-h2h-record'), stats, profile.username);
            this.updateCommitState();
        }, 400);
    },

    pick(round, move, btn) {
        this.choices[round - 1] = move;
        const siblings = btn.parentElement.querySelectorAll('.rps-btn');
        siblings.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.updateCommitState();
    },

    updateCommitState() {
        const allChosen = this.choices.every(c => c !== null);
        document.getElementById('commit-btn').disabled = !(allChosen && this.targetProfile);
    },

    async commit() {
        if (!this.targetProfile) return;
        const btn = document.getElementById('commit-btn');
        const errEl = document.getElementById('choose-error');
        btn.disabled = true;
        btn.textContent = 'Sending...';
        errEl.textContent = '';

        const { data, error } = await sb.from('matches').insert({
            challenger_id: State.user.id,
            challenger_robot: State.robot,
            challenger_choices: this.choices,
            target_opponent_id: this.targetProfile.id
        }).select().single();

        if (error) {
            errEl.textContent = 'Error: ' + error.message;
            btn.disabled = false;
            btn.textContent = 'Send Challenge';
            return;
        }
        document.getElementById('sent-to-name').textContent = this.targetProfile.username;
        App.showScreen('challenge-created');
    }
};

// ---- Join Match ----
const JoinMatch = {
    matchData: null,
    choices: [null, null, null],

    async load(matchId) {
        const { data, error } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username, wins)')
            .eq('id', matchId).single();

        if (error || !data) { alert('Match not found!'); App.showScreen('menu'); return; }

        if (data.status === 'complete') {
            BattlePlayback.playMatch(data);
            return;
        }

        if (data.status === 'declined') {
            alert('This challenge was declined.');
            App.showScreen('menu');
            return;
        }

        if (data.challenger_id === State.user.id) {
            alert('This is your own challenge. Waiting for your opponent.');
            App.showScreen('menu');
            return;
        }

        if (data.target_opponent_id !== State.user.id) {
            alert("This challenge isn't for you.");
            App.showScreen('menu');
            return;
        }

        if (!State.robot) {
            State.pendingMatchId = matchId;
            Workshop.startOnboarding();
            return;
        }

        this.matchData = data;
        this.choices = [null, null, null];

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

        const stats = await fetchH2H(data.challenger_id);
        renderH2H(document.getElementById('h2h-record'), stats, data.challenger?.username);

        buildRoundsUI('join-rounds-chooser', 'JoinMatch');
        document.getElementById('join-commit-btn').disabled = true;
        document.getElementById('join-commit-btn').textContent = '⚔️ Accept Challenge';
        App.showScreen('join');
    },

    async decline() {
        if (!confirm('Decline this challenge?')) return;
        const { error } = await sb.rpc('decline_match', { p_match_id: this.matchData.id });
        if (error) { alert('Error: ' + error.message); return; }
        App.showScreen('matches');
    },

    pick(round, move, btn) {
        this.choices[round - 1] = move;
        const siblings = btn.parentElement.querySelectorAll('.rps-btn');
        siblings.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
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
    currentTab: 'incoming',
    cache: null,

    async load() {
        this.currentTab = 'incoming';
        document.querySelectorAll('.match-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'incoming'));
        const list = document.getElementById('matches-list');
        list.innerHTML = '<p class="text-dim" style="padding:40px">Loading...</p>';

        const { data, error } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username, wins), target:profiles!target_opponent_id(username, wins)')
            .or(`challenger_id.eq.${State.user.id},target_opponent_id.eq.${State.user.id}`)
            .order('created_at', { ascending: false }).limit(100);

        if (error) {
            list.innerHTML = `<p class="text-dim" style="padding:40px">Error loading matches: ${App.escapeHtml(error.message)}</p>`;
            return;
        }

        this.cache = data || [];
        this.updateCounts();
        this.render();
    },

    bucketOf(match) {
        const iAmChallenger = match.challenger_id === State.user.id;
        if (match.status === 'waiting') {
            return iAmChallenger ? 'outgoing' : 'incoming';
        }
        if (match.status === 'declined') {
            return 'past';
        }
        // complete
        const myViewedAt = iAmChallenger ? match.challenger_viewed_at : match.opponent_viewed_at;
        return myViewedAt ? 'past' : 'results';
    },

    updateCounts() {
        const counts = { incoming: 0, outgoing: 0, results: 0, past: 0 };
        for (const m of this.cache) counts[this.bucketOf(m)]++;
        for (const k of Object.keys(counts)) {
            const el = document.getElementById(`tab-count-${k}`);
            if (!el) continue;
            el.textContent = counts[k] > 0 ? counts[k] : '';
        }
    },

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.match-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        this.render();
    },

    render() {
        const list = document.getElementById('matches-list');
        const filtered = (this.cache || []).filter(m => this.bucketOf(m) === this.currentTab);

        if (filtered.length === 0) {
            const emptyMsg = {
                incoming: 'No incoming challenges.',
                outgoing: "You haven't sent any challenges that are still waiting.",
                results: 'No new match results to watch.',
                past: 'No past matches yet.',
            }[this.currentTab];
            list.innerHTML = `<p class="text-dim" style="padding:40px">${emptyMsg}</p>`;
            return;
        }

        list.innerHTML = filtered.map(match => {
            const iAmChallenger = match.challenger_id === State.user.id;
            const otherName = iAmChallenger
                ? (match.target?.username || 'Unknown')
                : (match.challenger?.username || 'Unknown');

            let statusClass, statusText, extra = '';
            if (match.status === 'waiting' && !iAmChallenger) {
                statusClass = 'incoming';
                statusText = 'Incoming challenge — tap to respond';
            } else if (match.status === 'waiting' && iAmChallenger) {
                statusClass = 'waiting';
                statusText = 'Waiting for them to accept…';
            } else if (match.status === 'declined') {
                statusClass = 'declined';
                statusText = 'Challenge declined';
            } else {
                const myViewedAt = iAmChallenger ? match.challenger_viewed_at : match.opponent_viewed_at;
                if (!myViewedAt) {
                    statusClass = 'ready';
                    statusText = '⚡ New result — watch now!';
                } else {
                    const won = match.winner_id === State.user.id;
                    const draw = match.winner_id === null;
                    statusClass = draw ? 'draw' : (won ? 'won' : 'lost');
                    statusText = draw ? 'Draw' : (won ? 'Victory' : 'Defeat');
                }
            }

            return `
                <div class="match-card ${statusClass}" onclick="MatchesList.openMatch('${match.id}')">
                    <h3>vs ${App.escapeHtml(otherName)}</h3>
                    <div class="match-status ${statusClass}">${statusText}</div>
                    ${extra}
                </div>
            `;
        }).join('');
    },

    async openMatch(matchId) {
        const match = this.cache.find(m => m.id === matchId);
        if (!match) return;
        const iAmChallenger = match.challenger_id === State.user.id;

        if (match.status === 'waiting' && !iAmChallenger) {
            // Incoming — go to join screen
            JoinMatch.load(matchId);
            return;
        }
        if (match.status === 'waiting' && iAmChallenger) {
            alert('Still waiting for your opponent to respond.');
            return;
        }
        if (match.status === 'declined') {
            alert('This challenge was declined.');
            return;
        }
        // Completed — load fully and play
        const { data } = await sb.from('matches')
            .select('*, challenger:profiles!challenger_id(username, wins), opponent:profiles!opponent_id(username, wins)')
            .eq('id', matchId).single();
        if (!data) return;
        // Mark viewed
        sb.rpc('mark_match_viewed', { p_match_id: matchId }).then(() => {});
        // Update cache locally so tab counts reflect immediately on return
        if (iAmChallenger) match.challenger_viewed_at = new Date().toISOString();
        else match.opponent_viewed_at = new Date().toISOString();
        BattlePlayback.playMatch(data);
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

    drawStance(canvas, pRobot, oRobot) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#2a3a5c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 270);
        ctx.lineTo(600, 270);
        ctx.stroke();
        if (pRobot) RobotRenderer.draw(canvas, getRenderParts(pRobot.parts), { scale: 1.0, offsetX: -120, offsetY: -10, noClear: true });
        if (oRobot) RobotRenderer.draw(canvas, getRenderParts(oRobot.parts), { scale: 1.0, offsetX: 120, offsetY: -10, flip: true, noClear: true });
    },

    drawRpsOverlay(canvas, pMove, oMove, alpha = 1) {
        this.drawStance(canvas, this._pRobot, this._oRobot);
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '90px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 20;
        ctx.fillText(RPS_ICON[pMove], 150, 90);
        ctx.shadowColor = '#ff6b35';
        ctx.fillText(RPS_ICON[oMove], 450, 90);
        ctx.restore();
    },

    drawStrike(canvas, attackerSide, weapon, progress) {
        this.drawStance(canvas, this._pRobot, this._oRobot);
        const ctx = canvas.getContext('2d');
        const startX = attackerSide === 'player' ? 220 : 380;
        const endX = attackerSide === 'player' ? 400 : 200;
        const x = startX + (endX - startX) * progress;
        const dir = attackerSide === 'player' ? 1 : -1;
        this.drawProjectile(ctx, x, 185, dir, weapon);
    },

    drawHit(canvas, loserSide) {
        this.drawStance(canvas, this._pRobot, this._oRobot);
        const ctx = canvas.getContext('2d');
        const x = loserSide === 'player' ? 180 : 420;
        this.drawImpactFx(ctx, x, 185, true);
    },

    drawTelegraph(canvas, pRobot, oRobot, pAtk, oAtk, pulse) {
        this.drawStance(canvas, pRobot, oRobot);
        const ctx = canvas.getContext('2d');
        const atkY = { high: 130, mid: 185, low: 240 };
        const r = 14 + Math.sin(pulse * 0.25) * 6;
        const alpha = 0.4 + Math.sin(pulse * 0.25) * 0.3;
        // Player charge (left → right)
        ctx.save();
        ctx.fillStyle = `rgba(0,212,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(-80 + 300, atkY[pAtk], r, 0, Math.PI * 2);
        ctx.fill();
        // Opponent charge
        ctx.fillStyle = `rgba(255,107,53,${alpha})`;
        ctx.beginPath();
        ctx.arc(80 + 300, atkY[oAtk], r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawProjectiles(canvas, pRobot, oRobot, pAtk, oAtk, pWeapon, oWeapon, progress) {
        this.drawStance(canvas, pRobot, oRobot);
        const ctx = canvas.getContext('2d');
        const atkY = { high: 130, mid: 185, low: 240 };
        // Player projectile: x from 220 → 400
        const pX = 220 + (400 - 220) * progress;
        const oX = 380 - (380 - 200) * progress;
        this.drawProjectile(ctx, pX, atkY[pAtk], 1, pWeapon);
        this.drawProjectile(ctx, oX, atkY[oAtk], -1, oWeapon);
    },

    drawProjectile(ctx, x, y, dir, weaponType) {
        ctx.save();
        if (weaponType === 'beam') {
            ctx.strokeStyle = '#ff1744';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#ff1744';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(x - dir * 40, y);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else if (weaponType === 'plasma') {
            ctx.fillStyle = '#ff6b35';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        } else if (weaponType === 'kinetic') {
            ctx.fillStyle = '#ddd';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(x - dir * i * 10, y + (i % 2 ? 3 : -3), 3, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.fillStyle = '#00d4ff';
            ctx.shadowColor = '#00d4ff';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(x, y, 9, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    drawImpact(canvas, pRobot, oRobot, pAtk, oAtk, pHit, oHit) {
        this.drawStance(canvas, pRobot, oRobot);
        const ctx = canvas.getContext('2d');
        const atkY = { high: 130, mid: 185, low: 240 };
        // Opponent gets hit on right side if pHit
        this.drawImpactFx(ctx, 400, atkY[pAtk], pHit);
        this.drawImpactFx(ctx, 200, atkY[oAtk], oHit);
    },

    drawImpactFx(ctx, x, y, isHit) {
        ctx.save();
        if (isHit) {
            ctx.fillStyle = '#fff';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(x, y, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18);
                ctx.lineTo(x + Math.cos(a) * 32, y + Math.sin(a) * 32);
                ctx.stroke();
            }
        } else {
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#00d4ff';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(x, y, 24, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0,212,255,0.2)';
            ctx.beginPath();
            ctx.arc(x, y, 24, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    wait(ms) { return new Promise(r => setTimeout(r, ms)); },

    drawSingleProjectile(canvas, pRobot, oRobot, attackerSide, pos, weapon, progress) {
        this.drawStance(canvas, pRobot, oRobot);
        const ctx = canvas.getContext('2d');
        const atkY = { high: 130, mid: 185, low: 240 };
        const startX = attackerSide === 'player' ? 220 : 380;
        const endX = attackerSide === 'player' ? 400 : 200;
        const x = startX + (endX - startX) * progress;
        const dir = attackerSide === 'player' ? 1 : -1;
        this.drawProjectile(ctx, x, atkY[pos], dir, weapon);
    },

    drawDefenseBrace(canvas, pRobot, oRobot, defenderSide, pos) {
        this.drawStance(canvas, pRobot, oRobot);
        const ctx = canvas.getContext('2d');
        const atkY = { high: 130, mid: 185, low: 240 };
        const x = defenderSide === 'player' ? 200 : 400;
        ctx.save();
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(x, atkY[pos], 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,212,255,0.18)';
        ctx.beginPath();
        ctx.arc(x, atkY[pos], 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    async resolveExchange({ canvas, playerRobot, opponentRobot, attackerSide, attackPos, defensePos, weapon, hit, display, attackerLabel, defenderLabel }) {
        const posLabel = POSITION_LABELS[attackPos];
        const defLabel = POSITION_LABELS[defensePos];
        const sideClass = attackerSide === 'player' ? 'callout-you' : 'callout-them';

        // Telegraph the attack
        display.innerHTML = `<div class="round-callout"><span class="${sideClass}">${attackerLabel} ${posLabel} ${POSITION_ICONS[attackPos]}</span></div>`;
        const tStart = performance.now();
        await new Promise(resolve => {
            const tick = (now) => {
                const el = now - tStart;
                this.drawTelegraph(canvas, playerRobot, opponentRobot,
                    attackerSide === 'player' ? attackPos : 'mid',
                    attackerSide === 'opponent' ? attackPos : 'mid',
                    el / 30);
                // actually only draw one side
                const ctx = canvas.getContext('2d');
                this.drawStance(canvas, playerRobot, opponentRobot);
                const atkY = { high: 130, mid: 185, low: 240 };
                const r = 14 + Math.sin(el * 0.015) * 6;
                const alpha = 0.4 + Math.sin(el * 0.015) * 0.3;
                const cx = attackerSide === 'player' ? 220 : 380;
                ctx.save();
                ctx.fillStyle = attackerSide === 'player' ? `rgba(0,212,255,${alpha})` : `rgba(255,107,53,${alpha})`;
                ctx.beginPath();
                ctx.arc(cx, atkY[attackPos], r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                if (el < 700) requestAnimationFrame(tick);
                else resolve();
            };
            requestAnimationFrame(tick);
        });

        // Projectile flies
        const pStart = performance.now();
        const pDur = 550;
        await new Promise(resolve => {
            const tick = (now) => {
                const p = Math.min(1, (now - pStart) / pDur);
                this.drawSingleProjectile(canvas, playerRobot, opponentRobot, attackerSide, attackPos, weapon, p);
                if (p < 1) requestAnimationFrame(tick);
                else resolve();
            };
            requestAnimationFrame(tick);
        });

        // Suspense beat — defender braces
        const defenderSide = attackerSide === 'player' ? 'opponent' : 'player';
        this.drawDefenseBrace(canvas, playerRobot, opponentRobot, defenderSide, defensePos);
        display.innerHTML = `<div class="round-callout"><span class="callout-them">${defenderLabel} ${defLabel} ${POSITION_ICONS[defensePos]}</span><span class="suspense">…will it block?</span></div>`;
        await this.wait(600);

        // Reveal
        const ctx = canvas.getContext('2d');
        this.drawStance(canvas, playerRobot, opponentRobot);
        const atkY = { high: 130, mid: 185, low: 240 };
        const impactX = attackerSide === 'player' ? 400 : 200;
        this.drawImpactFx(ctx, impactX, atkY[attackPos], hit);
        if (hit) {
            canvas.classList.add('shake');
            setTimeout(() => canvas.classList.remove('shake'), 350);
        }
        let verdict;
        if (hit) {
            verdict = attackerSide === 'player'
                ? `<div class="verdict-col hit pop">💥 ${posLabel} HIT!</div>`
                : `<div class="verdict-col hit pop">💥 ${posLabel} TAKEN!</div>`;
        } else {
            verdict = `<div class="verdict-col blocked pop">🛡️ ${defLabel} BLOCK! SAVED!</div>`;
        }
        display.innerHTML = `<div class="round-verdict">${verdict}</div>`;

        // Update score during reveal
        if (hit) {
            if (attackerSide === 'player') {
                this.playerScore++;
                const ps = document.getElementById('battle-player-score');
                ps.textContent = this.playerScore;
                ps.classList.add('flash');
                setTimeout(() => ps.classList.remove('flash'), 800);
            } else {
                this.opponentScore++;
                const os = document.getElementById('battle-opponent-score');
                os.textContent = this.opponentScore;
                os.classList.add('flash');
                setTimeout(() => os.classList.remove('flash'), 800);
            }
        }
        await this.wait(1100);
    },

    showRpsIcon(side, move) {
        const el = document.getElementById(side === 'left' ? 'rps-icon-left' : 'rps-icon-right');
        el.textContent = RPS_ICON[move];
        // restart the pop animation
        el.classList.remove('visible');
        void el.offsetWidth;
        el.classList.add('visible');
    },

    hideRpsIcons() {
        document.getElementById('rps-icon-left').classList.remove('visible');
        document.getElementById('rps-icon-right').classList.remove('visible');
    },

    async animateStrike(canvas, attackerSide, weapon) {
        const start = performance.now();
        const dur = 550;
        await new Promise(resolve => {
            const tick = (now) => {
                const p = Math.min(1, (now - start) / dur);
                this.drawStrike(canvas, attackerSide, weapon, p);
                if (p < 1) requestAnimationFrame(tick);
                else resolve();
            };
            requestAnimationFrame(tick);
        });
    },

    async playNextRound() {
        if (this.currentRound >= this.roundResults.length) {
            this.showFinisher();
            return;
        }

        const round = this.roundResults[this.currentRound];
        const display = document.getElementById('round-display');
        const canvas = document.getElementById('battle-canvas');

        const playerMove = this.isChallenger ? round.challenger_move : round.opponent_move;
        const opponentMove = this.isChallenger ? round.opponent_move : round.challenger_move;
        // winner stored as 'challenger' | 'opponent' | 'draw'
        let winnerSide;
        if (round.winner === 'draw') winnerSide = 'draw';
        else if (round.winner === 'challenger') winnerSide = this.isChallenger ? 'player' : 'opponent';
        else winnerSide = this.isChallenger ? 'opponent' : 'player';

        const playerRobot = this.isChallenger ? this.matchData.challenger_robot : this.matchData.opponent_robot;
        const opponentRobot = this.isChallenger ? this.matchData.opponent_robot : this.matchData.challenger_robot;
        this._pRobot = playerRobot;
        this._oRobot = opponentRobot;
        const pWeapon = playerRobot ? getWeaponType(playerRobot.parts) : 'energy';
        const oWeapon = opponentRobot ? getWeaponType(opponentRobot.parts) : 'energy';

        // Alternate attacker: rounds 1 & 3 player attacks, round 2 opponent attacks
        const attackerSide = this.currentRound % 2 === 0 ? 'player' : 'opponent';
        const defenderSide = attackerSide === 'player' ? 'opponent' : 'player';
        const attackerMove = attackerSide === 'player' ? playerMove : opponentMove;
        const defenderMove = attackerSide === 'player' ? opponentMove : playerMove;
        const attackerWeapon = attackerSide === 'player' ? pWeapon : oWeapon;
        const defenderWeapon = attackerSide === 'player' ? oWeapon : pWeapon;
        const attackerIconSide = attackerSide === 'player' ? 'left' : 'right';
        const defenderIconSide = attackerSide === 'player' ? 'right' : 'left';

        const roundNum = this.currentRound + 1;
        const fightLabels = ['ROUND 1 — FIGHT!', 'ROUND 2 — FIGHT!', 'FINAL ROUND — FIGHT!'];

        // Phase 1: Announcer
        this.hideRpsIcons();
        this.drawStance(canvas, playerRobot, opponentRobot);
        display.innerHTML = `<div class="round-announcer">${fightLabels[this.currentRound]}</div>`;
        await this.wait(1100);
        display.innerHTML = '';
        await this.wait(150);

        // Phase 2: Attacker reveals RPS
        this.showRpsIcon(attackerIconSide, attackerMove);
        display.innerHTML = `<div class="round-callout"><span class="${attackerSide === 'player' ? 'callout-you' : 'callout-them'}">${attackerSide === 'player' ? 'YOU' : 'THEY'} ATTACK!</span></div>`;
        await this.wait(650);

        // Phase 3: Attacker strikes — projectile flies
        await this.animateStrike(canvas, attackerSide, attackerWeapon);

        // Phase 4: Defender reveals RPS
        this.showRpsIcon(defenderIconSide, defenderMove);
        await this.wait(500);

        // Phase 5: Resolve
        let verdictText, verdictClass;
        if (winnerSide === 'draw') {
            // Defender blocks the strike — tie
            this.drawStance(canvas, playerRobot, opponentRobot);
            const ctx = canvas.getContext('2d');
            const blockX = defenderSide === 'player' ? 200 : 400;
            this.drawImpactFx(ctx, blockX, 185, false);
            verdictText = `⚖️ ${RPS_LABEL[attackerMove]} vs ${RPS_LABEL[defenderMove]} — DRAW!`;
            verdictClass = 'blocked';
            await this.wait(300);
        } else if (winnerSide === attackerSide) {
            // Attacker wins — hit lands
            this.drawHit(canvas, defenderSide);
            canvas.classList.add('shake');
            setTimeout(() => canvas.classList.remove('shake'), 350);
            verdictText = `💥 ${RPS_LABEL[attackerMove]} BEATS ${RPS_LABEL[defenderMove]} — HIT!`;
            verdictClass = attackerSide === 'player' ? 'blocked' : 'hit';
            this.bumpScore(attackerSide);
        } else {
            // Defender wins — block then counter-attack
            this.drawStance(canvas, playerRobot, opponentRobot);
            const ctx = canvas.getContext('2d');
            const blockX = defenderSide === 'player' ? 200 : 400;
            this.drawImpactFx(ctx, blockX, 185, false);
            await this.wait(550);
            // Counter strike
            display.innerHTML = `<div class="round-callout"><span class="${defenderSide === 'player' ? 'callout-you' : 'callout-them'}">COUNTER ATTACK!</span></div>`;
            await this.animateStrike(canvas, defenderSide, defenderWeapon);
            this.drawHit(canvas, attackerSide);
            canvas.classList.add('shake');
            setTimeout(() => canvas.classList.remove('shake'), 350);
            verdictText = `🛡️💥 ${RPS_LABEL[defenderMove]} BLOCKS ${RPS_LABEL[attackerMove]} — COUNTER HIT!`;
            verdictClass = defenderSide === 'player' ? 'blocked' : 'hit';
            this.bumpScore(defenderSide);
        }

        display.innerHTML = `<div class="round-verdict"><div class="verdict-col ${verdictClass} pop">${verdictText}</div></div>`;
        await this.wait(1500);

        this.currentRound++;
        this.hideRpsIcons();
        this.drawStance(canvas, playerRobot, opponentRobot);
        display.innerHTML = '';
        await this.wait(250);
        this.playNextRound();
    },

    bumpScore(side) {
        if (side === 'player') {
            this.playerScore++;
            const ps = document.getElementById('battle-player-score');
            ps.textContent = this.playerScore;
            ps.classList.add('flash');
            setTimeout(() => ps.classList.remove('flash'), 800);
        } else {
            this.opponentScore++;
            const os = document.getElementById('battle-opponent-score');
            os.textContent = this.opponentScore;
            os.classList.add('flash');
            setTimeout(() => os.classList.remove('flash'), 800);
        }
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

    async showFinisher() {
        const playerRobot = this.isChallenger ? this.matchData.challenger_robot : this.matchData.opponent_robot;
        const opponentRobot = this.isChallenger ? this.matchData.opponent_robot : this.matchData.challenger_robot;
        const playerName = this.isChallenger ? this.matchData.challenger?.username : this.matchData.opponent?.username;
        const opponentName = this.isChallenger ? this.matchData.opponent?.username : this.matchData.challenger?.username;
        const opponentId = this.isChallenger ? this.matchData.opponent_id : this.matchData.challenger_id;

        const won = this.playerScore > this.opponentScore;
        const draw = this.playerScore === this.opponentScore;

        App.showScreen('finisher');

        const overlay = document.getElementById('finisher-overlay');
        const text = document.getElementById('finisher-text');
        const winner = document.getElementById('finisher-winner');
        const h2hEl = document.getElementById('finisher-h2h');
        h2hEl.innerHTML = '';
        if (opponentId && State.user) {
            fetchH2H(opponentId).then(stats => renderH2H(h2hEl, stats, opponentName));
        }

        if (draw) {
            Finisher.playDraw(playerRobot.parts, opponentRobot.parts,
                getRobotSizeClass(playerRobot.parts), getRobotSizeClass(opponentRobot.parts), () => {
                text.textContent = "IT'S A DRAW";
                text.className = 'finisher-text draw';
                winner.textContent = `${playerName} and ${opponentName} — evenly matched!`;
                overlay.classList.add('visible');
            });
            return;
        }

        // Player is always on the left; opponent always on the right — match the battle layout.
        // Pass leftParts/rightParts + which side holds the winner.
        const winnerOnLeft = won;
        Finisher.play({
            leftParts: playerRobot.parts,
            rightParts: opponentRobot.parts,
            leftSize: getRobotSizeClass(playerRobot.parts),
            rightSize: getRobotSizeClass(opponentRobot.parts),
            winnerOnLeft,
            onComplete: () => {
                const winnerName = won ? playerName : opponentName;
                const loserName = won ? opponentName : playerName;
                text.textContent = `${winnerName.toUpperCase()} DESTROYS ${loserName.toUpperCase()}`;
                text.className = `finisher-text ${won ? 'victory' : ''}`;
                winner.textContent = won ? 'VICTORY!' : 'DEFEATED';
                overlay.classList.add('visible');
            }
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
