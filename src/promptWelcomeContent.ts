export const PROMPT_WELCOME_TEMPLATE_PROMPTS = {
  story: `Cinematic Historical Narrative. Constraints: Select a Random  moment in human history. Structure as an epic, 3-act documentary explainer. Tone: Dramatic, visually expansive, and heavily detailed.`,
  top10: `High-Velocity Ranking. Constraints: Generate a Top 5 list of meals based on a specific Random country Structure: Aggressive hook, rapid-fire countdown from 5 to 1, and a definitive conclusion.`,
  wildlife: `Premium Wildlife Documentary. Constraints: Select a Random, Earth biome , Focus 100% on predator-prey dynamics, animal biology, and ecosystem survival. Ignore human geography entirely.`,
  exercise: `Pretend You Are My Personal Trainer and I Came To Your House, Give yourself a persona,  show me your daily workout routine while giving me a tour of your house,  Provide a healthy exercise routine while slighthly focusing on showing me your house bragging about your wealth or trying to get me to buy you a new furniture, or asking for asking for an unformal freidnly meeting later (use these as scenario randomisers) you could be very rich, rich, average or poor income`,
} as const;

export const PROMPT_WELCOME_TEMPLATES = [
  {
    id: "wildlife",
    label: "Wildlife",
    prompt: PROMPT_WELCOME_TEMPLATE_PROMPTS.wildlife,
  },
  {
    id: "story",
    label: "Historical Story",
    prompt: PROMPT_WELCOME_TEMPLATE_PROMPTS.story,
  },
  {
    id: "top10",
    label: "Top Meals",
    prompt: PROMPT_WELCOME_TEMPLATE_PROMPTS.top10,
  },
  {
    id: "exercise",
    label: "Exercise Routine",
    prompt: PROMPT_WELCOME_TEMPLATE_PROMPTS.exercise,
  },
] as const;
