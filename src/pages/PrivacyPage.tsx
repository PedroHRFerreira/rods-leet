export default function PrivacyPage() {
  return (
    <article
      className="page-stack"
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "24px",
        display: "grid",
        gap: 16,
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>
        Privacidade no Rods Leet
      </h1>
      <p>Atualizado em 4 de outubro de 2026.</p>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 12 }}>
        Conta e estudo
      </h2>
      <p>
        Google e Supabase processam o identificador da conta, nome, e-mail e
        imagem do perfil. O Rods Leet utiliza identificador, nome e e-mail para
        autenticar seu acesso e identificar seu perfil. Não recebe sua senha
        Google nem solicita acesso ao Gmail, Drive ou calendário. O login Google
        abre o perfil dessa conta, sem mesclar o progresso de um visitante.
      </p>
      <p>
        Guardamos seu perfil de estudo, rascunhos, código submetido, resultados,
        conclusões, XP, sequência de estudo, moedas, compras, inventário e
        preferências para oferecer desafios, recompensas e personalização. Nome
        e cosméticos equipados podem aparecer no ranking público.
      </p>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 12 }}>
        Navegador e segurança
      </h2>
      <p>
        Usamos cookies de sessão para identificar seu acesso e armazenamento
        local para rascunhos e preferências. Credenciais de sessão são
        protegidas no servidor. Informações técnicas das requisições, incluindo
        endereço IP ou seu resumo criptográfico, podem ser utilizadas pelos
        serviços de infraestrutura para limitar tentativas e investigar falhas
        ou abuso.
      </p>
      <p>
        Visitantes também têm um perfil de estudo. Apagar os dados do navegador
        pode fazer perder o acesso a esse perfil. Os endereços rodsleet.com e
        rods-leet.pages.dev mantêm sessões separadas.
      </p>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 12 }}>
        Serviços utilizados
      </h2>
      <p>
        Google fornece autenticação; Supabase processa contas e armazena dados;
        Cloudflare hospeda o site e conecta a avaliação ao executor isolado. O
        código enviado é processado para avaliar os exercícios. Esses serviços
        também aplicam suas próprias políticas de privacidade.
      </p>
      <p>
        O convite ao Discord é opcional. Entrar no servidor não autentica sua
        conta no Rods Leet. Mensagens e dados fornecidos ao Discord são tratados
        naquele serviço. O Rods Leet não utiliza Brevo para cadastro ou
        recuperação por e-mail nesta versão.
      </p>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 12 }}>
        Feedback público no Discord
      </h2>
      <p>
        Ao confirmar a publicação no formulário de feedback, você autoriza o
        envio do tipo, da mensagem e do nome público do seu perfil ao canal
        geral do servidor Rods Leet no Discord. O link do desafio também será
        compartilhado se você marcar essa opção. Essas informações ficam
        visíveis à comunidade e são tratadas pelo Discord conforme suas próprias
        políticas. Evite incluir informações pessoais, senhas ou outros dados
        sensíveis na mensagem.
      </p>
      <p>
        O formulário não solicita e-mail de contato. Guardamos o feedback, o
        protocolo e o histórico de entrega no sistema para acompanhar falhas e
        evitar reenvios indevidos. O protocolo confirma o registro; a publicação
        no Discord depende da conclusão da entrega. Feedbacks anteriores a essa
        mudança permanecem privados e não serão publicados no servidor.
      </p>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 12 }}>
        Controle dos seus dados
      </h2>
      <p>
        Os dados de estudo são mantidos para permitir a continuidade do perfil.
        Para solicitar acesso, correção ou exclusão dos seus dados, entre em
        contato com o responsável em{" "}
        <a href="mailto:devpedrohr@gmail.com">devpedrohr@gmail.com</a>. Pode ser
        necessário confirmar a titularidade da conta antes de atender a
        solicitação.
      </p>
    </article>
  );
}
