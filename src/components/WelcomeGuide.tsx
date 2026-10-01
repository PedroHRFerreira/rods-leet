import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  Compass,
  LayoutDashboard,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./welcome.css";

const screens = [
  {
    icon: LayoutDashboard,
    title: "Visão geral",
    text: "Seu ponto de partida: acompanhe o progresso e encontre o próximo desafio.",
  },
  {
    icon: Code2,
    title: "Desafios",
    text: "Busque por assunto, dificuldade ou linguagem e abra o editor para resolver um problema.",
  },
  {
    icon: BookOpen,
    title: "Trilhas",
    text: "Escolha o que aprender: lógica, algoritmos, estruturas de dados ou SQL.",
  },
  {
    icon: Trophy,
    title: "Ranking",
    text: "Compare o XP conquistado com soluções aprovadas. As regras são iguais para todos.",
  },
  {
    icon: UserRound,
    title: "Perfil",
    text: "Acompanhe seu nível e suas conclusões com o progresso neste navegador.",
  },
];

export default function WelcomeGuide({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
    dialog.current?.querySelector(".welcome-body")?.scrollTo(0, 0);
  }, [step]);
  const titles = [
    "Bem-vindo ao Rods Leet",
    "Encontre seu caminho",
    "Da ideia à solução",
    "Aprenda no seu ritmo",
  ];
  return (
    <dialog
      ref={dialog}
      className="welcome-dialog"
      aria-labelledby="welcome-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="welcome-header">
        <span>
          <Compass size={18} />
          GUIA DE BOAS-VINDAS
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar boas-vindas"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="welcome-body">
        <p className="welcome-step">
          Passo {step + 1} de {titles.length}
        </p>
        <h2 id="welcome-title" ref={heading} tabIndex={-1}>
          {titles[step]}
        </h2>
        {step === 0 && (
          <>
            <p className="welcome-lead">
              Um espaço para aprender programação resolvendo problemas, uma
              solução de cada vez.
            </p>
            <div className="welcome-start">
              <Code2 size={28} />
              <div>
                <h3>Seu primeiro passo é simples</h3>
                <p>
                  Comece pela trilha de lógica, em “Seu primeiro número”. O
                  código já está pronto: você só precisa alterar um valor.
                </p>
              </div>
            </div>
            <p className="welcome-note">
              O beta é gratuito e não exige login. Seu progresso fica associado
              a este navegador; apagar os dados do site pode fazer você perder o
              acesso a ele.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <p className="welcome-lead">
              Cada tela tem uma função. Use este mapa para se orientar.
            </p>
            <div className="welcome-screen-grid">
              {screens.map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <Icon size={20} />
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p className="welcome-lead">
              No editor, experimentar e enviar para avaliação são ações
              diferentes.
            </p>
            <ol className="welcome-flow">
              <li>
                <strong>Leia a tarefa e os exemplos</strong>
                <p>
                  Confira o resultado esperado, as restrições e a linguagem
                  selecionada.
                </p>
              </li>
              <li>
                <strong>Escreva e execute</strong>
                <p>
                  Execute quantas vezes quiser para ver o resultado do seu
                  código, incluindo console.log e print. Executar não concede
                  XP.
                </p>
              </li>
              <li>
                <strong>Submeta sua solução</strong>
                <p>
                  “Submeter” pede sua confirmação antes de avaliar o resultado.
                  Todos os testes obrigatórios precisam passar. Se acertar, você
                  ganha XP e avança para o próximo desafio.
                </p>
              </li>
            </ol>
            <p className="welcome-note">
              Fácil, Médio e Difícil indicam a dificuldade do conteúdo. O modo
              de jogo Normal é o inicial; o modo Hard chega numa fase posterior.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <p className="welcome-lead">
              Progresso vem da prática. Experimente antes de confirmar o envio.
            </p>
            <ul className="welcome-rules">
              <li>
                <strong>XP por conquista</strong>
                <span>
                  A primeira aprovação do desafio concede XP uma única vez.
                  Depois de aprovar, você ainda pode executar seu código para
                  estudar.
                </span>
              </li>
              <li>
                <strong>Errou? Corrija e tente novamente</strong>
                <span>
                  Você recebe uma explicação e pode enviar de novo. Cada envio
                  incorreto reduz em 15% do XP inicial a recompensa desse
                  desafio, até zero. Seu XP já conquistado permanece igual.
                </span>
              </li>
              <li>
                <strong>Dicas quando precisar</strong>
                <span>
                  Você começa com uma dica e ganha outra a cada dez desafios
                  distintos concluídos. A recompensa fica em 100% sem dicas, 95%
                  com uma e 85% com duas ou mais.
                </span>
              </li>
              <li>
                <strong>Gabarito para estudar</strong>
                <span>
                  Disponível após aprovação ou três submissões incorretas. Abrir
                  antes de resolver transforma o desafio em prática sem XP.
                </span>
              </li>
            </ul>
            <p className="welcome-note">
              Pode rever este guia a qualquer momento em “Como funciona”, no
              menu.
            </p>
          </>
        )}
      </div>
      <footer className="welcome-footer">
        <button
          type="button"
          className="text-link"
          onClick={step ? () => setStep(step - 1) : onClose}
        >
          {step ? (
            <>
              <ArrowLeft size={16} />
              Voltar
            </>
          ) : (
            "Ver depois"
          )}
        </button>
        <div className="welcome-dots" aria-label={`Passo ${step + 1} de 4`}>
          {titles.map((title, index) => (
            <span key={title} className={index === step ? "active" : ""} />
          ))}
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            if (step < 3) setStep(step + 1);
            else {
              onClose();
              navigate("/desafios?topic=logic&difficulty=easy");
            }
          }}
        >
          {step < 3 ? "Continuar" : "Explorar desafios"}
          <ArrowRight size={16} />
        </button>
      </footer>
    </dialog>
  );
}
