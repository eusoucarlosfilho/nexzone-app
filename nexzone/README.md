# NexZone — App de Produção (Next.js + Supabase)

Marketplace de produtos digitais com entrega imediata e split de pagamento.
Este repositório é a **fundação de produção**: front-end + dados + auth + cadastro/aprovação de produtos + checkout e webhook de pagamento prontos para o gateway.

---

## O que já está construído (frente do Claude)
- **Next.js App Router + TypeScript**, identidade visual NexZone.
- **Supabase**: auth, banco (esquema + RLS), trigger de criação de perfil.
- **Home** lendo produtos ativos do banco.
- **Página de produto (PDP)** + botão de compra.
- **Painel do vendedor**: cria loja automática + cadastro de produto (vai para revisão).
- **Admin**: fila de aprovação (aprova/reprova) + GMV e receita 3%.
- **Checkout** (`/api/checkout`): cria pedido pendente e gera cobrança Pix via adaptador.
- **Webhook** (`/api/webhooks/payment`): confirma pagamento, aplica split e libera a entrega.
- **Adaptador de gateway agnóstico** (`src/lib/payments/gateway.ts`): Mercado Pago já esboçado; Iugu/Pagar.me entram trocando a implementação.

---

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev                  # http://localhost:3000
```

Sem credenciais de gateway, o checkout retorna um Pix **simulado** para o fluxo rodar em dev. Com as credenciais, ele passa a gerar cobrança real.

---

## Frente que VOCÊ abre (em paralelo)

### 1. Supabase (necessário para tudo)
1. Crie um projeto em supabase.com.
2. Em **SQL Editor**, rode `supabase/migrations/0001_init.sql` e depois `supabase/seed.sql`.
3. Em **Storage**, crie um bucket **privado** chamado `entregaveis` (para os arquivos dos produtos).
4. Copie `Project URL`, `anon key` e `service_role key` para o `.env.local`.
5. Para virar admin: `update public.profiles set role='admin' where id='SEU_USER_ID';`

### 2. Gateway com split (Mercado Pago recomendado para largar)
1. Conta + **KYC da plataforma** aprovado (tem prazo — comece já).
2. Pegue o **Access Token** → `PAYMENT_ACCESS_TOKEN`.
3. Cada vendedor vira um **recipient/subconta** (gravamos em `stores.recipient_id`).
4. Defina `PAYMENT_PROVIDER=mercadopago` e `PLATFORM_FEE_PERCENT=3`.

### 3. CNPJ / contador
- CNPJ da plataforma + conta PJ para receber o take rate.
- NF da comissão (plataforma) — estrutura fiscal com o contador.

### 4. Domínio + deploy
1. Suba o repo no GitHub.
2. Importe na Vercel, cole as variáveis de ambiente.
3. Aponte o domínio. Defina `NEXT_PUBLIC_SITE_URL` para o domínio final.

---

## Frente que ligamos JUNTOS (quando suas credenciais saírem)
- [ ] Configurar a **notification_url** do gateway → `https://SEU-DOMINIO/api/webhooks/payment` e validar a assinatura (`PAYMENT_WEBHOOK_SECRET`).
- [ ] Onboarding de vendedor → criar recipient no gateway e salvar em `stores.recipient_id`.
- [ ] **Entrega via Storage**: trocar `conteudo_entrega` por upload real + signed URL no momento da entrega.
- [ ] **E-mail (Brevo)**: confirmação de compra e entrega no webhook.
- [ ] **Meta Pixel + CAPI**: disparar o `Purchase` **no webhook (server-side)**, não no clique — corrige a atribuição.

---

## Estrutura
```
supabase/migrations/0001_init.sql   esquema + RLS
src/lib/supabase/                   clients (browser/server/admin)
src/lib/payments/gateway.ts         adaptador de gateway (split)
src/app/page.tsx                    home
src/app/produto/[id]/               PDP + botão de compra
src/app/vender/                     painel do vendedor (cadastro)
src/app/admin/                      fila de aprovação
src/app/api/checkout/               cria pedido + Pix
src/app/api/webhooks/payment/       confirma pagamento + entrega
```
