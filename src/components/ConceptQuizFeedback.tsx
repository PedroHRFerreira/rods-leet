import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Trophy, XCircle } from "lucide-react";
import type { PublicSubmission } from "../lib/contracts";
import { ResultReaction } from "./ResultReaction";

export interface QuizConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (skipConfirmation: boolean) => void;
  reward: number;
  busy: boolean;
}

export function QuizConfirmation({
  open,
  onClose,
  onConfirm,
  reward,
  busy,
}: QuizConfirmationProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [skipConfirmation, setSkipConfirmation] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    setSkipConfirmation(false);
    const previousFocus = document.activeElement;
    if (!element.open) element.showModal();
    if (cancelButton.current && !cancelButton.current.disabled) {
      cancelButton.current.focus();
    } else {
      element.focus();
    }
    return () => {
      if (element.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="challenge-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (busy || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled)",
          ),
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) {
          event.preventDefault();
          event.currentTarget.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <h2 id={titleId}>Enviar esta resposta?</h2>
      <div id={descriptionId}>
        <p>Se acertar, você conclui esta pergunta e recebe até {reward} XP.</p>
        <p>
          Se errar, pode tentar de novo. Cada erro reduz a recompensa em 15% do
          XP inicial desta pergunta.
        </p>
      </div>
      <label className="challenge-confirmation-preference">
        <input
          type="checkbox"
          checked={skipConfirmation}
          disabled={busy}
          onChange={(event) => setSkipConfirmation(event.target.checked)}
        />
        <span>Não pedir confirmação novamente neste navegador</span>
      </label>
      <div className="challenge-dialog-actions">
        <button
          ref={cancelButton}
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Revisar resposta
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={busy}
          onClick={() => onConfirm(skipConfirmation)}
        >
          {busy ? "Enviando…" : "Confirmar envio"}
        </button>
      </div>
    </dialog>
  );
}

export interface QuizFeedbackProps {
  result: PublicSubmission | null;
  identity: string;
  error: string | null;
  retry: () => void;
}

export function QuizFeedback({
  result,
  identity,
  error,
  retry,
}: QuizFeedbackProps) {
  const technicalFailure =
    result?.verdict === "infrastructure_error" ||
    (result?.status === "completed" &&
      result.verdict !== "accepted" &&
      result.verdict !== "wrong_answer");
  if (error || technicalFailure) {
    return (
      <div className="submission-result quiz-feedback" role="alert">
        <h3>
          <AlertCircle size={21} /> Não foi possível avaliar a resposta
        </h3>
        <p>
          {error || result?.message || "O serviço está indisponível agora."}
        </p>
        <p>
          {error
            ? "Vamos confirmar seu envio antes de liberar outra resposta. Tente novamente para recuperar o resultado."
            : "Seu XP não mudou. Tente novamente em alguns instantes."}
        </p>
        <button
          type="button"
          className="button button-secondary"
          onClick={retry}
        >
          Tentar novamente
        </button>
      </div>
    );
  }
  if (!result) return null;
  if (result.status !== "completed") {
    return (
      <div className="results-empty quiz-feedback" role="status">
        <span className="evaluation-spinner" />
        <strong>Conferindo sua resposta…</strong>
      </div>
    );
  }
  const accepted = result.verdict === "accepted";
  return (
    <div
      className={`submission-result quiz-feedback ${accepted ? "is-accepted" : ""}`}
      role="status"
    >
      <ResultReaction submission={result} identity={identity} kind="submit" />
      <h3>
        {accepted ? <CheckCircle2 size={21} /> : <XCircle size={21} />}
        {accepted ? "Resposta certa!" : "Ainda não foi desta vez"}
      </h3>
      {result.message && <p>{result.message}</p>}
      {accepted ? (
        result.xpAwarded ? (
          <span className="earned-xp">
            <Trophy size={14} /> +{result.xpAwarded} XP
          </span>
        ) : (
          <p>Pergunta concluída. Nenhum XP adicional foi recebido.</p>
        )
      ) : (
        <>
          <p>
            Leia a explicação e escolha outra resposta. Este erro reduziu sua
            recompensa em 15% do XP inicial da pergunta.
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={retry}
          >
            Tentar outra resposta
          </button>
        </>
      )}
    </div>
  );
}
