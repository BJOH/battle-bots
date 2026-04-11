// ============================================
// BATTLE BOTS — Game Data
// ============================================

const PARTS = {
    head: [
        {
            id: 'head_basic', name: 'Scout Visor', icon: '👁️',
            description: 'Basic optical sensor array',
            stats: { hp: 5, attack: 2, defense: 1, speed: 3, energy: 5 },
            cost: 0, tier: 1
        },
        {
            id: 'head_sensor', name: 'Multi-Sensor', icon: '📡',
            description: 'Enhanced targeting systems for improved accuracy',
            stats: { hp: 5, attack: 5, defense: 2, speed: 4, energy: 8 },
            cost: 200, tier: 2
        },
        {
            id: 'head_heavy', name: 'Fortress Helm', icon: '⛑️',
            description: 'Heavily armored cranial unit',
            stats: { hp: 15, attack: 2, defense: 8, speed: 1, energy: 5 },
            cost: 300, tier: 2
        },
        {
            id: 'head_ai', name: 'Neural Core', icon: '🧠',
            description: 'Advanced AI processor — boosts all systems',
            stats: { hp: 10, attack: 6, defense: 4, speed: 6, energy: 15 },
            cost: 600, tier: 3
        },
        {
            id: 'head_omega', name: 'Omega Cortex', icon: '💠',
            description: 'Experimental quantum processing unit',
            stats: { hp: 15, attack: 8, defense: 6, speed: 7, energy: 20 },
            cost: 1200, tier: 4
        }
    ],
    torso: [
        {
            id: 'torso_basic', name: 'Light Frame', icon: '📦',
            description: 'Standard lightweight chassis',
            stats: { hp: 20, attack: 0, defense: 3, speed: 3, energy: 10 },
            cost: 0, tier: 1
        },
        {
            id: 'torso_balanced', name: 'Alloy Core', icon: '🔲',
            description: 'Balanced titanium alloy frame',
            stats: { hp: 30, attack: 2, defense: 6, speed: 2, energy: 15 },
            cost: 250, tier: 2
        },
        {
            id: 'torso_tank', name: 'Juggernaut Plate', icon: '🛡️',
            description: 'Maximum armor plating, built to endure',
            stats: { hp: 50, attack: 0, defense: 12, speed: -2, energy: 10 },
            cost: 400, tier: 2
        },
        {
            id: 'torso_reactor', name: 'Reactor Chassis', icon: '⚛️',
            description: 'Built-in fusion reactor for massive energy',
            stats: { hp: 25, attack: 3, defense: 5, speed: 2, energy: 30 },
            cost: 700, tier: 3
        },
        {
            id: 'torso_omega', name: 'Apex Frame', icon: '💎',
            description: 'Cutting-edge adaptive nanofiber body',
            stats: { hp: 45, attack: 5, defense: 10, speed: 4, energy: 25 },
            cost: 1400, tier: 4
        }
    ],
    arms: [
        {
            id: 'arms_basic', name: 'Utility Arms', icon: '🦾',
            description: 'Standard manipulator arms',
            stats: { hp: 0, attack: 5, defense: 2, speed: 2, energy: 0 },
            cost: 0, tier: 1
        },
        {
            id: 'arms_claws', name: 'Rip Claws', icon: '🦀',
            description: 'Razor-sharp melee claws',
            stats: { hp: 0, attack: 10, defense: 1, speed: 4, energy: 0 },
            cost: 250, tier: 2
        },
        {
            id: 'arms_shield', name: 'Barrier Arms', icon: '🤖',
            description: 'Arm-mounted energy shields',
            stats: { hp: 5, attack: 3, defense: 10, speed: 0, energy: 5 },
            cost: 300, tier: 2
        },
        {
            id: 'arms_cannon', name: 'Assault Arms', icon: '💪',
            description: 'Integrated weapon systems in each arm',
            stats: { hp: 0, attack: 14, defense: 3, speed: 2, energy: 5 },
            cost: 650, tier: 3
        },
        {
            id: 'arms_omega', name: 'Titan Arms', icon: '⚔️',
            description: 'Dual-purpose devastation appendages',
            stats: { hp: 5, attack: 16, defense: 6, speed: 4, energy: 8 },
            cost: 1300, tier: 4
        }
    ],
    legs: [
        {
            id: 'legs_basic', name: 'Strider Legs', icon: '🦿',
            description: 'Basic bipedal locomotion',
            stats: { hp: 5, attack: 0, defense: 2, speed: 5, energy: 0 },
            cost: 0, tier: 1
        },
        {
            id: 'legs_treads', name: 'Tank Treads', icon: '⛓️',
            description: 'Heavy treads for stability and armor',
            stats: { hp: 10, attack: 0, defense: 8, speed: 1, energy: 0 },
            cost: 250, tier: 2
        },
        {
            id: 'legs_boost', name: 'Jet Legs', icon: '🚀',
            description: 'Thruster-equipped legs for high mobility',
            stats: { hp: 0, attack: 2, defense: 1, speed: 12, energy: 5 },
            cost: 350, tier: 2
        },
        {
            id: 'legs_spider', name: 'Arachnid Base', icon: '🕷️',
            description: 'Multi-legged platform — speed and stability',
            stats: { hp: 10, attack: 3, defense: 6, speed: 8, energy: 5 },
            cost: 700, tier: 3
        },
        {
            id: 'legs_omega', name: 'Gravity Drives', icon: '🌀',
            description: 'Anti-gravity hover system — unmatched agility',
            stats: { hp: 5, attack: 2, defense: 5, speed: 15, energy: 10 },
            cost: 1400, tier: 4
        }
    ],
    weapon: [
        {
            id: 'weapon_blaster', name: 'Pulse Blaster', icon: '🔫',
            description: 'Standard energy weapon',
            stats: { hp: 0, attack: 8, defense: 0, speed: 2, energy: 0 },
            cost: 0, tier: 1
        },
        {
            id: 'weapon_shotgun', name: 'Scatter Cannon', icon: '💥',
            description: 'Wide-spread kinetic damage',
            stats: { hp: 0, attack: 12, defense: 0, speed: 0, energy: 0 },
            cost: 300, tier: 2
        },
        {
            id: 'weapon_sniper', name: 'Rail Driver', icon: '🎯',
            description: 'Precision electromagnetic accelerator',
            stats: { hp: 0, attack: 15, defense: 0, speed: -1, energy: 5 },
            cost: 400, tier: 2
        },
        {
            id: 'weapon_plasma', name: 'Plasma Launcher', icon: '☄️',
            description: 'Superheated plasma projectiles',
            stats: { hp: 0, attack: 20, defense: 0, speed: 1, energy: 8 },
            cost: 800, tier: 3
        },
        {
            id: 'weapon_omega', name: 'Annihilator', icon: '⚡',
            description: 'Experimental disintegration beam',
            stats: { hp: 0, attack: 26, defense: 0, speed: 2, energy: 12 },
            cost: 1500, tier: 4
        }
    ],
    special: [
        {
            id: 'special_none', name: 'None', icon: '➖',
            description: 'No special module equipped',
            stats: { hp: 0, attack: 0, defense: 0, speed: 0, energy: 0 },
            cost: 0, tier: 0,
            ability: null
        },
        {
            id: 'special_shield', name: 'Energy Shield', icon: '🔵',
            description: 'Deployable energy barrier — blocks 50% damage for 2 turns',
            stats: { hp: 0, attack: 0, defense: 5, speed: 0, energy: 10 },
            cost: 350, tier: 2,
            ability: { type: 'shield', duration: 2, reduction: 0.5, energyCost: 20 }
        },
        {
            id: 'special_overcharge', name: 'Overcharger', icon: '🔴',
            description: 'Overcharge weapons — 2x damage next attack',
            stats: { hp: 0, attack: 5, defense: 0, speed: 0, energy: 10 },
            cost: 400, tier: 2,
            ability: { type: 'overcharge', multiplier: 2, energyCost: 25 }
        },
        {
            id: 'special_repair', name: 'Nano Repair Bay', icon: '🟢',
            description: 'Advanced nanobots for superior self-repair',
            stats: { hp: 10, attack: 0, defense: 0, speed: 0, energy: 10 },
            cost: 500, tier: 3,
            ability: { type: 'repair_boost', healMultiplier: 1.5, energyCost: 15 }
        },
        {
            id: 'special_emp', name: 'EMP Burst', icon: '🟡',
            description: 'Electromagnetic pulse — drains enemy energy',
            stats: { hp: 0, attack: 3, defense: 3, speed: 3, energy: 15 },
            cost: 600, tier: 3,
            ability: { type: 'emp', energyDrain: 30, energyCost: 20 }
        },
        {
            id: 'special_omega', name: 'Singularity Core', icon: '⚫',
            description: 'Gravitational singularity — massive AoE damage',
            stats: { hp: 5, attack: 8, defense: 5, speed: 3, energy: 20 },
            cost: 1500, tier: 4,
            ability: { type: 'singularity', damage: 40, selfDamage: 10, energyCost: 35 }
        }
    ]
};

