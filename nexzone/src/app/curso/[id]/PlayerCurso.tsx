'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import TextoFormatado from '@/components/TextoFormatado';
import { toast } from '@/lib/toast';
import { videoDaUrl, duracaoTexto, type CursoConfig } from '@/lib/curso';

export type AulaAluno = {
  id: string; titulo: string; duracao_min: number | null; previa: boolean; publicada: boolean;
  liberada: boolean; liberaEm: string | null; video_url: string | null; conteudo: string | null;
  materiais: { titulo: string; tipo: 'arquivo' | 'link' }[];
};
export type ModuloAluno = { id: string; titulo: string; aulas: AulaAluno[] };

type Props = {
  productId: string; titulo: string; capa: string | null; loja: string; config: CursoConfig;
  modulos: ModuloAluno[]; concluidasIniciais: string[]; aulaInicial: string | null;
  papel: 'aluno' | 'dono' | 'admin' | 'visitante'; pedidoId: string | null; certificado: string | null; nomeAluno: string;
};

const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

export default function PlayerCurso(p: Props) {
  const cor = p.config.cor || '#FF6B00';
  const todas = useMemo(() => p.modulos.flatMap((m) => m.aulas.filter((a) => a.publicada).map((a) => ({ ...a, modulo: m.titulo, moduloId: m.id }))), [p.modulos]);
  const [feitas, setFeitas] = useState<Set<string>>(() => new Set(p.concluidasIniciais));
  const [atual, setAtual] = useState<string | null>(() => (p.aulaInicial && todas.some((a) => a.id === p.aulaInicial && a.liberada) ? p.aulaInicial : null));
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(p.modulos.map((m) => m.id)));
  const [salvando, setSalvando] = useState(false);
  const [cert, setCert] = useState<string | null>(p.certificado);
  const [nomeCert, setNomeCert] = useState(p.nomeAluno);
  const [emitindo, setEmitindo] = useState(false);
  const [listaAberta, setListaAberta] = useState(false);

  const aluno = p.papel === 'aluno';
  const total = todas.length;
  const feitasN = todas.filter((a) => feitas.has(a.id)).length;
  const pct = total ? Math.round((feitasN / total) * 100) : 0;
  const completo = total > 0 && feitasN === total;
  const aula = todas.find((a) => a.id === atual) || null;
  const idx = aula ? todas.findIndex((a) => a.id === aula.id) : -1;
  const anterior = idx > 0 ? todas.slice(0, idx).reverse().find((a) => a.liberada) : null;
  const seguinte = idx >= 0 ? todas.slice(idx + 1).find((a) => a.liberada) : null;
  const continuar = todas.find((a) => a.liberada && !feitas.has(a.id)) || todas.find((a) => a.liberada) || null;
  const video = aula ? videoDaUrl(aula.video_url) : null;
  const minutos = todas.reduce((n, a) => n + (a.duracao_min || 0), 0);

  // URL acompanha a aula (dá para favoritar/compartilhar com o próprio aluno)
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (atual) u.searchParams.set('aula', atual); else u.searchParams.delete('aula');
      window.history.replaceState(null, '', u.toString());
    } catch {}
    if (atual && p.papel !== 'visitante') {
      fetch('/api/curso/progresso', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aulaId: atual, visita: true }) }).catch(() => {});
    }
    if (atual) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [atual, p.papel]);

  async function alternarConcluida(id: string, marcar: boolean) {
    if (p.papel === 'visitante') { toast('Compre o curso para salvar seu progresso.', 'info'); return; }
    setSalvando(true);
    const antes = new Set(feitas);
    const novo = new Set(feitas); if (marcar) novo.add(id); else novo.delete(id);
    setFeitas(novo);
    try {
      const r = await fetch('/api/curso/progresso', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aulaId: id, concluida: marcar }) });
      if (!r.ok) { setFeitas(antes); const d = await r.json().catch(() => ({})); toast(d.error || 'Não foi possível salvar.', 'error'); return; }
      if (marcar && seguinte && id === atual) setTimeout(() => setAtual(seguinte.id), 450);
    } catch { setFeitas(antes); toast('Falha de conexão.', 'error'); }
    finally { setSalvando(false); }
  }

  async function emitir() {
    setEmitindo(true);
    try {
      const r = await fetch('/api/curso/certificado', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.productId, nome: nomeCert }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Não foi possível emitir.', 'error'); return; }
      setCert(d.codigo); toast('Certificado emitido!', 'success');
    } finally { setEmitindo(false); }
  }

  const Lista = (
    <nav className="mc-lista" aria-label="Conteúdo do curso">
      <div className="mc-lista-h"><b>Conteúdo do curso</b><small>{total} aula{total === 1 ? '' : 's'}{minutos ? ` · ${duracaoTexto(minutos)}` : ''}</small></div>
      {p.modulos.map((m, mi) => {
        const aberto = abertos.has(m.id);
        const fm = m.aulas.filter((a) => feitas.has(a.id)).length;
        return (
          <div key={m.id} className="mc-mod">
            <button type="button" className="mc-mod-h" aria-expanded={aberto} onClick={() => setAbertos((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}>
              <span className="mc-mod-n">{mi + 1}</span>
              <span className="mc-mod-t"><b>{m.titulo}</b><small>{fm}/{m.aulas.length} concluídas</small></span>
              <Icon name="chevronDown" size={16} style={{ transform: aberto ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
            </button>
            {aberto && (
              <ul>
                {m.aulas.map((a) => {
                  const feita = feitas.has(a.id);
                  return (
                    <li key={a.id}>
                      <button type="button" className={`mc-aula ${atual === a.id ? 'on' : ''} ${a.liberada ? '' : 'trava'}`} disabled={!a.liberada}
                        onClick={() => { setAtual(a.id); setListaAberta(false); }} aria-current={atual === a.id ? 'true' : undefined}>
                        <span className={`mc-ic ${feita ? 'ok' : ''}`} aria-hidden="true">
                          {!a.liberada ? <Icon name="lock" size={13} /> : feita ? <Icon name="check" size={13} /> : <Icon name={a.video_url ? 'play' : 'file'} size={12} />}
                        </span>
                        <span className="mc-aula-t">
                          {a.titulo}
                          <small>
                            {!a.liberada && a.liberaEm ? `Libera em ${dataBR(a.liberaEm)}` : !a.liberada && p.papel === 'visitante' ? 'Disponível após a compra' : a.duracao_min ? duracaoTexto(a.duracao_min) : ''}
                            {a.previa && p.papel === 'visitante' && a.liberada ? 'Prévia grátis' : ''}
                            {!a.publicada ? ' · rascunho' : ''}
                          </small>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!m.aulas.length && <li className="mc-vazio">Nenhuma aula neste módulo ainda.</li>}
              </ul>
            )}
          </div>
        );
      })}
      {!p.modulos.length && <p className="mc-vazio">O produtor ainda está montando o conteúdo.</p>}
    </nav>
  );

  return (
    <div className="mc" style={{ ['--mc' as any]: cor }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {p.papel === 'dono' || p.papel === 'admin' ? (
        <div className="mc-faixa"><Icon name="eye" size={15} /> Você está vendo como {p.papel === 'dono' ? 'produtor' : 'admin'}: tudo liberado, inclusive rascunhos. <Link href={`/vender/curso/${p.productId}`}>Editar curso</Link></div>
      ) : p.papel === 'visitante' ? (
        <div className="mc-faixa"><Icon name="gift" size={15} /> Você está vendo as aulas grátis. <Link href={`/produto/${p.productId}`}>Garanta o curso completo →</Link></div>
      ) : null}

      <header className="mc-top">
        <div className="mc-top-l">
          <Link href={p.pedidoId ? `/pedido/${p.pedidoId}` : aluno ? '/minhas-compras' : `/produto/${p.productId}`} className="mc-voltar"><Icon name="arrowLeft" size={16} /> {p.pedidoId ? 'Meu pedido' : 'Voltar'}</Link>
          <div className="mc-tit"><h1>{p.titulo}</h1><span>por {p.loja}</span></div>
        </div>
        {p.papel !== 'visitante' && total > 0 && (
          <div className="mc-prog" aria-label={`Progresso: ${pct}%`}>
            <div className="mc-prog-t"><b>{pct}%</b><span>{feitasN} de {total} aulas</span></div>
            <div className="mc-barra"><i style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </header>

      <div className="mc-grid">
        <main className="mc-main">
          {!aula ? (
            <section className="mc-card mc-boas">
              {p.capa && <img src={p.capa} alt="" className="mc-capa" />}
              <div>
                <h2>{feitasN ? 'Bem-vindo de volta!' : 'Boas-vindas ao curso'}</h2>
                {p.config.boas_vindas ? <TextoFormatado texto={p.config.boas_vindas} corLink={cor} /> : <p className="muted">Assista às aulas na ordem e marque cada uma como concluída para acompanhar seu progresso.</p>}
                {continuar && <button type="button" className="btn mc-btn" onClick={() => setAtual(continuar.id)}><Icon name="play" size={16} /> {feitasN ? 'Continuar de onde parei' : 'Começar o curso'}</button>}
                {!continuar && total > 0 && p.papel === 'visitante' && <Link href={`/produto/${p.productId}`} className="btn mc-btn">Ver o curso completo</Link>}
              </div>
            </section>
          ) : (
            <section className="mc-aulaview">
              {video ? (
                <div className="mc-video">
                  {video.tipo === 'iframe'
                    ? <iframe src={video.src} title={aula.titulo} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
                    : <video src={video.src} controls controlsList="nodownload" preload="metadata" />}
                </div>
              ) : aula.video_url ? <div className="mc-card muted">Não foi possível abrir este vídeo. Avise o produtor pela conversa do pedido.</div> : null}
              <div className="mc-card">
                <div className="mc-aula-cab">
                  <div>
                    <small className="mc-mod-tag">{aula.modulo}{aula.duracao_min ? ` · ${duracaoTexto(aula.duracao_min)}` : ''}</small>
                    <h2>{aula.titulo}</h2>
                  </div>
                  <button type="button" className={`btn mc-feito ${feitas.has(aula.id) ? 'ok' : ''}`} disabled={salvando} onClick={() => alternarConcluida(aula.id, !feitas.has(aula.id))}>
                    <Icon name={feitas.has(aula.id) ? 'checkCircle' : 'check'} size={16} /> {feitas.has(aula.id) ? 'Concluída' : 'Marcar como concluída'}
                  </button>
                </div>
                {aula.conteudo && <div className="mc-texto"><TextoFormatado texto={aula.conteudo} corLink={cor} /></div>}
                {aula.materiais.length > 0 && (
                  <div className="mc-mat">
                    <b>Materiais da aula</b>
                    {aula.materiais.map((m, i) => (
                      <a key={i} href={`/api/curso/material?aula=${aula.id}&i=${i}`} target="_blank" rel="noopener noreferrer">
                        <Icon name={m.tipo === 'arquivo' ? 'download' : 'link'} size={15} /> {m.titulo}
                      </a>
                    ))}
                  </div>
                )}
                <div className="mc-nav">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!anterior} onClick={() => anterior && setAtual(anterior.id)}><Icon name="arrowLeft" size={15} /> Anterior</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAtual(null)}>Início</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!seguinte} onClick={() => seguinte && setAtual(seguinte.id)}>Próxima <Icon name="arrowRight" size={15} /></button>
                </div>
              </div>
            </section>
          )}

          {aluno && completo && p.config.certificado && (
            <section className="mc-card mc-cert">
              <div className="mc-cert-ic"><Icon name="award" size={26} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>Parabéns, você concluiu o curso!</h3>
                {cert ? (
                  <p>Seu certificado está pronto. <Link href={`/curso/${p.productId}/certificado`}>Abrir certificado</Link></p>
                ) : (
                  <>
                    <p>Confira seu nome como deve aparecer no certificado:</p>
                    <div className="mc-cert-f">
                      <input value={nomeCert} maxLength={120} onChange={(e) => setNomeCert(e.target.value)} placeholder="Nome completo" aria-label="Nome no certificado" />
                      <button type="button" className="btn mc-btn" disabled={emitindo} onClick={emitir}>{emitindo ? 'Emitindo…' : 'Emitir certificado'}</button>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          <button type="button" className="btn btn-ghost mc-lista-btn" onClick={() => setListaAberta((v) => !v)} aria-expanded={listaAberta}>
            <Icon name="menu" size={16} /> {listaAberta ? 'Esconder aulas' : 'Ver todas as aulas'}
          </button>
          <div className={`mc-lista-cel ${listaAberta ? 'aberta' : ''}`}>{Lista}</div>
        </main>
        <aside className="mc-aside">{Lista}</aside>
      </div>
    </div>
  );
}

const CSS = `
.mc{max-width:1280px;margin:0 auto;padding:18px var(--gut,16px) 60px}
.mc-faixa{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--soft);border:1px solid #FFD9BD;border-radius:12px;padding:10px 14px;font-size:13.5px;font-weight:700;margin-bottom:14px}
.mc-faixa a{color:var(--orange-ink);text-decoration:underline}
.mc-top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.mc-top-l{display:flex;flex-direction:column;gap:6px;min-width:0}
.mc-voltar{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:var(--sub)}
.mc-voltar:hover{color:var(--text)}
.mc-tit h1{font-family:'Outfit';font-size:clamp(22px,3vw,30px);font-weight:900;letter-spacing:-.8px;margin:0;line-height:1.15;overflow-wrap:anywhere}
.mc-tit span{color:var(--sub);font-size:13.5px;font-weight:700}
.mc-prog{min-width:220px;flex:0 1 300px}
.mc-prog-t{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.mc-prog-t b{font-family:'Outfit';font-size:22px;font-weight:900;color:var(--mc)}
.mc-prog-t span{font-size:13px;color:var(--sub);font-weight:700}
.mc-barra{height:10px;border-radius:50px;background:var(--bg2);overflow:hidden}
.mc-barra i{display:block;height:100%;border-radius:50px;background:var(--mc);transition:width .5s var(--ease)}
.mc-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;align-items:start}
.mc-main{display:flex;flex-direction:column;gap:16px;min-width:0}
.mc-card{background:#fff;border:1px solid var(--border);border-radius:20px;padding:20px 22px}
.mc-boas{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
.mc-boas>div{flex:1 1 280px;min-width:0}
.mc-boas h2{font-family:'Outfit';font-size:22px;font-weight:900;margin:0 0 8px}
.mc-capa{width:180px;max-width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px;flex:none}
.mc-btn{background:var(--mc);color:#fff;margin-top:14px;display:inline-flex;align-items:center;gap:8px}
.mc-btn:hover{filter:brightness(1.06)}
.mc-video{position:relative;width:100%;aspect-ratio:16/9;background:#0F0F1A;border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(22,22,42,.14)}
.mc-video iframe,.mc-video video{position:absolute;inset:0;width:100%;height:100%;border:0}
.mc-aula-cab{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}
.mc-aula-cab h2{font-family:'Outfit';font-size:22px;font-weight:900;margin:2px 0 0;letter-spacing:-.4px;overflow-wrap:anywhere}
.mc-mod-tag{color:var(--sub);font-weight:800;font-size:12.5px}
.mc-feito{background:var(--bg2);color:var(--text);display:inline-flex;align-items:center;gap:8px;flex:none}
.mc-feito.ok{background:var(--green-bg);color:var(--green)}
.mc-texto{margin-top:16px;font-size:15.5px;line-height:1.6;border-top:1px solid var(--border);padding-top:16px}
.mc-mat{margin-top:16px;display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--border);padding-top:16px}
.mc-mat a{display:flex;align-items:center;gap:10px;padding:11px 14px;border:1px solid var(--border);border-radius:12px;font-weight:800;font-size:14px;color:var(--text);overflow-wrap:anywhere}
.mc-mat a:hover{border-color:var(--mc);background:var(--soft)}
.mc-nav{display:flex;justify-content:space-between;gap:8px;margin-top:18px;flex-wrap:wrap}
.mc-cert{display:flex;gap:16px;align-items:flex-start;border-color:#FFD9BD;background:linear-gradient(135deg,#FFF8F2,#fff)}
.mc-cert h3{font-family:'Outfit';font-size:19px;font-weight:900;margin:0 0 4px}
.mc-cert p{margin:0 0 8px;color:var(--sub)}
.mc-cert a{color:var(--orange-ink);font-weight:800;text-decoration:underline}
.mc-cert-ic{width:52px;height:52px;border-radius:16px;background:var(--mc);color:#fff;display:flex;align-items:center;justify-content:center;flex:none}
.mc-cert-f{display:flex;gap:8px;flex-wrap:wrap}
.mc-cert-f input{flex:1 1 220px;height:46px;border-radius:12px;border:1.5px solid var(--border);padding:0 14px;font-size:15px}
.mc-cert-f .mc-btn{margin-top:0}
.mc-aside{position:sticky;top:96px;max-height:calc(100vh - 110px);overflow:auto;border-radius:20px}
.mc-lista{background:#fff;border:1px solid var(--border);border-radius:20px;overflow:hidden}
.mc-lista-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:14px 16px;border-bottom:1px solid var(--border)}
.mc-lista-h b{font-family:'Outfit';font-size:16px}
.mc-lista-h small{color:var(--sub);font-weight:700}
.mc-mod{border-bottom:1px solid var(--border)}
.mc-mod:last-child{border-bottom:0}
.mc-mod-h{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;gap:10px;align-items:center;padding:13px 16px;background:var(--surface)}
.mc-mod-h:focus-visible{outline:2px solid var(--mc);outline-offset:-2px}
.mc-mod-n{width:26px;height:26px;border-radius:8px;background:#fff;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:900;font-size:12.5px;flex:none}
.mc-mod-t{flex:1;min-width:0;display:flex;flex-direction:column}
.mc-mod-t b{font-size:14px;overflow-wrap:anywhere}
.mc-mod-t small{color:var(--sub);font-size:12px;font-weight:700}
.mc-mod ul{list-style:none;margin:0;padding:4px 0}
.mc-aula{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;gap:10px;align-items:flex-start;padding:10px 16px 10px 20px;font-size:14px;font-weight:700;color:var(--text)}
.mc-aula:hover:not(:disabled){background:var(--soft)}
.mc-aula.on{background:var(--soft);box-shadow:inset 3px 0 0 var(--mc)}
.mc-aula.trava{color:var(--muted);cursor:not-allowed}
.mc-aula:focus-visible{outline:2px solid var(--mc);outline-offset:-2px}
.mc-ic{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--border2,#E0D8D0);display:flex;align-items:center;justify-content:center;flex:none;margin-top:1px;color:var(--sub)}
.mc-ic.ok{background:var(--green);border-color:var(--green);color:#fff}
.mc-aula-t{display:flex;flex-direction:column;min-width:0;overflow-wrap:anywhere}
.mc-aula-t small{color:var(--muted);font-size:12px;font-weight:700}
.mc-vazio{padding:12px 20px;color:var(--muted);font-size:13px}
.mc-lista-btn,.mc-lista-cel{display:none}
@media(max-width:960px){
  .mc-grid{grid-template-columns:minmax(0,1fr)}
  .mc-aside{display:none}
  .mc-lista-btn{display:inline-flex;align-items:center;gap:8px;justify-content:center}
  .mc-lista-cel.aberta{display:block}
  .mc-prog{flex:1 1 100%}
  .mc-card{padding:16px}
  .mc-video{border-radius:14px}
  .mc-capa{width:100%;aspect-ratio:16/9}
  .mc-feito{width:100%;justify-content:center}
}
`;
