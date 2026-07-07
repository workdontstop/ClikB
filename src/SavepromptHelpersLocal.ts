// Call this function to save the uploaded image URL to local storage for later cleanup
export const Saveprompthelperfordellater = (url: string) => {
  if (!url) return;

  try {
    ///alert("kjjkkjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj");
    // 1. Define the storage key
    const STORAGE_KEY = "helperimagesprompt";

    // 2. Get existing array from local storage (or default to empty array)
    const storedData = localStorage.getItem(STORAGE_KEY);
    const existingImages = storedData ? JSON.parse(storedData) : [];

    // 3. Create the new entry with a timestamp
    const newEntry = {
      url: url,
      timestamp: Date.now(), // Saves current time in milliseconds
    };

    // 4. Add to array
    const updatedImages = [...existingImages, newEntry];

    // 5. Save back to local storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedImages));

    console.log("Saved helper image to local storage:", newEntry);
  } catch (error) {
    console.error("Failed to save helper image to local storage:", error);
  }
};

// Call this to save the video URL to local storage for later cleanup
export const SaveVideoHelperForDelLater = (url: string) => {
  if (!url) return;

  try {
    // 1. Define a unique storage key for videos
    const STORAGE_KEY = "helpervideosprompt";

    // 2. Get existing array (or default to empty)
    const storedData = localStorage.getItem(STORAGE_KEY);
    const existingVideos = storedData ? JSON.parse(storedData) : [];

    // 3. Create entry with timestamp
    const newEntry = {
      url: url,
      timestamp: Date.now(),
    };

    // 4. Add to array
    const updatedVideos = [...existingVideos, newEntry];

    // 5. Save back to local storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedVideos));

    console.log("Saved helper video to local storage:", newEntry);
  } catch (error) {
    console.error("Failed to save helper video to local storage:", error);
  }
};

// Call this to save a generated audio URL to local storage for later cleanup
export const SaveAudioHelperForDelLater = (url: string) => {
  if (!url) return;

  try {
    const STORAGE_KEY = "helperaudiosprompt";
    const storedData = localStorage.getItem(STORAGE_KEY);
    const existingAudios = storedData ? JSON.parse(storedData) : [];
    const newEntry = {
      url,
      timestamp: Date.now(),
    };
    const updatedAudios = [...existingAudios, newEntry];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAudios));
    console.log("Saved helper audio to local storage:", newEntry);
  } catch (error) {
    console.error("Failed to save helper audio to local storage:", error);
  }
};

// Call this to remove specific URLs from the image cleanup list (e.g., when published)
export const RemoveFromDeleteLater = (urlsToRemove: (string | null)[]) => {
  if (!urlsToRemove || urlsToRemove.length === 0) return;

  try {
    const STORAGE_KEY = "helperimagesprompt";
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) return;

    const existingImages = JSON.parse(storedData);
    const validUrlsToRemove = new Set(urlsToRemove.filter(Boolean));

    const updatedImages = existingImages.filter(
      (entry: { url: string }) => !validUrlsToRemove.has(entry.url)
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedImages));
    console.log("Removed in-use images from cleanup list:", validUrlsToRemove);
  } catch (error) {
    console.error("Failed to remove images from local storage:", error);
  }
};

// Call this to remove specific URLs from the video cleanup list
export const RemoveVideoFromDeleteLater = (urlsToRemove: (string | null)[]) => {
  if (!urlsToRemove || urlsToRemove.length === 0) return;

  try {
    const STORAGE_KEY = "helpervideosprompt";
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) return;

    const existingVideos = JSON.parse(storedData);
    const validUrlsToRemove = new Set(urlsToRemove.filter(Boolean));

    const updatedVideos = existingVideos.filter(
      (entry: { url: string }) => !validUrlsToRemove.has(entry.url)
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedVideos));
    console.log("Removed in-use videos from cleanup list:", validUrlsToRemove);
  } catch (error) {
    console.error("Failed to remove videos from local storage:", error);
  }
};

// Call this to remove specific URLs from the audio cleanup list
export const RemoveAudioFromDeleteLater = (urlsToRemove: (string | null)[]) => {
  if (!urlsToRemove || urlsToRemove.length === 0) return;

  try {
    const STORAGE_KEY = "helperaudiosprompt";
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) return;

    const existingAudios = JSON.parse(storedData);
    const validUrlsToRemove = new Set(urlsToRemove.filter(Boolean));

    const updatedAudios = existingAudios.filter(
      (entry: { url: string }) => !validUrlsToRemove.has(entry.url)
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAudios));
    console.log("Removed in-use audios from cleanup list:", validUrlsToRemove);
  } catch (error) {
    console.error("Failed to remove audios from local storage:", error);
  }
};
