export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-screen overflow-hidden bg-transparent">{children}</div>;
}