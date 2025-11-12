

class CreatureImporterDialog extends Application {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: "Import Creature",
      template: "modules/pf2e-creature-importer/templates/importer-dialog.html",
      width: 750,
      height: 650,
      resizable: true,
      classes: ["pf2e", "creature-importer"]
    });
}
 activateListeners(html) {
  super.activateListeners(html);
  html.find("#load-sample").click(() => {
    const sampleData = {
      _id: null,
      name: "Goblin Warrior",
      type: "npc",
      img: "systems/pf2e/icons/default-icons/npc.svg",
      system: {
        details: {
          level: { value: 1 },
          alignment: { value: "NE" }
        },
        abilities: {
          str: { mod: 3 },
          dex: { mod: 2 }
        },
        attributes: {
          hp: { value: 25, max: 25, temp: 0, formula: "2d8+6", details: "" },
          ac: { value: 17, details: "" },
          perception: { value: 6, rank: 2, attribute: "wis" },
          speed: { value: 25, otherSpeeds: [], details: "" },
          senses: { value: "darkvision 60 ft", custom: "" },
          saves: {
            fortitude: { value: 5, rank: 0, dc: 15 },
            reflex: { value: 6, rank: 1, dc: 16 },
            will: { value: 2, rank: 0, dc: 12 }
          },
          immunities: { value: [{ type: "poison" }], custom: "" },
          resistances: { value: [{ type: "fire", value: 5 }], custom: "" }
        },
        traits: {
          size: { value: "small" },
          rarity: { value: "common" },
          value: ["goblin", "humanoid"],
          custom: ""
        }
      },
      items: [],
      prototypeToken: { dimSight: 60, disposition: -1 }
    };
    html.find("#creature-input").val("===BASE===\n" + JSON.stringify(sampleData, null, 2));
    html.find("#json-error").hide();
  });

  html.find("#cancel").click(() => this.close());

  html.find("#create").click(async () => {
    console.log("🛠️ Import button clicked.");

    const errorDisplay = html.find("#json-error").hide();
    const disableCreateButton = () => html.find("#create").prop("disabled", true);
    const enableCreateButton = () => html.find("#create").prop("disabled", false);
    const getValue = id => (html.find(id).val() || "").trim();

    disableCreateButton();

    try {
      const fullInput = getValue("#creature-input");

      const sections = {
  base: "",
  spells: "",
  equipment: "",
  actions: "",
  attacks: ""    
};

let currentSection = null;
for (const line of fullInput.split("\n")) {
  const trimmed = line.trim();
  if (/^===BASE===/i.test(trimmed)) currentSection = "base";
  else if (/^===SPELLS===/i.test(trimmed)) currentSection = "spells";
  else if (/^===EQUIPMENT===/i.test(trimmed)) currentSection = "equipment";
  else if (/^===ACTIONS===/i.test(trimmed)) currentSection = "actions";
  else if (/^===ATTACKS===/i.test(trimmed)) currentSection = "attacks";  
  else if (currentSection) sections[currentSection] += trimmed + "\n";
}


      let creatureData;
      if (sections.base.trim().startsWith("{")) {
        try {
          creatureData = JSON.parse(sections.base);
          console.log("✅ Parsed raw JSON base block.");
        } catch (e) {
          throw new Error("Base block JSON is invalid: " + e.message);
        }
      } else {
        creatureData = await this.parseSimpleBase(sections.base);
        if (!creatureData) throw new Error("Failed to parse simplified base block.");
        console.log("✅ Parsed simplified base block.");
      }

let actions = [];
if (sections.actions.trim()) {
  try {
    actions = await this.parseAbilities(sections.actions);
  } catch (e) {
    throw new Error("Actions block failed to parse: " + e.message);
  }
}
let attacks = [];
if (sections.attacks?.trim()) {
  try {
    const spellPack = game.packs.get("pf2e.spells-srd"); 
    const spellIndex = await spellPack.getIndex();

   attacks = await this.parseAttacks(sections.attacks, spellIndex, spellPack);


  } catch (e) {
    throw new Error("Attacks block failed to parse: " + e.message);
  }
}




      const equipment = await this.parseEquipment(sections.equipment);



      const spells = await this.dispatchSpellBlock(sections.spells, creatureData);


      console.log("🔹 Actions parsed:", actions);
      console.log("🔹 Equipment parsed:", equipment);
      console.log("🔹 Spells parsed:", spells);

      creatureData.items = [
        ...(creatureData.items || []),
        ...actions,
        ...equipment,
        ...spells,
        ...attacks
      ];

      const actor = await this.createActor(creatureData);
      if (actor) {
        console.log("🎉 Actor created successfully:", actor.name);
        ui.notifications.info(`Successfully imported "${actor.name}".`);
        this.close();
        actor.sheet.render(true);
      }

    } catch (err) {
      console.error("❌ Creature Import Error:", err);
      errorDisplay.html(`<strong>Error:</strong> ${err.message}`).show();
      ui.notifications.error(`Import Failed: ${err.message}`);
    } finally {
      enableCreateButton();
      console.log("✅ Finished import process.");
    }
  });
}
async parseSimpleBase(text) {
  if (!text?.trim()) return null;
const normalizeDefenseEntry = (entry, hasValue = true) => {
  const base = {
    type: typeof entry.type === "string" ? entry.type : "unknown",
    exceptions: Array.isArray(entry.exceptions) ? entry.exceptions.filter(e => typeof e === "string") : []
  };

  if (hasValue) {
    base.value = typeof entry.value === "number" ? entry.value : 0;
    base.doubleVs = Array.isArray(entry.doubleVs) ? entry.doubleVs.filter(e => typeof e === "string") : [];
  }

  return base;
};



  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const creature = {
    name: "Unnamed",
    type: "npc",
    system: {
      details: {
        level: { value: 0 },
        publicNotes: "",
        privateNotes: "",
        languages: { value: [], details: "" }
      },
      abilities: {},
      saves: {
        fortitude: { value: 0 },
        reflex: { value: 0 },
        will: { value: 0 }
      },
      perception: { mod: 0, details: "", senses: [], vision: false },
      attributes: {
        ac: { value: 10 },
        hp: { value: 1, max: 1, temp: 0 },
        speed: { value: 0, otherSpeeds: [], details: "" },
        immunities: [],
        resistances: [],
        weaknesses: [],
        skills: {}
      },
      traits: {
        size: { value: "med" },
        rarity: "common",
        value: []
      }
    },
    items: []
  };

  

  const parseDefensive = (line) => {
  return line.split(";").map(entry => {
    const [base, ...mods] = entry.split("|").map(s => s.trim());
    const [type, valueStr] = base.trim().split(/\s+/);
    const obj = {
      type: type.toLowerCase(),
      value: Number(valueStr) || 0,
      exceptions: [],
      doubleVs: []
    };

    for (const mod of mods) {
      if (mod.toLowerCase().startsWith("except ")) {
        obj.exceptions = mod.slice(7).split(",").map(s => s.trim());
      } else if (mod.toLowerCase().startsWith("doublevs ")) {
        obj.doubleVs = mod.slice(9).split(",").map(s => s.trim());
      }
    }

    return obj;
  });
};


  for (let line of lines) {
    const [keyRaw, ...rest] = line.split(":");
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(":").trim();

    switch (key) {
      case "name": creature.name = value; break;
      case "type": creature.type = value; break;
      case "level": creature.system.details.level.value = Number(value); break;
      case "rarity": creature.system.traits.rarity = value.toLowerCase(); break;
      case "size":
        const sizeMap = { tiny: "tiny", small: "sm", medium: "med", large: "lg", huge: "huge", gargantuan: "grg" };
        const size = value.toLowerCase();
        if (sizeMap[size]) creature.system.traits.size.value = sizeMap[size];
        break;
      case "traits":
  creature.system.traits.value = value.split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  break;
     case "languages": {
  if (!creature.system.details.languages) {
    creature.system.details.languages = { value: [], details: "" };
  }

  const parts = value.split(",").map(s => s.trim()).filter(Boolean);
  const validLanguages = [];
  const customDetails = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    const isStandardLang = [
      "common", "abyssal", "draconic", "infernal", "elven", "dwarven", "orcish", "undercommon", "necril", "celestial", "aklo", "halfling", "gnomish", "goblin", "sylvan", "telepathy", "sahuugin", "grippli", "grippli", "shadowtongue"
    ].includes(lower);

    if (isStandardLang) {
      validLanguages.push(lower);
    } else {
      customDetails.push(part);
    }
  }

  creature.system.details.languages.value = validLanguages;
  creature.system.details.languages.details = customDetails.join(", ");
  break;
}

case "perception": {

  const pipeParts = value.split('|').map(p => p.trim());
  let visionPart = pipeParts[0];
  const detailsPart = pipeParts.length > 1 ? pipeParts[1] : "";


  const parts = visionPart.split(",").map(p => p.trim());
  const modStr = parts.shift()?.match(/[+-]?\d+/)?.[0] ?? "0";

  creature.system.perception.mod = Number(modStr);
  creature.system.perception.vision = true;
  creature.system.perception.senses = [];

  for (const part of parts) {
    const match = part.match(/^([\w\s-]+?)(?:\s+(\d+))?\s*(?:\((precise|imprecise|vague)\))?\s*(?:feet)?$/i);

    
    if (match) {
      const [, nameRaw, rangeRaw, acuityRaw] = match;
      const type = nameRaw.trim().toLowerCase().replace(/\s+/g, "-"); 

      const sense = { type };

      if (rangeRaw) {
        const parsed = Number(rangeRaw);
        if (!isNaN(parsed)) {
          sense.range = parsed;
        }
      }

      if (acuityRaw) {
        sense.acuity = acuityRaw.toLowerCase();
      }

      creature.system.perception.senses.push(sense);
    }
  }

 
  if (detailsPart) {

    const cleanedDetails = detailsPart
      .replace(/\(.*?\)/g, '') 
      .replace(/([a-z])([A-Z])/g, '$1 $2') 
      .replace(/(\d+)([a-zA-Z])/g, '$1 $2') 
      .trim();
    
    creature.system.perception.details = cleanedDetails;
  } else {
    creature.system.perception.details = "";
  }

  break;
}
case "saves": {
  if (!creature.system.saves) creature.system.saves = {};

  let raw = value; 
  let detailText = "";


  const pipeParts = raw.split("|").map(p => p.trim());
  raw = pipeParts[0];
  if (pipeParts.length > 1) {
    creature.system.attributes ??= {};
    creature.system.attributes.allSaves ??= {};
    creature.system.attributes.allSaves.value = pipeParts[1];
  }


  const parenMatch = raw.match(/\(([^)]+)\)$/);
  if (parenMatch) {
    creature.system.attributes ??= {};
    creature.system.attributes.allSaves ??= {};
    creature.system.attributes.allSaves.value = parenMatch[1].trim();
    raw = raw.replace(/\s*\([^)]+\)\s*$/, ""); 
  }


  raw.split(",").forEach(s => {
    const [abbr, modStr] = s.trim().split(/\s*\+\s*/);
    const saveKey = { fort: "fortitude", ref: "reflex", will: "will" }[abbr.toLowerCase()];
    const mod = Number(modStr);
    if (saveKey && !isNaN(mod)) {
      creature.system.saves[saveKey] ??= {};
      creature.system.saves[saveKey].value = mod;
    }
  });

  break;
}


 case "abilities":
  value.split(",").forEach(stat => {
    const match = stat.trim().match(/^(\w+)\s*([+-]?\d+)$/);
    if (match) {
      const [, abbr, modStr] = match;
      creature.system.abilities[abbr.toLowerCase()] = { mod: Number(modStr) };
    }
  });
  break;

    case "skills":
  if (!creature.system.skills) creature.system.skills = {};
  if (!Array.isArray(creature.items)) creature.items = [];

  value.split(",").forEach(skill => {
    const trimmed = skill.trim();
    if (!trimmed) return;

  
    const regex = /^(.+?)\s*\+\s*(-?\d+)(?:\s*\|\s*(.*?))?(?:\s*\[(.*?)\])?$/;
    const match = trimmed.match(regex);

    if (!match) return;

    const [, nameRaw, modStr, label, predicateRaw] = match;
    const mod = Number(modStr);
    const name = nameRaw.trim();
    const lower = name.toLowerCase();
    const predicates = predicateRaw?.split(",").map(s => s.trim()).filter(Boolean) ?? [];

    if (/lore$/i.test(name)) {
    
      const existing = creature.items.find(i => i.type === "lore" && i.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
        creature.items.push({
          type: "lore",
          name: name.replace(/\b\w/g, l => l.toUpperCase()),
          system: {
            mod: { value: mod },
            special: label || predicates.length ? [{
              base: mod,
              label,
              predicate: predicates
            }] : [],
            proficient: { value: 0 },
            traits: { otherTags: [] },
            rules: [],
            slug: null,
            publication: {
              title: "",
              authors: "",
              license: "ORC",
              remaster: true
            }
          },
          img: "systems/pf2e/icons/default-icons/lore.svg",
          flags: {},
          effects: []
        });
      } else if (label || predicates.length) {
        existing.system.special ||= [];
        existing.system.special.push({
          base: mod,
          label,
          predicate: predicates
        });
      }
    } else {
      
      if (!creature.system.skills[lower]) {
        creature.system.skills[lower] = {
          base: label || predicates.length ? null : mod,
          special: []
        };
      }

      const skill = creature.system.skills[lower];

      if (label || predicates.length) {
        skill.special.push({
          base: mod,
          label,
          predicate: predicates
        });
      } else {
        skill.base = mod;
      }
    }
  });
  break;


case "ac": {
  if (!creature.system.attributes.ac) creature.system.attributes.ac = {};

  const [baseStr, detailStr] = value.split("|").map(s => s.trim());
  creature.system.attributes.ac.value = Number(baseStr);

  if (detailStr) {
    creature.system.attributes.ac.details = detailStr;
  } else {
    creature.system.attributes.ac.details = "";
  }

  break;
}

