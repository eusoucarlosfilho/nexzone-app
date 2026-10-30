import Nav from '@/components/Nav';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { lerTaxas } from '@/lib/settings';
import PlanosVendedor from '@/components/PlanosVendedor';
import { TAXAS_PADRAO } from '@/lib/taxas';
import { lerCfgCampanhas, vagasFundador } from '@/lib/campanhas-servidor';
import { createAdminClient } from '@/lib/supabase/server';
import FaixaFundador, { type DadosFundador } from '@/components/FaixaFundador';

export const metadata = {
  title: 'Venda no Comprei Barato — contas, itens, gift cards e produtos digitais',
  description: 'Anuncie grátis contas, skins, moedas, gift cards, keys, serviços de jogos e produtos digitais. Dinheiro do cliente protegido até a entrega, Pix e cartão, saque no Pix.',
  alternates: { canonical: '/seja-vendedor' },
};
export const dynamic = 'force-dynamic';

const beneficios = (taxa: string) => [
  ['dollar', 'Anúncio grátis', `Taxa a partir de ${taxa}% só quando vende. Sem mensalidade, sem taxa escondida.`],
  ['shield', 'Dinheiro protegido', 'O cliente paga no site e o valor fica retido até o fim da garantia. Menos golpe, mais confiança para comprar de você.'],
  ['bolt', 'Entrega automática', 'Gift cards, keys e códigos são liberados sozinhos quando o pagamento cai, com controle de estoque.'],
  ['chat', 'Chat do pedido', 'Combine a entrega de contas e serviços com o comprador dentro do pedido, com tudo registrado.'],
  ['star', 'Reputação real', 'Avaliações só de quem comprou. Dentro de cada plano, quem tem melhor reputação e mais vendas aparece primeiro.'],
  ['lock', 'Pix e cartão', 'Pagamento aprovado na hora e saque direto na sua chave Pix.'],
];

const PASSOS = [
  ['1', 'Crie sua conta e sua loja', 'Cadastro grátis em segundos. Personalize com logo e banner.'],
  ['2', 'Anuncie', 'Conta, item, moeda, gift card, serviço ou produto digital. Defina preço, estoque e forma de entrega.'],
  ['3', 'Venda com segurança', 'O comprador paga no site; você entrega pelo chat do pedido ou automaticamente.'],
  ['4', 'Receba via Pix', 'Depois do prazo de liberação o valor entra no seu saldo. 1 saque grátis por semana na sua chave Pix, a partir de R$ 50.'],
];

const faq = (taxa: string) => [
  ['Quanto custa para vender?', `Criar a loja e anunciar é grátis. No plano Básico você paga ${taxa}% por venda concluída. Os planos Destaque e Topo cobram um pouco mais em troca de mais visibilidade. Sem mensalidade.`],
  ['O comprador paga alguma taxa?', 'Sim, uma taxa de serviço pequena do meio de pagamento (Pix ou cartão), mostrada no checkout antes de pagar. Ela não é descontada do seu valor.'],
  ['O que posso vender?', 'Contas, skins, itens, moedas, gift cards, keys, recargas, serviços (boost, coach) e produtos digitais como ebooks, cursos e planilhas. Só o que você tem direito de vender: nada de cheats, contas roubadas ou assinaturas compartilhadas.'],
  ['Quando e como eu recebo?', 'Depois da entrega, o valor fica retido pelo prazo de liberação (contas de jogo seguram mais, por causa do risco de recuperação; cartão segura mais por causa de estorno). Depois entra no seu saldo e você saca para sua chave Pix.'],
  ['Posso trocar de plano depois?', 'Pode, a qualquer momento, no painel Meus anúncios. Trocar de plano não manda o anúncio para revisão.'],
  ['Como o produto é entregue?', 'Você escolhe: código ou chave (liberado automaticamente), arquivo, link de acesso ou entrega pelo chat do pedido (contas e serviços).'],
  ['Preciso de CNPJ para começar?', 'Não. Dá para vender como pessoa física. Antes do primeiro saque fazemos uma verificação de identidade rápida.'],
  ['Tem mensalidade ou fidelidade?', 'Não. Zero mensalidade e zero fidelidade. Você só paga a taxa do plano quando a venda é concluída.'],
];


