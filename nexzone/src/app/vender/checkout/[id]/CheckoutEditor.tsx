'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { salvarCheckoutConfig } from './actions';
import { toast } from '@/lib/toast';
import CoverUpload from '../../produtos/CoverUpload';
import Icon from '@/components/Icon';
import CheckoutBlocos from '@/components/CheckoutBlocos';
import BumpOferta from '@/components/BumpOferta';
import {
  type CheckoutConfig, type Bloco, type TipoBloco, type Depoimento,
  ROTULO_BLOCO, UNICOS, LIMITES, blocoPadrao, configPadrao,
} from '@/lib/checkoutConfig';
import { MSG_MAX } from '@/lib/textoFormatado';

type Outro = { id: string; titulo: string; status: string; preco: number; capa_url: string | null; descricao: string };
type Produto = { titulo: string; status: string; preco: number; capa_url: string | null; tipo_entrega: string; garantia_dias: number };

const money = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
const ADICIONAVEIS: TipoBloco[] = ['texto', 'imagem', 'depoimentos', 'contador', 'titulo', 'recebe', 'garantia', 'selos'];
const ICONE: Record<TipoBloco, string> = {
  imagem: 'image', titulo: 'edit', texto: 'file', contador: 'hourglass', pagamento: 'cart', recebe: 'package', garantia: 'shield', selos: 'lock', depoimentos: 'star',
};

// Datas do contador: o input datetime-local trabalha no horário local, sem fuso
function paraLocal(iso: string) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Campo de texto com barra de formatação (negrito, itálico, lista, link)
function CampoFormatado({ valor, onValor, max, placeholder }: { valor: string; onValor: (v: string) => void; max: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function envolver(a: string, d = a, ex = 'texto') {
    const el = ref.current; if (!el) return;
    const i = el.selectionStart, f = el.selectionEnd; const sel = valor.slice(i, f) || ex;
    const novo = valor.slice(0, i) + a + sel + d + valor.slice(f);
    if (novo.length > max) return;
    onValor(novo);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(i + a.length, i + a.length + sel.length); });
  }
  function lista() {
    const el = ref.current; if (!el) return;
    const ini = valor.lastIndexOf('\n', el.selectionStart - 1) + 1;
    let fim = valor.indexOf('\n', el.selectionEnd); if (fim < 0) fim = valor.length;
    onValor(valor.slice(0, ini) + valor.slice(ini, fim).split('\n').map((l) => `- ${l.replace(/^\s*[-•]\s+/, '')}`).join('\n') + valor.slice(fim));
  }
  function link() {
    const u = window.prompt('Cole o link (https://…):', 'https://');
    if (!u || !/^https?:\/\/\S+$/.test(u.trim())) return;
    envolver('[', `](${u.trim()})`, 'clique aqui');
  }
  const b = (r: string, t: string, fn: () => void, st?: React.CSSProperties) =>
    <button type="button" className="ce-fb" title={t} aria-label={t} onMouseDown={(e) => e.preventDefault()} onClick={fn} style={st}>{r}</button>;
  return (
    <div className="ce-fmt">
      <div className="ce-fbar">{b('B', 'Negrito', () => envolver('**'), { fontWeight: 900 })}{b('I', 'Itálico', () => envolver('_'), { fontStyle: 'italic' })}{b('S', 'Riscado', () => envolver('~~'), { textDecoration: 'line-through' })}{b('• Lista', 'Lista', lista)}{b('🔗 Link', 'Link', link)}<span className="ce-cont">{valor.length}/{max}</span></div>
      <textarea ref={ref} rows={5} value={valor} maxLength={max} placeholder={placeholder} onChange={(e) => onValor(e.target.value)} />
    </div>
  );
}

