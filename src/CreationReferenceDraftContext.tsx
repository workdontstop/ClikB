import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type CreationVipCharacter = {
  name?: string;
  description?: string;
  imageUrl?: string;
  source?: "world" | "upload" | string;
  worldId?: string | number;
  assetKind?: "character" | "environment" | "object";
  [key: string]: any;
};

export type CreationReferenceDraft = {
  generatedImages: string[];
  vipCharacters: CreationVipCharacter[];
  remixData: string;
  worldCover: string;
  worldStyle: string;
  selectedWorldId: string | number | null;
};

type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

export type CreationReferenceDraftContextValue = {
  generatedImages: string[];
  setGeneratedImages: StateSetter<string[]>;
  vipCharacters: CreationVipCharacter[];
  setVipCharacters: StateSetter<CreationVipCharacter[]>;
  remixData: string;
  setRemixData: StateSetter<string>;
  worldCover: string;
  setWorldCover: StateSetter<string>;
  worldStyle: string;
  setWorldStyle: StateSetter<string>;
  selectedWorldId: string | number | null;
  setSelectedWorldId: StateSetter<string | number | null>;
  clearCreationReferences: () => void;
};

const createEmptyDraft = (): CreationReferenceDraft => ({
  generatedImages: [],
  vipCharacters: [],
  remixData: "",
  worldCover: "",
  worldStyle: "",
  selectedWorldId: null,
});

const resolveStateUpdate = <T,>(
  update: React.SetStateAction<T>,
  previous: T,
): T => (
  typeof update === "function"
    ? (update as (value: T) => T)(previous)
    : update
);

const CreationReferenceDraftContext = createContext<CreationReferenceDraftContextValue | null>(null);

export const useCreationReferenceDraftState = (): CreationReferenceDraftContextValue => {
  const [draft, setDraft] = useState<CreationReferenceDraft>(createEmptyDraft);

  const setGeneratedImages = useCallback<StateSetter<string[]>>((update) => {
    setDraft((previous) => ({
      ...previous,
      generatedImages: resolveStateUpdate(update, previous.generatedImages),
    }));
  }, []);

  const setVipCharacters = useCallback<StateSetter<CreationVipCharacter[]>>((update) => {
    setDraft((previous) => ({
      ...previous,
      vipCharacters: resolveStateUpdate(update, previous.vipCharacters),
    }));
  }, []);

  const setRemixData = useCallback<StateSetter<string>>((update) => {
    setDraft((previous) => ({
      ...previous,
      remixData: resolveStateUpdate(update, previous.remixData),
    }));
  }, []);

  const setWorldCover = useCallback<StateSetter<string>>((update) => {
    setDraft((previous) => ({
      ...previous,
      worldCover: resolveStateUpdate(update, previous.worldCover),
    }));
  }, []);

  const setWorldStyle = useCallback<StateSetter<string>>((update) => {
    setDraft((previous) => ({
      ...previous,
      worldStyle: resolveStateUpdate(update, previous.worldStyle),
    }));
  }, []);

  const setSelectedWorldId = useCallback<StateSetter<string | number | null>>((update) => {
    setDraft((previous) => ({
      ...previous,
      selectedWorldId: resolveStateUpdate(update, previous.selectedWorldId),
    }));
  }, []);

  const clearCreationReferences = useCallback(() => {
    // Explicit PromptToolbar reset: clear every selected creation reference.
    setDraft(createEmptyDraft());
  }, []);

  return useMemo(() => ({
    generatedImages: draft.generatedImages,
    setGeneratedImages,
    vipCharacters: draft.vipCharacters,
    setVipCharacters,
    remixData: draft.remixData,
    setRemixData,
    worldCover: draft.worldCover,
    setWorldCover,
    worldStyle: draft.worldStyle,
    setWorldStyle,
    selectedWorldId: draft.selectedWorldId,
    setSelectedWorldId,
    clearCreationReferences,
  }), [
    clearCreationReferences,
    draft,
    setGeneratedImages,
    setRemixData,
    setSelectedWorldId,
    setVipCharacters,
    setWorldCover,
    setWorldStyle,
  ]);
};

export const CreationReferenceDraftProvider: React.FC<{
  value: CreationReferenceDraftContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <CreationReferenceDraftContext.Provider value={value}>
    {children}
  </CreationReferenceDraftContext.Provider>
);

export const useCreationReferenceDraft = (): CreationReferenceDraftContextValue => {
  const value = useContext(CreationReferenceDraftContext);
  if (!value) {
    throw new Error("useCreationReferenceDraft must be used inside CreationReferenceDraftProvider");
  }
  return value;
};
