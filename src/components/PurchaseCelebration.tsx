import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Check, Lightbulb, Palette, Sparkles } from "lucide-react";
import type { ShopItem } from "../lib/contracts";
import { SHOP_ITEMS } from "../domain/shop-catalog";
import { CosmeticAvatar, cosmeticNameColor } from "./CosmeticAvatar";
import "./purchase-celebration.css";

export interface CelebrationScene {
  motif: string;
  accent: string;
  secondary: string;
  caption: string;
}
// Every purchase has its own composition, using only approved, local values.
const SCENES: Record<string, CelebrationScene> = {
  "hint-extra": {
    motif: "idea",
    accent: "#fbbf24",
    secondary: "#fde68a",
    caption: "Uma nova luz no seu caminho",
  },
  "hint-pack3": {
    motif: "three-ideas",
    accent: "#fbbf24",
    secondary: "#fb923c",
    caption: "Três caminhos para destravar",
  },
  "hint-pack10": {
    motif: "idea-library",
    accent: "#fcd34d",
    secondary: "#a78bfa",
    caption: "Uma biblioteca de possibilidades",
  },
  "avatar-robot": {
    motif: "workshop",
    accent: "#22d3ee",
    secondary: "#818cf8",
    caption: "Seu companheiro está pronto",
  },
  "avatar-fox": {
    motif: "fox-trail",
    accent: "#fb923c",
    secondary: "#fcd34d",
    caption: "Siga a sua curiosidade",
  },
  "avatar-robot-neon": {
    motif: "neon-core",
    accent: "#bef264",
    secondary: "#a78bfa",
    caption: "Uma nova energia para criar",
  },
  "avatar-astronaut": {
    motif: "launch",
    accent: "#c4b5fd",
    secondary: "#67e8f9",
    caption: "Próxima parada: novas descobertas",
  },
  "avatar-dragon": {
    motif: "dragon-wings",
    accent: "#6ee7b7",
    secondary: "#fbbf24",
    caption: "Sua aventura ganhou asas",
  },
  "avatar-ninja": {
    motif: "ninja-fan",
    accent: "#fb7185",
    secondary: "#cbd5e1",
    caption: "Precisão em cada novo desafio",
  },
  "name-cyan": {
    motif: "cyan-flow",
    accent: "#22d3ee",
    secondary: "#67e8f9",
    caption: "Seu nome em uma nova frequência",
  },
  "name-violet": {
    motif: "violet-prism",
    accent: "#c4b5fd",
    secondary: "#f0abfc",
    caption: "Um brilho de outro universo",
  },
  "name-neon-lime": {
    motif: "lime-pulse",
    accent: "#bef264",
    secondary: "#22d3ee",
    caption: "Sua assinatura ganhou energia",
  },
  "name-rose": {
    motif: "rose-bloom",
    accent: "#f9a8d4",
    secondary: "#fda4af",
    caption: "Sua assinatura floresceu",
  },
  "name-emerald": {
    motif: "emerald-gem",
    accent: "#6ee7b7",
    secondary: "#a7f3d0",
    caption: "Uma conquista lapidada por você",
  },
  "theme-ocean": {
    motif: "ocean-tide",
    accent: "#38bdf8",
    secondary: "#22d3ee",
    caption: "Seu espaço em águas novas",
  },
  "theme-sunset": {
    motif: "sunset-horizon",
    accent: "#fbbf24",
    secondary: "#fb7185",
    caption: "Um novo horizonte para estudar",
  },
  "theme-neon": {
    motif: "neon-city",
    accent: "#bef264",
    secondary: "#c4b5fd",
    caption: "Sua cidade de ideias acendeu",
  },
  "theme-cosmos": {
    motif: "cosmic-map",
    accent: "#d8b4fe",
    secondary: "#f9a8d4",
    caption: "Seu universo ficou maior",
  },
  "theme-forest": {
    motif: "forest-grove",
    accent: "#6ee7b7",
    secondary: "#bef264",
    caption: "Um refúgio para suas ideias",
  },
  "frame-neon": {
    motif: "circuit-border",
    accent: "#bef264",
    secondary: "#a78bfa",
    caption: "Seu perfil fechou o circuito",
  },
  "frame-orbit": {
    motif: "orbital-rings",
    accent: "#c4b5fd",
    secondary: "#67e8f9",
    caption: "Uma nova órbita para seu perfil",
  },
  "frame-vine": {
    motif: "vine-wreath",
    accent: "#6ee7b7",
    secondary: "#bef264",
    caption: "Suas conquistas criaram raízes",
  },
  "frame-pixel": {
    motif: "pixel-portal",
    accent: "#67e8f9",
    secondary: "#f9a8d4",
    caption: "Um clássico, pixel por pixel",
  },
  "title-curious": {
    motif: "curiosity-book",
    accent: "#67e8f9",
    secondary: "#c4b5fd",
    caption: "Cada pergunta abre uma porta",
  },
  "title-persistent": {
    motif: "persistence-stairs",
    accent: "#fbbf24",
    secondary: "#6ee7b7",
    caption: "Mais um passo na sua jornada",
  },
  "title-debugger": {
    motif: "debug-scan",
    accent: "#fb7185",
    secondary: "#67e8f9",
    caption: "Sua próxima pista está por perto",
  },
  "title-algorithm": {
    motif: "algorithm-tree",
    accent: "#c4b5fd",
    secondary: "#fbbf24",
    caption: "Ideias conectadas, conquistas reais",
  },
};
export function getCelebrationScene(
  itemId: string,
): CelebrationScene | undefined {
  return Object.hasOwn(SCENES, itemId) ? SCENES[itemId] : undefined;
}
const FALLBACK_SCENE: CelebrationScene = {
  motif: "confirmed",
  accent: "#67e8f9",
  secondary: "#c4b5fd",
  caption: "Uma nova conquista na sua coleção",
};

