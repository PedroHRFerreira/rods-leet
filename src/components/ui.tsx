import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  Binary,
  Blocks,
  Braces,
  Boxes,
  Cloud,
  Code2,
  Database,
  GitBranch,
  Layers3,
  LoaderCircle,
  Search,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import type { Difficulty, TopicId } from "../lib/contracts";

const topicIcons = {
  logic: Braces,
  algorithms: GitBranch,
  "data-structures": Layers3,
  sql: Database,
  oop: Boxes,
  backend: Server,
  testing: ShieldCheck,
  architecture: Blocks,
  "system-design": Workflow,
  devops: Cloud,
};
export function TopicIcon({
  topicId,
  size = 22,
  className = "",
}: {
  topicId: TopicId;
  size?: number;
  className?: string;
}) {
  const Icon = topicIcons[topicId] ?? Code2;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`difficulty-badge difficulty-${difficulty}`}>
      <span aria-hidden="true" />
      {difficulty === "easy"
        ? "Fácil"
        : difficulty === "medium"
          ? "Médio"
          : "Difícil"}
    </span>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={24} className="spin" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  error,
  retry,
}: {
  error?: unknown;
  retry?: () => void;
}) {
  return (
    <div className="empty-state error-state" role="alert">
      <span className="empty-state-icon">
        <AlertCircle size={28} />
      </span>
      <h2>Não conseguimos carregar esta página</h2>
      <p>
        {error instanceof Error
          ? error.message
          : "Confira sua conexão e tente novamente."}
      </p>
      {retry && (
        <button
          type="button"
          className="button button-secondary"
          onClick={retry}
        >
          Tentar novamente <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
  icon = "search",
}: {
  title: string;
  description: string;
  children?: ReactNode;
  icon?: "search" | "code";
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        {icon === "search" ? <Search size={28} /> : <Binary size={28} />}
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-heading-action">{children}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  label,
  className = "",
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={`progress-bar ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.min(max, Math.max(0, value))}
      aria-valuemin={0}
      aria-valuemax={Math.max(1, max)}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);
