"use client";
import { createContext, useContext } from "react";
import type { OverlayTone } from "@/lib/prefs";
import { STAGES, type Stage } from "@/lib/overlay/stage";

export type CardAnim = "slide" | "pop" | "fade" | "rise";
export interface OverlayEnv { tone: OverlayTone; lite: boolean; stage: Stage; anim: CardAnim }
const Ctx = createContext<OverlayEnv>({ tone: "dark", lite: false, stage: STAGES.landscape, anim: "slide" });

export const OverlayEnvProvider = Ctx.Provider;
/** Card tone, lite mode, output format (stage) and card animation, set by the overlay URL. */
export const useOverlayEnv = () => useContext(Ctx);
