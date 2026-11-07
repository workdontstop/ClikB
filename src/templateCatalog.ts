export const TEMPLATE_CATEGORIES = [
  'Library',
  'All',
  'Interactive Games',
  'Shorts & Viral',
  'Cinema & Lore',
  'Documentaries & History',
  'Coaching & Roleplay',
  'Character & Remix Rules',
  'Sci-Fi & Cyberpunk',
  'Fantasy & Myth',
  'Anime & Action',
  'Thriller & Mystery',
  'Comedy & Memes',
  'Music & Performance',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const ASSIGNABLE_TEMPLATE_CATEGORIES: TemplateCategory[] = TEMPLATE_CATEGORIES.filter(
  (c): c is TemplateCategory => c !== 'Library' && c !== 'All'
);

export interface PackedTemplateMeta {
  /** Art style name */
  s?: string;
  /** Category name */
  c?: string;
  /** 1 if saved in user Library, 0 if catalog template */
  l?: number;
  /** Optional preset key so generated images link back to catalog templates */
  k?: string;
}

/**
 * Packs artStyle + category + inLibrary + presetKey into the existing `artstyle` varchar(255) column
 * without altering the `templates4prompt` database table schema.
 */
export function packTemplateMeta(meta: {
  artStyle?: string;
  category?: string;
  inLibrary?: boolean;
  presetKey?: string;
}): string {
  const cleanStyle = String(meta.artStyle || '').trim().slice(0, 80);
  const cleanCat = String(meta.category || '').trim().slice(0, 48);
  const cleanKey = String(meta.presetKey || '').trim().slice(0, 48);
  const inLib = meta.inLibrary === true ? 1 : 0;

  const payload: PackedTemplateMeta = {};
  if (cleanStyle) payload.s = cleanStyle;
  if (cleanCat) payload.c = cleanCat;
  payload.l = inLib;
  if (cleanKey) payload.k = cleanKey;

  const serialized = JSON.stringify(payload);
  if (serialized.length <= 250) {
    return serialized;
  }
  return JSON.stringify({
    s: cleanStyle.slice(0, 45),
    c: cleanCat.slice(0, 35),
    l: inLib,
  });
}

/**
 * Unpacks the `artstyle` column from `templates4prompt`.
 * Backwards-compatible with plain string artstyle values already in the database.
 */
export function unpackTemplateMeta(
  rawArtStyle: unknown,
  title = '',
  prompt = ''
): {
  artStyle: string;
  category: TemplateCategory;
  inLibrary: boolean;
  presetKey?: string;
} {
  const raw = String(rawArtStyle ?? '').trim();
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw) as PackedTemplateMeta;
      const artStyle = typeof parsed.s === 'string' ? parsed.s.trim() : '';
      const rawCat = typeof parsed.c === 'string' ? parsed.c.trim() : '';
      const validCat = ASSIGNABLE_TEMPLATE_CATEGORIES.find(
        (c) => c.toLowerCase() === rawCat.toLowerCase()
      );
      return {
        artStyle,
        category: validCat || inferTemplateCategory(title, prompt, artStyle),
        inLibrary: parsed.l === 1,
        presetKey: typeof parsed.k === 'string' && parsed.k.trim() ? parsed.k.trim() : undefined,
      };
    } catch {
      // Fall through to legacy plain string handling
    }
  }

  const cleanArtStyle = raw;
  return {
    artStyle: cleanArtStyle,
    category: inferTemplateCategory(title, prompt, cleanArtStyle),
    inLibrary: false,
  };
}

/**
 * Fast deterministic category inference used for legacy DB rows and as fallback
 * if the mini-model categorization call is offline.
 */
export function inferTemplateCategory(
  title: string,
  prompt: string,
  artStyle = ''
): TemplateCategory {
  const t = String(title || '').toLowerCase();
  const p = String(prompt || '').toLowerCase();
  const s = String(artStyle || '').toLowerCase();
  const combined = `${t} ${p} ${s}`;

  if (
    t.includes('ip safe') ||
    t.includes('remix') ||
    combined.includes('from my input image') ||
    combined.includes('character remix') ||
    combined.includes('agent instructions for character') ||
    combined.includes('prime meat') ||
    combined.includes('continuity rule')
  ) {
    return 'Character & Remix Rules';
  }

  if (
    t.includes('personal trainer') ||
    t.includes('workout') ||
    t.includes('coach') ||
    t.includes('masterclass') ||
    combined.includes('follow-along') ||
    combined.includes('target_body_part') ||
    combined.includes('roleplay') ||
    combined.includes('pretend you are')
  ) {
    return 'Coaching & Roleplay';
  }

  if (
    t.includes('space ranger') ||
    t.includes('racing game') ||
    t.includes('skateboard') ||
    t.includes('basketball shot') ||
    t.includes('solar system') ||
    t.includes('duck hunt') ||
    t.includes('rock climbing') ||
    t.includes('penalty kick') ||
    t.includes('battle cry') ||
    t.includes('neon crossfire') ||
    t.includes('decision') ||
    combined.includes('3rd-person video game') ||
    combined.includes('3rd person video game') ||
    combined.includes('third-person') ||
    combined.includes('playable character') ||
    combined.includes('interactive visual model') ||
    combined.includes('interactive experience') ||
    combined.includes('branches to node') ||
    combined.includes('fail branch') ||
    combined.includes('success branch')
  ) {
    return 'Interactive Games';
  }

  if (
    t.includes('wildlife documentary') ||
    t.includes('historical story') ||
    t.includes('microscope') ||
    t.includes('climate') ||
    t.includes('predator') ||
    t.includes('vision') ||
    combined.includes('documentary') ||
    combined.includes('real documented event') ||
    combined.includes('world history') ||
    combined.includes('microscope') ||
    combined.includes('animated model of earth') ||
    combined.includes('educational')
  ) {
    return 'Documentaries & History';
  }

  if (
    t.includes('aegon') ||
    t.includes('haven') ||
    t.includes('divinity') ||
    t.includes('clikb heroes') ||
    t.includes('chronicle') ||
    combined.includes('targaryen') ||
    combined.includes('westeros') ||
    combined.includes('stage a') ||
    combined.includes('beat 1:') ||
    combined.includes('cinematic story')
  ) {
    return 'Cinema & Lore';
  }

  if (
    combined.includes('music video') ||
    combined.includes('singing throughout') ||
    combined.includes('choreography') ||
    combined.includes('concert stage') ||
    combined.includes('rap group') ||
    combined.includes('festival stage')
  ) {
    return 'Music & Performance';
  }

  if (
    s.includes('anime') ||
    combined.includes('anime') ||
    combined.includes('shonen') ||
    combined.includes('samurai') ||
    combined.includes('katana') ||
    combined.includes('mecha')
  ) {
    return 'Anime & Action';
  }

  if (
    combined.includes('cyberpunk') ||
    combined.includes('2099') ||
    combined.includes('hover technology') ||
    combined.includes('orbital') ||
    combined.includes('starship') ||
    combined.includes('terraforming')
  ) {
    return 'Sci-Fi & Cyberpunk';
  }

  if (
    combined.includes('dragon') ||
    combined.includes('deities') ||
    combined.includes('mythos') ||
    combined.includes('griffin') ||
    combined.includes('alchemy') ||
    combined.includes('fantasy')
  ) {
    return 'Fantasy & Myth';
  }

  if (
    combined.includes('detective') ||
    combined.includes('noir') ||
    combined.includes('bounty hunter') ||
    combined.includes('heist') ||
    combined.includes('mystery') ||
    combined.includes('thriller')
  ) {
    return 'Thriller & Mystery';
  }

  if (
    combined.includes('parody') ||
    combined.includes('funny') ||
    combined.includes('comedy') ||
    combined.includes('satire') ||
    combined.includes('deadpan')
  ) {
    return 'Comedy & Memes';
  }

  return 'Shorts & Viral';
}

