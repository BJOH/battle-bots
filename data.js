// ============================================
// BATTLE BOTS — Game Data v2
// ============================================

const PARTS = {
    head: [
        { id: 'head_scout', name: 'Scout Visor', icon: '👁️', description: 'Basic optical sensor', tier: 1, sizeClass: 'light' },
        { id: 'head_sensor', name: 'Multi-Sensor', icon: '📡', description: 'Enhanced targeting array', tier: 2, sizeClass: 'light' },
        { id: 'head_helm', name: 'Fortress Helm', icon: '⛑️', description: 'Heavy armored cranial unit', tier: 2, sizeClass: 'heavy' },
        { id: 'head_neural', name: 'Neural Core', icon: '🧠', description: 'Advanced AI processor', tier: 3, sizeClass: 'medium' },
        { id: 'head_omega', name: 'Omega Cortex', icon: '💠', description: 'Quantum processing unit', tier: 4, sizeClass: 'heavy' },
    ],
    torso: [
        { id: 'torso_light', name: 'Light Frame', icon: '📦', description: 'Lightweight chassis', tier: 1, sizeClass: 'light' },
        { id: 'torso_alloy', name: 'Alloy Core', icon: '🔲', description: 'Titanium alloy frame', tier: 2, sizeClass: 'medium' },
        { id: 'torso_jugg', name: 'Juggernaut Plate', icon: '🛡️', description: 'Maximum armor plating', tier: 2, sizeClass: 'heavy' },
        { id: 'torso_reactor', name: 'Reactor Chassis', icon: '⚛️', description: 'Fusion reactor core', tier: 3, sizeClass: 'medium' },
        { id: 'torso_apex', name: 'Apex Frame', icon: '💎', description: 'Adaptive nanofiber body', tier: 4, sizeClass: 'heavy' },
    ],
    arms: [
        { id: 'arms_util', name: 'Utility Arms', icon: '🦾', description: 'Standard manipulators', tier: 1, sizeClass: 'light' },
        { id: 'arms_claws', name: 'Rip Claws', icon: '🦀', description: 'Razor-sharp claws', tier: 2, sizeClass: 'medium' },
        { id: 'arms_shield', name: 'Barrier Arms', icon: '🤖', description: 'Energy shield mounts', tier: 2, sizeClass: 'heavy' },
        { id: 'arms_cannon', name: 'Assault Arms', icon: '💪', description: 'Integrated weapons', tier: 3, sizeClass: 'medium' },
        { id: 'arms_titan', name: 'Titan Arms', icon: '⚔️', description: 'Devastation appendages', tier: 4, sizeClass: 'heavy' },
    ],
    legs: [
        { id: 'legs_strider', name: 'Strider Legs', icon: '🦿', description: 'Basic bipedal', tier: 1, sizeClass: 'light' },
        { id: 'legs_treads', name: 'Tank Treads', icon: '⛓️', description: 'Heavy treads', tier: 2, sizeClass: 'heavy' },
        { id: 'legs_jet', name: 'Jet Legs', icon: '🚀', description: 'Thruster-equipped', tier: 2, sizeClass: 'light' },
        { id: 'legs_spider', name: 'Arachnid Base', icon: '🕷️', description: 'Multi-legged platform', tier: 3, sizeClass: 'medium' },
        { id: 'legs_gravity', name: 'Gravity Drives', icon: '🌀', description: 'Anti-gravity hover', tier: 4, sizeClass: 'medium' },
    ],
    weapon: [
        { id: 'weapon_blaster', name: 'Pulse Blaster', icon: '🔫', description: 'Energy projectiles', tier: 1, sizeClass: 'light', weaponType: 'energy' },
        { id: 'weapon_scatter', name: 'Scatter Cannon', icon: '💥', description: 'Wide-spread kinetic', tier: 2, sizeClass: 'medium', weaponType: 'kinetic' },
        { id: 'weapon_rail', name: 'Rail Driver', icon: '🎯', description: 'Precision beam', tier: 2, sizeClass: 'medium', weaponType: 'beam' },
        { id: 'weapon_plasma', name: 'Plasma Launcher', icon: '☄️', description: 'Superheated plasma', tier: 3, sizeClass: 'heavy', weaponType: 'plasma' },
        { id: 'weapon_annihilator', name: 'Annihilator', icon: '⚡', description: 'Disintegration beam', tier: 4, sizeClass: 'heavy', weaponType: 'beam' },
    ],
    special: [
        { id: 'special_none', name: 'None', icon: '➖', description: 'No module', tier: 0, sizeClass: 'light' },
        { id: 'special_shield', name: 'Energy Shield', icon: '🔵', description: 'Barrier generator', tier: 2, sizeClass: 'medium' },
        { id: 'special_charge', name: 'Overcharger', icon: '🔴', description: 'Weapon amplifier', tier: 2, sizeClass: 'light' },
        { id: 'special_repair', name: 'Nano Repair', icon: '🟢', description: 'Self-repair nanobots', tier: 3, sizeClass: 'medium' },
        { id: 'special_emp', name: 'EMP Burst', icon: '🟡', description: 'Electromagnetic pulse', tier: 3, sizeClass: 'medium' },
        { id: 'special_singularity', name: 'Singularity Core', icon: '⚫', description: 'Gravitational core', tier: 4, sizeClass: 'heavy' },
    ]
};

