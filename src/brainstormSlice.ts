import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { ChatMessage } from "./PromptConstructorMock";

export type BrainstormMemorySlot = {
  slotId: number;
  turnStart: number;
  turnEnd: number;
  title: string;
  fullSummary: string;
  rejectedIdeas: string[];
  openQuestions: string[];
  names: string[];
  style: string;
};

export type UserSnapshotAction = {
  type: string;
  label?: string;
  target?: string;
  tagName?: string;
  route?: string;
  timestamp: number;
};

export type UserSnapshot = {
  timestamp: number;
  route: string;
  pageName: string;
  device: "mobile" | "desktop";
  loggedUserName: string;
  ui: {
    isMenuOpen: boolean;
    minimisePrompt: boolean;
    isBrainstormChatOpen: boolean;
  };
  app: {
    prompt: string;
    promptLength: number;
    artstyle: string;
    model: string;
    aspectRatio: number;
  };
  lastAction: UserSnapshotAction | null;
  recentActions: UserSnapshotAction[];
};

interface BrainstormState {
  chatHistory: ChatMessage[];
  memorySlots: BrainstormMemorySlot[];
  isChatOpen: boolean;
  selectedVoice: string;
  userSnapshot: UserSnapshot;
}

const initialState: BrainstormState = {
  chatHistory: [],
  memorySlots: [],
  isChatOpen: false,
  selectedVoice: 'Zephyr',
  userSnapshot: {
    timestamp: Date.now(),
    route: '/',
    pageName: 'Home',
    device: 'desktop',
    loggedUserName: 'Guest',
    ui: {
      isMenuOpen: false,
      minimisePrompt: true,
      isBrainstormChatOpen: false,
    },
    app: {
      prompt: '',
      promptLength: 0,
      artstyle: '',
      model: '',
      aspectRatio: 1,
    },
    lastAction: null,
    recentActions: [],
  },
};

const brainstormSlice = createSlice({
  name: "brainstorm",
  initialState,
  reducers: {
    setBrainstormChatHistory(state, action: PayloadAction<ChatMessage[]>) {
      state.chatHistory = action.payload;
    },
    setBrainstormChatOpen(state, action: PayloadAction<boolean>) {
      state.isChatOpen = action.payload;
    },
    setBrainstormSelectedVoice(state, action: PayloadAction<string>) {
      state.selectedVoice = action.payload;
    },
    patchUserSnapshot(state, action: PayloadAction<Partial<UserSnapshot>>) {
      state.userSnapshot = {
        ...state.userSnapshot,
        ...action.payload,
        timestamp: Date.now(),
      };
    },
    recordUserAction(state, action: PayloadAction<Omit<UserSnapshotAction, "timestamp"> & { timestamp?: number }>) {
      const timestamp = action.payload.timestamp ?? Date.now();
      const event: UserSnapshotAction = {
        ...action.payload,
        timestamp,
      };
      state.userSnapshot.lastAction = event;
      state.userSnapshot.recentActions = [event, ...state.userSnapshot.recentActions].slice(0, 20);
      state.userSnapshot.timestamp = timestamp;
    },
    appendBrainstormMessage(state, action: PayloadAction<ChatMessage>) {
      state.chatHistory.push(action.payload);
    },
    patchBrainstormMessage(state, action: PayloadAction<{ id: string; patch: Partial<ChatMessage> }>) {
      const msg = state.chatHistory.find((m) => m.id === action.payload.id);
      if (msg) Object.assign(msg, action.payload.patch);
    },
    addBrainstormMemorySlot(state, action: PayloadAction<BrainstormMemorySlot>) {
      if (!state.memorySlots.some((slot) => slot.slotId === action.payload.slotId)) {
        state.memorySlots.push(action.payload);
      }
    },
    setBrainstormMemorySlots(state, action: PayloadAction<BrainstormMemorySlot[]>) {
      state.memorySlots = action.payload;
    },
    resetBrainstormSession(state) {
      state.chatHistory = [];
      state.memorySlots = [];
    },
  },
});

export const {
  setBrainstormChatHistory,
  setBrainstormChatOpen,
  setBrainstormSelectedVoice,
  patchUserSnapshot,
  recordUserAction,
  appendBrainstormMessage,
  patchBrainstormMessage,
  addBrainstormMemorySlot,
  setBrainstormMemorySlots,
  resetBrainstormSession,
} = brainstormSlice.actions;

export default brainstormSlice.reducer;
