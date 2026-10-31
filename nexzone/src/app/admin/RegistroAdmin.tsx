'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { ACOES, GRUPOS, corDoAdmin, descreverAcao, haQuanto, type Registro } from '@/lib/registroAdmin';

// Admin → Registro: tudo que cada admin fez (aprovou, mandou mensagem, mudou status, pagou saque…).
// Só leitura: ninguém edita nem apaga um registro (o banco bloqueia, SQL 34).
const ROT_GRUPO: Record<string, string> = Object.fromEntries(GRUPOS.map((g) => [g.id, g.rotulo]));
const COR_GRUPO: Record<string, string> = { aprovacao: '#20C98A', mensagens: '#4C8DFF', lojistas: '#FF7A14', usuarios: '#9B6BFF', financeiro: '#E8457A', config: '#8A8AA0' };
const PERIODOS: [number, string][] = [[1, 'Hoje (24 h)'], [7, '7 dias'], [30, '30 dias'], [90, '90 dias']];
const dia = (s: string) => new Date(s).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
const hora = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

type Resp = { sql34: boolean; eu?: string; admins: { id: string; nome: string }[]; resumo: { id: string; nome: string; total: number; grupos: Record<string, number> }[]; itens: Registro[]; proximo: number | null };

export default function RegistroAdmin() {
  const [quem, setQuem] = useState('todos');
  const [grupo, setGrupo] = useState('todos');
  const [dias, setDias] = useState(7);
  const [busca, setBusca] = useState('');
  const [d, setD] = useState<Resp>({ sql34: true, admins: [], resumo: [], itens: [], proximo: null });
  const [carregando, setCarregando] = useState(true);
  const [mais, setMais] = useState(false);

  const url = useCallback((antes?: number | null) => `/api/admin/registro?admin=${quem}&grupo=${grupo}&dias=${dias}${antes ? `&antes=${antes}` : ''}`, [quem, grupo, dias]);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const j = await (await fetch(url(), { credentials: 'include', cache: 'no-store' })).json();
      setD({ sql34: j.sql34 !== false, eu: j.eu, admins: j.admins ?? [], resumo: j.resumo ?? [], itens: j.itens ?? [], proximo: j.proximo ?? null });
    } catch { toast('Falha ao carregar o registro.', 'error'); }
    finally { setCarregando(false); }
  }, [url]);
  useEffect(() => { carregar(); }, [carregar]);

  async function carregarMais() {
    if (!d.proximo) return;
    setMais(true);
    try {
      const j = await (await fetch(url(d.proximo), { credentials: 'include', cache: 'no-store' })).json();
      setD((x) => ({ ...x, itens: [...x.itens, ...(j.itens ?? [])], proximo: j.proximo ?? null }));
    } catch { toast('Falha ao carregar.', 'error'); }
    finally { setMais(false); }
  }

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return d.itens;
    return d.itens.filter((r) => [r.admin_nome, r.alvo_nome, descreverAcao(r), JSON.stringify(r.detalhes || {})].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [d.itens, busca]);

  // Agrupa por dia para ficar fácil de ler
  const porDia = useMemo(() => {
    const m: { dia: string; itens: Registro[] }[] = [];
    for (const r of lista) {
      const k = dia(r.criado_em);
      if (!m.length || m[m.length - 1].dia !== k) m.push({ dia: k, itens: [] });
      m[m.length - 1].itens.push(r);
    }
    return m;
  }, [lista]);

  if (!d.sql34) return <div className="adm-card"><b>Rode o SQL 34</b> no Supabase para começar a registrar quem fez cada ação no admin. A partir daí, cada aprovação, mensagem, mudança de status, saque e reembolso fica gravada com o nome de quem fez.</div>;

  return (
    <div className="ra">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ra-resumo">
        {d.resumo.length ? d.resumo.map((r) => (
          <button key={r.id} className={`ra-pessoa ${quem === r.id ? 'on' : ''}`} onClick={() => setQuem(quem === r.id ? 'todos' : r.id)} style={{ borderColor: quem === r.id ? corDoAdmin(r.id) : undefined }}>
            <span className="ra-av" style={{ background: corDoAdmin(r.id) }}>{r.nome.charAt(0)}</span>
            <div>
              <b>{r.nome}{r.id === d.eu ? ' (você)' : ''}</b>
              <small>{r.total} {r.total === 1 ? 'ação' : 'ações'} · {Object.entries(r.grupos).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g, n]) => `${n} ${String(ROT_GRUPO[g] || g).toLowerCase()}`).join(' · ')}</small>
            </div>
          </button>
        )) : !carregando && <div className="adm-card adm-empty" style={{ flex: 1 }}>Nenhuma ação registrada nesse período.</div>}
      </div>

      <div className="adm-filters ra-fil">
        <select value={quem} onChange={(e) => setQuem(e.target.value)}>
          <option value="todos">Todos os admins</option>
          {d.admins.map((a) => <option key={a.id} value={a.id}>{a.nome}{a.id === d.eu ? ' (você)' : ''}</option>)}
        </select>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          {PERIODOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
        <input className="ra-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, anúncio, lojista…" />
        <button className="adm-btn rp" onClick={carregar} title="Atualizar"><Icon name="undo" size={14} /> Atualizar</button>
      </div>
      <div className="adm-filters ra-fil">
        {[['todos', 'Tudo'], ...GRUPOS.map((g) => [g.id, g.rotulo])].map(([id, r]) => (
          <button key={id} className={`adm-fb ${grupo === id ? 'on' : ''}`} onClick={() => setGrupo(id)}>{r}</button>
        ))}
      </div>

      {carregando ? <div className="adm-empty">Carregando…</div> : !lista.length ? (
        <div className="adm-card adm-empty">{busca ? 'Nada encontrado nessa busca.' : 'Nenhuma ação nesse filtro.'}</div>
      ) : (
        <div className="adm-card ra-lista">
          {porDia.map((g) => (
            <div key={g.dia}>
              <div className="ra-dia">{g.dia}</div>
              {g.itens.map((r) => {
                const grp = ACOES[r.acao]?.grupo || 'config';
                const det = r.detalhes || {};
                const extra = det.texto || det.motivo || det.resposta || det.trecho;
                return (
                  <div key={r.id} className="ra-item">
                    <span className="ra-h">{hora(r.criado_em)}</span>
                    <span className="ra-dot" style={{ background: COR_GRUPO[grp] }} title={ROT_GRUPO[grp]} />
                    <div className="ra-t">
                      <b style={{ color: corDoAdmin(r.admin_id) }}>{r.admin_nome || 'Admin'}</b> {descreverAcao(r)}
                      {extra && <div className="ra-x">“{String(extra).slice(0, 180)}”</div>}
                    </div>
                    <span className="ra-ha">{haQuanto(r.criado_em)}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {d.proximo && <button className="adm-btn rp ra-mais" disabled={mais} onClick={carregarMais}>{mais ? 'Carregando…' : 'Ver mais antigos'}</button>}
        </div>
      )}
    </div>
  );
}

const CSS = `
.ra-resumo{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.ra-pessoa{flex:1 1 240px;display:flex;gap:12px;align-items:center;text-align:left;background:var(--panel);border:1.5px solid var(--bd2);border-radius:16px;padding:12px 14px;color:var(--tx);cursor:pointer;min-width:0}
.ra-pessoa.on{background:var(--panel2)}
.ra-pessoa b{display:block;font-family:'Outfit';font-size:16px}
.ra-pessoa small{display:block;color:var(--sub);font-size:12px;font-weight:700;overflow-wrap:anywhere}
.ra-av{width:38px;height:38px;border-radius:50%;color:#fff;font-family:'Outfit';font-weight:900;font-size:17px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-transform:uppercase}
.ra-fil{flex-wrap:wrap;align-items:center}
.ra-fil select{height:38px;border-radius:50px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 12px;font-size:13.5px;font-weight:800}
.ra-busca{flex:1 1 200px;height:38px;border-radius:50px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 14px;font-size:14px;font-weight:700;min-width:0}
.ra-fil .adm-btn{display:inline-flex;align-items:center;gap:6px}
.ra-lista{padding:6px 18px 16px}
.ra-dia{font-size:11.5px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:var(--sub);padding:14px 0 6px;border-bottom:1px solid var(--bd2)}
.ra-item{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--bd2);font-size:14px}
.ra-h{color:var(--sub);font-weight:800;font-size:12.5px;width:42px;flex-shrink:0;padding-top:1px}
.ra-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:6px}
.ra-t{flex:1;min-width:0;overflow-wrap:anywhere;line-height:1.45}
.ra-x{color:var(--sub);font-size:12.5px;margin-top:2px}
.ra-ha{color:var(--sub);font-size:11.5px;font-weight:700;white-space:nowrap;padding-top:2px}
.ra-mais{margin-top:14px;width:100%}
@media(max-width:700px){.ra-ha{display:none}.ra-lista{padding:4px 12px 12px}}
`;
