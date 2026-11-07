// Single timing rule for the pre-React cover, Redux initial state and App.tsx.
// Light from 03:00 until 15:00; dark from 15:00 until 03:00.
// Change the hours HERE once; Vite also embeds this function into index.html.
export function isScheduledDarkMode(hour: number): boolean {
  const lightModeStartsAt = 3; // 3am    ////return false;
  const darkModeStartsAt = 15; // 3pm   ////return true;
  return hour < lightModeStartsAt || hour >= darkModeStartsAt;
  ///return true;
}