import type { Template } from './PromptConstructorMock';

export interface CatalogTemplateSeed {
  presetKey: string;
  name: string;
  category: TemplateCategory;
  artStyle: string;
  prompt: string;
}

/**
 * 100% Original Derivative Templates inspired by ClikB's multi-scene, camera-locked,
 * branching, and conversational storytelling architecture (zero verbatim copies).
 */
export const RAW_DERIVATIVE_TEMPLATE_SEEDS: CatalogTemplateSeed[] = [
  // ───────────────────────── INTERACTIVE GAMES ─────────────────────────
  {
    presetKey: 'deriv_games_glacier_rescue_chopper',
    name: 'Arctic Helicopter Rescue (Winch vs Landing Choice)',
    category: 'Interactive Games',
    artStyle: 'PhotoRealistic',
    prompt: `Create a 6-scene third-person interactive search-and-rescue helicopter game set during an Arctic blizzard, keeping the camera behind the red rescue chopper:
Scene 1: The rescue helicopter lifts off from an icebreaker ship deck into howling snow with altitude and fuel HUD gauges visible at the top.
Scene 2: Flying through a narrow glacial canyon, the thermal scanner locks onto stranded mountaineers waving a red flare on a cracking ice shelf below.
Scene 3 (Decision Point): Hovering above the unstable ice shelf—display two clear in-world tactical options: "Deploy Rescue Winch" on the left and "Touch Down on Ice" on the right.
Scene 4 (Fail Branch - Touch Down): The heavy helicopter skids touch the thin ice, fracturing the shelf and forcing an emergency abort into the storm.
Scene 5 (Success Branch - Rescue Winch): The cable lowers steadily while the pilot holds position against crosswinds, hoisting the mountaineers safely into the cabin.
Scene 6 (Victory Ending): Cockpit POV touching back down on the lit icebreaker helipad as the crew celebrates.`,
  },
  {
    presetKey: 'deriv_games_tokyo_drift_tunnel_split',
    name: 'Midnight Touge Drift: Tunnel Hairpin Split',
    category: 'Interactive Games',
    artStyle: 'PhotoRealistic',
    prompt: `Build a 3rd-person street racing video game viewed strictly from behind a custom widebody JDM coupe descending a wet mountain pass at midnight with a clean speedometer and nitrous HUD:
Scene 1: The car revs at the mountain summit starting gate beside a rival racer under glowing lanterns.
Scene 2: Both cars tandem-drift around a cliffside hairpin as tire smoke and sparks fly off the guardrail.
Scene 3 (Decision Point): Approaching a divided mountain tunnel entrance—the left lane is dry asphalt but narrow, while the right lane has an oil spill warning flare.
Scene 4 (Fail Branch): Taking the right lane, the rear tires hit the slick oil patch and spin out into the padded tunnel wall.
Scene 5 (Success Branch): Threading the needle through the narrow dry left lane at full boost, overtaking the rival at the tunnel exit and crossing the finish line first.`,
  },
  {
    presetKey: 'deriv_games_medieval_siege_catapult',
    name: 'Castle Siege Commander: Breach the Gatehouse',
    category: 'Interactive Games',
    artStyle: 'PhotoRealistic',
    prompt: `Create a 3rd-person tactical siege game viewed from behind an armored siege engineer commanding a heavy trebuchet outside a rain-lashed stone fortress:
Scene 1: The engineer stands beside the loaded trebuchet aiming at the fortress—present two target icons: the "Iron Portcullis Gate" on the left and the "Watchtower Powder Store" on the right.
Scene 2 (Gate Branch): The boulder slams into the reinforced iron gate and bounces off into the moat while archers return fire.
Scene 3 (Powder Store Victory Branch): A flaming pitch projectile arcs into the upper watchtower powder store, triggering a chain reaction that collapses the outer wall so the cavalry can charge in.`,
  },
  {
    presetKey: 'deriv_games_hypercar_atelier_configurator',
    name: 'Interactive Carbon Hypercar Studio Tour',
    category: 'Interactive Games',
    artStyle: 'PhotoRealistic',
    prompt: `Design an interactive 7-scene luxury hypercar inspection experience inside a dark obsidian-and-warm-oak architectural vault:
Scene 1: Full side profile of a matte-silver gullwing hypercar resting on a turntable with a glowing "Ignite Telemetry" prompt.
Scene 2: The V12 hybrid engine awakens, active rear aero fins deploy, and laser headlights sweep the obsidian floor.
Scene 3: Front low-angle hero view showcasing the carbon splitter and aerodynamic channels.
Scene 4: Rear three-quarter view highlighting the exposed titanium exhaust and glowing diffuser.
Scene 5: Gullwing doors rise smoothly to reveal the saddle-leather and carbon-tub cabin.
Scene 6: Close-up cockpit view from the driver's bucket seat with the bespoke mechanical chronograph gauge cluster.
Scene 7: First-person launch POV as the vault doors part onto a coastal test track at sunrise.`,
  },
  {
    presetKey: 'deriv_games_sub_zero_vault_heist',
    name: 'Orbital Vault Infiltration (Laser Grid Choice)',
    category: 'Interactive Games',
    artStyle: 'SciFi',
    prompt: `Create a 6-scene branching stealth game viewed from behind an agile infiltrator in a zero-gravity orbital bank vault:
Scene 1: Floating at the airlock threshold looking down a cylindrical corridor laced with sweeping red security lasers.
Scene 2 (Decision Point): Two tools appear on the wrist holo-HUD—an "EMP Grapple Tether" on the left and a "Holographic Decoy Cloak" on the right.
Scene 3 (Fail Branch): Theホロ decoy flickers when passing a thermal sensor, triggering red blast doors that seal the vault.
Scene 4 (Success Branch): The EMP grapple disables the ceiling emitter node and pulls the infiltrator silently to the central data core.
Scene 5: Extracting the glowing quantum drive from the core pedestal.
Scene 6: Jettisoning out the escape pod hatch toward the waiting stealth shuttle with Earth glowing below.`,
  },
  {
    presetKey: 'deriv_games_wild_west_duel_high_noon',
    name: 'High Noon Showdown: Draw vs Ricochet Shot',
    category: 'Interactive Games',
    artStyle: 'PhotoRealistic',
    prompt: `A 3rd-person Western video game duel at high noon on a dusty frontier main street, viewed from just behind the sheriff's right shoulder facing an outlaw by the saloon:
Scene 1: The town clock strikes twelve as tumbleweeds roll past—display two interactive aim targets: "Direct Quick-Draw" on the left and "Shoot Water Tower Support" on the right.
Scene 2 (Direct Draw Branch): Both draw at the exact same split-second, trading grazing shots that knock the sheriff's hat into the dust.
Scene 3 (Water Tower Victory Branch): A single deadeye shot snaps the rusted iron chain on the water tower above the outlaw, dumping a torrent of water that washes him off his boots without a scratch.`,
  },

  // ───────────────────────── SHORTS & VIRAL ─────────────────────────
  {
    presetKey: 'deriv_shorts_browsers_as_gladiators',
    name: 'Tech Apps Reimagined as Colosseum Gladiators',
    category: 'Shorts & Viral',
    artStyle: 'PhotoRealistic',
    prompt: `Show 5 scenes inside a roaring Roman Colosseum where everyday software platforms step into the sand as armored gladiators styled after their signature colors and personalities:
Scene 1: A blazing red-and-white video-streaming gladiator enters spinning dual trident torches as the crowd chants.
Scene 2: A sleek green-and-black music-streaming gladiator strides out wearing sonic-wave gauntlets that pulse with bass.
Scene 3: A colossal blue cloud-computing centurion marches in carrying an impenetrable tower shield made of glowing server blades.
Scene 4: All three clash in the center of the arena in a shower of sparks and sand.
Scene 5: The gates rattle open as an ancient retro dial-up bronze titan slowly lumbers in, still buffering at 99%.`,
  },
  {
    presetKey: 'deriv_shorts_planets_at_fashion_week',
    name: 'Solar System Planets Walking the Paris Runway',
    category: 'Shorts & Viral',
    artStyle: 'PhotoRealistic',
    prompt: `Give me 6 scenes where the planets of our Solar System are personified as avant-garde haute couture supermodels walking down a mirror-floored Paris Fashion Week runway:
Scene 1: Mercury sprints down the catwalk in a liquid-chrome speedsuit shimmering with solar flares.
Scene 2: Venus glides through golden sulfuric mist in a dramatic volcanic-silk gown.
Scene 3: Earth walks out in a living bioluminescent dress woven from ocean waves, clouds, and rainforest canopy.
Scene 4: Mars strides forward in sculpted rust-red iron armor with twin moon shoulder orbs.
Scene 5: Jupiter commands the hall in a towering swirling-storm cape with the Great Red Spot blazing on the chest.
Scene 6: Saturn closes the show with levitating crystalline rings rotating effortlessly around her waist as cameras flash.`,
  },
  {
    presetKey: 'deriv_shorts_sucked_into_painting',
    name: 'Museum Visitor Pulled Inside 4 Famous Canvases',
    category: 'Shorts & Viral',
    artStyle: 'PhotoRealistic',
    prompt: `A curious art student in a quiet gallery leans too close to an ornate gold frame, touches the wet-looking oil paint, and gets pulled physically inside a chain of living paintings while keeping her exact face and yellow raincoat in every world:
Scene 1: Her fingers ripple into thick impasto brushstrokes as the canvas pulls her off the gallery floor.
Scene 2: She tumbles onto a stormy wooden fishing boat under a towering cobalt-blue woodblock ocean wave.
Scene 3: She sprints across a swirling starry night village street as the cypress trees and glowing yellow stars spin overhead.
Scene 4: She climbs out through a surreal melting clock desert back onto the polished museum floor while the security guard stares in disbelief.`,
  },
  {
    presetKey: 'deriv_shorts_chess_pieces_real_battlefield',
    name: 'Wooden Chess Pieces Turn Into Living Titans',
    category: 'Shorts & Viral',
    artStyle: 'PhotoRealistic',
    prompt: `Start in a quiet park where two old masters move a carved wooden Knight on a chessboard—and with every move, cut to the exact same square transformed into a colossal obsidian-and-marble battlefield:
Scene 1: A player's hand lifts the white Knight; on the giant marble board, a 40-foot living alabaster warhorse leaps over a line of shield-bearing Pawns.
Scene 2: The black Bishop slides diagonally across the tiles, unleashing a beam of dark amethyst energy that shatters a white Rook tower into marble rubble.
Scene 3: The white Queen strides across the board in radiant silver armor, cornering the black King in dramatic checkmate.`,
  },
  {
    presetKey: 'deriv_shorts_ancient_emperors_modern_jobs',
    name: 'Ancient Rulers Working Stressful Modern Day Jobs',
    category: 'Shorts & Viral',
    artStyle: 'PhotoRealistic',
    prompt: `Show 5 deadpan photorealistic scenes where legendary historical rulers are dressed in their full royal regalia while working mundane modern customer-service jobs:
Scene 1: Julius Caesar in a crimson toga and gold laurel wreath working an espresso machine at a busy morning coffee shop, glaring at a customer who ordered oat foam.
Scene 2: Cleopatra in beaded gold headdress scanning groceries at a supermarket self-checkout lane while her pet asp rests on the register.
Scene 3: Genghis Khan in fur-lined lamellar armor working as a suburban ride-share driver in a compact hybrid sedan, checking his GPS in traffic.
Scene 4: Napoleon Bonaparte in his bicorne hat managing an airport baggage-claim desk during a flight delay.
Scene 5: King Leonidas in bronze Spartan helmet and red cape working as a CrossFit receptionist checking membership badges.`,
  },
  {
    presetKey: 'deriv_shorts_miniature_chefs_desk',
    name: 'Tiny Construction Crew Building a Gourmet Burger',
    category: 'Shorts & Viral',
    artStyle: 'PhotoRealistic',
    prompt: `Film an ultra-macro photorealistic sequence on a kitchen butcher block where a crew of two-inch-tall engineers in high-vis vests and hardhats use heavy machinery to assemble a towering gourmet cheeseburger:
Scene 1: Miniature cranes lower a toasted brioche bun base onto the wooden cutting board while surveyors check alignment with laser levels.
Scene 2: A team with blowtorches melts a blanket of aged cheddar over the sizzling sear of the patty.
Scene 3: Forklifts slide crisp lettuce and heirloom tomato slices into place before the top bun is craned down to cheers from the tiny crew.`,
  },

  // ───────────────────────── CINEMA & LORE ─────────────────────────
  {
    presetKey: 'deriv_cinema_sun_eaters_armada',
    name: 'Chronicle of the Solar Sailors: The Dying Star',
    category: 'Cinema & Lore',
    artStyle: 'SciFi',
    prompt: `Tell an epic 7-scene cinematic chronicle narrated by Captain Vance, commander of the last solar-sail ark ship, as humanity harvests a dying red giant to ignite a new homeworld:
Scene 1: Inside the brass-and-glass astronomical rotunda of the ark ship, Vance traces a holographic star map showing Earth frozen in darkness.
Scene 2: The armada unfurls thousand-kilometer golden photon sails against the roaring corona of the red giant star.
Scene 3: Solar magnetic storms tear through the third fleet wing while engineers in tethered exosuits repair the primary collector ring in deep space.
Scene 4: Vance and his chief astrophysicist Elena debate whether to risk diving closer into the chromosphere to capture the final ignition core.
Scene 5: The flagship plunges through a towering solar prominence, capturing a miniature star-seed inside a magnetic containment sphere.
Scene 6: The ark jumps through a fold-gate and releases the star-seed into the orbit of a frozen ocean moon, thawing the ice into blue seas.
Scene 7: Decades later, an older Vance stands on a green cliffside overlooking the first coastal city under the warm light of the newborn sun.`,
  },
  {
    presetKey: 'deriv_cinema_clockwork_venice_uprising',
    name: 'The Glass Guild of Sunken Venice (1889)',
    category: 'Cinema & Lore',
    artStyle: 'PhotoRealistic',
    prompt: `Create a 6-scene alternate-history drama set in 1889 Venice after rising seas forced the city to build towering brass seawalls and steam-powered gondola canals:
Scene 1: From the first-person perspective of a master glassblower in Murano handing a glowing clockwork heart to two young courier siblings, Sofia and Matteo.
Scene 2: The siblings race across the fog-shrouded Rialto viaduct as mechanical hound patrols pursue them across the wet cobblestones.
Scene 3: They dive into a submerged gondola submarine and navigate through the flooded ruins of St. Mark's Basilica beneath the lagoon.
Scene 4: Inside the Doge's subterranean engine room, they discover the city's floodgates are being deliberately held shut to ration steam power.
Scene 5: Sofia installs the glass clockwork heart into the central pressure turbine while Matteo holds off the Grand Inquisitor's guards on the catwalk.
Scene 6: The brass seawalls recalibrate and part at sunrise, restoring the lagoon tides as the bells of Venice ring out across the water.`,
  },
  {
    presetKey: 'deriv_cinema_immortal_cartographer',
    name: 'Seven Centuries of the Immortal Cartographer',
    category: 'Cinema & Lore',
    artStyle: 'PhotoRealistic',
    prompt: `Follow the same woman—an ageless cartographer named Lyra with a distinct silver compass locket and amber eyes—across 6 historical eras as she maps the changing world while keeping her face and locket identical in every frame:
Scene 1 (1320 Mali Empire): Lyra sketching trade routes by lantern light beside the mud-brick towers of Timbuktu as gold caravans arrive.
Scene 2 (1505 Florence): Comparing anatomical and aerial city sketches in a sunlit Renaissance workshop.
Scene 3 (1780 South Pacific): Standing on the bow of a wooden tall ship charting volcanic islands under the Southern Cross.
Scene 4 (1912 Antarctica): Bundled in wool and fur beside a dog sled, marking a compass bearing across the polar plateau.
Scene 5 (1969 Houston): Sitting quietly in the back row of Mission Control watching the lunar landing telemetry on glowing CRT monitors.
Scene 6 (2140 Orbital Ring): Looking down through a cupola window at Earth, finally closing her leather-bound atlas as she begins a new volume for Mars.`,
  },
  {
    presetKey: 'deriv_cinema_iron_dynasty_succession',
    name: 'The Obsidian Crown: War of the Three Rivers',
    category: 'Cinema & Lore',
    artStyle: 'PhotoRealistic',
    prompt: `Tell a sweeping 6-scene royal succession chronicle narrated by Empress Kaelen looking back on how she united the Three River Kingdoms without burning a single village:
Scene 1: Young Kaelen stands before the carved stone map of the Three Rivers while her advisors urge total war against the rebel dukes.
Scene 2: Instead of marching an army, she rides alone under a white banner into the mountain fortress of the Iron Duke during a blizzard.
Scene 3: In the Great Hall, she challenges the Duke's champion to a single trial of strategy—diverting the mountain dam to irrigate the starving lowland farms.
Scene 4: At the River Confluence, her fleet of lantern-lit grain barges arrives at the besieged Southern Capital, winning the loyalty of the river lords overnight.
Scene 5: The coronation at the Obsidian Citadel where the three rival banners are woven into a single tapestry.
Scene 6: An older Empress Kaelen watching her twin heirs study the same stone map as peace holds across the valley.`,
  },
  {
    presetKey: 'deriv_cinema_echo_station_first_contact',
    name: 'First Contact Beneath the Ice of Europa',
    category: 'Cinema & Lore',
    artStyle: 'SciFi',
    prompt: `Create a tense, awe-inspiring 6-scene cinematic story following a deep-ice drilling crew on Jupiter's moon Europa who break through 15 kilometers of ice into the pitch-black subsurface ocean—only to find an ancient bioluminescent acoustic civilization that communicates entirely through geometric ripples of light and harmonic whale-like frequencies.`,
  },

  // ───────────────────────── DOCUMENTARIES & HISTORY ─────────────────────────
  {
    presetKey: 'deriv_doc_leaf_to_chloroplast_zoom',
    name: 'Inside a Sunlit Leaf: 7-Step Zoom to Photosynthesis',
    category: 'Documentaries & History',
    artStyle: 'PhotoRealistic',
    prompt: `Zoom continuously into a single sunlit green oak leaf across 7 microscopic steps to show how nature turns photons into life:
1. Macro view of morning dew resting on the branching veins of a vibrant green leaf in the forest canopy.
2. Closer magnification revealing the honeycomb epidermis and tiny stomata pores breathing in carbon dioxide.
3. Inside the spongy mesophyll layer where columns of plant cells glow with emerald light.
4. Entering a single plant cell packed with lens-shaped chloroplasts streaming along the cytoplasm.
5. Inside a chloroplast showing stacked coin-like thylakoid towers bathed in golden light rays.
6. Molecular scale on the thylakoid membrane where chlorophyll complexes capture a photon and split water molecules into oxygen bubbles.
7. Atomic scale showing ATP synthase spinning like a microscopic turbine to power life on Earth.`,
  },
  {
    presetKey: 'deriv_doc_pangea_continental_drift',
    name: 'Suspended Globe: 250 Million Years of Pangea Breaking Apart',
    category: 'Documentaries & History',
    artStyle: 'PhotoRealistic',
    prompt: `Show an educational animated model of Earth suspended inside a clean white studio environment across 6 geological epochs from 250 million years ago to today.
In each scene, clearly visualize the supercontinent Pangea rifting apart, the Atlantic Ocean opening, the Indian plate crashing into Asia to push up the Himalayas, and place scale miniature creatures of each era—from Triassic archosaurs to Jurassic giants to early Ice Age mammals—standing along the shifting coastlines while explaining how plate tectonics reshaped global climate.`,
  },
  {
    presetKey: 'deriv_doc_deepest_ocean_zones_descent',
    name: 'Orbital to Abyss: The 5 Ocean Depth Zones Explained',
    category: 'Documentaries & History',
    artStyle: 'PhotoRealistic',
    prompt: `Take me on a vertical scientific descent from orbital view over the Pacific Ocean all the way down to Challenger Deep at 11,000 meters across 6 scenes:
Start with the sunlit epipelagic coral reefs and tuna schools, descend into the twilight mesopelagic zone where lanternfish migrate nightly, enter the midnight bathypelagic zone of giant squid and sperm whales, cross the abyssal plains of hydrothermal vents and tube worms, and reach the hadal trench floor where translucent snailfish survive crushing pressure.`,
  },
  {
    presetKey: 'deriv_doc_how_sound_waves_work_pov',
    name: 'Visualizing Invisible Waves: Wi-Fi, Sound & Gravity',
    category: 'Documentaries & History',
    artStyle: 'PhotoRealistic',
    prompt: `What would the modern world look like if human eyes could see invisible physics spectra? Across 6 pure POV scenes—without showing any camera rig—walk through a bustling city street while shifting our visual spectrum:
Scene 1: Acoustic pressure waves rippling like golden glass rings from a street violinist's strings.
Scene 2: Millimeter-wave 5G and Wi-Fi beams crisscrossing between apartment windows and smartphones in neon cyan threads.
Scene 3: Thermal convection plumes rising off warm subway grates and coffee cups in crimson and violet.
Scene 4: Earth's magnetic field lines curving high above the skyline deflecting solar wind particles.
Scene 5: Aerodynamic vortices swirling in emerald ribbons off the wingtips of a landing airliner.
Scene 6: All invisible forces combined into a breathtaking symphony of living physics.`,
  },
  {
    presetKey: 'deriv_doc_skyscraper_engineering_stages',
    name: 'How a Mile-High Skyscraper Is Engineered (7 Stages)',
    category: 'Documentaries & History',
    artStyle: 'PhotoRealistic',
    prompt: `Keep the camera locked on the exact same downtown plot of land across 7 scenes to explain how a supertall skyscraper is engineered from bedrock to spire:
1. Deep foundation excavation with reinforced concrete caissons drilled 200 feet into solid bedrock.
2. The central slip-formed concrete core rising with climbing tower cranes attached.
3. Outrigger steel trusses and perimeter megacolumns locking onto the core.
4. Modular unitized curtain-wall glass panels being hoisted and sealed floor by floor.
5. Installing the 1,000-ton golden tuned mass damper pendulum near the crown to counter hurricane winds.
6. Structural load testing and facade LED illumination commissioning at dusk.
7. The completed supertall tower gleaming above the clouds with sky-gardens and observation decks open.`,
  },
  {
    presetKey: 'deriv_doc_silk_road_caravan_journey',
    name: 'The Ancient Silk Road: Chang’an to Venice in 6 Stops',
    category: 'Documentaries & History',
    artStyle: 'PhotoRealistic',
    prompt: `Follow a single bolt of royal cobalt silk and a brass astrolabe traded hand-to-hand along the historic Silk Road across 6 documented historical cities—from the Tang Dynasty markets of Chang'an, through the oasis caves of Dunhuang, across the Pamir Mountains to Samarkand's turquoise domes, into the scholarly House of Wisdom in Baghdad, through Constantinople's Grand Bazaar, and finally onto a merchant galley in Renaissance Venice.`,
  },

  // ───────────────────────── COACHING & ROLEPLAY ─────────────────────────
  {
    presetKey: 'deriv_coach_da_vinci_workshop_mentor',
    name: 'Leonardo da Vinci Teaches 6 Secrets of Invention',
    category: 'Coaching & Roleplay',
    artStyle: 'PhotoRealistic',
    prompt: `Pretend you are Leonardo da Vinci standing inside your sun-drenched 15th-century Florentine studio filled with wooden flying machines, anatomical sketches, and optical lenses.
Keep Leonardo as the sole speaker on screen, and across 6 scenes place a working wooden prototype on the workbench in front of him—the ornithopter wing mechanism, the self-supporting bridge, the camera obscura, the helical aerial screw, hydraulic water locks, and sfumato light optics—demonstrating each principle directly to the viewer.`,
  },
  {
    presetKey: 'deriv_coach_olympic_sprint_biomechanics',
    name: 'Track & Field Coach: 5 Phases of the 100m Sprint',
    category: 'Coaching & Roleplay',
    artStyle: 'PhotoRealistic',
    prompt: `Put my character on a floodlit Olympic track coached by a world-record sprint biomechanics specialist across 5 focused training scenes:
Scene 1 (Block Setup & Isometric Load): Setting exact foot angles and hand placement in the starting blocks.
Scene 2 (The Drive Phase): Staying low at a 45-degree shin angle for the first 10 meters with explosive hip extension.
Scene 3 (Transition to Upright): Smoothly rising into full stride between 20 and 40 meters without tensing the shoulders.
Scene 4 (Max Velocity Mechanics): Front-side knee lift and dorsiflexed ankle strike at top speed.
Scene 5 (Speed Endurance & Dip): Maintaining form through the 90-meter mark and timing the torso lean at the tape.`,
  },
  {
    presetKey: 'deriv_coach_deep_sea_habitat_yoga',
    name: 'Abyssal Glass Dome Breathwork & Mobility Flow',
    category: 'Coaching & Roleplay',
    artStyle: 'PhotoRealistic',
    prompt: `Create a calming 6-scene follow-along mobility and breathwork session led by a serene movement coach inside a panoramic glass wellness dome on the ocean floor while bioluminescent manta rays and whales glide peacefully past the window behind her.
Show clear full-body form for box breathing, thoracic spine rotations, deep hip openers, and slow balance transitions.`,
  },
  {
    presetKey: 'deriv_coach_neapolitan_pizza_artisan',
    name: 'Naples Master Pizzaiolo: 72-Hour Dough Masterclass',
    category: 'Coaching & Roleplay',
    artStyle: 'PhotoRealistic',
    prompt: `Pretend you are a fourth-generation Neapolitan pizzaiolo standing in front of a glowing volcanic-stone wood-fired oven in Naples. Teach me step-by-step across 6 scenes how to balance hydration and fermentation for 72-hour dough, hand-stretch the cornicione without knocking out the air, crush San Marzano tomatoes by hand, tear fresh fior di latte, and bake at 900°F for 60 seconds for the perfect leopard-spotted crust.`,
  },
  {
    presetKey: 'deriv_coach_f1_race_engineer_telemetry',
    name: 'F1 Chief Race Engineer: Mastering the Wet Lap',
    category: 'Coaching & Roleplay',
    artStyle: 'PhotoRealistic',
    prompt: `Pretend you are my Formula 1 Chief Race Engineer speaking to me from the pit wall telemetry rig during a rain-soaked qualifying session at Spa-Francorchamps. Across 5 scenes alternating between your multi-screen telemetry desk and cockpit track overlays, coach me through brake-bias migration, finding grip off the rubbered-in dry line, managing battery deployment up Eau Rouge, and nailing the crossover to slick tires.`,
  },

  // ───────────────────────── CHARACTER & REMIX RULES ─────────────────────────
  {
    presetKey: 'deriv_remix_locked_reference_ensemble',
    name: 'Strict Reference Lock ("FROM MY INPUT IMAGE" Squad Rule)',
    category: 'Character & Remix Rules',
    artStyle: 'PhotoRealistic',
    prompt: `Identity Lock Rule: For every character appearing in any scene, state their name and core visual traits followed immediately by "FROM MY INPUT IMAGE" so their exact facial structure, skin tone, hair texture, and proportions stay 100% locked across the entire sequence:
Scene 1: Wide anamorphic establishing shot of the team stepping off an armored transport onto a rain-slicked tarmac at dusk.
Scene 2: Medium two-shot conversation inside the briefing hangar where their contrasting temperaments show through subtle facial expressions.
Scene 3: High-speed tracking shot as the squad sprints through a collapsing glass skybridge in synchronized motion.
Scene 4: Iconic low-angle hero frame standing shoulder-to-shoulder as sunrise breaks over the skyline.`,
  },
  {
    presetKey: 'deriv_remix_era_hopping_time_travelers',
    name: 'Same Duo Across 5 Historical Eras (Period Wardrobe Rule)',
    category: 'Character & Remix Rules',
    artStyle: 'PhotoRealistic',
    prompt: `Take the two lead characters from my input images and keep their exact faces, heights, and chemistry identical while adapting their wardrobe authentically to 5 distinct historical eras as they chase a rogue time-beacon:
Scene 1 (Ancient Alexandria, 48 BC): Draped in linen tunics carrying leather scroll cases past the Great Harbor lighthouse.
Scene 2 (Edo Period Kyoto, 1615): Wearing tailored indigo haori jackets walking beneath cherry blossoms by a lantern-lit canal.
Scene 3 (Victorian London, 1895): Dressed in tweed overcoats and top hats stepping out of a hansom cab in the gaslit fog.
Scene 4 (1960s Monte Carlo): In sharp vintage tuxedos and silk evening wear beside a classic silver roadster outside the casino.
Scene 5 (Orbital Ring, 2180): In sleek white zero-G flight suits looking back at Earth through a viewport.`,
  },
  {
    presetKey: 'deriv_remix_diner_booth_character_study',
    name: '4 Suspects in a Midnight Diner (Character Portrait Rule)',
    category: 'Character & Remix Rules',
    artStyle: 'PhotoRealistic',
    prompt: `Place 4 characters from my cast inside a neon-lit 1950s desert highway diner during a midnight thunderstorm across 4 intimate 85mm portrait scenes.
For each character, pair them with a specific order on the formica table (black coffee and a chessboard, a triple milkshake with headphones, an untouched pie with a locked briefcase, a stack of pancakes and a map) that reveals their secret role in the heist without a single word.`,
  },
  {
    presetKey: 'deriv_remix_parallel_timeline_split_screen',
    name: 'Sliding Doors: Parallel Timeline Split-Panel Rule',
    category: 'Character & Remix Rules',
    artStyle: 'PhotoRealistic',
    prompt: `Use clean two-panel side-by-side split frames across 5 scenes to follow the exact same protagonist ("FROM MY INPUT IMAGE") after a single missed subway train splits her life into two parallel timelines:
Left Panel Track: She catches the train, meets a film director in the carriage, and rises through indie cinema sets to an opening-night premiere.
Right Panel Track: She misses the train, walks through the rain into an astronomy bookshop, and joins an observatory expedition in the Atacama Desert—until both timelines converge at the same rooftop cafe 5 years later.`,
  },

  // ───────────────────────── SCI-FI & CYBERPUNK ─────────────────────────
  {
    presetKey: 'deriv_scifi_deep_space_tug_airlock_walk',
    name: 'Salvage Pilot: Airlock to Bridge (Continuous Ship Scale)',
    category: 'Sci-Fi & Cyberpunk',
    artStyle: 'SciFi',
    prompt: `Maintain strict human-scale interior ship architecture across 3 continuous third-person scenes:
Scene 1 (Airlock Decontamination): Third-person full-body view from behind a salvage pilot in a weathered orange pressure suit stepping out of the circular airlock into a narrow, utilitarianindustrial galley corridor with magnetic boots clanking on the deck grating.
Scene 2 (Engineering Spine): Walking forward down the same cramped corridor past humming coolant pipes and a small mess table toward the open bridge bulkhead ahead.
Scene 3 (The Salvage Bridge): Stepping onto the compact command deck and looking out the wrap-around reinforced glass canopy at a colossal derelict star-dreadnought drifting in a turquoise nebula.`,
  },
  {
    presetKey: 'deriv_scifi_saturn_ring_ice_miners',
    name: 'Ice Harvesters of Saturn’s A-Ring',
    category: 'Sci-Fi & Cyberpunk',
    artStyle: 'SciFi',
    prompt: `Follow a two-person crew—a veteran Grizzled Captain and a witty Android Navigator—aboard a rugged industrial ice-tug weaving between house-sized tumbling crystals of pure water ice inside Saturn's sunlit A-Ring, with Saturn's immense golden cloud bands filling the entire background sky across 5 cinematic scenes.`,
  },
  {
    presetKey: 'deriv_scifi_neon_night_market_bot_repair',
    name: '2099 Kowloon Alley: The Cybernetic Watchmaker',
    category: 'Sci-Fi & Cyberpunk',
    artStyle: 'SciFi',
    prompt: `Tell a 5-scene cyberpunk story inside a rain-drenched vertical night market where an elderly precision horologist repairs antique mechanical memories inside vintage androids—until a damaged courier android sits at his bench carrying a clockwork memory core that projects a holographic map of the city's forgotten underground sun.`,
  },
  {
    presetKey: 'deriv_scifi_solar_punk_floating_farms',
    name: '2120 Pacific Seastead: Autonomous Ocean Architecture',
    category: 'Sci-Fi & Cyberpunk',
    artStyle: 'PhotoRealistic',
    prompt: `Take me on a 6-scene architectural tour of a self-sustaining solar-punk ocean city built from interlocking hexagonal bio-concrete platforms in the South Pacific—showcasing underwater kelp forests and wave-energy turbines below, terraced hydroponic citrus groves in the center, and silent wind-sail catamarans gliding between glass research domes at golden hour.`,
  },

  // ───────────────────────── FANTASY & MYTH ─────────────────────────
  {
    presetKey: 'deriv_fantasy_cloud_leviathan_shepherd',
    name: 'A Day in the Life of a Sky-Whale Shepherd',
    category: 'Fantasy & Myth',
    artStyle: 'Fantasy',
    prompt: `Follow a solitary sky-shepherd named Kael who lives atop a wind-carved sandstone spire above the sea of clouds, tending a pod of colossal bioluminescent cloud-whales across 5 peaceful, awe-inspiring scenes:
Scene 1: Kael steps out of his cliffside lantern hut at dawn holding a resonant brass tuning staff as a 200-foot calf breaches gently through the pink cloud deck below.
Scene 2: He leaps onto his wooden wind-glider and soars alongside the pod as they graze on glowing golden pollen drifting over floating mountain arches.
Scene 3: He lands gently on the mossy back of the matriarch whale to remove a tangled storm-harp net from her fin.
Scene 4: In gratitude, the pod sings a deep harmonic chord that parts the storm clouds to reveal a hidden rainbow valley below.
Scene 5: Returning to his sandstone spire at twilight as the glowing pod circles his tower under the first stars.`,
  },
  {
    presetKey: 'deriv_fantasy_pantheon_norse_nine_realms',
    name: 'Mythic Atlas: Guardians of the Nine Realms',
    category: 'Fantasy & Myth',
    artStyle: 'PhotoRealistic',
    prompt: `Depict 7 legendary figures and realms of Norse cosmology with grounded, ancient northern majesty across 7 scenes:
1. Yggdrasil the World Ash rising through auroras with its roots drinking from the Well of Urd.
2. Odin the Wanderer cloaked in grey fur with his two ravens Huginn and Muninn perched on twisted pine branches.
3. Thor driving his bronze chariot pulled by twin mountain goats across thunderheads above the fjords.
4. Freya in her falcon-feathered cloak inside the golden hall of Folkvangr surrounded by wildflowers.
5. Heimdall standing watch on the shimmering crystalline arc of the Bifrost bridge with Gjallarhorn in hand.
6. Brokkr and Sindri forging glowing runic steel inside the volcanic cavern smithies of Nidavellir.
7. Jormungandr the World Serpent rising out of a tempestuous black northern sea.`,
  },
  {
    presetKey: 'deriv_fantasy_clockwork_owl_messenger',
    name: 'The Alchemist’s Brass Owl Across the Siege',
    category: 'Fantasy & Myth',
    artStyle: 'Fantasy',
    prompt: `Keep continuous camera tracking on a small, intricately engraved brass-and-emerald clockwork owl as it is wound up by an apprentice alchemist in a besieged library tower and flies across 4 perilous fantasy environments—over burning trebuchet lines, through a petrified crystal forest, across a stormy strait, and into the hands of the High Queen in her mountain sanctuary.`,
  },
  {
    presetKey: 'deriv_fantasy_subterranean_geode_kingdom',
    name: 'Expedition into the Giant Amethyst Cavern City',
    category: 'Fantasy & Myth',
    artStyle: 'PhotoRealistic',
    prompt: `Follow three Victorian subterranean explorers lowering their brass diving-bell elevator down a volcanic shaft 5 miles beneath the Alps, emerging into a cathedral-sized geode cavern where an entire civilization has carved suspended bridges, waterwheels, and lantern-lit plazas inside towering 300-foot purple amethyst crystals.`,
  },

  // ───────────────────────── ANIME & ACTION ─────────────────────────
  {
    presetKey: 'deriv_anime_ronin_bamboo_rain_duel',
    name: 'Blindfold Ronin vs Cyber-Shogun: Monsoon Bridge Duel',
    category: 'Anime & Action',
    artStyle: 'ANIME',
    prompt: `Create a razor-sharp 5-scene anime swordfight on a red lacquered wooden bridge over a raging gorge during a torrential monsoon:
Scene 1: A calm ronin in a straw kasa hat stands motionless at one end of the bridge while an armored cyber-shogun draws a crackling plasma nodachi at the other.
Scene 2: Extreme close-up of a single raindrop slicing in half as both warriors vanish in a high-speed dash toward the center.
Scene 3: Their blades lock mid-air above the bridge rails, sending a circular shockwave that parts the falling rain into a clear sphere around them.
Scene 4: The ronin pivots off the wet wooden railing, deflecting three rapid strikes in a blur of silver steel and teal sparks.
Scene 5: Both land with their backs to each other at opposite ends of the bridge as the ronin calmly clicks his scabbard shut and the shogun's shoulder armor splits clean in two.`,
  },
  {
    presetKey: 'deriv_anime_sky_pirate_airship_boarding',
    name: 'Cloud Corsairs: Grappling the Royal Dreadnought',
    category: 'Anime & Action',
    artStyle: 'ANIME',
    prompt: `Give me a kinetic 6-scene anime adventure where a crew of young sky-pirates aboard a nimble twin-propeller corvette fire harpoon zip-lines onto a colossal armored cloud-dreadnought, slide down the cables through anti-aircraft flak, duel the royal sky-knights on the outer brass hull, and escape by parachuting off the bow with the stolen wind-compass.`,
  },
  {
    presetKey: 'deriv_anime_shonen_culinary_clash',
    name: 'Grand Ramen Tournament: Fire Wok vs Ice Knife',
    category: 'Anime & Action',
    artStyle: 'ANIME',
    prompt: `Film an over-the-top shonen cooking battle inside a packed culinary colosseum where two rival young chefs face off: one wielding a roaring dragon-flame cast-iron wok and the other slicing ingredients in mid-air with a frost-chilled Damascus yanagiba knife, culminating in the judges experiencing a cosmic visual flavour explosion on their first bite.`,
  },
  {
    presetKey: 'deriv_anime_express_train_roof_chase',
    name: 'Bullet Train Rooftop Phantom Thief Escape',
    category: 'Anime & Action',
    artStyle: 'ANIME',
    prompt: `A 5-scene high-speed anime chase following a tuxedo-clad phantom thief sprinting across the roof of a 300 km/h white bullet train passing Mount Fuji at twilight while an relentless Interpol inspector pursues him across the carriages—ending with the thief leaping off a viaduct bridge onto a waiting hang-glider with a tip of his white top hat.`,
  },

  // ───────────────────────── THRILLER & MYSTERY ─────────────────────────
  {
    presetKey: 'deriv_thriller_arctic_weather_station_knock',
    name: 'Ice Station Zero: The Knock at 40 Below',
    category: 'Thriller & Mystery',
    artStyle: 'PhotoRealistic',
    prompt: `Build a Gripping 5-scene psychological thriller set inside an isolated 1980s brutalist meteorological station in Antarctica during the 6-month polar night:
Scene 1: Two researchers sit in the warm orange-lit radio room drinking coffee while the wind howls at 90 knots outside the triple-pane glass.
Scene 2: The seismic drum plotter suddenly spikes with rhythmic footsteps approaching from the interior ice shelf—300 miles from the nearest human camp.
Scene 3: Three slow, heavy knocks echo against the frosted steel outer airlock door.
Scene 4: Looking through the circular porthole window, their flashlight beam illuminates an identical copy of their own station's orange parka standing in the snow outside.
Scene 5: The figure slowly raises a gloved hand and presses a notebook page against the glass reading: "DO NOT ANSWER THE RADIO."`,
  },
  {
    presetKey: 'deriv_thriller_venetian_masquerade_heist',
    name: 'One-Shot Masquerade: The Stolen Palazzo Cipher',
    category: 'Thriller & Mystery',
    artStyle: 'PhotoRealistic',
    prompt: `Follow a velvet-gloved art thief wearing a porcelain gold Venetian mask through a candlelit palazzo masquerade ball across 5 tense scenes—slipping a counterfeit key into the countess's champagne tray, unlocking the hidden bookcase behind the string quartet, swapping the Renaissance cipher cylinder under a laser sensor, and vanishing onto a waiting canal boat just as the alarms chime.`,
  },
  {
    presetKey: 'deriv_thriller_lighthouse_foghorn_signal',
    name: 'POV: The Automated Lighthouse That Started Blinking Morse',
    category: 'Thriller & Mystery',
    artStyle: 'PhotoRealistic',
    prompt: `Create an atmospheric first-person mystery where only a maritime inspector's hands holding a heavy waterproof lantern and brass wrench are visible:
Scene 1: Stepping off a rubber zodiac onto the slick stone jetty of an offshore lighthouse that was decommissioned and sealed 30 years ago, yet its Fresnel lens is flashing Morse code into the fog.
Scene 2: Ascending the cast-iron spiral staircase past salt-crusted walls where fresh wet bootprints lead upward.
Scene 3: Reaching the lantern room at the top to find the brass mechanism spinning on its own around a warm cup of tea and a maritime logbook dated tomorrow.`,
  },

  // ───────────────────────── COMEDY & MEMES ─────────────────────────
  {
    presetKey: 'deriv_comedy_penguins_corporate_boardroom',
    name: 'Fortune 500 Tech Startup Run by Emperor Penguins',
    category: 'Comedy & Memes',
    artStyle: 'PhotoRealistic',
    prompt: `Show 4 dead-serious photorealistic scenes inside a sleek Silicon Valley glass headquarters where the entire executive team consists of 4-foot-tall Emperor Penguins wearing tiny clip-on badges and headset microphones:
Scene 1: The CEO Penguin waddles onto the keynote stage in a miniature black vest, pointing a flipper at a slide reading "Q4 KRILL SYNERGY UP 400%."
Scene 2: In a glass conference room, two penguin engineers slap their flippers on the table arguing over a whiteboard covered in fish diagrams.
Scene 3: The entire engineering department slides on their bellies in single file down the polished hallway toward the breakroom ice machine.
Scene 4: During a tense investor pitch, an intern dumps a bucket of fresh sardines on the boardroom table and all decorum instantly collapses.`,
  },
  {
    presetKey: 'deriv_comedy_medieval_knight_ikea',
    name: '14th-Century Knight Trying to Assemble Flat-Pack Furniture',
    category: 'Comedy & Memes',
    artStyle: 'PhotoRealistic',
    prompt: `Follow a fully armored 14th-century medieval knight in plate mail and visored helm across 4 relatable comedic scenes in a modern suburban apartment:
Scene 1: Pushing a flat yellow flatbed cart stacked with cardboard boxes through a giant blue-and-yellow warehouse maze while holding a tiny pencil.
Scene 2: Kneeling on his living room rug staring in utter bewilderment at a wordless instruction manual while holding a microscopic Allen wrench in his steel gauntlet.
Scene 3: Losing his patience and attempting to fasten a wooden dowel with a warhammer, leaving the bookshelf hilariously crooked.
Scene 4: Sitting proudly on the upside-down chair eating Swedish meatballs through his lifted visor.`,
  },
  {
    presetKey: 'deriv_comedy_racoon_michelin_critic',
    name: 'Photorealistic Raccoon as a Snobby Michelin Food Critic',
    category: 'Comedy & Memes',
    artStyle: 'PhotoRealistic',
    prompt: `Star a photorealistic raccoon wearing a tiny silk cravat and monocle seated at a white-tablecloth three-Michelin-star French restaurant in Paris:
Scene 1: The raccoon delicately swirls a crystal glass of vintage grape juice and takes notes in a leather mole-skin journal while the nervous head chef watches from the kitchen doors.
Scene 2: The waiter lifts a silver cloche to reveal a microscopic foam-and-truffle dish; the raccoon sighs, pulls a crumpled foil-wrapped street taco out of his jacket pocket, washes it in his water goblet, and gives himself 5 stars.`,
  },
  {
    presetKey: 'deriv_comedy_aliens_stuck_in_dmv',
    name: 'Intergalactic Warlords Stuck at the Local DMV',
    category: 'Comedy & Memes',
    artStyle: 'PhotoRealistic',
    prompt: `Show two terrifying 8-foot armored alien conquerors who landed to invade Earth, but first have to register their flying saucer at a fluorescent-lit municipal DMV office:
Scene 1: Their glowing plasma saucer is double-parked outside in the compact-only space with a yellow parking boot clamped to its landing strut.
Scene 2: Both warlords sit hunched in tiny plastic chairs holding paper ticket "#B-842" while the counter screen blinks "#A-003."
Scene 3: At the window, the unbothered clerk informs the Supreme Overlord that he filled out Form 27-B in blue ink instead of black and sends him to the back of the line.`,
  },

  // ───────────────────────── MUSIC & PERFORMANCE ─────────────────────────
  {
    presetKey: 'deriv_music_zero_g_symphony_orbit',
    name: 'Zero-Gravity Glass Cupola Orchestra Performance',
    category: 'Music & Performance',
    artStyle: 'PhotoRealistic',
    prompt: `Create a breathtaking 6-scene music video where a 12-piece string and synth orchestra performs suspended in zero gravity inside a giant transparent geodesic dome orbiting Earth:
Scene 1: The conductor taps her glowing baton and floating droplets of gold liquid scatter across the dome in slow motion as sunrise crests over the curvature of Earth.
Scene 2: The lead cellist drifts slowly in a circle while playing passionately, her satin gown billowing weightlessly around her.
Scene 3: Synchronized violinists push off the glass ribs of the dome in choreographed zero-G arcs as aurora borealis ribbons glow miles below.
Scene 4: A grand transparent acrylic piano floats in the center while the pianist plays upside-down relative to the camera.
Scene 5: On the crescendo, the dome's exterior thrusters fire in rhythmic pulses of blue light matching the drumbeat.
Scene 6: Final wide pull-back shot from outside in open space showing the illuminated glass concert hall drifting serenely above the night lights of Europe.`,
  },
  {
    presetKey: 'deriv_music_desert_mirage_neon_festival',
    name: 'Sahara Mirage: Kinetic Sculpture Electronic Music Video',
    category: 'Music & Performance',
    artStyle: 'PhotoRealistic',
    prompt: `Film a 6-scene electronic music video across golden Sahara sand dunes at twilight where colossal wind-powered kinetic mirror sculptures move in rhythm with the DJ's live synth performance—transitioning from blazing golden sunset reflections, to blue-hour laser beams bouncing between the moving mirrors across the dunes, to a starry night finale where bioluminescent sand ripples under the dancers' feet.`,
  },
  {
    presetKey: 'deriv_music_jazz_bears_speakeasy',
    name: '1920s Harlem Jazz Quartet of Upright Bears',
    category: 'Music & Performance',
    artStyle: 'PhotoRealistic',
    prompt: `Create a warm, soulful 5-scene jazz performance video inside a velvet-curtained 1920s speakeasy starring four photorealistic bears who stand upright in bespoke double-breasted pinstripe suits:
Scene 1: A Kodiak bear in a fedora steps up to the vintage brass ribbon microphone and blows a velvety golden note on his tenor saxophone.
Scene 2: A sleek black bear upright bassist plucks a walking bassline while nodding in the amber spotlight haze.
Scene 3: A polar bear in a white dinner jacket glides his paws effortlessly across the ivory keys of a Steinway grand.
Scene 4: The whole speakeasy crowd claps on beat during the drum solo.
Scene 5: The quartet takes a synchronized bow under falling gold confetti.`,
  },
];

