'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { avisoEstoque, lerEstoque, lerContador, lerNota } from '@/lib/estoque';
import DestaqueProduto from './DestaqueProduto';
import ModeracaoAnuncio from './ModeracaoAnuncio';

type Dados = {
  id: string; titulo: string; status: string; vendas: number; pedidosPagos: number | null;
  avaliacoes: number; media: number; sql07: boolean; estoque: number | null; pausadoSemEstoque: boolean;
  ocultarContadores: boolean; sql08: boolean;
  manual: { ativo: boolean; vendas: number | null; avaliacoes: number | null; nota: number | null };
  loja: { id: string; nome: string; ocultarVendedor: boolean } | null;
};

// Admin → Produtos → Gerenciar (um produto de qualquer vendedor).
// Vendas, avaliações e estrelas: automáticas OU digitadas pelo admin (modo manual, SQL 08),
// com os números automáticos ao lado como referência. Também: exibição, estoque e nome do vendedor.
export default function ProdutoGerenciar({ id, onLoja, onStatus }: { id: string; onLoja?: (storeId: string, oculto: boolean) => void; onStatus?: (status: string) => void }) {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [estoque, setEstoque] = useState('');
  const [mAtivo, setMAtivo] = useState(false);
  const [mVendas, setMVendas] = useState('');
  const [mAval, setMAval] = useState('');
  const [mNota, setMNota] = useState('');
  const txt = (v: number | null | undefined, nota = false) => (v === null || v === undefined ? '' : nota ? Number(v).toFixed(1).replace('.', ',') : String(v));
  function aplicar(j: Dados) {
    setD(j); setEstoque(j.estoque === null || j.estoque === undefined ? '' : String(j.estoque));
    const m = j.manual ?? { ativo: false, vendas: null, avaliacoes: null, nota: null };
    setMAtivo(m.ativo);
    // Ao abrir sem manual, o rascunho começa com os números automáticos atuais
    setMVendas(m.ativo ? txt(m.vendas) : String(j.vendas));
    setMAval(m.ativo ? txt(m.avaliacoes) : String(j.avaliacoes));
    setMNota(m.ativo ? txt(m.nota, true) : (j.avaliacoes ? txt(j.media, true) : ''));
  }

  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/produto-exibicao?id=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => {
        if (!vivo) return;
        if (!ok) { setErro(j.error || 'Não foi possível carregar.'); return; }
        aplicar(j);
      })
      .catch(() => vivo && setErro('Falha de conexão.'));
    return () => { vivo = false; };
  }, [id]);

  async function salvar(campos: { ocultarContadores?: boolean; estoque?: string; manual?: any }, chave: string) {
    setBusy(chave);
    try {
      const r = await fetch('/api/admin/produto-exibicao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, ...campos }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Falha ao salvar.', 'error'); return; }
      aplicar(j);
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
  const diverge = !d.manual?.ativo && d.pedidosPagos !== null && d.pedidosPagos !== d.vendas;
  const vV = lerContador(mVendas), vA = lerContador(mAval), vN = lerNota(mNota);
  const erroManual = !vV.ok ? `Vendas: ${vV.erro}` : !vA.ok ? `Avaliações: ${vA.erro}` : !vN.ok ? vN.erro
    : (vA.valor ?? 0) > 0 && vN.valor === null ? 'Informe as estrelas (1 a 5) junto com o número de avaliações.' : null;

  return (
    <div className="pg-box">
      <style dangerouslySetInnerHTML={{ __html: `
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
        .pg-man{display:grid;gap:8px;max-width:560px;}
        .pg-man-h,.pg-man-r{display:grid;grid-template-columns:100px 130px 1fr;gap:10px;align-items:center;}
        .pg-man-h{font-size:11.5px;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;}
        .pg-man-r>span:first-child{font-weight:700;font-size:14px;}
        .pg-man-r input{height:40px;border-radius:10px;border:1px solid var(--bd2);padding:0 12px;font-size:15px;font-weight:700;background:var(--panel);color:var(--tx);width:100%;}
        .pg-man-r input:disabled{opacity:.55;}
        .pg-auto{font-size:13px;color:var(--sub);border-left:2px dashed var(--bd2);padding-left:10px;}
        @media(max-width:560px){.pg-man-h,.pg-man-r{grid-template-columns:80px 1fr;}.pg-man-h span:last-child{display:none}.pg-auto{grid-column:2}}
      ` }} />

      <ModeracaoAnuncio id={id} onStatus={onStatus} />

      <DestaqueProduto id={id} />

      <div className="pg-sec">
        <h4>Vendas, avaliações e estrelas</h4>
        {d.sql08 ? (
          <>
            <label className="pg-sw" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={mAtivo} onChange={(e) => setMAtivo(e.target.checked)} />
              <span>Digitar manualmente
                <div className="pg-help" style={{ marginTop: 2 }}>Ligado: o site mostra os números que você digitar, e vendas/avaliações novas não mudam esses números. Desligado: volta ao automático.</div></span>
            </label>
            <div className="pg-man">
              <div className="pg-man-h"><span></span><span>Exibido no site</span><span>Automático (rascunho)</span></div>
              <div className="pg-man-r"><span>Vendas</span>
                <input type="text" inputMode="numeric" maxLength={9} disabled={!mAtivo} value={mVendas} onChange={(e) => setMVendas(e.target.value.replace(/[^\d]/g, ''))} aria-label="Vendas exibidas" />
                <span className="pg-auto">{d.pedidosPagos === null ? d.vendas.toLocaleString('pt-BR') : d.pedidosPagos.toLocaleString('pt-BR')} pedidos pagos</span></div>
              <div className="pg-man-r"><span>Avaliações</span>
                <input type="text" inputMode="numeric" maxLength={9} disabled={!mAtivo} value={mAval} onChange={(e) => setMAval(e.target.value.replace(/[^\d]/g, ''))} aria-label="Número de avaliações exibido" />
                <span className="pg-auto">{d.avaliacoes.toLocaleString('pt-BR')} de compradores</span></div>
              <div className="pg-man-r"><span>Estrelas</span>
                <input type="text" inputMode="decimal" maxLength={3} placeholder="4,8" disabled={!mAtivo} value={mNota} onChange={(e) => setMNota(e.target.value.replace(/[^\d,.]/g, ''))} aria-label="Estrelas exibidas (1 a 5)" />
                <span className="pg-auto">{d.avaliacoes ? `★ ${d.media.toFixed(1).replace('.', ',')}` : 'sem avaliações'}</span></div>
            </div>
            <div className="pg-row" style={{ marginTop: 10 }}>
              <button type="button" className="adm-btn ap" disabled={busy === 'man' || (mAtivo && !!erroManual) || (!mAtivo && !d.manual?.ativo)}
                onClick={() => salvar({ manual: mAtivo ? { ativo: true, vendas: mVendas, avaliacoes: mAval, nota: mNota } : { ativo: false } }, 'man')}>
                {busy === 'man' ? 'Salvando…' : mAtivo ? 'Salvar números' : 'Voltar ao automático'}</button>
              {d.manual?.ativo && <span className="muted" style={{ fontSize: 13 }}>Modo manual ligado</span>}
            </div>
            {mAtivo && erroManual && <div className="pg-help" style={{ color: '#FF8A8A' }}>{erroManual}</div>}
            <div className="pg-help">Toda alteração fica registrada no histórico (quem, quando, antes e depois). A lista de comentários na página continua mostrando só avaliações reais de compradores, e o Google recebe só a nota real.</div>
          </>
        ) : (
          <>
            <div className="pg-nums">
              <div className="pg-num"><b>{d.vendas.toLocaleString('pt-BR')}</b><small>vendas (contador do site)</small></div>
              <div className="pg-num"><b>{d.avaliacoes.toLocaleString('pt-BR')}</b><small>avaliações</small></div>
              <div className="pg-num"><b>{d.avaliacoes ? `★ ${d.media.toFixed(1).replace('.', ',')}` : '—'}</b><small>nota média</small></div>
            </div>
            <div className="pg-help">Para digitar manualmente, rode o SQL 08 (contadores manuais).</div>
          </>
        )}
        {diverge && <div className="pg-help"><b style={{ color: '#FFC94D' }}>Atenção:</b> o contador do site ({d.vendas}) difere dos pedidos pagos ({d.pedidosPagos}) — pode ser reembolso ou pedido antigo.</div>}
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
