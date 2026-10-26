import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import Icon from '@/components/Icon';
import { stripeAvailable } from '@/lib/payments/stripe';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Como funciona a compra · Comprei Barato',
  description: 'Como comprar no Comprei Barato: pagamento, liberação do produto em Minhas compras, suporte e compras feitas no site do vendedor.',
};

// Página de confiança: só descreve o que o site faz de fato (checkout com login, Pix e cartão quando
// disponível, liberação automática após a confirmação, Minhas compras, conversa com o vendedor,
// reclamação no pedido, Central de Suporte). Prazos e regras de reembolso: os do produto e dos Termos.
export default async function ComoFuncionaPage() {
  const cartao = await stripeAvailable().catch(() => false);
  const pagamento = cartao ? 'Pix ou cartão' : 'Pix';

  return (
    <>
      <Nav />
      <main className="page v3-doc">
        <p className="slabel">Ajuda</p>
        <h1>Como funciona a compra</h1>
        <p className="v3-doc-lead">O Comprei Barato é um marketplace de produtos digitais: criadores publicam seus produtos e você compra direto pelo site, com acesso pela sua conta.</p>

        <ol className="v3-etapas">
          <li>
            <span className="v3-etapa-n" aria-hidden="true">1</span>
            <div>
              <h2>Encontre o produto</h2>
              <p>Use a busca ou navegue pelas <Link href="/produtos">categorias</Link>. Na página do produto você vê a descrição, a forma de entrega, o prazo de garantia, as avaliações de quem comprou e pode mandar perguntas ao vendedor.</p>
            </div>
          </li>
          <li>
            <span className="v3-etapa-n" aria-hidden="true">2</span>
            <div>
              <h2>Entre na sua conta e pague com {pagamento}</h2>
              <p>Ao tocar em <b>Comprar</b>, você entra na sua conta (ou cria uma) e vai para o checkout. O pagamento é feito por {cartao ? 'Pix ou cartão' : 'Pix, com QR Code ou código copia e cola'}.</p>
            </div>
          </li>
          <li>
            <span className="v3-etapa-n" aria-hidden="true">3</span>
            <div>
              <h2>Receba em Minhas compras</h2>
              <p>Assim que o pagamento é confirmado, o pedido é liberado automaticamente. O arquivo, o link, a chave ou as instruções de acesso ficam na página do pedido, em <Link href="/minhas-compras">Minhas compras</Link>. Enquanto a confirmação não chega, a página do pedido se atualiza sozinha.</p>
            </div>
          </li>
          <li>
            <span className="v3-etapa-n" aria-hidden="true">4</span>
            <div>
              <h2>Fale com o vendedor se precisar</h2>
              <p>Depois do pagamento, a página do pedido tem uma conversa direta com o vendedor para dúvidas sobre o produto. Lá você também pode avaliar a compra.</p>
            </div>
          </li>
        </ol>

        <section className="v3-doc-sec" aria-labelledby="cf-problema">
          <h2 id="cf-problema"><Icon name="alert" size={20} />Teve algum problema?</h2>
          <ul>
            <li>Na página do pedido, converse com o vendedor ou use <b>Abrir reclamação</b>. Enquanto a reclamação estiver aberta, o pagamento fica retido com a plataforma.</li>
            <li>Você pode pedir reembolso dentro do prazo de garantia informado na página do produto, conforme os <Link href="/termos">Termos de uso</Link>.</li>
            <li>Para qualquer outra dúvida, fale com a <Link href="/suporte">Central de Suporte</Link>. Com a conta, você acompanha seus chamados em <Link href="/suporte/meus-chamados">Meus chamados</Link>.</li>
          </ul>
        </section>

        <section className="v3-doc-sec" id="outros-sites" aria-labelledby="cf-ext">
          <h2 id="cf-ext"><Icon name="globe" size={20} />Produtos com compra no site do vendedor</h2>
          <p>Alguns produtos da vitrine são vendidos no site do próprio vendedor e aparecem marcados com <span className="v3-tag-ext"><Icon name="globe" size={13} />Compra no site do vendedor</span>.</p>
          <ul>
            <li>Ao tocar em comprar, o site do vendedor abre em uma nova aba e a compra é finalizada lá.</li>
            <li>Pagamento, entrega, suporte e reembolso dessas compras seguem as regras daquele site.</li>
            <li>Essas compras não geram pedido no Comprei Barato e não aparecem em Minhas compras.</li>
            <li>Preço e disponibilidade podem mudar no site do vendedor.</li>
          </ul>
        </section>

        <div className="v3-doc-cta">
          <Link href="/produtos" className="btn btn-pri">Explorar produtos</Link>
          <Link href="/ajuda" className="btn btn-ghost">Perguntas frequentes</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
