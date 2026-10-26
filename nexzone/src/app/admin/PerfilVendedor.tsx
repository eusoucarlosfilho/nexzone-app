'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

// Painel lateral com o perfil do vendedor (Admin). Ações reaproveitam as rotas que já existem:
// avisos/advertências e bloqueio (/api/admin/user-action) e "vender como Comprei Barato" (/api/admin/store-visibility).
const money = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
const data = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const ST_PROD: Record<string, string> = { ativo: 'no ar', em_revisao: 'em revisão', pausado: 'pausado', reprovado: 'fora do ar', rascunho: 'rascunho' };

export default function PerfilVendedor({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/vendedor?storeId=${encodeURIComponent(storeId)}`, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => (ok ? setD(j) : setErro(j.error || 'Não foi possível carregar.')))
      .catch(() => setErro('Falha de conexão.'));
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [storeId, onClose]);

  async function acaoUsuario(action: string, texto?: string) {
    if (!d) return;
    setBusy(action);
    try {
      const r = await fetch('/api/admin/user-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ userId: d.dono.id, action, texto }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Falha na ação.', 'error'); return; }
      if (j.status) setD({ ...d, dono: { ...d.dono, status: j.status } });
      if (action === 'advertencia') setD((x: any) => ({ ...x, advertencias: x.advertencias + 1 }));
      toast(action === 'aviso' ? 'Aviso enviado.' : action === 'advertencia' ? 'Advertência registrada.' : 'Situação da conta atualizada.', 'success');
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setBusy(null); }
  }
  function escrever(tipo: 'aviso' | 'advertencia') {
    const t = window.prompt(tipo === 'aviso' ? 'Mensagem do aviso para o vendedor:' : 'Texto da advertência:');
    if (t && t.trim()) acaoUsuario(tipo, t.trim());
  }
  function status(action: 'block' | 'unblock' | 'restrict' | 'unrestrict') {
    const msg: Record<string, string> = {
      block: 'Bloquear a conta deste vendedor? Ele perde o acesso.', restrict: 'Restringir a conta? Ele não consegue cadastrar produtos.',
      unblock: 'Desbloquear a conta?', unrestrict: 'Tirar a restrição?',
    };
    if (confirm(msg[action])) acaoUsuario(action);
  }
  async function alternarNome() {
    if (!d) return;
    const ligar = !d.loja.ocultar_vendedor;
    if (ligar && !confirm(`Todos os produtos de "${d.loja.nome}" vão aparecer como vendidos pelo Comprei Barato. Continuar?`)) return;
    setBusy('nome');
    try {
      const r = await fetch('/api/admin/store-visibility', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ store_id: d.loja.id, ocultar: ligar }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Falha ao alterar.', 'error'); return; }
      setD({ ...d, loja: { ...d.loja, ocultar_vendedor: j.ocultar_vendedor === true } });
      toast(j.ocultar_vendedor ? 'Loja vendendo como Comprei Barato.' : 'Nome da loja visível de novo.', 'success');
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setBusy(null); }
  }

  const contaStatus = d?.dono?.status ?? 'ativo';
  return (
    <div className="pv-fundo" role="presentation" onClick={onClose}>
      <style dangerouslySetInnerHTML={{ __html: `
        .pv-fundo{position:fixed;inset:0;background:rgba(10,10,20,.45);z-index:200;display:flex;justify-content:flex-end;}
        .pv{width:min(460px,100%);height:100%;overflow-y:auto;background:var(--panel);color:var(--tx);box-shadow:-10px 0 40px rgba(0,0,0,.3);padding:20px;animation:pv-in .2s ease-out;}
        @keyframes pv-in{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
        .pv h3{font-family:'Outfit';font-size:20px;font-weight:900;margin:0;}
        .pv-sec{border:1px solid var(--bd2);border-radius:14px;padding:12px 14px;margin-top:12px;font-size:13.5px;}
        .pv-sec h5{font-family:'Outfit';font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--sub);margin:0 0 8px;}
        .pv-l{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px dashed var(--bd2);}
        .pv-l:last-child{border-bottom:none;}
        .pv-l span:last-child{text-align:right;word-break:break-word;}
        .pv-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
        .pv-nums div{border:1px solid var(--bd2);border-radius:10px;padding:8px;text-align:center;}
        .pv-nums b{display:block;font-family:'Outfit';font-size:18px;}
        .pv-nums small{color:var(--sub);font-size:11px;}
        .pv-acoes{display:flex;gap:6px;flex-wrap:wrap;}
        .pv-acoes button,.pv-acoes a{font-size:12.5px;font-weight:800;border:1px solid var(--bd2);border-radius:9px;padding:7px 10px;color:var(--tx);background:none;cursor:pointer;text-decoration:none;}
        .pv-acoes .perigo{border-color:#FF6B6B;color:#FF8A8A;}
        .pv-x{float:right;border:none;background:none;color:var(--sub);font-size:22px;cursor:pointer;line-height:1;}
      ` }} />
      <aside className="pv" role="dialog" aria-modal="true" aria-label="Perfil do vendedor" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pv-x" aria-label="Fechar" onClick={onClose}>×</button>
        {erro && <p style={{ color: '#FF8A8A' }}>{erro}</p>}
        {!d && !erro && <p className="muted">Carregando…</p>}
        {d && (
          <>
            <h3>{d.loja.nome}</h3>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              Loja {d.loja.status} · nível {d.loja.nivel}{d.loja.ocultar_vendedor ? ' · vendendo como Comprei Barato' : ''}
            </div>

            <div className="pv-sec">
              <h5>Dono da loja</h5>
              <div className="pv-l"><span>Nome</span><span>{d.dono.nome || '—'}</span></div>
              <div className="pv-l"><span>E-mail</span><span>{d.dono.email || '—'}</span></div>
              <div className="pv-l"><span>WhatsApp</span><span>{d.dono.whatsapp || '—'}</span></div>
              <div className="pv-l"><span>Cidade</span><span>{d.dono.cidade ? `${d.dono.cidade}${d.dono.uf ? `/${d.dono.uf}` : ''}` : '—'}</span></div>
              <div className="pv-l"><span>Conta</span><span style={{ color: contaStatus === 'ativo' ? '#3DDC97' : '#FF8A8A', fontWeight: 800 }}>{contaStatus}</span></div>
              <div className="pv-l"><span>Cadastro</span><span>{data(d.dono.desde)} · loja desde {data(d.loja.criada_em)}</span></div>
            </div>

            <div className="pv-sec">
              <h5>Vendas</h5>
              <div className="pv-nums">
                <div><b>{money(d.numeros.faturamento)}</b><small>faturamento</small></div>
                <div><b>{d.numeros.vendas}</b><small>vendas</small></div>
                <div><b style={{ color: d.numeros.reembolsos ? '#FF8A8A' : undefined }}>{d.numeros.reembolsos}</b><small>reembolsos</small></div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Última venda: {data(d.numeros.ultimaVenda)}</div>
            </div>

            <div className="pv-sec">
              <h5>Produtos ({d.produtos.total})</h5>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>{d.produtos.ativos} no ar · {d.produtos.em_revisao} em revisão · {d.produtos.pausados} pausados · {d.produtos.reprovados} fora do ar</div>
              {d.produtos.lista.map((p: any) => (
                <div key={p.id} className="pv-l"><a href={`/produto/${p.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--tx)' }}>{p.titulo}</a><span className="muted">{ST_PROD[p.status] ?? p.status}</span></div>
              ))}
            </div>

            <div className="pv-sec">
              <h5>Confiança</h5>
              <div className="pv-l"><span>Reclamações</span><span style={{ color: d.reclamacoes.abertas ? '#FF8A8A' : undefined }}>{d.reclamacoes.total} ({d.reclamacoes.abertas} abertas)</span></div>
              <div className="pv-l"><span>Advertências</span><span style={{ color: d.advertencias ? '#FFC94D' : undefined }}>{d.advertencias}</span></div>
              {d.avisosRecentes.length > 0 && <div style={{ marginTop: 6 }}>{d.avisosRecentes.map((n: any, i: number) => (
                <div key={i} className="muted" style={{ fontSize: 12, padding: '3px 0' }}><b>{n.tipo}</b> · {data(n.em)} — {n.texto}</div>
              ))}</div>}
            </div>

            <div className="pv-sec">
              <h5>Ações</h5>
              <div className="pv-acoes">
                <button type="button" disabled={!!busy} onClick={() => escrever('aviso')}>Enviar aviso</button>
                <button type="button" disabled={!!busy} onClick={() => escrever('advertencia')}>Advertir</button>
                {contaStatus === 'restrito'
                  ? <button type="button" disabled={!!busy} onClick={() => status('unrestrict')}>Tirar restrição</button>
                  : <button type="button" className="perigo" disabled={!!busy} onClick={() => status('restrict')}>Restringir</button>}
                {contaStatus === 'bloqueado'
                  ? <button type="button" disabled={!!busy} onClick={() => status('unblock')}>Desbloquear</button>
                  : <button type="button" className="perigo" disabled={!!busy} onClick={() => status('block')}>Bloquear</button>}
                <button type="button" disabled={!!busy} onClick={alternarNome}>{d.loja.ocultar_vendedor ? 'Mostrar nome da loja' : 'Ocultar nome da loja'}</button>
                {d.loja.slug && !d.loja.ocultar_vendedor && <a href={`/loja/${d.loja.slug}`} target="_blank" rel="noreferrer">Ver loja ↗</a>}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
