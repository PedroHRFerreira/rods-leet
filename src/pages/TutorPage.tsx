import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Lightbulb,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useGateway } from "../lib/gateway-context";
import { ErrorState, LoadingState, PageHeading } from "../components/ui";
import type { LanguageId, TutorResult } from "../lib/contracts";
import "../editor.css";

interface Message {
  id: string;
  role: "user" | "tutor";
  text: string;
  source?: TutorResult["source"];
}
const starters = [
  "Por onde começar a aprender programação?",
  "Como organizar uma rotina de estudos?",
  "Como posso revisar meus erros?",
];
export default function TutorPage() {
  const gateway = useGateway();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const attemptId = params.get("attempt") ?? undefined;
  const challengeVersionId = params.get("challenge") ?? undefined;
  const languageParam = params.get("language");
  const language = languageParam && /^[a-z]+$/.test(languageParam)
    ? languageParam as LanguageId
    : undefined;
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => gateway.getDashboard(),
    retry: false,
  });
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [code, setCode] = useState<string | undefined>();
  const [loadingConversation, setLoadingConversation] = useState(false);
  const pendingKey = useRef<{ text: string; key: string } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const owner = dashboard.data?.profile.id;
  useEffect(() => {
    setMessages([]);
    setRemaining(null);
    setError("");
    pendingKey.current = null;
    if (!owner || !dashboard.data?.profile.invited) return;
    let active = true;
    setLoadingConversation(true);
    void Promise.all([
      gateway.getTutorConversation(challengeVersionId, language),
      challengeVersionId && language
        ? gateway.getDraft(challengeVersionId, language)
        : Promise.resolve(null),
    ]).then(([conversation, draft]) => {
      if (!active) return;
      setMessages(conversation.messages.map((item, index) => ({
        id: `stored:${index}:${item.role}`,
        role: item.role,
        text: item.text,
      })));
      setCode(draft?.files.map((file) => file.content).join("\n\n"));
    }).catch(() => {
      if (active) setError("Não foi possível recuperar a conversa anterior.");
    }).finally(() => {
      if (active) setLoadingConversation(false);
    });
    return () => { active = false; };
  }, [owner, attemptId, challengeVersionId, language, gateway, dashboard.data?.profile.invited]);
  async function ask(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    const key =
      pendingKey.current?.text === text
        ? pendingKey.current.key
        : crypto.randomUUID();
    pendingKey.current = { text, key };
    try {
      const answer = await gateway.askTutor(
        {
          message: text,
          attemptId,
          challengeVersionId,
          languageId: language,
          conversation: messages.map(({ role, text: previous }) => ({ role, text: previous })),
          code,
        },
        key,
      );
      setMessages((previous) => [
        ...previous,
        { id: `${key}:user`, role: "user", text },
        {
          id: `${key}:tutor`,
          role: "tutor",
          text: answer.message,
          source: answer.source,
        },
      ]);
      setMessage("");
      pendingKey.current = null;
      setRemaining(answer.remainingToday);
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "O tutor não está disponível agora. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function clearConversation() {
    setBusy(true);
    setError("");
    try {
      await gateway.clearTutorConversation(
        challengeVersionId,
        language,
        crypto.randomUUID(),
      );
      setMessages([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível limpar a conversa.");
    } finally {
      setBusy(false);
    }
  }
  if (dashboard.isPending) return <LoadingState />;
  if (dashboard.isError)
    return (
      <ErrorState
        error={dashboard.error}
        retry={() => void dashboard.refetch()}
      />
    );
  return (
    <div className="tutor-page">
      <PageHeading
        eyebrow="TUTOR"
        title="Pense junto. Aprenda melhor."
        description="Organize seus estudos, conecte ideias e encontre o próximo passo."
      >
        <span className="experimental-badge">
          <Sparkles size={14} />
          Tutor experimental
        </span>
      </PageHeading>
      <div className="tutor-layout">
        <section className="panel tutor-chat" aria-label="Conversa com o tutor">
          <div className="tutor-chat-header">
            <span className="tutor-avatar">
              <Sparkles size={21} />
            </span>
            <div>
              <strong>Tutor Rods Leet</strong>
              <span>
                <span className="availability-dot" />
                Orientação para aprender com autonomia
              </span>
            </div>
            <span className="tutor-quota">
              {remaining ?? dashboard.data.tutorMessagesRemaining}/2 hoje
            </span>
          </div>
          {messages.length > 0 && (
            <button type="button" className="text-link tutor-clear" disabled={busy} onClick={() => void clearConversation()}>
              Limpar conversa
            </button>
          )}
          {attemptId && (
            <div className="tutor-context-note">
              <Lightbulb size={17} />
              <span>
                Ajuda neste desafio conta como dica e segue as regras de XP.
                Revisões após a aprovação não reduzem a recompensa já
                conquistada.
              </span>
            </div>
          )}
          <div className="tutor-message-list" aria-live="polite">
            {loadingConversation ? (
              <p className="tutor-thinking" role="status"><Sparkles size={15} />Recuperando sua conversa…</p>
            ) : messages.length === 0 ? (
              <div className="tutor-welcome">
                <div className="tutor-welcome-art" aria-hidden="true">
                  <Sparkles size={38} />
                  <span />
                  <i />
                </div>
                <span className="eyebrow">UM PONTO DE PARTIDA</span>
                <h2>Qual é a sua dúvida?</h2>
                <p>
                  Conte em que ponto você está. O tutor ajuda a construir seu
                  raciocínio, uma pergunta de cada vez.
                </p>
                <div className="tutor-starters">
                  {starters.map((text, index) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => {
                        setMessage(text);
                        textarea.current?.focus();
                      }}
                    >
                      {index === 0 ? (
                        <Compass size={16} />
                      ) : index === 1 ? (
                        <BookOpen size={16} />
                      ) : (
                        <Lightbulb size={16} />
                      )}
                      <span>{text}</span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((item) => (
                <article
                  key={item.id}
                  className={`tutor-message message-${item.role}`}
                >
                  <span
                    className={`message-avatar ${item.role === "tutor" ? "tutor-avatar" : ""}`}
                  >
                    {item.role === "tutor" ? (
                      <Sparkles size={17} />
                    ) : (
                      <UserRound size={17} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {item.role === "tutor" ? "Tutor Rods Leet" : "Você"}
                      {item.source && (
                        <small>
                          {item.source === "ai"
                            ? "IA experimental"
                            : "Orientação editorial"}
                        </small>
                      )}
                    </strong>
                    <p>{item.text}</p>
                  </div>
                </article>
              ))
            )}
            {busy && (
              <p className="tutor-thinking" role="status">
                <Sparkles size={15} />
                Preparando uma orientação…
              </p>
            )}
          </div>
          {error && (
            <div className="arena-alert" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}
          <form className="tutor-compose" onSubmit={(event) => void ask(event)}>
            <label htmlFor="tutor-message" className="sr-only">
              Sua mensagem ao tutor
            </label>
            <textarea
              ref={textarea}
              id="tutor-message"
              placeholder={
                attemptId
                  ? "Qual parte deste desafio está difícil?"
                  : "O que você quer aprender hoje?"
              }
              value={message}
              maxLength={350}
              rows={2}
              onChange={(event) => setMessage(event.target.value)}
              disabled={busy}
            />
            <div>
              <span>{message.length}/350 · até duas interações por dia</span>
              <button
                type="submit"
                className="button button-primary"
                disabled={busy || !message.trim()}
                aria-label="Enviar mensagem ao tutor"
              >
                <Send size={16} />
                <span>Enviar</span>
              </button>
            </div>
          </form>
          <p className="tutor-disclaimer">
            <ShieldCheck size={12} />O tutor pode errar. Testes oficiais
            determinam a aprovação e o XP.
          </p>
        </section>
        <aside className="tutor-aside">
          <section className="panel tutor-guide">
            <div className="aside-icon">
              <Lightbulb size={22} />
            </div>
            <h2>Como pedir ajuda</h2>
            <p>Uma boa conversa começa com um pouco de contexto.</p>
            <ul>
              <li>
                <Check size={15} />
                Conte o que você já tentou.
              </li>
              <li>
                <Check size={15} />
                Explique onde ficou em dúvida.
              </li>
              <li>
                <Check size={15} />
                Peça pistas e exemplos menores.
              </li>
            </ul>
          </section>
          <section className="panel tutor-guide">
            <span className="eyebrow">CONTINUE PRATICANDO</span>
            <h2>Coloque em prática.</h2>
            <p>Leve o próximo conceito para um desafio do seu nível.</p>
            <Link className="text-link" to="/desafios">
              Explorar desafios <ChevronRight size={15} />
            </Link>
          </section>
          <p className="tutor-aside-note">
            A disponibilidade depende da cota global do beta. Quando ela
            termina, orientações editoriais ajudam você a continuar.
          </p>
        </aside>
      </div>
    </div>
  );
}
