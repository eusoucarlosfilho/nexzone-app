'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { ITENS_MODERACAO, ROTULO_ACAO, ROTULO_ESTADO, rotuloItem, TEXTO_MAX, type AcaoModeracao } from '@/lib/moderacao';
import PerfilVendedor from './PerfilVendedor';

const money = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
const quando = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const STATUS: Record<string, [string, string]> = {
  ativo: ['No ar', '#3DDC97'], em_revisao: ['Em revisão', '#FFC94D'], pausado: ['Pausado', '#9AA0B4'], reprovado: ['Fora do ar', '#FF8A8A'], rascunho: ['Rascunho', '#9AA0B4'],
};
const CAMPO: Record<string, string> = {
  titulo: 'título', descricao: 'descrição', categoria: 'categoria', preco: 'preço', preco_promo: 'preço promocional', tipo_entrega: 'tipo de entrega',
  conteudo_entrega: 'entrega', garantia_dias: 'garantia', arquivo_path: 'arquivo', arquivo_nome: 'arquivo', imagens: 'fotos', capa_url: 'capa', emoji: 'ícone',
};

const ACOES: { acao: AcaoModeracao; rotulo: string; cor: string; ajuda: string }[] = [
  { acao: 'correcao', rotulo: 'Enviar para correção', cor: '#FFB020', ajuda: 'Sai do ar. O vendedor recebe a lista do que corrigir, ajusta e reenvia para a fila.' },
  { acao: 'pausar', rotulo: 'Pausar (travado)', cor: '#9AA0B4', ajuda: 'Sai do ar na hora. O vendedor não consegue reativar nem editar: só a equipe.' },
  { acao: 'cancelar', rotulo: 'Cancelar anúncio', cor: '#FF6B6B', ajuda: 'Sai do site de vez. Fica só como histórico (pedidos antigos continuam funcionando).' },
];

