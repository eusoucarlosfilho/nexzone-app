'use client';
import PlanosVendedor from '@/components/PlanosVendedor';
import type { ConfigTaxas } from '@/lib/taxas';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { uuid, origemGuardada } from '@/lib/rastreio-cliente';
import {
  TAXA_BASE, TIPOS, PLATAFORMAS, FATURAMENTO, NICHOS, economiaMensal,
} from '@/lib/recrutamento';
import { iniciarPixel, evento, novoEventId } from './pixel';

const CHAVE = 'cb_recrut';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

type Estado = { token: string; etapa: 1 | 2 | 3; nome: string };
function lerEstado(): Estado | null {
  try { const s = JSON.parse(sessionStorage.getItem(CHAVE) || 'null'); return s && typeof s.token === 'string' ? s : null; } catch { return null; }
}
function gravarEstado(s: Estado) { try { sessionStorage.setItem(CHAVE, JSON.stringify(s)); } catch {} }

function origemAtual() {
  const o: Record<string, string> = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid']) { const v = q.get(k); if (v) o[k] = v; }
    const g: any = origemGuardada();
    if (g) for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) if (!o[k] && g[k]) o[k] = g[k];
    if (g?.ref) o.ref = g.ref;
    o.entrada = window.location.pathname + window.location.search.slice(0, 200);
  } catch {}
  return o;
}

const RECURSOS: [string, string, string][] = [
  ['dollar', 'Anúncio grátis, taxa só quando vende', `A partir de ${TAXA_BASE}% por venda aprovada, abaixo dos grandes marketplaces de jogos. Sem mensalidade.`],
  ['shield', 'Dinheiro protegido, menos golpe', 'O cliente paga no site e o valor fica retido até o fim da garantia. Acabou a discussão de "manda primeiro" no direct.'],
  ['store', 'Vitrine com busca e categorias', 'Seus anúncios aparecem para quem já está procurando conta, item ou gift card, e você ainda tem o link da sua loja para divulgar.'],
  ['key', 'Entrega automática de códigos', 'Gift cards, keys e códigos são liberados sozinhos assim que o pagamento cai. Controle de estoque por anúncio.'],
  ['chat', 'Chat do pedido', 'Você conversa com o comprador dentro do pedido para entregar contas e combinar serviços, com tudo registrado.'],
  ['star', 'Reputação que vende por você', 'Avaliações reais de quem comprou. Quanto melhor sua nota e mais vendas, mais alto seu anúncio aparece.'],
  ['cart', 'Pix e cartão no checkout', 'Pagamento na hora, cupons de desconto e checkout pronto para celular.'],
  ['growth', 'Painel e saque no Pix', 'Vendas por dia, mês ou período, Pix × cartão, e saque direto na sua chave Pix depois da verificação.'],
];