function Star({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${size})`}
      d="M0-12 4-4 12 0 4 4 0 12-4 4-12 0-4-4Z"
    />
  );
}
function Bulb({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-22-8a22 22 0 1 1 44 0c0 12-12 16-12 30h-20C-10 8-22 4-22-8ZM-10 30h20m-15 8h10M0-47v-10m-39 22-8-8m86 8 8-8" />
    </g>
  );
}
function Artwork({ motif }: { motif: string }) {
  let drawing: ReactNode;
  switch (motif) {
    case "idea":
      drawing = (
        <>
          <Bulb x={300} y={175} scale={3} />
          <Star x={130} y={90} size={1.6} />
          <Star x={480} y={250} size={2} />
        </>
      );
      break;
    case "three-ideas":
      drawing = (
        <>
          {[160, 300, 440].map((x, i) => (
            <g key={x} transform={`rotate(${(i - 1) * 12} ${x} 190)`}>
              <rect x={x - 65} y={70} width={130} height={240} rx={22} />
              <Bulb x={x} y={180} scale={1.4} />
            </g>
          ))}
        </>
      );
      break;
    case "idea-library":
      drawing = (
        <>
          {Array.from({ length: 10 }, (_, i) => (
            <g
              key={i}
              transform={`translate(${90 + i * 43} ${130 + Math.abs(4.5 - i) * 13})`}
            >
              <rect width={32} height={130} rx={6} />
              <path d="M8 20h16m-16 80h16" />
            </g>
          ))}
          <path d="M70 330h470" />
          <Star x={300} y={65} size={2} />
        </>
      );
      break;
    case "workshop":
      drawing = (
        <>
          <path d="m105 120 40-25 40 25v50l-40 25-40-25Zm310 100 40-25 40 25v50l-40 25-40-25Z" />
          <circle cx={145} cy={145} r={19} />
          <circle cx={455} cy={245} r={19} />
          <path d="M180 145h50v-60h140v130h50M105 275h100v40h160" />
          <rect x={265} y={45} width={70} height={20} rx={7} />
        </>
      );
      break;
    case "fox-trail":
      drawing = (
        <>
          <path d="m135 300-40-195 115 75 90-130 90 130 115-75-40 195-165 35Z" />
          <path d="m150 250 150 85 150-85M85 335q75-55 120-5m190 0q45-50 120 5" />
          <path d="m112 105 20 90 60-10m296-80-20 90-60-10" />
        </>
      );
      break;
    case "neon-core":
      drawing = (
        <>
          <path d="m300 35 195 155-195 155L105 190Z" />
          <path d="m300 70 150 120-150 120-150-120ZM60 95h65v60m415 130h-65v-60M185 40v40m230 260v-40" />
          <circle cx={70} cy={95} r={9} />
          <circle cx={530} cy={285} r={9} />
        </>
      );
      break;
    case "launch":
      drawing = (
        <>
          <path d="M100 320Q390 380 505 65M75 280Q375 330 470 45" />
          <circle cx={125} cy={85} r={34} />
          <ellipse
            cx={125}
            cy={85}
            rx={70}
            ry={15}
            transform="rotate(-20 125 85)"
          />
          <path d="m470 60 22-28 7 35-12-9Z" />
          <Star x={450} y={290} size={2} />
          <Star x={215} y={55} />
        </>
      );
      break;
    case "dragon-wings":
      drawing = (
        <>
          <path d="m270 200-90-130-105 65 80 30-65 90 110-20 50 70m80-105 90-130 105 65-80 30 65 90-110-20-50 70" />
          <path d="m260 85 40-50 40 50M195 310l105 45 105-45" />
          <Star x={110} y={325} />
          <Star x={490} y={325} />
        </>
      );
      break;
    case "ninja-fan":
      drawing = (
        <>
          <path d="M300 310 70 115 160 55 300 310 280 25 300 310 430 45 530 130 300 310" />
          <path d="m80 320 415-235m-370 265 420-235" />
          <path d="m475 65 25 38m-55-13 25 38" />
        </>
      );
      break;
    case "cyan-flow":
      drawing = (
        <>
          {[70, 130, 190, 250, 310].map((y, i) => (
            <path
              key={y}
              d={`M50 ${y}Q170 ${y - 70} 300 ${y}T550 ${y}`}
              strokeDasharray={i % 2 ? "10 16" : undefined}
            />
          ))}
          <circle cx={95} cy={190} r={20} />
          <circle cx={505} cy={190} r={20} />
        </>
      );
      break;
    case "violet-prism":
      drawing = (
        <>
          <path d="m300 30 210 305H90ZM300 30v305M90 335l315-155M510 335 195 180" />
          <path d="M35 190h130m-130 30h150m270-55 110-35m-90 70 90-10m-115 50 115 35" />
        </>
      );
      break;
    case "lime-pulse":
      drawing = (
        <>
          <path d="M35 190h100l45-90 65 185 60-230 65 230 50-140 40 45h105" />
          <path d="M90 55h45v45m375 180v45h-45" />
          <rect x={90} y={290} width={18} height={45} />
          <rect x={120} y={260} width={18} height={75} />
          <rect x={150} y={225} width={18} height={110} />
        </>
      );
      break;
    case "rose-bloom":
      drawing = (
        <>
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <ellipse
              key={angle}
              cx={300}
              cy={105}
              rx={58}
              ry={82}
              transform={`rotate(${angle} 300 190)`}
            />
          ))}
          <circle cx={300} cy={190} r={35} />
          <path d="M75 295q65-70 120 0M405 295q55-70 120 0" />
        </>
      );
      break;
    case "emerald-gem":
      drawing = (
        <>
          <path d="m170 70 260 0 80 100-210 175L90 170ZM170 70l130 275L430 70M90 170h420M170 70l130 100 130-100" />
          <Star x={70} y={85} />
          <Star x={535} y={285} size={1.7} />
        </>
      );
      break;
    case "ocean-tide":
      drawing = (
        <>
          <circle cx={430} cy={95} r={43} />
          {[185, 225, 265, 305].map((y) => (
            <path key={y} d={`M30 ${y}q70-65 140 0t140 0t140 0t140 0`} />
          ))}
          <path d="m105 125 20-20 20 20m-10-40 20-20 20 20" />
        </>
      );
      break;
    case "sunset-horizon":
      drawing = (
        <>
          <path d="M155 230a145 145 0 0 1 290 0M40 230h520M85 270h430M135 310h330" />
          {[-60, -30, 0, 30, 60].map((angle) => (
            <path
              key={angle}
              d="M300 25v32"
              transform={`rotate(${angle} 300 230)`}
            />
          ))}
          <path d="m65 130 45-30 45 30m290 20 30-20 30 20" />
        </>
      );
      break;
    case "neon-city":
      drawing = (
        <>
          <path d="M35 325V190h70V95h70v230m0-70h55V45h75v280m0-120h45V110h65v215m0-60h45V155h100v170M25 325h550" />
          {[115, 250, 370, 480].map((x) => (
            <path key={x} d={`M${x} 175h20m-20 35h20m-20 35h20`} />
          ))}
          <path d="M235 55h60m-30-25v25" />
        </>
      );
      break;
    case "cosmic-map":
      drawing = (
        <>
          <circle cx={135} cy={110} r={42} />
          <ellipse
            cx={135}
            cy={110}
            rx={76}
            ry={17}
            transform="rotate(-25 135 110)"
          />
          <circle cx={475} cy={270} r={55} />
          <path d="m205 60 80 35 75-55 95 80-70 55 30 75-145 85-100-65" />
          {[
            [205, 60],
            [285, 95],
            [360, 40],
            [455, 120],
            [385, 175],
            [415, 250],
            [270, 335],
            [170, 270],
          ].map(([x, y]) => (
            <Star key={`${x}-${y}`} x={x} y={y} size={0.65} />
          ))}
        </>
      );
      break;
    case "forest-grove":
      drawing = (
        <>
          <path d="m125 45-70 120h45l-70 105h190l-70-105h45ZM475 45l-70 120h45l-70 105h190l-70-105h45Z" />
          <path d="M125 270v75m350-75v75M55 345q245-50 490 0" />
          <path d="m245 60 30-25m80 25-30-25M90 305q20-30 40 0m340 0q20-30 40 0" />
        </>
      );
      break;
    case "circuit-border":
      drawing = (
        <>
          <path d="M95 135V55h150m110 0h150v80m0 110v80H355m-110 0H95v-80M65 160V25h130m210 0h130v135M65 220v135h130m210 0h130V220" />
          {[
            [95, 135],
            [245, 55],
            [355, 325],
            [505, 245],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={9} />
          ))}
        </>
      );
      break;
    case "orbital-rings":
      drawing = (
        <>
          <ellipse
            cx={300}
            cy={190}
            rx={245}
            ry={92}
            transform="rotate(-24 300 190)"
          />
          <ellipse
            cx={300}
            cy={190}
            rx={200}
            ry={120}
            transform="rotate(24 300 190)"
          />
          <circle cx={300} cy={190} r={138} />
          <circle cx={80} cy={270} r={16} />
          <circle cx={485} cy={80} r={10} />
        </>
      );
      break;
    case "vine-wreath":
      drawing = (
        <>
          <path d="M200 335C35 200 95 60 260 35m80 0c165 25 225 165 60 300" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(300 190) rotate(${i * 34 - 65})`}>
              <path d="M-185 0q-45-45-65 0 20 40 65 0m370 0q45-45 65 0-20 40-65 0" />
            </g>
          ))}
          <path d="m245 335 55 25 55-25" />
        </>
      );
      break;
    case "pixel-portal":
      drawing = (
        <>
          <path d="M80 120V60h60V30h60m200 0h60v30h60v60m0 140v60h-60v30h-60m-200 0h-60v-30H80v-60" />
          {[
            [55, 175],
            [100, 215],
            [520, 165],
            [475, 205],
            [175, 60],
            [400, 290],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={25} height={25} />
          ))}
          <path d="M110 145v90m380-90v90" />
        </>
      );
      break;
    case "curiosity-book":
      drawing = (
        <>
          <path d="M75 280V105q110-45 225 15 115-60 225-15v175q-110-35-225 20-115-55-225-20ZM300 120v180" />
          <path d="M115 135q65-20 120 0m-120 35q65-20 120 0m-120 35q65-20 120 0m250-75q35-45 55-5t-25 45v20" />
          <circle cx={390} cy={213} r={3} />
          <Star x={300} y={45} />
        </>
      );
      break;
    case "persistence-stairs":
      drawing = (
        <>
          <path d="M60 325h90v-55h90v-55h90v-55h90v-55h90M65 345h475M440 105V35l70 20-70 20" />
          <path d="m100 200 50-55 60 0 55-55m-30 0h30v30" />
          <Star x={360} y={65} size={1.8} />
        </>
      );
      break;
    case "debug-scan":
      drawing = (
        <>
          <ellipse cx={300} cy={185} rx={75} ry={95} />
          <path d="M300 90v190m-65-145-60-35m50 85h-70m80 50-60 40m190-140 60-35m-50 85h70m-80 50 60 40M260 90l-25-35m105 35 25-35M70 65h50m-50 0v50m460-50h-50m50 0v50M70 315h50m-50 0v-50m460 50h-50m50 0v-50" />
          <path d="M100 185h400" strokeDasharray="10 12" />
        </>
      );
      break;
    case "algorithm-tree":
      drawing = (
        <>
          <path d="M300 85v50H140v80m160-80h160v80M140 235v55H65m75 0h75m245-55v55h-75m75 0h75" />
          {[
            [300, 55],
            [140, 215],
            [460, 215],
            [65, 315],
            [215, 315],
            [385, 315],
            [535, 315],
          ].map(([x, y], i) =>
            i % 2 ? (
              <rect
                key={x}
                x={x - 23}
                y={y - 23}
                width={46}
                height={46}
                rx={8}
              />
            ) : (
              <circle key={x} cx={x} cy={y} r={25} />
            ),
          )}
        </>
      );
      break;
    default:
      drawing = (
        <>
          <circle cx={300} cy={190} r={140} />
          <path d="m235 185 45 45 90-90" />
        </>
      );
  }
  return (
    <svg
      className="purchase-celebration-art"
      viewBox="0 0 600 380"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {drawing}
    </svg>
  );
}
function ItemReveal({
  item,
  displayName,
}: {
  item: ShopItem;
  displayName: string;
}) {
  if (item.kind === "avatar")
    return (
      <div className="purchase-celebration-portrait">
        <CosmeticAvatar avatarId={item.id} size={152} />
      </div>
    );
  if (item.kind === "frame")
    return (
      <div className="purchase-celebration-portrait">
        <CosmeticAvatar
          frameId={item.id}
          displayName={displayName}
          size={144}
        />
      </div>
    );
  if (item.kind === "name_color")
    return (
      <div
        className="purchase-celebration-name"
        style={{ color: cosmeticNameColor(item.id) }}
      >
        {displayName}
      </div>
    );
  if (item.kind === "theme")
    return (
      <div
        className={`purchase-celebration-theme shop-theme-preview shop-theme-${item.value}`}
        aria-label={`Prévia do tema ${item.name}`}
      >
        <div className="shop-theme-mini-header">
          <Palette size={20} /> Meu espaço
        </div>
        <div className="shop-theme-mini-body">
          <span />
          <div>
            <strong>Seu próximo desafio</strong>
            <span />
            <span />
          </div>
        </div>
        <span className="shop-theme-mini-button">Continue aprendendo</span>
      </div>
    );
  if (item.kind === "title")
    return (
      <div className="purchase-celebration-title">
        <Sparkles size={28} aria-hidden="true" />
        <span>{item.value}</span>
        <small>{displayName}</small>
      </div>
    );
  return (
    <div className="purchase-celebration-hints">
      <Lightbulb size={68} strokeWidth={1.6} aria-hidden="true" />
      <strong>+{item.hintCount ?? 1}</strong>
      <span>
        {item.hintCount === 1 ? "dica disponível" : "dicas disponíveis"}
      </span>
    </div>
  );
}

