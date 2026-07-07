import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    MouseEvent,
} from "react";
import { Box, IconButton } from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import { useSelector } from "react-redux";
import { RootState } from "./store";

import { matchMobile } from "./DetectDevice";
import { DarkMode } from "@mui/icons-material";

interface FilePickerProps {
    /** 0 = array mode, 1 = single mode */
    type?: number;

    // ----------- For type=0 (Arrays) -----------
    generatedImagesFlux?: string[] | any; // e.g. array of arrays
    GeneratedImage?: string | any;

    // ----------- For type=1 (Single) -----------
    FluxIm?: string | any;

    // ----------- Common Props -----------
    fallbackImage?: string;
    show?: boolean;                 // Show/hide the thumbnail
    index: number;                  // Which index in arrays
    base: string[];
    setbase: React.Dispatch<React.SetStateAction<string[]>>;

    /**
     * Instead of doing resizing logic here, we'll call this parent's
     * function for ANY file changes or existing image selection.
     *
     * Example usage in parent:
     *   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }
     */
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    startEdit: any;

    /**
     * Helper to fetch an existing image URL, create a synthetic event, and
     * pass it to `handleFileChange`. We'll import or pass it from the parent.
     */
    handleExistingUrl: (
        url: string,
        onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    ) => void;
    Once: any;
    setOnce: any;
    compact?: boolean;
    showPreviewThumb?: boolean;
}

