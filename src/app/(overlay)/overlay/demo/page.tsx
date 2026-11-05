import { notFound } from "next/navigation";
import { DemoContent } from "./demo-content";

// Design sandbox for the graphics layer. Not available in production builds.
export default function OverlayDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DemoContent />;
}
