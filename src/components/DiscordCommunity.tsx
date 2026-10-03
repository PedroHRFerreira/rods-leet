import { ArrowUpRight } from "lucide-react";

export function DiscordCommunity() {
  return (
    <section className="panel account-panel discord-community">
      <h2>Comunidade Rods Leet</h2>
      <p>
        Encontre outros estudantes no nosso servidor do Discord. Participar é
        opcional: você pode estudar, acessar sua conta e usar a loja sem entrar
        no servidor.
      </p>
      <a
        className="text-link"
        href="https://discord.gg/6fBryhJTfP"
        target="_blank"
        rel="noopener noreferrer"
      >
        Entrar na comunidade <ArrowUpRight size={15} aria-hidden="true" />
      </a>
    </section>
  );
}
