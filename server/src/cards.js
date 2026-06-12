// ---------------------------------------------------------------------------
// Card pool for Murder Lab.
//
// 72 unique item cards across 7 categories, each with an emoji "picture" and
// a `methodOk` flag: only plausibly-lethal items may be chosen as the murder
// METHOD. Any other card can be the KEY EVIDENCE (evidence answers "what got
// left behind", so even a Train Ticket qualifies).
//
// With the maximum of 14 players each holding 5 cards we need 70 cards, so
// the pool is always sufficient to deal without duplicates.
// ---------------------------------------------------------------------------

// [name, icon, methodOk]
const POOL = {
  chemical: [
    ['Cyanide', '☠️', true], ['Chloroform', '🧪', true], ['Acid', '⚗️', true], ['Bleach', '🧼', true],
    ['Arsenic', '🧂', true], ['Sleeping Pills', '💊', true], ['Rat Poison', '🐀', true], ['Antifreeze', '❄️', true],
    ['Mercury', '💧', true], ['Pesticide', '🪳', true], ['Ammonia', '🫧', true], ['Ether', '🌫️', true],
  ],
  tool: [
    ['Rope', '🪢', true], ['Hammer', '🔨', true], ['Knife', '🔪', true], ['Syringe', '💉', true],
    ['Wrench', '🔧', true], ['Scalpel', '🪒', true], ['Pliers', '🗜️', false], ['Drill', '🔩', true],
    ['Saw', '🪚', true], ['Crowbar', '🪝', true], ['Box Cutter', '🗡️', true], ['Chain', '⛓️', true],
  ],
  weapon: [
    ['Pistol', '🔫', true], ['Crossbow', '🏹', true], ['Baseball Bat', '🏏', true], ['Ice Pick', '⛏️', true],
    ['Shovel', '⚒️', true], ['Axe', '🪓', true], ['Brick', '🧱', true], ['Dumbbell', '🏋️', true],
  ],
  household: [
    ['Extension Cord', '🔌', true], ['Frying Pan', '🍳', true], ['Scissors', '✂️', true], ['Clothes Iron', '♨️', true],
    ['Toaster', '🍞', false], ['Plastic Bag', '🛍️', true], ['Leather Belt', '🥋', true], ['Screwdriver', '🪛', true],
  ],
  medical: [
    ['Insulin', '🍬', true], ['Defibrillator', '⚡', true], ['Bandages', '🩹', false], ['Oxygen Tank', '🫁', true],
    ['Thermometer', '🌡️', false], ['IV Drip', '🏥', true], ['Surgical Mask', '😷', false], ['Painkillers', '🤕', true],
  ],
  object: [
    ['Wine Glass', '🍷', true], ['Coffee Mug', '☕', false], ['Pillow', '🛏️', true], ['Candle', '🕯️', true],
    ['Laptop', '💻', false], ['Gloves', '🧤', false], ['Scarf', '🧣', true], ['Umbrella', '☂️', true],
    ['Phone Charger', '📱', true], ['High Heel', '👠', true], ['Trophy', '🏆', true], ['Guitar String', '🎸', true],
  ],
  evidence: [
    ['Hotel Key', '🔑', false], ['Notebook', '📓', false], ['Wallet', '👛', false], ['Medicine Bottle', '🧴', false],
    ['Tissue', '🧻', false], ['Broken Watch', '⌚', false], ['Lipstick', '💄', false], ['Cigarette Butt', '🚬', false],
    ['Train Ticket', '🎫', false], ['Reading Glasses', '👓', false], ['Earring', '💎', false], ['Receipt', '🧾', false],
  ],
};

/** Turn "Sleeping Pills" into "sleeping-pills". */
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** Flat list of every card: { id, name, icon, category, methodOk }. */
export const CARD_POOL = Object.entries(POOL).flatMap(([category, items]) =>
  items.map(([name, icon, methodOk]) => ({
    id: `${category}-${slugify(name)}`,
    name,
    icon,
    category,
    methodOk,
  }))
);

/** Fast lookup by card id. */
export const CARD_BY_ID = new Map(CARD_POOL.map((c) => [c.id, c]));
