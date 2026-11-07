import React, { useEffect, useMemo, useState } from "react";
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type {
  ManualCharacterInput,
  PreparedManualCharacterImage,
} from "./manualCharacterImage";

interface ManualCharacterDialogProps {
  open: boolean;
  preparedImage: PreparedManualCharacterImage | null;
  darkMode: boolean;
  onClose: () => void;
  onCreate: (input: ManualCharacterInput) => Promise<void>;
}

const ManualCharacterDialog: React.FC<ManualCharacterDialogProps> = ({
  open,
  preparedImage,
  darkMode,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setSubmitError("");
      setIsSubmitting(false);
      setIsPreviewFullscreen(false);
    }
  }, [open]);

  const previewRatio = useMemo(() => {
    if (!preparedImage?.width || !preparedImage?.height) return "1 / 1";
    return `${preparedImage.width} / ${preparedImage.height}`;
  }, [preparedImage]);
  useCreationControls('direct_upload', 'ManualCharacterDialog', open, {
    hasPreparedImage: Boolean(preparedImage), nameLength: name.length,
    descriptionLength: description.length, isSubmitting, submitError, previewOpen: isPreviewFullscreen,
  });

  const handleClose = () => {
    if (isSubmitting) return;
    setName("");
    setDescription("");
    setSubmitError("");
    setIsPreviewFullscreen(false);
    onClose();
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!preparedImage || !trimmedName || !trimmedDescription || isSubmitting) {
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);
    try {
      await onCreate({
        name: trimmedName,
        description: trimmedDescription,
        imageBlob: preparedImage.blob,
      });
      setName("");
      setDescription("");
      setSubmitError("");
      setIsPreviewFullscreen(false);
    } catch (error: any) {
      setSubmitError(error?.message || "Failed to create character. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldSx = {
    "& .MuiInputLabel-root": {
      color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)",
    },
    "& .MuiOutlinedInput-root": {
      color: darkMode ? "#fff" : "#000",
      "& fieldset": {
        borderColor: darkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
      },
      "&:hover fieldset": {
        borderColor: darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
      },
      "&.Mui-focused fieldset": {
        borderColor: darkMode ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.75)",
      },
    },
  };

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        if (isSubmitting || reason === "backdropClick") return;
        handleClose();
      }}
      aria-labelledby="manual-character-dialog-title"
      PaperProps={{
        sx: {
          width: { xs: "calc(100vw - 24px)", sm: "min(680px, calc(100vw - 48px))" },
          maxWidth: "680px",
          maxHeight: { xs: "calc(100dvh - 24px)", sm: "calc(100dvh - 48px)" },
          m: { xs: 1.5, sm: 3 },
          bgcolor: darkMode ? "#121212" : "#ffffff",
          color: darkMode ? "#ffffff" : "#000000",
          borderRadius: 3,
          boxShadow: 24,
          border: darkMode
            ? "1px solid rgba(255,255,255,0.1)"
            : "1px solid rgba(0,0,0,0.1)",
          overflow: "hidden",
        },
      }}
    >
      <Box
        {...cb('direct_upload', 'scroll', 'Scroll direct upload details', 'characterDialog.scrollBy', 'scroll')}
        sx={{
          p: { xs: 2, sm: 4 },
          display: "flex",
          flexDirection: "column",
          gap: { xs: 2, sm: 3 },
          overflowY: "auto",
          maxHeight: { xs: "calc(100dvh - 24px)", sm: "calc(100dvh - 48px)" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography
            id="manual-character-dialog-title"
            variant="h6"
            component="h2"
            sx={{ fontWeight: "bold", flex: 1, minWidth: 0 }}
          >
            Character Details
          </Typography>
          <IconButton
            {...cb('direct_upload', 'close', 'Cancel direct image upload', 'handleClose')}
            aria-label="Close character details"
            onClick={handleClose}
            disabled={isSubmitting}
            sx={{
              color: darkMode ? "#fff" : "#000",
              flexShrink: 0,
              bgcolor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              "&:hover": {
                bgcolor: darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {preparedImage && (
          <Box
            {...cb('direct_upload', 'preview', 'Preview direct image', 'setIsPreviewFullscreen(true)')}
            aria-label="Open full screen character preview"
            role="button"
            tabIndex={0}
            onClick={() => setIsPreviewFullscreen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setIsPreviewFullscreen(true);
              }
            }}
            sx={{
              width: "100%",
              aspectRatio: previewRatio,
              minHeight: { xs: 190, sm: 280 },
              maxHeight: { xs: "38dvh", sm: "48dvh" },
              borderRadius: 2,
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              bgcolor: "rgba(0,0,0,0.5)",
              cursor: "zoom-in",
              outline: "none",
              "&:focus-visible": {
                boxShadow: darkMode ? "0 0 0 3px rgba(232,186,250,0.7)" : "0 0 0 3px rgba(0,153,204,0.55)",
              },
            }}
          >
            <Box
              component="img"
              src={preparedImage.previewUrl}
              alt="Uploaded"
              sx={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </Box>
        )}

        <TextField
          {...cb('direct_upload', 'name', 'Image name (required)', 'setName', 'text')}
          label="Image Name"
          variant="outlined"
          fullWidth
          value={name}
          onChange={(event) => setName(event.target.value)}
          sx={fieldSx}
        />

        <TextField
          {...cb('direct_upload', 'description', 'Reference description (required)', 'setDescription', 'text')}
          label="Description"
          variant="outlined"
          fullWidth
          multiline
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          sx={fieldSx}
        />

        {submitError && (
          <Alert severity="error" role="alert">
            {submitError}
          </Alert>
        )}

        <Button
          {...cb('direct_upload', 'create', 'Attach named image reference', 'handleCreate', 'click', 'candidate')}
          variant="contained"
          disabled={isSubmitting || !preparedImage || !name.trim() || !description.trim()}
          onClick={handleCreate}
          sx={{
            background: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.8)",
            color: "#fff",
            py: 1.5,
            borderRadius: 2,
            "&:hover": {
              background: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,1)",
            },
          }}
        >
          {isSubmitting ? <CircularProgress size={24} color="inherit" /> : "Create Character"}
        </Button>
      </Box>

      {preparedImage && (
        <Dialog
          open={isPreviewFullscreen}
          onClose={() => setIsPreviewFullscreen(false)}
          maxWidth={false}
          PaperProps={{
            sx: {
              width: "100vw",
              height: "100dvh",
              maxWidth: "100vw",
              maxHeight: "100dvh",
              m: 0,
              bgcolor: "rgba(0,0,0,0.94)",
              borderRadius: 0,
              overflow: "hidden",
              boxShadow: "none",
            },
          }}
        >
          <Box
            onClick={() => setIsPreviewFullscreen(false)}
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "zoom-out",
              p: { xs: 1.5, sm: 3 },
            }}
          >
            <IconButton
              aria-label="Close full screen image"
              onClick={(event) => {
                event.stopPropagation();
                setIsPreviewFullscreen(false);
              }}
              sx={{
                position: "fixed",
                top: { xs: 12, sm: 20 },
                right: { xs: 12, sm: 20 },
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.12)",
                zIndex: 2,
                "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
              }}
            >
              <CloseIcon />
            </IconButton>
            <Box
              component="img"
              src={preparedImage.previewUrl}
              alt="Uploaded full screen"
              sx={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </Box>
        </Dialog>
      )}
    </Dialog>
  );
};

export default ManualCharacterDialog;