const ARENAS = [
    {
        id: 'junkyard',
        name: 'The Junkyard',
        description: 'Scrapheap brawls — rusted opponents, easy pickings',
        difficulty: 'Easy',
        reward: 150,
        color: '#4a6741',
        enemies: [
            {
                name: 'Scrap Heap',
                parts: {
                    head: 'head_basic', torso: 'torso_basic', arms: 'arms_basic',
                    legs: 'legs_basic', weapon: 'weapon_blaster', special: 'special_none'
                }
            },
            {
                name: 'Rust Bucket',
                parts: {
                    head: 'head_basic', torso: 'torso_balanced', arms: 'arms_basic',
                    legs: 'legs_basic', weapon: 'weapon_blaster', special: 'special_none'
                }
            }
        ],
        aiLevel: 0.2
    },
    {
        id: 'pit',
        name: 'The Pit',
        description: 'Underground arena — tougher bots, bigger stakes',
        difficulty: 'Medium',
        reward: 350,
        color: '#6b4a2a',
        enemies: [
            {
                name: 'Iron Fang',
                parts: {
                    head: 'head_sensor', torso: 'torso_balanced', arms: 'arms_claws',
                    legs: 'legs_boost', weapon: 'weapon_shotgun', special: 'special_shield'
                }
            },
            {
                name: 'Bulwark',
                parts: {
                    head: 'head_heavy', torso: 'torso_tank', arms: 'arms_shield',
                    legs: 'legs_treads', weapon: 'weapon_shotgun', special: 'special_repair'
                }
            }
        ],
        aiLevel: 0.5
    },
    {
        id: 'coliseum',
        name: 'Chrome Coliseum',
        description: 'Elite tournament — only the strong survive',
        difficulty: 'Hard',
        reward: 600,
        color: '#3a4a6b',
        enemies: [
            {
                name: 'Phantom X',
                parts: {
                    head: 'head_ai', torso: 'torso_reactor', arms: 'arms_cannon',
                    legs: 'legs_spider', weapon: 'weapon_plasma', special: 'special_overcharge'
                }
            },
            {
                name: 'Fortress Prime',
                parts: {
                    head: 'head_ai', torso: 'torso_tank', arms: 'arms_shield',
                    legs: 'legs_spider', weapon: 'weapon_sniper', special: 'special_emp'
                }
            }
        ],
        aiLevel: 0.75
    },
    {
        id: 'nexus',
        name: 'The Nexus',
        description: 'The ultimate challenge — face the Omega machines',
        difficulty: 'Extreme',
        reward: 1200,
        color: '#5a2a5a',
        enemies: [
            {
                name: 'OMEGA-7',
                parts: {
                    head: 'head_omega', torso: 'torso_omega', arms: 'arms_omega',
                    legs: 'legs_omega', weapon: 'weapon_omega', special: 'special_omega'
                }
            }
        ],
        aiLevel: 0.95
    }
];

const TIER_COLORS = {
    0: '#666',
    1: '#aab',
    2: '#00d4ff',
    3: '#ff6b35',
    4: '#ffd700'
};

const STAT_MAX = {
    hp: 120,
    attack: 70,
    defense: 50,
    speed: 40,
    energy: 80
};
