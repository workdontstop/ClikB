/** Public Fish catalogue metadata, checked 2026-10-30. Tone labels guide audition, not a claim of listening verification. No credentials or runtime dependencies. */
export type FishVoice = { id: string; referenceId: string; name: string; tone: string; gender: string; languages: string[]; tags: string[]; previewUrl: string; licensed: boolean; fallbackGemini: string };
export const FISH_VOICES: readonly FishVoice[] = [
  {
    "id": "fish_79d0bd3e4e5444b18f7b6d89b5927bf1",
    "referenceId": "79d0bd3e4e5444b18f7b6d89b5927bf1",
    "name": "Jordan",
    "tone": "Wise narrator",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "old",
      "educational",
      "professional",
      "confident",
      "measured",
      "calm",
      "Motivational"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/edecbc0bdd4c46c39eda8520a0f729ef.mp3",
    "licensed": false,
    "fallbackGemini": "Charon"
  },
  {
    "id": "fish_75a018e5fca94ba089b7712e626c49e8",
    "referenceId": "75a018e5fca94ba089b7712e626c49e8",
    "name": "Reflective Grandfather",
    "tone": "Reflective grandfather",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "old",
      "narration",
      "educational",
      "entertainment",
      "deep",
      "warm",
      "calm",
      "relaxed",
      "measured",
      "friendly",
      "gentle",
      "clear",
      "storytelling",
      "narrative"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/6316bb921c5642d2aa638055b5562d66.mp3",
    "licensed": false,
    "fallbackGemini": "Gacrux"
  },
  {
    "id": "fish_47e0fe010fc1468fa2b389a3dc1db037",
    "referenceId": "47e0fe010fc1468fa2b389a3dc1db037",
    "name": "Warm Grandmother",
    "tone": "Warm grandmother",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "old",
      "conversational",
      "narration",
      "educational",
      "warm",
      "gentle",
      "friendly",
      "calm",
      "measured",
      "expressive",
      "storytelling",
      "clear",
      "medium",
      "relaxed",
      "authoritative"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/5cf17731471946898cfaa7ae838b2f98.mp3",
    "licensed": false,
    "fallbackGemini": "Sulafat"
  },
  {
    "id": "fish_4290b0b2be9a49c2922bd7d363211e86",
    "referenceId": "4290b0b2be9a49c2922bd7d363211e86",
    "name": "Kyle Brookes",
    "tone": "Deep and composed",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "middle-aged",
      "narration",
      "educational",
      "conversational",
      "deep",
      "smooth",
      "calm",
      "relaxed",
      "measured",
      "gentle",
      "empathetic",
      "storytelling"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-10-13/3a53752c081142c9bccff4480c2f8fac.mp3",
    "licensed": true,
    "fallbackGemini": "Orus"
  },
  {
    "id": "fish_e3cd384158934cc9a01029cd7d278634",
    "referenceId": "e3cd384158934cc9a01029cd7d278634",
    "name": "Laura",
    "tone": "Calm professional",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "middle-aged",
      "conversational",
      "educational",
      "deep",
      "warm",
      "calm",
      "professional",
      "clear"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/e821bef995344d519caa1c93d808db23.mp3",
    "licensed": false,
    "fallbackGemini": "Kore"
  },
  {
    "id": "fish_175d7d5358b644d2ad2e8b7e4e13ece3",
    "referenceId": "175d7d5358b644d2ad2e8b7e4e13ece3",
    "name": "Robot",
    "tone": "Futuristic character",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "middle-aged",
      "narration",
      "deep",
      "calm",
      "smooth",
      "professional",
      "clear",
      "storytelling"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/4aeb7fe810ca47129d8beabdbdaef548.mp3",
    "licensed": false,
    "fallbackGemini": "Algenib"
  },
  {
    "id": "fish_109a08015a0d4d35972ea9e17c88d076",
    "referenceId": "109a08015a0d4d35972ea9e17c88d076",
    "name": "Ancient Villain",
    "tone": "Ancient villain",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "old",
      "character-voice",
      "narration",
      "entertainment",
      "deep",
      "low",
      "dark",
      "raspy",
      "husky",
      "energetic",
      "dramatic",
      "authoritative",
      "serious",
      "expressive",
      "storytelling",
      "character"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/9dc24750f5864f78ba3c83f1420613b3.mp3",
    "licensed": false,
    "fallbackGemini": "Algenib"
  },
  {
    "id": "fish_b347db033a6549378b48d00acb0d06cd",
    "referenceId": "b347db033a6549378b48d00acb0d06cd",
    "name": "Selene",
    "tone": "Soft and intimate",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "middle-aged",
      "narration",
      "soft",
      "calm",
      "gentle",
      "intimate",
      "breathy",
      "ASMR"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/fcf629b4a0b343558f461338ba1b9da4.mp3",
    "licensed": false,
    "fallbackGemini": "Enceladus"
  },
  {
    "id": "fish_bf322df2096a46f18c579d0baa36f41d",
    "referenceId": "bf322df2096a46f18c579d0baa36f41d",
    "name": "Adrian",
    "tone": "Dramatic storyteller",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "middle-aged",
      "narration",
      "deep",
      "slow",
      "measured",
      "serious",
      "dramatic",
      "storytelling"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/d730b09f4a484316a77ecc86137e85fb.mp3",
    "licensed": false,
    "fallbackGemini": "Charon"
  },
  {
    "id": "fish_57bdc0132f1d4e658a3e0f418d4d939d",
    "referenceId": "57bdc0132f1d4e658a3e0f418d4d939d",
    "name": "Luminous Expressive Female",
    "tone": "Expressive narrator",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "middle-aged",
      "narration",
      "educational",
      "entertainment",
      "medium",
      "warm",
      "smooth",
      "calm",
      "relaxed",
      "friendly",
      "gentle",
      "clear",
      "measured",
      "expressive",
      "storytelling",
      "narrative",
      "conversational",
      "advertisement",
      "professional",
      "confident"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-09-23/dd32f9465f234f0a9b805e4f0dcd30e6.mp3",
    "licensed": true,
    "fallbackGemini": "Aoede"
  },
  {
    "id": "fish_c3a0b2c232b04d0a81696a632aa14f29",
    "referenceId": "c3a0b2c232b04d0a81696a632aa14f29",
    "name": "Ryan",
    "tone": "Warm storyteller",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "middle-aged",
      "narration",
      "educational",
      "conversational",
      "medium",
      "calm",
      "smooth",
      "warm",
      "measured",
      "professional",
      "clear",
      "neutral-tone"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-10-07/30936984d56444aba9f9476c244d6a53.mp3",
    "licensed": true,
    "fallbackGemini": "Puck"
  },
  {
    "id": "fish_14e37eff00a843ed9a9daa5ece7988da",
    "referenceId": "14e37eff00a843ed9a9daa5ece7988da",
    "name": "Sofiah",
    "tone": "Warm and smooth",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "middle-aged",
      "narration",
      "educational",
      "clear",
      "calm",
      "measured",
      "smooth",
      "warm",
      "friendly",
      "professional",
      "expressive",
      "narrative",
      "medium"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-09-19/1c6f3e5b1e384810bed066da8e51fb7e.mp3",
    "licensed": true,
    "fallbackGemini": "Sulafat"
  },
  {
    "id": "fish_711cf3ed00ab441a8f54a45058047b7a",
    "referenceId": "711cf3ed00ab441a8f54a45058047b7a",
    "name": "Verity",
    "tone": "Playful character",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "young",
      "conversational",
      "character-voice",
      "entertainment",
      "energetic",
      "cheerful",
      "friendly",
      "playful",
      "animated",
      "expressive",
      "clear",
      "dynamic",
      "storytelling"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/2e3ba59461ca46a5bc5056e1a6af0ac8.mp3",
    "licensed": false,
    "fallbackGemini": "Fenrir"
  },
  {
    "id": "fish_8abfa9ebd4c24a3399b68c3cdac8c7b5",
    "referenceId": "8abfa9ebd4c24a3399b68c3cdac8c7b5",
    "name": "Freya",
    "tone": "Brisk conversational",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "young",
      "conversational",
      "professional",
      "clear",
      "confident",
      "brisk",
      "english",
      "en-gb"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-08-25/07918705a56b42daaab149f65392cea7.mp3",
    "licensed": false,
    "fallbackGemini": "Laomedeia"
  },
  {
    "id": "fish_0db6e93af420470b9d9b9a886dbaa954",
    "referenceId": "0db6e93af420470b9d9b9a886dbaa954",
    "name": "Kai",
    "tone": "Conversational companion",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "conversational",
      "english",
      "male",
      "companion"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-08-24/13306f1172544c3ba3106d1e363feaa6.mp3",
    "licensed": false,
    "fallbackGemini": "Puck"
  },
  {
    "id": "fish_933563129e564b19a115bedd57b7406a",
    "referenceId": "933563129e564b19a115bedd57b7406a",
    "name": "Sarah",
    "tone": "Gentle companion",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "young",
      "conversational",
      "narration",
      "soft",
      "breathy",
      "intimate",
      "gentle",
      "Sincere"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/4e204945670c460c86fdab57512cb308.mp3",
    "licensed": false,
    "fallbackGemini": "Leda"
  },
  {
    "id": "fish_b0a5473a0b6c486c90bb562c8e00dad1",
    "referenceId": "b0a5473a0b6c486c90bb562c8e00dad1",
    "name": "Trey - Calm voice",
    "tone": "Gentle and reassuring",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "middle-aged",
      "narration",
      "educational",
      "entertainment",
      "calm",
      "relaxed",
      "measured",
      "smooth",
      "warm",
      "friendly",
      "gentle",
      "clear",
      "narrative",
      "storytelling"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-07-19/acd3f3de02f344f59046fa1ff88d9cb6.mp3",
    "licensed": true,
    "fallbackGemini": "Achird"
  },
  {
    "id": "fish_6611aa6363d845eab454c442ee75f5af",
    "referenceId": "6611aa6363d845eab454c442ee75f5af",
    "name": "Calm Reflective Voice",
    "tone": "Reflective and gentle",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "middle-aged",
      "narration",
      "educational",
      "social-media",
      "medium",
      "calm",
      "relaxed",
      "warm",
      "smooth",
      "clear",
      "friendly",
      "gentle",
      "expressive",
      "storytelling",
      "measured"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-09-21/550b4bd202f1492bac1ae2fad79b93df.mp3",
    "licensed": true,
    "fallbackGemini": "Callirrhoe"
  },
  {
    "id": "fish_536d3a5e000945adb7038665781a4aca",
    "referenceId": "536d3a5e000945adb7038665781a4aca",
    "name": "Ethan",
    "tone": "Documentary narrator",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "middle-aged",
      "educational",
      "narration",
      "professional",
      "clear",
      "calm",
      "authoritative",
      "documentary"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/bdd677ed767744fc91f166468786264b.mp3",
    "licensed": false,
    "fallbackGemini": "Sadaltager"
  },
  {
    "id": "fish_fbc1029c018041d4b17f2c1e57222dff",
    "referenceId": "fbc1029c018041d4b17f2c1e57222dff",
    "name": "Richard",
    "tone": "British storyteller",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "english",
      "male",
      "narration",
      "en-gb",
      "storytelling"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-08-24/edcd8b0f98e442c781df2a7c53af2ca1.mp3",
    "licensed": false,
    "fallbackGemini": "Rasalgethi"
  },
  {
    "id": "fish_802e3bc2b27e49c2995d23ef70e6ac89",
    "referenceId": "802e3bc2b27e49c2995d23ef70e6ac89",
    "name": "Energetic Male",
    "tone": "Energetic presenter",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "young",
      "social-media",
      "advertisement",
      "energetic",
      "enthusiastic",
      "clear",
      "crisp",
      "announcer"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/04c54aec083e49feb366d3ec0578a8f6.mp3",
    "licensed": false,
    "fallbackGemini": "Fenrir"
  },
  {
    "id": "fish_9a9cf47702da476aa4629e2506d4a857",
    "referenceId": "9a9cf47702da476aa4629e2506d4a857",
    "name": "Hannah",
    "tone": "Confident presenter",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "middle-aged",
      "advertisement",
      "educational",
      "professional",
      "confident",
      "clear",
      "friendly",
      "Fitness"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/08d658835feb427db808e37060b78eb0.mp3",
    "licensed": false,
    "fallbackGemini": "Kore"
  },
  {
    "id": "fish_732ea755bd9e446eb31dc79966b50428",
    "referenceId": "732ea755bd9e446eb31dc79966b50428",
    "name": "Beau",
    "tone": "American conversational",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "english",
      "male",
      "en-us"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-08-24/b9d85f807049476a980673b8e17a96e3.mp3",
    "licensed": false,
    "fallbackGemini": "Puck"
  },
  {
    "id": "fish_b121b91872f54f04ba9f6da08b8b6253",
    "referenceId": "b121b91872f54f04ba9f6da08b8b6253",
    "name": "Chloe",
    "tone": "Youthful conversational",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "young",
      "conversational",
      "professional",
      "clear",
      "confident",
      "brisk",
      "english",
      "en-au"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-08-25/4200e2971aa04e319b47cdf8e969c502.mp3",
    "licensed": false,
    "fallbackGemini": "Zephyr"
  },
  {
    "id": "fish_4e407b98cb034f74b3863ec33c567c83",
    "referenceId": "4e407b98cb034f74b3863ec33c567c83",
    "name": "Child",
    "tone": "Bright childlike character",
    "gender": "Neutral",
    "languages": [
      "en"
    ],
    "tags": [
      "neutral",
      "young",
      "educational",
      "bright",
      "energetic",
      "cheerful",
      "playful",
      "character-voice",
      "Children's Content"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/ac454e91f68f474d89660f7c425144ef.mp3",
    "licensed": false,
    "fallbackGemini": "Leda"
  },
  {
    "id": "fish_0c0f9d7d87e44e2dabb53ebb092f5f53",
    "referenceId": "0c0f9d7d87e44e2dabb53ebb092f5f53",
    "name": "Child",
    "tone": "Soft childlike character",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "young",
      "conversational",
      "narration",
      "soft",
      "calm",
      "gentle",
      "intimate",
      "breathy"
    ],
    "previewUrl": "https://platform.r2.fish.audio/task/812b4ae28012474bbe3aa25e52f57668.mp3",
    "licensed": false,
    "fallbackGemini": "Leda"
  },
  {
    "id": "fish_a754ca8729d642d9a918a42b5b6a77d1",
    "referenceId": "a754ca8729d642d9a918a42b5b6a77d1",
    "name": "Dave - Australian Male",
    "tone": "Australian conversational",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "middle-aged",
      "narration",
      "conversational",
      "calm",
      "relaxed",
      "measured",
      "clear",
      "warm",
      "confident",
      "storytelling",
      "narrative",
      "documentary"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-08-06/fe8056a322c444a6b7be2c217cf41ff4.mp3",
    "licensed": true,
    "fallbackGemini": "Achird"
  },
  {
    "id": "fish_7bdfbb63c9754f4f892aac70bebea123",
    "referenceId": "7bdfbb63c9754f4f892aac70bebea123",
    "name": "Nigerian Male Narrator",
    "tone": "Nigerian narrator",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "young",
      "conversational",
      "narration",
      "educational",
      "calm",
      "smooth",
      "measured",
      "friendly",
      "gentle",
      "empathetic",
      "storytelling",
      "clear"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-10-26/e2e26b76b7f4489db526e0bf8a8aad0f.mp3",
    "licensed": true,
    "fallbackGemini": "Orus"
  },
  {
    "id": "fish_8b077acc61e8431093ae2776d386d929",
    "referenceId": "8b077acc61e8431093ae2776d386d929",
    "name": "OLAJUMOKE",
    "tone": "Warm conversational",
    "gender": "Female",
    "languages": [
      "en"
    ],
    "tags": [
      "female",
      "young",
      "narration",
      "educational",
      "entertainment",
      "conversational",
      "medium",
      "soft",
      "warm",
      "smooth",
      "calm",
      "relaxed",
      "measured",
      "gentle",
      "clear",
      "expressive",
      "storytelling",
      "narrative"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-08-11/bf9ddd5184b64390b6f91539ed03a82f.mp3",
    "licensed": true,
    "fallbackGemini": "Sulafat"
  },
  {
    "id": "fish_ad01efb4957d43d7822a52a8b86bf14f",
    "referenceId": "ad01efb4957d43d7822a52a8b86bf14f",
    "name": "Calm Morning Voice from Lancashire",
    "tone": "Lancashire conversational",
    "gender": "Male",
    "languages": [
      "en"
    ],
    "tags": [
      "male",
      "middle-aged",
      "narration",
      "conversational",
      "educational",
      "calm",
      "relaxed",
      "warm",
      "clear",
      "smooth",
      "friendly",
      "measured",
      "storytelling",
      "narrative",
      "professional"
    ],
    "previewUrl": "https://platform.r2.fish.audio/tasks/2026-10-03/d66f76af58e44631be6ef5e260d1c276.mp3",
    "licensed": true,
    "fallbackGemini": "Charon"
  }
];
export const DEFAULT_FISH_VOICE = 'fish_14e37eff00a843ed9a9daa5ece7988da';
export const fishVoice = (id: unknown): FishVoice | undefined => FISH_VOICES.find(v => v.id === id);
export const isFishVoiceId = (id: unknown): boolean => typeof id === 'string' && id.startsWith('fish_');
