'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { POS_VENDA_PADRAO, type PosVenda } from '@/lib/posVenda';

type Outro = { id: string; titulo: string; status: string; preco: number };
type Numeros = { ofertas: { aceitas: number; pagas: number; valor: number; recusadas: number }; carrinhos: { total: number; lembrados: number; recuperados: number; valor: number } };
const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Construtor do checkout → "Depois da compra" (SQL 19). Botão de salvar próprio.
export default function SecaoPosVenda({ productId, outrosProdutos }: { productId: string; outrosProdutos: Outro[] }) {
  const [cfg, setCfg] = useState<PosVenda | null>(null);
  const [sql19, setSql19] = useState(true);
  const [nums, setNums] = useState<Numeros | null>(null);
  const [busy, setBusy] = useState(false);
  const ativos = outrosProdutos.filter((o) => o.status === 'ativo');

  useEffect(() => {
    fetch(`/api/seller/pos-venda?productId=${productId}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json()).then((d) => { setSql19(d.sql19 !== false); setCfg(d.cfg || POS_VENDA_PADRAO); setNums(d.numeros || null); })
      .catch(() => setCfg(POS_VENDA_PADRAO));
  }, [productId]);

  async function salvar() {
    if (!cfg) return;
    setBusy(true);
    try {
      const r = await fetch('/api/seller/pos-venda', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, ...cfg }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível salvar.', 'error'); return; }
      setCfg(d.cfg); toast('Depois da compra: salvo.', 'success');
    } finally { setBusy(false); }
  }

  if (!cfg) return <section className="ce-sec"><span className="muted">Carregando…</span></section>;
  if (!sql19) return <section className="ce-sec"><h3><Icon name="gift" size={18} /> Depois da compra</h3><p className="muted" style={{ fontSize: 13 }}>Disponível depois que o SQL 19 for aplicado.</p></section>;

  const setUp = (p: Partial<PosVenda['upsell']>) => setCfg({ ...cfg, upsell: { ...cfg.upsell, ...p } });
  const setDown = (p: Partial<PosVenda['downsell']>) => setCfg({ ...cfg, downsell: { ...cfg.downsell, ...p } });
  const prod = (id: string | null) => ativos.find((o) => o.id === id) || null;
  const pu = prod(cfg.upsell.product_id), pd = prod(cfg.downsell.product_id);

  return (
    <section className="ce-sec">
      <h3><Icon name="gift" size={18} /> Depois da compra</h3>
      <p className="muted" style={{ fontSize: 13 }}>Venda mais para quem acabou de comprar e recupere quem desistiu no meio do caminho.</p>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <label className="ce-tog" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={cfg.upsell.ativo} onChange={(e) => setUp({ ativo: e.target.checked })} />
          <span><b>Oferta com 1 clique logo depois da compra</b><br /><small className="muted">Aparece na página do pedido assim que o pagamento é confirmado. O cliente aceita sem preencher nada de novo e paga com Pix ou cartão.</small></span>
        </label>
        {cfg.upsell.ativo && (
          <div style={{ marginTop: 10 }}>
            {!ativos.length && <p className="muted" style={{ fontSize: 13 }}>Você precisa de outro produto ativo na loja para oferecer.</p>}
            <div className="fg2">
              <div className="fg"><label>Produto oferecido</label>
                <select value={cfg.upsell.product_id || ''} onChange={(e) => setUp({ product_id: e.target.value || null })}>
                  <option value="">Escolha…</option>
                  {ativos.map((o) => <option key={o.id} value={o.id}>{o.titulo} — {money(o.preco)}</option>)}
                </select></div>
              <div className="fg"><label>Preço especial (R$)</label>
                <input type="number" min={1} step="0.01" value={cfg.upsell.preco ?? ''} placeholder={pu ? String(pu.preco) : 'Ex.: 27'} onChange={(e) => setUp({ preco: e.target.value ? Number(e.target.value) : null })} />
                {pu && cfg.upsell.preco && cfg.upsell.preco < pu.preco && <small className="muted" style={{ fontSize: 12 }}>{Math.round((1 - cfg.upsell.preco / pu.preco) * 100)}% abaixo do preço normal</small>}</div>
            </div>
            <div className="fg"><label>Chamada</label>
              <input value={cfg.upsell.titulo} maxLength={120} placeholder="Espere! Leve também o Pack Avançado com 60% de desconto" onChange={(e) => setUp({ titulo: e.target.value })} /></div>
            <div className="fg"><label>Texto (opcional)</label>
              <textarea rows={3} maxLength={2000} value={cfg.upsell.texto} placeholder="Explique em 2 ou 3 frases por que vale a pena levar agora." onChange={(e) => setUp({ texto: e.target.value })} /></div>
            <div className="fg2">
              <div className="fg"><label>Texto do botão</label>
                <input value={cfg.upsell.botao} maxLength={60} placeholder="Sim, quero adicionar" onChange={(e) => setUp({ botao: e.target.value })} /></div>
              <div className="fg"><label>Validade da oferta (minutos)</label>
                <input type="number" min={0} max={120} value={cfg.upsell.minutos} onChange={(e) => setUp({ minutos: Number(e.target.value) || 0 })} />
                <small className="muted" style={{ fontSize: 12 }}>0 = sem prazo. Com prazo, aparece um cronômetro de verdade: depois dele a oferta some.</small></div>
            </div>

            <label className="ce-tog">
              <input type="checkbox" checked={cfg.downsell.ativo} onChange={(e) => setDown({ ativo: e.target.checked })} />
              <span><b>Se recusar, mostrar uma segunda oferta</b><br /><small className="muted">Uma opção mais barata para quem disse não à primeira.</small></span>
            </label>
            {cfg.downsell.ativo && (
              <div style={{ marginTop: 10 }}>
                <div className="fg2">
                  <div className="fg"><label>Produto</label>
                    <select value={cfg.downsell.product_id || ''} onChange={(e) => setDown({ product_id: e.target.value || null })}>
                      <option value="">Escolha…</option>
                      {ativos.map((o) => <option key={o.id} value={o.id}>{o.titulo} — {money(o.preco)}</option>)}
                    </select></div>
                  <div className="fg"><label>Preço (R$)</label>
                    <input type="number" min={1} step="0.01" value={cfg.downsell.preco ?? ''} placeholder={pd ? String(pd.preco) : 'Ex.: 17'} onChange={(e) => setDown({ preco: e.target.value ? Number(e.target.value) : null })} /></div>
                </div>
                <div className="fg"><label>Chamada</label>
                  <input value={cfg.downsell.titulo} maxLength={120} placeholder="Tudo bem! Que tal só o módulo bônus por R$ 17?" onChange={(e) => setDown({ titulo: e.target.value })} /></div>
                <div className="fg"><label>Texto (opcional)</label>
                  <textarea rows={2} maxLength={2000} value={cfg.downsell.texto} onChange={(e) => setDown({ texto: e.target.value })} /></div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
        <label className="ce-tog" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={cfg.recuperacao.ativa} onChange={(e) => setCfg({ ...cfg, recuperacao: { ...cfg.recuperacao, ativa: e.target.checked } })} />
          <span><b>Recuperar carrinho abandonado</b><br /><small className="muted">Quem preencheu nome e e-mail no checkout e não pagou recebe um lembrete por e-mail e WhatsApp depois de 1 hora e de 24 horas.</small></span>
        </label>
        {cfg.recuperacao.ativa && (
          <div className="fg" style={{ marginTop: 10, marginBottom: 0 }}><label>Cupom no lembrete (opcional)</label>
            <input value={cfg.recuperacao.cupom || ''} maxLength={40} placeholder="Ex.: VOLTA10" onChange={(e) => setCfg({ ...cfg, recuperacao: { ...cfg.recuperacao, cupom: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') || null } })} />
            <small className="muted" style={{ fontSize: 12 }}>O link do lembrete já abre o checkout com este cupom aplicado. Crie o cupom em <b>Cupons</b> e deixe &quot;Aceitar cupom&quot; ligado.</small></div>
        )}
      </div>

      {nums && (nums.ofertas.aceitas + nums.ofertas.recusadas + nums.carrinhos.total > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 12 }}>
          <div className="ce-num"><b>{nums.ofertas.pagas}</b><span>ofertas pagas ({money(nums.ofertas.valor)})</span></div>
          <div className="ce-num"><b>{nums.ofertas.aceitas + nums.ofertas.recusadas ? Math.round((nums.ofertas.aceitas / (nums.ofertas.aceitas + nums.ofertas.recusadas)) * 100) : 0}%</b><span>aceitaram a oferta</span></div>
          <div className="ce-num"><b>{nums.carrinhos.total}</b><span>carrinhos abandonados</span></div>
          <div className="ce-num"><b>{nums.carrinhos.recuperados}</b><span>recuperados ({money(nums.carrinhos.valor)})</span></div>
        </div>
      )}

      <button type="button" className="btn btn-pri btn-sm" style={{ marginTop: 12 }} disabled={busy} onClick={salvar}>{busy ? 'Salvando…' : 'Salvar “Depois da compra”'}</button>
      <style dangerouslySetInnerHTML={{ __html: `.ce-tog{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;cursor:pointer;margin-top:12px}.ce-tog input{margin-top:3px;accent-color:var(--orange);width:17px;height:17px;flex:none}.ce-num{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column}.ce-num b{font-family:'Outfit';font-size:20px}.ce-num span{color:var(--sub);font-size:12px;font-weight:700}` }} />
    </section>
  );
}
