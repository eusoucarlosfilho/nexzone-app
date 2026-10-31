'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import DialogoSite from '@/components/DialogoSite';
import { FaixaCampanha, BannerCampanha } from '@/components/CampanhaSite';
import { TEMAS, promptDaImagem, situacao, type Campanha, type DataSazonal } from '@/lib/campanhasSite';

// Admin › Campanhas e ofertas: faixa no topo do site e banner da home, com início e fim.
// Calendário com as próximas datas (varejo e gamer) e campanha sugerida: título, texto, link e prompt da imagem.
type Linha = Campanha & { id: number; intencao?: string | null };
const ROT_SIT = { no_ar: ['No ar', '#0E9F6E'], agendada: ['Agendada', '#4C8DFF'], encerrada: ['Encerrada', '#8A8AA0'], pausada: ['Pausada', '#B7791F'] } as const;
// ISO ↔ campo datetime-local no horário de Brasília
const paraCampo = (iso: string) => (iso ? new Date(Date.parse(iso) - 3 * 3600000).toISOString().slice(0, 16) : '');
const doCampo = (v: string) => (v ? new Date(`${v}:00-03:00`).toISOString() : '');
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' });
const VAZIA = { id: 0, formato: 'faixa' as const, titulo: '', mensagem: '', botao: '', link: '', imagem_url: '', imagem_mobile_url: '', tema: 'laranja', intencao: '', inicio: '', fim: '', ativa: true, prioridade: 0 };

