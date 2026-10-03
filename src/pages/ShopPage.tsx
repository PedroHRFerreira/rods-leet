import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import type { ShopItem, ShopState } from "../lib/contracts";
import { GatewayError } from "../lib/contracts";
import { useGateway } from "../lib/gateway-context";
import {
  CosmeticAvatar,
  cosmeticNameColor,
} from "../components/CosmeticAvatar";
import {
  ErrorState,
  formatNumber,
  LoadingState,
  PageHeading,
} from "../components/ui";

type Operation = {
  item: ShopItem;
  kind: "purchase" | "equip";
  key: string;
  price: number;
};
type Category = "all" | ShopItem["kind"];
const categories: Array<{ id: Category; label: string }> = [
  { id: "all", label: "Tudo" },
  { id: "avatar", label: "Avatares" },
  { id: "name_color", label: "Cores do nome" },
  { id: "theme", label: "Temas" },
  { id: "hint", label: "Dicas" },
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
        className={`shop-theme-preview shop-theme-${item.id === "theme-ocean" ? "ocean" : "sunset"}`}
        aria-label={`Prévia do tema ${item.name}`}
      >
        <Palette size={30} />
        <span />
        <span />
        <span />
      </div>
    );
  return <Lightbulb size={50} aria-hidden="true" />;
}

function priceFor(item: ShopItem, shop: ShopState): number {
  const now = Date.now();
  return shop.offer.itemId === item.id &&
    now >= Date.parse(shop.offer.startsAt) &&
    now < Date.parse(shop.offer.endsAt)
    ? shop.offer.price
    : item.price;
}

export default function ShopPage() {
  const gateway = useGateway();
  const client = useQueryClient();
  const [category, setCategory] = useState<Category>("all");
  const [inventory, setInventory] = useState(false);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [notice, setNotice] = useState("");
  const submitting = useRef(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (operation) confirmationHeading.current?.focus();
  }, [operation]);
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
            ? "Dica extra comprada. Ela já está no seu saldo de dicas."
            : `${request.item.name} adicionado ao inventário.`,
      );
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

  if (dashboard.isPending || shopQuery.isPending)
    return <LoadingState label="Carregando sua loja…" />;
  if (dashboard.isError || shopQuery.isError)
    return (
      <ErrorState
        error={dashboard.error || shopQuery.error}
        retry={() => {
          void dashboard.refetch();
          void shopQuery.refetch();
        }}
      />
    );
  const data = dashboard.data;
  const shop = shopQuery.data;
  const guest =
    gateway.mode === "demo" ||
    !data.profile.authenticated ||
    data.profile.anonymous;
  const items = shop.items.filter(
    (item) =>
      (category === "all" || category === item.kind) &&
      (!inventory || shop.ownedItemIds.includes(item.id)),
  );
  const equippedIds = Object.values(shop.equipped);
  const offerItem = shop.items.find((item) => item.id === shop.offer.itemId);
  const offerActive = offerItem && priceFor(offerItem, shop) < offerItem.price;
  const definiteFailure =
    mutation.error instanceof GatewayError &&
    mutation.error.status >= 400 &&
    mutation.error.status < 500;
  function choose(item: ShopItem, kind: Operation["kind"]) {
    if (operation || submitting.current || guest) return;
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
  return (
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
              Ganhe moedas estudando como visitante. Uma conta permite comprar e
              guardar seus itens.
              {import.meta.env.VITE_EMAIL_REGISTRATION_ENABLED === "false" &&
                " Cadastro e compras para novos usuários estarão disponíveis em breve."}
            </p>
          </div>
          <Link className="button button-primary" to="/conta">
            {import.meta.env.VITE_EMAIL_REGISTRATION_ENABLED === "false"
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
      {offerActive && (
        <section className="panel shop-offer">
          <Sparkles size={24} />
          <div>
            <span className="eyebrow">OFERTA DA SEMANA</span>
            <h2>{offerItem.name}</h2>
            <p>
              <del>{formatNumber(offerItem.price)}</del>{" "}
              <strong>{formatNumber(shop.offer.price)} moedas</strong> · Até{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(shop.offer.endsAt))}{" "}
              (horário local)
            </p>
          </div>
          <ItemPreview item={offerItem} name={data.profile.displayName} />
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
              ? "Esta compra adiciona uma dica consumível. Ao usar a dica no desafio, a redução de XP continua valendo."
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
              ? "Compre um cosmético ou alcance os marcos de nível e sequência para receber presentes. Dicas compradas aparecem no saldo de dicas do perfil."
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
            return (
              <article
                className={`panel shop-card shop-card-${item.kind}${equipped ? " is-equipped" : ""}`}
                key={item.id}
              >
                <div className="shop-item-preview">
                  <ItemPreview item={item} name={data.profile.displayName} />
                </div>
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
                      ? "Consumível · 1 dica"
                      : "Item permanente"}
                  </span>
                  {item.minLevel > 0 && (
                    <span>
                      {locked && <LockKeyhole size={13} />}Nível {item.minLevel}
                    </span>
                  )}
                </div>
                {!owned && (
                  <div className="shop-price">
                    <Coins size={18} />
                    <strong>{formatNumber(price)}</strong>
                    {price < item.price && (
                      <del>{formatNumber(item.price)}</del>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className={`button ${owned ? "button-secondary" : "button-primary"}`}
                  disabled={
                    !!guest ||
                    !!operation ||
                    mutation.isPending ||
                    equipped ||
                    (!owned && (locked || insufficient))
                  }
                  onClick={() => choose(item, owned ? "equip" : "purchase")}
                >
                  {guest
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
        ranking. O nível 5 presenteia uma coruja; 30 dias de sequência
        presenteiam uma chama.
      </p>
    </div>
  );
}