export default function PurchaseCelebration({
  item,
  displayName,
  onClose,
}: {
  item: ShopItem;
  displayName: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [finished, setFinished] = useState(reducedMotion);
  const finishIntro = useCallback(() => {
    // Keep keyboard focus when the temporary skip control is removed.
    if (document.activeElement === skipButton.current) {
      continueButton.current?.focus({ preventScroll: true });
    }
    setFinished(true);
  }, []);
  const canonical = SHOP_ITEMS.find(
    (candidate) =>
      candidate.id === item.id && candidate.acquisition === "purchase",
  );
  const scene = getCelebrationScene(canonical?.id ?? "") ?? FALLBACK_SCENE;
  const style = {
    "--celebration-accent": scene.accent,
    "--celebration-secondary": scene.secondary,
  } as CSSProperties;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) finishIntro();
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [finishIntro]);
  useEffect(() => {
    if (finished || reducedMotion) return;
    const timer = window.setTimeout(finishIntro, 2800);
    return () => window.clearTimeout(timer);
  }, [finished, reducedMotion, finishIntro]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!element.open) element.showModal();
    continueButton.current?.focus({ preventScroll: true });
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="purchase-celebration"
      style={style}
      data-scene={scene.motif}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-phase={finished || reducedMotion ? "settled" : "intro"}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="purchase-celebration-glow" aria-hidden="true" />
      <div className="purchase-celebration-content">
        <p className="purchase-celebration-confirmed">
          <Check size={18} aria-hidden="true" /> Compra confirmada
        </p>
        <div className="purchase-celebration-stage">
          <Artwork motif={scene.motif} />
          <div className="purchase-celebration-reveal">
            {canonical ? (
              <ItemReveal item={canonical} displayName={displayName} />
            ) : (
              <Sparkles size={112} aria-hidden="true" />
            )}
          </div>
          <div className="purchase-celebration-particles" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>
        <p className="purchase-celebration-caption">{scene.caption}</p>
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          {canonical?.name ?? item.name}
        </h2>
        <p id={descriptionId} className="purchase-celebration-description">
          {canonical?.kind === "hint"
            ? "As dicas foram adicionadas ao seu saldo. Use quando precisar de uma nova pista."
            : "Este item agora faz parte do seu inventário. Você pode equipá-lo quando quiser, na loja."}
        </p>
        <div className="purchase-celebration-actions">
          <button
            ref={continueButton}
            type="button"
            className="button button-primary"
            onClick={onClose}
          >
            Continuar na loja
          </button>
          {!finished && !reducedMotion && (
            <button
              ref={skipButton}
              type="button"
              className="purchase-celebration-skip"
              onClick={finishIntro}
            >
              Pular animação
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
