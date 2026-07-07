// ArtStyleSelector.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { Box, Button, List, ListItemButton, Typography, CircularProgress, IconButton, Modal } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "./store";
import axios from "axios";
import { setPixels } from "./settingsSlice";
import { calcModelPixels } from "./ModelPixels";

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

// âœ… Your old list becomes "Favorites"
export const FAVORITE_STYLES: string[] = [
    "3D Animation",
    "PhotoRealistic",
    "3D Render",
    "Cinematic",
    "Final Fantasy",
    "Anime",
    "Comic Book",
    "MineCraft",
    "Fantasy",
    "Realism",
    "Renaissance",
    "Watercolor",
    "HDR Photography",
    "CCTV Camera",
    "Wireframe",
    "3D Render CGI",
    "Pixel",
    "2D Game",
    "Cyberpunk",
    "Synthwave",
    "Sci-Fi",
    "Pop"
];

// âœ… Existing categories + Favorites at the top
export const ART_STYLE_CATEGORIES: Record<string, string[]> = {
    Favorites: FAVORITE_STYLES,

    "Classical & Fine Art Movements": [
        "Renaissance",
        "Baroque",
        "Rococo",
        "Neoclassical",
        "Romanticism",
        "Realism",
        "Impressionism",
        "Post-Impressionism",
        "Expressionism",
        "Pointillism",
        "Symbolism",
        "Pre-Raphaelite",
        "Gothic",
        "Medieval Illumination",
        "Byzantine",
        "Ukiyo-e",
        "Persian Miniature",
        "Art Nouveau",
        "Victorian",
        "Academic Classicism",
        "Mannerism",
        "Ancient Egyptian",
        "Ancient Greek Vase Painting",
        "Islamic Geometric",
        "Celtic Knot",
        "Gothic Architecture",
        "Rayonism"
    ],

    "Modern & 20th-Century Art Styles": [
        "Cubism",
        "Surrealism",
        "Dadaism",
        "Futurism",
        "Abstract",
        "Abstract Expressionism",
        "Pop",
        "Minimalism",
        "Op",
        "Bauhaus",
        "Constructivism",
        "De Stijl",
        "Suprematism",
        "Neo-Futurism",
        "Lowbrow (Pop Surrealism)",
        "Photorealism",
        "Postmodern",
        "Street",
        "Graffiti",
        "Brutalist",
        "Propaganda Poster",
        "Halftone Print",
        "Hyperrealism"
    ],

    "Art Mediums & Techniques": [
        "Watercolor",
        "Oil Painting",
        "Acrylic Painting",
        "Ink Wash Painting",
        "Charcoal Drawing",
        "Pencil Sketch",
        "Pastel Drawing",
        "Marker Illustration",
        "Crayon",
        "Collage",
        "Mosaic",
        "Quilling",
        "Papercraft",
        "Origami",
        "Clay Sculpture / Claymation",
        "Woodcut Print",
        "Linocut",
        "Etching",
        "Engraving",
        "Silkscreen / Screenprint",
        "Airbrush",
        "Stencil",
        "Spray Paint",
        "Calligraphy",
        "Typography",
        "Crosshatching",
        "Childlike Crayon Drawing"
    ],

    "Photography & Cinematography Styles": [
        "Photorealistic",
        "Black and White Photography",
        "Vintage Photography",
        "Sepia Tone",
        "Analog Film",
        "HDR Photography",
        "Macro Photography",
        "Street Photography",
        "Documentary Photography",
        "Film Noir",
        "Long Exposure",
        "Studio Portrait",
        "Polaroid Instant Photo",
        "Lomography",
        "Kodachrome Palette",
        "Infrared Photography",
        "Fisheye Lens",
        "Tilt-Shift",
        "Bokeh Background",
        "High-Key Photography",
        "Low-Key Photography",
        "Dutch Angle",
        "Birdâ€™s-Eye View",
        "Wormâ€™s-Eye View",
        "Chiaroscuro Lighting",
        "Neon Lighting",
        "Golden Hour Lighting",
        "Blue Hour Lighting",
        "Volumetric Lighting",
        "Candlelight",
        "Moonlight",
        "Daguerreotype",
        "Tintype Photography",
        "CCTV Camera",
        "Thermal Imaging",
        "Double Exposure"
    ],

    "Digital, CGI & 3D Styles": [
        "Pixel",
        "Voxel",
        "Low-Poly 3D",
        "Isometric",
        "3D Render (CGI)",
        "3D Model",
        "Vector",
        "Line",
        "Flat Design Illustration",
        "Geometric Abstract",
        "Fractal",
        "Glitch",
        "ASCII",
        "Anaglyph 3D",
        "Wireframe",
        "Blueprint",
        "Digital Painting",
        "Matte Painting",
        "Photobash",
        "Unreal Engine Render",
        "Octane Render",
        "Holographic",
        "DeepDream"
    ],

    "Cartoon, Comic & Animation Styles": [
        "Anime",
        "Manga",
        "Chibi",
        "Western Cartoon",
        "Disney Animation",
        "3D Animation",
        "Studio Ghibli",
        "Comic Book",
        "Graphic Novel",
        "Webtoon",
        "2D Game",
        "Cel-Shaded",
        "Stop-Motion",
        "Claymation",
        "Lego Brick",
        "Caricature",
        "Rubber Hose Animation",
        "Sunday Comics",
        "The Simpsons",
        "Manhwa",
        "Kawaii",
        "Mecha Anime",
        "Childrenâ€™s Book Illustration",
        "Retro Cartoon",
        "Noir Comic",
        "Animated Film Concept"
    ],

    "Sci-Fi, Fantasy & Punk Aesthetics": [
        "Cyberpunk",
        "Steampunk",
        "Dieselpunk",
        "Solarpunk",
        "Atompunk",
        "Raypunk",
        "Biopunk",
        "Clockpunk",
        "Mythpunk",
        "Dark Fantasy",
        "High Fantasy",
        "Lovecraftian Horror",
        "Cosmic Horror",
        "Gothic Horror",
        "Post-Apocalyptic",
        "Dystopian Future",
        "Utopian Futurism",
        "Sci-Fi Concept",
        "Space",
        "Retro Futurism",
        "Sci-Fi Noir",
        "Grimdark",
        "Mythology",
        "Medieval Fantasy",
        "Sword and Sorcery",
        "Techno-Organic",
        "Alien Landscape",
        "General Sci-Fi"
    ],

    "Contemporary Internet Aesthetics": [
        "Vaporwave",
        "Synthwave",
        "Retrowave",
        "Glitchcore",
        "Weirdcore",
        "Dreamcore",
        "Analog Horror",
        "Cottagecore",
        "Dark Academia",
        "Afrofuturism",
        "Y2K Aesthetic",
        "Grunge Aesthetic",
        "Cyber Y2K",
        "Lo-Fi Aesthetic",
        "Psychedelic",
        "Trippy",
        "Minimalist Aesthetic",
        "Maximalist Aesthetic",
        "Monochromatic Aesthetic",
        "Duotone",
        "Pastel Aesthetic",
        "Neon Noir",
        "Chromatic Aberration",
        "Seapunk",
        "Memphis Design",
        "High-Fashion Editorial",
        "Blacklight Poster"
    ],

    "Iconic Artist & Pop-Culture Styles": [
        "Van Gogh",
        "Picasso",
        "Salvador DalÃ­",
        "M.C. Escher",
        "Andy Warhol",
        "Banksy",
        "H.R. Giger",
        "Greg Rutkowski",
        "Thomas Kinkade",
        "Walt Disney",
        "Tim Burton",
        "Wes Anderson",
        "Studio Ghibli",
        "Marvel Comic",
        "DC Comics",
        "Arcane (Netflix)",
        "Sin City",
        "Dragon Ball Anime",
        "Hello Kitty Kawaii",
        "Lego Movie",
        "Barbiecore",
        "Emoji",
        "Material Design",
        "Minecraft Pixel",
        "Final Fantasy",
        "Star Wars Concept",
        "Norman Rockwell",
        "Roy Lichtenstein",
        "Jean-Michel Basquiat",
        "Takashi Murakami",
        "Yayoi Kusama",
        "Moebius",
        "Frida Kahlo",
        "Edvard Munch",
        "Leonardo da Vinci",
        "Michelangelo",
        "Rembrandt",
        "Caravaggio",
        "Claude Monet",
        "Gustav Klimt",
        "Dr. Seuss",
        "Bob Ross"
    ]
};


