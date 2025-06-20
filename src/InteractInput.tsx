import React, { FC, useState, ChangeEvent } from "react";
import { Box } from "@mui/material";
import Sandbox from "./Sandbox"; // adjust the import path as needed

import InteractTrim from "./InteractTrim";
import { matchMobile } from "./DetectDevice";
/**
 * Lets the user pick a video file, then hands the URL to <Sandbox />.
 */
const InteractInput: FC<any> = ({ minimisePrompt,
    setminimisePrompt }) => {
    const [videoURL, setVideoURL] = useState<string | null>(null);

    const [CloudvideoURL, setCloudvideoURL] = useState<string | null>(null);

    const [ShowTrim, setShowTrim] = useState(false);

    const [trimmedUrl, setTrimmedUrl] = useState<string | null>(null);

    const [vi, setVi] = useState<string | null>(minimisePrompt);
    /** File‑picker handler */
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setVideoURL(URL.createObjectURL(file));

        setShowTrim(true);
    };

    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            width="100%"
            height="100%"
            p={2}
        >
            {/* Video selector */}
            <label
                style={{ cursor: "pointer", fontSize: matchMobile ? '1.3rem' : '2.3rem' }}
                className="inline-block border rounded-2xl shadow p-3 text-center transition hover:shadow-lg"
            >
                {videoURL || trimmedUrl ? '' : 'click to upload a video for Interactive content Demo'}
                <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                />
            </label>


            {
                ShowTrim
                    ?


                    /*


                     videoURL && <Sandbox  CloudvideoURL={CloudvideoURL}videoURL={videoURL} />
                    
        
                   
                  <Sandbox CloudvideoURL={CloudvideoURL} videoURL={videoURL} />     
                   
*/

                    videoURL &&


                    <InteractTrim


                        setIsImg1={() => { }}
                        setIsImg2={() => { }}
                        isImage={false}
                        Inttype={0}
                        IntMediaType={0}

                        type={1}
                        setOpenIntMedia={() => { }}
                        trimmedUrl={trimmedUrl}
                        setTrimmedUrl={setTrimmedUrl}
                        setShowTrim={setShowTrim}
                        videoURL={videoURL}

                        setCloudvideoURL={setCloudvideoURL}

                    />



                    :

                    trimmedUrl && <Sandbox
                        closeInteractionx={false}
                        setcloseInteractionx={() => { }}
                        item={[]} type={0} CloudvideoURL={CloudvideoURL} videoURL={trimmedUrl} />
            }



        </Box>
    );
};

export default InteractInput;