export default function LandingProdutores({ pixel, taxas }: { pixel: string; taxas: ConfigTaxas }) {
  const router = useRouter();
  const [est, setEst] = useState<Estado | null>(null);
  const [f1, setF1] = useState({ nome: '', whatsapp: '', email: '', instagram: '', site: '' });
  const [f2, setF2] = useState<{ nicho: string; tipos: string[]; ja_vende: string; plataformas: string[]; faturamento: string; link_produto: string; mensagem: string }>({ nicho: '', tipos: [], ja_vende: '', plataformas: [], faturamento: '', link_produto: '', mensagem: '' });
  const [erro, setErro] = useState<{ campo?: string; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const iniciou = useRef(false);
  const [mostrarFixo, setMostrarFixo] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // simulador
  const [sim, setSim] = useState({ fat: '10000', taxa: '12', fixo: '0', vendas: '300' });
  const conta = useMemo(() => economiaMensal(Number(sim.fat), Number(sim.taxa.replace(',', '.')), Number(sim.fixo.replace(',', '.')), Number(sim.vendas)), [sim]);

  useEffect(() => {
    iniciarPixel(pixel);
    evento('ViewContent');
    const s = lerEstado();
    if (s && s.etapa === 2) setEst(s);
  }, [pixel]);

  // botão fixo do celular: só aparece depois que o formulário sai da tela
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setMostrarFixo(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const token = () => {
    if (est?.token) return est.token;
    const s: Estado = { token: uuid(), etapa: 1, nome: '' };
    setEst(s); gravarEstado(s);
    return s.token;
  };

  function comecou() {
    if (iniciou.current) return;
    iniciou.current = true;
    evento('IniciouCadastroProdutor', undefined, {}, true);
  }

  async function enviar1(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null); setEnviando(true);
    const eventId = novoEventId('leadp');
    try {
      const r = await fetch('/api/produtores', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa: 1, token: token(), ...f1, origem: origemAtual(), eventId, url: window.location.href }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro({ campo: j.campo, texto: j.error || 'Não foi possível enviar. Tente de novo.' }); return; }
      evento('LeadParcial', eventId, {}, true);
      const s: Estado = { token: j.token || token(), etapa: 2, nome: f1.nome.trim() };
      setEst(s); gravarEstado(s);
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch { setErro({ texto: 'Sem conexão. Tente de novo.' }); }
    finally { setEnviando(false); }
  }

  async function enviar2(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || !est) return;
    setErro(null); setEnviando(true);
    const eventId = novoEventId('lead');
    try {
      const r = await fetch('/api/produtores', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa: 2, token: est.token, ...f2, eventId, url: window.location.href }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro({ campo: j.campo, texto: j.error || 'Não foi possível enviar. Tente de novo.' }); return; }
      evento('Lead', eventId, { nicho: f2.nicho });
      const s: Estado = { ...est, etapa: 3 };
      gravarEstado(s);
      router.push('/produtores/obrigado');
    } catch { setErro({ texto: 'Sem conexão. Tente de novo.' }); }
    finally { setEnviando(false); }
  }

  const alterna = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  const irParaForm = () => { cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => (document.getElementById('rp-nome') as HTMLInputElement | null)?.focus(), 450); };
  const errCampo = (c: string) => (erro?.campo === c ? ' err' : '');
  const etapa2 = est?.etapa === 2;

  return (
    <div className="rp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="rp-top">
        <div className="rp-wrap rp-top-in">
          <a href="/" aria-label="Comprei Barato"><img src="/logo.png" alt="Comprei Barato" width={124} height={62} /></a>
          <a href="/vender" className="rp-ja">Já vendo aqui <Icon name="arrowRight" size={14} /></a>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="rp-hero">
        <div className="rp-glow" aria-hidden="true" />
        <div className="rp-wrap rp-hero-in">
          <div className="rp-hero-txt">
            <span className="rp-eye"><i /> Cadastro de lojistas aberto</span>
            <h1>Venda contas, itens e gift cards com <em>taxa a partir de {TAXA_BASE}%</em>.</h1>
            <p className="rp-lead">O Comprei Barato é o novo marketplace brasileiro de <b>contas, skins, moedas, gift cards, keys e serviços de jogos</b>. Anuncie grátis, receba no Pix e venda com o dinheiro do cliente protegido até a entrega.</p>
            <ul className="rp-checks">
              <li><Icon name="check" size={16} /> Anúncio grátis, sem mensalidade</li>
              <li><Icon name="check" size={16} /> Dinheiro protegido até a entrega: menos golpe</li>
              <li><Icon name="check" size={16} /> Pix e cartão, saque direto no Pix</li>
              <li><Icon name="check" size={16} /> Sem exclusividade: continue onde já vende</li>
            </ul>
            <div className="rp-tiles" aria-hidden="true">
              {[['user', 'Contas'], ['gift', 'Skins e itens'], ['money', 'Moedas'], ['key', 'Gift cards e keys'], ['rocket', 'Boost e coach']].map(([ic, t], i) => (
                <span key={t} style={{ animationDelay: `${i * 0.08}s` }}><Icon name={ic} size={18} /> {t}</span>
              ))}
            </div>
          </div>

          {/* ---------- formulário ---------- */}
          <div className="rp-card" ref={cardRef} id="cadastro">
            <div className="rp-passos" aria-label={`Etapa ${etapa2 ? 2 : 1} de 2`}>
              <span className="on">1</span><i className={etapa2 ? 'on' : ''} /><span className={etapa2 ? 'on' : ''}>2</span>
            </div>
            {!etapa2 ? (
              <form onSubmit={enviar1} noValidate>
                <h2>Quero vender no Comprei Barato</h2>
                <p className="rp-mini">Leva menos de 1 minuto. A gente te chama no WhatsApp para explicar tudo.</p>
                <label className={'rp-f' + errCampo('nome')}><span>Seu nome</span>
                  <input id="rp-nome" autoComplete="name" value={f1.nome} onFocus={comecou} onChange={(e) => setF1({ ...f1, nome: e.target.value })} placeholder="Como você se chama?" maxLength={120} required /></label>
                <label className={'rp-f' + errCampo('whatsapp')}><span>WhatsApp</span>
                  <input type="tel" inputMode="tel" autoComplete="tel-national" value={f1.whatsapp} onFocus={comecou} onChange={(e) => setF1({ ...f1, whatsapp: e.target.value })} placeholder="(00) 90000-0000" maxLength={20} required /></label>
                <label className={'rp-f' + errCampo('instagram')}><span>Instagram <small>(opcional)</small></span>
                  <input autoCapitalize="none" value={f1.instagram} onChange={(e) => setF1({ ...f1, instagram: e.target.value })} placeholder="@seuperfil" maxLength={80} /></label>
                <label className={'rp-f' + errCampo('email')}><span>E-mail <small>(opcional)</small></span>
                  <input type="email" inputMode="email" autoComplete="email" value={f1.email} onChange={(e) => setF1({ ...f1, email: e.target.value })} placeholder="voce@email.com" maxLength={160} /></label>
                <input className="rp-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f1.site} onChange={(e) => setF1({ ...f1, site: e.target.value })} name="site" />
                {erro && <p className="rp-erro" role="alert">{erro.texto}</p>}
                <button className="rp-btn" disabled={enviando}>{enviando ? 'Enviando…' : <>Continuar <Icon name="arrowRight" size={18} /></>}</button>
                <p className="rp-priv"><Icon name="lock" size={13} /> Seus dados ficam só com a equipe do Comprei Barato. <a href="/privacidade" target="_blank">Privacidade</a></p>
              </form>
            ) : (
              <form onSubmit={enviar2} noValidate>
                <h2>Falta pouco, {est?.nome.split(' ')[0] || 'lojista'}!</h2>
                <p className="rp-mini">Conta o que você vende para a gente já chegar com a proposta certa.</p>
                <label className={'rp-f' + errCampo('nicho')}><span>Jogo principal</span>
                  <select value={f2.nicho} onChange={(e) => setF2({ ...f2, nicho: e.target.value })} required>
                    <option value="">Escolha…</option>
                    {NICHOS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select></label>
                <fieldset className={'rp-f' + errCampo('tipos')}><legend>O que você vende (ou quer vender)?</legend>
                  <div className="rp-opts">
                    {TIPOS.map((t) => <button type="button" key={t.id} className={f2.tipos.includes(t.id) ? 'on' : ''} aria-pressed={f2.tipos.includes(t.id)} onClick={() => setF2({ ...f2, tipos: alterna(f2.tipos, t.id) })}>{t.rotulo}</button>)}
                  </div></fieldset>
                <fieldset className={'rp-f' + errCampo('ja_vende')}><legend>Você já vende hoje?</legend>
                  <div className="rp-opts">
                    {[['sim', 'Sim, já vendo'], ['comecando', 'Estou começando'], ['nao', 'Ainda não']].map(([v, l]) => (
                      <button type="button" key={v} className={f2.ja_vende === v ? 'on' : ''} aria-pressed={f2.ja_vende === v} onClick={() => setF2({ ...f2, ja_vende: v, plataformas: v === 'nao' ? [] : f2.plataformas })}>{l}</button>
                    ))}
                  </div></fieldset>
                {f2.ja_vende && f2.ja_vende !== 'nao' && (
                  <>
                    <fieldset className="rp-f"><legend>Onde vende hoje? <small>(pode marcar mais de um)</small></legend>
                      <div className="rp-opts">
                        {PLATAFORMAS.map((p) => <button type="button" key={p} className={f2.plataformas.includes(p) ? 'on' : ''} aria-pressed={f2.plataformas.includes(p)} onClick={() => setF2({ ...f2, plataformas: alterna(f2.plataformas, p) })}>{p}</button>)}
                      </div></fieldset>
                    <label className="rp-f"><span>Quanto fatura por mês com essas vendas?</span>
                      <select value={f2.faturamento} onChange={(e) => setF2({ ...f2, faturamento: e.target.value })}>
                        <option value="">Prefiro não dizer</option>
                        {FATURAMENTO.filter((x) => x !== 'Ainda não vendi').map((x) => <option key={x} value={x}>{x}</option>)}
                      </select></label>
                  </>
                )}
                <label className={'rp-f' + errCampo('link_produto')}><span>Link da sua loja ou perfil de vendas <small>(opcional)</small></span>
                  <input type="url" inputMode="url" value={f2.link_produto} onChange={(e) => setF2({ ...f2, link_produto: e.target.value })} placeholder="https://" maxLength={300} /></label>
                {erro && <p className="rp-erro" role="alert">{erro.texto}</p>}
                <button className="rp-btn" disabled={enviando}>{enviando ? 'Enviando…' : <>Enviar cadastro <Icon name="arrowRight" size={18} /></>}</button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ---------- números da oferta ---------- */}
      <section className="rp-faixa">
        <div className="rp-wrap rp-faixa-in">
          <div><b>R$ 0</b><span>para anunciar</span></div>
          <div><b>{TAXA_BASE}%</b><span>de taxa, a partir de</span></div>
          <div><b>Pix</b><span>e cartão no checkout</span></div>
          <div><b>Auto</b><span>entrega de códigos e keys</span></div>
        </div>
      </section>

      {/* ---------- recursos ---------- */}
      <section className="rp-sec">
        <div className="rp-wrap">
          <p className="rp-kick">Feito para quem vende no mundo gamer</p>
          <h2 className="rp-h2">Venda mais e pare de perder tempo com golpe no direct</h2>
          <div className="rp-grid">
            {RECURSOS.map(([ic, t, d]) => (
              <div className="rp-rec" key={t}><div className="ic"><Icon name={ic} size={22} /></div><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- planos ---------- */}
      <section className="rp-sec" id="planos">
        <div className="rp-wrap">
          <p className="rp-kick">Planos por anúncio</p>
          <h2 className="rp-h2">Você escolhe quanto quer aparecer</h2>
          <p className="rp-sub" style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 26px' }}>Todo anúncio começa no Básico. Quer mais visibilidade? Suba para Destaque ou Topo naquele anúncio. Só paga quando vende.</p>
          <PlanosVendedor cfg={taxas} />
        </div>
      </section>

      {/* ---------- simulador ---------- */}
      <section className="rp-sec rp-sim-sec">
        <div className="rp-wrap rp-sim">
          <div className="rp-sim-txt">
            <p className="rp-kick">Faça a conta</p>
            <h2 className="rp-h2 l">Quanto a taxa do marketplace onde você vende te custa por ano?</h2>
            <p className="rp-sub">Coloque a taxa que você paga hoje. A conta é sua, com os seus números, comparada ao nosso plano Básico.</p>
          </div>
          <div className="rp-sim-box">
            <div className="rp-sim-campos">
              <label><span>Faturamento por mês (R$)</span><input inputMode="decimal" value={sim.fat} onChange={(e) => setSim({ ...sim, fat: e.target.value.replace(/[^\d]/g, '') })} /></label>
              <label><span>Taxa atual (%)</span><input inputMode="decimal" value={sim.taxa} onChange={(e) => setSim({ ...sim, taxa: e.target.value.replace(/[^\d.,]/g, '') })} /></label>
              <label><span>Taxa fixa por venda (R$)</span><input inputMode="decimal" value={sim.fixo} onChange={(e) => setSim({ ...sim, fixo: e.target.value.replace(/[^\d.,]/g, '') })} /></label>
              <label><span>Vendas por mês</span><input inputMode="numeric" value={sim.vendas} onChange={(e) => setSim({ ...sim, vendas: e.target.value.replace(/[^\d]/g, '') })} /></label>
            </div>
            <div className="rp-sim-res">
              <div><small>Hoje você paga por mês</small><b>{brl(conta.atual)}</b></div>
              <div><small>No Comprei Barato ({TAXA_BASE}%)</small><b>{brl(conta.nossa)}</b></div>
              <div className="eco"><small>Fica no seu bolso em 12 meses</small><b>{brl(conta.economia * 12)}</b></div>
            </div>
            <button type="button" className="rp-btn" onClick={irParaForm}>Quero essa economia <Icon name="arrowRight" size={18} /></button>
          </div>
        </div>
      </section>

      {/* ---------- como funciona ---------- */}
      <section className="rp-sec">
        <div className="rp-wrap">
          <p className="rp-kick">Como funciona</p>
          <h2 className="rp-h2">Do cadastro à primeira venda</h2>
          <div className="rp-steps">
            <div><span>1</span><h3>Preencha o formulário</h3><p>Menos de 1 minuto. Sem compromisso.</p></div>
            <div><span>2</span><h3>A gente te chama no WhatsApp</h3><p>Explicamos tudo e ajudamos você a subir seus primeiros anúncios.</p></div>
            <div><span>3</span><h3>Anúncio aprovado, venda liberada</h3><p>Cada anúncio passa por uma revisão rápida antes de entrar na vitrine.</p></div>
            <div><span>4</span><h3>Receba no Pix</h3><p>Depois do prazo de liberação ({taxas.liberaPadraoDias} dias na maioria dos anúncios, {taxas.liberaContaDias} para contas) o valor entra no saldo e você saca na sua chave Pix.</p></div>
          </div>
        </div>
      </section>

      {/* ---------- primeiros lojistas ---------- */}
      <section className="rp-sec">
        <div className="rp-wrap">
          <div className="rp-fund">
            <div>
              <p className="rp-kick claro">Primeiros lojistas</p>
              <h2>Chegue antes da concorrência na vitrine.</h2>
              <p>Estamos abrindo o Comprei Barato com um grupo de lojistas escolhidos a dedo. Quem entra agora aparece primeiro enquanto a vitrine ainda está sendo montada.</p>
            </div>
            <ul>
              <li><Icon name="star" size={18} /> <span><b>Mais visibilidade no lançamento:</b> com poucos anúncios por categoria, o seu aparece para todo mundo que procura</span></li>
              <li><Icon name="chat" size={18} /> <span><b>Atendimento direto</b> com quem constrói a plataforma, pelo WhatsApp</span></li>
              <li><Icon name="rocket" size={18} /> <span><b>Ajuda para subir</b> seus primeiros anúncios, estoque e entrega automática</span></li>
              <li><Icon name="sparkles" size={18} /> <span><b>Sua opinião vira recurso:</b> os pedidos dos primeiros lojistas entram primeiro no que construímos</span></li>
            </ul>
            <button type="button" className="rp-btn claro" onClick={irParaForm}>Quero anunciar <Icon name="arrowRight" size={18} /></button>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="rp-sec">
        <div className="rp-wrap rp-faq">
          <p className="rp-kick">Perguntas frequentes</p>
          <h2 className="rp-h2">Antes de você perguntar</h2>
          {[
            ['Quanto custa?', `Anunciar é grátis. Não tem mensalidade nem taxa de adesão. Você só paga quando vende: ${TAXA_BASE}% no plano Básico, mais nos planos Destaque e Topo, que dão mais visibilidade.`],
            ['O que posso vender?', 'Contas, skins, itens, moedas, gift cards, keys, recargas e serviços como boost e coach, além de produtos digitais como guias e softwares. Só o que você tem direito de vender: nada de cheats, contas roubadas ou assinaturas compartilhadas. Todo anúncio passa por aprovação.'],
            ['Como o comprador fica protegido?', 'O cliente paga no site e o valor fica retido durante o período de garantia. Se algo der errado, ele abre uma reclamação e a equipe analisa. Isso dá confiança para comprar de quem ele ainda não conhece, e você vende mais.'],
            ['Quando eu recebo?', `Depois da entrega: contas de jogo liberam em ${taxas.liberaContaDias} dias, os demais tipos em ${taxas.liberaPadraoDias} dias e vendas no cartão em ${taxas.liberaCartaoDias} dias (proteção contra recuperação de conta e estorno). Aí você saca na sua chave Pix, com 1 saque grátis por semana.`],
            ['O comprador paga taxa?', `Paga uma taxa de serviço do meio de pagamento, mostrada antes de pagar: R$ ${taxas.compradorPix.toFixed(2).replace('.', ',')} no Pix ou ${String(taxas.compradorCartaoPct).replace('.', ',')}% + R$ ${taxas.compradorCartaoFixo.toFixed(2).replace('.', ',')} no cartão. Ela não sai do seu valor.`],
            ['Preciso sair da GGMax ou de onde vendo hoje?', 'Não. Não existe exclusividade. Você pode anunciar aqui e continuar onde já vende.'],
            ['Preciso ter CNPJ?', 'Não. Você pode vender como pessoa física (CPF) ou jurídica (CNPJ). Antes do primeiro saque fazemos uma verificação de identidade rápida, para proteger o seu dinheiro.'],
            ['Gift cards e keys são entregues sozinhos?', 'Sim. Você cadastra os códigos no estoque do anúncio e cada comprador recebe o dele assim que o pagamento é confirmado.'],
          ].map(([q, a]) => (
            <details key={q}><summary>{q}<Icon name="chevronDown" size={18} /></summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <section className="rp-final">
        <div className="rp-wrap">
          <h2>Sua loja gamer merece uma vitrine — e uma taxa justa.</h2>
          <button type="button" className="rp-btn" onClick={irParaForm}>Quero anunciar grátis <Icon name="arrowRight" size={18} /></button>
        </div>
      </section>

      <footer className="rp-rod">
        <div className="rp-wrap">© {new Date().getFullYear()} Comprei Barato · <a href="/termos">Termos</a> · <a href="/privacidade">Privacidade</a></div>
      </footer>

      <div className={`rp-fixo${mostrarFixo ? ' on' : ''}`} aria-hidden={!mostrarFixo}><button type="button" className="rp-btn" onClick={irParaForm}>Anunciar grátis · taxa a partir de {TAXA_BASE}%</button></div>
    </div>
  );
}

const CSS = `
.rp{background:#FFF8F3;color:var(--text);overflow-x:hidden}
.rp-wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.rp-top{position:absolute;top:0;left:0;right:0;z-index:5}
.rp-top-in{display:flex;align-items:center;justify-content:space-between;height:78px}
.rp-top a:first-child{display:block;background:#fff;border-radius:14px;padding:2px 6px;box-shadow:0 6px 20px rgba(0,0,0,.25)}
.rp-top img{height:50px;width:auto;display:block}
.rp-ja{color:#fff;font-weight:800;font-size:14px;display:inline-flex;align-items:center;gap:6px;opacity:.85;text-decoration:none}
.rp-ja:hover{opacity:1}
.rp-hero{position:relative;background:#16162A;color:#fff;padding:110px 0 70px;overflow:hidden}
.rp-glow{position:absolute;inset:auto -10% -40% 30%;height:620px;background:radial-gradient(closest-side,rgba(255,107,0,.55),rgba(255,107,0,0));filter:blur(10px);pointer-events:none}
.rp-glow::after{content:'';position:absolute;left:-60%;top:-90%;width:520px;height:520px;background:radial-gradient(closest-side,rgba(255,154,60,.22),transparent)}
.rp-hero-in{position:relative;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:48px;align-items:start}
.rp-eye{display:inline-flex;align-items:center;gap:8px;background:rgba(255,107,0,.16);border:1px solid rgba(255,140,60,.45);color:#FFB27A;border-radius:50px;padding:7px 14px;font-weight:800;font-size:13px;font-family:'Outfit'}
.rp-eye i{width:8px;height:8px;border-radius:50%;background:#FF7A14;box-shadow:0 0 0 0 rgba(255,122,20,.7);animation:rp-pulse 1.8s infinite}
@keyframes rp-pulse{0%{box-shadow:0 0 0 0 rgba(255,122,20,.7)}70%{box-shadow:0 0 0 10px rgba(255,122,20,0)}100%{box-shadow:0 0 0 0 rgba(255,122,20,0)}}
.rp-hero h1{font-family:'Outfit';font-size:clamp(34px,5.2vw,58px);line-height:1.04;font-weight:900;letter-spacing:-1.6px;margin:18px 0 16px}
.rp-hero h1 em{font-style:normal;background:linear-gradient(135deg,#FF6B00,#FFB067);-webkit-background-clip:text;background-clip:text;color:transparent}
.rp-lead{font-size:18px;line-height:1.6;color:rgba(255,255,255,.82);max-width:560px}
.rp-lead b{color:#fff}
.rp-checks{list-style:none;padding:0;margin:20px 0 0;display:grid;gap:9px}
.rp-checks li{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px}
.rp-checks svg{color:#16162A;background:#FF8A3D;border-radius:50%;padding:3px;width:22px;height:22px;flex:none}
.rp-tiles{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}
.rp-tiles span{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px 14px;font-weight:800;font-size:14px;font-family:'Outfit';animation:cb-up .6s var(--ease) both;backdrop-filter:blur(6px)}
.rp-tiles svg{color:#FF9A3C}
.rp-card{background:#fff;color:var(--text);border-radius:26px;padding:26px;box-shadow:0 30px 80px rgba(0,0,0,.35);scroll-margin-top:16px;animation:cb-up .6s var(--ease) .1s both}
.rp-card h2{font-family:'Outfit';font-size:24px;font-weight:900;letter-spacing:-.6px;margin:0}
.rp-mini{color:var(--sub);font-size:14px;margin:6px 0 16px}
.rp-passos{display:flex;align-items:center;gap:8px;margin-bottom:14px}
.rp-passos span{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:900;font-size:13px;background:#F1ECE7;color:var(--muted)}
.rp-passos span.on{background:#FF6B00;color:#16162A}
.rp-passos i{flex:0 0 46px;height:3px;border-radius:3px;background:#F1ECE7}.rp-passos i.on{background:#FF6B00}
.rp-f{display:block;margin:0 0 12px;border:0;padding:0;min-width:0}
.rp-f>span,.rp-f>legend{display:block;font-weight:800;font-size:13.5px;margin-bottom:6px;padding:0}
.rp-f small{color:var(--muted);font-weight:700}
.rp-f input,.rp-f select{width:100%;height:50px;min-height:50px;border-radius:14px;border:1.5px solid var(--border2);background:#fff;color:var(--text);padding:0 14px;font-size:16px;font-weight:600;font-family:inherit;box-shadow:none;margin:0;appearance:auto}
.rp-f input:focus,.rp-f select:focus{outline:none;border-color:#FF6B00;box-shadow:0 0 0 4px rgba(255,107,0,.13)}
.rp-f.err input,.rp-f.err select{border-color:var(--red)}
.rp-f.err .rp-opts button{border-color:#F3B4B4}
.rp-opts{display:flex;flex-wrap:wrap;gap:7px}
.rp-opts button{border:1.5px solid var(--border2);background:#fff;color:var(--text);border-radius:50px;padding:8px 13px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit;min-height:38px}
.rp-opts button.on{background:#16162A;color:#fff;border-color:#16162A}
.rp-hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0}
.rp-erro{background:var(--red-bg);color:var(--red);font-weight:800;font-size:13.5px;border-radius:12px;padding:10px 12px;margin:4px 0 10px}
.rp-btn{width:100%;min-height:56px;border:0;border-radius:16px;background:linear-gradient(135deg,#FF6B00,#FF9A3C);color:#16162A;font-family:'Outfit';font-weight:900;font-size:17px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;box-shadow:0 14px 30px rgba(255,107,0,.35);transition:transform .15s,box-shadow .15s;padding:0 18px}
.rp-btn:hover{transform:translateY(-2px);box-shadow:0 18px 36px rgba(255,107,0,.42)}
.rp-btn:disabled{opacity:.7;cursor:wait;transform:none}
.rp-btn.claro{background:#fff;box-shadow:none;max-width:320px}
.rp-priv{display:flex;align-items:center;gap:6px;justify-content:center;color:var(--muted);font-size:12.5px;font-weight:700;margin:12px 0 0}
.rp-priv a{color:var(--muted)}
.rp-faixa{background:#fff;border-bottom:1px solid var(--border)}
.rp-faixa-in{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding-top:22px;padding-bottom:22px;text-align:center}
.rp-faixa b{display:block;font-family:'Outfit';font-size:30px;font-weight:900;letter-spacing:-.8px;color:#E85F00}
.rp-faixa span{color:var(--sub);font-weight:700;font-size:13.5px}
.rp-sec{padding:76px 0}
.rp-kick{color:#B84A00;font-weight:900;font-size:13px;letter-spacing:1.4px;text-transform:uppercase;text-align:center;margin:0 0 8px}
.rp-kick.claro{color:#FFB27A;text-align:left}
.rp-h2{font-family:'Outfit';font-size:clamp(26px,3.6vw,38px);font-weight:900;letter-spacing:-1px;text-align:center;margin:0 auto 36px;max-width:760px;line-height:1.12}
.rp-h2.l{text-align:left;margin:0 0 12px}
.rp-sub{color:var(--sub);font-size:16px;line-height:1.6}
.rp-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.rp-rec{background:#fff;border:1px solid var(--border);border-radius:22px;padding:22px;transition:transform .2s var(--ease),box-shadow .2s}
.rp-rec:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(22,22,42,.08)}
.rp-rec .ic{width:48px;height:48px;border-radius:14px;background:var(--soft);color:#B84A00;display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.rp-rec h3{font-family:'Outfit';font-size:17px;font-weight:900;margin:0 0 6px;letter-spacing:-.3px}
.rp-rec p{color:var(--sub);font-size:14px;line-height:1.55;margin:0}
.rp-sim-sec{background:#fff;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.rp-sim{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:40px;align-items:center}
.rp-sim-txt .rp-kick{text-align:left}
.rp-sim-box{background:#FFF8F3;border:1px solid #F6E2D2;border-radius:24px;padding:22px;display:grid;gap:16px}
.rp-sim-campos{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rp-sim-campos label{display:flex;flex-direction:column;gap:5px;font-weight:800;font-size:12.5px;color:var(--sub)}
.rp-sim-campos input{height:48px;min-height:48px;border-radius:13px;border:1.5px solid var(--border2);background:#fff;color:var(--text);padding:0 12px;font-size:17px;font-weight:800;font-family:'Outfit';box-shadow:none;margin:0;width:100%}
.rp-sim-campos input:focus{outline:none;border-color:#FF6B00}
.rp-sim-res{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px}
.rp-sim-res>div{background:#fff;border:1px solid var(--border);border-radius:16px;padding:12px 14px;min-width:0}
.rp-sim-res small{display:block;color:var(--sub);font-weight:800;font-size:12px}
.rp-sim-res b{font-family:'Outfit';font-size:22px;font-weight:900;letter-spacing:-.5px;overflow-wrap:anywhere}
.rp-sim-res .eco{background:#16162A;border-color:#16162A}
.rp-sim-res .eco small{color:rgba(255,255,255,.7)}
.rp-sim-res .eco b{color:#FF9A3C;font-size:26px}
.rp-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;counter-reset:p}
.rp-steps>div{background:#fff;border:1px solid var(--border);border-radius:22px;padding:22px;position:relative}
.rp-steps span{width:40px;height:40px;border-radius:12px;background:#16162A;color:#FF9A3C;font-family:'Outfit';font-weight:900;font-size:18px;display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.rp-steps h3{font-family:'Outfit';font-size:17px;font-weight:900;margin:0 0 6px}
.rp-steps p{color:var(--sub);font-size:14px;line-height:1.55;margin:0}
.rp-fund{background:#16162A;color:#fff;border-radius:30px;padding:44px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px 44px;position:relative;overflow:hidden}
.rp-fund::before{content:'';position:absolute;right:-120px;top:-120px;width:380px;height:380px;background:radial-gradient(closest-side,rgba(255,107,0,.45),transparent)}
.rp-fund>*{position:relative}
.rp-fund h2{font-family:'Outfit';font-size:clamp(26px,3.4vw,36px);font-weight:900;letter-spacing:-1px;line-height:1.1;margin:0 0 12px}
.rp-fund p{color:rgba(255,255,255,.78);line-height:1.6;margin:0}
.rp-fund ul{list-style:none;padding:0;margin:0;display:grid;gap:14px}
.rp-fund li{display:flex;gap:12px;align-items:flex-start;font-size:15px;line-height:1.5;color:rgba(255,255,255,.85)}
.rp-fund li b{color:#fff}
.rp-fund li svg{color:#FF9A3C;flex:none;margin-top:2px}
.rp-faq{max-width:780px}
.rp-faq details{background:#fff;border:1px solid var(--border);border-radius:16px;padding:0 18px;margin-bottom:10px}
.rp-faq summary{display:flex;justify-content:space-between;align-items:center;gap:12px;font-family:'Outfit';font-weight:800;font-size:16px;cursor:pointer;list-style:none;padding:17px 0}
.rp-faq summary::-webkit-details-marker{display:none}
.rp-faq summary svg{flex:none;transition:transform .2s;color:var(--muted)}
.rp-faq details[open] summary svg{transform:rotate(180deg)}
.rp-faq details p{color:var(--sub);line-height:1.6;margin:0 0 17px;font-size:15px}
.rp-final{background:linear-gradient(135deg,#FF6B00,#FF9A3C);padding:64px 0;text-align:center}
.rp-final h2{font-family:'Outfit';font-size:clamp(26px,3.6vw,40px);font-weight:900;letter-spacing:-1px;margin:0 auto 22px;max-width:720px;color:#16162A;line-height:1.1}
.rp-final .rp-btn{background:#16162A;color:#fff;max-width:380px;box-shadow:0 14px 30px rgba(22,22,42,.3)}
.rp-rod{background:#16162A;color:rgba(255,255,255,.6);font-size:13px;padding:22px 0 90px;text-align:center}
.rp-rod a{color:rgba(255,255,255,.8)}
.rp-fixo{display:none}
@media(max-width:980px){
  .rp-hero{padding:96px 0 48px}
  .rp-hero-in{grid-template-columns:minmax(0,1fr);gap:28px}
  .rp-tiles{display:none}
  .rp-grid,.rp-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rp-sim,.rp-fund{grid-template-columns:minmax(0,1fr)}
  .rp-fund{padding:30px 24px}
}
@media(max-width:620px){
  .rp-top-in{height:66px}
  .rp-top img{height:40px}
  .rp-hero{padding:80px 0 36px}
  .rp-lead{font-size:16px}
  .rp-card{padding:20px;border-radius:22px}
  .rp-faixa-in{grid-template-columns:repeat(2,1fr);row-gap:16px}
  .rp-faixa b{font-size:25px}
  .rp-sec{padding:52px 0}
  .rp-grid,.rp-steps{grid-template-columns:minmax(0,1fr)}
  .rp-sim-campos{grid-template-columns:1fr 1fr}
  .rp-sim-res{grid-template-columns:1fr 1fr}
  .rp-sim-res .eco{grid-column:1/-1}
  .rp-fixo{display:block;transform:translateY(110%);transition:transform .25s var(--ease);position:fixed;left:0;right:0;bottom:0;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:rgba(255,248,243,.94);backdrop-filter:blur(10px);border-top:1px solid var(--border);z-index:50}
  .rp-fixo.on{transform:none}
  .rp-fixo .rp-btn{min-height:50px;font-size:16px}
  .rp-rec{display:grid;grid-template-columns:44px 1fr;gap:4px 14px;padding:16px}
  .rp-rec .ic{grid-row:1/3;width:44px;height:44px;margin:0}
  .rp-rec h3{font-size:16px;margin:0}
  .rp-steps>div{display:grid;grid-template-columns:40px 1fr;gap:2px 14px;padding:16px}
  .rp-steps span{grid-row:1/3;margin:0}
}
`;
