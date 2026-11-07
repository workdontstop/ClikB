/** Read-only live-state question; never interprets an instruction to change permission. */
export const isAutoControlStateQuestion = (userText: unknown): boolean => {
  const text = String(userText || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (/^(?:is|are)\s+(?:the\s+|my\s+)?(?:auto\s*control|ai\s*control|control)(?:\s+\w+){0,4}\s+(?:on|off|enabled|active)\b/.test(text)) return true;
  if (/^(?:do i|does clikb|does the app)\s+(?:have\s+)?(?:auto\s*control|ai\s*control|control)(?:\s+\w+){0,3}\s+(?:on|off|enabled|active)\b/.test(text)) return true;
  if (/^(?:what is|tell me)\s+(?:the\s+)?(?:auto\s*control|ai\s*control|control)\s+(?:status|state)\b/.test(text)) return true;
  return /^(?:can you|are you able to)\b.*\b(?:control|click|navigate)\b.*\b(?:clikb|the app|this app)\b/.test(text);
};

export const autoControlStateAnswer = (snapshot: any): string => {
  const control = snapshot?.autoControl;
  if (typeof control?.enabled !== 'boolean') {
    return "I can't confirm the current Auto Control state from the app right now. The pill itself shows whether it is On or Off.";
  }
  if (!control.conciergeEnabled) {
    return 'Guide Mode is Off, so Auto Control is Off and hidden. Turn Guide Mode on before using AI app control.';
  }
  if (control.enabled) {
    return 'Auto Control is On. I can use supported ClikB controls when you ask, subject to the live control and safety checks.';
  }
  return control.visible
    ? 'Auto Control is Off. The pill is visible; tap it to turn it On before I can click or scroll in ClikB.'
    : 'Auto Control is Off and hidden. Use Control in the Guide or chat to show the pill, then turn it On before I can click or scroll.';
};