case "hp": {
  const parts = value.split("|").map(p => p.trim());
  const hp = Number(parts[0]);
  creature.system.attributes.hp.value = hp;
  creature.system.attributes.hp.max = hp;
  creature.system.attributes.hp.details = parts[1] || "";
  break;
}

case "speed": {
  const parts = value.split("|").map(p => p.trim());
  const speedPart = parts[0];
  const detailPart = parts[1] || "";


  creature.system.attributes.speed.value = 0;
  creature.system.attributes.speed.otherSpeeds = [];
  creature.system.attributes.speed.details = detailPart;

  const speedEntries = speedPart.split(",").map(s => s.trim());

  for (const entry of speedEntries) {
    const match = entry.match(/^(\w+)\s+(\d+)\s*feet$/i);
    if (!match) continue;

    const [, typeRaw, distanceStr] = match;
    const type = typeRaw.toLowerCase();
    const value = Number(distanceStr);

    if (type === "land") {
      creature.system.attributes.speed.value = value;
    } else {
      creature.system.attributes.speed.otherSpeeds.push({
        type,
        value,
        unit: "feet"
      });
    }
  }

  break;
}


case "immunities":
creature.system.attributes.immunities = await this.parseImmunitiesBlock(value);
  break;
case "resistances":
 creature.system.attributes.resistances = await this.parseResistancesBlock(value);
break;
case "weaknesses":
  creature.system.attributes.weaknesses = await this.parseWeaknessesBlock(value);
  break;
case "public notes": creature.system.details.publicNotes = value; break;
case "private notes": creature.system.details.privateNotes = value; break;
    }
  }
creature.system.attributes.immunities = (creature.system.attributes.immunities || []).map(e => normalizeDefenseEntry(e, false));
creature.system.attributes.resistances = (creature.system.attributes.resistances || []).map(e => normalizeDefenseEntry(e, true));
creature.system.attributes.weaknesses = (creature.system.attributes.weaknesses || []).map(e => normalizeDefenseEntry(e, true));



function cleanDefenseArray(arr) {
  return (Array.isArray(arr) ? arr : []).filter(e => typeof e === "string" && e.trim().length > 0);
}

for (const res of creature.system.attributes.resistances ?? []) {
  res.exceptions = cleanDefenseArray(res.exceptions);
  res.doubleVs = cleanDefenseArray(res.doubleVs);
}

for (const weak of creature.system.attributes.weaknesses ?? []) {
  weak.exceptions = cleanDefenseArray(weak.exceptions);
  delete weak.doubleVs;
}

for (const imm of creature.system.attributes.immunities ?? []) {
  imm.exceptions = cleanDefenseArray(imm.exceptions);
  delete imm.doubleVs;
}

creature.system.traits.value = (creature.system.traits.value ?? [])
  .map(t => (typeof t === "string" ? t.trim().toLowerCase() : null))
  .filter(t => !!t);

creature.system.traits.rarity = creature.system.traits.rarity || "common";
creature.system.traits.size = creature.system.traits.size || { value: "med" };
creature.system.attributes.senses ??= [];


  return creature;
  
}
async parseWeaknessesBlock(rawText) {
  if (!rawText?.trim()) return [];

  const VALID_WEAKNESSES = new Set([
    "abysium", "acid", "adamantine", "air", "alchemical", "all-damage", "arcane", "area-damage", "axes",
    "bleed", "bludgeoning", "cold", "cold-iron", "critical-hits", "damage-from-spells", "dawnsilver",
    "divine", "djezet", "duskwood", "earth", "electricity", "energy", "fire", "force", "ghost-touch",
    "holy", "inubrix", "light", "magical", "mental", "metal", "mythic", "non-magical", "nonlethal",
    "nonlethal-attacks", "noqual", "occult", "orichalcum", "persistent-damage", "physical", "piercing",
    "plant", "poison", "precision", "primal", "protean-anatomy", "radiation", "salt", "salt-water",
    "siccatite", "silver", "slashing", "sonic", "spells", "spirit", "unarmed-attacks", "unholy",
    "vitality", "void", "vorpal", "vorpal-adamantine", "water", "weapons", "weapons-shedding-bright-light", "wood"
  ]);

  const normalizeType = (str) => str.trim().toLowerCase().replace(/\s+/g, "-");

  function splitOutsideParens(text) {
    const result = [];
    let buffer = '';
    let depth = 0;
    for (let char of text) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      if (char === ',' && depth === 0) {
        result.push(buffer.trim());
        buffer = '';
      } else {
        buffer += char;
      }
    }
    if (buffer) result.push(buffer.trim());
    return result;
  }

  const entries = splitOutsideParens(rawText);
  const results = [];

  for (const entry of entries) {
   
    const baseMatch = entry.replace(/\(.*?\)/g, "").trim().match(/^([a-zA-Z\-]+)\s+(\d+)/i);
    if (!baseMatch) {
      console.warn("⚠️ Invalid base weakness format:", entry);
      continue;
    }

    let [, typeRaw, valueRaw] = baseMatch;
    typeRaw = normalizeType(typeRaw);
    const value = parseInt(valueRaw, 10);

    if (!VALID_WEAKNESSES.has(typeRaw)) {
      console.warn("❌ Invalid weakness type:", typeRaw);
      continue;
    }

    const weakness = { type: typeRaw };
    if (!isNaN(value)) weakness.value = value;

    
    const modifierMatches = [...entry.matchAll(/\(([^)]+)\)/g)];
    for (const match of modifierMatches) {
      const modText = match[1].toLowerCase();

      if (modText.startsWith("except ")) {
        const items = modText.replace("except ", "")
          .split(/[, ]+/)
          .map(normalizeType)
          .filter(Boolean);
        weakness.exceptions = [...(weakness.exceptions || []), ...items];
      }
    }

    results.push(weakness);
  }

  return results;
}
async parseResistancesBlock(rawText) {
  if (!rawText?.trim()) return [];

  const VALID_RESISTANCES = new Set([
    "abysium", "acid", "adamantine", "air", "alchemical", "all-damage", "arcane", "area-damage", "bleed",
    "bludgeoning", "cold", "cold-iron", "critical-hits", "dawnsilver", "divine", "djezet", "duskwood",
    "earth", "electricity", "energy", "fire", "force", "ghost-touch", "holy", "inubrix", "light", "magical",
    "mental", "metal", "mythic", "non-magical", "nonlethal", "nonlethal-attacks", "noqual", "occult",
    "orichalcum", "persistent-damage", "physical", "piercing", "plant", "poison", "precision", "primal",
    "protean-anatomy", "radiation", "salt", "salt-water", "siccatite", "silver", "slashing", "sonic",
    "spells", "spirit", "unarmed-attacks", "unholy", "vitality", "void", "vorpal", "vorpal-adamantine",
    "water", "weapons", "weapons-shedding-bright-light", "wood"
  ]);

 
  function splitOutsideParens(text) {
    const result = [];
    let buffer = '';
    let depth = 0;
    for (let char of text) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      if (char === ',' && depth === 0) {
        result.push(buffer.trim());
        buffer = '';
      } else {
        buffer += char;
      }
    }
    if (buffer) result.push(buffer.trim());
    return result;
  }

  const entries = splitOutsideParens(rawText);
  const results = [];

  for (const entry of entries) {
  
    const baseMatch = entry.replace(/\(.*?\)/g, "").trim().match(/^([a-zA-Z\-]+)\s+(\d+)/i);

    if (!baseMatch) {
      console.warn("⚠️ Invalid base resistance format:", entry);
      continue;
    }

    let [, typeRaw, valueRaw] = baseMatch;
    typeRaw = typeRaw.trim().toLowerCase().replace(/\s+/g, "-");
    const value = valueRaw ? parseInt(valueRaw, 10) : null;

    if (!VALID_RESISTANCES.has(typeRaw)) {
      console.warn("❌ Invalid resistance type:", typeRaw);
      continue;
    }

    const resistance = { type: typeRaw };
    if (!isNaN(value)) resistance.value = value;

   
    const modifierMatches = [...entry.matchAll(/\(([^)]+)\)/g)];
    for (const match of modifierMatches) {
      const modText = match[1].toLowerCase();

      if (modText.startsWith("except ")) {
        const items = modText.replace("except ", "").split(/[, ]+/).map(s => s.trim().replace(/\s+/g, "-")).filter(Boolean);
        resistance.exceptions = [...(resistance.exceptions || []), ...items];
      }

      if (modText.startsWith("double vs")) {
        const items = modText.replace("double vs", "").replace(".", "").split(/[, ]+/).map(s => s.trim().replace(/\s+/g, "-")).filter(Boolean);
        resistance.doubleVs = [...(resistance.doubleVs || []), ...items];
      }
    }

    results.push(resistance);
  }

  return results;
}
async parseImmunitiesBlock(rawText) {
  if (!rawText?.trim()) return [];

  const VALID_IMMUNITIES = new Set([
    "abysium", "acid", "adamantine", "air", "alchemical", "arcane", "area-damage", "auditory", "bleed", 
    "blinded", "bludgeoning", "clumsy", "cold", "cold-iron", "confused", "controlled", "critical-hits", 
    "curse", "dawnsilver", "dazzled", "deafened", "death-effects", "detection", "disease", "divine", 
    "djezet", "doomed", "drained", "duskwood", "earth", "electricity", "emotion", "energy", "enfeebled",
    "fascinated", "fatigued", "fear-effects", "fear", "fire", "fleeing", "force", "fortune-effects", 
    "frightened", "grabbed", "healing", "holy", "illusion", "immobilized", "inhaled", "inubrix",
    "light", "magic", "mental", "metal", "misfortune-effects", "non-magical", "nonlethal-attacks", 
    "noqual", "object-immunities", "occult", "off-guard", "olfactory", "orichalcum", "paralyzed", 
    "persistent-damage", "petrified", "physical", "piercing", "plant", "poison", "polymorph",
    "possession", "precision", "primal", "prone", "radiation", "restrained", "salt-water", "scrying",
    "siccatite", "sickened", "silver", "slashing", "sleep", "slowed", "sonic", "spell-deflection",
    "spirit", "stunned", "stupefied", "swarm-attacks", "swarm-mind", "trip", "unarmed-attacks", 
    "unconscious", "unholy", "visual", "vitality", "void", "water", "wood", "wounded"
  ]);

  const normalizeType = (str) => str.trim().toLowerCase().replace(/\s+/g, "-");

  function splitOutsideParens(text) {
    const result = [];
    let buffer = '';
    let depth = 0;
    for (let char of text) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      if (char === ',' && depth === 0) {
        result.push(buffer.trim());
        buffer = '';
      } else {
        buffer += char;
      }
    }
    if (buffer) result.push(buffer.trim());
    return result;
  }

  const entries = splitOutsideParens(rawText);
  const results = [];

  for (const entry of entries) {
    const match = entry.match(/^(.+?)(?:\s*\(([^)]+)\))?$/i);
    if (!match) {
      console.warn("⚠️ Invalid immunity entry format:", entry);
      continue;
    }

    let [, typeRaw, modifierText] = match;
    typeRaw = normalizeType(typeRaw);

    if (!VALID_IMMUNITIES.has(typeRaw)) {
      console.warn("❌ Invalid immunity type:", typeRaw);
      continue;
    }

    const immunity = { type: typeRaw };

    if (modifierText && modifierText.toLowerCase().startsWith("except")) {
      const exceptions = modifierText
        .slice(6)
        .split(/[, ]+/)
        .map(normalizeType)
        .filter(Boolean);
      immunity.exceptions = exceptions;
    }

    results.push(immunity);
  }

  return results;
}
async dispatchSpellBlock(structuredText, creatureData) {
  if (!structuredText?.trim()) return [];

  const lines = structuredText.split("\n").map(l => l.trim());

  const blocks = [];
  let currentBlock = [];

  for (const line of lines) {
    if (/^(prepared|spontaneous|innate|focus|ritual)/i.test(line)) {
      if (currentBlock.length) blocks.push(currentBlock.join("\n"));
      currentBlock = [line]; 
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length) blocks.push(currentBlock.join("\n"));

  const allSpells = [];

  for (const block of blocks) {
    const firstLine = block.split("\n").map(l => l.trim()).find(Boolean)?.toLowerCase();

    if (firstLine?.startsWith("prepared")) {
      allSpells.push(...await this.parseStructuredSpellBlock(block, creatureData));
    } else if (firstLine?.startsWith("spontaneous")) {
      allSpells.push(...await this.parseSpontaneousSpellBlock(block, creatureData));
    } else if (firstLine?.startsWith("innate")) {
      allSpells.push(...await this.parseInnateSpellBlock(block, creatureData));
    } else if (firstLine?.startsWith("focus")) {
      allSpells.push(...await this.parseFocusSpellBlock(block, creatureData));
    } else if (firstLine?.startsWith("ritual")) {
      allSpells.push(...await this.parseRitualSpellsBlock(block, creatureData));

    } else {
      console.warn("⚠ Unknown spellcasting block type:", firstLine);
    }
  }

  return allSpells;
}

async parseSpontaneousSpellBlock(structuredText, creatureData) {
  if (!structuredText?.trim()) return [];

  const abilityMap = {
    strength: "str", dexterity: "dex", constitution: "con",
    intelligence: "int", wisdom: "wis", charisma: "cha"
  };

  const compendiumSpells = game.packs.get("pf2e.spells-srd");
  const index = await compendiumSpells.getIndex();
  const allSpells = [];

  const lines = structuredText.split("\n").map(l => l.trim()).filter(Boolean);

  let currentEntry = null;
  let spellSection = null;

  const parseHeader = (line) => {
    const [typeRaw, traditionRaw, abilityRaw, ...slotParts] = line.split(",").map(s => s.trim().toLowerCase());
    if (typeRaw !== "spontaneous") return null;

    const ability = abilityMap[abilityRaw] || abilityRaw;
    const tradition = traditionRaw;

    const slots = {};
    let spellDC = 10;
    let spellAttack = 0;

    for (const part of slotParts) {
      const slotMatch = part.match(/(\d+)\s+rank\s+(\d+)|(\d+)\s+rank/i);
      if (slotMatch) {
        const [, count1, rank1, rankAlt] = slotMatch;
        const count = parseInt(count1);
        const rank = rank1 || rankAlt;
        const slotKey = `slot${rank}`;
        slots[slotKey] = {
          prepared: [],
          value: count,
          max: count
        };
        continue;
      }

      const dcMatch = part.match(/spelldc[:=]?\s*(\d+)/i);
      if (dcMatch) {
        spellDC = Number(dcMatch[1]);
        continue;
      }

      const atkMatch = part.match(/spellattack[:=]?\s*([+-]?\d+)/i);
      if (atkMatch) {
        spellAttack = Number(atkMatch[1]);
        continue;
      }
    }

    const system = {
      ability: { value: ability },
      spelldc: {
        value: spellAttack,
        dc: spellDC
      },
      tradition: { value: tradition },
      prepared: { value: "spontaneous", flexible: false },
      showSlotlessLevels: { value: false },
      proficiency: { value: 1 },
      slots
    };

    const entry = {
      _id: foundry.utils.randomID(),
      name: `Spontaneous Spells`,
      type: "spellcastingEntry",
      img: "icons/magic/symbols/question-stone-yellow.webp",
      system
    };

    creatureData.items.push(entry);
    return entry;
  };

  for (let line of lines) {
    if (/^spontaneous/i.test(line)) {
      currentEntry = parseHeader(line);
      spellSection = null;
      continue;
    }

    if (/^spellslot/i.test(line)) {
      spellSection = "spellslot";
      continue;
    }

    if (!currentEntry) continue;

    if (spellSection === "spellslot") {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) continue;
      const [, rankStr, name] = match;
      const rank = parseInt(rankStr);

      const compendiumEntry = index.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (!compendiumEntry) continue;

      const doc = await compendiumSpells.getDocument(compendiumEntry._id);
      const spell = doc.toObject();
      spell._id = foundry.utils.randomID();

      
      spell.system.location = {
        value: currentEntry._id
      };

      
      const baseLevel = spell.system.level?.value ?? 1;
      if (rank > baseLevel) {
        spell.system.location.heightenedLevel = rank;
      }

      
      spell.system.level.value = baseLevel;

      allSpells.push(spell);
    }
  }

  return allSpells;
}
async parseInnateSpellBlock(structuredText, creatureData) {
  if (!structuredText?.trim()) return [];

  const abilityMap = {
    strength: "str", dexterity: "dex", constitution: "con",
    intelligence: "int", wisdom: "wis", charisma: "cha"
  };

  const compendiumSpells = game.packs.get("pf2e.spells-srd");
  const index = await compendiumSpells.getIndex();
  const allSpells = [];

  const lines = structuredText.split("\n").map(l => l.trim()).filter(Boolean);
  let currentEntry = null;

  const parseHeader = (line) => {
    const [typeRaw, traditionRaw, abilityRaw, ...rest] = line.split(",").map(s => s.trim().toLowerCase());
    if (typeRaw !== "innate") return null;

    const ability = abilityMap[abilityRaw] || abilityRaw;
    let spellDC = 10;
    let spellAttack = 0;

    for (const part of rest) {
      const dcMatch = part.match(/spelldc[:=]?\s*(\d+)/i);
      const atkMatch = part.match(/spellattack[:=]?\s*([+-]?\d+)/i);

      if (dcMatch) spellDC = Number(dcMatch[1]);
      if (atkMatch) spellAttack = Number(atkMatch[1]);
    }

    const system = {
      ability: { value: ability },
      spelldc: {
        value: spellAttack,
        dc: spellDC
      },
      tradition: { value: traditionRaw },
      prepared: { value: "innate", flexible: false },
      showSlotlessLevels: { value: false },
      proficiency: { value: 1 },
      slots: {}
    };

    const entry = {
      _id: foundry.utils.randomID(),
      name: `Innate Spells`,
      type: "spellcastingEntry",
      img: "icons/magic/symbols/star-circle-blue.webp",
      system
    };

    creatureData.items.push(entry);
    return entry;
  };

  for (let line of lines) {
    if (/^innate/i.test(line)) {
      currentEntry = parseHeader(line);
      continue;
    }

    if (!currentEntry) continue;

    const match = line.match(/^rank\s*(\d+)\s+(.+?)\s+(\d+)$/i);
    if (!match) continue;

    const [, rankStr, spellName, usesStr] = match;
    const rank = parseInt(rankStr);
    const uses = parseInt(usesStr);

    const compendiumEntry = index.find(e => e.name.toLowerCase() === spellName.toLowerCase());
    if (!compendiumEntry) continue;

    const doc = await compendiumSpells.getDocument(compendiumEntry._id);
    const spell = doc.toObject();
    spell._id = foundry.utils.randomID();

 
  if (rank === 0 && uses === 0) continue; 

    spell.system.location = {
      value: currentEntry._id,
      uses: {
        max: uses,
        value: uses
      }
    };

   
    const baseLevel = spell.system.level?.value ?? 1;
    if (rank > baseLevel) {
      spell.system.location.heightenedLevel = rank;
    }

    
    spell.system.level.value = baseLevel;

    allSpells.push(spell);
  }

  return allSpells;
}
async parseFocusSpellBlock(structuredText, creatureData) {
  if (!structuredText?.trim()) return [];

  const lines = structuredText.split("\n").map(l => l.trim()).filter(Boolean);
  const compendiumSpells = game.packs.get("pf2e.spells-srd");
  const index = await compendiumSpells.getIndex();
  const allSpells = [];

  let currentEntry = null;
  let section = null;

  const abilityMap = {
    strength: "str", dexterity: "dex", constitution: "con",
    intelligence: "int", wisdom: "wis", charisma: "cha"
  };

  const parseHeader = (line) => {
    const [typeRaw, traditionRaw, abilityRaw, ...extras] = line.split(",").map(s => s.trim().toLowerCase());
    if (typeRaw !== "focus") return null;

    const ability = abilityMap[abilityRaw] || abilityRaw;
    const tradition = traditionRaw;

    let spellDC = 10;
    let spellAttack = 0;
    let maxFocusPoints = 1;

    for (const part of extras) {
      const dcMatch = part.match(/spelldc[:=]?\s*(\d+)/i);
      const atkMatch = part.match(/spellattack[:=]?\s*([+-]?\d+)/i);
      const focusMatch = part.match(/(?:focuspoints|points)[:=]?\s*(\d+)/i);


      if (dcMatch) spellDC = Number(dcMatch[1]);
      if (atkMatch) spellAttack = Number(atkMatch[1]);
      if (focusMatch) maxFocusPoints = Number(focusMatch[1]);
    }

   
    creatureData.system = creatureData.system || {};
    creatureData.system.resources = creatureData.system.resources || {};
    creatureData.system.resources.focus = {
      value: maxFocusPoints,
      max: maxFocusPoints
    };

    const system = {
      ability: { value: ability },
      spelldc: { value: spellAttack, dc: spellDC },
      tradition: { value: tradition },
      prepared: { value: "focus", flexible: false },
      showSlotlessLevels: { value: false },
      proficiency: { value: 1 },
      slots: {}
    };

    const entry = {
      _id: foundry.utils.randomID(),
      name: `Focus Spells`,
      type: "spellcastingEntry",
      img: "icons/magic/symbols/star-circle-blue.webp",
      system
    };

    creatureData.items.push(entry);
    return entry;
  };

  for (const line of lines) {
    if (/^focus/i.test(line)) {
      currentEntry = parseHeader(line);
      section = null;
      continue;
    }

    if (/^spellslot/i.test(line)) {
      section = "spellslot";
      continue;
    }

    if (section === "spellslot" && currentEntry) {
      const spellName = line.replace(/^\d+\s+/, "").trim(); 
      const compendiumEntry = index.find(e => e.name.toLowerCase() === spellName.toLowerCase());
      if (!compendiumEntry) continue;

      const doc = await compendiumSpells.getDocument(compendiumEntry._id);
      const spell = doc.toObject();
      spell._id = foundry.utils.randomID();

  
      spell.system.location = {
        value: currentEntry._id
      };

      allSpells.push(spell);
    }
  }

  return allSpells;
}
async parseRitualSpellsBlock(sectionRaw, creatureData) {
  if (!sectionRaw) return [];

  const lines = sectionRaw.split("\n").map(l => l.trim()).filter(Boolean);
  const rituals = [];

  const spellPack = game.packs.get("pf2e.spells-srd");
  if (!spellPack) {
    ui.notifications.warn("⚠️ Spell compendium not found.");
    return [];
  }
  const spellIndex = await spellPack.getIndex();

  for (const line of lines) {
    if (line.toLowerCase() === "ritual" || line.startsWith("===")) continue;

    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      console.warn("⚠️ Ritual line could not be parsed:", line);
      continue;
    }

    const level = parseInt(match[1], 10);
    const name = match[2].trim();

    const entry = spellIndex.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!entry) {
      console.warn("⚠️ Ritual not found in compendium:", name);
      continue;
    }

    const ritualDoc = await spellPack.getDocument(entry._id);
    if (!ritualDoc) continue;

    const ritualClone = ritualDoc.toObject();
    ritualClone.system.location = {
      value: {
        signature: false,
        prepared: true,
        rank: level
      }
    };

   
    ritualClone.system.location.key = "ritual";
    ritualClone.type = "spell"; 

    rituals.push(ritualClone);
  }

  return rituals;
}


