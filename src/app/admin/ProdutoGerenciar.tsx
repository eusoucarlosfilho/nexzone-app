'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { avisoEstoque, lerEstoque } from '@/lib/estoque';

type Dados = {
  id: string; titulo: string; status: string; vendas: number; pedidosPagos: number | null;
  avaliacoes: number; media: number; sql07: boolean; estoque: number | null; pausadoSemEstoque: boolean;
  ocultarContadores: boolean; loja: { id: string; nome: string; ocultarVendedor: boolean } | null;
};

// Admin → Produtos → Gerenciar (um produto de qualquer vendedor).
// Números de vendas, avaliações e estrelas: SÓ LEITURA (vêm de pedidos pagos e avaliações reais).
// O admin decide se eles aparecem na página, ajusta o estoque e pode vender a loja como Comprei Barato.
export default function ProdutoGerenciar({ id, onLoja }: { id: string; onLoja?: (storeId: string, oculto: boolean) => void }) {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [estoque, setEstoque] = useState('');

  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/produto-exibicao?id=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => {
        if (!vivo) return;
        if (!ok) { setErro(j.error || 'Não foi possível carregar.'); return; }
        setD(j); setEstoque(j.estoque === null || j.estoque === undefined ? '' : String(j.estoque));
      })
      .catch(() => vivo && setErro('Falha de conexão.'));
    return () => { vivo = false; };
  }, [id]);

  async function salvar(campos: { ocultarContadores?: boolean; estoque?: string }, chave: string) {
    setBusy(chave);
    try {
      const r = await fetch('/api/admin/produto-exibicao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, ...campos }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Falha ao salvar.', 'error'); return; }
      setD(j); setEstoque(j.estoque === null || j.estoque === undefined ? '' : String(j.estoque));
      toast('Salvo.', 'success');
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setBusy(null); }
  }

  async function alternarLoja() {
    if (!d?.loja) return;
    const ligar = !d.loja.ocultarVendedor;
    if (ligar && !confirm(`TODOS os produtos da loja "${d.loja.nome}" vão aparecer como vendidos pelo Comprei Barato. O nome da loja fica visível só no Admin.`)) return;
    setBusy('loja');
    try {
      const r = await fetch('/api/admin/store-visibility', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ store_id: d.loja.id, ocultar: ligar }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Falha ao alterar.', 'error'); return; }
      const oculto = j.ocultar_vendedor === true;
      setD({ ...d, loja: { ...d.loja, ocultarVendedor: oculto } });
      onLoja?.(d.loja.id, oculto);
      toast(oculto ? 'Loja vendendo como Comprei Barato.' : 'Loja voltou a aparecer com o próprio nome.', 'success');
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setBusy(null); }
  }

  if (erro) return <div className="pg-box"><span style={{ color: '#FF8A8A' }}>{erro}</span></div>;
  if (!d) return <div className="pg-box" aria-busy="true"><span className="muted">Carregando…</span></div>;

  const lido = lerEstoque(estoque);
  const mudouEstoque = estoque !== (d.estoque === null ? '' : String(d.estoque));
  const aviso = avisoEstoque(d.estoque);
  const diverge = d.pedidosPagos !== null && d.pedidosPagos !== d.vendas;

  return (
    <div className="pg-box">
      <style>{`
        .pg-box{background:var(--panel2);border:1px solid var(--bd2);border-radius:14px;padding:16px;display:grid;gap:16px;}
        .pg-sec h4{font-family:'Outfit';font-size:14px;font-weight:800;margin:0 0 8px;}
        .pg-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;}
        .pg-num{border:1px solid var(--bd2);border-radius:12px;padding:10px 12px;}
        .pg-num b{display:block;font-family:'Outfit';font-size:22px;}
        .pg-num small{color:var(--sub);font-size:12px;}
        .pg-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
        .pg-row input[type=text]{width:120px;height:40px;border-radius:10px;border:1px solid var(--bd2);padding:0 12px;font-size:14px;background:var(--panel);color:var(--tx);}
        .pg-help{font-size:12.5px;color:var(--sub);margin-top:6px;}
        .pg-sw{display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-size:14px;}
        .pg-sw input{width:18px;height:18px;margin-top:2px;}
      `}</style>

      <div className="pg-sec">
        <h4>Números reais deste produto</h4>
        <div className="pg-nums">
          <div className="pg-num"><b>{d.vendas.toLocaleString('pt-BR')}</b><small>vendas (contador do site)</small></div>
          <div className="pg-num"><b>{d.pedidosPagos === null ? '—' : d.pedidosPagos.toLocaleString('pt-BR')}</b><small>pedidos pagos no banco</small></div>
          <div className="pg-num"><b>{d.avaliacoes.toLocaleString('pt-BR')}</b><small>avaliações de compradores</small></div>
          <div className="pg-num"><b>{d.avaliacoes ? `★ ${d.media.toFixed(1).replace('.', ',')}` : '—'}</b><small>nota média</small></div>
        </div>
        <div className="pg-help">
          Esses números vêm só de pedidos pagos e avaliações de quem comprou. Não são editáveis: número digitado à mão seria propaganda enganosa (CDC, art. 37) e derruba a confiança no marketplace inteiro.
          {diverge && <> <b style={{ color: '#FFC94D' }}>Atenção:</b> o contador do site difere dos pedidos pagos (pode ser reembolso ou pedido antigo).</>}
        </div>
      </div>

      <div className="pg-sec">
        <h4>Exibição na página do produto</h4>
        {d.sql07 ? (
          <label className="pg-sw">
            <input type="checkbox" checked={!d.ocultarContadores} disabled={busy === 'cont'}
              onChange={(e) => salvar({ ocultarContadores: !e.target.checked }, 'cont')} />
            <span>Mostrar estrelas, avaliações e vendas
              <div className="pg-help" style={{ marginTop: 2 }}>Desligado: a linha some da página. Ligado: aparece só o que for maior que zero (com tudo em zero, aparece &quot;Novo&quot;).</div></span>
          </label>
        ) : <div className="pg-help">Disponível depois de rodar o SQL 07 (estoque e contadores).</div>}
      </div>

      <div className="pg-sec">
        <h4>Estoque</h4>
        {d.sql07 ? (
          <>
            <div className="pg-row">
              <input type="text" inputMode="numeric" maxLength={7} placeholder="Ilimitado" aria-label="Quantidade em estoque"
                value={estoque} onChange={(e) => setEstoque(e.target.value.replace(/[^\d]/g, ''))} />
              <button type="button" className="adm-btn ap" disabled={!mudouEstoque || !lido.ok || busy === 'est'}
                onClick={() => salvar({ estoque }, 'est')}>{busy === 'est' ? 'Salvando…' : 'Salvar estoque'}</button>
              {aviso && <span className="muted" style={{ fontSize: 13 }}>Comprador vê: &quot;{aviso.texto}&quot;</span>}
            </div>
            <div className="pg-help">O vendedor também edita em Meus produtos. Cai 1 a cada venda paga; ao zerar, o produto mostra &quot;Esgotado&quot; e sai de venda. Em branco = sem limite.
              {d.pausadoSemEstoque && <> <b style={{ color: '#FF8A8A' }}>Esgotado agora.</b> Ao repor, volta ao ar sozinho.</>}</div>
          </>
        ) : <div className="pg-help">Disponível depois de rodar o SQL 07.</div>}
      </div>

      {d.loja && (
        <div className="pg-sec">
          <h4>Nome do vendedor</h4>
          <div className="pg-row">
            <button type="button" className={`adm-btn ${d.loja.ocultarVendedor ? 'ap' : 'rp'}`} disabled={busy === 'loja'} onClick={alternarLoja}>
              {d.loja.ocultarVendedor ? 'Vendendo como Comprei Barato · mostrar nome' : `Ocultar "${d.loja.nome}" e vender como Comprei Barato`}
            </button>
          </div>
          <div className="pg-help">Vale para todos os produtos da loja {d.loja.nome} (página, card, checkout, chat e e-mails). O nome real fica visível só no Admin.</div>
        </div>
      )}
    </div>
  );
}
