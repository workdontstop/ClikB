import axios from "axios";

/** Called only when the user explicitly selects an OpenAI-backed model. */
export const notifyOpenAiSelected = async (): Promise<void> => {
  const clikUrl = import.meta.env.VITE_CLIK_URL;
  try {
    await axios.post(
      `${clikUrl}/ai-provider/select-openai`,
      {},
      { withCredentials: true },
    );
  } catch (error) {
    console.warn("Could not register the explicit OpenAI selection.", error);
  }
};
