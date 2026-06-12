// ---------------------------------------------------------------------------
// Clue library for Murder Lab.
//
// 50 categories across 6 groups. Each round only EIGHT are active:
//   - 4 core categories (always present)
//   - 4 drawn at random (with precision limits), so no two rounds present
//     the same puzzle.
//
// Categories are tiered by precision:
//   broad  — flavor, narrows little
//   medium — meaningfully narrows the card space
//   sharp  — points hard at specific card types (max 1 drawn per round)
//
// Groups map to report waves:
//   wave 1 (Autopsy):    autopsy
//   wave 2 (Scene):      scene, victim
//   wave 3 (Laboratory): evidence, lab, profile
//
// `template` turns the chosen option into a crime-report sentence; `{option}`
// is replaced with the lower-cased option label.
// ---------------------------------------------------------------------------

const GROUP_WAVE = { autopsy: 1, scene: 2, victim: 2, evidence: 3, lab: 3, profile: 3 };

function cat(id, group, tier, label, template, optionLabels) {
  return {
    id,
    group,
    wave: GROUP_WAVE[group],
    tier,
    label,
    template,
    options: optionLabels.map((l) => ({
      id: l.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label: l,
    })),
  };
}

export const CLUE_CATEGORIES = [
  // ---- Group A: Autopsy (wave 1) ------------------------------------
  cat('cause-of-death', 'autopsy', 'sharp', 'Cause of Death',
    'Findings are consistent with death by {option}.',
    ['Suffocation', 'Poisoning', 'Blood Loss', 'Blunt Trauma', 'Burns', 'Organ Failure']),
  cat('manner-of-death', 'autopsy', 'medium', 'Manner of Death',
    'The examiner concludes the death was {option}.',
    ['Instant', 'Quick', 'Prolonged', 'Delayed']),
  cat('time-of-death', 'autopsy', 'broad', 'Time of Death',
    'Examination places the time of death around {option}.',
    ['the Morning Hours', 'the Afternoon', 'the Evening', 'Midnight', 'the Small Hours']),
  cat('victim-condition', 'autopsy', 'medium', 'Victim Condition',
    'At the moment of death, the victim appears to have been {option}.',
    ['Sleeping', 'Restrained', 'Surprised', 'Intoxicated', 'Fighting Back', 'Calm']),
  cat('wound-count', 'autopsy', 'medium', 'Wound Count',
    'The body presents {option}.',
    ['No Visible Wounds', 'a Single Wound', 'Multiple Wounds', 'Countless Wounds']),
  cat('wound-location', 'autopsy', 'medium', 'Wound Location',
    'Injuries are concentrated around {option}.',
    ['the Head', 'the Torso', 'the Limbs', 'the Neck', 'No Particular Area']),
  cat('body-position', 'autopsy', 'broad', 'Body Position',
    'The victim was discovered {option}.',
    ['Seated', 'Lying in Bed', 'Slumped Over', 'Sprawled on the Floor', 'Deliberately Arranged']),
  cat('expression', 'autopsy', 'broad', "Victim's Expression",
    "The victim's final expression appeared {option}.",
    ['Peaceful', 'Terrified', 'Pained', 'Blank']),

  // ---- Group B: Crime Scene (wave 2) -----------------------------------
  cat('location', 'scene', 'broad', 'Crime Scene',
    'The body was found in {option}.',
    ['a Bedroom', 'a Kitchen', 'a Bathroom', 'an Office', 'a Garden', 'a Garage', 'an Alley', 'a Hotel Room']),
  cat('scene-condition', 'scene', 'medium', 'Scene Condition',
    'Officers describe the scene as {option}.',
    ['Pristine', 'Disturbed', 'Ransacked', 'Staged']),
  cat('point-of-entry', 'scene', 'broad', 'Point of Entry',
    'Investigators noted {option}.',
    ['Entry Through the Front Door', 'Entry Through a Window', 'No Signs of Forced Entry', 'No Clear Point of Entry']),
  cat('lighting', 'scene', 'broad', 'Lighting',
    'The room was {option} at the time.',
    ['Brightly Lit', 'Dimly Lit', 'in Complete Darkness']),
  cat('crime-noise', 'scene', 'medium', 'Noise of the Crime',
    "Neighbors' statements suggest the incident was {option}.",
    ['Silent', 'Quiet', 'Loud', 'a Violent Struggle']),
  cat('temperature', 'scene', 'broad', 'Temperature',
    'The scene was {option} when officers arrived.',
    ['Cold', 'Temperate', 'Hot']),
  cat('struggle', 'scene', 'medium', 'Signs of Struggle',
    'Signs of struggle are {option}.',
    ['Absent', 'Minor', 'Severe']),
  cat('out-of-place', 'scene', 'medium', 'Item Out of Place',
    'Something was out of place: {option}.',
    ['Furniture', 'Electronics', 'Tableware', 'Clothing', 'Nothing at All']),
  cat('odor', 'scene', 'sharp', 'Odor at Scene',
    'A faint odor lingered at the scene: {option}.',
    ['Something Chemical', 'Smoke', 'Alcohol', 'Perfume', 'No Odor at All']),
  cat('moisture', 'scene', 'medium', 'Scene Moisture',
    'The immediate area was {option}.',
    ['Dry', 'Damp', 'Soaked']),

  // ---- Group C: Victim Profile (wave 2) ----------------------------------
  cat('activity', 'victim', 'medium', "Victim's Activity",
    'Shortly before death, the victim had been {option}.',
    ['Working', 'Eating or Drinking', 'Bathing', 'Exercising', 'Entertaining a Guest', 'Resting']),
  cat('attire', 'victim', 'broad', 'Attire',
    'The victim was dressed in {option}.',
    ['Nightwear', 'Formal Clothes', 'Casual Clothes', 'a Work Uniform']),
  cat('last-meal', 'victim', 'medium', 'Last Meal',
    'Stomach analysis suggests {option}.',
    ['a Full Meal', 'a Light Snack', 'Only Drinks', 'an Empty Stomach']),
  cat('build', 'victim', 'broad', "Victim's Build",
    'The victim was of {option} build.',
    ['Frail', 'Average', 'Strong']),
  cat('habits', 'victim', 'medium', "Victim's Habits",
    'Records describe the victim as {option}.',
    ['a Smoker', 'a Drinker', 'on Regular Medication', 'Health-Conscious']),
  cat('personal-effects', 'victim', 'medium', 'Personal Effects',
    "The victim's personal effects were {option}.",
    ['Intact', 'Partially Missing', 'Stripped Entirely']),
  cat('hands', 'victim', 'medium', "Victim's Hands",
    "The victim's hands were {option}.",
    ['Clean', 'Bruised', 'Cut', 'Clutching Something']),
  cat('defensive-wounds', 'victim', 'medium', 'Defensive Wounds',
    'Defensive wounds are {option}.',
    ['Absent', 'Light', 'Heavy']),

  // ---- Group D: Physical Evidence (wave 3) ---------------------------------
  cat('evidence-quality', 'evidence', 'broad', 'Evidence Quality',
    'Recovered evidence is {option}.',
    ['Degraded', 'Partial', 'Pristine']),
  cat('trace-on-body', 'evidence', 'sharp', 'Trace on Body',
    'Trace analysis of the body recovered {option}.',
    ['Fibers', 'a Powder Residue', 'a Liquid Residue', 'a Strand of Hair', 'Nothing of Note']),
  cat('trace-at-scene', 'evidence', 'broad', 'Trace at Scene',
    'The scene yielded {option}.',
    ['Footprints', 'Fingerprints', 'Smudges', 'Surfaces Wiped Clean']),
  cat('tool-marks', 'evidence', 'sharp', 'Tool Marks',
    'Marks on the victim suggest {option}.',
    ['a Cutting Implement', 'a Crushing Force', 'a Puncturing Object', 'Some Form of Binding', 'No Tool at All']),
  cat('foreign-object', 'evidence', 'medium', 'Foreign Object',
    'A foreign object was {option}.',
    ['Found on the Body', 'Found Near the Body', 'Carefully Concealed', 'Not Found']),
  cat('fabric', 'evidence', 'sharp', 'Fabric Evidence',
    'Fabric analysis identified {option}.',
    ['Natural Fibers', 'Synthetic Fibers', 'Traces of Leather', 'No Fabric Evidence']),
  cat('debris', 'evidence', 'sharp', 'Shattered Material',
    'Regarding shattered material, the team recovered {option}.',
    ['Glass Fragments', 'Ceramic Fragments', 'Plastic Fragments', 'Nothing']),
  cat('burns', 'evidence', 'sharp', 'Burn Marks',
    'The body shows {option}.',
    ['Chemical Burns', 'Thermal Burns', 'Electrical Burns', 'No Burn Marks']),

  // ---- Group E: Laboratory (wave 3) -------------------------------------------
  cat('toxicology', 'lab', 'sharp', 'Toxicology',
    'Toxicological screening returned {option}.',
    ['a Clean Result', 'Elevated Sedatives', 'a Known Poison', 'High Alcohol Levels', 'a Mix of Substances']),
  cat('substance-speed', 'lab', 'sharp', 'Substance Speed',
    'The substance involved appears to be {option}.',
    ['Fast-Acting', 'Slow-Acting', 'Cumulative Over Time', 'Entirely Absent']),
  cat('delivery-route', 'lab', 'sharp', 'Delivery Route',
    'The lab believes any substance was {option}.',
    ['Ingested', 'Injected', 'Inhaled', 'Absorbed Through the Skin', 'Not Involved']),
  cat('blood', 'lab', 'medium', 'Blood Analysis',
    'Blood analysis came back {option}.',
    ['Normal', 'Thinned', 'Oxygen-Deprived', 'Contaminated']),
  cat('stomach', 'lab', 'sharp', 'Stomach Contents',
    'The stomach contained {option}.',
    ['Undigested Pills', 'an Unusual Residue', 'Nothing Unusual', 'Nothing at All']),
  cat('skin', 'lab', 'sharp', 'Skin Findings',
    'Dermal examination found {option}.',
    ['a Puncture Mark', 'a Rash', 'Discoloration', 'Pressure Marks', 'Nothing Remarkable']),
  cat('internal', 'lab', 'sharp', 'Internal Findings',
    'Internally, the examiner found {option}.',
    ['an Obstructed Airway', 'Organ Damage', 'Internal Bleeding', 'No Internal Findings']),
  cat('time-precision', 'lab', 'broad', 'Time Precision',
    'The estimated time of death is {option}.',
    ['Exact', 'Approximate', 'Disputed']),

  // ---- Group F: Behavioral Profile (wave 3) ---------------------------------------
  cat('premeditation', 'profile', 'medium', 'Premeditation',
    'The crime appears {option}.',
    ['Carefully Planned', 'Improvised', 'Opportunistic']),
  cat('strength', 'profile', 'medium', 'Strength Required',
    'The act would have required {option} physical strength.',
    ['Minimal', 'Moderate', 'Considerable']),
  cat('skill', 'profile', 'medium', 'Skill Required',
    'The method suggests {option}.',
    ['No Particular Skill', 'Some Expertise', 'Professional Knowledge']),
  cat('demeanor', 'profile', 'broad', "Killer's Demeanor",
    'Profilers describe the killer as {option}.',
    ['Calm and Methodical', 'Rushed', 'Panicked']),
  cat('relation', 'profile', 'broad', 'Relation to Victim',
    'The killer likely {option}.',
    ['Knew the Victim Well', 'Was an Acquaintance', 'Was a Stranger']),
  cat('motive', 'profile', 'broad', 'Motive Impression',
    'The motive reads as {option}.',
    ['Personal', 'Financial', 'an Act of Concealment', 'Unclear']),
  cat('duration', 'profile', 'medium', 'Duration of the Act',
    'The act itself lasted {option}.',
    ['Mere Seconds', 'Several Minutes', 'an Extended Period']),
  cat('exit', 'profile', 'broad', "Killer's Exit",
    "The killer's departure appears {option}.",
    ['Hurried', 'Careful', 'Staged to Look Natural']),
];

