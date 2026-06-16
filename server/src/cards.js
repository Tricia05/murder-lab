// ---------------------------------------------------------------------------
// Card pool for Murder Lab (faithful to Deception: Murder in Hong Kong).
//
// TWO separate decks, exactly as in the board game:
//   - MEANS cards (blue): the murder weapon / method. The murderer picks one
//     as the "Means of Murder".
//   - CLUE cards (red): incidental evidence / personal items left behind. The
//     murderer picks one as the "Key Evidence".
//
// Every player is dealt 4 Means + 4 Clue cards (configurable 3–5 for
// difficulty). With 14 players that needs 56 of each deck without duplicates,
// so both pools hold 64+ unique cards.
// ---------------------------------------------------------------------------

// [name, icon]
const MEANS = [
  ['Pistol', '🔫'], ['Revolver', '💥'], ['Shotgun', '🌫️'], ['Hunting Rifle', '🎯'],
  ['Knife', '🔪'], ['Dagger', '🗡️'], ['Cleaver', '🪓'], ['Scalpel', '🪒'],
  ['Box Cutter', '📦'], ['Axe', '🪓'], ['Machete', '⚔️'], ['Ice Pick', '⛏️'],
  ['Hammer', '🔨'], ['Wrench', '🔧'], ['Crowbar', '🪝'], ['Baseball Bat', '🏏'],
  ['Golf Club', '🏌️'], ['Brick', '🧱'], ['Dumbbell', '🏋️'], ['Frying Pan', '🍳'],
  ['Candlestick', '🕯️'], ['Trophy', '🏆'], ['Rope', '🪢'], ['Piano Wire', '🎻'],
  ['Chain', '⛓️'], ['Leather Belt', '🥋'], ['Silk Scarf', '🧣'], ['Extension Cord', '🔌'],
  ['Plastic Bag', '🛍️'], ['Pillow', '🛏️'], ['Cyanide', '☠️'], ['Arsenic', '🧂'],
  ['Bleach', '🧼'], ['Acid', '⚗️'], ['Chloroform', '🧪'], ['Rat Poison', '🐀'],
  ['Antifreeze', '❄️'], ['Mercury', '💧'], ['Pesticide', '🪳'], ['Ether', '🌫️'],
  ['Insulin', '🍬'], ['Sleeping Pills', '💊'], ['Painkillers', '🤕'], ['Syringe', '💉'],
  ['Toxic Gas', '🫧'], ['Carbon Monoxide', '🚗'], ['Lighter Fluid', '🔥'], ['Live Wire', '⚡'],
  ['Letter Opener', '✉️'], ['Scissors', '✂️'], ['Screwdriver', '🪛'], ['Power Drill', '🔩'],
  ['Hand Saw', '🪚'], ['Nail Gun', '🔨'], ['Pitchfork', '🔱'], ['Garrote', '➰'],
  ['Shovel', '⚒️'], ['Kitchen Cleaver', '🥩'], ['Corkscrew', '🍾'], ['Fire Poker', '🔥'],
  ['Curtain Cord', '🪟'], ['Stiletto Heel', '👠'], ['Heavy Vase', '🏺'], ['Meat Hook', '🪝'],
];

const CLUES = [
  ['Hotel Key', '🔑'], ['Car Keys', '🗝️'], ['Diary', '📔'], ['Notebook', '📓'],
  ['Love Letter', '✉️'], ['Photograph', '📷'], ['Wallet', '👛'], ['Handbag', '👜'],
  ['Cash Roll', '💵'], ['Credit Card', '💳'], ['Receipt', '🧾'], ['Train Ticket', '🎫'],
  ['Plane Ticket', '🛫'], ['Passport', '📕'], ['ID Card', '🪪'], ['Business Card', '💼'],
  ['Smartphone', '📱'], ['Charger Cable', '🔌'], ['Laptop', '💻'], ['USB Drive', '💾'],
  ['Wristwatch', '⌚'], ['Broken Watch', '🕰️'], ['Diamond Ring', '💍'], ['Necklace', '📿'],
  ['Earring', '💎'], ['Bracelet', '⛓️'], ['Lipstick', '💄'], ['Perfume Bottle', '🌸'],
  ['Compact Mirror', '🪞'], ['Hair Comb', '💈'], ['Hairpin', '📌'], ['Reading Glasses', '👓'],
  ['Sunglasses', '🕶️'], ['Contact Lens', '👁️'], ['Tissue', '🧻'], ['Handkerchief', '🤧'],
  ['Leather Glove', '🧤'], ['Fedora Hat', '🎩'], ['Dress Shoe', '👞'], ['Wool Sock', '🧦'],
  ['Silk Tie', '👔'], ['Shirt Button', '🔘'], ['Cufflink', '🔗'], ['Umbrella', '☂️'],
  ['Cigarette Butt', '🚬'], ['Matchbook', '🔥'], ['Wine Glass', '🍷'], ['Coffee Mug', '☕'],
  ['Empty Bottle', '🍾'], ['Pill Bottle', '🧴'], ['Folded Map', '🗺️'], ['Newspaper', '📰'],
  ['Magazine', '📖'], ['Bookmark', '🔖'], ['Fountain Pen', '🖊️'], ['Old Coin', '🪙'],
  ['Keychain', '🧷'], ['Torn Photo', '🖼️'], ['Bus Pass', '🚌'], ['Library Card', '📚'],
  ['Lottery Ticket', '🎰'], ['Wedding Band', '💒'], ['Pocket Watch', '⏱️'], ['Name Tag', '🏷️'],
];

/** Turn "Sleeping Pills" into "sleeping-pills". */
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function build(list, deck) {
  return list.map(([name, icon]) => ({ id: `${deck}-${slugify(name)}`, name, icon, deck }));
}

/** The blue "Means of Murder" deck. */
export const MEANS_POOL = build(MEANS, 'means');
/** The red "Key Evidence" deck. */
export const CLUE_POOL = build(CLUES, 'clue');

/** Fast lookup by card id across both decks. */
export const CARD_BY_ID = new Map([...MEANS_POOL, ...CLUE_POOL].map((c) => [c.id, c]));
