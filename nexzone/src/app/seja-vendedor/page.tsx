import Nav from '@/components/Nav';
import Link from 'next/link';

export const metadata = {
  title: 'Venda no NexZone — Crie sua loja grátis',
  description: 'Venda seus produtos digitais no NexZone. Só 3% por venda, sem mensalidade, entrega automática e recebimento via Pix.',
};

const BENEFICIOS = [
  ['💸', 'Comissão justa', 'Só 3% por venda. Sem mensalidade, sem taxa escondida.'],
  ['⚡', 'Entrega imediata', 'O comprador recebe na hora em que o Pix é confirmado.'],
  ['🏪', 'Loja com a sua cara', 'Logo, banner, cor e uma página de loja com link próprio.'],
  ['⭐', 'Destaque pago', 'Apareça no carrossel da home e venda mais quando quiser.'],
  ['🔒', 'Pagamento via Pix', 'Aprovação na hora e taxa baixa — o dinheiro entra rápido.'],
  ['⭐', 'Prova social real', 'Avaliações de verdade dos seus compradores, sem inventar.'],
];

const PASSOS = [
  ['1', 'Crie sua conta e sua loja', 'Cadastro grátis em segundos. Personalize com logo e banner.'],
  ['2', 'Cadastre seu produto', 'Arquivo, link, chave ou acesso. Defina preço e garantia.'],
  ['3', 'Divulgue seu link', 'Compartilhe no WhatsApp, Instagram e anúncios com um clique.'],
  ['4', 'Receba via Pix', 'Acompanhe as vendas no painel e saque para sua chave Pix.'],
];

const FAQ = [
  ['Quanto custa para vender?', 'É grátis criar sua loja e cadastrar produtos. Você só paga 3% quando realmente vende. Sem mensalidade.'],
  ['Quando e como eu recebo?', 'Após a confirmação do Pix, o valor entra no seu saldo (respeitando um período de garantia) e você solicita o saque para sua chave Pix.'],
  ['Que produtos posso vender?', 'Ebooks, planilhas, templates, prompts, cursos, presets, automações — qualquer produto digital de entrega imediata, desde que você tenha os direitos sobre ele.'],
  ['Como o produto é entregue?', 'Você escolhe: upload de arquivo (liberado após o pagamento), link de acesso, chave/código ou instruções.'],
  ['Preciso de CNPJ para começar?', 'Você consegue começar a vender rapidamente. Conforme seu volume crescer, recomendamos formalizar com CNPJ para escalar com segurança.'],
  ['Tem mensalidade ou fidelidade?', 'Não. Zero mensalidade e zero fidelidade. Você só é cobrado nos 3% por venda concluída.'],
];

export default function SejaVendedorPage() {
  return (
    <>
      <Nav />
      <style>{`
        .sv-hero{background:var(--grad);color:#fff;padding:64px 22px 72px;text-align:center}
        .sv-hero .eye{display:inline-block;background:rgba(255,255,255,.2);border-radius:50px;padding:6px 16px;font-size:13px;font-weight:800;font-family:'Outfit';margin-bottom:18px}
        .sv-hero h1{font-family:'Outfit';font-size:42px;font-weight:900;letter-spacing:-1.2px;line-height:1.08;max-width:740px;margin:0 auto 16px}
        .sv-hero p{font-size:18px;opacity:.95;max-width:560px;margin:0 auto 28px}
        .sv-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
        .sv-sec{max-width:1080px;margin:0 auto;padding:58px 22px}
        .sv-h2{font-family:'Outfit';font-size:30px;font-weight:900;text-align:center;letter-spacing:-.8px;margin-bottom:8px}
        .sv-sub{text-align:center;color:var(--sub);margin-bottom:38px}
        .sv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
        .sv-card{background:#fff;border:1px solid var(--border);border-radius:18px;padding:24px;box-shadow:var(--sh)}
        .sv-card .ic{font-size:30px;margin-bottom:12px}
        .sv-card h3{font-family:'Outfit';font-weight:800;font-size:17px;margin-bottom:6px}
        .sv-card p{color:var(--sub);font-size:14px;line-height:1.6}
        .sv-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}
        .sv-step .n{width:42px;height:42px;border-radius:12px;background:var(--soft);color:var(--orange);font-family:'Outfit';font-weight:900;font-size:20px;display:flex;align-items:center;justify-content:center;margin-bottom:14px}
        .sv-step h3{font-family:'Outfit';font-weight:800;font-size:16px;margin-bottom:6px}
        .sv-step p{color:var(--sub);font-size:14px;line-height:1.6}
        .sv-faq{max-width:760px;margin:0 auto}
        .sv-faq details{background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:12px}
        .sv-faq summary{font-family:'Outfit';font-weight:800;font-size:15px;cursor:pointer;list-style:none}
        .sv-faq summary::-webkit-details-marker{display:none}
        .sv-faq p{color:var(--sub);font-size:14px;line-height:1.7;margin-top:10px}
        .sv-band{background:var(--grad);color:#fff;border-radius:24px;padding:48px;text-align:center;max-width:1080px;margin:0 auto 60px}
        .sv-band h2{font-family:'Outfit';font-size:30px;font-weight:900;letter-spacing:-.8px;margin-bottom:8px}
        @media(max-width:640px){.sv-hero h1{font-size:32px}}
      `}</style>

      <section className="sv-hero">
        <div className="eye">Para criadores e infoprodutores</div>
        <h1>Venda seus produtos digitais e fique com <span style={{ whiteSpace: 'nowrap' }}>97% de cada venda</span>.</h1>
        <p>Crie sua loja grátis, entregue automaticamente na hora do pagamento e receba via Pix. Sem mensalidade. Só 3% por venda.</p>
        <div className="sv-cta">
          <Link href="/login" className="btn btn-lg" style={{ background: '#fff', color: 'var(--orange)', fontWeight: 800 }}>Criar minha loja grátis</Link>
          <Link href="/produtos" className="btn btn-lg" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>Ver o marketplace</Link>
        </div>
      </section>

      <section className="sv-sec">
        <h2 className="sv-h2">Por que vender no NexZone</h2>
        <p className="sv-sub">O melhor acordo pra quem cria produto digital no Brasil.</p>
        <div className="sv-grid">
          {BENEFICIOS.map(([ic, t, d]) => (
            <div className="sv-card" key={t}><div className="ic">{ic}</div><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
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
        <p style={{ opacity: .93, marginBottom: 22 }}>Crie sua loja grátis agora e comece a vender hoje mesmo.</p>
        <Link href="/login" className="btn btn-lg" style={{ background: '#fff', color: 'var(--orange)', fontWeight: 800 }}>Começar a vender agora</Link>
      </div>
    </>
  );
}
