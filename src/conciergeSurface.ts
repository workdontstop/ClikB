export const conciergeSurface = (darkMode:boolean,accent:string) => ({
 bgcolor:darkMode?'#15161a':'#fff',
 backgroundImage:`radial-gradient(circle at 100% 0%, ${accent}${darkMode?'1f':'18'}, transparent ${darkMode?'36':'38'}%)`,
});
