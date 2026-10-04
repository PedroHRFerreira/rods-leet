import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Check,
  Coins,
  Flame,
  Lightbulb,
  LockKeyhole,
  Palette,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { ShopItem, ShopState } from "../lib/contracts";
import { GatewayError } from "../lib/contracts";
import { useGateway } from "../lib/gateway-context";
import PurchaseCelebration from "../components/PurchaseCelebration";
import {
  CosmeticAvatar,
  cosmeticNameColor,
} from "../components/CosmeticAvatar";
import {
  ErrorState,
  formatNumber,
  LoadingState,
  PageHeading,
  ProgressBar,
} from "../components/ui";

type Operation = {
  item: ShopItem;
  kind: "purchase" | "equip";
  key: string;
  price: number;
};
type Category = "all" | "achievements" | ShopItem["kind"];
const categories: Array<{ id: Category; label: string }> = [
  { id: "all", label: "Tudo" },
  { id: "avatar", label: "Personagens e skins" },
  { id: "frame", label: "Molduras" },
  { id: "title", label: "Títulos" },
  { id: "name_color", label: "Cores do nome" },
  { id: "theme", label: "Temas" },
  { id: "hint", label: "Dicas" },
  { id: "achievements", label: "Conquistas" },
];
const defaultItems: ShopItem[] = [
  {
    id: "avatar-default",
    name: "Avatar padrão",
    kind: "avatar",
    description: "Seu avatar com a inicial do nome.",
    price: 0,
    minLevel: 0,
    value: "",
  },
  {
    id: "name-default",
    name: "Cor padrão do nome",
    kind: "name_color",
    description: "A cor original do seu nome.",
    price: 0,
    minLevel: 0,
    value: "",
  },
  {
    id: "frame-default",
    name: "Sem moldura",
    kind: "frame",
    description: "Seu personagem sem moldura.",
    price: 0,
    minLevel: 0,
    value: "",
  },
  {
    id: "title-default",
    name: "Sem título",
    kind: "title",
    description: "Seu perfil sem título.",
    price: 0,
    minLevel: 0,
    value: "",
  },
  {
    id: "theme-default",
    name: "Tema padrão",
    kind: "theme",
    description: "A aparência original do sistema.",
    price: 0,
    minLevel: 0,
    value: "",
  },
];

function ItemPreview({ item, name }: { item: ShopItem; name: string }) {
  if (item.kind === "avatar")
    return <CosmeticAvatar avatarId={item.id} size={80} />;
  if (item.kind === "name_color")
    return (
      <span
        className="shop-name-preview"
        style={{ color: cosmeticNameColor(item.id) }}
      >
        {name}
      </span>
    );
  if (item.kind === "theme")
    return (
      <div
        className={`shop-theme-preview shop-theme-${item.value}`}
        aria-label={`Prévia do tema ${item.name}`}
      >
        <div className="shop-theme-mini-header">
          <Palette size={18} /> Meu espaço
        </div>
        <div className="shop-theme-mini-body">
          <span />
          <div>
            <strong>Continue aprendendo</strong>
            <span />
            <span />
          </div>
        </div>
        <span className="shop-theme-mini-button">Próximo desafio</span>
      </div>
    );
  if (item.kind === "frame")
    return (
      <span className={`cosmetic-frame cosmetic-frame-${item.value}`}>
        <CosmeticAvatar size={72} />
      </span>
    );
  if (item.kind === "title")
    return (
      <span className="shop-title-preview">
        <Trophy size={24} aria-hidden="true" />
        {item.value}
      </span>
    );
  return (
    <span className="shop-hint-preview">
      <Lightbulb size={42} aria-hidden="true" />
      <strong>{item.hintCount ?? 1}</strong>
    </span>
  );
}

function priceFor(item: ShopItem, shop: ShopState): number {
  const now = Date.now();
  return (
    (shop.offers ?? [shop.offer]).find(
      (offer) =>
        offer.itemId === item.id &&
        now >= Date.parse(offer.startsAt) &&
        now < Date.parse(offer.endsAt),
    )?.price ?? item.price
  );
}