const PART_ID_MAP = {
    'head_scout': 'head_basic', 'head_sensor': 'head_sensor', 'head_helm': 'head_heavy',
    'head_neural': 'head_ai', 'head_omega': 'head_omega',
    'torso_light': 'torso_basic', 'torso_alloy': 'torso_balanced', 'torso_jugg': 'torso_tank',
    'torso_reactor': 'torso_reactor', 'torso_apex': 'torso_omega',
    'arms_util': 'arms_basic', 'arms_claws': 'arms_claws', 'arms_shield': 'arms_shield',
    'arms_cannon': 'arms_cannon', 'arms_titan': 'arms_omega',
    'legs_strider': 'legs_basic', 'legs_treads': 'legs_treads', 'legs_jet': 'legs_boost',
    'legs_spider': 'legs_spider', 'legs_gravity': 'legs_omega',
    'weapon_blaster': 'weapon_blaster', 'weapon_scatter': 'weapon_shotgun',
    'weapon_rail': 'weapon_sniper', 'weapon_plasma': 'weapon_plasma',
    'weapon_annihilator': 'weapon_omega',
    'special_none': 'special_none', 'special_shield': 'special_shield',
    'special_charge': 'special_overcharge', 'special_repair': 'special_repair',
    'special_emp': 'special_emp', 'special_singularity': 'special_omega',
};

function getRenderParts(parts) {
    const result = {};
    for (const [slot, id] of Object.entries(parts)) {
        result[slot] = PART_ID_MAP[id] || id;
    }
    return result;
}

function getRobotSizeClass(parts) {
    const sizes = { light: 0, medium: 0, heavy: 0 };
    for (const [slot, partId] of Object.entries(parts)) {
        const category = PARTS[slot];
        if (!category) continue;
        const part = category.find(p => p.id === partId);
        if (part) sizes[part.sizeClass]++;
    }
    if (sizes.heavy >= 3) return 'heavy';
    if (sizes.light >= 3) return 'light';
    return 'medium';
}

function getWeaponType(parts) {
    const wp = PARTS.weapon.find(w => w.id === parts.weapon);
    return wp ? wp.weaponType : 'energy';
}

const TIER_COLORS = { 0: '#666', 1: '#aab', 2: '#00d4ff', 3: '#ff6b35', 4: '#ffd700' };

const DEFAULT_PARTS = {
    head: 'head_scout', torso: 'torso_light', arms: 'arms_util',
    legs: 'legs_strider', weapon: 'weapon_blaster', special: 'special_none'
};

const POSITIONS = ['high', 'mid', 'low'];
const POSITION_ICONS = { high: '⬆️', mid: '➡️', low: '⬇️' };
const POSITION_LABELS = { high: 'HIGH', mid: 'MID', low: 'LOW' };

// Belt system
const BELTS = [
    { name: 'White Belt', minWins: 0, color: '#e0e0e0', bg: 'rgba(224,224,224,0.15)' },
    { name: 'Yellow Belt', minWins: 3, color: '#ffd600', bg: 'rgba(255,214,0,0.15)' },
    { name: 'Orange Belt', minWins: 7, color: '#ff9100', bg: 'rgba(255,145,0,0.15)' },
    { name: 'Green Belt', minWins: 15, color: '#00e676', bg: 'rgba(0,230,118,0.15)' },
    { name: 'Blue Belt', minWins: 25, color: '#448aff', bg: 'rgba(68,138,255,0.15)' },
    { name: 'Purple Belt', minWins: 40, color: '#b388ff', bg: 'rgba(179,136,255,0.15)' },
    { name: 'Brown Belt', minWins: 60, color: '#8d6e63', bg: 'rgba(141,110,99,0.15)' },
    { name: 'Red Belt', minWins: 85, color: '#ff1744', bg: 'rgba(255,23,68,0.15)' },
    { name: 'Black Belt', minWins: 100, color: '#263238', bg: 'rgba(38,50,56,0.4)' },
];

function getBelt(wins) {
    let belt = BELTS[0];
    for (const b of BELTS) {
        if (wins >= b.minWins) belt = b;
    }
    return belt;
}
