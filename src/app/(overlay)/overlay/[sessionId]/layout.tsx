export default function SessionOverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`:root { --ov-scale: min(100vw / 1920, 100vh / 1080); }`}</style>
      {children}
    </>
  );
}