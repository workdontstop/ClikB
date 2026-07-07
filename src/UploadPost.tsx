import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Typography,
    IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { matchMobile } from './DetectDevice';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";



import { useNavigate, useLocation } from "react-router-dom";

/**
 * UploadPost â€“ glassâ€‘style upload chooser
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * â€¢ Mobile (â‰¤â€¯767â€¯px):   widthÂ 80â€¯% Â Ã—Â heightÂ 100â€¯%
 * â€¢ Desktop (â‰¥â€¯768â€¯px): widthÂ 30â€¯% Â Ã—Â heightÂ 100â€¯%
 * â€¢ Horizontally centred via translateX(â€‘50â€¯%)
 * â€¢ Surrounded by a translucent overlay; clicking the overlay closes it
 * â€¢ Close (Ã—) icon at topâ€‘right of the glass panel
 */

const features = [
    'Interactions',
    'Memes',
    'Stories',
    'Thumbnail Creator',







];


interface UploadPostProps {
    /** optional close handler */
    showGoUpload: boolean;
    setshowGoUpload: any;
    setminimisePrompt: any;
    setShowThumb: any;
    isMenuOpen: any
}

const UploadPost: React.FC<UploadPostProps> = ({ setshowGoUpload, setminimisePrompt, setShowThumb, isMenuOpen, showGoUpload }) => {
    /* responsive sizing */
    const isMobile = matchMobile; // boolean from DetectDevice
    const boxW = isMobile ? '70%' : '45%';
    const boxH = '100%';

    const navigate = useNavigate();

    const location = useLocation();


    const [urlName, setUrlName] = useState(location.pathname); // initial value

    useEffect(() => {
        setUrlName(location.pathname);
    }, [location.pathname, showGoUpload]); // runs whenever either changes

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    /* glassy surface reâ€‘used for panel + buttons */
    const glass2 = {
        backdropFilter: 'blur(22px)',
        background: darkModeReducer ? 'rgba(25,25,25,0.20)' : 'rgba(205,205,205,0.20)',
        border: darkModeReducer ? '1px solid rgba(25,25,25,0.25)' : '1px solid rgba(255,255,255,0.25)',
    } as const;

    const glass = {
        backdropFilter: 'blur(22px)',
        background: darkModeReducer ? 'rgba(25,25,25,0.10)' : 'rgba(255,255,255,0.10)',
        border: darkModeReducer ? '1px solid rgba(25,25,25,0.25)' : '1px solid rgba(2,2,2,0.65)',
    } as const;


    const onClose = () => {

        setshowGoUpload(false)
    }


    const handleFeatureClick = (label: string) => {


        let targetPath = "";

        switch (label) {
            /* all these go to /images */

            case "Memes":

                targetPath = "/images";
                setminimisePrompt(false);
                break;

            /* stories page */
            case "Stories":
                targetPath = "/kickit";
                setminimisePrompt(false);
                break;

            /* Interactions â†’ interactions page */
            case "Interactions":
                targetPath = "/clikit";
                setminimisePrompt(false);
                break;

            /* leave Thumbnail Creator blank for now */
            case "Thumbnail Creator":
                targetPath = "";
                setShowThumb(true);
                break;

            default:
                break;
        }

        setshowGoUpload(false);
        if (targetPath) {
            setTimeout(() => {
                navigate(targetPath, {
                    state: { userId: loggedUser?.id, upload: true },
                });
            }, 100);
        }



        // close the modal (if you keep onClose in scope)
        onClose?.();
    };


    return (
        /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ translucent backdrop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        <Box
            onClick={onClose}               /* close when clicking outside */
            sx={{
                position: 'fixed',
                inset: 0,
                cursor: 'pointer',
                width: '100vw',
                height: '100vh',
                bgcolor: darkModeReducer ? 'rgba(0,0,0,0.3)' : 'rgba(170,170,170,0.03)',
                zIndex: 5190,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                p: 0,                        /* small top margin on very small screens */
            }}
        >
            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ glass panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <Box
                onClick={(e) => e.stopPropagation()} /* keep inside clicks from bubbling */
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: matchMobile ? '35%' : isMenuOpen ? '42.5%' : '22.5%',
                    transform: 'translateX(-50%)',
                    width: boxW,
                    height: boxH,
                    display: 'flex',
                    flexDirection: 'column',
                    p: 3,
                    overflowY: 'auto',
                    color: darkModeReducer ? '#fff' : '#000',
                    zIndex: 1200,
                    ...glass2,
                }}
            >
                {/* Close icon */}
                <IconButton
                    aria-label="Close upload box"
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        top: matchMobile ? 16 : 20,
                        right: 8,

                        display: 'none',
                        color: darkModeReducer ? '#fff' : '#000',
                    }}
                >
                    <CloseIcon style={{ fontSize: '1.9rem', }} />
                </IconButton>

                {/* Title */}
                <Typography
                    variant={isMobile ? 'h5' : 'h4'}
                    sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}
                >
                    Upload
                </Typography>

                {/* Feature buttons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6.5, paddingTop: matchMobile ? '7vh' : '12vh' }}>
                    {features.map((label) => (
                        <Button
                            key={label}
                            onClick={() => {
                                //  alert(urlName);
                                if (urlName === '/images' && label === 'Memes') {

                                    setminimisePrompt(false);
                                    onClose?.();
                                } else if (urlName === '/kickit' && label === 'Stories') {

                                    setminimisePrompt(false);
                                    onClose?.();
                                }
                                else if (urlName === '/clikit' && label === 'Interactions') {

                                    setminimisePrompt(false);
                                    onClose?.();
                                }
                                else {

                                    handleFeatureClick(label)
                                }
                            }}
                            disableRipple
                            sx={{
                                width: '100%',
                                px: 0,
                                py: 2,
                                fontSize: '1.15rem',
                                fontWeight: 500,
                                textTransform: 'none',
                                cursor: 'pointer',
                                color: darkModeReducer ? '#fff' : '#000',
                                borderRadius: 2,
                                ...glass,
                                '&:hover': {
                                    background: 'rgba(255,255,255,0.15)',
                                },
                            }}
                        >
                            {label}
                        </Button>
                    ))}
                </Box>
            </Box>
        </Box >
    );
};

export default UploadPost;
