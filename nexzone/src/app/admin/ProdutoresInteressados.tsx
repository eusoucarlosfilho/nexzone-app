'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { STATUS, TIPOS, formatarWhatsapp, linkWhatsapp, mensagemParaProdutor } from '@/lib/recrutamento';

// Admin → Produtores interessados (formulário da página /produtores) + configuração do Pixel/WhatsApp.
const dt = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const ROT_VENDE: Record<string, string> = { sim: 'Já vende', comecando: 'Começando', nao: 'Ainda não vende' };
const ROT_TIPO: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.id, t.rotulo]));
const COR: Record<string, string> = Object.fromEntries(STATUS.map((s) => [s.id, s.cor]));
const URL_PAGINA = 'https://compreibarato.com.br/produtores';

type Config = { whatsapp: string; pixel: string; teste: string; tokenDefinido: boolean; avisar?: string[]; avisarEmail?: boolean };

export default function ProdutoresInteressados({ onContagem }: { onContagem?: (n: number) => void }) {
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [d, setD] = useState<{ sql20: boolean; itens: any[]; contagem: Record<string, number>; config: Config | null }>({ sql20: true, itens: [], contagem: {}, config: null });
  const [carregando, setCarregando] = useState(true);
  const [abrirCfg, setAbrirCfg] = useState(false);
  const [cfg, setCfg] = useState({ whatsapp: '', pixel: '', teste: '', token: '', avisar: '', avisarEmail: true });
  const [salvando, setSalvando] = useState(false);
  const [notas, setNotas] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/admin/produtores?status=${filtro}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      setD({ sql20: j.sql20 !== false, itens: j.itens ?? [], contagem: j.contagem ?? {}, config: j.config ?? null });
      if (j.config) setCfg((c) => ({ ...c, whatsapp: j.config.whatsapp || '', pixel: j.config.pixel || '', teste: j.config.teste || '', avisar: (j.config.avisar || []).join(', '), avisarEmail: j.config.avisarEmail !== false }));
      onContagem?.(j.contagem?.novo ?? 0);
    } catch { toast('Falha ao carregar.', 'error'); }
    finally { setCarregando(false); }
  }, [filtro, onContagem]);
  useEffect(() => { carregar(); }, [carregar]);

  async function post(body: any) {
    const r = await fetch('/api/admin/produtores', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || 'Não foi possível salvar.', 'error'); return null; }
    return j;
  }

  async function mudarStatus(id: string, status: string) {
    const j = await post({ acao: 'status', id, status });
    if (j) { setD((x) => ({ ...x, itens: x.itens.map((i) => (i.id === id ? { ...i, status } : i)) })); toast('Status atualizado.', 'success'); carregar(); }
  }
  async function salvarNotas(id: string) {
    if (notas[id] === undefined) return;
    const j = await post({ acao: 'notas', id, notas: notas[id] });
    if (j) toast('Anotação salva.', 'success');
  }
  async function salvarConfig(extra: any = {}) {
    setSalvando(true);
    try {
      const j = await post({ acao: 'config', whatsapp: cfg.whatsapp, pixel: cfg.pixel, teste: cfg.teste, token: cfg.token, avisar: cfg.avisar, avisarEmail: cfg.avisarEmail, ...extra });
      if (j) { setD((x) => ({ ...x, config: j.config })); setCfg((c) => ({ ...c, token: '' })); toast('Configuração salva.', 'success'); }
    } finally { setSalvando(false); }
  }

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase().replace(/^@/, '');
    if (!q) return d.itens;
    return d.itens.filter((i) => [i.nome, i.whatsapp, i.email, i.instagram, i.nicho].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [d.itens, busca]);

  function baixarCsv() {
    const esc = (s: unknown) => { const t = String(s ?? ''); return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const linhas = [['Data', 'Status', 'Etapa', 'Nome', 'WhatsApp', 'E-mail', 'Instagram', 'Nicho', 'O que vende', 'Já vende', 'Onde vende', 'Faturamento', 'Link', 'Campanha', 'Anúncio', 'Origem', 'Anotações'].join(';')];
    for (const i of lista) linhas.push([dt(i.criado_em), i.status, i.etapa === 2 ? 'completo' : 'só etapa 1', i.nome, '+' + i.whatsapp, i.email, i.instagram ? '@' + i.instagram : '', i.nicho, (i.tipos || []).map((t: string) => ROT_TIPO[t] || t).join(', '),
      ROT_VENDE[i.ja_vende] || '', (i.plataformas || []).join(', '), i.faturamento, i.link_produto, i.origem?.utm_campaign, i.origem?.utm_content, i.origem?.utm_source, i.notas].map(esc).join(';'));
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'produtores_interessados.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const copiar = (t: string) => { try { navigator.clipboard.writeText(t); toast('Copiado.', 'success'); } catch { toast(t, 'info' as any); } };
  const c = d.contagem;
  const config = d.config;
  const pendencias = [!config?.whatsapp && 'WhatsApp da equipe', !config?.pixel && 'ID do Pixel', !config?.avisar?.length && 'número para avisos no WhatsApp', !config?.tokenDefinido && 'token da API de Conversões'].filter(Boolean) as string[];

  if (!d.sql20) return <div className="adm-card"><b>Rode o SQL 20</b> no Supabase para ativar o formulário de produtores.</div>;

  return (
    <div className="pi">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="adm-card pi-topo">
        <div className="pi-link">
          <div><small>Página para os anúncios</small><b>{URL_PAGINA}</b></div>
          <button className="adm-btn rp" onClick={() => copiar(`${URL_PAGINA}?utm_source=meta&utm_medium=pago&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`)}><Icon name="copy" size={14} /> Copiar link com UTM do Meta</button>
          <a className="adm-btn rp" href="/produtores" target="_blank" rel="noreferrer"><Icon name="eye" size={14} /> Abrir página</a>
          <button className="adm-btn rp" onClick={() => setAbrirCfg((v) => !v)}><Icon name="settings" size={14} /> Pixel e WhatsApp</button>
        </div>
        {pendencias.length > 0 && !abrirCfg && <p className="pi-aviso"><Icon name="alert" size={14} /> Falta configurar: {pendencias.join(', ')}.</p>}
        {abrirCfg && (
          <div className="pi-cfg">
            <label><span>WhatsApp que recebe os produtores</span><input value={cfg.whatsapp} onChange={(e) => setCfg({ ...cfg, whatsapp: e.target.value })} placeholder="5563999998888" inputMode="numeric" /><em>55 + DDD + número. Aparece no botão da página de obrigado.</em></label>
            <label><span>Avisar no WhatsApp a cada cadastro</span><input value={cfg.avisar} onChange={(e) => setCfg({ ...cfg, avisar: e.target.value })} placeholder="5563999998888, 5563988887777" inputMode="tel" /><em>Até 3 números (você e o César), separados por vírgula. Chega no celular na hora, pela conexão de WhatsApp do site. Use números diferentes do que está conectado.</em></label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={cfg.avisarEmail} onChange={(e) => setCfg({ ...cfg, avisarEmail: e.target.checked })} style={{ width: 18, height: 18 }} /><span style={{ margin: 0 }}>Também avisar por e-mail (e-mail de suporte das Configurações)</span></label>
            <label><span>ID do Pixel do Meta</span><input value={cfg.pixel} onChange={(e) => setCfg({ ...cfg, pixel: e.target.value })} placeholder="123456789012345" inputMode="numeric" /><em>Gerenciador de Eventos → Fontes de dados → seu pixel.</em></label>
            <label><span>Token da API de Conversões {config?.tokenDefinido && <b className="pi-ok">✓ configurado</b>}</span><input type="password" value={cfg.token} onChange={(e) => setCfg({ ...cfg, token: e.target.value })} placeholder={config?.tokenDefinido ? 'Deixe em branco para manter o atual' : 'Cole o token gerado no Gerenciador de Eventos'} autoComplete="off" /><em>Fica guardado criptografado. Nunca aparece de novo na tela.</em></label>
            <label><span>Código de teste <small>(opcional)</small></span><input value={cfg.teste} onChange={(e) => setCfg({ ...cfg, teste: e.target.value })} placeholder="TEST12345" /><em>Só para conferir em "Testar eventos". Apague depois de testar.</em></label>
            <div className="pi-cfg-b">
              <button className="adm-btn ap" disabled={salvando} onClick={() => salvarConfig()}>{salvando ? 'Salvando…' : 'Salvar'}</button>
              {config?.tokenDefinido && <button className="adm-btn rp" disabled={salvando} onClick={() => { if (confirm('Remover o token da API de Conversões?')) salvarConfig({ token: '', limparToken: true }); }}>Remover token</button>}
            </div>
          </div>
        )}
      </div>

      <div className="pi-kpis">
        <div><small>Total</small><b>{c.todos || 0}</b></div>
        <div><small>Cadastro completo</small><b>{c.completos || 0}</b></div>
        <div><small>Esperando contato</small><b className="or">{c.novo || 0}</b></div>
        <div><small>Cadastraram loja</small><b>{(c.cadastrou || 0) + (c.vendendo || 0)}</b></div>
        <div><small>Já vendendo</small><b className="vd">{c.vendendo || 0}</b></div>
      </div>

      <div className="adm-filters pi-fil">
        {[['todos', 'Todos'], ...STATUS.map((s) => [s.id, s.rotulo])].map(([id, r]) => (
          <button key={id} className={`adm-fb ${filtro === id ? 'on' : ''}`} onClick={() => setFiltro(id)}>{r}{id !== 'todos' && c[id] ? ` (${c[id]})` : ''}</button>
        ))}
        <input className="pi-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, @, nicho…" />
        <button className="adm-btn rp" onClick={baixarCsv} disabled={!lista.length}><Icon name="download" size={14} /> CSV</button>
      </div>

      {carregando ? <div className="adm-empty">Carregando…</div> : !lista.length ? (
        <div className="adm-card adm-empty">{d.itens.length ? 'Nada encontrado nessa busca.' : 'Nenhum lojista ainda. Assim que alguém preencher o formulário, aparece aqui (e no sino).'}</div>
      ) : lista.map((i) => (
        <div key={i.id} className="adm-card pi-item" style={{ borderLeft: `3px solid ${COR[i.status] || '#888'}` }}>
          <div className="pi-l1">
            <div className="pi-quem">
              <b>{i.nome}</b>
              <span>{formatarWhatsapp(i.whatsapp)}{i.instagram && <> · <a href={`https://instagram.com/${i.instagram}`} target="_blank" rel="noreferrer">@{i.instagram}</a></>}{i.email && <> · {i.email}</>}</span>
            </div>
            <div className="pi-acoes">
              <a className="adm-btn ap" href={linkWhatsapp(i.whatsapp, mensagemParaProdutor(i.nome, i.nicho))} target="_blank" rel="noreferrer" onClick={() => { if (i.status === 'novo') mudarStatus(i.id, 'conversando'); }}><Icon name="chat" size={14} /> WhatsApp</a>
              <select value={i.status} onChange={(e) => mudarStatus(i.id, e.target.value)} style={{ color: COR[i.status] }}>
                {STATUS.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
              </select>
            </div>
          </div>
          <div className="pi-tags">
            <span className={`pi-tag ${i.etapa === 2 ? 'ok' : 'meio'}`}>{i.etapa === 2 ? 'Cadastro completo' : 'Parou na 1ª etapa'}</span>
            {i.nicho && <span className="pi-tag">{i.nicho}</span>}
            {(i.tipos || []).map((t: string) => <span className="pi-tag" key={t}>{ROT_TIPO[t] || t}</span>)}
            {i.ja_vende && <span className="pi-tag">{ROT_VENDE[i.ja_vende]}{i.plataformas?.length ? `: ${i.plataformas.join(', ')}` : ''}</span>}
            {i.faturamento && <span className="pi-tag forte">{i.faturamento}</span>}
          </div>
          <div className="pi-meta">
            <span>{dt(i.criado_em)}</span>
            {(i.origem?.utm_campaign || i.origem?.utm_source) && <span>Origem: {[i.origem.utm_source, i.origem.utm_campaign, i.origem.utm_content].filter(Boolean).join(' · ')}</span>}
            {i.link_produto && <a href={i.link_produto} target="_blank" rel="noreferrer nofollow">Ver produto ↗</a>}
          </div>
          <textarea className="pi-notas" rows={1} placeholder="Anotações (ex.: retornar segunda, vende planilhas na Kiwify)…" defaultValue={i.notas || ''}
            onChange={(e) => setNotas((n) => ({ ...n, [i.id]: e.target.value }))} onBlur={() => salvarNotas(i.id)} maxLength={3000} />
        </div>
      ))}
    </div>
  );
}

const CSS = `
.pi-topo{padding:16px 18px}
.pi-link{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pi-link>div{flex:1 1 260px;min-width:0}
.pi-link small{display:block;color:var(--sub);font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
.pi-link b{font-size:15px;overflow-wrap:anywhere}
.pi-link .adm-btn{display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.pi-aviso{margin:12px 0 0;color:#FFB27A;font-size:13px;font-weight:700;display:flex;gap:6px;align-items:center}
.pi-cfg{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:16px;padding-top:16px;border-top:1px solid var(--bd2)}
.pi-cfg label{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:800}
.pi-cfg input{height:42px;border-radius:11px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 12px;font-size:14px;font-weight:700}
.pi-cfg em{font-style:normal;color:var(--sub);font-size:12px;font-weight:600}
.pi-cfg small{color:var(--sub)}
.pi-ok{color:#20C98A;font-size:12px;margin-left:6px}
.pi-cfg-b{display:flex;gap:8px;align-items:flex-end}
.pi-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px}
.pi-kpis>div{background:var(--panel);border:1px solid var(--bd2);border-radius:16px;padding:14px 16px}
.pi-kpis small{display:block;color:var(--sub);font-size:12px;font-weight:800}
.pi-kpis b{font-family:'Outfit';font-size:26px;font-weight:900}
.pi-kpis b.or{color:#FF9A3C}.pi-kpis b.vd{color:#20C98A}
.pi-fil{flex-wrap:wrap;align-items:center}
.pi-busca{flex:1 1 200px;height:38px;border-radius:50px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 14px;font-size:14px;font-weight:700;min-width:0}
.pi-fil .adm-btn{display:inline-flex;align-items:center;gap:6px}
.pi-item{padding:16px 18px}
.pi-l1{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pi-quem{min-width:0}
.pi-quem b{font-family:'Outfit';font-size:17px;display:block}
.pi-quem span{color:var(--sub);font-size:13px;overflow-wrap:anywhere}
.pi-quem a{color:var(--or2)}
.pi-acoes{display:flex;gap:8px;align-items:center}
.pi-acoes .adm-btn{display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.pi-acoes select{height:36px;border-radius:10px;border:1.5px solid var(--bd2);background:var(--panel2);font-weight:900;padding:0 8px}
.pi-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.pi-tag{font-size:12px;font-weight:800;padding:4px 10px;border-radius:50px;background:var(--panel2);color:var(--sub)}
.pi-tag.ok{background:#00B87A22;color:#20C98A}.pi-tag.meio{background:#FF7A1422;color:#FF9A3C}.pi-tag.forte{color:var(--tx)}
.pi-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;color:var(--sub);font-size:12.5px;font-weight:700}
.pi-meta a{color:var(--or2)}
.pi-notas{width:100%;margin-top:10px;border-radius:11px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:8px 10px;font-size:13.5px;resize:vertical;min-height:38px;font-family:inherit}
`;
