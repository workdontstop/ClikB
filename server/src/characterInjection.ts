import { cleanPromptLiterals, mapUnquotedPromptText } from './promptLiterals';

export interface ActiveCharacter {
  name: string;
  url: string;
}

export function applyCharacterInjection(
  prompt: string,
  activeCharacters: ActiveCharacter[] = [],
  syntaxType: "flux" | "seedream" | "fal",
  existingInputs: string[] = []
): { newPrompt: string; updatedInputs: string[]; falReferences: any[] } {
  prompt = cleanPromptLiterals(prompt);
  if (!activeCharacters || !activeCharacters.length || !prompt) {
    return { newPrompt: prompt || "", updatedInputs: existingInputs, falReferences: [] };
  }

  let finalPrompt = prompt;
  const newInputs = [...existingInputs];
  const falReferences: any[] = [];

  const sortedCast = [...activeCharacters].sort((a, b) => b.name.length - a.name.length);

  let fluxSeedreamCount = existingInputs.length; 
  let falIdx = 0;

  for (const char of sortedCast) {
    // Frontend handles compact @names; authored prompts can also use spaced names.
    // Escape punctuation and require a word boundary so @Ann never consumes @Anna.
    const rawName = String(char.name || '').trim().replace(/^@/, '');
    const compactName = rawName.replace(/[^A-Za-z0-9_]/g, '');
    if (!compactName || !char.url) continue;
    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const spacedName = rawName.split(/\s+/).map(escapeRegex).join('\\s+');
    const variants = spacedName && spacedName.toLowerCase() !== compactName.toLowerCase()
      ? `${escapeRegex(compactName)}|${spacedName}` : escapeRegex(compactName);
    const tokenRegex = new RegExp(`@(?:${variants})(?![A-Za-z0-9_])`, 'gi');
    let found = false;
    mapUnquotedPromptText(finalPrompt, outside => {
      tokenRegex.lastIndex = 0;
      if (tokenRegex.test(outside)) found = true;
      return outside;
    });
    const replaceHandle = (replacement: string) => mapUnquotedPromptText(finalPrompt, outside => outside.replace(tokenRegex, replacement));
    if (found) {
      if (syntaxType === "flux") {
        newInputs.push(char.url);
        fluxSeedreamCount++;
        finalPrompt = replaceHandle(`<image_${fluxSeedreamCount}>`);
      } else if (syntaxType === "seedream") {
        newInputs.push(char.url);
        finalPrompt = replaceHandle(`<subject_${fluxSeedreamCount}>`);
        fluxSeedreamCount++;
      } else if (syntaxType === "fal") {
        const labelStr = `Subject ${String.fromCharCode(65 + falIdx)}`;
        falReferences.push({ url: char.url, label: labelStr });
        finalPrompt = replaceHandle(`[${labelStr}]`);
        falIdx++;
      }
    }
  }

  return { newPrompt: finalPrompt, updatedInputs: newInputs, falReferences };
}
