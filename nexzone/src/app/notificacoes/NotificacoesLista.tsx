'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { FILTROS, ICONE_TIPO, quandoFoi, type Notificacao } from '@/lib/notificacoesCentral';
import { atualizarNotificacoes } from '@/components/NotificacoesSino';

const POR_PAGINA = 20;

function dia(iso: string) {
  const d = new Date(iso); const hoje = new Date(); const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

export default function NotificacoesLista() {
  const [filtro, setFiltro] = useState('todas');
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [sql17, setSql17] = useState(true);
  const [erro, setErro] = useState(false);
  const router = useRouter();

  const carregar = useCallback(async (antes?: number) => {
    setCarregando(true); setErro(false);
    try {
      const qs = new URLSearchParams({ limite: String(POR_PAGINA), filtro });
      if (antes) qs.set('antes', String(antes));
      if (soNaoLidas) qs.set('nao_lidas', '1');
      const r = await fetch(`/api/notificacoes?${qs}`, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setSql17(d.sql17 !== false);
      setItens((v) => (antes ? [...v, ...(d.itens ?? [])] : (d.itens ?? [])));
      setTemMais(!!d.temMais); setNaoLidas(d.naoLidas ?? 0);
    } catch { setErro(true); }
    finally { setCarregando(false); }
  }, [filtro, soNaoLidas]);

  useEffect(() => { carregar(); }, [carregar]);

  async function acao(corpo: any) {
    const r = await fetch('/api/notificacoes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.error || 'Não foi possível salvar.', 'error'); return false; }
    if (typeof d.naoLidas === 'number') setNaoLidas(d.naoLidas);
    atualizarNotificacoes();
    return true;
  }
  async function lerTodas() {
    const agora = new Date().toISOString();
    if (await acao({ acao: 'ler_todas' })) {
      setItens((v) => (soNaoLidas ? [] : v.map((i) => (i.lida_em ? i : { ...i, lida_em: agora }))));
      toast('Tudo marcado como lido.', 'success');
    }
  }
  async function abrir(n: Notificacao) {
    if (!n.lida_em) {
      setItens((v) => v.map((i) => (i.id === n.id ? { ...i, lida_em: new Date().toISOString() } : i)));
      acao({ acao: 'ler', ids: [n.id] });
    }
    if (n.link) router.push(n.link);
  }
  async function apagar(n: Notificacao) {
    if (await acao({ acao: 'apagar', ids: [n.id] })) setItens((v) => v.filter((i) => i.id !== n.id));
  }

  // agrupa por dia
  const grupos: { dia: string; itens: Notificacao[] }[] = [];
  for (const i of itens) {
    const d = dia(i.created_at);
    const g = grupos[grupos.length - 1];
    if (g && g.dia === d) g.itens.push(i); else grupos.push({ dia: d, itens: [i] });
  }

  return (
    <div className="ntf">
      <style dangerouslySetInnerHTML={{ __html: `
        .ntf-top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
        .ntf-top h1{margin:0}
        .ntf-filtros{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:14px;scrollbar-width:none}
        .ntf-filtros::-webkit-scrollbar{display:none}
        .ntf-filtros .btn{white-space:nowrap}
        .ntf-dia{font-size:12px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin:18px 4px 8px}
        .ntf-lista{background:#fff;border:1px solid var(--border);border-radius:18px;overflow:hidden}
        .ntf-it{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid var(--border);position:relative}
        .ntf-it:last-child{border-bottom:0}
        .ntf-it.nova{background:#FFF8F3}
        .ntf-it button.ntf-corpo{all:unset;cursor:pointer;display:flex;gap:12px;flex:1;min-width:0}
        .ntf-it button.ntf-corpo:focus-visible{outline:2px solid var(--orange);outline-offset:4px;border-radius:8px}
        .ntf-ic{width:38px;height:38px;border-radius:12px;background:var(--soft);color:var(--orange-ink);display:flex;align-items:center;justify-content:center;flex:none}
        .ntf-ic.t-venda,.ntf-ic.t-compra,.ntf-ic.t-saque{background:#E7F8F0;color:#0A8A5A}
        .ntf-ic.t-advertencia,.ntf-ic.t-reembolso{background:#FDECEC;color:#B42318}
        .ntf-ic.t-novidade,.ntf-ic.t-aviso{background:#EAF2FF;color:#1F4E8A}
        .ntf-tx{display:flex;flex-direction:column;gap:2px;min-width:0}
        .ntf-tx b{font-size:15px}
        .ntf-tx span{color:var(--sub);font-size:14px;overflow-wrap:anywhere;white-space:pre-wrap}
        .ntf-tx small{color:var(--muted);font-weight:700;font-size:12px}
        .ntf-ponto{width:9px;height:9px;border-radius:50%;background:var(--orange);flex:none;margin-top:6px}
        .ntf-x{flex:none;width:34px;height:34px;border-radius:10px;border:0;background:none;color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:.6}
        .ntf-x:hover{background:var(--soft);opacity:1;color:var(--text)}
        .ntf-vazio{text-align:center;padding:44px 20px;color:var(--sub)}
        .ntf-vazio b{display:block;color:var(--text);font-family:'Outfit';font-size:18px;margin:10px 0 4px}
        .ntf-chk{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:800;color:var(--sub);cursor:pointer}
      ` }} />
      <div className="ntf-top">
        <div>
          <h1>Notificações</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{naoLidas ? `${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Tudo em dia.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="ntf-chk"><input type="checkbox" checked={soNaoLidas} onChange={(e) => setSoNaoLidas(e.target.checked)} /> Só não lidas</label>
          {naoLidas > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={lerTodas}><Icon name="check" size={16} /> Marcar todas como lidas</button>}
        </div>
      </div>
      <nav className="ntf-filtros" aria-label="Filtrar notificações">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" className={`btn btn-sm ${filtro === f.id ? 'btn-pri' : 'btn-ghost'}`} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.rotulo}</button>
        ))}
      </nav>

      {!sql17 ? (
        <div className="ntf-lista ntf-vazio"><Icon name="bell" size={30} /><b>Em breve</b>As notificações estão sendo ativadas.</div>
      ) : erro && !itens.length ? (
        <div className="ntf-lista ntf-vazio"><b>Não foi possível carregar</b><button type="button" className="btn btn-ghost btn-sm" onClick={() => carregar()}>Tentar de novo</button></div>
      ) : !carregando && !itens.length ? (
        <div className="ntf-lista ntf-vazio">
          <Icon name="bell" size={30} />
          <b>{soNaoLidas || filtro !== 'todas' ? 'Nada neste filtro' : 'Nenhuma notificação ainda'}</b>
          Vendas, compras, mensagens, respostas e avisos da equipe aparecem aqui.
          <div style={{ marginTop: 14 }}><Link href="/produtos" className="btn btn-ghost btn-sm">Explorar produtos</Link></div>
        </div>
      ) : (
        <>
          {grupos.map((g) => (
            <section key={g.dia}>
              <div className="ntf-dia">{g.dia}</div>
              <ul className="ntf-lista" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {g.itens.map((i) => (
                  <li key={i.id} className={`ntf-it ${i.lida_em ? '' : 'nova'}`}>
                    <button type="button" className="ntf-corpo" onClick={() => abrir(i)}>
                      <span className={`ntf-ic t-${i.tipo}`} aria-hidden="true"><Icon name={ICONE_TIPO[i.tipo] || 'bell'} size={18} /></span>
                      <span className="ntf-tx">
                        <b>{i.titulo}</b>
                        {i.texto && <span>{i.texto}</span>}
                        <small>{quandoFoi(i.created_at)} · {new Date(i.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
                      </span>
                    </button>
                    {!i.lida_em && <i className="ntf-ponto" aria-label="não lida" />}
                    <button type="button" className="ntf-x" aria-label="Apagar notificação" title="Apagar" onClick={() => apagar(i)}><Icon name="trash" size={16} /></button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {carregando && <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>Carregando…</p>}
          {temMais && !carregando && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => carregar(itens[itens.length - 1]?.id)}>Carregar mais</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
