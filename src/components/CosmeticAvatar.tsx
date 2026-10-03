import { SHOP_ITEMS } from "../domain/shop-catalog";

const NAME_COLORS: Record<string, string> = {
  "name-cyan": "var(--cosmetic-name-cyan)",
  "name-violet": "var(--cosmetic-name-violet)",
  "name-neon-lime": "var(--cosmetic-name-lime)",
  "name-rose": "var(--cosmetic-name-rose)",
  "name-emerald": "var(--cosmetic-name-emerald)",
};

export function cosmeticNameColor(id?: string | null): string | undefined {
  return id && Object.hasOwn(NAME_COLORS, id) ? NAME_COLORS[id] : undefined;
}

const FRAME_CLASSES: Record<string, string> = {
  "frame-neon": "neon",
  "frame-orbit": "orbit",
  "frame-vine": "vine",
  "frame-pixel": "pixel",
  "frame-champion": "champion",
  "frame-runnerup": "runnerup",
  "frame-bronze": "bronze",
  "frame-finalist4": "finalist4",
  "frame-finalist5": "finalist5",
};
const AVATARS: Record<string, { kind: string; label: string }> = {
  "avatar-robot": { kind: "robot", label: "Robô explorador" },
  "avatar-fox": { kind: "fox", label: "Raposa curiosa" },
  "avatar-scholar": { kind: "scholar", label: "Coruja sábia" },
  "avatar-flame": { kind: "flame", label: "Chama constante" },
  "avatar-robot-neon": { kind: "robot-neon", label: "Robô Neon" },
  "avatar-astronaut": { kind: "astronaut", label: "Astronauta" },
  "avatar-dragon": { kind: "dragon", label: "Dragão do Bosque" },
  "avatar-ninja": { kind: "ninja", label: "Ninja do código" },
};
export function cosmeticTitle(id?: string | null): string | undefined {
  return id
    ? SHOP_ITEMS.find((item) => item.id === id && item.kind === "title")?.value
    : undefined;
}
export function cosmeticTheme(id?: string | null): string | undefined {
  const themes: Record<string, string> = {
    "theme-ocean": "ocean",
    "theme-sunset": "sunset",
    "theme-neon": "neon",
    "theme-cosmos": "cosmos",
    "theme-forest": "forest",
  };
  return id && Object.hasOwn(themes, id) ? themes[id] : undefined;
}

