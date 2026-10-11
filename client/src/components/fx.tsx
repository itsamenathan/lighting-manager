import { useEffect, useRef, useState } from "react";

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789ABCDEF<>/{}[]#$%&*π";

export function MatrixRain({ color = "#39ff14", speed = 1, opacity = 0.3 }: { color?: string; speed?: number; opacity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(color);
  const speedRef = useRef(speed);
  colorRef.current = color;
  speedRef.current = speed;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const size = 20;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drops = Array.from({ length: Math.ceil(canvas.width / size) }, () => Math.random() * -60);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 55 / speedRef.current) return;
      last = t;
      ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${size}px VT323, monospace`;
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() > 0.97 ? "#ffffff" : colorRef.current;
        ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * size, y * size);
        drops[i] = y * size > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
      });
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas className="matrix" ref={ref} style={{ opacity }} aria-hidden />;
}

export function CrtOverlay() {
  return <div className="crt" aria-hidden />;
}

export function Glitch({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`glitch ${className}`} data-text={text}>
      {text}
    </span>
  );
}

/** Types text out character by character whenever it changes. */
export function Typewriter({ text, speed = 28 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <span className="typewriter">
      {shown}
      <span className="cursor">█</span>
    </span>
  );
}

/** Deterministic neon gradient per speaker, used for the Netflix-style "poster". */
export function posterStyle(seed: string): React.CSSProperties {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = h % 360;
  const b = (a + 60 + (h % 120)) % 360;
  return { background: `linear-gradient(135deg, hsl(${a} 100% 45%), hsl(${b} 100% 30%) 60%, #000)` };
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0]?.toUpperCase())
    .join("");