const rarityLabels = {
  common: "Comum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
};
function acquisitionLabel(item: ShopItem): string {
  if (item.acquisition === "ranking") return "Prêmio do ranking semanal";
  if (item.acquisition === "collection") return "Presente da coleção";
  if (item.acquisition === "milestone") return "Presente de conquista";
  return "Item permanente";
}

export default function ShopPage() {
  const gateway = useGateway();
  const client = useQueryClient();
  const [category, setCategory] = useState<Category>("all");
  const [inventory, setInventory] = useState(false);
  const [collection, setCollection] = useState("all");
  const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [notice, setNotice] = useState("");
  const [celebration, setCelebration] = useState<{
    item: ShopItem;
    displayName: string;
  } | null>(null);
  const lastCelebratedKey = useRef<string | null>(null);
  const closeCelebration = useCallback(() => setCelebration(null), []);
  const submitting = useRef(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const operationTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (operation) confirmationHeading.current?.focus();
    else if (!celebration) {
      const trigger = operationTrigger.current;
      if (trigger?.isConnected && !trigger.matches(":disabled"))
        trigger.focus();
      else if (trigger) document.getElementById("main-content")?.focus();
    }
  }, [operation, celebration]);
  useEffect(() => {
    if (previewItem) previewHeading.current?.focus();
  }, [previewItem]);
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => gateway.getDashboard(),
    retry: false,
  });
  const shopQuery = useQuery({
    queryKey: ["shop"],
    queryFn: () => gateway.getShop(),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (request: Operation) =>
      request.kind === "purchase"
        ? gateway.purchaseItem(request.item.id, request.key, request.price)
        : gateway.equipItem(request.item.id, request.key),
    retry: false,
    onSuccess: (shop, request) => {
      client.setQueryData(["shop"], shop);
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      void client.invalidateQueries({ queryKey: ["shop"] });
      void client.invalidateQueries({ queryKey: ["ranking"] });
      setNotice(
        request.kind === "equip"
          ? `${request.item.name} equipado.`
          : request.item.kind === "hint"
            ? `${request.item.hintCount ?? 1} ${request.item.hintCount === 1 || !request.item.hintCount ? "dica adicionada" : "dicas adicionadas"} ao seu saldo.`
            : `${request.item.name} adicionado ao inventário.`,
      );
      if (
        request.kind === "purchase" &&
        lastCelebratedKey.current !== request.key
      ) {
        const confirmedItem = shop.items.find(
          (item) => item.id === request.item.id,
        );
        if (confirmedItem) {
          lastCelebratedKey.current = request.key;
          setCelebration({
            item: confirmedItem,
            displayName: dashboard.data?.profile.displayName ?? "Você",
          });
        }
      }
      setOperation(null);
    },
    onSettled: () => {
      submitting.current = false;
    },
    onError: (error) => {
      if (
        error instanceof GatewayError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        void client.invalidateQueries({ queryKey: ["shop"] });
        void client.invalidateQueries({ queryKey: ["dashboard"] });
      }
    },
  });

  const purchaseCelebration = celebration && (
    <PurchaseCelebration
      item={celebration.item}
      displayName={celebration.displayName}
      onClose={closeCelebration}
    />
  );
  if (dashboard.isPending || shopQuery.isPending)
    return (
      <>
        <LoadingState label="Carregando sua loja…" />
        {purchaseCelebration}
      </>
    );
  if (dashboard.isError || shopQuery.isError)
    return (
      <>
        <ErrorState
          error={dashboard.error || shopQuery.error}
          retry={() => {
            void dashboard.refetch();
            void shopQuery.refetch();
          }}
        />
        {purchaseCelebration}
      </>
    );
  const data = dashboard.data;
  const shop = shopQuery.data;
  const guest =
    gateway.mode === "demo" ||
    !data.profile.authenticated ||
    data.profile.anonymous;
  const items = shop.items.filter(
    (item) =>
      (category === "all" ||
        category === item.kind ||
        (category === "achievements" &&
          item.acquisition &&
          item.acquisition !== "purchase")) &&
      (collection === "all" || collection === item.collectionId) &&
      (!inventory || shop.ownedItemIds.includes(item.id)),
  );
  const equippedIds = Object.values(shop.equipped);
  const activeOffers = (shop.offers ?? [shop.offer]).flatMap((offer) => {
    const item = shop.items.find((entry) => entry.id === offer.itemId);
    return item && priceFor(item, shop) < item.price ? [{ item, offer }] : [];
  });
  const previewAvatarId =
    previewItem?.kind === "avatar" ? previewItem.id : shop.equipped.avatarId;
  const previewNameColorId =
    previewItem?.kind === "name_color"
      ? previewItem.id
      : shop.equipped.nameColorId;
  const previewTheme = shop.items.find(
    (item) =>
      item.id ===
      (previewItem?.kind === "theme" ? previewItem.id : shop.equipped.themeId),
  );
  const previewFrame = shop.items.find(
    (item) =>
      item.id ===
      (previewItem?.kind === "frame" ? previewItem.id : shop.equipped.frameId),
  );
  const previewTitle = shop.items.find(
    (item) =>
      item.id ===
      (previewItem?.kind === "title" ? previewItem.id : shop.equipped.titleId),
  );
  const definiteFailure =
    mutation.error instanceof GatewayError &&
    mutation.error.status >= 400 &&
    mutation.error.status < 500;
  function choose(item: ShopItem, kind: Operation["kind"]) {
    if (operation || celebration || submitting.current || guest) return;
    operationTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    mutation.reset();
    setNotice("");
    setOperation({
      item,
      kind,
      key: crypto.randomUUID(),
      price: priceFor(item, shop),
    });
  }
  function confirm() {
    if (!operation || submitting.current || guest) return;
    submitting.current = true;
    mutation.mutate(operation);
  }
  const shopContent = (
    <div className="shop-page">
      <PageHeading
        eyebrow="CONQUISTE · COLECIONE · PERSONALIZE"
        title="Loja e inventário"
        description="Seu estudo rende moedas. Transforme suas conquistas em algo com a sua cara."
      >
        <div className="shop-wallet">
          <Coins size={24} />
          <strong>{formatNumber(shop.coins)}</strong>
          <span>moedas disponíveis</span>
        </div>
      </PageHeading>
      {guest && (
        <section className="panel shop-login-callout">
          <LockKeyhole size={24} />
          <div>
            <h2>Suas moedas começam com o estudo</h2>
            <p>
              Ganhe moedas-base estudando como visitante e conheça o catálogo.
              Compras, equipagem, metas extras e prêmios semanais exigem conta
              cadastrada.
              {import.meta.env.VITE_EMAIL_REGISTRATION_ENABLED === "false" &&
                import.meta.env.VITE_GOOGLE_LOGIN_ENABLED !== "true" &&
                " O cadastro está desativado; novos visitantes ainda não podem comprar."}
            </p>
          </div>
          <Link className="button button-primary" to="/conta">
            {import.meta.env.VITE_EMAIL_REGISTRATION_ENABLED === "false" &&
            import.meta.env.VITE_GOOGLE_LOGIN_ENABLED !== "true"
              ? "Sobre sua conta"
              : "Entrar ou criar conta"}
          </Link>
        </section>
      )}
      <section className="shop-rewards" aria-label="Como ganhar moedas">
        <div>
          <Coins size={20} />
          <strong>10 moedas</strong>
          <span>por primeira conclusão</span>
        </div>
        <div>
          <Sparkles size={20} />
          <strong>25 moedas</strong>
          <span>por novo nível</span>
        </div>
        <div>
          <Flame size={20} />
          <strong>50 / 200 moedas</strong>
          <span>ao completar 7 / 30 dias de sequência</span>
        </div>
      </section>
      <section
        className="panel shop-personal-preview"
        aria-label="Prévia da personalização"
      >
        <div className="shop-preview-profile">
          <span className="eyebrow">SEU PRÓXIMO VISUAL</span>
          <span
            className={`cosmetic-frame cosmetic-frame-${previewFrame?.value ?? "default"}`}
          >
            <CosmeticAvatar
              avatarId={previewAvatarId}
              displayName={data.profile.displayName}
              size={96}
            />
          </span>
          <h2 style={{ color: cosmeticNameColor(previewNameColorId) }}>
            {data.profile.displayName}
          </h2>
          {previewTitle && (
            <span className="shop-preview-title">{previewTitle.value}</span>
          )}
          <span>
            Nível {data.level} · {formatNumber(data.xp)} XP
          </span>
        </div>
        <div className="shop-preview-detail">
          <h2 ref={previewHeading} tabIndex={-1}>
            {previewItem
              ? `Prévia: ${previewItem.name}`
              : "Experimente antes de escolher"}
          </h2>
          <p>
            {previewItem?.description ??
              "Veja como personagens, molduras, títulos, cores e temas ficam no seu espaço. A prévia não compra nem equipa itens."}
          </p>
          {previewTheme && (
            <ItemPreview item={previewTheme} name={data.profile.displayName} />
          )}
          {previewItem && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPreviewItem(null)}
            >
              Voltar ao visual equipado
            </button>
          )}
        </div>
      </section>
      {!!shop.missions?.length && (
        <section className="shop-missions" aria-label="Metas de estudo">
          {shop.missions.map((mission) => (
            <article className="panel shop-mission" key={mission.id}>
              <span className="eyebrow">
                {mission.id === "daily" ? "META DO DIA" : "META DA SEMANA"}
              </span>
              <h2>{mission.target} primeiras conclusões distintas</h2>
              <strong>+{mission.coins} moedas</strong>
              <ProgressBar
                value={mission.progress}
                max={mission.target}
                label={`Progresso da meta ${mission.id === "daily" ? "diária" : "semanal"}`}
              />
              <p>
                {mission.progress} / {mission.target} concluídos ·{" "}
                {mission.claimed
                  ? "Recompensa recebida"
                  : guest || !mission.eligible
                    ? "Exclusiva para contas cadastradas"
                    : "Entrega automática ao completar"}
              </p>
              <small>
                Até{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Sao_Paulo",
                }).format(new Date(mission.endsAt))}{" "}
                · Brasília
              </small>
            </article>
          ))}
        </section>
      )}
      {!!activeOffers.length && (
        <section className="shop-weekly-offers" aria-label="Ofertas da semana">
          <div className="shop-section-heading">
            <span className="eyebrow">OFERTAS DA SEMANA</span>
            <h2>Novas possibilidades, menos moedas</h2>
            <p>Descontos reais em cosméticos. A compra mantém seu XP.</p>
          </div>
          <div className="shop-offer-grid">
            {activeOffers.map(({ item, offer }) => (
              <article className="panel shop-offer" key={item.id}>
                <ItemPreview item={item} name={data.profile.displayName} />
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    <del>{formatNumber(item.price)}</del>{" "}
                    <strong>{formatNumber(offer.price)} moedas</strong>
                  </p>
                  <small>
                    Até{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "America/Sao_Paulo",
                    }).format(new Date(offer.endsAt))}{" "}
                    · Brasília
                  </small>
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setPreviewItem(item)}
                >
                  Ver prévia de {item.name}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {!!shop.collections?.length && (
        <section className="shop-collections" aria-label="Coleções">
          <div className="shop-section-heading">
            <span className="eyebrow">COLECIONE SEU ESTILO</span>
            <h2>Um conjunto, uma conquista</h2>
          </div>
          <div className="shop-collection-grid">
            {shop.collections.map((entry) => {
              const ownedCount = entry.itemIds.filter((id) =>
                shop.ownedItemIds.includes(id),
              ).length;
              const reward = shop.items.find(
                (item) => item.id === entry.rewardItemId,
              );
              return (
                <article
                  className={`panel shop-collection shop-collection-${entry.id}`}
                  key={entry.id}
                >
                  <h3>{entry.name}</h3>
                  <p>{entry.description}</p>
                  <ProgressBar
                    value={ownedCount}
                    max={entry.itemIds.length}
                    label={`Coleção ${entry.name}`}
                  />
                  <span>
                    {ownedCount} / {entry.itemIds.length} itens
                  </span>
                  <small>
                    {shop.ownedItemIds.includes(entry.rewardItemId)
                      ? "Título recebido"
                      : `Título exclusivo: ${reward?.name ?? entry.name}`}
                  </small>
                  <button
                    type="button"
                    className="text-link"
                    aria-pressed={collection === entry.id}
                    onClick={() => {
                      setCollection(collection === entry.id ? "all" : entry.id);
                      setCategory("all");
                    }}
                  >
                    Ver coleção {entry.name}
                  </button>
                </article>
              );
            })}
          </div>
          {collection !== "all" && (
            <button
              className="text-link"
              type="button"
              onClick={() => setCollection("all")}
            >
              Mostrar todas as coleções
            </button>
          )}
        </section>
      )}
      <div className="shop-view-switch" role="group" aria-label="Visualização">
        <button
          type="button"
          aria-pressed={!inventory}
          onClick={() => setInventory(false)}
        >
          Loja
        </button>
        <button
          type="button"
          aria-pressed={inventory}
          onClick={() => setInventory(true)}
        >
          Meu inventário <span>{shop.ownedItemIds.length}</span>
        </button>
      </div>
      <div className="shop-filters" role="group" aria-label="Categorias">
        {categories.map((entry) => (
          <button
            type="button"
            key={entry.id}
            aria-pressed={category === entry.id}
            onClick={() => setCategory(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {inventory && !guest && (
        <section className="panel shop-defaults">
          <h2>Sua aparência original</h2>
          <p>
            Você pode restaurar cada opção gratuitamente. Seus itens continuam
            no inventário.
          </p>
          <div className="shop-confirm-actions">
            {defaultItems.map((item) => {
              const isDefault =
                item.kind === "avatar"
                  ? !shop.equipped.avatarId
                  : item.kind === "name_color"
                    ? !shop.equipped.nameColorId
                    : item.kind === "frame"
                      ? !shop.equipped.frameId
                      : item.kind === "title"
                        ? !shop.equipped.titleId
                        : !shop.equipped.themeId;
              return (
                <button
                  type="button"
                  className="button button-secondary"
                  key={item.id}
                  disabled={isDefault || !!operation || mutation.isPending}
                  onClick={() => choose(item, "equip")}
                >
                  {isDefault
                    ? `${item.name} em uso`
                    : `Restaurar ${item.name.toLocaleLowerCase("pt-BR")}`}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {notice && (
        <p className="shop-notice" role="status">
          <Check size={18} />
          {notice}
        </p>
      )}
      {operation && (
        <section
          className="panel shop-confirmation"
          aria-labelledby="shop-confirm-title"
        >
          <h2 id="shop-confirm-title" ref={confirmationHeading} tabIndex={-1}>
            {operation.kind === "purchase"
              ? "Confirmar compra"
              : "Equipar item"}
            : {operation.item.name}
          </h2>
          <p>
            {operation.kind === "purchase"
              ? `Você usará ${formatNumber(operation.price)} moedas.`
              : "Este item aparecerá no seu perfil."}{" "}
            {operation.item.kind === "hint"
              ? `Esta compra adiciona ${operation.item.hintCount ?? 1} dica(s) consumível(is). Ao usar uma dica no desafio, a redução de XP continua valendo.`
              : operation.kind === "purchase"
                ? "O item ficará permanentemente no seu inventário."
                : "Você pode trocar novamente no inventário."}
          </p>
          {mutation.isError && (
            <p role="alert">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Não conseguimos confirmar a operação."}{" "}
              {definiteFailure
                ? "A operação foi recusada. Cancele para atualizar sua escolha."
                : "Tente novamente para verificar esta mesma operação sem cobrar duas vezes."}
            </p>
          )}
          <div className="shop-confirm-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={mutation.isPending || definiteFailure}
              onClick={confirm}
            >
              {mutation.isPending
                ? "Confirmando…"
                : mutation.isError
                  ? "Tentar esta operação novamente"
                  : operation.kind === "purchase"
                    ? `Comprar por ${formatNumber(operation.price)} moedas`
                    : "Confirmar e equipar"}
            </button>
            {(!mutation.isError || definiteFailure) && (
              <button
                type="button"
                className="button button-secondary"
                disabled={mutation.isPending}
                onClick={() => {
                  setOperation(null);
                  mutation.reset();
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </section>
      )}
      {items.length === 0 ? (
        <section className="panel shop-empty">
          <h2>
            {inventory
              ? "Seu inventário está esperando a primeira conquista"
              : "Nenhum item nesta categoria"}
          </h2>
          <p>
            {inventory
              ? guest
                ? "Itens adquiridos e presentes aparecem aqui. Comprar e equipar exigem uma conta cadastrada; suas moedas-base continuam disponíveis nesta sessão."
                : "Compre um cosmético ou alcance os marcos de nível e sequência para receber presentes. Dicas compradas aparecem no saldo de dicas do perfil."
              : "Escolha outra categoria para explorar o catálogo."}
          </p>
        </section>
      ) : (
        <div className="shop-grid">
          {items.map((item) => {
            const owned = shop.ownedItemIds.includes(item.id);
            const equipped = equippedIds.includes(item.id);
            const locked = data.level < item.minLevel;
            const price = priceFor(item, shop);
            const insufficient = shop.coins < price;
            const purchasable =
              !item.acquisition || item.acquisition === "purchase";
            return (
              <article
                className={`panel shop-card shop-card-${item.kind}${equipped ? " is-equipped" : ""}`}
                key={item.id}
              >
                <div className="shop-item-preview">
                  <ItemPreview item={item} name={data.profile.displayName} />
                </div>
                <span
                  className={`shop-rarity shop-rarity-${item.rarity ?? "common"}`}
                >
                  {rarityLabels[item.rarity ?? "common"]}
                </span>
                <div className="shop-item-heading">
                  <h2>{item.name}</h2>
                  {equipped ? (
                    <span className="shop-item-badge">
                      <Check size={13} />
                      Equipado
                    </span>
                  ) : owned ? (
                    <span className="shop-item-badge">No inventário</span>
                  ) : null}
                </div>
                <p>{item.description}</p>
                <div className="shop-item-meta">
                  <span>
                    {item.kind === "hint"
                      ? `Consumível · ${item.hintCount ?? 1} ${(item.hintCount ?? 1) === 1 ? "dica" : "dicas"}`
                      : acquisitionLabel(item)}
                  </span>
                  {item.minLevel > 0 && (
                    <span>
                      {locked && <LockKeyhole size={13} />}Nível {item.minLevel}
                    </span>
                  )}
                </div>
                {!owned && purchasable && (
                  <div className="shop-price">
                    <Coins size={18} />
                    <strong>{formatNumber(price)}</strong>
                    {price < item.price && (
                      <del>{formatNumber(item.price)}</del>
                    )}
                  </div>
                )}
                {item.kind === "hint" && (item.hintCount ?? 1) > 1 && (
                  <p className="shop-pack-saving">
                    Economize {(item.hintCount ?? 1) * 30 - price} moedas em
                    relação às dicas avulsas.
                  </p>
                )}
                {item.kind !== "hint" && (
                  <button
                    type="button"
                    className="button button-secondary shop-preview-button"
                    onClick={() => setPreviewItem(item)}
                  >
                    Ver prévia de {item.name}
                  </button>
                )}
                <button
                  type="button"
                  className={`button ${owned ? "button-secondary" : "button-primary"}`}
                  disabled={
                    !!guest ||
                    !!operation ||
                    mutation.isPending ||
                    equipped ||
                    (!owned && (!purchasable || locked || insufficient))
                  }
                  onClick={() => choose(item, owned ? "equip" : "purchase")}
                >
                  {!owned && !purchasable
                    ? acquisitionLabel(item)
                    : guest
                      ? "Disponível com sua conta"
                      : equipped
                        ? "Equipado"
                        : owned
                          ? "Equipar"
                          : locked
                            ? `Desbloqueia no nível ${item.minLevel}`
                            : insufficient
                              ? "Moedas insuficientes"
                              : "Comprar"}
                </button>
              </article>
            );
          })}
        </div>
      )}
      <p className="shop-footnote">
        XP mede sua evolução e permanece acumulado. Cosméticos não alteram o
        ranking. Raridades indicam acabamento e aquisição, sem vantagens nos
        desafios. O nível 5 presenteia uma coruja; 30 dias de sequência
        presenteiam uma chama.
      </p>
    </div>
  );
  return (
    <>
      {shopContent}
      {purchaseCelebration}
    </>
  );
}