export const CLUE_CATEGORY_BY_ID = new Map(CLUE_CATEGORIES.map((c) => [c.id, c]));

/** The four categories present in every round. */
export const CORE_CATEGORY_IDS = ['cause-of-death', 'time-of-death', 'victim-condition', 'location'];

/** Wave titles for the generated crime report. */
export const WAVE_TITLES = {
  1: "CORONER'S PRELIMINARY REPORT",
  2: 'SCENE REPORT',
  3: 'LABORATORY & PROFILE REPORT',
};

/**
 * Draw this round's 8 active categories: the 4 cores plus 1 extra wave-2
 * category and 3 extra wave-3 categories — at most one of the drawn
 * categories may be "sharp", so the scientist can aim but never snipe.
 */
export function drawActiveCategories(shuffleFn) {
  const core = CORE_CATEGORY_IDS.map((id) => CLUE_CATEGORY_BY_ID.get(id));
  const pool = CLUE_CATEGORIES.filter((c) => !CORE_CATEGORY_IDS.includes(c.id));
  const wave2 = shuffleFn(pool.filter((c) => c.wave === 2));
  const wave3 = shuffleFn(pool.filter((c) => c.wave === 3));

  const drawn = [wave2.find((c) => c.tier !== 'sharp')];
  let sharpUsed = 0;
  for (const c of wave3) {
    if (drawn.length >= 4) break;
    if (c.tier === 'sharp') {
      if (sharpUsed) continue;
      sharpUsed++;
    }
    drawn.push(c);
  }
  return [...core, ...drawn];
}

/** Build the report text for one wave from the scientist's selections. */
export function buildReport(wave, activeCategories, selections) {
  const sentences = activeCategories
    .filter((c) => c.wave === wave && selections[c.id])
    .map((c) => {
      const opt = c.options.find((o) => o.id === selections[c.id]);
      return c.template.replace('{option}', opt.label.toLowerCase());
    });
  return { wave, title: WAVE_TITLES[wave], text: sentences.join(' ') };
}
