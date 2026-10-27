'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CampoTextoFormatado from '@/components/CampoTextoFormatado';
import FileUpload from '../../produtos/FileUpload';
import { videoDaUrl, duracaoTexto, PROVEDORES_ACEITOS, type CursoConfig, type Modulo, type Aula, type Material } from '@/lib/curso';

type Alunos = { total: number; concluiram: number; mediaPct: number; lista: { nome: string; desde: string; pct: number; ultimoAcesso: string | null }[] };
type FormAula = { id?: string; modulo_id: string; titulo: string; video_url: string; conteudo: string; materiais: Material[]; duracao_min: string; liberar_apos_dias: string; previa: boolean; publicada: boolean };

const quando = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');

export default function EditorCurso({ productId, userId }: { productId: string; userId: string }) {
  const [carregado, setCarregado] = useState(false);
  const [sql18, setSql18] = useState(true);
  const [config, setConfig] = useState<CursoConfig | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [alunos, setAlunos] = useState<Alunos | null>(null);
  const [aba, setAba] = useState<'conteudo' | 'config' | 'alunos'>('conteudo');
  const [busy, setBusy] = useState<string | null>(null);
  const [novoModulo, setNovoModulo] = useState('');
  const [editMod, setEditMod] = useState<{ id: string; titulo: string; dias: string } | null>(null);
  const [form, setForm] = useState<FormAula | null>(null);
  const [excluir, setExcluir] = useState<{ tipo: 'modulo' | 'aula'; id: string; titulo: string } | null>(null);
  const [cfg, setCfg] = useState<CursoConfig | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/seller/curso?productId=${productId}`, { credentials: 'include', cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Não foi possível carregar.', 'error'); return; }
      setSql18(d.sql18 !== false);
      if (d.sql18 !== false) { setConfig(d.config); setCfg(d.config); setModulos(d.modulos); setAlunos(d.alunos); }
    } catch { toast('Falha de conexão.', 'error'); }
    finally { setCarregado(true); }
  }, [productId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(corpo: any, chave: string, ok?: string) {
    setBusy(chave);
    try {
      const r = await fetch('/api/seller/curso', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, ...corpo }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível salvar.', 'error'); return false; }
      setConfig(d.config); setModulos(d.modulos);
      if (ok) toast(ok, 'success');
      return true;
    } catch { toast('Falha de conexão.', 'error'); return false; }
    finally { setBusy(null); }
  }

  const salvarConfig = (patch: Partial<CursoConfig>, ok = 'Configurações salvas.') => {
    const c = { ...(cfg || config!), ...patch };
    setCfg(c);
    return enviar({ acao: 'salvar_config', ...c }, 'cfg', ok);
  };

  function mover(lista: { id: string }[], i: number, dir: -1 | 1, tipo: 'modulos' | 'aulas', moduloId?: string) {
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const ids = lista.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    enviar({ acao: 'ordenar', tipo, ids, modulo_id: moduloId }, 'ordem');
  }

  function novaAula(moduloId: string) {
    setForm({ modulo_id: moduloId, titulo: '', video_url: '', conteudo: '', materiais: [], duracao_min: '', liberar_apos_dias: '0', previa: false, publicada: true });
  }
  function editarAula(a: Aula) {
    setForm({ id: a.id, modulo_id: a.modulo_id, titulo: a.titulo, video_url: a.video_url || '', conteudo: a.conteudo || '', materiais: a.materiais || [],
      duracao_min: a.duracao_min ? String(a.duracao_min) : '', liberar_apos_dias: String(a.liberar_apos_dias || 0), previa: a.previa, publicada: a.publicada });
  }
  async function salvarAula() {
    if (!form) return;
    if (!form.titulo.trim()) { toast('Dê um título à aula.', 'error'); return; }
    if (form.video_url.trim() && !videoDaUrl(form.video_url)) { toast(`Link de vídeo não reconhecido. Use ${PROVEDORES_ACEITOS}.`, 'error'); return; }
    const ok = await enviar({ acao: 'aula_salvar', ...form, duracao_min: form.duracao_min === '' ? null : Number(form.duracao_min) }, 'aula', form.id ? 'Aula salva.' : 'Aula criada.');
    if (ok) setForm(null);
  }

  if (!carregado) return <div className="card"><span className="muted">Carregando…</span></div>;
  if (!sql18) return <div className="card"><b>Quase lá!</b><p className="muted" style={{ margin: '6px 0 0' }}>A área de membros fica disponível depois que o SQL 18 for aplicado no banco.</p></div>;
  if (!config || !cfg) return null;

  const totalAulas = modulos.reduce((n, m) => n + m.aulas.length, 0);
  const minutos = modulos.reduce((n, m) => n + m.aulas.reduce((k, a) => k + (a.duracao_min || 0), 0), 0);
  const video = form ? videoDaUrl(form.video_url) : null;

  return (
    <div className="ec">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className={`card ec-status ${config.ativo ? 'on' : ''}`}>
        <div className="ec-status-t">
          <span className="ec-dot" />
          <div>
            <b>{config.ativo ? 'Área de membros ligada' : 'Área de membros desligada'}</b>
            <small>{config.ativo ? 'Quem comprou já vê o botão "Acessar curso" no pedido e em Minhas compras.' : 'Monte as aulas e ligue quando estiver pronto. Os compradores só veem depois de ligada.'}</small>
          </div>
        </div>
        <div className="ec-status-a">
          <Link href={`/curso/${productId}`} className="btn btn-ghost btn-sm" target="_blank"><Icon name="eye" size={15} /> Ver como aluno</Link>
          <button type="button" className={`btn btn-sm ${config.ativo ? 'btn-ghost' : 'btn-pri'}`} disabled={busy === 'cfg' || (!config.ativo && totalAulas === 0)}
            title={!config.ativo && totalAulas === 0 ? 'Crie pelo menos uma aula' : undefined}
            onClick={() => salvarConfig({ ativo: !config.ativo }, config.ativo ? 'Área de membros desligada.' : 'Área de membros ligada!')}>
            {config.ativo ? 'Desligar' : 'Ligar área de membros'}
          </button>
        </div>
      </div>

      <div className="ec-nums">
        <div><b>{modulos.length}</b><span>módulo{modulos.length === 1 ? '' : 's'}</span></div>
        <div><b>{totalAulas}</b><span>aula{totalAulas === 1 ? '' : 's'}</span></div>
        <div><b>{minutos ? duracaoTexto(minutos) : '—'}</b><span>de conteúdo</span></div>
        <div><b>{alunos?.total ?? 0}</b><span>aluno{alunos?.total === 1 ? '' : 's'}</span></div>
      </div>

      <div className="ec-abas" role="tablist">
        {([['conteudo', 'Conteúdo'], ['config', 'Configurações'], ['alunos', 'Alunos']] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} className={aba === k ? 'on' : ''} onClick={() => setAba(k)}>{l}</button>
        ))}
      </div>

      {aba === 'conteudo' && (
        <>
          {modulos.map((m, mi) => (
            <section key={m.id} className="card ec-mod">
              <header className="ec-mod-h">
                <span className="ec-n">{mi + 1}</span>
                {editMod?.id === m.id ? (
                  <div className="ec-mod-edit">
                    <input value={editMod.titulo} maxLength={140} onChange={(e) => setEditMod({ ...editMod, titulo: e.target.value })} aria-label="Nome do módulo" autoFocus />
                    <label>Libera <input type="number" min={0} max={730} value={editMod.dias} onChange={(e) => setEditMod({ ...editMod, dias: e.target.value })} aria-label="Dias após a compra" /> dias após a compra</label>
                    <button type="button" className="btn btn-pri btn-sm" disabled={busy === 'mod'} onClick={async () => { if (await enviar({ acao: 'modulo_salvar', id: m.id, titulo: editMod.titulo, liberar_apos_dias: editMod.dias }, 'mod', 'Módulo salvo.')) setEditMod(null); }}>Salvar</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditMod(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div className="ec-mod-t">
                    <b>{m.titulo}</b>
                    <small>{m.aulas.length} aula{m.aulas.length === 1 ? '' : 's'}{m.liberar_apos_dias ? ` · libera ${m.liberar_apos_dias} dia${m.liberar_apos_dias === 1 ? '' : 's'} após a compra` : ' · liberado na hora'}</small>
                  </div>
                )}
                {editMod?.id !== m.id && (
                  <div className="ec-acoes">
                    <button type="button" className="ec-ib" title="Subir" aria-label="Subir módulo" disabled={mi === 0 || !!busy} onClick={() => mover(modulos, mi, -1, 'modulos')}><Icon name="arrowRight" size={15} style={{ transform: 'rotate(-90deg)' }} /></button>
                    <button type="button" className="ec-ib" title="Descer" aria-label="Descer módulo" disabled={mi === modulos.length - 1 || !!busy} onClick={() => mover(modulos, mi, 1, 'modulos')}><Icon name="arrowRight" size={15} style={{ transform: 'rotate(90deg)' }} /></button>
                    <button type="button" className="ec-ib" title="Editar módulo" aria-label="Editar módulo" onClick={() => setEditMod({ id: m.id, titulo: m.titulo, dias: String(m.liberar_apos_dias || 0) })}><Icon name="edit" size={15} /></button>
                    <button type="button" className="ec-ib red" title="Excluir módulo" aria-label="Excluir módulo" onClick={() => setExcluir({ tipo: 'modulo', id: m.id, titulo: m.titulo })}><Icon name="trash" size={15} /></button>
                  </div>
                )}
              </header>
              <ol className="ec-aulas">
                {m.aulas.map((a, ai) => (
                  <li key={a.id} className={a.publicada ? '' : 'rasc'}>
                    <span className="ec-aula-ic"><Icon name={a.video_url ? 'play' : 'file'} size={13} /></span>
                    <button type="button" className="ec-aula-t" onClick={() => editarAula(a)}>
                      <b>{a.titulo}</b>
                      <span className="ec-tags">
                        {a.duracao_min ? <i>{duracaoTexto(a.duracao_min)}</i> : null}
                        {a.video_url && !videoDaUrl(a.video_url) ? <i className="red">vídeo inválido</i> : null}
                        {a.materiais?.length ? <i>{a.materiais.length} material{a.materiais.length === 1 ? '' : 'is'}</i> : null}
                        {a.liberar_apos_dias ? <i>libera em {a.liberar_apos_dias}d</i> : null}
                        {a.previa ? <i className="verde">prévia grátis</i> : null}
                        {!a.publicada ? <i className="cinza">rascunho</i> : null}
                      </span>
                    </button>
                    <div className="ec-acoes">
                      <button type="button" className="ec-ib" aria-label="Subir aula" disabled={ai === 0 || !!busy} onClick={() => mover(m.aulas, ai, -1, 'aulas', m.id)}><Icon name="arrowRight" size={14} style={{ transform: 'rotate(-90deg)' }} /></button>
                      <button type="button" className="ec-ib" aria-label="Descer aula" disabled={ai === m.aulas.length - 1 || !!busy} onClick={() => mover(m.aulas, ai, 1, 'aulas', m.id)}><Icon name="arrowRight" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
                      <button type="button" className="ec-ib red" aria-label="Excluir aula" onClick={() => setExcluir({ tipo: 'aula', id: a.id, titulo: a.titulo })}><Icon name="trash" size={14} /></button>
                    </div>
                  </li>
                ))}
              </ol>
              <button type="button" className="btn btn-ghost btn-sm ec-add" onClick={() => novaAula(m.id)}><Icon name="plus" size={15} /> Nova aula</button>
            </section>
          ))}

          <div className="card ec-novo">
            <label htmlFor="ec-nm"><b>{modulos.length ? 'Novo módulo' : 'Comece criando o primeiro módulo'}</b></label>
            <div className="ec-novo-l">
              <input id="ec-nm" value={novoModulo} maxLength={140} onChange={(e) => setNovoModulo(e.target.value)} placeholder="Ex.: Módulo 1 — Primeiros passos"
                onKeyDown={(e) => { if (e.key === 'Enter' && novoModulo.trim()) { e.preventDefault(); enviar({ acao: 'modulo_salvar', titulo: novoModulo }, 'mod', 'Módulo criado.').then((ok) => ok && setNovoModulo('')); } }} />
              <button type="button" className="btn btn-pri" disabled={!novoModulo.trim() || busy === 'mod'} onClick={async () => { if (await enviar({ acao: 'modulo_salvar', titulo: novoModulo }, 'mod', 'Módulo criado.')) setNovoModulo(''); }}><Icon name="plus" size={16} /> Criar módulo</button>
            </div>
          </div>
        </>
      )}

      {aba === 'config' && (
        <div className="card">
          <div className="fg">
            <label>Mensagem de boas-vindas</label>
            <CampoTextoFormatado valor={cfg.boas_vindas || ''} onValor={(v) => setCfg({ ...cfg, boas_vindas: v })} max={4000} linhas={5} placeholder="Ex.: Que bom ter você aqui! Comece pelo Módulo 1 e marque cada aula como concluída." />
          </div>
          <div className="fg2">
            <div className="fg">
              <label htmlFor="ec-cor">Cor da área do aluno</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input id="ec-cor" type="color" value={cfg.cor || '#FF6B00'} onChange={(e) => setCfg({ ...cfg, cor: e.target.value })} style={{ width: 56, padding: 4 }} />
                <span className="muted" style={{ fontSize: 13 }}>{cfg.cor || '#FF6B00 (padrão)'}</span>
              </div>
            </div>
            <div className="fg">
              <label htmlFor="ec-ch">Carga horária no certificado (horas)</label>
              <input id="ec-ch" type="number" min={1} max={2000} value={cfg.carga_horaria ?? ''} placeholder={minutos ? `Automático: ${Math.max(1, Math.round(minutos / 60))} h` : 'Ex.: 10'}
                onChange={(e) => setCfg({ ...cfg, carga_horaria: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
          <label className="ec-chk"><input type="checkbox" checked={cfg.certificado} onChange={(e) => setCfg({ ...cfg, certificado: e.target.checked })} />
            <span><b>Emitir certificado de conclusão</b><small>Quando o aluno concluir todas as aulas, ele emite o certificado com o nome dele e um código de verificação público.</small></span></label>
          <button type="button" className="btn btn-pri" disabled={busy === 'cfg'} onClick={() => salvarConfig({})}>{busy === 'cfg' ? 'Salvando…' : 'Salvar configurações'}</button>
        </div>
      )}

      {aba === 'alunos' && (
        <div className="card">
          {alunos && alunos.total ? (
            <>
              <div className="ec-nums" style={{ marginBottom: 14 }}>
                <div><b>{alunos.total}</b><span>alunos</span></div>
                <div><b>{alunos.mediaPct}%</b><span>progresso médio</span></div>
                <div><b>{alunos.concluiram}</b><span>concluíram</span></div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="ec-tab">
                  <thead><tr><th>Aluno</th><th>Desde</th><th>Progresso</th><th>Último acesso</th></tr></thead>
                  <tbody>
                    {alunos.lista.map((a, i) => (
                      <tr key={i}>
                        <td>{a.nome}</td><td>{quando(a.desde)}</td>
                        <td><div className="ec-pb"><i style={{ width: `${a.pct}%` }} /></div><small>{a.pct}%</small></td>
                        <td>{quando(a.ultimoAcesso)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <p className="muted" style={{ margin: 0 }}>Quando alguém comprar, os alunos e o progresso aparecem aqui.</p>}
        </div>
      )}

      {form && (
        <div className="ec-ov" role="dialog" aria-modal="true" aria-label={form.id ? 'Editar aula' : 'Nova aula'} onKeyDown={(e) => { if (e.key === 'Escape') setForm(null); }}>
          <div className="ec-painel">
            <div className="ec-painel-h">
              <b>{form.id ? 'Editar aula' : 'Nova aula'}</b>
              <button type="button" className="ec-ib" aria-label="Fechar" onClick={() => setForm(null)}><Icon name="x" size={18} /></button>
            </div>
            <div className="ec-painel-c">
              <div className="fg"><label htmlFor="ea-t">Título da aula</label>
                <input id="ea-t" value={form.titulo} maxLength={160} onChange={(e) => setForm({ ...form, titulo: e.target.value })} autoFocus placeholder="Ex.: Aula 1 — Como funciona o método" /></div>
              <div className="fg2">
                <div className="fg"><label htmlFor="ea-m">Módulo</label>
                  <select id="ea-m" value={form.modulo_id} onChange={(e) => setForm({ ...form, modulo_id: e.target.value })}>
                    {modulos.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                  </select></div>
                <div className="fg"><label htmlFor="ea-d">Duração (minutos)</label>
                  <input id="ea-d" type="number" min={0} max={1440} value={form.duracao_min} onChange={(e) => setForm({ ...form, duracao_min: e.target.value })} placeholder="Ex.: 12" /></div>
              </div>
              <div className="fg"><label htmlFor="ea-v">Link do vídeo</label>
                <input id="ea-v" value={form.video_url} maxLength={600} inputMode="url" onChange={(e) => setForm({ ...form, video_url: e.target.value.trim() })} placeholder="https://youtu.be/… ou link do Panda, Vimeo, Bunny…" />
                <small className="muted" style={{ fontSize: 12.5 }}>Aceita {PROVEDORES_ACEITOS}. No YouTube, use vídeo <b>não listado</b>.</small>
                {form.video_url && (video
                  ? <div className="ec-prev">{video.tipo === 'iframe' ? <iframe src={video.src} title="Prévia do vídeo" allowFullScreen loading="lazy" /> : <video src={video.src} controls preload="metadata" />}</div>
                  : <div className="ec-erro">Link não reconhecido.</div>)}
              </div>
              <div className="fg"><label>Texto da aula (opcional)</label>
                <CampoTextoFormatado valor={form.conteudo} onValor={(v) => setForm({ ...form, conteudo: v })} max={20000} linhas={7} placeholder="Resumo, passo a passo, links úteis…" /></div>

              <div className="fg">
                <label>Materiais (PDF, planilha, links)</label>
                {form.materiais.map((m, i) => (
                  <div key={i} className="ec-matl">
                    <Icon name={m.path ? 'file' : 'link'} size={15} />
                    <input value={m.titulo} maxLength={120} aria-label="Nome do material" onChange={(e) => { const l = [...form.materiais]; l[i] = { ...m, titulo: e.target.value }; setForm({ ...form, materiais: l }); }} />
                    <small className="muted">{m.path ? (m.nome || 'arquivo') : (m.url || '').replace(/^https?:\/\//, '').slice(0, 40)}</small>
                    <button type="button" className="ec-ib red" aria-label="Remover material" onClick={() => setForm({ ...form, materiais: form.materiais.filter((_, k) => k !== i) })}><Icon name="trash" size={14} /></button>
                  </div>
                ))}
                {form.materiais.length < 15 && (
                  <div className="ec-matadd">
                    <FileUpload userId={userId} onUploaded={(path, nome) => setForm((f) => (f ? { ...f, materiais: [...f.materiais, { titulo: nome.replace(/\.[^.]+$/, ''), path, nome }] } : f))} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                      const url = window.prompt('Cole o link do material (https://…):', 'https://');
                      if (!url) return;
                      if (!/^https?:\/\/\S+$/.test(url.trim())) { toast('Link inválido.', 'error'); return; }
                      setForm({ ...form, materiais: [...form.materiais, { titulo: 'Material complementar', url: url.trim() }] });
                    }}><Icon name="link" size={15} /> Adicionar link</button>
                  </div>
                )}
              </div>

              <div className="fg"><label htmlFor="ea-l">Liberar quantos dias após a compra?</label>
                <input id="ea-l" type="number" min={0} max={730} value={form.liberar_apos_dias} onChange={(e) => setForm({ ...form, liberar_apos_dias: e.target.value })} />
                <small className="muted" style={{ fontSize: 12.5 }}>0 = libera na hora. Use para entregar o conteúdo aos poucos (vale o maior entre o do módulo e o da aula).</small></div>
              <label className="ec-chk"><input type="checkbox" checked={form.previa} onChange={(e) => setForm({ ...form, previa: e.target.checked })} />
                <span><b>Prévia grátis</b><small>Qualquer pessoa assiste antes de comprar (bom para a 1ª aula).</small></span></label>
              <label className="ec-chk"><input type="checkbox" checked={!form.publicada} onChange={(e) => setForm({ ...form, publicada: !e.target.checked })} />
                <span><b>Salvar como rascunho</b><small>Só você vê. Os alunos não enxergam até publicar.</small></span></label>
            </div>
            <div className="ec-painel-r">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button type="button" className="btn btn-pri" disabled={busy === 'aula'} onClick={salvarAula}>{busy === 'aula' ? 'Salvando…' : 'Salvar aula'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!excluir} danger busy={!!busy}
        title={excluir?.tipo === 'modulo' ? 'Excluir este módulo?' : 'Excluir esta aula?'}
        text={excluir ? (excluir.tipo === 'modulo' ? `"${excluir.titulo}" e todas as aulas dele serão apagados, junto com o progresso dos alunos nessas aulas.` : `"${excluir.titulo}" será apagada, junto com o progresso dos alunos nela.`) : ''}
        confirmLabel="Excluir"
        onCancel={() => setExcluir(null)}
        onConfirm={async () => { if (!excluir) return; const ok = await enviar({ acao: excluir.tipo === 'modulo' ? 'modulo_excluir' : 'aula_excluir', id: excluir.id }, 'del', 'Excluído.'); if (ok) setExcluir(null); }} />
    </div>
  );
}

const CSS = `
.ec{display:flex;flex-direction:column;gap:14px}
.ec .card{padding:18px 20px}
.ec-status{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;border-left:4px solid var(--border2)}
.ec-status.on{border-left-color:var(--green)}
.ec-status-t{display:flex;gap:12px;align-items:flex-start;min-width:0;flex:1 1 300px}
.ec-status-t b{display:block;font-family:'Outfit';font-size:16px}
.ec-status-t small{color:var(--sub);font-size:13px}
.ec-dot{width:12px;height:12px;border-radius:50%;background:var(--muted);margin-top:5px;flex:none}
.ec-status.on .ec-dot{background:var(--green);box-shadow:0 0 0 4px var(--green-bg)}
.ec-status-a{display:flex;gap:8px;flex-wrap:wrap}
.ec-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.ec-nums>div{background:#fff;border:1px solid var(--border);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column}
.ec-nums b{font-family:'Outfit';font-size:22px;font-weight:900}
.ec-nums span{color:var(--sub);font-size:12.5px;font-weight:700}
.ec-abas{display:flex;gap:6px;border-bottom:1px solid var(--border);overflow-x:auto}
.ec-abas button{border:0;background:none;padding:10px 14px;font-weight:800;font-size:14.5px;color:var(--sub);border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap}
.ec-abas button.on{color:var(--text);border-bottom-color:var(--orange)}
.ec-mod{padding:0!important;overflow:hidden}
.ec-mod-h{display:flex;gap:12px;align-items:center;padding:14px 16px;background:var(--surface);border-bottom:1px solid var(--border);flex-wrap:wrap}
.ec-n{width:30px;height:30px;border-radius:9px;background:var(--text);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:900;flex:none}
.ec-mod-t{flex:1;min-width:0;display:flex;flex-direction:column}
.ec-mod-t b{font-family:'Outfit';font-size:16px;overflow-wrap:anywhere}
.ec-mod-t small{color:var(--sub);font-size:12.5px;font-weight:700}
.ec-mod-edit{flex:1;display:flex;gap:8px;flex-wrap:wrap;align-items:center;min-width:0}
.ec-mod-edit>input{flex:1 1 220px;height:40px;border-radius:10px;border:1.5px solid var(--border2);padding:0 10px;font-size:14.5px}
.ec-mod-edit label{font-size:13px;color:var(--sub);font-weight:700;display:flex;align-items:center;gap:6px}
.ec-mod-edit label input{width:64px;height:36px;border-radius:9px;border:1.5px solid var(--border2);padding:0 8px}
.ec-acoes{display:flex;gap:2px;flex:none}
.ec-ib{width:34px;height:34px;border-radius:9px;border:0;background:none;color:var(--sub);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.ec-ib:hover:not(:disabled){background:#fff;color:var(--text);box-shadow:0 0 0 1px var(--border2)}
.ec-ib:disabled{opacity:.3;cursor:default}
.ec-ib.red:hover{color:var(--red)}
.ec-aulas{list-style:none;margin:0;padding:6px 0}
.ec-aulas li{display:flex;gap:10px;align-items:center;padding:8px 12px 8px 18px}
.ec-aulas li:hover{background:var(--surface)}
.ec-aulas li.rasc .ec-aula-t b{color:var(--muted)}
.ec-aula-ic{width:26px;height:26px;border-radius:8px;background:var(--soft);color:var(--orange-ink);display:flex;align-items:center;justify-content:center;flex:none}
.ec-aula-t{all:unset;cursor:pointer;flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.ec-aula-t:focus-visible{outline:2px solid var(--orange);outline-offset:3px;border-radius:6px}
.ec-aula-t b{font-size:14.5px;overflow-wrap:anywhere}
.ec-tags{display:flex;gap:5px;flex-wrap:wrap}
.ec-tags i{font-style:normal;font-size:11.5px;font-weight:800;background:var(--bg2);color:var(--sub);border-radius:50px;padding:1px 8px}
.ec-tags i.verde{background:var(--green-bg);color:var(--green)}
.ec-tags i.red{background:var(--red-bg);color:var(--red)}
.ec-tags i.cinza{background:#EEE;color:#666}
.ec-add{margin:0 16px 14px}
.ec-novo label{display:block;margin-bottom:8px;font-family:'Outfit'}
.ec-novo-l{display:flex;gap:8px;flex-wrap:wrap}
.ec-novo-l input{flex:1 1 260px;height:46px;border-radius:14px;border:1.5px solid var(--border2);padding:0 14px;font-size:15px}
.ec-chk{display:flex;gap:10px;align-items:flex-start;margin:4px 0 14px;cursor:pointer}
.ec-chk input{margin-top:4px;accent-color:var(--orange);width:18px;height:18px}
.ec-chk b{display:block;font-size:14.5px}
.ec-chk small{color:var(--sub);font-size:13px}
.ec-tab{width:100%;border-collapse:collapse;font-size:14px;min-width:520px}
.ec-tab th{text-align:left;font-size:12px;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;padding:8px 10px;border-bottom:1px solid var(--border)}
.ec-tab td{padding:10px;border-bottom:1px solid var(--border)}
.ec-tab td small{color:var(--sub);font-weight:800;margin-left:6px}
.ec-pb{display:inline-block;width:110px;height:8px;border-radius:50px;background:var(--bg2);overflow:hidden;vertical-align:middle}
.ec-pb i{display:block;height:100%;background:var(--green)}
.ec-ov{position:fixed;inset:0;background:rgba(22,22,42,.45);z-index:1000;display:flex;justify-content:flex-end;animation:cb-fade .2s ease both}
.ec-painel{width:min(640px,100%);height:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-20px 0 50px rgba(22,22,42,.2)}
.ec-painel-h{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border)}
.ec-painel-h b{font-family:'Outfit';font-size:18px}
.ec-painel-c{flex:1;overflow-y:auto;padding:18px}
.ec-painel-r{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--border);background:var(--surface)}
.ec-prev{margin-top:10px;position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#0F0F1A}
.ec-prev iframe,.ec-prev video{position:absolute;inset:0;width:100%;height:100%;border:0}
.ec-erro{margin-top:8px;color:var(--red);font-size:13px;font-weight:800}
.ec-matl{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--border)}
.ec-matl input{flex:1;min-width:0;height:38px!important;min-height:38px!important;padding:0 10px!important;border-radius:10px!important}
.ec-matl small{max-width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ec-matadd{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
@media(max-width:620px){.ec .fg2{grid-template-columns:1fr}.ec-matl small{display:none}}
`;
