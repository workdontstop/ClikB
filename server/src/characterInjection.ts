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
    // To match the frontend injection, remove spaces from the reference name
    const nameNoSpaces = char.name.replace(/\s+/g, '');
    const tokenRegex = new RegExp(`@${nameNoSpaces}`, 'gi');
    if (tokenRegex.test(finalPrompt)) {
      if (syntaxType === "flux") {
        newInputs.push(char.url);
        fluxSeedreamCount++;
        finalPrompt = finalPrompt.replace(tokenRegex, `<image_${fluxSeedreamCount}>`);
      } else if (syntaxType === "seedream") {
        newInputs.push(char.url);
        finalPrompt = finalPrompt.replace(tokenRegex, `<subject_${fluxSeedreamCount}>`);
        fluxSeedreamCount++;
      } else if (syntaxType === "fal") {
        const labelStr = `Subject ${String.fromCharCode(65 + falIdx)}`;
        falReferences.push({ url: char.url, label: labelStr });
        finalPrompt = finalPrompt.replace(tokenRegex, `[${labelStr}]`);
        falIdx++;
      }
    }
  }

  return { newPrompt: finalPrompt, updatedInputs: newInputs, falReferences };
}