export default async function SejaVendedorPage() {
  const cfg = await lerTaxas().catch(() => TAXAS_PADRAO);
  // Lojista Fundador (SQL 28): vagas reais
  let fundador: DadosFundador | null = null;
  try {
    const camp = await lerCfgCampanhas();
    if (camp.fundadorAtivo) {
      const v = await vagasFundador(createAdminClient(), camp);
      if (v.sql28) fundador = { restantes: v.restantes, total: v.total, dias: camp.fundadorDias, teto: camp.fundadorTeto, destaqueDias: camp.fundadorDestaqueDias, pct: camp.fundadorPct };
    }
  } catch { /* sem SQL 28 */ }
  const taxa = String(cfg.planoBasico).replace('.', ',');
  const BENEFICIOS = beneficios(taxa);
  const FAQ = faq(taxa);
  return (
    <>
      <Nav />
      <style dangerouslySetInnerHTML={{ __html: `
        .sv-hero{background:var(--text);color:#fff;padding:64px 22px 72px;text-align:center}
        .sv-hero .eye{display:inline-block;background:#FF6B00;color:#16162A;animation:cb-pop .5s both;border-radius:50px;padding:6px 16px;font-size:13px;font-weight:800;font-family:'Outfit';margin-bottom:18px}
        .sv-hero h1{animation:cb-up .6s var(--ease) .08s both;font-family:'Outfit';font-size:42px;font-weight:900;letter-spacing:-1.2px;line-height:1.08;max-width:740px;margin:0 auto 16px}
        .sv-hero p{font-size:18px;opacity:.95;max-width:560px;margin:0 auto 28px}
        .sv-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
        .sv-sec{max-width:1080px;margin:0 auto;padding:58px 22px}
        .sv-h2{font-family:'Outfit';font-size:30px;font-weight:900;text-align:center;letter-spacing:-.8px;margin-bottom:8px}
        .sv-sub{text-align:center;color:var(--sub);margin-bottom:38px}
        .sv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
        .sv-card{background:#fff;border:1px solid var(--border);border-radius:20px;padding:24px;box-shadow:var(--sh);transition:transform .22s var(--ease),box-shadow .22s}.sv-card:hover{transform:translateY(-4px);box-shadow:var(--sh-md)}
        .sv-card .ic{width:52px;height:52px;border-radius:14px;background:var(--soft);color:var(--orange-ink);display:flex;align-items:center;justify-content:center;margin-bottom:12px}
        .sv-card h3{font-family:'Outfit';font-weight:800;font-size:17px;margin-bottom:6px}
        .sv-card p{color:var(--sub);font-size:14px;line-height:1.6}
        .sv-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}
        .sv-step .n{width:42px;height:42px;border-radius:12px;background:var(--soft);color:var(--orange-ink);font-family:'Outfit';font-weight:900;font-size:20px;display:flex;align-items:center;justify-content:center;margin-bottom:14px}
        .sv-step h3{font-family:'Outfit';font-weight:800;font-size:16px;margin-bottom:6px}
        .sv-step p{color:var(--sub);font-size:14px;line-height:1.6}
        .sv-faq{max-width:760px;margin:0 auto}
        .sv-faq details{background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:12px}
        .sv-faq summary{font-family:'Outfit';font-weight:800;font-size:15px;cursor:pointer;list-style:none}
        .sv-faq summary::-webkit-details-marker{display:none}
        .sv-faq p{color:var(--sub);font-size:14px;line-height:1.7;margin-top:10px}
        .sv-band{background:var(--text);color:#fff;border-radius:28px;padding:48px;text-align:center;max-width:1080px;margin:0 auto 60px}
        .sv-band h2{font-family:'Outfit';font-size:30px;font-weight:900;letter-spacing:-.8px;margin-bottom:8px}
        @media(max-width:640px){.sv-hero h1{animation:cb-up .6s var(--ease) .08s both;font-size:32px}}
      ` }} />

      <section className="sv-hero">
        <div className="eye">Para lojistas gamer e criadores</div>
        <h1>Venda contas, itens, gift cards e produtos digitais no Comprei Barato.</h1>
        <p>Anuncie grátis, venda com o dinheiro do cliente protegido até a entrega e receba via Pix. Taxa a partir de <strong style={{ whiteSpace: 'nowrap' }}>{taxa}% por venda</strong>, sem mensalidade.</p>
        <div className="sv-cta">
          <Link href="/login" className="btn btn-pri btn-lg">Criar minha loja grátis</Link>
          <Link href="/produtos" className="btn btn-lg" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,.3)' }}>Ver o marketplace</Link>
        </div>
      </section>

      <FaixaFundador d={fundador} cta="/login" />

      <section className="sv-sec">
        <h2 className="sv-h2">Por que vender no Comprei Barato</h2>
        <p className="sv-sub">Condições simples e transparentes para quem vende no mundo gamer e digital.</p>
        <div className="sv-grid">
          {BENEFICIOS.map(([ic, t, d]) => (
            <div className="sv-card" key={t}><div className="ic"><Icon name={ic} size={28} /></div><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="sv-sec" style={{ paddingTop: 0 }} id="planos">
        <h2 className="sv-h2">Planos por anúncio</h2>
        <p className="sv-sub">Você escolhe o plano em cada anúncio. Mais visibilidade, taxa um pouco maior. Só paga quando vende.</p>
        <PlanosVendedor cfg={cfg} />
      </section>

      <section className="sv-sec" style={{ paddingTop: 0 }}>
        <h2 className="sv-h2">Como funciona</h2>
        <p className="sv-sub">Do cadastro à primeira venda em poucos passos.</p>
        <div className="sv-steps">
          {PASSOS.map(([n, t, d]) => (
            <div className="sv-step" key={n}><div className="n">{n}</div><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="sv-sec" style={{ paddingTop: 0 }}>
        <h2 className="sv-h2">Perguntas frequentes</h2>
        <p className="sv-sub">As dúvidas mais comuns de quem vai começar.</p>
        <div className="sv-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <div className="sv-band">
        <h2>Pronto para vender?</h2>
        <p style={{ opacity: .93, marginBottom: 22 }}>Crie sua loja grátis agora e publique seus anúncios hoje mesmo.</p>
        <Link href="/login" className="btn btn-pri btn-lg">Começar a vender agora</Link>
      </div>
    </>
  );
}