async parseStructuredSpellBlock(structuredText, creatureData) {
  if (!structuredText?.trim()) return [];

  const abilityMap = {
    strength: "str", dexterity: "dex", constitution: "con",
    intelligence: "int", wisdom: "wis", charisma: "cha"
  };

  const compendiumSpells = game.packs.get("pf2e.spells-srd");
  const index = await compendiumSpells.getIndex();
  const allSpells = [];
  const spellIdMap = new Map();

  const lines = structuredText.split("\n").map(l => l.trim()).filter(Boolean);

  let currentEntry = null;
  let spellSection = null;
  let currentRank = null;

 const parseHeader = (line) => {
  const [typeRaw, traditionRaw, abilityRaw, ...slotParts] = line.split(",").map(s => s.trim().toLowerCase());
  if (typeRaw !== "prepared") return null;

  const ability = abilityMap[abilityRaw] || abilityRaw;
  const tradition = traditionRaw;

  const slots = {};
  let spellDC = 10;
  let spellAttack = 0;

  for (const part of slotParts.map(p => p.trim())) {
    const slotMatch = part.match(/(\d+)\s+rank\s+(\d+)|(\d+)\s+rank|(\d+)\s+cantrip/i);
    if (slotMatch) {
      const [, count1, rank1, rankAlt, cantripCount] = slotMatch;
      const count = parseInt(count1 || cantripCount);
      const rank = rank1 || rankAlt || (cantripCount ? 0 : null);
      if (rank !== null) {
        const slotKey = `slot${rank}`;
        slots[slotKey] = {
          prepared: {},
          value: {},
          max: count
        };
      }
      continue;
    }

    const dcMatch = part.match(/spelldc[:=]?\s*(\d+)/i);
    if (dcMatch) {
      spellDC = Number(dcMatch[1]);
      continue;
    }

    const atkMatch = part.match(/spellattack[:=]?\s*([+-]?\d+)/i);

    if (atkMatch) {
      spellAttack = Number(atkMatch[1]);
      continue;
    }
  }

  if (!slots.slot0) {
    slots.slot0 = { prepared: {}, value: {}, max: 5 };
  }

const system = {
  ability: { value: ability },
  spelldc: {
    dc: spellDC,
    value: spellAttack  
  },
  tradition: { value: tradition },
  prepared: { value: "prepared", flexible: false },
  showSlotlessLevels: { value: false },
  proficiency: { value: 1 },
  slots
};


  const entry = {
    _id: foundry.utils.randomID(),
    name: `Prepared Spells`,
    type: "spellcastingEntry",
    img: "icons/magic/symbols/question-stone-yellow.webp",
    system
  };

  creatureData.items.push(entry);
  return entry;
};



  for (let line of lines) {
    if (/^prepared/i.test(line)) {
      currentEntry = parseHeader(line);
      spellSection = null;
      currentRank = null;
      continue;
    }

    if (/^spellbook/i.test(line)) {
      spellSection = "spellbook";
      continue;
    }

    if (/^spellslot/i.test(line)) {
      spellSection = "spellslot";
      continue;
    }

    if (!currentEntry) continue;

    if (spellSection === "spellbook") {
      const name = line;
      const match = index.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (!match) continue;

      const doc = await compendiumSpells.getDocument(match._id);
      const spell = doc.toObject();
      
      spell._id = foundry.utils.randomID();
      spell.system.location = { value: currentEntry._id };
      allSpells.push(spell);

    
      for (let i = 0; i <= 9; i++) {
        spellIdMap.set(`${currentEntry._id}:${name.toLowerCase()}:${i}`, spell._id);
      }
      continue;
    }

    if (spellSection === "spellslot") {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) continue;
      const [ , rankStr, name ] = match;
      const rank = parseInt(rankStr);
      const rankKey = `slot${rank}`;

      const spellId = spellIdMap.get(`${currentEntry._id}:${name.toLowerCase()}:${rank}`);
      if (!spellId) continue;

      const slot = currentEntry.system.slots[rankKey];
      if (!slot) continue;

      const indexInSlot = Object.keys(slot.prepared).length;
      slot.prepared[indexInSlot] = { id: spellId, expended: false };
    }
  }

  return allSpells;
}
async replaceSpellTags(description, spellIndex, spellPack) {
  const pattern = /#Spell\[(.*?)\]/g;

  const matches = [...description.matchAll(pattern)];
  for (const match of matches) {
    const name = match[1].trim();
    const found = spellIndex.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (found) {
      const uuidTag = `@UUID[Compendium.${spellPack.collection}.Item.${found._id}]{${found.name}}`;
      description = description.replace(match[0], uuidTag);
    } else {
      console.warn(`⚠️ Could not resolve spell name '${name}'`);
    }
  }

  return description;
}
async applyRules(item, rulesInput) {

  if (!rulesInput) return;

  item.system.rules ??= [];

  try {
    let parsed;

 
    if (typeof rulesInput === "string") {
      const trimmed = rulesInput.trim();

      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        parsed = JSON.parse(trimmed);
      } else {
       
        const lines = trimmed.split("\n").map(line => line.trim()).filter(Boolean);
        const jsonLines = lines.filter(line => line.startsWith("{") && line.endsWith("}"));
        if (!jsonLines.length) throw new Error("No valid rule objects found.");
        parsed = JSON.parse(`[${jsonLines.join(",")}]`);
      }
    } else if (Array.isArray(rulesInput)) {
      parsed = rulesInput;
    } else {
      console.warn("⚠️ Invalid rules format received.");
      return;
    }

 
    for (const rule of parsed) {
      if (typeof rule === "object" && rule !== null && "key" in rule) {
        item.system.rules.push(rule);
      } else {
        console.warn("⚠️ Skipped invalid rule object:", rule);
      }
    }

    console.log("✅ Final applied rules:", item.system.rules);
  } catch (err) {
    console.error("❌ Failed to parse rule input:", err);
  }
}
async extractDescriptionAndRules(params) {
  if (!params.description || typeof params.description !== "string") return;

  const ruleMarker = "|rules:";
  const index = params.description.indexOf(ruleMarker);

  if (index !== -1) {
    const descPart = params.description.slice(0, index).trim();
    const rulesPartRaw = params.description.slice(index + ruleMarker.length).trim();
    params.description = descPart;

    try {
      params.rules = JSON.parse(rulesPartRaw);
    } catch (err) {
      console.warn("⚠️ Failed to parse extracted rules:", rulesPartRaw);
    }
  }
}
async replaceConditionTags(description) {
  const conditionPack = game.packs.get("pf2e.conditionitems");
  if (!conditionPack) {
    console.warn("⚠️ Cannot find condition compendium: pf2e.conditionitems");
    return description;
  }

  const index = await conditionPack.getIndex();
  const conditionMap = new Map();


  for (const entry of index) {
    conditionMap.set(entry.name.toLowerCase(), { id: entry._id, name: entry.name });
  }

  const pattern = /#Condition\[([\w\s-]+)(?:\|(\d+))?\]/gi;



  const matches = [...description.matchAll(pattern)];
  for (const match of matches) {
    const name = match[1].toLowerCase();
    const value = match[2];
    const condition = conditionMap.get(name);
    if (condition) {
      const display = value ? `${condition.name} ${value}` : condition.name;
      const uuidTag = `@UUID[Compendium.pf2e.conditionitems.Item.${condition.id}]{${display}}`;
      description = description.replace(match[0], uuidTag);
    } else {
      console.warn(`⚠️ Could not resolve condition name '${name}'`);
    }
  }

  return description;
}
async parseEquipment(equipmentRaw) {
  if (!equipmentRaw || typeof equipmentRaw !== "string") return [];

  const lines = equipmentRaw.split("\n").map(l => l.trim()).filter(Boolean);

  const weaponLines = [];
  const armorLines = [];
  const equipmentLines = [];
  const consumableLines = [];
  const treasureLines = [];
  const containerLines = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("weapon |")) {
      weaponLines.push(line);
    } else if (lower.startsWith("armor |")) {
      armorLines.push(line);
    } else if (lower.startsWith("equipment |")) {
      equipmentLines.push(line);
    } else if (lower.startsWith("consumable |")) {
      consumableLines.push(line);
    } else if (lower.startsWith("treasure |")) {
      treasureLines.push(line);
    } else if (lower.startsWith("container |")) {
      containerLines.push(line);
    }
  }

  const weapons = await this.parseWeapons(weaponLines.join("\n"));
  const armor = await this.parseArmor(armorLines.join("\n"));
  const equipment = await this.parseEquipmentItems(equipmentLines.join("\n"));
  const consumables = await this.parseConsumables(consumableLines.join("\n"));
  const treasure = await this.parseTreasure(treasureLines.join("\n"));
  const containers = await this.parseContainers(containerLines.join("\n"));

  console.log("🧪 weapons result:", weapons);
  console.log("🧪 armor result:", armor);
  console.log("🧪 equipment result:", equipment);
  console.log("🧪 consumables result:", consumables);
  console.log("🧪 treasure result:", treasure);
  console.log("🧪 containers result:", containers);

  return [...weapons, ...armor, ...equipment, ...consumables, ...treasure, ...containers];
}
async parseWeapons(equipmentRaw) {
  if (!equipmentRaw?.trim()) return [];

  const equipment = [];
  const lines = equipmentRaw.split("\n").map(line => line.trim()).filter(Boolean);

  const equipPack = game.packs.get("pf2e.equipment-srd");
  const spellPack = game.packs.get("pf2e.spells-srd");

  if (!equipPack || !spellPack) {
    ui.notifications.error("❌ Required compendiums not found.");
    return [];
  }

  const equipIndex = await equipPack.getIndex();
  const spellIndex = await spellPack.getIndex();

  for (const raw of lines) {
    if (!raw.toLowerCase().startsWith("weapon |")) continue;

    let line = raw.replace(/^weapon\s*\|/i, "").trim();
    let rulesBlock = null;


 let rulesRaw = null;
let rulesLines = [];


const ruleStartIndex = lines.findIndex(line => line.trim().toLowerCase().startsWith("rules:"));
if (ruleStartIndex !== -1) {
  rulesLines = lines.slice(ruleStartIndex);
  lines.splice(ruleStartIndex); 
  const raw = rulesLines.map(l => l.replace(/^rules:\s*/i, "").trim()).join("");
  rulesRaw = raw;
}



    const parts = line.split("|").map(p => p.trim());
    const baseName = parts.shift() || "Unnamed Weapon"; 
    const params = {};
    let rulesString = null; 

    
    const lineWithoutBase = parts.join('|'); 
    const rulesMarker = "|rules:";
    const rulesIndex = lineWithoutBase.lastIndexOf(rulesMarker); 

    if (rulesIndex !== -1) {
        const potentialRules = lineWithoutBase.substring(rulesIndex + rulesMarker.length).trim();

        if (potentialRules.startsWith('[') || potentialRules.startsWith('{')) {
            rulesString = potentialRules;
         
            parts.splice(parts.indexOf(lineWithoutBase.substring(rulesIndex).trim())); 
             console.log(`Extracted rules for ${baseName}:`, rulesString);
        } else {
            console.log(`Found '|rules:' but content doesn't look like JSON for ${baseName}, treating as description.`);
        }
    }

   
    let descriptionValue = ''; 
    for (const part of parts) { 
        const colonIndex = part.indexOf(":");
        if (colonIndex === -1) {
            
            descriptionValue += (descriptionValue ? ' | ' : '') + part;
            console.warn(`Part without colon found for ${baseName}, appending to description: "${part}"`);
            continue;
        }

        const key = part.substring(0, colonIndex).trim().toLowerCase();
        const value = part.substring(colonIndex + 1).trim();

        if (key === "description") {
          
            descriptionValue += (descriptionValue ? ' | ' : '') + value;
            
            const currentIndex = parts.indexOf(part);
            for (let j = currentIndex + 1; j < parts.length; j++) {
                 if (!parts[j].includes(':')) {
                      descriptionValue += ' | ' + parts[j];
                 } else {
                      break; 
                 }
            }
             params.description = descriptionValue;
            
             break; 

        } else {
            
            params[key] = value;
        }
    }

    if (!params.description && descriptionValue) {
        params.description = descriptionValue;
    }
   
    let parsedRules = []; 
    if (rulesString) {
      try {
        parsedRules = JSON.parse(rulesString);
        
        if (!Array.isArray(parsedRules)) {
          parsedRules = [parsedRules];
        }
        console.log(`Successfully parsed rules for ${baseName}:`, parsedRules);
      } catch (e) {
        console.warn(`Failed to parse rules JSON for ${baseName}: "${rulesString}". Error: ${e.message}`);
       
      }
    }
   
    params.rules = parsedRules;


    const baseMatch = equipIndex.find(e =>
      e.name.toLowerCase() === baseName.toLowerCase() ||
      e.slug?.toLowerCase() === baseName.toLowerCase().replace(/\s+/g, "-")
    );

    if (!baseMatch) {
      console.warn(`⚠️ No compendium weapon found for "${baseName}"`);
      continue;
    }

    const baseDoc = await equipPack.getDocument(baseMatch._id);
    const item = baseDoc.toObject();
    item._id = foundry.utils.randomID();

    
    if (params.name) item.name = params.name;

if (params.quantity) {
  item.system.quantity = parseInt(params.quantity, 10);
} else {
  item.system.quantity = 1; 
}

function applyRunes(item, params) {

item.system.runes = {
  potency: 0,
  striking: 0,
  property: []
};


if (params.potency) {
  item.system.runes.potency = parseInt(params.potency);
}
if (params.striking) {
  item.system.runes.striking = parseInt(params.striking);
}


if (params.runes) {
const verifiedRunes = [
    "ancestralEchoing", "anchoring", "animated", "ashen", "astral", "authorized", "bane", "bloodbane", 
    "bloodthirsty", "brilliant", "called", "coating", "conducting", "corrosive", "crushing", "cunning", 
    "deathdrinking", "decaying", "demolishing", "earthbinding", "energizing", "extending", "fanged", 
    "fearsome", "flaming", "flickering", "flurrying", "frost", "ghostTouch", "giantKilling", 
    "greaterAnchoring", "greaterAshen", "greaterAstral", "greaterBloodbane", "greaterBrilliant", 
    "greaterCorrosive", "greaterCrushing", "greaterDecaying", "greaterExtending", "greaterFanged", 
    "greaterFearsome", "greaterFlaming", "greaterFrost", "greaterGiantKilling", "greaterHauling", 
    "greaterImpactful", "greaterRooting", "greaterShock", "greaterThundering", "greaterVitalizing", 
    "grievous", "hauling", "holy", "hooked", "hopeful", "impactful", "impossible", "keen", "kinWarding", 
    "majorFanged", "majorRooting", "merciful", "nightmare", "pacifying", "quickstrike", "returning", 
    "rooting", "serrating", "shifting", "shock", "shockwave", "spellReservoir", "swarming", 
    "thundering", "trueRooting", "underwater", "unholy", "vitalizing", "vorpal", "wounding"
];

  const runeSlugs = params.runes
    .split(",")
    .map(r => r.trim())
    .filter(Boolean);

  const matched = runeSlugs.filter(slug => {
    const isValid = verifiedRunes.includes(slug);
    if (!isValid) console.warn(`⚠️ Unknown rune ignored: '${slug}'`);
    return isValid;
  });

item.system.runes.property = matched;


  console.log("✅ Runes to apply:", matched);
  console.log("✅ Final runes object:", item.system.runes);
}
}
applyRunes(item, params);
  function applyWeaponTraits(item, params) {
    if (params.traits) {
      const traits = params.traits.split(",").map(t => t.trim().toLowerCase());
      item.system.traits ??= {};
      item.system.traits.value ??= [];
      item.system.traits.value.push(...traits);
    }}
    applyWeaponTraits(item, params);
function applyMaterialType() {
const validMaterialTypes = new Set([
  "abysium-standard", "abysium-high",
  "adamantine-standard", "adamantine-high",
  "cold-iron-low", "cold-iron-standard", "cold-iron-high",
  "dawnsilver-standard", "dawnsilver-high",
  "djezet-standard", "djezet-high",
  "duskwood-standard", "duskwood-high",
  "inubrix-standard", "inubrix-high",
  "keep-stone-high",
  "noqual-standard", "noqual-high",
  "orichalcum-high",
  "peachwood-standard", "peachwood-high",
  "siccatite-standard", "siccatite-high",
  "silver-low", "silver-standard", "silver-high",
  "sisterstone-dusk-low", "sisterstone-dusk-standard", "sisterstone-dusk-high",
  "sisterstone-scarlet-low", "sisterstone-scarlet-standard", "sisterstone-scarlet-high",
  "sloughstone-standard", "sloughstone-high",
  "sovereign-steel-standard", "sovereign-steel-high",
  "warpglass-high"
]);


if (params.material) {
  const clean = params.material
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[()]/g, ""); 

  if (validMaterialTypes.has(clean)) {
    const [type, grade] = clean.split("-");
    item.system.material = { type, grade };

    item.system.traits.otherTags ??= [];
    item.system.traits.otherTags.push(`${type}-${grade}`);
    console.log(`✅ Material applied: ${type}-${grade}`);
  } else {
    console.warn(`⚠️ Invalid material skipped: '${params.material}'`);
  }

    }}
    applyMaterialType();
async function applyWeaponDescription(item, params, spellIndex, spellPack) {
  if (params.description) {
    const rawHTML = params.description.trim();
    const withSpells = await this.replaceSpellTags(rawHTML, spellIndex, spellPack);
    const fullHTML = await this.replaceConditionTags(withSpells);
    item.system.description = {
      value: `<div class="foundry-description">${fullHTML}</div>`,
      gm: ""
    };
  }
}

if (params.description && typeof params.description === "string") {
  const ruleMarker = "|rules:";

  const index = params.description.indexOf(ruleMarker);
  if (index !== -1) {
    const descPart = params.description.slice(0, index).trim();
    const rulesPart = params.description.slice(index + ruleMarker.length).trim();

    params.description = descPart;
    try {
      params.rules = JSON.parse(rulesPart);
    } catch (err) {
      console.warn("⚠️ Failed to parse extracted rules:", rulesPart);
    }
  }
}



await applyWeaponDescription.call(this, item, params, spellIndex, spellPack);

if (rulesRaw) {
  try {
    params.rules = JSON.parse(rulesRaw);
  } catch (err) {
    console.warn("⚠️ Could not parse multiline rules JSON:", rulesRaw);
  }
}

await this.applyRules(item, params.rules);
console.log("🔍 Raw rules (parsed from inline or block):", params.rules);



    equipment.push(item);
  }

  return equipment;
}
async buildManualArmor({ name, base, traits = "", description = "" }) {
  const safeName = name?.trim() || "Unnamed Armor";
  const slug = safeName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/gi, "");

  
  const traitList = Array.isArray(traits)
    ? traits.map(t => t.trim()).filter(Boolean)
    : String(traits).split(",").map(t => t.trim()).filter(Boolean);

  return {
    name: safeName,
    type: "armor",
    img: "icons/equipment/chest/shirt-collared-pink.webp",
    folder: null,
    _id: foundry.utils.randomID(),
    flags: {},
    effects: [],
    system: {
      baseItem: base || null,
      slug,
      category: "unarmored",    
      group: "cloth",           
      size: "med",
      acBonus: 0,
      dexCap: 5,
      strength: null,
      checkPenalty: 0,
      speedPenalty: 0,
      bulk: { value: 1 },
      quantity: 1,
      price: { value: { gp: 1 } },
      hp: { value: 0, max: 0 },
      hardness: 0,
      runes: {
        potency: 0,
        resilient: 0,
        property: []
      },
      traits: {
        value: traitList,
        rarity: "common",
        otherTags: []
      },
      description: {
        value: description?.trim()
          ? `<p>${description.trim()}</p>`
          : "<p>No description provided.</p>",
        gm: ""
      },
      equipped: {
        carryType: "worn",
        invested: null
      },
      identification: {
        status: "identified",
        unidentified: {
          name: `Unusual ${safeName}`,
          img: "systems/pf2e/icons/unidentified_item_icons/armor.webp",
          data: { description: { value: "" } }
        },
        misidentified: {}
      },
      material: {
        type: null,
        grade: null
      },
      containerId: null,
      publication: {
        title: "",
        authors: "",
        license: "",
        remaster: false
      },
      specific: null,
      subitems: []
    }
  };
}

