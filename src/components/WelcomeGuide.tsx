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
  ShoppingBag,
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
    text: "Comece com perguntas sobre os conceitos. Depois, abra os desafios de código para praticar.",
  },
  {
    icon: BookOpen,
    title: "Trilhas",
    text: "Escolha o que aprender: lógica, algoritmos, estruturas de dados ou SQL.",
  },
  {
    icon: Trophy,
    title: "Ranking",
    text: "Compare o XP conquistado nos desafios. As regras são iguais para todos.",
  },
  {
    icon: UserRound,
    title: "Perfil",
    text: "Acompanhe seu nível e suas conclusões. Crie uma conta para preservar suas conquistas.",
  },
  {
    icon: ShoppingBag,
    title: "Loja",
    text: "Troque moedas de estudo por dicas, avatares, cores de nome e temas. Equipe seus itens no inventário.",
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
    "Das perguntas ao código",
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
              Aprenda programação passo a passo, começando pelos conceitos.
            </p>
            <div className="welcome-start">
              <Code2 size={28} />
              <div>
                <h3>Seu primeiro passo é simples</h3>
                <p>
                  Comece por “O que é um valor?”. Leia uma explicação curta e
                  escolha uma resposta. Você não precisa escrever código ainda.
                </p>
              </div>
            </div>
            <p className="welcome-note">
              Explore gratuitamente sem login. Crie sua conta para preservar o
              progresso e acessar suas moedas e itens em outros dispositivos.
              Sem conta, apagar os dados deste navegador pode fazer você perder
              o acesso ao progresso.
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
              Primeiro, entenda os conceitos. Depois, pratique no editor.
            </p>
            <ol className="welcome-flow">
              <li>
                <strong>Responda às primeiras perguntas</strong>
                <p>
                  Aprenda sobre valores, variáveis, tipos e funções. Escolha uma
                  resposta e confirme o envio. Se errar, leia a explicação e
                  tente novamente.
                </p>
              </li>
              <li>
                <strong>Comece a praticar no código</strong>
                <p>
                  Depois das perguntas, use o modelo pronto para fazer pequenas
                  alterações. Execute quantas vezes quiser para ver o resultado.
                  Executar não concede XP.
                </p>
              </li>
              <li>
                <strong>Submeta sua solução</strong>
                <p>
                  “Submeter” pede sua confirmação antes de avaliar o resultado.
                  A aplicação verifica sua resposta. Se acertar, você ganha XP e
                  segue para o próximo desafio.
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
              Leia com calma e tente novamente quando precisar.
            </p>
            <ul className="welcome-rules">
              <li>
                <strong>XP por conquista</strong>
                <span>
                  A primeira aprovação do desafio concede XP uma única vez.
                  Depois de concluir, você pode rever as perguntas e continuar
                  praticando no editor.
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
                  Nos desafios de código, você começa com uma dica e ganha outra
                  a cada dez desafios distintos concluídos. A recompensa fica em
                  100% sem dicas, 95% com uma e 85% com duas ou mais.
                </span>
              </li>
              <li>
                <strong>Moedas por estudo e constância</strong>
                <span>
                  A primeira conclusão rende 10 moedas e cada nível rende 25.
                  Sequências de 7 e 30 dias concedem 50 e 200 moedas. Alguns
                  marcos também dão avatares; outros liberam itens na loja.
                  Comprar não consome XP nem altera sua posição no ranking.
                </span>
              </li>
              <li>
                <strong>Gabarito para estudar</strong>
                <span>
                  Nos desafios de código, disponível após aprovação ou três
                  submissões incorretas. Abrir antes de resolver transforma o
                  desafio em prática sem XP.
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
              navigate("/desafios/concept-values");
            }
          }}
        >
          {step < 3 ? "Continuar" : "Começar pelas perguntas"}
          <ArrowRight size={16} />
        </button>
      </footer>
    </dialog>
  );
}
