"use client";
import { createContext, useContext } from "react";
import type { OverlayTone } from "@/lib/prefs";

export interface OverlayEnv { tone: OverlayTone; lite: boolean }
const Ctx = createContext<OverlayEnv>({ tone: "dark", lite: false });

export const OverlayEnvProvider = Ctx.Provider;
/** Card tone (dark/light) and lite mode, set by the overlay URL (?tone=light&lite=1). */
export const useOverlayEnv = () => useContext(Ctx);