async parseArmor(armorRaw) {
  if (!armorRaw?.trim()) return [];

  const armorPack = game.packs.get("pf2e.equipment-srd");
  const spellPack = game.packs.get("pf2e.spells-srd");
  if (!armorPack || !spellPack) {
    ui.notifications.error("❌ Required compendiums not found.");
    return [];
  }

  const armorIndex = await armorPack.getIndex();
  const spellIndex = await spellPack.getIndex();


const validRunes = new Set([
  "acidResistant", "advancing", "aimAiding", "antimagic", "assisting", "bitter",
  "coldResistant", "deathless", "electricityResistant", "energyAdaptive", "ethereal",
  "fireResistant", "fortification", "glamered", "gliding",
  "greaterAcidResistant", "greaterAdvancing", "greaterColdResistant", "greaterDread",
  "greaterFireResistant", "greaterFortification", "greaterInvisibility", "greaterQuenching",
  "greaterReady", "greaterShadow", "greaterSlick", "greaterStanching", 
  "greaterSwallowSpike", "greaterWinged",
  "immovable", "implacable", "invisibility", "lesserDread", "magnetizing",
  "majorQuenching", "majorShadow", "majorSlick", "majorStanching", "majorSwallowSpike",
  "malleable", "misleading", "moderateDread", "portable", "quenching", "raiment",
  "ready", "rockBraced", "shadow", "sinisterKnight", "sizeChanging", "slick",
  "soaring", "stanching", "swallowSpike", "trueQuenching", "trueStanching", "winged"
]);

  const entries = armorRaw.split("\n").map(l => l.trim()).filter(Boolean);
  const output = [];

  for (let raw of entries) {
    if (!raw.toLowerCase().startsWith("armor |")) continue;

   
    raw = raw.replace(/^armor\s*\|/i, "").trim();

    
    const parts = raw.split("|").map(p => p.trim());
    const displayName = parts.shift(); 

const params = {};
    let descriptionValue = null;
    let rulesValue = null;

   
    const originalLineWithoutType = raw.replace(/^armor\s*\|/i, "").trim();

    for (const part of parts) { 
        const colonIndex = part.indexOf(":");
        if (colonIndex === -1) {
            console.warn(`Skipping malformed part (no colon): "${part}" in line "${raw}"`);
            continue;
        }

        const key = part.substring(0, colonIndex).trim().toLowerCase();
        const value = part.substring(colonIndex + 1).trim();

        
        if (key === "description") {
           
            const descMarker = `description:`;
           
            const descStartIndex = originalLineWithoutType.indexOf(descMarker, (displayName ? displayName.length : 0));

            if (descStartIndex !== -1) {
                let fullDescSegment = originalLineWithoutType.substring(descStartIndex + descMarker.length);

                
                const rulesMarker = "|rules:";
               
                let rulesIndex = fullDescSegment.indexOf(rulesMarker);

                
                if (rulesIndex !== -1) {
                   
                   const potentialRules = fullDescSegment.substring(rulesIndex + rulesMarker.length).trim();
                   if (potentialRules.startsWith('[') || potentialRules.startsWith('{')) {
                      
                      descriptionValue = fullDescSegment.substring(0, rulesIndex).trim();
                      rulesValue = potentialRules; 
                      console.log(`Extracted rules from description suffix for ${displayName}:`, rulesValue);
                   } else {
                      
                      descriptionValue = fullDescSegment.trim();
                      rulesIndex = -1; 
                      console.log(`'|rules:' found but not valid JSON, treating as description for ${displayName}`);
                   }
                } else {
                    
                    descriptionValue = fullDescSegment.trim();
                }
            } else {
                console.warn(`Could not find 'description:' marker accurately for ${displayName}, using fallback.`);
                descriptionValue = value; 
            }
           
            params.description = descriptionValue;

        } else if (key === "rules") {
            
            if (rulesValue === null) {
                rulesValue = value;
                params.rules = rulesValue; 
                console.log(`Found dedicated |rules: field for ${displayName}`);
            } else {
                 console.log(`Skipping dedicated |rules: field as rules were already extracted from description suffix for ${displayName}`);
            }
        } else {
            
            params[key] = value;
        }
    } 

    
    if (rulesValue !== null) {
      try {
        const parsedRules = JSON.parse(rulesValue);
        params.rules = Array.isArray(parsedRules) ? parsedRules : [parsedRules];
        console.log(`Successfully parsed rules for ${displayName}:`, params.rules);
      } catch (e) {
        console.warn(`Failed to parse rules JSON for ${displayName}: "${rulesValue}". Error: ${e.message}`);
        params.rules = [];
      }
    } else {
         params.rules = [];
    }


    const rawBase = params.base ?? "";
    const baseSlug = rawBase.toLowerCase().replace(/\s+/g, "-");


    let traitsArr = [];
    if (params.traits) {
      traitsArr = params.traits.split(",").map(t => t.trim()).filter(Boolean);
    }

   
    let materialType, materialGrade;
    if (params.material) {
      const mat = params.material.trim().toLowerCase().replace(/[()]/g, "").replace(/\s+/g, "-");
      [materialType, materialGrade] = mat.split("-");
    }

   
    const potency = params.potency ? parseInt(params.potency, 10) || 0 : 0;
    const resilient = params.resilient ? parseInt(params.resilient, 10) || 0 : 0;

  
    let propRunes = [];
    if (params.runes) {
      propRunes = params.runes
        .split(",")
        .map(r => r.trim())
        .filter(Boolean)
        .map(r => r.replace(/[-\s]/g, ""))        
        .map(r => r.charAt(0).toLowerCase() + r.slice(1)) 
        .filter(slug => {
          if (!validRunes.has(slug)) {
            console.warn(`⚠️ Invalid armor rune: '${slug}'`);
            return false;
          }
          return true;
        });
    }

  
    let rulesParam = [];
    if (params.rules) {
      try {
        rulesParam = JSON.parse(params.rules);
      } catch (err) {
        console.warn("⚠️ Failed to parse armor rules JSON:", params.rules, err);
      }
    }

    
    let match = null;
    if (baseSlug) {
      match = armorIndex.find(e => e.slug === baseSlug);
    }
    if (!match) {
      const nameSlug = displayName.toLowerCase().replace(/\s+/g, "-");
      match = armorIndex.find(e =>
        e.slug === nameSlug || e.name.toLowerCase() === displayName.toLowerCase()
      );
    }

    let item;
    if (!match) {
      console.warn(
        `⚠️ No armor item found for base '${rawBase}' or name '${displayName}'. Using manual armor builder.`
      );
      item = await this.buildManualArmor({
        name: displayName,
        base: rawBase,
        traits: traitsArr,
        description: params.description ?? ""
      });
} else {
      const baseDoc = await armorPack.getDocument(match._id);
      item = baseDoc.toObject();
      item._id = foundry.utils.randomID();

    
      if (params.name) {
        item.name = params.name;
      } else if (displayName !== match.name) {
        item.name = displayName;
      }
    }

 

    
    if (params.category) item.system.category = params.category;
    if (params.group) item.system.group = params.group;
    if (params.size) item.system.size = params.size;

if (params.quantity) {
  item.system.quantity = parseInt(params.quantity, 10);
} else {
  item.system.quantity = 1;
}
if (params.bulk) {
  const bulkRaw = params.bulk.trim().toLowerCase();
  let value;

  if (["l", "light"].includes(bulkRaw)) {
    value = "L";
  } else if (["neg", "negligible", "0", "none", "—"].includes(bulkRaw)) {
    value = "—";
  } else if (!isNaN(bulkRaw)) {
    value = parseInt(bulkRaw, 10);
  } else {
    value = bulkRaw;
  }

  
  item.system.weight = { value, heldOrStowed: null };
}







    if (params.price) {
      
      item.system.price ??= {};
      item.system.price.value = params.price;
    }

  
    if (materialType && materialGrade) {
      item.system.material = { type: materialType, grade: materialGrade };
      item.system.traits ??= {};
      item.system.traits.otherTags ??= [];
      item.system.traits.otherTags.push(`${materialType}-${materialGrade}`);
    }

    
    item.system.runes ??= { potency: 0, resilient: 0, property: [] };
    if (potency) item.system.runes.potency = potency;
    if (resilient) item.system.runes.resilient = resilient;

    if (propRunes.length) {
      const filled = propRunes.slice(0, 4);
      while (filled.length < 4) filled.push(null);
      item.system.runes.property = filled;
    }

    
    if (traitsArr.length) {
      item.system.traits ??= {};
      item.system.traits.value ??= [];
      const existing = new Set(item.system.traits.value);
      for (const t of traitsArr) existing.add(t);
      item.system.traits.value = Array.from(existing);
    }


    if (params.description && typeof params.description === "string") {
      const ruleMarker = "|rules:";
      const idx = params.description.indexOf(ruleMarker);
      if (idx !== -1 && !params.rules) {
        const descPart = params.description.slice(0, idx).trim();
        const rulesPart = params.description.slice(idx + ruleMarker.length).trim();
        params.description = descPart;
        try {
          rulesParam = JSON.parse(rulesPart);
        } catch (err) {
          console.warn("⚠️ Failed fallback parse of rules from description:", rulesPart);
        }
      }
    }


    if (params.rules && !Array.isArray(params.rules)) {
      params.rules = [params.rules];
    }
    if (Array.isArray(params.rules) && params.rules.length) {
      rulesParam = rulesParam.concat(params.rules);
    }

    if (typeof this.applyArmorDescription === "function") {
      await this.applyArmorDescription(item, params, spellIndex, spellPack);
    } else if (typeof applyArmorDescription === "function") {
      await applyArmorDescription.call(this, item, params, spellIndex, spellPack);
    } else {

      if (params.description) {
        item.system.description ??= {};
        item.system.description.value = `<p>${params.description}</p>`;
      }
    }

    
    if (rulesParam?.length) {
      await this.applyRules(item, rulesParam);
    }

    output.push(item);
  }

  return output;
}
async findItemBySlug(params, pack) {
  if (!params?.slug || !pack) {
    console.warn("⚠️ Missing slug or compendium pack.");
    return null;
  }

  console.log("🔍 Looking for slug:", params.slug);
  console.log("📦 Searching in pack:", pack.collection);

  const index = await pack.getIndex();
  const slugs = index.map(i => i.slug).filter(Boolean);
  console.log("📚 Indexed slugs:", slugs);

  let match = index.find(i => i.slug === params.slug);

  if (!match) {
    console.warn(`❌ No match by slug: '${params.slug}', trying name '${params.name}'...`);
    match = index.find(i => i.name === params.name);
    if (!match) {
      console.warn(`❌ No match by name: '${params.name}' either.`);
      return null;
    }
  }

  console.log("✅ Match found:", match);
  const document = await pack.getDocument(match._id);
  return document;
}
async tryFindItemImage(name) {
  const fallbackImage = "systems/pf2e/icons/default-icons/equipment.svg";


  const pack = game.packs.get("pf2e.equipment-srd");
  if (!pack) return fallbackImage;

  const index = await pack.getIndex();
  const match = Array.from(index.values()).find(i => i.name?.toLowerCase().includes(name.toLowerCase()));
  return match?.img || fallbackImage;
}
async parseEquipmentItems(equipmentRaw) {
  console.log("🔍 Starting parseEquipmentItems");

  const lines = equipmentRaw.split("\n").map(l => l.trim()).filter(Boolean);
  const results = [];

  const pack = game.packs.get("pf2e.equipment-srd");
  if (!pack) {
    console.error("❌ Equipment compendium not found.");
    return results;
  }

  const index = await pack.getIndex();
  const allItems = Array.from(index.values());
  console.log(`📦 Loaded ${allItems.length} equipment items from compendium`);

  for (const line of lines) {
    const parts = line.split("|").map(p => p.trim());

    const getValue = (prefix) => {
      const match = parts.find(p => p.startsWith(prefix + ":"));
      return match ? match.split(":").slice(1).join(":").trim() : "";
    };

const name = parts[1] || "Unnamed";
    const base = getValue("base") || "unknown"; 
    const sourceid = getValue("sourceid") || "unknown"; 
    const uuid = getValue("uuid") || "unknown"; 
    const slug = getValue("slug") || ""; 
    const quantity = parseInt(getValue("quantity") || "1", 10); 
    const price = getValue("price") || ""; 
    let bulk = getValue("bulk") || ""; 
    const img = getValue("img") || await this.tryFindItemImage(name); 
   
    const usage = getValue("usage") || ""; 

    let descriptionValue = null;
    let rulesValue = null;

    const originalLineWithoutType = line.replace(/^equipment\s*\|/i, "").trim();

    let firstParamIndex = originalLineWithoutType.indexOf(parts[1]) + parts[1].length; 
    const remainingLine = originalLineWithoutType.substring(firstParamIndex).trim().startsWith('|')
                        ? originalLineWithoutType.substring(firstParamIndex).trim().substring(1).trim()
                        : originalLineWithoutType.substring(firstParamIndex).trim(); 


    const rulesMarker = "|rules:";
    const rulesIndex = remainingLine.lastIndexOf(rulesMarker); 

    let lineToParseForKeyValues = remainingLine; 

    if (rulesIndex !== -1) {
        const potentialRules = remainingLine.substring(rulesIndex + rulesMarker.length).trim();
        
        if (potentialRules.startsWith('[') || potentialRules.startsWith('{')) {
            rulesValue = potentialRules;
         
            lineToParseForKeyValues = remainingLine.substring(0, rulesIndex).trim();
            console.log(`Extracted rules for ${name}:`, rulesValue);
        } else {
             console.log(`Found '|rules:' but content doesn't look like JSON for ${name}, treating as description.`);
        }
    }

  
    const paramsTemp = {}; 
    let descAccumulator = ''; 
    let foundDescKey = false;
    const remainingPartsForKeyValues = lineToParseForKeyValues.split('|').map(p => p.trim()).filter(Boolean);


    remainingPartsForKeyValues.forEach(part => {
        const colonIndex = part.indexOf(":");
        if (colonIndex === -1) {
             if (foundDescKey || Object.keys(paramsTemp).length === 0) {
                 descAccumulator += (descAccumulator ? ' | ' : '') + part;
             } else {
                  console.warn(`Part without colon ignored for ${name}: "${part}"`);
             }
            return;
        }

        const key = part.substring(0, colonIndex).trim().toLowerCase();
        const value = part.substring(colonIndex + 1).trim();

        if (key === "description") {
            descAccumulator += (descAccumulator ? ' | ' : '') + value; 
            foundDescKey = true;
        } else if (foundDescKey) {
          
             if (!part.includes(':') || part.split(':').length < 2) {
                 descAccumulator += ' | ' + part;
             } else {
               
                 paramsTemp[key] = value; 
                 foundDescKey = false; 
             }
        } else if (key !== "rules") { 
            paramsTemp[key] = value; 
        }
    });

    descriptionValue = descAccumulator || paramsTemp.description || null; 
    

    
    if (bulk.toLowerCase() === "l") bulk = "0";
    if (isNaN(parseFloat(bulk)) && bulk !== "") bulk = "";

   
    let rules = [];
    if (rulesRaw) {
      try {
        rules = JSON.parse(rulesRaw);
        if (!Array.isArray(rules)) rules = [];
      } catch (e) {
        console.warn(`⚠️ Failed to parse rules JSON for ${name}:`, e);
        rules = [];
      }
    }

    console.log(`🔎 Looking up equipment: ${name} (slug: ${slug})`);

    let item = allItems.find(i => i.name?.toLowerCase() === name.toLowerCase());
    if (!item && slug) {
      item = allItems.find(i => i.slug === slug);
      if (item) console.log(`✅ Found by slug: ${slug}`);
    }

    if (item) {
      const fullItem = await pack.getDocument(item._id);
      const newItem = fullItem.toObject();

      newItem.system.quantity = quantity;
      newItem.system.price.value = price;
      newItem.system.bulk.value = bulk;
      newItem.system.usage.value = usage;
      newItem.system.description.value = description || newItem.system.description.value;
      if (rules.length) newItem.system.rules = rules;
      newItem.img = img;

      results.push(newItem);
      console.log(`✅ Equipment item parsed: ${name}`);
    } else {
      console.warn(`⚠️ Could not match equipment: ${name}`);
      results.push({
        name: name,
        type: "equipment",
        img: img,
        system: {
          quantity,
          price: { value: price },
          bulk: { value: bulk },
          usage: { value: usage },
          description: { value: description },
          rules: rules,
        }
      });
    }
  }

  console.log(`✅ Finished parseEquipmentItems — ${results.length} item(s) created.`);
  return results;
}
async parseConsumables(consumablesRaw) {
  if (!consumablesRaw?.trim()) {
    console.warn("⚠️ No consumables input provided.");
    return [];
  }

  const itemPack = game.packs.get("pf2e.equipment-srd");
  const spellPack = game.packs.get("pf2e.spells-srd");

  if (!itemPack || !spellPack) {
    ui.notifications.error("❌ Required compendiums not found.");
    return [];
  }

  const itemIndex = await itemPack.getIndex();
  const spellIndex = await spellPack.getIndex();

  const lines = consumablesRaw.split("\n").map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const raw of lines) {
    if (!raw.toLowerCase().startsWith("consumable |")) continue;

    const line = raw.replace(/^consumable\s*\|/i, "").trim();
    const parts = line.split("|").map(p => p.trim());
    const baseName = parts[0];
const params = {};
    let descriptionValue = null;
    let rulesValue = null;

    
    const originalLineWithoutType = raw.replace(/^consumable\s*\|/i, "").trim();

    
    const remainingParts = originalLineWithoutType.split("|").map(p => p.trim()).slice(1); 
    const remainingLine = remainingParts.join('|');

   
    const rulesMarker = "|rules:";
    const rulesIndex = remainingLine.lastIndexOf(rulesMarker);
    let lineToParseForKeyValues = remainingLine;

    if (rulesIndex !== -1) {
        const potentialRules = remainingLine.substring(rulesIndex + rulesMarker.length).trim();
        if (potentialRules.startsWith('[') || potentialRules.startsWith('{')) {
            rulesValue = potentialRules;
            lineToParseForKeyValues = remainingLine.substring(0, rulesIndex).trim();
            console.log(`Extracted rules for ${baseName}:`, rulesValue);
        } else {
             console.log(`Found '|rules:' but content doesn't look like JSON for ${baseName}, treating as description.`);
        }
    }

    
    const paramsTemp = {}; 
    let descAccumulator = '';
    let foundDescKey = false;
    const remainingPartsForKeyValues = lineToParseForKeyValues.split('|').map(p => p.trim()).filter(Boolean);

    remainingPartsForKeyValues.forEach(part => {
        const colonIndex = part.indexOf(":");
        if (colonIndex === -1) {
             if (foundDescKey || Object.keys(paramsTemp).length === 0) {
                 descAccumulator += (descAccumulator ? ' | ' : '') + part;
             } else {
                  console.warn(`Part without colon ignored for ${baseName} (Consumable): "${part}"`);
             }
            return;
        }

        const key = part.substring(0, colonIndex).trim().toLowerCase();
        const value = part.substring(colonIndex + 1).trim();

        if (key === "description") {
            descAccumulator += (descAccumulator ? ' | ' : '') + value;
            foundDescKey = true;
        } else if (foundDescKey) {
             if (!part.includes(':') || part.split(':').length < 2) {
                 descAccumulator += ' | ' + part;
             } else {
                 paramsTemp[key] = value;
                 foundDescKey = false;
             }
        } else if (key !== "rules") {
            paramsTemp[key] = value;
        }
    });

    descriptionValue = descAccumulator || paramsTemp.description || null;
    
    params.description = descriptionValue;
   
    Object.assign(params, paramsTemp);

    let parsedRules = [];
    if (rulesValue) {
      try {
        parsedRules = JSON.parse(rulesValue);
        if (!Array.isArray(parsedRules)) parsedRules = [parsedRules];
        console.log(`Successfully parsed rules for ${baseName}:`, parsedRules);
      } catch (e) {
        console.warn(`⚠️ Failed to parse rules JSON for ${baseName}:`, e);
        parsedRules = [];
      }
    }
   
    params.rules = parsedRules;

    const baseMatch = itemIndex.find(i =>
      i.name.toLowerCase() === baseName.toLowerCase() ||
      i.slug?.toLowerCase() === baseName.toLowerCase().replace(/\s+/g, "-")
    );

    let baseItemDoc = null;
    if (baseMatch) {
      baseItemDoc = await itemPack.getDocument(baseMatch._id);
    } else {
      try {
        baseItemDoc = await fromUuid("Compendium.pf2e.equipment-srd.Item.R6r8zvVh5c1DPZWo"); 
        console.warn("⚠️ Using fallback consumable item template for:", baseName);
      } catch (err) {
        console.error("❌ Could not load fallback item template.", err);
        continue;
      }
    }

    if (!baseItemDoc) continue;

    const itemDoc = structuredClone(baseItemDoc.toObject ? baseItemDoc.toObject() : baseItemDoc);
    itemDoc._id = foundry.utils.randomID();

    if (params.name) itemDoc.name = params.name;

   
    if (params.quantity) itemDoc.system.quantity = parseInt(params.quantity, 10);

    const ruleMarker = "|rules:";
    if (params.description && typeof params.description === "string") {
      const index = params.description.indexOf(ruleMarker);
      if (index !== -1) {
        const descPart = params.description.slice(0, index).trim();
        const rulesPart = params.description.slice(index + ruleMarker.length).trim();
        params.description = descPart;
        try {
          params.rules = JSON.parse(rulesPart);
        } catch (err) {
          console.warn("⚠️ Failed to parse extracted rules:", rulesPart);
        }
      }
    }

    

    if (params.description) {
      const rawHTML = params.description.trim();
      const withSpells = await this.replaceSpellTags(rawHTML, spellIndex, spellPack);
      const fullHTML = await this.replaceConditionTags(withSpells);
      itemDoc.system.description = {
        value: `<div class=\"foundry-description\">${fullHTML}</div>`
      };
    }

    if (params.traits) {
      itemDoc.system.traits.value = params.traits.split(",").map(t => t.trim()).filter(Boolean);
    }

    if (params.price) {
      const match = params.price.trim().match(/^(\d+)\s*(cp|sp|gp|pp)$/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const denomination = match[2].toLowerCase();
        itemDoc.system.price.value = { [denomination]: value };
      } else {
        console.warn(`⚠️ Invalid price format for \"${itemDoc.name}\":`, params.price);
      }
    }

    if (params.rules) {
      try {
        await this.applyRules(itemDoc, params.rules);
      } catch (err) {
        console.warn(`⚠️ Failed to apply rules to \"${itemDoc.name}\"`, err);
      }
    }

    results.push(itemDoc);
  }

  return results;
}
async parseTreasure(treasureRaw) {
  if (!treasureRaw?.trim()) {
    console.warn("⚠️ No treasure input provided.");
    return [];
  }

  const itemPack = game.packs.get("pf2e.equipment-srd");
  const spellPack = game.packs.get("pf2e.spells-srd");

  if (!itemPack || !spellPack) {
    ui.notifications.error("❌ Required compendiums not found.");
    return [];
  }

  const itemIndex = await itemPack.getIndex();
  const spellIndex = await spellPack.getIndex();

  const lines = treasureRaw.split("\n").map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const raw of lines) {
    if (!raw.toLowerCase().startsWith("treasure |")) continue;

    const line = raw.replace(/^treasure\s*\|/i, "").trim();
    const parts = line.split("|").map(p => p.trim());
    const baseName = parts[0];
const params = {};
    let descriptionValue = null;
    let rulesValue = null;

    
    const originalLineWithoutType = raw.replace(/^treasure\s*\|/i, "").trim();

    
    const remainingParts = originalLineWithoutType.split("|").map(p => p.trim()).slice(1); 
    const remainingLine = remainingParts.join('|');

  
    const rulesMarker = "|rules:";
    const rulesIndex = remainingLine.lastIndexOf(rulesMarker);
    let lineToParseForKeyValues = remainingLine;

    if (rulesIndex !== -1) {
        const potentialRules = remainingLine.substring(rulesIndex + rulesMarker.length).trim();
        if (potentialRules.startsWith('[') || potentialRules.startsWith('{')) {
            rulesValue = potentialRules;
            lineToParseForKeyValues = remainingLine.substring(0, rulesIndex).trim();
            console.log(`Extracted rules for ${baseName} (Treasure):`, rulesValue);
        } else {
             console.log(`Found '|rules:' but content doesn't look like JSON for ${baseName} (Treasure), treating as description.`);
        }
    }

   
    const paramsTemp = {}; 
    let descAccumulator = '';
    let foundDescKey = false;
    const remainingPartsForKeyValues = lineToParseForKeyValues.split('|').map(p => p.trim()).filter(Boolean);

    remainingPartsForKeyValues.forEach(part => {
        const colonIndex = part.indexOf(":");
        if (colonIndex === -1) {
             if (foundDescKey || Object.keys(paramsTemp).length === 0) {
                 descAccumulator += (descAccumulator ? ' | ' : '') + part;
             } else {
                  console.warn(`Part without colon ignored for ${baseName} (Treasure): "${part}"`);
             }
            return;
        }

        const key = part.substring(0, colonIndex).trim().toLowerCase();
        const value = part.substring(colonIndex + 1).trim();

        if (key === "description") {
            descAccumulator += (descAccumulator ? ' | ' : '') + value;
            foundDescKey = true;
        } else if (foundDescKey) {
             if (!part.includes(':') || part.split(':').length < 2) {
                 descAccumulator += ' | ' + part;
             } else {
                 paramsTemp[key] = value;
                 foundDescKey = false;
             }
        } else if (key !== "rules") {
            paramsTemp[key] = value;
        }
    });

    descriptionValue = descAccumulator || paramsTemp.description || null;
 
    params.description = descriptionValue;

    Object.assign(params, paramsTemp);
    

  
    let parsedRules = [];
    if (rulesValue) {
      try {
        parsedRules = JSON.parse(rulesValue);
        if (!Array.isArray(parsedRules)) parsedRules = [parsedRules];
        console.log(`Successfully parsed rules for ${baseName} (Treasure):`, parsedRules);
      } catch (e) {
        console.warn(`⚠️ Failed to parse rules JSON for ${baseName} (Treasure):`, e);
        parsedRules = [];
      }
    }
 
    params.rules = parsedRules;

    const baseMatch = itemIndex.find(i =>
      i.name.toLowerCase() === baseName.toLowerCase() ||
      i.slug?.toLowerCase() === baseName.toLowerCase().replace(/\s+/g, "-")
    );

    let baseItemDoc = null;
    if (baseMatch) {
      baseItemDoc = await itemPack.getDocument(baseMatch._id);
    } else {
      try {
        baseItemDoc = await fromUuid("Compendium.pf2e.equipment-srd.Item.jJx4CClf6ScJqI1R"); 
        console.warn("⚠️ Using fallback treasure item template for:", baseName);
      } catch (err) {
        console.error("❌ Could not load fallback treasure template.", err);
        continue;
      }
    }

    if (!baseItemDoc) continue;

    const itemDoc = structuredClone(baseItemDoc.toObject ? baseItemDoc.toObject() : baseItemDoc);
    itemDoc._id = foundry.utils.randomID();

    if (params.name) itemDoc.name = params.name;

    const ruleMarker = "|rules:";
    if (params.description && typeof params.description === "string") {
      const index = params.description.indexOf(ruleMarker);
      if (index !== -1) {
        const descPart = params.description.slice(0, index).trim();
        const rulesPart = params.description.slice(index + ruleMarker.length).trim();
        params.description = descPart;
        try {
          params.rules = JSON.parse(rulesPart);
        } catch (err) {
          console.warn("⚠️ Failed to parse extracted rules:", rulesPart);
        }
      }
    }




    if (params.description) {
      const rawHTML = params.description.trim();
      const withSpells = await this.replaceSpellTags(rawHTML, spellIndex, spellPack);
      const fullHTML = await this.replaceConditionTags(withSpells);
      itemDoc.system.description = {
        value: `<div class="foundry-description">${fullHTML}</div>`
      };
    }

    if (params.traits) {
      itemDoc.system.traits.value = params.traits.split(",").map(t => t.trim()).filter(Boolean);
    }

    if (params.price) {
      const match = params.price.trim().match(/^(\d+)\s*(cp|sp|gp|pp)$/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const denomination = match[2].toLowerCase();
        itemDoc.system.price.value = { [denomination]: value };
      } else {
        console.warn(`⚠️ Invalid price format for "${itemDoc.name}":`, params.price);
      }
    }

    if (params.rules) {
      try {
        await this.applyRules(itemDoc, params.rules);
      } catch (err) {
        console.warn(`⚠️ Failed to apply rules to "${itemDoc.name}"`, err);
      }
    }

    results.push(itemDoc);
  }

  return results;
}
async parseContainers(containerRaw) {
  if (!containerRaw?.trim()) {
    console.warn("⚠️ No containers input provided.");
    return [];
  }

  const itemPack = game.packs.get("pf2e.equipment-srd");
  const spellPack = game.packs.get("pf2e.spells-srd");

  if (!itemPack || !spellPack) {
    ui.notifications.error("❌ Required compendiums not found.");
    return [];
  }

  const itemIndex = await itemPack.getIndex();
  const spellIndex = await spellPack.getIndex();

  const lines = containerRaw.split("\n").map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const raw of lines) {
    if (!raw.toLowerCase().startsWith("container |")) continue;

    const line = raw.replace(/^container\s*\|/i, "").trim();
    const parts = line.split("|").map(p => p.trim());
    const baseName = parts[0];
const params = {};
    let descriptionValue = null;
    let rulesValue = null;

    
    const originalLineWithoutType = raw.replace(/^container\s*\|/i, "").trim();

  
    const remainingParts = originalLineWithoutType.split("|").map(p => p.trim()).slice(1); 
    const remainingLine = remainingParts.join('|');

    
    const rulesMarker = "|rules:";
    const rulesIndex = remainingLine.lastIndexOf(rulesMarker);
    let lineToParseForKeyValues = remainingLine;

    if (rulesIndex !== -1) {
        const potentialRules = remainingLine.substring(rulesIndex + rulesMarker.length).trim();
        if (potentialRules.startsWith('[') || potentialRules.startsWith('{')) {
            rulesValue = potentialRules;
            lineToParseForKeyValues = remainingLine.substring(0, rulesIndex).trim();
            console.log(`Extracted rules for ${baseName} (Container):`, rulesValue);
        } else {
             console.log(`Found '|rules:' but content doesn't look like JSON for ${baseName} (Container), treating as description.`);
        }
    }

    
    const paramsTemp = {}; 
    let descAccumulator = '';
    let foundDescKey = false;
    const remainingPartsForKeyValues = lineToParseForKeyValues.split('|').map(p => p.trim()).filter(Boolean);

    remainingPartsForKeyValues.forEach(part => {
        const colonIndex = part.indexOf(":");
        if (colonIndex === -1) {
             if (foundDescKey || Object.keys(paramsTemp).length === 0) {
                 descAccumulator += (descAccumulator ? ' | ' : '') + part;
             } else {
                  console.warn(`Part without colon ignored for ${baseName} (Container): "${part}"`);
             }
            return;
        }

        const key = part.substring(0, colonIndex).trim().toLowerCase();
        const value = part.substring(colonIndex + 1).trim();

        if (key === "description") {
            descAccumulator += (descAccumulator ? ' | ' : '') + value;
            foundDescKey = true;
        } else if (foundDescKey) {
             if (!part.includes(':') || part.split(':').length < 2) {
                 descAccumulator += ' | ' + part;
             } else {
                 paramsTemp[key] = value;
                 foundDescKey = false;
             }
        } else if (key !== "rules") {
            paramsTemp[key] = value;
        }
    });

    descriptionValue = descAccumulator || paramsTemp.description || null;
   
    params.description = descriptionValue;
    
    Object.assign(params, paramsTemp);

    let parsedRules = [];
    if (rulesValue) {
      try {
        parsedRules = JSON.parse(rulesValue);
        if (!Array.isArray(parsedRules)) parsedRules = [parsedRules];
        console.log(`Successfully parsed rules for ${baseName} (Container):`, parsedRules);
      } catch (e) {
        console.warn(`⚠️ Failed to parse rules JSON for ${baseName} (Container):`, e);
        parsedRules = [];
      }
    }
   
    params.rules = parsedRules;

    const baseMatch = itemIndex.find(i =>
      i.name.toLowerCase() === baseName.toLowerCase() ||
      i.slug?.toLowerCase() === baseName.toLowerCase().replace(/\s+/g, "-")
    );

    let baseItemDoc = null;
    if (baseMatch) {
      baseItemDoc = await itemPack.getDocument(baseMatch._id);
    } else {
      try {
        baseItemDoc = await fromUuid("Compendium.pf2e.equipment-srd.Item.hUeV6mhq0V2cWX7p"); 
        console.warn("⚠️ Using fallback container item template for:", baseName);
      } catch (err) {
        console.error("❌ Could not load fallback container template.", err);
        continue;
      }
    }

    if (!baseItemDoc) continue;

    const itemDoc = structuredClone(baseItemDoc.toObject ? baseItemDoc.toObject() : baseItemDoc);
    itemDoc._id = foundry.utils.randomID();

    if (params.name) itemDoc.name = params.name;

    const ruleMarker = "|rules:";
    if (params.description && typeof params.description === "string") {
      const index = params.description.indexOf(ruleMarker);
      if (index !== -1) {
        const descPart = params.description.slice(0, index).trim();
        const rulesPart = params.description.slice(index + ruleMarker.length).trim();
        params.description = descPart;
        try {
          params.rules = JSON.parse(rulesPart);
        } catch (err) {
          console.warn("⚠️ Failed to parse extracted rules:", rulesPart);
        }
      }
    }

   

    if (params.description) {
      const rawHTML = params.description.trim();
      const withSpells = await this.replaceSpellTags(rawHTML, spellIndex, spellPack);
      const fullHTML = await this.replaceConditionTags(withSpells);
      itemDoc.system.description = {
        value: `<div class="foundry-description">${fullHTML}</div>`
      };
    }

    if (params.traits) {
      itemDoc.system.traits.value = params.traits.split(",").map(t => t.trim()).filter(Boolean);
    }

    if (params.price) {
      const match = params.price.trim().match(/^(\d+)\s*(cp|sp|gp|pp)$/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const denomination = match[2].toLowerCase();
        itemDoc.system.price.value = { [denomination]: value };
      } else {
        console.warn(`⚠️ Invalid price format for "${itemDoc.name}":`, params.price);
      }
    }

    if (params.rules) {
      try {
        await this.applyRules(itemDoc, params.rules);
      } catch (err) {
        console.warn(`⚠️ Failed to apply rules to "${itemDoc.name}"`, err);
      }
    }

    results.push(itemDoc);
  }

  return results;
}
async parseItemLine(line) {
  const parts = line.split("|").map(p => p.trim());
  const params = {};

  for (const part of parts) {
    const [key, ...rest] = part.split(":");
    if (!key || !rest.length) continue;

    const paramKey = key.trim().toLowerCase();
    const paramValue = rest.join(":").trim();

    switch (paramKey) {
      case "baseitem":
        params.baseItem = paramValue;
        break;
      case "name":
        params.name = paramValue;
        break;
      case "traits":
        params.traits = paramValue;
        break;
      case "description":
        params.description = paramValue;
        break;
      case "rules":
        try {
          params.rules = JSON.parse(paramValue);
        } catch (err) {
          console.warn("⚠️ Could not parse rules JSON:", paramValue);
        }
        break;
      default:
       
        params[paramKey] = paramValue;
    }
  }

  return params;
}
async parseAbilities(actionsRaw) {
  if (!actionsRaw?.trim()) return [];

  const spellPack = game.packs.get("pf2e.spells-srd");
  if (!spellPack) {
    ui.notifications.warn("⚠️ Spell compendium not found.");
    return [];
  }

  const spellIndex = await spellPack.getIndex();
  const lines = actionsRaw.split("\n").map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const raw of lines) {
    let actionType = "action";
    let category = "offensive";
    let glyph = 1;
    let name = "";
    let rawText = raw;

    
    if (/^\d\s+/.test(rawText)) {
      const match = rawText.match(/^(\d)\s+(.*?)\s*:\s*(.+)$/);
      if (!match) {
        console.warn("⚠️ Invalid action format:", rawText);
        continue;
      }
      [, glyph, name, rawText] = match;
    } else if (/^reaction\s+/i.test(rawText)) {
      const match = rawText.match(/^reaction\s+(.*?)\s*:\s*(.+)$/i);
      if (!match) continue;
      [, name, rawText] = match;
      actionType = "reaction";
      glyph = null;
      category = "defensive";
    } else if (/^free\s+/i.test(rawText)) {
      const match = rawText.match(/^free\s+(.*?)\s*:\s*(.+)$/i);
      if (!match) continue;
      [, name, rawText] = match;
      actionType = "free";
      glyph = null;
    } else if (/^passive\s+/i.test(rawText)) {
      const match = rawText.match(/^passive\s+(.*?)\s*:\s*(.+)$/i);
      if (!match) continue;
      [, name, rawText] = match;
      actionType = "passive";
      glyph = null;
    } else {
      console.warn("⚠️ Unknown ability type:", rawText);
      continue;
    }

  
    let baseDescription = rawText;
    let suffix = "";
    const traitMarker = "||traits:";
    if (rawText.includes(traitMarker)) {
      [baseDescription, suffix] = rawText.split(traitMarker).map(s => s.trim());
    }

   
    let traits = [];
    const traitsMatch = suffix.match(/^([^|]+)/);
    if (traitsMatch) {
      traits = traitsMatch[1].split(",").map(t => t.trim()).filter(Boolean);
    }

  
    let frequency = null;
    const freqMatch = suffix.match(/\|frequency:\s*(\d+)\s+per\s+([^\|]+)/i);
    if (freqMatch) {
      frequency = {
        max: parseInt(freqMatch[1], 10),
        per: freqMatch[2].trim()
      };
    }

 
    let selfEffect = null;
    const selfEffectMatch = suffix.match(/\|selfEffect:\s*([^\s|]+)/i);
    if (selfEffectMatch) {
      const uuid = selfEffectMatch[1].trim();
      if (uuid) selfEffect = { uuid };
    }

   
    let rules = [];
    const rulesMatch = suffix.match(/\|rules:\s*(\[.*?\])(?:\s*\||$)/i);
    if (rulesMatch) {
      try {
        rules = JSON.parse(rulesMatch[1]);
      } catch (err) {
        console.warn("⚠️ Failed to parse rules JSON:", rulesMatch[1], err);
      }
    }

  
    const params = { description: baseDescription };
    await this.extractDescriptionAndRules(params);
    let rawHTML = params.description;
    rawHTML = await this.replaceSpellTags(rawHTML, spellIndex, spellPack);
    rawHTML = await this.replaceConditionTags(rawHTML);

    results.push({
      type: "action",
      name: name.trim(),
      img: "systems/pf2e/icons/actions/OneAction.webp",
      system: {
        description: { value: `<p>${rawHTML}</p>` },
        traits: { value: traits },
        actionType: { value: actionType },
        actions: { value: glyph !== null ? parseInt(glyph) : null },
        category,
        frequency,
        rules,
        selfEffect
      }
    });
  }

  return results;
}
async parseAttacks(attackRaw, spellIndex, spellPack) {
  if (!attackRaw?.trim()) return [];

  const lines = attackRaw.split("\n").map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const raw of lines) {
    const baseMatch = raw.match(/^([^+]+)\+(\d+)\s*:\s*([^|]+)/);
    if (!baseMatch) {
      console.warn("⚠️ Invalid attack format:", raw);
      continue;
    }

    const [, name, bonus, damageBlock] = baseMatch;

    
    const damageParts = damageBlock.split(",").map(p => p.trim()).filter(Boolean);
    const damageRolls = {};
    for (const part of damageParts) {
      const match = part.match(/^([\dd+\-*/() ]+)\s+(\w+)(?:\s+(\w+))?$/);
      if (!match) continue;

      const [, damage, damageType, maybeCategory] = match;
      const roll = {
        damage: damage.trim(),
        damageType: damageType.toLowerCase()
      };
      if (maybeCategory && ["persistent", "precision", "splash"].includes(maybeCategory.toLowerCase())) {
        roll.category = maybeCategory.toLowerCase();
      }
      damageRolls[foundry.utils.randomID()] = roll;
    }

    
    const traitsMatch = raw.match(/\|traits:\s*([^|]+)/i);
    const traits = traitsMatch
      ? traitsMatch[1].split(",").map(t => t.trim()).filter(Boolean)
      : [];

    const effectsMatch = raw.match(/\|effects:\s*([^|]+)/i);
    const effects = effectsMatch
      ? effectsMatch[1].split(",").map(t => t.trim()).filter(e => e && e.toLowerCase() !== "none")
      : [];

    const descriptionMatch = raw.match(/\|description:\s*(.+?)(?=\|rules:|\s*$)/i);
    const rawDescription = descriptionMatch ? descriptionMatch[1].trim() : "";

    const rulesMatch = raw.match(/\|rules:\s*(\[.*\])$/i);
    const rulesRaw = rulesMatch ? rulesMatch[1].trim() : null;

    const params = { description: rawDescription };
    if (rulesRaw) {
      try {
        params.rules = JSON.parse(rulesRaw);
      } catch (err) {
        console.warn("⚠️ Failed to parse rules JSON:", rulesRaw);
      }
    }

    if (!params.rules) {
      await this.extractDescriptionAndRules(params);
    }

    let finalDescription = params.description || "";
    if (finalDescription) {
      finalDescription = await this.replaceSpellTags(finalDescription, spellIndex, spellPack);
      finalDescription = await this.replaceConditionTags(finalDescription);
    }

    const attack = {
      name: name.trim(),
      type: "melee",
      system: {
        description: { value: finalDescription },
        traits: { value: traits },
        bonus: { value: parseInt(bonus, 10) },
        damageRolls,
        weaponType: "melee",
        ability: "str",
        attackEffects: {
          value: effects.length ? effects : []
        }
      }
    };

    if (params.rules) {
      try {
        await this.applyRules(attack, params.rules);
      } catch (err) {
        console.warn(`⚠️ Failed to apply rules to attack "${attack.name}"`, err);
      }
    }

    results.push(attack);
  }

  return results;
}
 async createActor(creatureData) {
 
  if (!creatureData || typeof creatureData !== "object") {
    throw new Error("Invalid creature data format");
  }
  if (!creatureData.name) {
    throw new Error("Creature must have a name");
  }
  if (creatureData.type !== "npc") {
    throw new Error('Actor type must be "npc"');
  }

  
  creatureData.items = (creatureData.items || []).filter(i => i.type !== "feat");

  const spellcastingEntries = creatureData.items.filter(i => i.type === "spellcastingEntry");
  const spells = creatureData.items.filter(i => i.type === "spell");

  const compendiumSpells = game.packs.get("pf2e.spells-srd");
  const index = await compendiumSpells.getIndex();

  for (let i = 0; i < spells.length; i++) {
    const importedSpell = spells[i];
    const match = index.find(e => e.name.toLowerCase() === importedSpell.name.toLowerCase());
    if (!match) {
      console.warn(`No matching compendium spell found for "${importedSpell.name}".`);
      continue;
    }

    const compendiumSpell = await compendiumSpells.getDocument(match._id);
    if (!compendiumSpell) continue;

    const clone = compendiumSpell.toObject();
    clone._id = foundry.utils.randomID();

    const entryId = spellcastingEntries[0]?._id ?? null;
    clone.system.location = {
      value: entryId,
      heightenedLevel: importedSpell.system.level?.value || 1
    };

    if (importedSpell.system.description?.value)
      clone.system.description = importedSpell.system.description;
    if (importedSpell.system.damage)
      clone.system.damage = foundry.utils.deepClone(importedSpell.system.damage);
    if (importedSpell.system.heightening)
      clone.system.heightening = foundry.utils.deepClone(importedSpell.system.heightening);
    if (importedSpell.img)
      clone.img = importedSpell.img;

    spells[i] = clone;
  }

  for (const spell of spells) {
    if (!spell.system.location?.value && spellcastingEntries.length === 0) {
      console.warn(`Spell "${spell.name}" has no spellcastingEntry to link to.`);
    }

    if (
      spell.system.damage?.value &&
      typeof spell.system.damage.value === "object" &&
      !Array.isArray(spell.system.damage.value)
    ) {
      continue;
    }

    if (!spell.system.location?.value && spellcastingEntries.length > 0) {
      spell.system.location = {
        value: spellcastingEntries[0]._id,
        heightenedLevel: spell.system.level?.value || 1
      };
    }

    if (Array.isArray(spell.system.damage?.value)) {
      const key = foundry.utils.randomID();
      const formula = spell.system.damage.value[0]?.value ?? "1d4";
      const type = spell.system.damage.value[0]?.type ?? "bludgeoning";

      spell.system.damage = {
        [key]: {
          applyMod: false,
          category: null,
          formula,
          kinds: ["damage"],
          materials: [],
          type
        }
      };

      spell.system.heightening = {
        damage: { [key]: formula },
        interval: 1,
        type: "interval"
      };
    }
  }

  
  creatureData.system = creatureData.system || {};
  creatureData.system.details = creatureData.system.details || { level: { value: 1 } };
  creatureData.system.attributes = creatureData.system.attributes || {};

  
  const rawPerception = creatureData.system.perception || {};
  const attributePerception = creatureData.system.attributes.perception || {};

  creatureData.system.perception = {
    slug: rawPerception.slug ?? "perception",
    label: rawPerception.label ?? game.i18n.localize("PF2E.Perception"),
    value: rawPerception.value ?? attributePerception.value ?? 0,
    totalModifier: rawPerception.totalModifier ?? attributePerception.value ?? 0,
    mod: rawPerception.mod ?? attributePerception.value ?? 0,
    rank: rawPerception.rank ?? attributePerception.rank ?? 0,
    attribute: rawPerception.attribute ?? attributePerception.attribute ?? "wis",
    dc: rawPerception.dc ?? (10 + (attributePerception.value ?? 0)),
    breakdown: rawPerception.breakdown ?? `${attributePerception.value >= 0 ? "+" : ""}${attributePerception.value ?? 0}`,
    details: rawPerception.details ?? "",
    senses: rawPerception.senses ?? [],
    vision: rawPerception.vision ?? false
  };

  delete creatureData.system.attributes.perception;

 
  if (creatureData.system.attributes.saves) {
    creatureData.system.saves = creatureData.system.attributes.saves;
    delete creatureData.system.attributes.saves;
  }

  
  const existingSenses = creatureData.system.perception?.senses;
  const rawSenses = creatureData.system.attributes?.senses?.value;

  if (Array.isArray(existingSenses) && existingSenses.length > 0) {
    creatureData.system.perception.senses = existingSenses;
    creatureData.system.perception.vision = existingSenses.some(e =>
      ["darkvision", "low-light-vision", "greater-darkvision", "truesight"].includes(e.type)
    );
  } else if (rawSenses) {
    const parsed = rawSenses.split(/,\s*/).map(text => {
      const m = text.match(/(\w+)/i);
      return m ? { type: m[1].toLowerCase() } : null;
    }).filter(Boolean);

    creatureData.system.perception.senses = parsed;
    creatureData.system.perception.vision = parsed.some(e =>
      ["darkvision", "low-light-vision", "greater-darkvision", "truesight"].includes(e.type)
    );
  }

  delete creatureData.system.attributes.senses;

 
  if (Array.isArray(creatureData.system.immunities)) {
    creatureData.system.attributes.immunities = creatureData.system.immunities;
    delete creatureData.system.immunities;
  } else if (creatureData.system.attributes?.immunities?.value) {
    creatureData.system.attributes.immunities = creatureData.system.attributes.immunities.value;
  }

  if (Array.isArray(creatureData.system.resistances)) {
    creatureData.system.attributes.resistances = creatureData.system.resistances;
    delete creatureData.system.resistances;
  } else if (creatureData.system.attributes?.resistances?.value) {
    creatureData.system.attributes.resistances = creatureData.system.attributes.resistances.value;
  }

  if (Array.isArray(creatureData.system.weaknesses)) {
    creatureData.system.attributes.weaknesses = creatureData.system.weaknesses;
    delete creatureData.system.weaknesses;
  } else if (creatureData.system.attributes?.weaknesses?.value) {
    creatureData.system.attributes.weaknesses = creatureData.system.attributes.weaknesses.value;
  }

 
  const originalTraits = creatureData.system.traits?.value || [];
  creatureData.system.traits.value = [];

  if (game.settings.get("pf2e-creature-importer", "defaultTokenSettings")) {
    creatureData.prototypeToken = creatureData.prototypeToken || {};
    Object.assign(creatureData.prototypeToken, {
      sight: { enabled: true, range: creatureData.prototypeToken.dimSight || 0, brightness: creatureData.prototypeToken.brightSight || 0 },
      displayName: 20,
      actorLink: false,
      disposition: -1,
      lockRotation: true,
      rotation: 0
    });
  }

  
  try {
    const actor = await Actor.create(creatureData);
    if (!actor) throw new Error("Actor creation failed");

    await actor.setFlag("pf2e-creature-importer", "deferredTraits", originalTraits);
    return actor;

  } catch (err) {
    console.error("Actor Creation Error:", err);
    throw new Error(`Failed to create actor: ${err.message}`);
  }
  
}
}
Hooks.on("renderActorSheetPF2e", async (sheet, html, data) => {
  const actor = sheet.actor;
  const traits = await actor.getFlag("pf2e-creature-importer", "deferredTraits");
  if (!actor || !traits || !Array.isArray(traits) || traits.length === 0) return;

  console.warn("Restoring stripped traits to", actor.name, traits);

  await actor.update({ "system.traits.value": [...actor.system.traits.value, ...traits] });
  await actor.unsetFlag("pf2e-creature-importer", "deferredTraits");
  await actor.sheet.render(true); 
});
Hooks.once('init', () => {
  game.settings.register('pf2e-creature-importer','defaultTokenSettings',{
    name: 'Apply Default Token Settings',
    hint: 'Configure token on import',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
});
Hooks.once('ready', () => {
  if (game.system.id !== 'pf2e') {
    ui.notifications.error("PF2e Creature Importer requires the PF2e system!");
    return;
  }
  console.log('PF2e Creature Importer | Ready');
});
async function importFromClipboard() {
  try {
   
    const clipboardText = await navigator.clipboard.readText();
    
    if (!clipboardText || !clipboardText.trim()) {
      ui.notifications.warn("Clipboard is empty! Copy NPC data first.");
      return;
    }
    
    console.log("📋 Reading from clipboard...");
    
   
    const tempDialog = new CreatureImporterDialog();
    
  
    const sections = {
      base: "",
      spells: "",
      equipment: "",
      actions: "",
      attacks: ""
    };
    
    let currentSection = null;
    for (const line of clipboardText.split("\n")) {
      const trimmed = line.trim();
      if (/^===BASE===/i.test(trimmed)) currentSection = "base";
      else if (/^===SPELLS===/i.test(trimmed)) currentSection = "spells";
      else if (/^===EQUIPMENT===/i.test(trimmed)) currentSection = "equipment";
      else if (/^===ACTIONS===/i.test(trimmed)) currentSection = "actions";
      else if (/^===ATTACKS===/i.test(trimmed)) currentSection = "attacks";
      else if (currentSection) sections[currentSection] += trimmed + "\n";
    }
    
  
    let creatureData;
    if (sections.base.trim().startsWith("{")) {
      try {
        creatureData = JSON.parse(sections.base);
        console.log("✅ Parsed raw JSON base block.");
      } catch (e) {
        throw new Error("Base block JSON is invalid: " + e.message);
      }
    } else {
      creatureData = await tempDialog.parseSimpleBase(sections.base);
      if (!creatureData) throw new Error("Failed to parse simplified base block.");
      console.log("✅ Parsed simplified base block.");
    }
    
   
    let actions = [];
    if (sections.actions.trim()) {
      try {
        actions = await tempDialog.parseAbilities(sections.actions);
      } catch (e) {
        throw new Error("Actions block failed to parse: " + e.message);
      }
    }
    
  
    let attacks = [];
    if (sections.attacks?.trim()) {
      try {
        const spellPack = game.packs.get("pf2e.spells-srd");
        const spellIndex = await spellPack.getIndex();
        attacks = await tempDialog.parseAttacks(sections.attacks, spellIndex, spellPack);
      } catch (e) {
        throw new Error("Attacks block failed to parse: " + e.message);
      }
    }
    
   
    const equipment = await tempDialog.parseEquipment(sections.equipment);
    
  
    const spells = await tempDialog.dispatchSpellBlock(sections.spells, creatureData);
    
    console.log("📹 Actions parsed:", actions);
    console.log("📹 Equipment parsed:", equipment);
    console.log("📹 Spells parsed:", spells);
    
   
    creatureData.items = [
      ...(creatureData.items || []),
      ...actions,
      ...equipment,
      ...spells,
      ...attacks
    ];
    
 
    const actor = await tempDialog.createActor(creatureData);
    if (actor) {
      console.log("🎉 Actor created successfully:", actor.name);
      ui.notifications.info(`Successfully imported "${actor.name}" from clipboard!`);
      actor.sheet.render(true);
    }
    
  } catch (err) {
    console.error("❌ Clipboard Import Error:", err);
    ui.notifications.error(`Import Failed: ${err.message}`);
  }
}
Hooks.on('renderActorDirectory', (app, html) => {
  const $html = $(html);
  const header = $html.find('.header-actions');
  if (!header.find('.pf2e-creature-import').length) {
    const btn = $(`<button class="pf2e-creature-import"><i class="fas fa-file-import"></i> Import Creature</button>`);
    btn.on('click', () => importFromClipboard());
    header.append(btn);
  }
});
Hooks.on("getActorDirectoryEntryContext", (html, options) => {
  options.push({
    name: "Import Creature",
    icon: '<i class="fas fa-file-import"></i>',
    condition: () => game.user.isGM,
    callback: () => importFromClipboard()
  });
});