const FilePicker: React.FC<FilePickerProps> = ({
    type = 0,
    generatedImagesFlux = [],
    GeneratedImage = "",
    FluxIm = "",
    fallbackImage = "",
    show = true,
    index,
    base,
    setbase,
    handleFileChange,
    handleExistingUrl,
    startEdit,
    Once,
    setOnce,
    compact = false,
    showPreviewThumb = true,
}) => {
    const [showPicker, setShowPicker] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // 1) Rebuild array of possible images
    const [allImages, setAllImages] = useState<string[]>([]);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    const darkMode = darkModeReducer;

    useEffect(() => {
        const newImages: string[] = [];

        // 1) Gather *all* images from generatedImagesFlux
        //    Assuming generatedImagesFlux is an array of arrays
        //    If it's a simple array of strings, you can skip the .flat()
        if (Array.isArray(generatedImagesFlux)) {
            // Flatten if it's an array of arrays
            const flattened = generatedImagesFlux.flat();
            for (const item of flattened) {
                if (typeof item === "string") {
                    newImages.push(item);
                }
            }
        }

        // 2) Also add GeneratedImage and FluxIm if present
        if (GeneratedImage) {
            newImages.push(GeneratedImage);
        }
        if (FluxIm) {
            newImages.push(FluxIm);
        }

        // 3) Update state
        setAllImages(newImages);
    }, [generatedImagesFlux, GeneratedImage, FluxIm, show]);



    // 2) Current base image
    const isArrayMode = type === 0;
    const currentBaseIndex = isArrayMode ? index : 0;
    const currentBaseImagex = base[currentBaseIndex] || fallbackImage;

    const [currentBaseImage, setcurrentBaseImage] = useState('');





    useEffect(() => {

        kk();



    }, [startEdit, show, currentBaseImagex, currentBaseIndex]);

    useEffect(() => {


        if (startEdit) {



        } else {
            setOnce(false);
            //  alert('jj');

        }

    }, [startEdit]);



    const kk = useCallback(() => {



        if (Once) {

        }

        else {


            const currentBaseImagex = base[currentBaseIndex] || fallbackImage;

            setcurrentBaseImage(currentBaseImagex);

        }
    }, [startEdit, Once, show, currentBaseImagex, currentBaseIndex]);


    // Toggle popup
    const handleClickBasePicker = () => {
        setShowPicker((prev) => !prev);
    };

    // For local file uploads
    const openFileDialog = () => {

        fileInputRef.current?.click();
    };

    // 3) On user picks a file => calls parent's handleFileChange
    const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileChange(e); // The parent does the 1080Ã—1920 resize
        setShowPicker(false); // close popup
    };

    // 4) On user clicks an existing image => fetch => call parent's handleFileChange
    const onImageClick = async (
        e: MouseEvent<HTMLDivElement>,
        imgUrl: string
    ) => {
        e.stopPropagation(); // don't close the popup yet
        setOnce(false);
        await handleExistingUrl(imgUrl, handleFileChange);
        setShowPicker(false); // close
    };

    return (
        <>
            {/* Thumbnail Box */}
            <Box
                sx={{
                    position: compact ? "relative" : "absolute",
                    top: compact ? "auto" : "12px",
                    left: "auto",
                    right: compact ? "auto" : "12px",
                    transform: "none",
                    width: compact ? 34 : 40,
                    height: compact ? 34 : 40,
                    zIndex: 3000,
                    display: show ? (compact ? "inline-flex" : "block") : "none",
                    cursor: "pointer",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                onClick={handleClickBasePicker}
            >
                {showPreviewThumb && currentBaseImage ? (
                    <img
                        src={currentBaseImage}
                        alt="Base Image"
                        style={{
                            width: compact ? 34 : 40,
                            height: compact ? 34 : 40,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: compact ? "1px solid rgba(255, 255, 255, 0.4)" : "2px solid rgba(255, 255, 255, 0.4)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            display: "block",
                        }}
                    />
                ) : (
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClickBasePicker();
                        }}
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            color: "#fff",
                            background: darkMode
                                ? "linear-gradient(135deg, rgba(20,20,20,0.7) 0%, rgba(10,10,10,0.5) 100%)"
                                : (compact ? "linear-gradient(180deg, #27c7a6 0%, #12b68d 100%)" : "rgba(0, 0, 0, 0.4)"),
                            border: compact ? "1px solid rgba(255,255,255,0.08)" : "none",
                            borderRadius: "50%",
                            backdropFilter: compact ? "blur(18px) saturate(180%)" : "blur(10px)",
                            width: "100%",
                            height: "100%",
                            "&:hover": {
                                background: darkMode
                                    ? "linear-gradient(135deg, rgba(40,40,40,0.8) 0%, rgba(20,20,20,0.6) 100%)"
                                    : (compact ? "linear-gradient(180deg, #32d4b2 0%, #16c497 100%)" : "rgba(0, 0, 0, 0.6)"),
                            },
                        }}
                    >
                        <ImageIcon style={{ fontSize: compact ? "1rem" : "1.3rem" }} />
                    </IconButton>
                )}
            </Box>

            {/* Popup */}
            {showPicker && (
                <Box
                    sx={{
                        position: "fixed",
                        top: "30%",
                        left: "20%",
                        width: 300,
                        backgroundColor: "#fff",
                        borderRadius: "8%",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                        p: 2,
                        zIndex: 4000,
                        overflowY: "auto",
                        maxHeight: "50vh",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={onFileInputChange}
                    />

                    {/* Local file picker button */}
                    <Box sx={{ mb: 2, display: "inline-block" }}>
                        <Box
                            onClick={() => {

                                setOnce(false);

                                openFileDialog();
                            }
                            }
                            sx={{
                                display: "inline-block",
                                cursor: "pointer",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                px: 2,
                                py: 1,
                                color: darkMode ? '#000000' : '#000000'
                            }}
                        >
                            Choose File
                        </Box>
                    </Box>{' '}
                    {/* Local file picker button */}
                    <Box sx={{ mb: 2, display: "inline-block" }}>
                        <Box
                            onClick={() => {

                                setbase((prev: any) => {
                                    const next = [...prev];
                                    const targetIndex = isArrayMode ? index : 0;
                                    next[targetIndex] = '';
                                    return next;
                                });

                                setcurrentBaseImage('');
                                setOnce(true);
                                setShowPicker(false);


                            }}
                            sx={{
                                display: "inline-block",
                                cursor: "pointer",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                px: 2,
                                py: 1,
                                color: darkMode ? '#000000' : '#000000'
                            }}
                        >
                            Remove
                        </Box>
                    </Box>

                    {/* Existing images */}
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 1,
                            overflowY: "auto",
                            maxHeight: "40vh",
                        }}
                    >
                        {allImages.map((imgUrl, idx) => (
                            <Box
                                key={idx}
                                onClick={(e) => onImageClick(e, imgUrl)}
                                sx={{
                                    width: "80px",
                                    height: "80px",
                                    cursor: "pointer",
                                    borderRadius: "4px",
                                    overflow: "hidden",
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                                }}
                            >
                                <img
                                    src={imgUrl}
                                    alt={`Option ${idx}`}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                    }}
                                />
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

        </>
    );
};

export default FilePicker;