export const EXTRAPOLATED_TEMPLATE_SEEDS: Template[] = RAW_DERIVATIVE_TEMPLATE_SEEDS.map(
  (seed, idx) => ({
    id: `seed-${seed.presetKey}`,
    name: seed.name,
    basePrompt: seed.prompt,
    thumbnailUrl: '',
    createdAt: 1700000000000 - idx * 1000,
    isCustom: true,
    userId: 1,
    artStyle: seed.artStyle,
    category: seed.category,
    inLibrary: false,
    presetKey: seed.presetKey,
  })
);

export interface CategorizedPromptTemplate {
  id: string;
  name: string;
  basePrompt: string;
  artStyle?: string;
  image?: string;
  video?: string;
  userId?: number;
  category?: TemplateCategory;
  inLibrary?: boolean;
  presetKey?: string;
}

export function decodeCategorizedTemplate(row: {
  id: number | string;
  title?: string;
  name?: string;
  template_prompt?: string;
  basePrompt?: string;
  artstyle?: string;
  artStyle?: string;
  image_url?: string;
  image?: string;
  video_url?: string;
  video?: string;
  userid?: number;
  userId?: number;
  inLibrary?: boolean;
  category?: string;
  presetKey?: string;
}): CategorizedPromptTemplate {
  const name = String(row.name ?? row.title ?? 'Untitled Template');
  const basePrompt = String(row.basePrompt ?? row.template_prompt ?? '');
  const rawArtStyle = row.artStyle ?? row.artstyle ?? '';
  const unpacked = unpackTemplateMeta(rawArtStyle, name, basePrompt);

  return {
    id: String(row.id),
    name,
    basePrompt,
    artStyle: unpacked.artStyle,
    image: row.image ?? row.image_url ?? '',
    video: row.video ?? row.video_url ?? '',
    userId: Number(row.userId ?? row.userid ?? 1),
    category: (row.category as TemplateCategory) || unpacked.category,
    inLibrary: typeof row.inLibrary === 'boolean' ? row.inLibrary : unpacked.inLibrary,
    presetKey: row.presetKey || unpacked.presetKey,
  };
}