// Optional: flat array if you want all styles somewhere else
export const allArtStyles: string[] = Array.from(
    new Set(Object.values(ART_STYLE_CATEGORIES).flat())
);

type Props = {
    matchMobile: boolean;
    dividerColor: string;
    selectedStyle: string | null;
    handleSelectStyle: (style: string) => void;
    selectedItemStyle: React.CSSProperties;
    defaultItemStyle: React.CSSProperties;
    imagesMap: Record<string, string>;
    setImagesMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    generatingStyle: string | null;
    setGeneratingStyle: (style: string | null) => void;
    progress: number;
    setProgress: React.Dispatch<React.SetStateAction<number>>;
    showReGenPill: Record<string, boolean>;
    setShowReGenPill: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    handleGenerateImage: (e: React.MouseEvent, styleName: string) => Promise<void>;
};

export const ArtStyleSelector: React.FC<Props> = ({
    matchMobile,
    dividerColor,
    selectedStyle,
    handleSelectStyle,
    selectedItemStyle,
    defaultItemStyle,
    imagesMap,
    setImagesMap,
    generatingStyle,
    setGeneratingStyle,
    progress,
    setProgress,
    showReGenPill,
    setShowReGenPill,
    handleGenerateImage
}) => {
    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    const activeModel = useSelector((state: RootState) => state.settings.model);

    const categoryKeys = Object.keys(ART_STYLE_CATEGORIES);
    const [selectedCategory, setSelectedCategory] = useState<string>("Favorites");

    const stylesForSelectedCategory = useMemo(
        () => ART_STYLE_CATEGORIES[selectedCategory] || [],
        [selectedCategory]
    );

    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const reGenTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (reGenTimeoutRef.current) {
                clearTimeout(reGenTimeoutRef.current);
            }
        };
    }, []);

    const textColor = darkModeReducer ? "#ffffff" : "#000000";
    const appColor = darkModeReducer ? '#E8BAFA' : '#0099cc';
    const subtleBorderColor = darkModeReducer
        ? "rgba(255,255,255,0.15)"
        : "rgba(0,0,0,0.12)";
    const scrollbarThumbColor = darkModeReducer
        ? "rgba(255,255,255,0.35)"
        : "rgba(0,0,0,0.3)";
    const scrollbarTrackColor = "transparent";

    // Cost calculation to show on UI
    const generationCost = calcModelPixels({ model: activeModel, baseImagesPerDollar: 333 });

    return (
        <Box onClick={(e) => e.stopPropagation()}>
            {/* ðŸ”¹ HORIZONTAL CATEGORY BAR */}
            <Box
                sx={{
                    display: "flex",
                    overflowX: "auto",
                    gap: 1,
                    pb: 1,
                    mb: 1,
                    borderBottom: `1px solid ${subtleBorderColor}`,
                    "&::-webkit-scrollbar": { display: "none" },
                    scrollbarWidth: "none",
                    msOverflowStyle: "none"
                }}
            >
                {categoryKeys.map((category) => {
                    const isActive = category === selectedCategory;
                    return (
                        <Button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            sx={{
                                flexShrink: 0,
                                textTransform: "none",
                                fontSize: matchMobile ? "0.75rem" : "0.85rem",
                                borderRadius: 999,
                                px: 2,
                                py: 0.5,
                                border: "1px solid",
                                borderColor: isActive ? dividerColor : "transparent",
                                opacity: isActive ? 1 : 1,
                                fontWeight: isActive ? 620 : 600,
                                color: textColor
                            }}
                        >
                            {category}
                        </Button>
                    );
                })}
            </Box>

            {/* ðŸ”¹ VERTICAL LIST OF STYLES */}
            <List
                sx={{
                    maxHeight: matchMobile ? "55vh" : "60vh",
                    overflowY: "auto",
                    overflowX: "hidden",
                    mt: 1,
                    borderTop: `1px solid ${subtleBorderColor}`,
                    scrollbarWidth: "thin",
                    scrollbarColor: `${scrollbarThumbColor} ${scrollbarTrackColor}`,
                    "&::-webkit-scrollbar": { width: "6px" },
                    "&::-webkit-scrollbar-track": { background: scrollbarTrackColor },
                    "&::-webkit-scrollbar-thumb": {
                        backgroundColor: scrollbarThumbColor,
                        borderRadius: "999px"
                    }
                }}
            >
                {stylesForSelectedCategory.map((style) => {
                    const hasImage = !!imagesMap[style];
                    const isGenerating = generatingStyle === style;
                    const isSelected = selectedStyle === style;

                    return (
                        <Box
                            key={style}
                            sx={{
                                position: "relative",
                                marginBottom: "8px"
                            }}
                        >
                            <ListItemButton
                                selected={isSelected}
                                onClick={() => handleSelectStyle(style)}
                                style={{
                                    ...defaultItemStyle,
                                    ...(isSelected ? selectedItemStyle : {}),
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: hasImage ? "0px" : "8px 16px",
                                    height: hasImage ? "25vh" : "auto",
                                    overflow: "hidden",
                                    borderRadius: "12px",
                                    border: hasImage ? `1px solid ${subtleBorderColor}` : "none",
                                    position: "relative",
                                    backgroundColor: isSelected ? (darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)") : "transparent"
                                }}
                            >
                                {hasImage ? (
                                    <>
                                        {/* Glass Design with Image */}
                                        <Box sx={{ p: 2, zIndex: 2, flex: darkModeReducer ? 1 : "0 0 30%", width: darkModeReducer ? "auto" : "30%", maxWidth: darkModeReducer ? "none" : "30%", background: darkModeReducer ? "linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 100%)" : "#9f9f9f", height: "100%", display: "flex", alignItems: "center" }}>
                                            <Typography variant="h6" sx={{ color: darkModeReducer ? "#fff" : "#111", fontWeight: "bold", textShadow: darkModeReducer ? "0px 2px 4px rgba(0,0,0,0.5)" : "none" }}>
                                                {style}
                                            </Typography>
                                        </Box>
                                        <Box
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFullScreenImage(imagesMap[style]);
                                            }}
                                            sx={{
                                                position: "absolute",
                                                top: 0,
                                                right: 0,
                                                bottom: 0,
                                                width: "70%",
                                                backgroundImage: `url(${imagesMap[style]})`,
                                                backgroundSize: "cover",
                                                backgroundPosition: "center",
                                                borderTopRightRadius: "12px",
                                                borderBottomRightRadius: "12px",
                                                boxShadow: darkModeReducer ? "inset 20px 0px 20px -10px rgba(0,0,0,0.8)" : "none",
                                                cursor: "pointer",
                                                "&:hover": {
                                                    opacity: 0.9,
                                                }
                                            }}
                                        />
                                    </>
                                ) : (
                                    <>
                                        {/* Classic Text Mode */}
                                        <Typography variant="body1" sx={{ color: textColor, fontWeight: isSelected ? "bold" : "normal" }}>
                                            {style}
                                        </Typography>

                                        {isGenerating ? (
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    width: "120px",
                                                    height: "28px",
                                                    borderRadius: "999px",
                                                    overflow: "hidden",
                                                    border: `1px solid ${dividerColor}`,
                                                    background: darkModeReducer ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center"
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        position: "absolute",
                                                        top: 0,
                                                        left: 0,
                                                        bottom: 0,
                                                        width: `${Math.round(progress)}%`,
                                                        background: appColor,
                                                        transition: "width 0.1s linear",
                                                        zIndex: 1
                                                    }}
                                                />
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        zIndex: 2,
                                                        color: "#fff",
                                                        fontWeight: "bold",
                                                        textShadow: "0px 1px 2px rgba(0,0,0,0.6)"
                                                    }}
                                                >
                                                    {Math.round(progress)}%
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={(e) => handleGenerateImage(e, style)}
                                                sx={{
                                                    borderRadius: 999,
                                                    textTransform: "none",
                                                    fontSize: "0.7rem",
                                                    minWidth: "120px",
                                                    borderColor: dividerColor,
                                                    color: textColor
                                                }}
                                            >
                                                Generate ({generationCost}p)
                                            </Button>
                                        )}
                                    </>
                                )}
                            </ListItemButton>

                            {/* Re-generate feature overlay (placed outside the button, inside the relative Box wrapper) */}
                            {hasImage && isSelected && (
                                <>
                                    {isGenerating ? (
                                        <Box
                                            onClick={(e) => e.stopPropagation()}
                                            sx={{
                                                position: "absolute",
                                                bottom: 12,
                                                right: 12,
                                                zIndex: 100,
                                                width: "120px",
                                                height: "28px",
                                                borderRadius: "999px",
                                                overflow: "hidden",
                                                border: "1px solid rgba(255, 255, 255, 0.4)",
                                                background: "rgba(0,0,0,0.6)",
                                                backdropFilter: "blur(6px)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center"
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    top: 0,
                                                    left: 0,
                                                    bottom: 0,
                                                    width: `${Math.round(progress)}%`,
                                                    background: appColor,
                                                    transition: "width 0.1s linear",
                                                    zIndex: 1
                                                }}
                                            />
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    zIndex: 2,
                                                    color: "#fff",
                                                    fontWeight: "bold",
                                                    textShadow: "0px 1px 2px rgba(0,0,0,0.6)"
                                                }}
                                            >
                                                {Math.round(progress)}%
                                            </Typography>
                                        </Box>
                                    ) : showReGenPill[style] ? (
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={(e) => handleGenerateImage(e, style)}
                                            sx={{
                                                position: "absolute",
                                                bottom: 12,
                                                right: 12,
                                                zIndex: 100,
                                                borderRadius: 999,
                                                textTransform: "none",
                                                fontSize: "0.75rem",
                                                fontWeight: "bold",
                                                background: "rgba(255, 255, 255, 0.25)",
                                                backdropFilter: "blur(8px)",
                                                border: "1px solid rgba(255, 255, 255, 0.4)",
                                                color: "#fff",
                                                boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
                                                "&:hover": {
                                                    background: "rgba(255, 255, 255, 0.35)",
                                                }
                                            }}
                                        >
                                            Re-generate ({generationCost}p)
                                        </Button>
                                    ) : (
                                        <>
                                            <IconButton
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFullScreenImage(imagesMap[style]);
                                                }}
                                                sx={{
                                                    position: "absolute",
                                                    bottom: 12,
                                                    right: 52,
                                                    zIndex: 100,
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: "50%",
                                                    background: "rgba(255, 255, 255, 0.2)",
                                                    backdropFilter: "blur(6px)",
                                                    border: "1px solid rgba(255, 255, 255, 0.3)",
                                                    color: "#fff",
                                                    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.15)",
                                                    "&:hover": {
                                                        background: "rgba(255, 255, 255, 0.3)",
                                                    }
                                                }}
                                            >
                                                <ZoomInIcon sx={{ fontSize: "1.2rem" }} />
                                            </IconButton>
                                            <IconButton
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (reGenTimeoutRef.current) clearTimeout(reGenTimeoutRef.current);
                                                    setShowReGenPill(prev => ({ ...prev, [style]: true }));
                                                    reGenTimeoutRef.current = setTimeout(() => {
                                                        setShowReGenPill(prev => ({ ...prev, [style]: false }));
                                                    }, 10000);
                                                }}
                                                sx={{
                                                    position: "absolute",
                                                    bottom: 12,
                                                    right: 12,
                                                    zIndex: 100,
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: "50%",
                                                    background: "rgba(255, 255, 255, 0.2)",
                                                    backdropFilter: "blur(6px)",
                                                    border: "1px solid rgba(255, 255, 255, 0.3)",
                                                    color: "#fff",
                                                    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.15)",
                                                    "&:hover": {
                                                        background: "rgba(255, 255, 255, 0.3)",
                                                    }
                                                }}
                                            >
                                                <AddIcon sx={{ fontSize: "1.2rem" }} />
                                            </IconButton>
                                        </>
                                    )}
                                </>
                            )}
                        </Box>
                    );
                })}
            </List>

            {/* Full Screen Image Modal */}
            <Modal open={!!fullScreenImage} onClose={() => setFullScreenImage(null)} style={{ zIndex: 9999 }}>
                <Box onClick={() => setFullScreenImage(null)} sx={{ width: "100vw", height: "100vh", bgcolor: "rgba(0,0,0,0.9)", display: "flex", justifyContent: "center", alignItems: "center", position: "relative", cursor: "pointer" }}>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation();
                            setFullScreenImage(null);
                        }}
                        sx={{
                            position: "absolute",
                            top: { xs: 16, md: 24 },
                            right: { xs: 16, md: 24 },
                            color: "white",
                            bgcolor: "rgba(255,255,255,0.2)",
                            "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                            zIndex: 10000
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                    <img src={fullScreenImage || ""} style={{ maxHeight: "100vh", maxWidth: "100vw", height: "auto", width: "auto", objectFit: "contain" }} alt="Full Screen Art Style" />
                </Box>
            </Modal>
        </Box>
    );
};
