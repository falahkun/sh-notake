import { create } from "zustand";

type ShareState = {
  status: "idle" | "loading" | "success" | "error";
  error?: string;
  setStatus: (status: ShareState["status"], error?: string) => void;
};

export const useShareStore = create<ShareState>((set) => ({
  status: "idle",
  setStatus: (status, error) => set({ status, error })
}));