/** Formulário de motivo (checklist + texto). Usado aqui e na Fila de Aprovação. */
export function FormMotivo({ acao, onEnviar, onCancelar, busy, inicial = [] }: { acao: AcaoModeracao; onEnviar: (itens: string[], texto: string) => void; onCancelar: () => void; busy: boolean; inicial?: string[] }) {
  const [itens, setItens] = useState<string[]>(inicial);
  const [texto, setTexto] = useState('');
  const info = ACOES.find((x) => x.acao === acao);
  const pode = itens.length > 0 || texto.trim().length > 0;
  return (
    <div className="mo-form" style={{ borderColor: info?.cor }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .mo-form{border:2px solid;border-radius:14px;padding:12px;margin-top:10px;background:var(--panel);}
        .mo-itens{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;margin:10px 0;}
        .mo-itens label{display:flex;gap:8px;align-items:center;border:1px solid var(--bd2);border-radius:10px;padding:8px 10px;font-size:13px;cursor:pointer;}
        .mo-itens label.on{border-color:#FFB020;background:rgba(255,176,32,.1);}
        .mo-form textarea{width:100%;border-radius:10px;border:1px solid var(--bd2);padding:10px;font-size:13.5px;background:var(--panel2);color:var(--tx);font-family:inherit;}
        .mo-form .pg-help{font-size:12.5px;color:var(--sub);margin-top:6px;}
      ` }} />
      <strong style={{ fontFamily: 'Outfit', fontSize: 14 }}>{info?.rotulo}</strong>
      <div className="pg-help" style={{ marginTop: 2 }}>{info?.ajuda}</div>
      <div className="mo-itens">
        {ITENS_MODERACAO.map((i) => (
          <label key={i.id} className={itens.includes(i.id) ? 'on' : ''}>
            <input type="checkbox" checked={itens.includes(i.id)} onChange={(e) => setItens((l) => (e.target.checked ? [...l, i.id] : l.filter((x) => x !== i.id)))} />
            <span>{i.rotulo}</span>
          </label>
        ))}
      </div>
      <textarea rows={3} maxLength={TEXTO_MAX} value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Detalhe para o vendedor (opcional). Ex.: a 2ª foto tem marca d’água de outro site; o link de entrega dá erro 404." />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="adm-btn" style={{ background: info?.cor, color: '#0F0F1A' }} disabled={!pode || busy} onClick={() => onEnviar(itens, texto)}>
          {busy ? 'Enviando…' : `Confirmar: ${info?.rotulo.toLowerCase()}`}</button>
        <button type="button" className="adm-btn rp" disabled={busy} onClick={onCancelar}>Voltar</button>
      </div>
      <div className="pg-help">O vendedor é avisado no site, por e-mail e por WhatsApp (se estiver ligado).</div>
    </div>
  );
}

export default function ModeracaoAnuncio({ id, onStatus }: { id: string; onStatus?: (status: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<AcaoModeracao | null>(null);
  const [busy, setBusy] = useState(false);
  const [perfil, setPerfil] = useState(false);
  const [verEntrega, setVerEntrega] = useState(false);

  const carregar = useCallback(() => {
    fetch(`/api/admin/moderacao?id=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => (ok ? setD(j) : setErro(j.error || 'Não foi possível carregar.')))
      .catch(() => setErro('Falha de conexão.'));
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function executar(acao: AcaoModeracao, itens: string[] = [], texto = '') {
    if (acao === 'reativar' && !confirm('Colocar o anúncio no ar agora?')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/moderacao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, acao, itens, texto }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Falha na ação.', 'error'); return; }
      toast(acao === 'reativar' ? 'Anúncio no ar.' : acao === 'correcao' ? 'Correção pedida. O vendedor foi avisado.' : acao === 'pausar' ? 'Anúncio pausado e travado.' : 'Anúncio cancelado.', 'success');
      setForm(null); onStatus?.(j.status); carregar();
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setBusy(false); }
  }

  if (erro) return <div className="pg-sec"><span style={{ color: '#FF8A8A' }}>{erro}</span></div>;
  if (!d) return <div className="pg-sec"><span className="muted">Carregando moderação…</span></div>;

  const p = d.produto, m = d.moderacao, st = STATUS[p.status] ?? [p.status, '#9AA0B4'];
  const travado = m?.estado === 'pausado_admin' || m?.estado === 'cancelado';
  const entregaLink = /^https?:\/\//.test(String(p.conteudo_entrega || '').trim()) ? String(p.conteudo_entrega).trim().split(/\s/)[0] : null;

  return (
    <div className="pg-sec mo">
      <style dangerouslySetInnerHTML={{ __html: `
        .mo-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;}
        .mo-pill{font-size:12px;font-weight:900;border-radius:50px;padding:3px 10px;color:#0F0F1A;}
        .mo-alerta{border:1px solid;border-radius:12px;padding:10px 12px;font-size:13px;margin-bottom:10px;}
        .mo-acoes{display:flex;gap:8px;flex-wrap:wrap;}
        .mo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:14px;}
        .mo-card{border:1px solid var(--bd2);border-radius:12px;padding:12px;font-size:13px;min-width:0;}
        .mo-card h5{font-family:'Outfit';font-size:13px;font-weight:800;margin:0 0 8px;text-transform:uppercase;letter-spacing:.4px;color:var(--sub);}
        .mo-lin{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed var(--bd2);}
        .mo-lin:last-child{border-bottom:none;}
        .mo-hist{max-height:240px;overflow:auto;display:grid;gap:6px;}
        .mo-hist div{border-left:3px solid var(--bd2);padding:2px 0 2px 8px;}
        .mo-entrega{word-break:break-all;background:var(--panel2);border-radius:8px;padding:8px;margin-top:6px;white-space:pre-wrap;max-height:160px;overflow:auto;}
        .mo-links{display:flex;gap:6px;flex-wrap:wrap;}
        .mo-links a,.mo-links button{font-size:12.5px;font-weight:800;border:1px solid var(--bd2);border-radius:9px;padding:6px 10px;color:var(--tx);text-decoration:none;background:none;cursor:pointer;}
      ` }} />

      <div className="mo-top">
        <h4 style={{ margin: 0 }}>Moderação do anúncio</h4>
        <span className="mo-pill" style={{ background: st[1] }}>{st[0]}</span>
        {m?.estado && <span className="mo-pill" style={{ background: m.estado === 'correcao' ? '#FFB020' : m.estado === 'cancelado' ? '#FF6B6B' : '#9AA0B4' }}>{ROTULO_ESTADO[m.estado]}</span>}
        <div className="mo-links" style={{ marginLeft: 'auto' }}>
          <a href={`/produto/${p.id}?previa=1`} target="_blank" rel="noreferrer">Ver anúncio ↗</a>
          <a href={`/checkout/${p.id}`} target="_blank" rel="noreferrer">Ver checkout ↗</a>
          {d.loja && <button type="button" onClick={() => setPerfil(true)}>Perfil do vendedor</button>}
        </div>
      </div>

      {!d.sql14 && <div className="mo-alerta" style={{ borderColor: '#FFC94D', color: '#FFC94D' }}>Rode o SQL 14 (moderação) no Supabase para liberar estas ações.</div>}

      {m?.estado && (
        <div className="mo-alerta" style={{ borderColor: m.estado === 'cancelado' ? '#FF6B6B' : '#FFB020' }}>
          <b>{ROTULO_ESTADO[m.estado]}</b> em {quando(m.em)}
          {m.itens?.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{m.itens.map((i: string) => <li key={i}>{rotuloItem(i)}</li>)}</ul>}
          {m.texto && <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>“{m.texto}”</div>}
          {m.estado === 'correcao' && p.status === 'em_revisao' && <div style={{ marginTop: 6, color: '#3DDC97', fontWeight: 800 }}>O vendedor já reenviou: confira as alterações na Fila de Aprovação.</div>}
        </div>
      )}

      {d.sql14 && !form && (
        <div className="mo-acoes">
          {(p.status !== 'ativo' || m?.estado) && (
            <button type="button" className="adm-btn ap" disabled={busy} onClick={() => executar('reativar')}>{travado || p.status === 'reprovado' ? 'Reativar (colocar no ar)' : 'Aprovar e colocar no ar'}</button>
          )}
          {ACOES.filter((x) => !(x.acao === 'pausar' && m?.estado === 'pausado_admin') && !(x.acao === 'cancelar' && m?.estado === 'cancelado')).map((x) => (
            <button key={x.acao} type="button" className="adm-btn" style={{ background: 'none', border: `1.5px solid ${x.cor}`, color: x.cor }} disabled={busy} onClick={() => setForm(x.acao)}>{x.rotulo}</button>
          ))}
        </div>
      )}
      {form && <FormMotivo acao={form} busy={busy} onCancelar={() => setForm(null)} onEnviar={(itens, texto) => executar(form, itens, texto)} />}

      <div className="mo-grid">
        <div className="mo-card">
          <h5>Anúncio</h5>
          <div className="mo-lin"><span>Preço</span><b>{money(p.preco)}</b></div>
          <div className="mo-lin"><span>Categoria</span><span>{p.categoria || '—'}</span></div>
          <div className="mo-lin"><span>Cadastrado</span><span>{quando(p.created_at)}</span></div>
          <div className="mo-lin"><span>Entrega</span><span>{p.tipo_entrega}{p.arquivo_nome ? ` · ${p.arquivo_nome}` : ''}</span></div>
          <div style={{ marginTop: 8 }}>
            <div className="mo-links">
              <button type="button" onClick={() => setVerEntrega(!verEntrega)}>{verEntrega ? 'Esconder conteúdo de entrega' : 'Ver conteúdo de entrega'}</button>
              {verEntrega && entregaLink && <a href={entregaLink} target="_blank" rel="noopener noreferrer nofollow">Testar link ↗</a>}
            </div>
            {verEntrega && <div className="mo-entrega">{p.conteudo_entrega || '(vazio)'}</div>}
          </div>
        </div>

        <div className="mo-card">
          <h5>Pedidos deste produto</h5>
          <div className="mo-lin"><span>Pagos</span><b>{d.pedidos.pagos} · {money(d.pedidos.faturamento)}</b></div>
          <div className="mo-lin"><span>Pix pendentes</span><span>{d.pedidos.pendentes}</span></div>
          <div className="mo-lin"><span>Reembolsados</span><span style={{ color: d.pedidos.reembolsados ? '#FF8A8A' : undefined }}>{d.pedidos.reembolsados}</span></div>
          {d.pedidos.ultimos.length > 0 && <div style={{ marginTop: 8 }}>{d.pedidos.ultimos.map((o: any) => (
            <div key={o.id} className="mo-lin" style={{ fontSize: 12 }}><span>{quando(o.em)}</span><span>{o.status} · {money(o.total)}</span></div>
          ))}</div>}
        </div>

        <div className="mo-card">
          <h5>Reclamações ({d.reclamacoes.length})</h5>
          {d.reclamacoes.length ? d.reclamacoes.map((c: any) => (
            <div key={c.id} className="mo-lin" style={{ flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, color: c.status === 'aberta' ? '#FF8A8A' : 'var(--sub)', fontWeight: 800 }}>{c.status} · {quando(c.em)}</span>
              <span>{c.texto}</span>
            </div>
          )) : <span className="muted">Nenhuma reclamação.</span>}
        </div>

        <div className="mo-card">
          <h5>Histórico</h5>
          <div className="mo-hist">
            {d.historico.length ? d.historico.map((h: any, i: number) => (
              <div key={i} style={{ borderLeftColor: h.tipo === 'moderacao' ? '#FFB020' : '#7C9CFF' }}>
                <b>{h.tipo === 'moderacao' ? ROTULO_ACAO[h.acao] ?? h.acao : `${h.quem} ${h.acao}`}</b>
                <span className="muted" style={{ fontSize: 11.5 }}> · {h.tipo === 'moderacao' && h.quem ? `por ${h.quem} · ` : ''}{quando(h.em)}</span>
                {h.tipo === 'moderacao' && h.itens?.length > 0 && <div style={{ fontSize: 12 }}>{h.itens.map(rotuloItem).join(' · ')}</div>}
                {h.tipo === 'moderacao' && h.texto && <div style={{ fontSize: 12 }} className="muted">“{String(h.texto).slice(0, 140)}”</div>}
                {h.tipo === 'edicao' && h.campos?.length > 0 && <div style={{ fontSize: 12 }} className="muted">{Array.from(new Set(h.campos.map((c: string) => CAMPO[c] ?? c))).join(', ')}</div>}
              </div>
            )) : <span className="muted">Sem registros ainda.</span>}
          </div>
        </div>
      </div>

      {perfil && d.loja && <PerfilVendedor storeId={d.loja.id} onClose={() => setPerfil(false)} />}
    </div>
  );
}
