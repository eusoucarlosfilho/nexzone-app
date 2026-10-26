import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import Icon from '@/components/Icon';
import LinkRastreado from '@/components/v3/LinkRastreado';
import { stripeAvailable } from '@/lib/payments/stripe';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Perguntas frequentes · Comprei Barato',
  description: 'Dúvidas sobre comprar no Comprei Barato: pagamento, onde acessar o produto, reembolso, suporte e compras no site do vendedor.',
};

// Perguntas frequentes. Só fatos do próprio site; regras de garantia/reembolso remetem ao produto e aos Termos.
export default async function AjudaPage() {
  const cartao = await stripeAvailable().catch(() => false);

  const perguntas: { p: string; r: ReactNode }[] = [
    {
      p: 'Como faço uma compra?',
      r: <>Escolha o produto, toque em <b>Comprar</b>, entre na sua conta e pague no checkout. O passo a passo completo está em <Link href="/como-funciona">Como funciona a compra</Link>.</>,
    },
    {
      p: 'Preciso ter conta para comprar?',
      r: <>Sim. A conta é o que guarda seus pedidos e acessos. Você pode <Link href="/login">entrar ou criar uma conta</Link> na hora da compra.</>,
    },
    {
      p: 'Quais são as formas de pagamento?',
      r: cartao
        ? <>Pix e cartão. No Pix, você paga com o QR Code ou com o código copia e cola.</>
        : <>Pix, com QR Code ou código copia e cola.</>,
    },
    {
      p: 'Quando recebo o produto?',
      r: <>O pedido é liberado automaticamente assim que o pagamento é confirmado. A página do pedido se atualiza sozinha quando a confirmação chega.</>,
    },
    {
      p: 'Onde encontro o que comprei?',
      r: <>Em <Link href="/minhas-compras">Minhas compras</Link>. Abra o pedido para baixar o arquivo, acessar o link, ver a chave ou as instruções de acesso, conforme o produto.</>,
    },
    {
      p: 'Tive um problema com o produto. O que faço?',
      r: <>Na página do pedido, converse com o vendedor. Se não resolver, use <b>Abrir reclamação</b> no próprio pedido ou fale com a <Link href="/suporte">Central de Suporte</Link>.</>,
    },
    {
      p: 'Posso pedir reembolso?',
      r: <>Você pode pedir reembolso dentro do prazo de garantia informado na página de cada produto, conforme os <Link href="/termos">Termos de uso</Link>.</>,
    },
    {
      p: 'O que significa “Compra no site do vendedor”?',
      r: <>São produtos vendidos no site do próprio vendedor. Ao tocar em comprar, esse site abre em uma nova aba e a compra, o pagamento, a entrega e o suporte acontecem lá, conforme as regras daquele site. Essas compras não aparecem em Minhas compras. <Link href="/como-funciona#outros-sites">Saiba mais</Link>.</>,
    },
    {
      p: 'Como acompanho meu chamado no suporte?',
      r: <>Com a conta, em <Link href="/suporte/meus-chamados">Meus chamados</Link>. As respostas também chegam no seu e-mail.</>,
    },
    {
      p: 'Como meus dados são tratados?',
      r: <>Veja a <Link href="/privacidade">Política de Privacidade</Link>.</>,
    },
    {
      p: 'Quero vender meus produtos digitais. Como começo?',
      r: <>Crie sua loja em <LinkRastreado href="/seja-vendedor" evento="vendedor_cta" dados={{ origem: 'outro' }}>Vender no Comprei Barato</LinkRastreado>.</>,
    },
  ];

  return (
    <>
      <Nav />
      <main className="page v3-doc">
        <p className="slabel">Ajuda</p>
        <h1>Perguntas frequentes</h1>
        <p className="v3-doc-lead">Respostas rápidas sobre comprar no Comprei Barato. Não achou o que procurava? Fale com a gente.</p>

        <div className="v3-faq">
          {perguntas.map((q, i) => (
            <details key={i} className="v3-faq-i">
              <summary>{q.p}<Icon name="chevronDown" size={18} /></summary>
              <div className="v3-faq-r">{q.r}</div>
            </details>
          ))}
        </div>

        <div className="v3-doc-sec v3-ajuda-box">
          <h2><Icon name="chat" size={20} />Ainda precisa de ajuda?</h2>
          <p>Abra um chamado na Central de Suporte e responderemos no seu e-mail.</p>
          <div className="v3-doc-cta">
            <Link href="/suporte" className="btn btn-pri">Falar com o suporte</Link>
            <Link href="/como-funciona" className="btn btn-ghost">Como funciona a compra</Link>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>Leia também os <Link href="/termos">Termos de uso</Link> e a <Link href="/privacidade">Política de Privacidade</Link>.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
