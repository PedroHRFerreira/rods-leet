const NAME_COLORS: Record<string, string> = {
  "name-cyan": "var(--cosmetic-name-cyan)",
  "name-violet": "var(--cosmetic-name-violet)",
};

export function cosmeticNameColor(id?: string | null): string | undefined {
  return id ? NAME_COLORS[id] : undefined;
}

export function CosmeticAvatar({
  avatarId,
  displayName = "Explorador",
  size = 40,
}: {
  avatarId?: string | null;
  displayName?: string;
  size?: number;
}) {
  const kind = avatarId?.replace("avatar-", "");
  const label =
    kind === "fox"
      ? "Raposa curiosa"
      : kind === "scholar"
        ? "Coruja sábia"
        : kind === "flame"
          ? "Chama constante"
          : kind === "robot"
            ? "Robô explorador"
            : `Avatar de ${displayName}`;
  return (
    <svg
      className={`cosmetic-avatar cosmetic-avatar-${kind || "default"}`}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label={label}
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
}
