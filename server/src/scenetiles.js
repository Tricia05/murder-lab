// ---------------------------------------------------------------------------
// Scene tiles for Murder Lab (faithful to Deception: Murder in Hong Kong).
//
// The Forensic Scientist communicates ONLY by placing one bullet marker on
// one option of each scene tile. Every tile has exactly 6 options.
//
// Each round 6 tiles are in play:
//   - "Cause of Death" and "Location of Crime" are FIXED (always present),
//   - the other 4 are drawn at random from the pool below.
// In rounds 2 and 3 the scientist swaps ONE non-fixed tile for a fresh one
// and re-marks it, so the evidence evolves.
// ---------------------------------------------------------------------------

function tile(id, label, fixed, optionLabels) {
  return {
    id,
    label,
    fixed,
    options: optionLabels.map((l) => ({ id: l.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: l })),
  };
}

// The two tiles that are always on the table.
export const FIXED_TILES = [
  tile('cause-of-death', 'Cause of Death', true,
    ['Asphyxiation', 'Poisoning', 'Blood Loss', 'Blunt Force', 'Burning', 'Drowning']),
  tile('location-of-crime', 'Location of Crime', true,
    ['Bedroom', 'Kitchen', 'Bathroom', 'Office', 'Garden', 'Back Alley']),
];

// Random pool — 4 of these are drawn each game; one may be swapped in per round.
export const TILE_POOL = [
  tile('corpse-condition', 'Corpse Condition', false,
    ['Bruised', 'Burned', 'Pale', 'Bloodied', 'Swollen', 'Untouched']),
  tile('time-of-crime', 'Time of Crime', false,
    ['Dawn', 'Morning', 'Noon', 'Evening', 'Midnight', 'Late Night']),
  tile('duration-of-crime', 'Duration of Crime', false,
    ['Seconds', 'A Few Minutes', 'Half an Hour', 'Hours', 'All Night', 'Unknown']),
  tile('victims-final-act', "Victim's Final Act", false,
    ['Sleeping', 'Eating', 'Bathing', 'Working', 'Arguing', 'Fleeing']),
  tile('weather', 'Weather', false,
    ['Clear', 'Rainy', 'Foggy', 'Stormy', 'Snowy', 'Humid']),
  tile('relationship', 'Relationship to Victim', false,
    ['Lover', 'Family', 'Friend', 'Colleague', 'Stranger', 'Rival']),
  tile('murderers-trait', "Murderer's Trait", false,
    ['Tall', 'Strong', 'Calm', 'Nervous', 'Skilled', 'Reckless']),
  tile('murderers-motive', "Murderer's Motive", false,
    ['Rage', 'Jealousy', 'Greed', 'Fear', 'Revenge', 'Cold-Blooded']),
  tile('object-at-scene', 'Object at the Scene', false,
    ['Glass', 'Paper', 'Cloth', 'Metal', 'Plastic', 'Wood']),
  tile('clue-on-scene', 'Clue on the Scene', false,
    ['Footprints', 'Fingerprints', 'Blood Stain', 'Torn Fabric', 'Spilled Liquid', 'Nothing']),
  tile('wound-location', 'Wound Location', false,
    ['Head', 'Chest', 'Back', 'Neck', 'Limbs', 'No Wound']),
  tile('body-position', 'Body Position', false,
    ['On the Bed', 'On the Floor', 'In a Chair', 'Against a Wall', 'By the Door', 'Arranged']),
  tile('state-of-scene', 'State of the Scene', false,
    ['Tidy', 'Messy', 'Ransacked', 'Staged', 'Bloody', 'Untouched']),
  tile('sound-of-crime', 'Sound of the Crime', false,
    ['Silent', 'Quiet', 'A Scream', 'A Struggle', 'A Loud Bang', 'Prolonged']),
  tile('lighting', 'Lighting', false,
    ['Bright', 'Dim', 'Dark', 'Flickering', 'Candlelit', 'Daylight']),
  tile('evidence-type', 'Type of Evidence', false,
    ['Biological', 'Chemical', 'Physical', 'Digital', 'Trace', 'None Found']),
  tile('victims-attire', "Victim's Attire", false,
    ['Nightwear', 'Formal', 'Casual', 'Uniform', 'Partial', 'Disguised']),
  tile('point-of-entry', 'Point of Entry', false,
    ['Front Door', 'Back Door', 'Window', 'Rooftop', 'No Forced Entry', 'Unknown']),
];

export const ALL_TILES_BY_ID = new Map([...FIXED_TILES, ...TILE_POOL].map((t) => [t.id, t]));

/** Build the 6 starting tiles: the 2 fixed + 4 random from the pool. */
export function drawStartingTiles(shuffleFn) {
  return [...FIXED_TILES, ...shuffleFn(TILE_POOL).slice(0, 4)];
}

/** Pick a fresh non-fixed tile not already in play (for a round 2/3 swap). */
export function drawReplacementTile(shuffleFn, tilesInPlay) {
  const used = new Set(tilesInPlay.map((t) => t.id));
  return shuffleFn(TILE_POOL).find((t) => !used.has(t.id)) || null;
}

/** A short narrative "forensic report" line per marked tile (flavor only;
 *  derived purely from the public markers, so it reveals no extra info). */
const TEMPLATES = {
  'cause-of-death': 'Cause of death: {o}.',
  'location-of-crime': 'The body was found in the {o}.',
  'corpse-condition': 'The corpse was {o}.',
  'time-of-crime': 'Estimated time of the crime: {o}.',
  'duration-of-crime': 'The act took {o}.',
  'victims-final-act': 'The victim was {o} at the time.',
  weather: 'The weather was {o}.',
  relationship: 'The killer was likely the victim’s {o}.',
  'murderers-trait': 'The murderer seemed {o}.',
  'murderers-motive': 'The motive reads as {o}.',
  'object-at-scene': 'A telling object at the scene: {o}.',
  'clue-on-scene': 'Left at the scene: {o}.',
  'wound-location': 'The wound was to the {o}.',
  'body-position': 'The body lay {o}.',
  'state-of-scene': 'The scene was {o}.',
  'sound-of-crime': 'Neighbours recall {o}.',
  lighting: 'The lighting was {o}.',
  'evidence-type': 'Evidence recovered was {o}.',
  'victims-attire': 'The victim wore {o}.',
  'point-of-entry': 'Point of entry: {o}.',
};

export function reportLine(tile, optionLabel) {
  const tmpl = TEMPLATES[tile.id] || '{label}: {o}.';
  return tmpl.replace('{label}', tile.label).replace('{o}', optionLabel.toLowerCase());
}