export function CosmeticAvatar({
  avatarId,
  frameId,
  displayName = "Explorador",
  size = 40,
}: {
  avatarId?: string | null;
  frameId?: string | null;
  displayName?: string;
  size?: number;
}) {
  const avatar =
    avatarId && Object.hasOwn(AVATARS, avatarId)
      ? AVATARS[avatarId]
      : undefined;
  const kind = avatar?.kind ?? "default";
  const label = avatar?.label ?? `Avatar de ${displayName}`;
  const frame =
    frameId && Object.hasOwn(FRAME_CLASSES, frameId)
      ? FRAME_CLASSES[frameId]
      : undefined;
  const graphic = (
    <svg
      className={`cosmetic-avatar cosmetic-avatar-${kind || "default"}`}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label={
        frame
          ? `${label}, moldura ${SHOP_ITEMS.find((item) => item.id === frameId)?.name ?? "personalizada"}`
          : label
      }
    >
      <rect width="80" height="80" rx="24" fill="#182333" />
      {kind === "fox" ? (
        <>
          <path d="M15 16 36 29 65 16 60 53 40 68 20 53Z" fill="#fb923c" />
          <path d="m20 36 20 16 20-16-5 22-15 10-15-10Z" fill="#ffedd5" />
          <path d="m17 20 14 12-12 4Zm46 0-14 12 12 4Z" fill="#7c2d12" />
          <circle cx="28" cy="42" r="3" fill="#182333" />
          <circle cx="52" cy="42" r="3" fill="#182333" />
          <path d="m35 53 5 5 5-5Z" fill="#182333" />
        </>
      ) : kind === "scholar" ? (
        <>
          <path
            d="m18 23 8 7h28l8-7v28c0 13-10 20-22 20S18 64 18 51Z"
            fill="#a78bfa"
          />
          <circle cx="29" cy="43" r="12" fill="#ede9fe" />
          <circle cx="51" cy="43" r="12" fill="#ede9fe" />
          <circle cx="29" cy="43" r="5" fill="#182333" />
          <circle cx="51" cy="43" r="5" fill="#182333" />
          <path d="m35 53 5 8 5-8Z" fill="#fbbf24" />
          <path d="m10 20 30-10 30 10-30 10Z" fill="#22d3ee" />
          <path d="M64 22v15" stroke="#fbbf24" strokeWidth="3" />
        </>
      ) : kind === "flame" ? (
        <>
          <path
            d="M41 10c5 21 20 20 20 39a21 21 0 0 1-42 0c0-11 7-18 13-25-1 10 3 12 5 12 6-7 7-14 4-26Z"
            fill="#fb923c"
          />
          <path
            d="M40 35c3 13 10 14 10 22a10 10 0 0 1-20 0c0-8 7-12 10-22Z"
            fill="#fde68a"
          />
          <circle cx="32" cy="47" r="2" fill="#182333" />
          <circle cx="49" cy="47" r="2" fill="#182333" />
        </>
      ) : kind === "robot-neon" ? (
        <>
          <path d="M40 15v10M15 43H8m57 0h7" stroke="#bef264" strokeWidth="4" />
          <path d="m35 12 5-7 5 7-5 6Z" fill="#bef264" />
          <rect x="15" y="25" width="50" height="40" rx="9" fill="#a78bfa" />
          <path
            d="m17 27 9 8m37-8-9 8M17 62l9-8m37 8-9-8"
            stroke="#bef264"
            strokeWidth="3"
          />
          <rect x="23" y="34" width="34" height="19" rx="3" fill="#172033" />
          <path d="m28 43 7-4v8Zm24 0-7-4v8Z" fill="#bef264" />
          <path d="M33 59h14" stroke="#bef264" strokeWidth="3" />
        </>
      ) : kind === "astronaut" ? (
        <>
          <path d="M16 80V60c0-10 11-16 24-16s24 6 24 16v20" fill="#e2e8f0" />
          <circle cx="40" cy="32" r="25" fill="#f8fafc" />
          <rect x="20" y="19" width="40" height="26" rx="12" fill="#312e81" />
          <path
            d="m27 24 10-2"
            stroke="#67e8f9"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="29" cy="32" r="3" fill="#f9a8d4" />
          <circle cx="51" cy="32" r="3" fill="#f9a8d4" />
          <rect x="30" y="61" width="20" height="12" rx="3" fill="#818cf8" />
          <path d="m67 9 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fbbf24" />
        </>
      ) : kind === "dragon" ? (
        <>
          <path
            d="m19 42-12-9 3 27 18-10m33-8 12-9-3 27-18-10"
            fill="#22c55e"
          />
          <path d="m25 22-6-13 15 8m21 5 6-13-15 8" fill="#fbbf24" />
          <path
            d="M18 36c0-14 10-20 22-20s22 6 22 20v20c0 12-10 17-22 17S18 68 18 56Z"
            fill="#6ee7b7"
          />
          <path d="m28 18 12-9 12 9" fill="#22c55e" />
          <ellipse cx="40" cy="55" rx="19" ry="11" fill="#059669" />
          <circle cx="29" cy="37" r="4" fill="#172033" />
          <circle cx="51" cy="37" r="4" fill="#172033" />
          <circle cx="32" cy="52" r="2" fill="#172033" />
          <circle cx="48" cy="52" r="2" fill="#172033" />
          <path d="m30 62 4 5 4-5m4 0 4 5 4-5" fill="#f8fafc" />
        </>
      ) : kind === "ninja" ? (
        <>
          <path d="m60 39 10 32m-7-35 10-3" stroke="#e2e8f0" strokeWidth="5" />
          <path d="M15 80V65c0-10 11-16 25-16s25 6 25 16v15" fill="#334155" />
          <circle cx="40" cy="34" r="24" fill="#475569" />
          <path d="M17 25h46v10H17Zm44 2 15-6-6 13-10-2" fill="#fb7185" />
          <path d="M21 37h38l-5 11H26Z" fill="#ffedd5" />
          <path d="m27 40 8 2m18-2-8 2" stroke="#172033" strokeWidth="3" />
          <path d="m34 59 6 7 6-7" fill="#fb7185" />
        </>
      ) : kind === "robot" ? (
        <>
          <path d="M40 15v9" stroke="#22d3ee" strokeWidth="4" />
          <circle cx="40" cy="12" r="5" fill="#c4b5fd" />
          <rect x="15" y="25" width="50" height="40" rx="13" fill="#22d3ee" />
          <rect x="23" y="33" width="34" height="19" rx="7" fill="#182333" />
          <circle cx="32" cy="42" r="4" fill="#e0f2fe" />
          <circle cx="48" cy="42" r="4" fill="#e0f2fe" />
          <path
            d="M32 58h16"
            stroke="#182333"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : (
        <text
          x="40"
          y="51"
          textAnchor="middle"
          fontSize="32"
          fontWeight="700"
          fill="#c4b5fd"
        >
          {displayName.trim().charAt(0).toLocaleUpperCase("pt-BR") || "R"}
        </text>
      )}
    </svg>
  );
  return frame ? (
    <span className={`cosmetic-frame cosmetic-frame-${frame}`}>{graphic}</span>
  ) : (
    graphic
  );
}