export default function CheckoutEditor({ productId, userId, produto, loja, inicial, personalizado, outrosProdutos, bumpInicial, aceitaCupomInicial }: {
  productId: string; userId: string; produto: Produto; loja: { nome: string; cor: string | null };
  inicial: CheckoutConfig; personalizado: boolean; outrosProdutos: Outro[];
  bumpInicial: { bump_product_id: string | null; bump_valor: number | null }; aceitaCupomInicial: boolean;
}) {
  const router = useRouter();
  const [cfg, setCfg] = useState<CheckoutConfig>(inicial);
  const [bumpId, setBumpId] = useState(bumpInicial?.bump_product_id || '');
  const [bumpValor, setBumpValor] = useState(bumpInicial?.bump_valor ? String(bumpInicial.bump_valor) : '');
  const [aceitaCupom, setAceitaCupom] = useState(!!aceitaCupomInicial);
  const [aberto, setAberto] = useState<string | null>(null);
  const [menuAdd, setMenuAdd] = useState(false);
  const [disp, setDisp] = useState<'celular' | 'computador'>('celular');
  const [busy, setBusy] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [bumpPrevia, setBumpPrevia] = useState(false);

  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => { if (sujo) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [sujo]);

  const mudar = (fn: (c: CheckoutConfig) => CheckoutConfig) => { setCfg((c) => fn(c)); setSujo(true); };
  const setBloco = (id: string, patch: Partial<Bloco>) => mudar((c) => ({ ...c, blocos: c.blocos.map((b) => (b.id === id ? ({ ...b, ...patch } as Bloco) : b)) }));
  const mover = (de: number, para: number) => mudar((c) => {
    if (para < 0 || para >= c.blocos.length || de === para) return c;
    const l = [...c.blocos]; const [x] = l.splice(de, 1); l.splice(para, 0, x); return { ...c, blocos: l };
  });
  const remover = (id: string) => { mudar((c) => ({ ...c, blocos: c.blocos.filter((b) => b.id !== id) })); if (aberto === id) setAberto(null); };
  const contar = (t: TipoBloco) => cfg.blocos.filter((b) => b.tipo === t).length;
  const podeAdicionar = (t: TipoBloco) => (UNICOS.includes(t) ? contar(t) === 0 : t === 'texto' ? contar(t) < LIMITES.textos : t === 'imagem' ? contar(t) < LIMITES.imagens : true) && cfg.blocos.length < LIMITES.blocos;
  function adicionar(t: TipoBloco) {
    const b = blocoPadrao(t);
    // imagem nova entra no topo; o resto entra logo acima do pagamento
    mudar((c) => {
      const l = [...c.blocos];
      if (t === 'imagem') l.unshift(b);
      else { const ip = l.findIndex((x) => x.tipo === 'pagamento'); l.splice(ip < 0 ? l.length : ip, 0, b); }
      return { ...c, blocos: l };
    });
    setAberto(b.id); setMenuAdd(false);
  }

  const cor = cfg.cor || loja.cor || '#FF6B00';
  const bumpProd = outrosProdutos.find((o) => o.id === bumpId) || null;
  const bumpNum = Number(String(bumpValor).replace(',', '.'));
  const bumpPreview = bumpProd && bumpNum > 0 ? {
    titulo: bumpProd.titulo, valor: bumpNum, precoDe: bumpProd.preco, chamada: cfg.bump.chamada || null,
    texto: cfg.bump.texto || null, imagem: cfg.bump.imagem || bumpProd.capa_url, descricao: bumpProd.descricao,
  } : null;

  async function salvar(padrao = false) {
    if (bumpId && !(bumpNum >= 1)) { toast('Informe o preço do order bump (a partir de R$ 1,00).', 'error'); return; }
    setBusy(true);
    try {
      const r: any = await salvarCheckoutConfig(
        productId,
        padrao ? null : cfg,
        padrao ? { bump_product_id: null, bump_valor: null } : { bump_product_id: bumpId || null, bump_valor: bumpId ? bumpNum : null },
        padrao ? false : aceitaCupom,
      );
      if (r?.ok) {
        setSujo(false);
        if (padrao) { setCfg(configPadrao()); setBumpId(''); setBumpValor(''); setAceitaCupom(false); }
        toast(padrao ? 'Checkout voltou ao padrão.' : 'Checkout salvo! Já está valendo para os compradores.', 'success');
        router.refresh();
      } else toast(r?.error || 'Erro ao salvar', 'error');
    } catch { toast('Falha de conexão. Tente de novo.', 'error'); }
    finally { setBusy(false); }
  }

  const resumo = (b: Bloco): string => {
    switch (b.tipo) {
      case 'imagem': return b.url ? 'Imagem escolhida' : 'Sem imagem ainda';
      case 'titulo': return b.titulo || 'Finalizar compra';
      case 'texto': return b.texto.trim() ? b.texto.replace(/[*_~#\[\]()]/g, '').slice(0, 60) : 'Vazio';
      case 'contador': return b.ate ? `Até ${new Date(b.ate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Sem data';
      case 'depoimentos': return `${b.itens.length} depoimento${b.itens.length === 1 ? '' : 's'}`;
      case 'pagamento': return 'Fixo: produto, order bump, cupom e formas de pagamento';
      case 'recebe': return 'Automático, a partir do produto';
      case 'garantia': return `Garantia de ${produto.garantia_dias} dias`;
      case 'selos': return 'Pagamento seguro · Dados protegidos · Entrega automática';
    }
  };

  function editorDo(b: Bloco) {
    switch (b.tipo) {
      case 'imagem':
        return (
          <div className="fg"><label>Imagem</label>
            <CoverUpload key={b.id} userId={userId} value={b.url} onUploaded={(url) => setBloco(b.id, { url } as any)} hint="Larga: 1200×400 px (topo) ou 1200×675 px. JPG ou PNG." />
            {b.url && <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setBloco(b.id, { url: '' } as any)}>Remover imagem</button>}
          </div>
        );
      case 'titulo':
        return (
          <>
            <div className="fg"><label>Título</label><input value={b.titulo} maxLength={LIMITES.titulo} onChange={(e) => setBloco(b.id, { titulo: e.target.value } as any)} placeholder="Finalizar compra" /></div>
            <div className="fg"><label>Subtítulo (opcional)</label><textarea rows={2} value={b.subtitulo} maxLength={LIMITES.subtitulo} onChange={(e) => setBloco(b.id, { subtitulo: e.target.value } as any)} placeholder="Ex.: Acesso imediato depois do pagamento." /></div>
            <div className="fg"><label>Selo acima do título (opcional)</label><input value={b.selo} maxLength={LIMITES.selo} onChange={(e) => setBloco(b.id, { selo: e.target.value } as any)} placeholder="Ex.: Oferta de lançamento" /></div>
          </>
        );
      case 'texto':
        return <div className="fg"><label>Texto</label><CampoFormatado valor={b.texto} max={MSG_MAX} onValor={(v) => setBloco(b.id, { texto: v } as any)} placeholder={'Ex.:\n**Você vai receber:**\n- 50 modelos prontos\n- Bônus: guia em PDF'} /></div>;
      case 'contador':
        return (
          <div className="fg"><label>Termina em (data e hora)</label>
            <input type="datetime-local" value={paraLocal(b.ate)} onChange={(e) => setBloco(b.id, { ate: e.target.value ? new Date(e.target.value).toISOString() : '' } as any)} />
            <small className="muted" style={{ fontSize: 12 }}>O contador é real: quando chega na data, mostra &quot;Esta oferta foi encerrada&quot; (não reinicia).</small>
          </div>
        );
      case 'depoimentos': {
        const itens = b.itens;
        const setItens = (l: Depoimento[]) => setBloco(b.id, { itens: l } as any);
        const setItem = (i: number, p: Partial<Depoimento>) => setItens(itens.map((d, k) => (k === i ? { ...d, ...p } : d)));
        return (
          <>
            <div className="fg"><label>Título da seção</label><input value={b.titulo} maxLength={80} onChange={(e) => setBloco(b.id, { titulo: e.target.value } as any)} placeholder="Quem já comprou" /></div>
            {itens.map((d, i) => (
              <div key={i} className="ce-dep">
                <div className="ce-dep-h"><strong>Depoimento {i + 1}</strong>
                  <span style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="ce-ic" title="Subir" disabled={i === 0} onClick={() => { const l = [...itens]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setItens(l); }}>▲</button>
                    <button type="button" className="ce-ic" title="Descer" disabled={i === itens.length - 1} onClick={() => { const l = [...itens]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; setItens(l); }}>▼</button>
                    <button type="button" className="ce-ic ce-del" title="Remover" onClick={() => setItens(itens.filter((_, k) => k !== i))}><Icon name="trash" size={14} /></button>
                  </span>
                </div>
                <div className="fg2">
                  <div className="fg"><label>Nome</label><input value={d.nome} maxLength={LIMITES.nome} onChange={(e) => setItem(i, { nome: e.target.value })} placeholder="Ex.: Mariana S." /></div>
                  <div className="fg"><label>Estrelas</label>
                    <select value={d.nota} onChange={(e) => setItem(i, { nota: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}</select></div>
                </div>
                <div className="fg"><label>Depoimento</label><textarea rows={3} value={d.texto} maxLength={LIMITES.depoimento} onChange={(e) => setItem(i, { texto: e.target.value })} placeholder="O que o cliente disse" /></div>
                <div className="fg"><label>Foto (opcional)</label>
                  <CoverUpload key={`${b.id}-${i}-${d.foto || ''}`} userId={userId} value={d.foto || ''} onUploaded={(url) => setItem(i, { foto: url })} hint="Quadrada, 200×200 px" />
                  {d.foto && <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setItem(i, { foto: null })}>Remover foto</button>}
                </div>
              </div>
            ))}
            {itens.length < LIMITES.depoimentos && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItens([...itens, { nome: '', foto: null, nota: 5, texto: '' }])}><Icon name="plus" size={14} /> Adicionar depoimento</button>
            )}
            <label className="ce-conf">
              <input type="checkbox" checked={cfg.depoimentosConfirmados} onChange={(e) => mudar((c) => ({ ...c, depoimentosConfirmados: e.target.checked }))} />
              <span>Confirmo que estes depoimentos são de clientes reais e que tenho autorização para publicá-los.</span>
            </label>
          </>
        );
      }
      case 'pagamento':
        return <p className="muted" style={{ fontSize: 13 }}>O formulário de pagamento é fixo e sempre aparece. Você escolhe <b>onde</b> ele fica (arraste) e configura o order bump e o cupom mais abaixo.</p>;
      default:
        return <p className="muted" style={{ fontSize: 13 }}>Este bloco é montado automaticamente com os dados do produto. Você só escolhe se ele aparece e em que posição.</p>;
    }
  }

  const pagamentoPrevia = useMemo(() => (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 20, padding: 18, margin: '0 0 16px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        {produto.capa_url ? <img src={produto.capa_url} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover' }} /> : <span style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--soft)' }} />}
        <span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontFamily: 'Outfit', display: 'block' }}>{produto.titulo}</strong><span className="muted" style={{ fontSize: 13 }}>{loja.nome}</span></span>
        <strong style={{ fontFamily: 'Outfit' }}>{money(produto.preco)}</strong>
      </div>
      {bumpPreview && <BumpOferta bump={bumpPreview} marcado={bumpPrevia} onToggle={setBumpPrevia} cor={cor} />}
      {aceitaCupom && <div className="muted" style={{ fontSize: 13, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>Tem um cupom? [ CUPOM ] Aplicar</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontFamily: 'Outfit', fontWeight: 900, fontSize: 18 }}>
        <span>Total</span><span>{money(produto.preco + (bumpPrevia && bumpPreview ? bumpPreview.valor : 0))}</span>
      </div>
      <div style={{ border: `2px solid ${cor}`, borderRadius: 12, padding: '10px 12px', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>◉ Pix — aprovação na hora</div>
      <div style={{ background: cor, color: '#fff', borderRadius: 12, padding: '13px', textAlign: 'center', fontFamily: 'Outfit', fontWeight: 900 }}>Pagar com Pix</div>
      <div className="muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 8 }}>Prévia — o formulário real aparece no checkout</div>
    </div>
  ), [produto, loja.nome, bumpPreview, bumpPrevia, aceitaCupom, cor]);

  return (
    <div className="ce">
      <style dangerouslySetInnerHTML={{ __html: `
        .ce{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,460px);gap:22px;align-items:start;padding-bottom:90px;}
        .ce-sec{background:#fff;border:1px solid var(--border);border-radius:20px;padding:18px;margin-bottom:16px;}
        .ce-sec>h3{font-family:'Outfit';font-size:17px;font-weight:800;margin:0 0 4px;display:flex;align-items:center;gap:8px;}
        .ce-sec>p{margin:0 0 12px;}
        .ce-list{display:grid;gap:8px;grid-template-columns:minmax(0,1fr);}
        .ce-item{min-width:0;border:1.5px solid var(--border2);border-radius:14px;background:#fff;transition:border-color .15s,box-shadow .15s;}
        .ce-item.on{border-color:var(--orange);box-shadow:0 6px 18px rgba(255,107,0,.12);}
        .ce-item.off .ce-tit{opacity:.5;}
        .ce-item.drag{opacity:.4;}
        .ce-row{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 6px;}
        .ce-grip{cursor:grab;color:var(--sub);padding:4px;font-size:18px;line-height:1;user-select:none;}
        .ce-tit{flex:1;min-width:0;cursor:pointer;}
        .ce-tit b{display:flex;align-items:center;gap:6px;font-size:14px;font-family:'Outfit';}
        .ce-tit small{display:block;color:var(--sub);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ce-ic{width:30px;height:30px;border:1px solid var(--border2);background:#fff;border-radius:8px;cursor:pointer;font-size:11px;display:inline-flex;align-items:center;justify-content:center;color:var(--text);}
        .ce-ic:disabled{opacity:.35;cursor:not-allowed;}
        .ce-del{color:var(--red);}
        .ce-sw{position:relative;width:40px;height:23px;flex-shrink:0;}
        .ce-sw input{opacity:0;width:100%;height:100%;position:absolute;inset:0;margin:0;cursor:pointer;z-index:1;}
        .ce-sw span{position:absolute;inset:0;background:#D9D3CC;border-radius:50px;transition:.2s;}
        .ce-sw span::after{content:'';position:absolute;width:17px;height:17px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2);}
        .ce-sw input:checked+span{background:var(--green);}
        .ce-sw input:checked+span::after{left:20px;}
        .ce-sw input:focus-visible+span{outline:3px solid #86EFAC;}
        .ce-body{padding:4px 14px 14px;border-top:1px dashed var(--border);}
        .ce-add{position:relative;margin-top:10px;}
        .ce-addm{position:absolute;z-index:5;top:calc(100% + 6px);left:0;background:#fff;border:1px solid var(--border);border-radius:14px;box-shadow:0 14px 34px rgba(0,0,0,.12);padding:6px;display:grid;min-width:240px;}
        .ce-addm button{display:flex;gap:8px;align-items:center;text-align:left;border:none;background:none;padding:9px 10px;border-radius:9px;cursor:pointer;font-size:14px;color:var(--text);}
        .ce-addm button:hover:not(:disabled){background:var(--soft);}
        .ce-addm button:disabled{opacity:.4;cursor:not-allowed;}
        .ce-dep{border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--surface);}
        .ce-dep-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:13.5px;}
        .ce-conf{display:flex;gap:10px;align-items:flex-start;font-size:13px;margin-top:12px;background:var(--yellow-bg);border-radius:10px;padding:10px 12px;cursor:pointer;}
        .ce-conf input{margin-top:2px;}
        .ce-fmt{border:1.5px solid var(--border2);border-radius:12px;overflow:hidden;}
        .ce-fmt:focus-within{border-color:var(--orange);}
        .ce-fbar{display:flex;gap:2px;align-items:center;padding:4px;background:var(--surface);border-bottom:1px solid var(--border);flex-wrap:wrap;}
        .ce-fb{min-width:32px;height:30px;border:none;background:none;border-radius:7px;cursor:pointer;font-size:13.5px;padding:0 8px;color:var(--text);}
        .ce-fb:hover{background:#fff;box-shadow:0 0 0 1px var(--border2);}
        .ce-cont{margin-left:auto;font-size:11.5px;color:var(--sub);padding-right:6px;}
        .ce-fmt textarea{border:none;border-radius:0;width:100%;resize:vertical;padding:10px 12px;font-family:inherit;font-size:14px;outline:none;}
        .ce-prev{position:sticky;top:96px;}
        .ce-prevh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap;}
        .ce-tabs{display:inline-flex;background:var(--bg2);border-radius:50px;padding:3px;}
        .ce-tabs button{border:none;background:none;border-radius:50px;padding:6px 14px;font-size:13px;font-weight:800;cursor:pointer;color:var(--sub);}
        .ce-tabs button.on{background:#fff;color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.1);}
        .ce-frame{border:1px solid var(--border);border-radius:26px;overflow:hidden;background:var(--surface);box-shadow:0 20px 50px rgba(22,22,42,.1);margin:0 auto;transition:max-width .25s;}
        .ce-frame.celular{max-width:390px;}
        .ce-frame.computador{max-width:100%;}
        .ce-fhead{background:#fff;border-bottom:1px solid var(--border);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;font-size:13px;}
        .ce-fbody{max-height:calc(100vh - 220px);overflow-y:auto;padding:16px;}
        .ce-save{position:fixed;left:0;right:0;bottom:0;z-index:40;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);border-top:1px solid var(--border);padding:12px 20px;display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap;}
        .ce-bumpinfo{display:flex;gap:10px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 12px;font-size:13px;margin:4px 0 12px;}
        @media(max-width:1180px){.ce{grid-template-columns:minmax(0,1fr);}.ce-prev{position:static;}}
        @media(max-width:600px){.ce-row{flex-wrap:wrap;}.ce-tit{flex:1 0 calc(100% - 60px);}.ce-row>.ce-ic:first-of-type{margin-left:38px;}.ce-sec{padding:14px;}.ce-save{padding:10px 12px;}}
      ` }} />

      <div>
        <section className="ce-sec">
          <h3><Icon name="grid" size={18} /> Blocos da página</h3>
          <p className="muted" style={{ fontSize: 13 }}>Arraste pelo ⋮⋮ (ou use ▲▼) para mudar a ordem. Use o botão verde para mostrar/esconder. Clique no bloco para editar.</p>
          <div className="ce-list">
            {cfg.blocos.map((b, i) => (
              <div key={b.id} className={`ce-item ${aberto === b.id ? 'on' : ''} ${b.ativo ? '' : 'off'} ${arrastando === i ? 'drag' : ''}`}
                draggable={aberto !== b.id} onDragStart={(e) => { setArrastando(i); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (arrastando !== null) mover(arrastando, i); setArrastando(null); }}
                onDragEnd={() => setArrastando(null)}>
                <div className="ce-row">
                  <span className="ce-grip" aria-hidden="true" title="Arrastar">⋮⋮</span>
                  <div className="ce-tit" role="button" tabIndex={0} aria-expanded={aberto === b.id}
                    onClick={() => setAberto(aberto === b.id ? null : b.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberto(aberto === b.id ? null : b.id); } }}>
                    <b><Icon name={ICONE[b.tipo]} size={15} color={b.tipo === 'pagamento' ? cor : undefined} /> {ROTULO_BLOCO[b.tipo]}</b>
                    <small>{resumo(b)}</small>
                  </div>
                  <button type="button" className="ce-ic" title="Subir" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, i - 1)}>▲</button>
                  <button type="button" className="ce-ic" title="Descer" aria-label="Descer" disabled={i === cfg.blocos.length - 1} onClick={() => mover(i, i + 1)}>▼</button>
                  {b.tipo !== 'pagamento' && (
                    <>
                      <label className="ce-sw" title={b.ativo ? 'Visível: clique para esconder' : 'Escondido: clique para mostrar'}>
                        <input type="checkbox" checked={b.ativo} aria-label={`Mostrar ${ROTULO_BLOCO[b.tipo]}`} onChange={(e) => setBloco(b.id, { ativo: e.target.checked })} /><span />
                      </label>
                      <button type="button" className="ce-ic ce-del" title="Remover bloco" aria-label="Remover bloco"
                        onClick={() => { if (confirm(`Remover o bloco "${ROTULO_BLOCO[b.tipo]}"?`)) remover(b.id); }}><Icon name="trash" size={14} /></button>
                    </>
                  )}
                </div>
                {aberto === b.id && <div className="ce-body">{editorDo(b)}</div>}
              </div>
            ))}
          </div>
          <div className="ce-add">
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={menuAdd} onClick={() => setMenuAdd(!menuAdd)}><Icon name="plus" size={14} /> Adicionar bloco</button>
            {menuAdd && (
              <div className="ce-addm" role="menu">
                {ADICIONAVEIS.map((t) => (
                  <button key={t} type="button" role="menuitem" disabled={!podeAdicionar(t)} onClick={() => adicionar(t)}>
                    <Icon name={ICONE[t]} size={15} /> {ROTULO_BLOCO[t]}{!podeAdicionar(t) && <small className="muted" style={{ marginLeft: 'auto' }}>já está na página</small>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="ce-sec">
          <h3><Icon name="magnet" size={18} /> Order bump (oferta extra)</h3>
          <p className="muted" style={{ fontSize: 13 }}>Um produto seu oferecido dentro do checkout, com um clique, por um preço especial. É o que mais aumenta o ticket médio.</p>
          <div className="fg"><label>Produto oferecido</label>
            <select value={bumpId} onChange={(e) => { setBumpId(e.target.value); setSujo(true); const o = outrosProdutos.find((x) => x.id === e.target.value); if (o && !bumpValor) setBumpValor(String(Math.max(1, Math.round(o.preco * 0.5 * 100) / 100))); }}>
              <option value="">Nenhum (sem order bump)</option>
              {outrosProdutos.map((o) => <option key={o.id} value={o.id}>{o.titulo} — {money(o.preco)}{o.status !== 'ativo' ? ' (em revisão)' : ''}</option>)}
            </select>
            {!outrosProdutos.length && <small className="muted" style={{ fontSize: 12 }}>Cadastre outro produto na sua loja para usar como order bump.</small>}
          </div>
          {bumpProd && (
            <>
              {bumpProd.status !== 'ativo' && <div className="ce-conf" style={{ marginTop: 0, marginBottom: 12, cursor: 'default' }}><Icon name="alert" size={16} /> <span>Este produto ainda está em revisão. O order bump só aparece no checkout depois que ele for aprovado.</span></div>}
              <div className="fg2">
                <div className="fg"><label>Preço no order bump (R$)</label>
                  <input type="number" step="0.01" min={1} inputMode="decimal" value={bumpValor} onChange={(e) => { setBumpValor(e.target.value); setSujo(true); }} placeholder="9.90" /></div>
                <div className="fg"><label>Preço normal</label><input value={money(bumpProd.preco)} readOnly /></div>
              </div>
              {bumpNum > 0 && bumpNum < bumpProd.preco && <div className="ce-bumpinfo"><Icon name="fire" size={16} color={cor} /> O comprador vê <s>{money(bumpProd.preco)}</s> → <b>{money(bumpNum)}</b> ({Math.round((1 - bumpNum / bumpProd.preco) * 100)}% de desconto).</div>}
              <div className="fg"><label>Chamada (texto da faixa)</label>
                <input value={cfg.bump.chamada} maxLength={LIMITES.chamada} onChange={(e) => mudar((c) => ({ ...c, bump: { ...c.bump, chamada: e.target.value } }))} placeholder={`Sim! Quero adicionar ${bumpProd.titulo}`} /></div>
              <div className="fg"><label>Texto de venda</label>
                <textarea rows={3} value={cfg.bump.texto} maxLength={LIMITES.bumpTexto} onChange={(e) => mudar((c) => ({ ...c, bump: { ...c.bump, texto: e.target.value } }))} placeholder={bumpProd.descricao || 'Ex.: Leve também o pack de planilhas prontas com 50% de desconto. Só nesta página.'} /></div>
              <div className="fg"><label>Imagem do order bump</label>
                <CoverUpload key={cfg.bump.imagem || 'sem'} userId={userId} value={cfg.bump.imagem || ''} onUploaded={(url) => mudar((c) => ({ ...c, bump: { ...c.bump, imagem: url } }))} hint="Quadrada, 400×400 px. Sem imagem, usa a capa do produto." />
                {cfg.bump.imagem && <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => mudar((c) => ({ ...c, bump: { ...c.bump, imagem: null } }))}>Usar a capa do produto</button>}
              </div>
            </>
          )}
        </section>

        <section className="ce-sec">
          <h3><Icon name="palette" size={18} /> Cor e cupom</h3>
          <div className="fg"><label>Cor de destaque (botões, selo, contador, order bump)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={cor} onChange={(e) => mudar((c) => ({ ...c, cor: e.target.value }))} style={{ width: 52, height: 40, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
              <span className="muted" style={{ fontSize: 13 }}>{cor}</span>
              {cfg.cor && <button type="button" className="btn btn-ghost btn-sm" onClick={() => mudar((c) => ({ ...c, cor: null }))}>Usar a cor da loja</button>}
            </div>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={aceitaCupom} onChange={(e) => { setAceitaCupom(e.target.checked); setSujo(true); }} />
            <span><strong style={{ fontFamily: 'Outfit', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="ticket" size={16} /> Aceitar cupom neste produto</strong><br /><span className="muted" style={{ fontSize: 13 }}>Desligado, o campo de cupom nem aparece no checkout.</span></span>
          </label>
        </section>
      </div>

      <aside className="ce-prev" aria-label="Prévia do checkout">
        <div className="ce-prevh">
          <strong style={{ fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="eye" size={16} /> Prévia ao vivo</strong>
          <div className="ce-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={disp === 'celular'} className={disp === 'celular' ? 'on' : ''} onClick={() => setDisp('celular')}>Celular</button>
            <button type="button" role="tab" aria-selected={disp === 'computador'} className={disp === 'computador' ? 'on' : ''} onClick={() => setDisp('computador')}>Computador</button>
          </div>
        </div>
        <div className={`ce-frame ${disp}`}>
          <div className="ce-fhead"><strong style={{ fontFamily: 'Outfit' }}>{loja.nome}</strong><span className="muted" style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Icon name="lock" size={13} /> Pagamento seguro</span></div>
          <div className="ce-fbody">
            <div style={{ maxWidth: 520, margin: '0 auto' }}>
              <CheckoutBlocos config={cfg} cor={cor} mostrarVazios produto={{ titulo: produto.titulo, tipo_entrega: produto.tipo_entrega, garantia_dias: produto.garantia_dias }} pagamento={pagamentoPrevia} />
            </div>
          </div>
        </div>
      </aside>

      <div className="ce-save">
        {sujo && <span className="muted" style={{ fontSize: 13, marginRight: 'auto' }}>● Alterações não salvas</span>}
        {personalizado && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} style={{ color: 'var(--red)' }} onClick={() => { if (confirm('Voltar ao checkout padrão? Blocos, textos, depoimentos e o order bump deste produto serão removidos.')) salvar(true); }}>Restaurar padrão</button>}
        {produto.status === 'ativo'
          ? <a className="btn btn-ghost btn-sm" href={`/checkout/${productId}`} target="_blank" rel="noreferrer"><Icon name="eye" size={14} /> Ver checkout real</a>
          : <span className="muted" style={{ fontSize: 12.5 }}>O checkout real abre quando o produto for aprovado.</span>}
        <button type="button" className="btn btn-pri" disabled={busy} onClick={() => salvar(false)}>{busy ? 'Salvando…' : 'Salvar checkout'}</button>
      </div>
    </div>
  );
}
