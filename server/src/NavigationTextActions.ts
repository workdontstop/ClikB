export function navigationTextLimit(id: string): number {
  if (id === 'clikb.navigation.social_chat.action.compose') return 2000;
  if (id === 'clikb.navigation.social_chat.action.member_search') return 64;
  if (id === 'clikb.navigation.profile_image.action.ai_prompt') return 1000;
  if (id === 'clikb.navigation.profile_image.action.image_prompt') return 6000;
  if (/^clikb\.navigation\.creative_profiles_(profile|settings)\.action\.username$/.test(id)) return 32;
  if (/^clikb\.navigation\.creative_profiles_(profile|settings|cover)\.action\.profile_name$/.test(id)) return 60;
  if (/^clikb\.navigation\.creative_profiles_(profile|settings|cover)\.action\.profile_bio$/.test(id)) return 500;
  return 0;
}
