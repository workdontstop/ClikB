import React, { useState, useEffect } from 'react';
import { Modal, Box, IconButton, Typography, Button, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ModelPixels from './ModelPixels';

export interface ModelData {
    name: string;
    img: string;
}

interface ModelSelectionModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    handleSelect: (name: string, img: string) => void;
    models: ModelData[];
    currentImage: string;
    darkModeReducer: boolean;
    matchMobile: boolean;
    darkMode: boolean;
    gradient: string;
    labelsByIndex: Record<number, string>;
    colorsByLabel: Record<string, string>;
    updateModelWithoutClosing?: (name: string) => void;
    activeModelName: string;
}

const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({
    open,
    setOpen,
    handleSelect,
    models,
    currentImage,
    darkModeReducer,
    matchMobile,
    darkMode,
    gradient,
    labelsByIndex,
    colorsByLabel,
    updateModelWithoutClosing,
    activeModelName,
}) => {
    const [activeModes, setActiveModes] = useState<Record<string, string>>({
        'minimax': 'minimax2',
        'Imagen': 'Imagen2',
        'fluxUltra': 'fluxUltra2'
    });

    const [imageSetIndex, setImageSetIndex] = useState(0);

    useEffect(() => {
        if (open) {
            setImageSetIndex(Math.floor(Math.random() * 5));
        }
    }, [open]);

    const imageSets: Record<string, string>[] = [
        {
            'Schnell': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-2423d077bee811cc800ecdf044378f40.png',
            'minimax2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-17a1504bce7d92e2ad5b67051d4af246.png',
            'minimax': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-64e353fbd167791951c500ad09528424.png',
            'fluxUltra': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-22d2235043b9b7d1cb819efaab4817ba.png',
            'Gpt Image': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-1257143aefc831f87bf60314e3a8b303.png',
            'Imagen2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-c19837b45dcab346256e6968019b7f7f.png',
            'Imagen': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-8f9ba1e380663d6b0fd0f6a38f419185.png',
            'fluxUltra2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-0e4b54a43e3f32d90697c4e54c509e26.png',
        },
        {
            'Schnell': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-9d839e5758eeda0b1367d569e275eaf9.png',
            'minimax2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-8cdd9db6bcab4c86e2f4e11a6d190b6b.png',
            'minimax': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-754f5e76c2e9682ca8e0fd009b02a1a8.png',
            'fluxUltra': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-14546a8f6ca50578178dfe47da97096b.png',
            'Gpt Image': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-f6c0c58dc7da3a90b4772c6de2788176.png',
            'Imagen2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-60b6c173082f6a6d1b783f76dd993a2c.png',
            'Imagen': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-4413bdd70f06f2d2668356e5fa4e98c5.png',
            'fluxUltra2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-90064d6996ae21ecce2a77f2e48a3ee3.png',
        },
        {
            'Schnell': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-575ac8d2e6a2361f06543f1abb30236c.png',
            'minimax2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-8de13ffdec31242c07b2a53f6b69c966.png',
            'minimax': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-85aa4aed47886cf9cffb46bd0c6ee113.png',
            'fluxUltra': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-f824c830de492d57e420d7ad381980dc.png',
            'Gpt Image': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-39ba9017fe9d5eb576980756996ba08f.png',
            'Imagen2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-85d00c20eb364632688ad002ade56d1f.png',
            'Imagen': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-60ee5ec518cc40c2b3c3ffe95320a270.png',
            'fluxUltra2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-e9e2ab9b2295f1c8cab21a0fe90f6777.png',
        },
        {
            'Schnell': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-676c653bb7a3020240b2ce9facbda1c3.png',
            'minimax2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-f6c55c5b0aed7504d77a7e8befdbeb4a.png',
            'minimax': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-b0707acc72b54c695402e3c3f547115d.png',
            'fluxUltra': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-7c003bdc7b185b6c55bc15e22f3033f7.png',
            'Gpt Image': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-9f14154c52a61d656c6dcc5ee5bdde14.png',
            'Imagen2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-2b38fab8c461906b7629612b24a54026.png',
            'Imagen': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-4942c35ff35b3a5656eff3c6b0ecb3b8.png',
            'fluxUltra2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-595e2eb89ba0342e52809607839c2902.png',
        },
        {
            'Schnell': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-bc175274f5dd462728812dfa7b5b3d00.png',
            'minimax2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-bc3f8d359fa47e9f401c985a85379d64.png',
            'minimax': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-b0b11f43f74fb49387ab544712a91d22.png',
            'fluxUltra': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-aad5066cdb3584726c001bda7cf3f1d9.png',
            'Gpt Image': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-3da3fed3014d515875d9aec315f36527.png',
            'Imagen2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-b5eb75c893e9b6d942a2011af4ce7257.png',
            'Imagen': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-db75cce2efc342f7fce5b0e6f1456826.png',
            'fluxUltra2': 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-9f3095f2c81d8f118147d939ada75cec.png',
        }
    ];

    const modelImageMap = imageSets[imageSetIndex];

    const isLiteCapable = (name: string) => ['minimax', 'Imagen'].includes(name);

    return (
        <Modal
            open={open}
            onClose={() => setOpen(false)}
            closeAfterTransition
            BackdropProps={{
                sx: {
                    backgroundColor: darkModeReducer
                        ? "rgba(0,0,0,.4)"
                        : "rgba(90,90,90,.56)",
                },
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: matchMobile ? "0%" : "50%",
                    transform: matchMobile ? "translate(0%, -50%)" : "translate(-50%, -50%)",
                    width: matchMobile ? "81%" : "44%",
                    height: matchMobile ? "90vh" : "90vh",
                    background: darkMode
                        ? "rgba(25,25,25,0.25)"
                        : "rgba(255,255,255,0.25)",
                    backdropFilter: darkModeReducer
                        ? matchMobile ? "blur(18px)" : "blur(30px)"
                        : matchMobile ? "blur(12px)" : "blur(18px)",
                    borderRadius: 3,
                    p: 0,
                    outline: "none",
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                    "&::-webkit-scrollbar": { width: "8px" },
                    "&::-webkit-scrollbar-track": { background: "rgb(255,255,255,0)" },
                    "&::-webkit-scrollbar-thumb": {
                        background: "rgb(255,255,255,0)",
                        borderRadius: "4px",
                    },
                    "&::-webkit-scrollbar-thumb:hover": { background: "rgb(255,255,255,0)" },
                }}
            >
                <IconButton
                    onClick={() => setOpen(false)}
                    sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        color: darkMode ? "#fff" : "#000",
                        zIndex: 1,
                        display: "none",
                    }}
                    aria-label="close"
                >
                    <CloseIcon />
                </IconButton>

                {models.map((m, index) => {
                    const hasToggle = isLiteCapable(m.name);
                    const selectedModelName = hasToggle ? activeModes[m.name] : m.name;

                    return (
                        <Box
                            key={m.name}
                            onClick={() => handleSelect(selectedModelName, currentImage)}
                            sx={{
                                display: 'flex',
                                width: 'auto',
                                p: matchMobile ? 1 : 1,
                                flex: 1,
                                alignItems: 'center',
                                cursor: 'pointer',

                                paddingLeft: matchMobile ? '0px' : '10vh',
                                paddingTop: index === 0 ? '10vh' : '0px',
                                paddingBottom: index === models.length - 1 ? '30vh' : '10vh',
                            }}
                        >
                            <Box
                                component="img"
                                src={modelImageMap[selectedModelName] || m.img}
                                alt={m.name}
                                sx={{
                                    borderRadius: 2,
                                    height: "auto",
                                    width: matchMobile ? "14vh" : "20vh",
                                    objectFit: "cover",
                                    objectPosition: "top",
                                    flexShrink: 0,
                                    border: activeModelName === selectedModelName
                                        ? "2px solid #fff"
                                        : "2px solid transparent",
                                }}
                            />

                            <Typography
                                component="div"
                                variant={matchMobile ? "body1" : "h6"}
                                sx={{
                                    ml: 2,
                                    fontWeight: matchMobile ? 450 : 300,
                                    flexGrow: 1,
                                    textTransform: "capitalize",
                                    color: "#fff",
                                    textAlign: 'center',
                                }}
                            >
                                <span>
                                    {m.name === 'fluxUltra' ?
                                        'Flux Max' :
                                        m.name === 'Imagen' ?
                                            activeModes[m.name] === 'fluxUltra2' ? 'Nano Banana Pro' :
                                            activeModes[m.name] === 'Imagen' ? 'Nano Banana 2' : 'Nano Banana' :
                                            m.name === 'minimax' ?
                                                activeModes[m.name] === m.name ? 'See Dream 4.5' : 'See Dream 4' :
                                                m.name === 'Schnell' ? 'Klein' :
                                                m.name === 'Gpt Image' ? 'Gpt Image 2' : m.name}

                                    <span style={{ opacity: 1 }}>
                                        {' '}
                                        {index === 40 ? "ðŸŒ™" :
                                            index === 30 ? "ðŸŒ™" :
                                                index === 20 ? "ðŸŒ¤ï¸" :
                                                    index === 10 ? "â˜€ï¸" :
                                                        index === 6000 ? "ðŸ’¥" : " "}
                                    </span>

                                    <span style={{ background: gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                                        {labelsByIndex[index] ? (
                                            <span style={{
                                                opacity: 1,
                                                color: colorsByLabel[labelsByIndex[index]],
                                                textShadow: `0px 1px 2px rgba(0, 0, 0, 0.52), 0px 2px 4px rgba(0, 0, 0, 0.38)`,
                                                WebkitTextFillColor: "currentColor",
                                                fontSize: "0.85em",
                                            }}>
                                                {" "}{labelsByIndex[index]}
                                            </span>
                                        ) : null}
                                    </span>

                                    <Typography
                                        variant="h5"
                                        sx={{
                                            color: 'white',
                                            fontWeight: '900',
                                            textAlign: 'center',
                                            WebkitBackgroundClip: "text",
                                            textShadow: `0px 1px 2px rgba(0, 0, 0, 0.12), 0px 2px 4px rgba(0, 0, 0, 0.08)`,
                                            WebkitTextFillColor: "transparent",
                                        }}
                                    >
                                        <ModelPixels model={selectedModelName} baseImagesPerDollar={333} />
                                    </Typography>

                                    {/* --- PRO / LITE SWITCHER (optimized sizing mobile + desktop, exact props kept) --- */}
                                    {hasToggle && (
                                        <Stack
                                            direction="row"
                                            spacing={matchMobile ? 0.75 : 1}
                                            justifyContent="center"
                                            sx={{ mt: 0.5 }}
                                        >
                                            {m.name === 'Imagen' && (
                                                <Button
                                                    size="small"
                                                    variant={activeModes[m.name] === 'fluxUltra2' ? "contained" : "outlined"}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveModes(prev => ({ ...prev, [m.name]: 'fluxUltra2' }));
                                                        updateModelWithoutClosing?.('fluxUltra2');
                                                    }}
                                                    sx={{
                                                        fontSize: matchMobile ? '0.7rem' : '0.8rem',
                                                        padding: matchMobile ? '6px 10px' : '6px 12px',
                                                        minWidth: matchMobile ? '56px' : '72px',
                                                        height: matchMobile ? '32px' : '34px',
                                                        lineHeight: 1,
                                                        fontWeight: 800,
                                                        borderRadius: '10px',
                                                        backgroundColor: activeModes[m.name] === 'fluxUltra2'
                                                            ? (darkMode ? "#E8BAFA" : "#0099cc")
                                                            : "transparent",
                                                        color: activeModes[m.name] === 'fluxUltra2'
                                                            ? "#000"
                                                            : (darkMode ? "#E8BAFA" : "#fff"),
                                                        borderColor: darkMode ? "#E8BAFA" : "#fff",
                                                        '&:hover': {
                                                            borderColor: darkMode ? "#E8BAFA" : "#fff",
                                                            backgroundColor:
                                                                activeModes[m.name] === 'fluxUltra2'
                                                                    ? (darkMode ? "#E8BAFA" : "#0099cc")
                                                                    : 'rgba(255,255,255,0.06)'
                                                        }
                                                    }}
                                                >
                                                    Pro
                                                </Button>
                                            )}

                                            <Button
                                                size="small"
                                                variant={activeModes[m.name] === m.name ? "contained" : "outlined"}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveModes(prev => ({ ...prev, [m.name]: m.name }));
                                                    updateModelWithoutClosing?.(m.name);
                                                }}
                                                sx={{
                                                    fontSize: matchMobile ? '0.7rem' : '0.8rem',
                                                    padding: matchMobile ? '6px 10px' : '6px 12px',
                                                    minWidth: matchMobile ? '56px' : '72px',
                                                    height: matchMobile ? '32px' : '34px',
                                                    lineHeight: 1,
                                                    fontWeight: 800,
                                                    borderRadius: '10px',
                                                    backgroundColor: activeModes[m.name] === m.name
                                                        ? (darkMode ? "#E8BAFA" : "#0099cc")
                                                        : "transparent",
                                                    color: activeModes[m.name] === m.name
                                                        ? "#000"
                                                        : (darkMode ? "#E8BAFA" : "#fff"),
                                                    borderColor: darkMode ? "#E8BAFA" : "#fff",
                                                    '&:hover': {
                                                        borderColor: darkMode ? "#E8BAFA" : "#fff",
                                                        backgroundColor:
                                                            activeModes[m.name] === m.name
                                                                ? (darkMode ? "#E8BAFA" : "#0099cc")
                                                                : 'rgba(255,255,255,0.06)'
                                                    }
                                                }}
                                            >
                                                {m.name === 'Imagen' ? 'HD' : 'Pro'}
                                            </Button>

                                            <Button
                                                size="small"
                                                variant={activeModes[m.name] === `${m.name}2` ? "contained" : "outlined"}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveModes(prev => ({ ...prev, [m.name]: `${m.name}2` }));
                                                    updateModelWithoutClosing?.(`${m.name}2`);
                                                }}
                                                sx={{
                                                    fontSize: matchMobile ? '0.7rem' : '0.8rem',
                                                    padding: matchMobile ? '6px 10px' : '6px 12px',
                                                    minWidth: matchMobile ? '56px' : '72px',
                                                    height: matchMobile ? '32px' : '34px',
                                                    lineHeight: 1,
                                                    fontWeight: 800,
                                                    borderRadius: '10px',
                                                    backgroundColor: activeModes[m.name] === `${m.name}2`
                                                        ? (darkMode ? "#4caf50" : "#2196f3")
                                                        : "transparent",
                                                    color: activeModes[m.name] === `${m.name}2`
                                                        ? "#000"
                                                        : (darkMode ? "#4caf50" : "#fff"),
                                                    borderColor: darkMode ? "#4caf50" : "#fff",
                                                    '&:hover': {
                                                        borderColor: darkMode ? "#4caf50" : "#fff",
                                                        backgroundColor:
                                                            activeModes[m.name] === `${m.name}2`
                                                                ? (darkMode ? "#4caf50" : "#2196f3")
                                                                : 'rgba(255,255,255,0.06)'
                                                    }
                                                }}
                                            >
                                                Lite
                                            </Button>
                                        </Stack>
                                    )}
                                </span>
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        </Modal >
    );
};

export default ModelSelectionModal;
