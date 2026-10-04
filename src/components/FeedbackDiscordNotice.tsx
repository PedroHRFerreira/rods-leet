const COMMUNITY_INVITE = "https://discord.gg/6fBryhJTfP";

interface FeedbackDiscordNoticeProps {
  queued?: boolean;
  displayName?: string;
}

export function FeedbackDiscordNotice({
  queued = false,
  displayName,
}: FeedbackDiscordNoticeProps) {
  return (
    <div className="feedback-discord-notice">
      {queued ? (
        <>
          <p>
            Sua mensagem foi registrada e entrou na fila de publicação no canal
            geral do Discord Rods Leet.
          </p>
          <p>
            O envio pode levar cerca de um minuto. O protocolo confirma o
            recebimento; confira o canal geral para acompanhar a publicação.
          </p>
        </>
      ) : (
        <>
          <h2>Seu feedback será público no Discord</h2>
          <p id="feedback-public-help">
            O tipo de feedback, sua mensagem e seu nome público
            {displayName ? <> ({displayName})</> : null} serão publicados no
            canal geral do servidor Rods Leet, visíveis à comunidade. Se você
            incluir um desafio, o link dele também será publicado.
          </p>
          <p>Evite senhas, contatos pessoais e outros dados sensíveis.</p>
        </>
      )}
      <a
        className="text-link"
        href={COMMUNITY_INVITE}
        target="_blank"
        rel="noopener noreferrer"
      >
        Abrir a comunidade no Discord
      </a>
    </div>
  );
}