export default function CampanhasAdmin() {
  const [d, setD] = useState<{ sql36: boolean; campanhas: Linha[]; datas: DataSazonal[] } | null>(null);
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [excluir, setExcluir] = useState<Linha | null>(null);
  const [verPrompt, setVerPrompt] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/campanhas-site', { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setD(j); else toast(j.error || 'Falha ao carregar.', 'error');
    } catch { toast('Sem conexão.', 'error'); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function post(corpo: any, ok: string) {
    setBusy(corpo.acao + (corpo.id || ''));
    try {
      const r = await fetch('/api/admin/campanhas-site', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível.', 'error'); return false; }
      toast(ok, 'success'); carregar(); return true;
    } finally { setBusy(''); }
  }
  async function salvar() {
    const corpo = { acao: 'salvar', ...f, id: f.id || undefined, inicio: doCampo(f.inicio), fim: doCampo(f.fim) };
    if (await post(corpo, f.id ? 'Campanha atualizada.' : 'Campanha criada.')) setF(null);
  }
  async function subir(campo: 'imagem_url' | 'imagem_mobile_url', arquivo: File | undefined) {
    if (!arquivo) return;
    setBusy(campo);
    try {
      const fd = new FormData(); fd.set('arquivo', arquivo);
      const r = await fetch('/api/admin/campanhas-site/imagem', { method: 'POST', credentials: 'include', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível enviar.', 'error'); return; }
      setF((x: any) => ({ ...x, [campo]: j.url })); toast('Imagem enviada.', 'success');
    } finally { setBusy(''); }
  }
  function usarSugestao(s: DataSazonal) {
    setF({ ...VAZIA, ...s.sugestao, id: 0, inicio: paraCampo(s.comeca), fim: paraCampo(s.termina), imagem_url: '', imagem_mobile_url: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const copiar = (t: string) => navigator.clipboard?.writeText(t).then(() => toast('Prompt copiado.', 'success')).catch(() => toast('Não deu para copiar.', 'error'));

  if (!d) return <div className="adm-card">Carregando campanhas…</div>;
  const previa: Campanha | null = f && f.titulo ? { ...f, inicio: doCampo(f.inicio) || new Date().toISOString(), fim: doCampo(f.fim) || new Date(Date.now() + 30 * 86400000).toISOString() } : null;

  return (
    <div className="cpa">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {!d.sql36 && <div className="adm-card" style={{ color: '#B45309', fontWeight: 800 }}>Rode o SQL 36 no Supabase para criar campanhas.</div>}

      {/* formulário */}
      {f ? (
        <div className="adm-card">
          <h3 className="cpa-h">{f.id ? 'Editar campanha' : 'Nova campanha'}</h3>
          <div className="cpa-g">
            <label><span>Onde aparece</span>
              <div className="cpa-op">
                {[['faixa', 'Faixa no topo de todas as páginas'], ['banner', 'Banner grande no topo da home']].map(([v, r]) => (
                  <button type="button" key={v} className={f.formato === v ? 'on' : ''} onClick={() => setF({ ...f, formato: v })}>{r}</button>
                ))}
              </div></label>
            <label><span>Cores</span>
              <select value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })}>{Object.entries(TEMAS).map(([k, t]) => <option key={k} value={k}>{t.rotulo}</option>)}</select></label>
            <label className="cpa-full"><span>Título <small>({f.titulo.length}/90)</small></span><input value={f.titulo} maxLength={90} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Natal Gamer: o presente chega na hora" /></label>
            <label className="cpa-full"><span>Mensagem <small>(opcional, {String(f.mensagem || '').length}/220)</small></span><input value={f.mensagem || ''} maxLength={220} onChange={(e) => setF({ ...f, mensagem: e.target.value })} placeholder="Uma frase curta que explica a oferta" /></label>
            <label><span>Texto do botão <small>(opcional)</small></span><input value={f.botao || ''} maxLength={30} onChange={(e) => setF({ ...f, botao: e.target.value })} placeholder="Ver ofertas" /></label>
            <label><span>Para onde leva <small>(página do site)</small></span><input value={f.link || ''} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="/produtos?q=gift card  ou  /jogo/free-fire" /></label>
            <label><span>Começa (Brasília)</span><input type="datetime-local" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></label>
            <label><span>Termina</span><input type="datetime-local" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></label>
            {f.formato === 'banner' && (
              <>
                <label><span>Imagem do computador <small>(1920 × 600, até 3 MB)</small></span>
                  <div className="cpa-up">{f.imagem_url ? <img src={f.imagem_url} alt="" /> : null}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => subir('imagem_url', e.target.files?.[0])} disabled={!!busy} />{f.imagem_url && <button type="button" onClick={() => setF({ ...f, imagem_url: '' })}>tirar</button>}</div></label>
                <label><span>Imagem do celular <small>(1080 × 1080, opcional)</small></span>
                  <div className="cpa-up">{f.imagem_mobile_url ? <img src={f.imagem_mobile_url} alt="" /> : null}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => subir('imagem_mobile_url', e.target.files?.[0])} disabled={!!busy} />{f.imagem_mobile_url && <button type="button" onClick={() => setF({ ...f, imagem_mobile_url: '' })}>tirar</button>}</div></label>
                <p className="cpa-dica cpa-full">Sem imagem, o banner aparece só com o texto nas cores escolhidas (já fica bonito). Com imagem, o texto precisa estar escrito na própria arte.</p>
              </>
            )}
            <label className="cpa-full"><span>Intenção <small>(anotação interna: para que serve esta campanha)</small></span><input value={f.intencao || ''} maxLength={500} onChange={(e) => setF({ ...f, intencao: e.target.value })} placeholder="Ex.: vender gift card como presente de última hora" /></label>
            <label><span>Prioridade <small>(0 a 100; com duas no ar ao mesmo tempo, vence a maior)</small></span><input type="number" min={0} max={100} value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value })} /></label>
            <label className="cpa-chk"><input type="checkbox" checked={f.ativa} onChange={(e) => setF({ ...f, ativa: e.target.checked })} /> Ligada (entra no ar sozinha na data de início)</label>
          </div>
          {previa && (
            <div className="cpa-prev">
              <small>Prévia</small>
              {previa.formato === 'faixa' ? <FaixaCampanha c={previa} /> : <BannerCampanha c={previa} />}
            </div>
          )}
          <div className="cpa-bts">
            <button className="adm-btn ap" disabled={!!busy || !d.sql36} onClick={salvar}>{f.id ? 'Salvar alterações' : 'Criar campanha'}</button>
            <button className="adm-btn rp" onClick={() => setF(null)}>Cancelar</button>
          </div>
          <p className="cpa-dica">Durante a Black Friday (tema Black ligado) a faixa da Black tem prioridade e esta faixa não aparece. O banner da home aparece normalmente.</p>
        </div>
      ) : (
        <button className="adm-btn ap" style={{ marginBottom: 14 }} disabled={!d.sql36} onClick={() => setF({ ...VAZIA, inicio: paraCampo(new Date().toISOString()), fim: paraCampo(new Date(Date.now() + 7 * 86400000).toISOString()) })}><Icon name="plus" size={15} /> Nova campanha</button>
      )}

      {/* campanhas */}
      <div className="adm-card">
        <h3 className="cpa-h">Campanhas</h3>
        {!d.campanhas.length ? <p className="cpa-dica">Nenhuma campanha ainda. Comece por uma sugestão do calendário abaixo.</p> : d.campanhas.map((c) => {
          const s = situacao(c);
          const [rot, cor] = ROT_SIT[s];
          return (
            <div key={c.id} className="cpa-item">
              <span className="cpa-cor" style={{ background: TEMAS[c.tema]?.fundo || '#FF6B00' }} />
              <div className="cpa-t">
                <b>{c.titulo}</b>
                <span>{c.formato === 'faixa' ? 'Faixa no topo' : 'Banner da home'} · {dataBR(c.inicio)} até {dataBR(c.fim)}{c.link ? ` · ${c.link}` : ''}</span>
                {c.intencao && <span className="cpa-int">{c.intencao}</span>}
              </div>
              <span className="cpa-sit" style={{ color: cor, borderColor: cor }}>{rot}</span>
              <div className="cpa-bts">
                <button className="adm-btn rp" onClick={() => setF({ ...c, mensagem: c.mensagem || '', botao: c.botao || '', link: c.link || '', imagem_url: c.imagem_url || '', imagem_mobile_url: c.imagem_mobile_url || '', intencao: c.intencao || '', inicio: paraCampo(c.inicio), fim: paraCampo(c.fim) })}>Editar</button>
                <button className="adm-btn rp" disabled={busy === 'ligar' + c.id} onClick={() => post({ acao: 'ligar', id: c.id, ativa: !c.ativa, titulo: c.titulo }, c.ativa ? 'Campanha pausada.' : 'Campanha ligada.')}>{c.ativa ? 'Pausar' : 'Ligar'}</button>
                <button className="adm-btn rp" onClick={() => setExcluir(c)}>Excluir</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* calendário */}
      <div className="adm-card">
        <h3 className="cpa-h"><Icon name="calendar" size={17} /> Calendário: próximas datas</h3>
        <p className="cpa-dica">Cada data já vem com uma campanha sugerida e o prompt da imagem com o texto exato da arte. Crie a imagem, suba no banner e pronto.</p>
        <div className="cpa-datas">
          {d.datas.map((x) => {
            const comecou = Date.parse(x.comeca) <= Date.now();
            const dias = Math.ceil((Date.parse(x.comeca) - Date.now()) / 86400000);
            const bf = x.id.startsWith('black-');
            return (
              <div key={x.id} className="cpa-data">
                <div className="cpa-dt"><b>{x.nome}</b><span>{dataBR(x.data)}{x.publico === 'gamer' ? ' · gamer' : ''}</span></div>
                <small className="cpa-quando">{comecou ? 'Período da campanha já começou' : `Começar em ${dias} dia${dias === 1 ? '' : 's'} (${dataBR(x.comeca)})`}</small>
                {bf ? <p className="cpa-dica">Configure em <b>Crescimento e Black</b>: a Black tem tema, contagem e inscrição de vendedores próprios.</p> : (
                  <>
                    <p className="cpa-sug"><b>{x.sugestao.titulo}</b><br />{x.sugestao.mensagem}</p>
                    <div className="cpa-bts">
                      <button className="adm-btn ap" onClick={() => usarSugestao(x)} disabled={!d.sql36}>Usar esta campanha</button>
                      {x.sugestao.textoImagem && <button className="adm-btn rp" onClick={() => setVerPrompt(verPrompt === x.id ? null : x.id)}>Prompt da imagem</button>}
                    </div>
                    {verPrompt === x.id && (
                      <div className="cpa-prompt">
                        {(['computador', 'celular'] as const).map((tipo) => {
                          const p = promptDaImagem(x.sugestao, tipo);
                          return (
                            <div key={tipo}>
                              <small>{tipo === 'computador' ? 'Banner do computador · 1920 × 600' : 'Banner do celular · 1080 × 1080'}</small>
                              <p>{p}</p>
                              <button className="adm-btn rp" onClick={() => copiar(p)}><Icon name="copy" size={13} /> Copiar</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <DialogoSite aberto={!!excluir} perigo titulo="Excluir campanha?" texto={excluir ? `"${excluir.titulo}" sai do site e da lista. Para só tirar do ar, use Pausar.` : ''}
        confirmar="Excluir" onFechar={() => setExcluir(null)} onConfirmar={() => { const c = excluir; setExcluir(null); if (c) post({ acao: 'excluir', id: c.id, titulo: c.titulo }, 'Campanha excluída.'); }} />
    </div>
  );
}

const CSS = `
.cpa .adm-card{margin-bottom:16px}
.cpa-h{font-family:Outfit;font-size:16px;font-weight:900;margin:0 0 12px;display:flex;align-items:center;gap:7px}
.cpa-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.cpa-g label{display:flex;flex-direction:column;gap:5px;font-size:13px}
.cpa-g label>span{font-weight:800}
.cpa-g small{color:var(--sub);font-weight:600}
.cpa-g input,.cpa-g select{border:1px solid var(--bd2);border-radius:10px;padding:9px 11px;font-size:14px;background:var(--panel2);color:var(--tx);font-family:inherit}
.cpa-full{grid-column:1/-1}
.cpa-chk{flex-direction:row!important;align-items:center;gap:8px!important;grid-column:1/-1}
.cpa-op{display:flex;gap:6px;flex-wrap:wrap}
.cpa-op button{border:1.5px solid var(--bd2);background:var(--panel2);color:var(--sub);border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px;cursor:pointer}
.cpa-op button.on{border-color:#FF6B00;color:var(--tx);background:#FF6B0018}
.cpa-up{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cpa-up img{width:120px;height:46px;object-fit:cover;border-radius:8px;border:1px solid var(--bd2)}
.cpa-up button{border:0;background:none;color:#D23B3B;font-weight:800;cursor:pointer}
.cpa-dica{color:var(--sub);font-size:12.5px;margin:8px 0 0;line-height:1.45}
.cpa-prev{margin-top:14px;border:1px dashed var(--bd2);border-radius:14px;padding:10px;background:#fff;color:#16162A;overflow:hidden}
.cpa-prev>small{display:block;color:#6B6B80;font-weight:800;margin-bottom:6px}
.cpa-prev .cpb{padding:0}.cpa-prev .c{max-width:none;padding:0}
.cpa-bts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.cpa-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--bd2);flex-wrap:wrap}
.cpa-item:last-child{border-bottom:0}
.cpa-item .cpa-bts{margin:0}
.cpa-cor{width:10px;align-self:stretch;border-radius:6px;min-height:40px}
.cpa-t{flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:2px}
.cpa-t b{font-family:Outfit;font-size:14.5px;overflow-wrap:anywhere}
.cpa-t span{font-size:12.5px;color:var(--sub);overflow-wrap:anywhere}
.cpa-int{font-style:italic}
.cpa-sit{border:1.5px solid;border-radius:50px;padding:2px 10px;font-size:12px;font-weight:900;font-family:Outfit;white-space:nowrap}
.cpa-datas{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:12px;align-items:start}
.cpa-data{border:1px solid var(--bd2);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px}
.cpa-dt{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.cpa-dt b{font-family:Outfit;font-size:15px}
.cpa-dt span{font-size:12.5px;color:var(--sub);white-space:nowrap}
.cpa-quando{color:#FF8A3D;font-weight:800;font-size:12px}
.cpa-sug{font-size:13px;margin:4px 0 0;line-height:1.45}
.cpa-prompt{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.cpa-prompt small{font-weight:900;font-size:12px}
.cpa-prompt p{background:var(--panel2);border-radius:10px;padding:8px 10px;font-size:12.5px;margin:4px 0 6px;line-height:1.5}
`;
