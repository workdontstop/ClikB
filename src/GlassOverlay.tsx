import React, { useState, useEffect, useRef } from "react";
import {
    Box,
    Button,
    Divider,
    IconButton,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { motion } from "framer-motion";
import CloseIcon from "@mui/icons-material/Close";
import { matchMobile } from "./DetectDevice";
import PlanPixels from "./PlanPixels";
import { PlanPrice } from "./PlanPrice";
import ModelCoverage from './ModelCoverage'


import { CircularProgress } from '@mui/material';


import { setPixels, incrementPixels } from "./settingsSlice";



import { loadStripe } from '@stripe/stripe-js';

import {
    EmbeddedCheckoutProvider,
    EmbeddedCheckout,
} from '@stripe/react-stripe-js';

import {
    Accordion,
    AccordionSummary,
    AccordionDetails,

} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import axios from "axios";

import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "./store";

import { setClientSecret, clearClientSecret } from "./settingsSlice";




interface GlassOverlayProps {
    darkMode: boolean;
    onClose: () => void;
    expanded: any
}

/* ----------------------------- data -------------------------------------- */
const plans = [
    { name: "Kick-Start", price: 1.3, pixels: 333 },
    { name: "Boost", price: 3.45, pixels: 959 },
    { name: "Lite", price: 6.25, pixels: 1838 },
    { name: "Standard", price: 11.29, pixels: 3516 },
    { name: "Pro", price: 21.09, pixels: 6713 },
] as const;

const planImages = [
    { name: "Kick-Start", url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/download+(6).png" },
    { name: "Boost", url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/thumbnail+(27).png" },
    { name: "Lite", url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/thumbnail+(31).png" },
    { name: "Standard", url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/thumbnail+(29).png" },
    { name: "Pro", url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/thumbnail+(33).png" },
] as const;




/* brand gradient */



const CLIK_URL = import.meta.env.VITE_CLIK_URL;


const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISH!);





/* --------------------------- motion wrappers ------------------------------ */
const Wrapper = motion(Box);
const Panel = motion(Box);

const GlassOverlay: React.FC<GlassOverlayProps> = ({ darkMode, onClose, expanded }) => {

    const GRADIENT = darkMode ? "linear-gradient(135deg, #F6BB56 0%, #736EFE 100%)" :
        "linear-gradient(135deg, #ff8a00  0%, #736EFE 100%)";


    const [active, setActive] = useState(false);

    const GRADIENTx =
        darkMode ?
            "linear-gradient(90deg, #F6BB56 0%, #F6BB56 100%)" :
            "linear-gradient(90deg, #ff8a00 0%, #e52e71 100%)";

    const GRADIENT_HOVER = "linear-gradient(135deg, #736EFE 0%, #F6BB56 100%)";


    const clientSecret = useSelector((s: RootState) => s.settings.clientSecret);

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    const pixels = useSelector((state: RootState) => state.settings.pixels);



    const overlayRef = useRef<HTMLDivElement>(null);

    const scrollToTop = () => {
        if (overlayRef.current) {
            overlayRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
    };


    const darkModeReducer = darkMode;

    const [zoom2x, setZoom2x] = useState(false);
    const dispatch = useDispatch();


    const [currentPlanPixels, setCurrentPlanPixels] = useState<number>(0);


    const CheckoutArea = ({ children }: { children: React.ReactNode }) => (
        <Box
            sx={{
                /* take as much vertical space as the window has â€¦ */
                height: matchMobile ? '80vh' : '90vh',           // pick any value that fits your UI
                width: matchMobile ? '100vw' : '60vw',            // keep your 60 % width
                position: 'fixed',
                top: '2vh',
                left: '50%',
                transform: 'translateX(-50%)',   // center horizontally

                /* let anything taller than 90 vh scroll inside */
                overflowY: 'auto',        // ðŸ‘ˆ adds the scrollbar
                overflowX: 'hidden',

                display: 'flex',
                flexDirection: 'column',
                zIndex: 9_000_000_000,
                backgroundColor: 'transparent',   // keep your glass look
            }}
        >
            {children}
        </Box>
    );



    /// const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    // new: displayPixels will animate up to the real pixels
    const [displayPixels, setDisplayPixels] = useState(0);



    const [prevPixelsRef, setprevPixelsRef] = useState(0);

    const [topUp, setTopUp] = useState(false);
    useEffect(() => {


        let frame = 0;
        var frameRate = 26;

        // Decide which animation to run:
        if (topUp) {

            setTimeout(() => {
                // --- TOPâ€‘UP ANIMATION ---
                var frameRatex = 24;
                let frame = 0;                            // reset on each run
                const start = prevPixelsRef;
                const end = pixels;
                const duration = 8000;
                const totalFrames = Math.round((duration / 1000) * frameRatex);
                const interval = duration / totalFrames;

                const counter = setInterval(() => {
                    frame++;
                    const t = frame / totalFrames;
                    const eased = 1 - Math.pow(1 - t, 3);
                    setDisplayPixels(
                        Math.round(start + eased * (end - start))
                    );

                    if (frame >= totalFrames) {
                        clearInterval(counter);
                        setTopUp(false);    // reset flag when done
                    }
                }, interval);

                // remember for next topâ€‘up
                setprevPixelsRef(pixels);

                return () => clearInterval(counter);

            }, 1500)
        }
        else {



            // --- FRESHâ€‘LOAD ANIMATION ---
            const start = 0;
            const end = pixels;
            const duration = 1500;
            const totalFrames = Math.round((duration / 1000) * frameRate);
            const interval = duration / totalFrames;

            const counter = setInterval(() => {
                frame++;
                const t = frame / totalFrames;
                const eased = 1 - Math.pow(1 - t, 3);
                setDisplayPixels(Math.round(start + eased * end));

                if (frame >= totalFrames) {
                    clearInterval(counter);
                }
            }, interval);

            // update prev for next topUp
            setprevPixelsRef(pixels);
            return () => clearInterval(counter);
        }


    }, [pixels, prevPixelsRef]);


    const UpdateDatabaseWPixels = (pixels: number) => {

        /// alert(pixels);

        //  setisLoading(true);
        /// setLoadData('Saving..');


        var Data = ({
            userid: loggedUser ? loggedUser.id : 0,
            pixels,



        });




        axios.put(`${CLIK_URL}/addpixels`, {
            values: Data,
        })
            .then((response) => {

                if (response) {

                    ///alert('pixels Bought');

                }
            })
            .catch((error) => {

                /// setisLoading(false);

                console.log(error);
            });



    }

    /* ---------- 1.  Stripe + plan map  ---------- */


    const PLAN_PRODUCT_IDSxxx: Record<string, string> = {
        'Kick-Start': 'prod_SfzAZi03rUIUZD',
        'Boost': 'prod_SfzCMmNnAAeL05',
        'Lite': 'prod_SfzPmZhZsaN0P1',
        'Standard': 'prod_SfzQ6GNY7OoKTX',
        'Pro': 'prod_SfzR3mxKbgn3Jy',
    };




    const PLAN_PRODUCT_IDS: Record<string, string> = {
        'Kick-Start': 'prod_SgRHlPzSmK19L5',
        'Boost': 'prod_SgRI7R2pq9ryAx',
        'Lite': 'prod_SgRJqckGBSRksM',
        'Standard': 'prod_SgRKfBZkvl1mDv',
        'Pro': 'prod_SgRLCe0Fl7ZNPl',
    };

    ///  const dispatch = useDispatch();

    // helpers.ts
    const fetchPixels = async (userId: number): Promise<number> => {
        const { data } = await axios.post<{ pixels: number }>(
            `${CLIK_URL}/getPixels`,
            { values: { userid: userId } }
        );
        return data.pixels;
    };



    const startPing = (initial: number) => {
        if (!loggedUser) return;
        setActive(true);


        const userId = loggedUser.id;
        const intervalMs = 5_000; // every 10s
        const timeoutMs = 60_000; // give up after 1m
        let elapsed = 0;

        const h = window.setInterval(async () => {
            elapsed += intervalMs;
            try {
                const current = await fetchPixels(userId);
                if (current > initial) {
                    console.log('payment confirmed');

                    // success!
                    setTopUp(true);
                    scrollToTop();
                    clearInterval(h);
                    setActive(false);
                    dispatch(setPixels(current));
                    return;
                }
            } catch (e) {
                console.error('Ping error', e);
            }
            if (elapsed >= timeoutMs) {
                clearInterval(h);
                setActive(false);
                alert(
                    'âŒÂ Payment may have succeeded, but we didnâ€™t see your pixels update. Please contact support Ogheneovoreal@gmail.com'
                );
            }
        }, intervalMs);
    };


    const getPixel = async () => {
        try {
            const response = await axios.post(
                `${CLIK_URL}/getPixels`,                   // <-- POST endpoint
                { values: { userid: loggedUser?.id ?? 0 } }  // <-- request body
            );
            const { pixels } = response.data as any;   // â† pick out the primitive

            /// setPixels(pixels);

            dispatch(setPixels(pixels));

        } catch (err) {
            console.error("Error fetching pixels:", err);
        }
    };




    useEffect(() => {

        if (expanded) {
            getPixel();

        }

    }, [expanded])


    const handleBuy = async (planName: string, pixels: any) => {

        setCurrentPlanPixels(pixels);
        try {
            const { data }: any = await axios.post(`${CLIK_URL}/create-checkout-session`, {
                productId: PLAN_PRODUCT_IDS[planName],
                userId: loggedUser ? loggedUser.id : 0,
            });

            console.log('data', data.clientSecret)
            ///setClientSecret(data.clientSecret);
            dispatch(setClientSecret(data.clientSecret));       // triggers render â†“
        } catch (e) {
            alert('Checkout could not start. Try again.');
        }
    };


    /* ---------------------------- row render -------------------------------- */
    const renderPlan = (p: typeof plans[number]) => {


        const theme = useTheme();
        // Random placeholder for images count â€“ replace with real value if available
        const imagesCount = Math.floor(Math.random() * 6) + 1;

        return (

            <>


                <Box key={p.name}>


                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            py: 9,

                            [theme.breakpoints.down("sm")]: {
                                flexDirection: "column",
                                textAlign: "center",
                            },
                        }}
                    >
                        {/* image 40% */}
                        <Box
                            sx={{
                                flexBasis: "45%",
                                display: "flex",
                                justifyContent: "center",
                            }}
                        >
                            <Box
                                component="img"
                                src={planImages.find(img => img.name === p.name)?.url}
                                alt={`${p.name} preview`}
                                sx={{
                                    width: "100%",
                                    aspectRatio: "16/9",
                                    objectFit: "cover",
                                    borderRadius: 2,
                                }}
                            />

                        </Box>



                        {/* details 55% */}
                        <Box
                            sx={{
                                flexBasis: "55%",
                                flexGrow: 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                                alignItems: { xs: "center", sm: "flex-start" },
                            }}
                        >
                            {/* Plan name */}
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                sx={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',

                                }}
                            >
                                {/* Buy button 20% */}
                                <Button

                                    onClick={() => {

                                        ///after stripe


                                        // UpdateDatabaseWPixels(p.pixels);


                                        if (loggedUser) {
                                            handleBuy(p.name, p.pixels);

                                        }


                                    }}
                                    variant="contained"
                                    size="small"
                                    sx={{
                                        flexBasis: { sm: "20%" },
                                        background: GRADIENT,
                                        color: "#fff",
                                        fontWeight: 600,
                                        px: 3,
                                        textTransform: "none",
                                        minWidth: 100,
                                        alignSelf: { xs: "center", sm: "flex-start" },
                                        ":hover": { background: GRADIENT_HOVER },
                                    }}
                                >
                                    Buy
                                </Button>

                                <Typography variant="caption" sx={{ paddingLeft: '2vw' }}>
                                    <PlanPrice name={p.name}
                                        fluxUnitCost={0.003}
                                        fluxPixels={333} />
                                </Typography>

                            </Typography>

                            {/* Price */}


                            {/* Text block (80%) + Buy (20%) */}
                            <Box
                                sx={{

                                    width: "100%",
                                    display: "flex",
                                    gap: 2,
                                    alignItems: "center",
                                    flexDirection: { xs: "column", sm: "row" },
                                }}
                            >
                                {/* Text block 80% */}
                                <Box
                                    sx={{
                                        flexBasis: { sm: "80%" },
                                        textAlign: { xs: "center", sm: "left" },
                                    }}
                                >
                                    <Typography variant="h4" fontWeight={700}
                                        style={{
                                            background: GRADIENTx, WebkitBackgroundClip: "text",
                                            textShadow: `
                                        0px 1px 2px rgba(0, 0, 0, 0.12),
                                        0px 2px 4px rgba(0, 0, 0, 0.08)
                                      `,
                                            paddingBottom: '2vh',
                                            WebkitTextFillColor: "transparent"
                                        }}>
                                        <PlanPixels name={p.name}
                                            fluxPixels={333} />

                                    </Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.7, width: 'auto' }}>
                                        <ModelCoverage
                                            name={p.name}
                                            baseImagesPerDollar={333}
                                            fluxPixels={333}
                                        />
                                    </Typography>
                                </Box>



                            </Box>

                        </Box>


                    </Box>


                    {p.name !== "Pro" && <Divider sx={{ opacity: 0.1, mt: 2 }} />}
                </Box >

            </>
        );
    };




    /* ------------------------------ render ---------------------------------- */
    return (

        <>
            <Wrapper
                initial={{ y: "-100vh", opacity: 0 }}
                animate={{ y: 0, opacity: 1, }}
                exit={{ y: "-100vh", opacity: 0 }}
                transition={{ type: "spring", stiffness: 160, damping: 26 }}
                sx={{
                    position: "fixed",
                    inset: 0,
                    display: "flex",
                    alignItems: matchMobile ? "flex-start" : "center",
                    justifyContent: "center",
                    pt: matchMobile ? 0 : undefined,
                    zIndex: 999999,
                    height: '100vh',
                    /// width: '100vw',
                    pointerEvents: "auto",
                    backdropFilter: "blur(40px)",

                }}
            >
                <Panel
                    ref={overlayRef}
                    layoutId="glass"
                    initial={{ borderRadius: 12, scale: 0.95, }}
                    animate={{
                        borderRadius: 24,
                        scale: 1,
                        width: fullScreen ? "100vw" : '100vw',
                        overflowY: "auto", height: '100vh',


                        padding: fullScreen ? theme.spacing(0) : theme.spacing(0),
                        paddingLeft: fullScreen ? '0px' : '12vw',
                        paddingRight: fullScreen ? '0px' : '12vw',
                        boxShadow: darkMode
                            ? "0 20px 64px rgba(0,0,0,0.95)"
                            : "0 20px 64px rgba(0,0,0,0.35)",
                    }}
                    exit={{ borderRadius: 12, scale: 0.95, }}
                    transition={{ type: "spring", stiffness: 320, damping: 28, }}
                    sx={{


                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        padding: '0px',
                        background: darkMode
                            ? "rgba(25,25,25,0.65)"
                            : "rgba(225,225,225,0.66)",
                        color: darkMode ? "#fff" : "#000",
                        border: darkMode
                            ? "1px solid rgba(123, 32, 32, 0.08)"
                            : "1px solid rgba(0,0,0,0.08)",



                    }}
                >

                    {active && (
                        <Box
                            ///  onClick={hide}
                            sx={{
                                position: 'fixed',
                                top: 0, left: 0,
                                width: '100%',
                                height: '100vh',
                                backgroundColor: darkMode
                                    ? 'rgba(20,20,200,0.3)'
                                    : 'rgba(229,46,113,0.1)',
                                backdropFilter: 'blur(8px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 13000,
                            }}
                        >
                            <Box
                                sx={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    backdropFilter: 'blur(4px)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <CircularProgress color="inherit" />
                            </Box>
                        </Box>
                    )}


                    {clientSecret && (
                        <CheckoutArea>          {/* â† use the wrapper */}
                            <EmbeddedCheckoutProvider
                                key={clientSecret}   // remount every purchase
                                stripe={stripePromise}

                                options={{
                                    clientSecret,

                                    onComplete: () => {
                                        dispatch(setClientSecret(null));

                                        ///    UpdateDatabaseWPixels(currentPlanPixels);


                                        ///setActive(true);

                                        startPing(pixels);

                                        /// i want to update my database from hhoks later then ping -i will call ping here

                                        console.log('complete', stripePromise)
                                    },
                                }}
                            >
                                <EmbeddedCheckout /> {/* no props */}
                            </EmbeddedCheckoutProvider>
                        </CheckoutArea>
                    )}


                    <Box
                        sx={{


                            padding: '6vh',
                            paddingRight: '3vh',

                            paddingLeft: '3vh',
                            backdropFilter: "blur(16px)",



                        }}
                    >
                        {/* header row */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                mb: 2,
                                backdropFilter: "blur(46px)",


                            }}
                        >
                            <Typography variant="h5" fontWeight={700} letterSpacing={1}>
                                Vault
                            </Typography>

                        </Box>



                        {/* credits block */}
                        <Typography
                            variant={fullScreen ? "h4" : "h3"}
                            fontWeight={700}
                            align="center"
                            sx={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", mb: 0.5 }}
                        >
                            Pixels
                        </Typography>
                        <Typography
                            variant={fullScreen ? "h2" : "h1"}
                            fontWeight={800}
                            align="center"
                            sx={{ background: GRADIENTx, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", mb: 3 }}
                        >
                            {displayPixels}&nbsp;<Box
                                component="span"
                                sx={{ fontSize: "0.5em", verticalAlign: "baseline" }}
                            >

                                P
                            </Box>
                        </Typography>

                        {/* plans heading */}
                        <br></br >
                        <br></br >


                        <Typography
                            variant={fullScreen ? "h6" : "h5"}
                            fontWeight={800}
                            align="center"
                            sx={{
                                background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", mb: 3,
                                // textShadow: `3px 7px 3px rgba(0, 0, 0, 0.02), 0px 2px 4px rgba(0, 0, 0, 0.04)`,
                                ///alert
                            }}
                        >
                            Affordable Plans
                        </Typography>

                        {/* â€œWhy pixels?â€ heading, styled like your 0 .P display but smaller */}
                        <Accordion
                            //    defaultExpanded={!isMobile}
                            sx={{
                                backgroundColor: "transparent",
                                boxShadow: "none",
                                "&:before": { display: "none" }, // remove divider line
                                paddingBottom: '0px'
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon sx={{ color: darkMode ? "#FFF" : "#000" }} />}
                                sx={{ backgroundColor: "transparent", px: 0 }}
                            >
                                <Typography
                                    variant="h5"
                                    fontWeight={700}
                                    sx={{
                                        background: GRADIENT,              // your existing gradient
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                    }}
                                >
                                    Why pixels?
                                </Typography>


                            </AccordionSummary>

                            <AccordionDetails sx={{ backgroundColor: "transparent", px: 0 }}>
                                <Typography
                                    variant="body2"
                                    align="left"
                                    sx={{
                                        width: "100%",
                                        px: "1%",
                                        color: darkMode ? "#FFF" : "#000",
                                        opacity: 0.75,
                                        lineHeight: 1.5,
                                    }}
                                >
                                    We use pixels instead of credits because it scales transparently:
                                    <br />â€¢ Cheaper models cost fewer pixels
                                    <br />â€¢ High-quality models cost more pixels
                                    <br />
                                    That way, you only pay for the resolution and model you actually need. ðŸ˜„
                                </Typography>
                            </AccordionDetails>
                        </Accordion>
                        {/* scroll area */}
                        <Box sx={{ flexGrow: 1, pr: 0, marginTop: '-2vh' }}>

                            {plans.map(renderPlan)}
                        </Box>







                        <Box
                            sx={{
                                paddingBottom: '40vh',
                                width: "100%",

                            }}
                        >
                        </Box>
                    </Box>



                </Panel>
            </Wrapper >



        </>
    );
};

export default GlassOverlay;
