'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/lib/toast';
import {
  PLATAFORMAS, ROTULO_PLATAFORMA, ROTULO_STATUS, STATUS_OFERTA, MOEDAS, formatarPreco, precisaVerificar,
  type OfertaParceira, type StatusOferta,
} from '@/lib/ofertas/tipos';
import { validarOferta } from '@/lib/ofertas/validar';
import { validarCsv, gerarSqlImportacao, MAX_LINHAS_CSV, type Previa } from '@/lib/ofertas/csv';
import { MIX_PADRAO, type ConfigMix } from '@/lib/ofertas/mix';

type Aba = 'ofertas' | 'importar' | 'exibicao' | 'desempenho';
type Props = { liberado: boolean; motivo: string | null; listaConfigurada: boolean; categorias: string[] };

const VAZIA: Record<string, any> = {
  title: '', slug: '', category: '', external_platform: 'mercadolivre', external_product_url: '', affiliate_url: '',
  image_url: '', price_reference: '', price_from: '', currency: 'BRL', producer_name: '', short_description: '', description: '',
  tags: '', authorization_note: '', priority: 0, featured: false, status: 'rascunho',
};

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...init });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}

export default function OfertasAdmin({ liberado, motivo, listaConfigurada, categorias }: Props) {
  const [aba, setAba] = useState<Aba>(liberado ? 'ofertas' : 'importar');

  return (
    <div className="ofa">
      <header className="ofa-top">
        <div>
          <Link href="/admin" className="ofa-voltar">← Admin</Link>
          <h1>Ofertas parceiras · produtos externos</h1>
          <p className="muted">Produtos de outros sites (Mercado Livre, Shopee, Amazon, Magalu, AliExpress, Hotmart, Kiwify…) exibidos no layout da loja. O botão Comprar leva ao site de origem: sem pedido, saldo, comissão interna ou CB Points.</p>
        </div>
      </header>

      {!liberado && (
        <div className="ofa-lock" role="alert">
          <Icon name="lock" size={20} />
          <div>
            <strong>Gravação bloqueada por segurança</strong>
            <p>{motivo}</p>
            <p>Enquanto a C1 não for corrigida, cadastrar, editar, publicar e importar só funcionam para administradores listados em <code>ADMIN_USER_IDS</code> (variável de ambiente do servidor){listaConfigurada ? ', e o seu usuário não está nela.' : ', que ainda não foi configurada.'} Você ainda pode validar um CSV e gerar o SQL para revisão na aba Importar.</p>
          </div>
        </div>
      )}

      <nav className="ofa-abas" role="tablist">
        {([['ofertas', 'Ofertas'], ['importar', 'Importar CSV'], ['exibicao', 'Exibição no site'], ['desempenho', 'Desempenho']] as [Aba, string][]).map(([id, r]) => (
          <button key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'on' : ''} onClick={() => setAba(id)}>{r}</button>
        ))}
      </nav>

      {aba === 'ofertas' && (liberado ? <ListaOfertas categorias={categorias} /> : <Bloqueado />)}
      {aba === 'importar' && <Importador liberado={liberado} />}
      {aba === 'exibicao' && (liberado ? <Exibicao /> : <Bloqueado />)}
      {aba === 'desempenho' && (liberado ? <Desempenho /> : <Bloqueado />)}
    </div>
  );
}

function Bloqueado() {
  return <div className="card ofa-card muted">Disponível quando a gravação administrativa for liberada (ver aviso acima).</div>;
}

// ---------------- Lista + formulário ----------------
function ListaOfertas({ categorias }: { categorias: string[] }) {
  const [filtros, setFiltros] = useState({ q: '', status: '', plataforma: '', categoria: '', verificar: false });
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<{ ofertas: OfertaParceira[]; total: number; porPagina: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editar, setEditar] = useState<Record<string, any> | null>(null);
  const [excluir, setExcluir] = useState<OfertaParceira | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const sp = new URLSearchParams();
    if (filtros.q) sp.set('q', filtros.q);
    if (filtros.status) sp.set('status', filtros.status);
    if (filtros.plataforma) sp.set('plataforma', filtros.plataforma);
    if (filtros.categoria) sp.set('categoria', filtros.categoria);
    if (filtros.verificar) sp.set('verificar', '1');
    sp.set('page', String(pagina));
    const r = await api(`/api/admin/partner-offers?${sp}`);
    if (!r.ok) { setErro(r.d.error || 'Não foi possível carregar.'); setDados(null); return; }
    setErro(null); setDados(r.d);
  }, [filtros, pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  async function acao(o: OfertaParceira, action: string, ok: string) {
    setOcupado(true);
    const r = await api(`/api/admin/partner-offers/${o.id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
    setOcupado(false);
    if (r.ok) { toast(ok, 'success'); carregar(); } else toast(r.d.error || 'Não foi possível.', 'error');
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    setOcupado(true);
    const r = await api(`/api/admin/partner-offers/${excluir.id}?confirmar=EXCLUIR`, { method: 'DELETE' });
    setOcupado(false);
    if (r.ok && Number(r.d.excluidos) > 0) { toast('Oferta excluída.', 'success'); setExcluir(null); carregar(); }
    else toast(r.d.error || 'Nada foi excluído.', 'error');
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  if (editar) return <Formulario inicial={editar} categorias={categorias} onFechar={(salvou) => { setEditar(null); if (salvou) carregar(); }} />;

  return (
    <div>
      <div className="ofa-filtros">
        <input type="search" placeholder="Buscar pelo nome" value={filtros.q} onChange={(e) => { setPagina(1); setFiltros({ ...filtros, q: e.target.value }); }} aria-label="Buscar" />
        <select value={filtros.status} onChange={(e) => { setPagina(1); setFiltros({ ...filtros, status: e.target.value }); }} aria-label="Situação">
          <option value="">Todas as situações</option>
          {STATUS_OFERTA.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
        </select>
        <select value={filtros.plataforma} onChange={(e) => { setPagina(1); setFiltros({ ...filtros, plataforma: e.target.value }); }} aria-label="Plataforma">
          <option value="">Todas as plataformas</option>
          {PLATAFORMAS.map((p) => <option key={p} value={p}>{ROTULO_PLATAFORMA[p]}</option>)}
        </select>
        <select value={filtros.categoria} onChange={(e) => { setPagina(1); setFiltros({ ...filtros, categoria: e.target.value }); }} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="ofa-chk"><input type="checkbox" checked={filtros.verificar} onChange={(e) => { setPagina(1); setFiltros({ ...filtros, verificar: e.target.checked }); }} /> Precisam de verificação</label>
        <button className="btn btn-pri btn-sm" onClick={() => setEditar({ ...VAZIA })}>+ Nova oferta</button>
      </div>

      {erro && <div className="card ofa-card" role="alert">{erro}</div>}
      {dados && dados.ofertas.length === 0 && <div className="card ofa-card muted">Nenhuma oferta com esses filtros.</div>}
      {dados && dados.ofertas.length > 0 && (
        <ul className="ofa-lista">
          {dados.ofertas.map((o) => {
            const verificar = precisaVerificar(o.last_verified_at);
            return (
              <li key={o.id} className="card ofa-item">
                <div className="ofa-item-info">
                  <strong>{o.title}</strong>
                  <small>{ROTULO_PLATAFORMA[o.external_platform] || o.external_platform} · {o.category} · {formatarPreco(o.price_reference, o.currency) || 'sem preço'}{o.price_from ? ` (de ${formatarPreco(o.price_from, o.currency)})` : ''}{o.producer_name ? ` · ${o.producer_name}` : ''}</small>
                  <div className="ofa-tags">
                    <span className={`ofa-st st-${o.status}`}>{ROTULO_STATUS[o.status]}</span>
                    {o.featured && <span className="ofa-st st-dest">Destaque · prioridade {o.priority}</span>}
                    {verificar
                      ? <span className="ofa-st st-alerta">Verificar link{o.last_verified_at ? ` (última: ${new Date(o.last_verified_at).toLocaleDateString('pt-BR')})` : ''}</span>
                      : <span className="ofa-st">Conferida em {new Date(o.last_verified_at!).toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <div className="ofa-acoes">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditar({ ...o, tags: (o.tags || []).join(', '), price_reference: o.price_reference ?? '', price_from: o.price_from ?? '' })}>Editar</button>
                  {o.status === 'ativo'
                    ? <button className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => acao(o, 'pausar', 'Oferta pausada.')}>Pausar</button>
                    : o.status !== 'arquivado' && <button className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => acao(o, 'ativar', 'Oferta publicada.')}>Publicar</button>}
                  <button className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => acao(o, 'verificar', 'Marcada como conferida hoje.')} title="Abra o link, confira se o produto e o preço continuam válidos e marque">Conferi o link</button>
                  <a className="btn btn-ghost btn-sm" href={o.affiliate_url || o.external_product_url} target="_blank" rel="noopener noreferrer nofollow">Abrir link</a>
                  <button className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => acao(o, o.featured ? 'tirar_destaque' : 'destacar', o.featured ? 'Destaque removido.' : 'Oferta em destaque.')}>{o.featured ? 'Tirar destaque' : 'Destacar'}</button>
                  {o.status !== 'arquivado'
                    ? <button className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => acao(o, 'arquivar', 'Oferta arquivada (fora do site).')}>Arquivar</button>
                    : <button className="btn btn-ghost btn-sm ofa-perigo" disabled={ocupado} onClick={() => setExcluir(o)}>Excluir</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {dados && totalPaginas > 1 && (
        <div className="ofa-pag">
          <button className="btn btn-ghost btn-sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina} de {totalPaginas} · {dados.total} ofertas</span>
          <button className="btn btn-ghost btn-sm" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima</button>
        </div>
      )}
      <ConfirmDialog open={!!excluir} danger busy={ocupado} title="Excluir oferta de vez?"
        text={`"${excluir?.title}" será apagada e não poderá ser recuperada. Para só tirar do ar, mantenha arquivada.`}
        confirmLabel="Excluir" onConfirm={confirmarExclusao} onCancel={() => setExcluir(null)} />
    </div>
  );
}

function Formulario({ inicial, categorias, onFechar }: { inicial: Record<string, any>; categorias: string[]; onFechar: (salvou: boolean) => void }) {
  const [f, setF] = useState<Record<string, any>>(inicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [puxando, setPuxando] = useState(false);
  const editando = !!inicial.id;
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));

  // "Puxar dados do link": preenche só os campos ainda vazios; tudo continua editável
  async function puxar() {
    const url = String(f.external_product_url || '').trim();
    if (!url) { toast('Cole primeiro o link de compra.', 'error'); return; }
    setPuxando(true);
    const r = await api('/api/admin/partner-offers/puxar-dados', { method: 'POST', body: JSON.stringify({ url }) });
    setPuxando(false);
    if (!r.ok) { toast(r.d.error || 'Não foi possível ler o link. Preencha manualmente.', 'error'); return; }
    const d = r.d.dados || {};
    const preenchidos: string[] = [];
    setF((x) => {
      const n = { ...x };
      for (const k of ['title', 'image_url', 'price_reference', 'currency', 'short_description'] as const) {
        if (d[k] && (!x[k] || (k === 'currency' && x[k] === 'BRL'))) { n[k] = d[k]; preenchidos.push(k); }
      }
      return n;
    });
    toast(preenchidos.length ? 'Dados preenchidos a partir do link. Revise antes de salvar.' : 'O link não trouxe nada novo (campos já preenchidos).', 'success');
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const local = validarOferta(f, { statusPadrao: 'rascunho' });
    if (!local.ok) { setErros(local.erros); toast('Corrija os campos destacados.', 'error'); return; }
    setErros({}); setSalvando(true);
    const r = editando
      ? await api(`/api/admin/partner-offers/${inicial.id}`, { method: 'PATCH', body: JSON.stringify(f) })
      : await api('/api/admin/partner-offers', { method: 'POST', body: JSON.stringify(f) });
    setSalvando(false);
    if (r.ok) { toast(editando ? 'Oferta atualizada.' : 'Oferta cadastrada.', 'success'); onFechar(true); }
    else { if (r.d.erros) setErros(r.d.erros); toast(r.d.error || 'Não foi possível salvar.', 'error'); }
  }

  const campo = (k: string, rotulo: string, el: React.ReactNode, ajuda?: string) => (
    <label className={`ofa-campo ${erros[k] ? 'erro' : ''}`}>
      <span>{rotulo}</span>{el}
      {erros[k] ? <small className="ofa-err">{erros[k]}</small> : ajuda ? <small>{ajuda}</small> : null}
    </label>
  );

  return (
    <form className="card ofa-card ofa-form" onSubmit={salvar} noValidate>
      <h2>{editando ? 'Editar oferta' : 'Nova oferta parceira'}</h2>
      <div className="ofa-grid2">
        {campo('title', 'Nome do produto *', <input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={140} />)}
        {campo('category', 'Categoria *', <select value={f.category} onChange={(e) => set('category', e.target.value)}><option value="">Escolha</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select>)}
        {campo('external_platform', 'Plataforma *', <select value={f.external_platform} onChange={(e) => set('external_platform', e.target.value)}>{PLATAFORMAS.map((p) => <option key={p} value={p}>{ROTULO_PLATAFORMA[p]}</option>)}</select>)}
        {campo('producer_name', 'Vendedor / produtor (interno)', <input value={f.producer_name || ''} onChange={(e) => set('producer_name', e.target.value)} maxLength={120} />, 'Só aparece no site se "Mostrar a origem" estiver ligado.')}
      </div>
      {campo('external_product_url', 'Link de compra * (para onde o botão Comprar leva)', (
        <span className="ofa-linha">
          <input type="url" inputMode="url" value={f.external_product_url} onChange={(e) => set('external_product_url', e.target.value)} placeholder="https://..." />
          <button type="button" className="btn btn-ghost btn-sm" onClick={puxar} disabled={puxando}>{puxando ? 'Lendo…' : 'Puxar dados do link'}</button>
        </span>
      ), 'https e do domínio oficial da plataforma escolhida ("Outro site" aceita qualquer https). Links encurtados (bit.ly etc.) são recusados.')}
      {campo('affiliate_url', 'Link de afiliado (opcional)', <input type="url" inputMode="url" value={f.affiliate_url || ''} onChange={(e) => set('affiliate_url', e.target.value)} placeholder="https://..." />, 'Se preenchido, o botão Comprar usa este link no lugar do link de compra.')}
      {campo('image_url', 'Imagem (link https autorizado)', <input type="url" inputMode="url" value={f.image_url || ''} onChange={(e) => set('image_url', e.target.value)} placeholder="https://..." />, 'Use só imagens que o produtor autorizou.')}
      <div className="ofa-grid4">
        {campo('price_reference', 'Preço', <input inputMode="decimal" value={f.price_reference ?? ''} onChange={(e) => set('price_reference', e.target.value)} placeholder="97,00" />, 'Vazio = "Ver preço".')}
        {campo('price_from', 'Preço "de" (opcional)', <input inputMode="decimal" value={f.price_from ?? ''} onChange={(e) => set('price_from', e.target.value)} placeholder="129,90" />, 'Maior que o preço: mostra o desconto.')}
        {campo('currency', 'Moeda', <select value={f.currency} onChange={(e) => set('currency', e.target.value)}>{MOEDAS.map((m) => <option key={m}>{m}</option>)}</select>)}
        {campo('priority', 'Prioridade (0 a 1000)', <input type="number" min={0} max={1000} value={f.priority} onChange={(e) => set('priority', e.target.value)} />)}
      </div>
      {campo('short_description', 'Resumo (card)', <input value={f.short_description || ''} onChange={(e) => set('short_description', e.target.value)} maxLength={200} />)}
      {campo('description', 'Descrição', <textarea rows={6} value={f.description || ''} onChange={(e) => set('description', e.target.value)} maxLength={5000} />, 'Escreva com suas palavras ou use texto autorizado. Sem promessas de resultado.')}
      {campo('tags', 'Tags (separadas por vírgula)', <input value={f.tags || ''} onChange={(e) => set('tags', e.target.value)} />)}
      {campo('authorization_note', 'Autorização / origem (interno)', <input value={f.authorization_note || ''} onChange={(e) => set('authorization_note', e.target.value)} maxLength={500} placeholder="Ex.: afiliação aprovada na Hotmart em 20/10/2026" />, 'Não aparece no site.')}
      <div className="ofa-grid2">
        {campo('status', 'Situação', <select value={f.status} onChange={(e) => set('status', e.target.value as StatusOferta)}>{STATUS_OFERTA.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}</select>)}
        <label className="ofa-chk ofa-chk-form"><input type="checkbox" checked={!!f.featured} onChange={(e) => set('featured', e.target.checked)} /> Destacar na vitrine</label>
      </div>
      <div className="ofa-form-acoes">
        <button type="button" className="btn btn-ghost" onClick={() => onFechar(false)}>Cancelar</button>
        <button type="submit" className="btn btn-pri" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  );
}

// ---------------- Importador CSV ----------------
function Importador({ liberado }: { liberado: boolean }) {
  const [texto, setTexto] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [publicar, setPublicar] = useState(false);
  const [sql, setSql] = useState('');

  async function lerArquivo(file: File | undefined) {
    if (!file) return;
    if (file.size > 1024 * 1024) { toast('Arquivo maior que 1 MB.', 'error'); return; }
    const t = await file.text();
    setTexto(t); setSql('');
    setPrevia(validarCsv(t));
  }

  async function verificarNoServidor() {
    setEnviando(true);
    const r = await api('/api/admin/partner-offers/import', { method: 'POST', body: JSON.stringify({ csv: texto, simular: true }) });
    setEnviando(false);
    if (r.ok) setPrevia(r.d.previa); else toast(r.d.error || 'Não foi possível verificar.', 'error');
  }

  async function importar() {
    setEnviando(true);
    const r = await api('/api/admin/partner-offers/import', { method: 'POST', body: JSON.stringify({ csv: texto }) });
    setEnviando(false);
    if (r.d.previa) setPrevia(r.d.previa);
    if (r.ok) toast(`${r.d.inseridas} oferta(s) salvas como rascunho. Revise e publique na aba Ofertas.`, 'success');
    else toast(r.d.error || 'Não foi possível importar.', 'error');
  }

  const validas = useMemo(() => (previa?.linhas || []).filter((l) => l.ok && l.dados).map((l) => l.dados!), [previa]);

  function baixar(nome: string, conteudo: string, tipo: string) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="card ofa-card">
      <h2>Importar ofertas por CSV</h2>
      <p className="muted">Até {MAX_LINHAS_CSV} ofertas e 1 MB por arquivo. Colunas obrigatórias: <code>nome</code>, <code>categoria</code>, <code>plataforma</code>, <code>url_produto</code>. Tudo entra como <strong>rascunho</strong> para revisão.</p>
      <input type="file" accept=".csv,text/csv" onChange={(e) => lerArquivo(e.target.files?.[0])} aria-label="Arquivo CSV" />

      {previa?.erroGeral && <p className="ofa-err" role="alert">{previa.erroGeral}</p>}
      {previa && previa.linhas.length > 0 && (
        <>
          <p className="ofa-resumo" aria-live="polite"><strong>{previa.validas}</strong> válidas · <strong>{previa.comErro}</strong> com erro · <strong>{previa.duplicadas}</strong> repetidas</p>
          <div className="ofa-tabela-wrap">
            <table className="ofa-tabela">
              <thead><tr><th>Linha</th><th>Oferta</th><th>Situação</th></tr></thead>
              <tbody>
                {previa.linhas.map((l) => (
                  <tr key={l.linha} className={l.ok ? '' : 'erro'}>
                    <td>{l.linha}</td>
                    <td>{l.dados ? <>{l.dados.title}<small>{ROTULO_PLATAFORMA[l.dados.external_platform]} · {l.dados.category}</small></> : '—'}</td>
                    <td>{l.ok ? 'OK' : l.erros.join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {liberado ? (
            <div className="ofa-form-acoes">
              <button className="btn btn-ghost" disabled={enviando} onClick={verificarNoServidor}>Checar repetidas no cadastro</button>
              <button className="btn btn-pri" disabled={enviando || !previa.validas} onClick={importar}>Importar {previa.validas} como rascunho</button>
            </div>
          ) : (
            <div className="ofa-sql">
              <p className="muted">Gravação bloqueada. Você pode gerar o SQL das linhas válidas para revisar e, se aprovar, rodar no Supabase (precisa da tabela do script 01).</p>
              <label className="ofa-chk"><input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} /> Já revisei: inserir como <strong>ativas</strong> (sem marcar, entram como rascunho)</label>
              <div className="ofa-form-acoes">
                <button className="btn btn-ghost" disabled={!validas.length} onClick={() => setSql(gerarSqlImportacao(validas, publicar))}>Gerar SQL ({validas.length})</button>
                {sql && <button className="btn btn-pri" onClick={() => baixar('importacao_ofertas.sql', sql, 'text/plain')}>Baixar .sql</button>}
              </div>
              {sql && <textarea readOnly rows={8} value={sql} className="ofa-sql-txt" aria-label="SQL gerado" />}
              <p className="muted" style={{ fontSize: 12 }}>A checagem de repetidas aqui é só dentro do arquivo. No banco, ofertas com o mesmo slug são ignoradas.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------- Exibição (proporção) ----------------
function Exibicao() {
  const [mix, setMix] = useState<ConfigMix>(MIX_PADRAO);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { api('/api/admin/partner-offers/config').then((r) => { if (r.ok) setMix(r.d.mix); }); }, []);
  const num = (k: keyof ConfigMix, v: string) => setMix({ ...mix, [k]: Number(v) });
  async function salvar() {
    setSalvando(true);
    const r = await api('/api/admin/partner-offers/config', { method: 'POST', body: JSON.stringify({ mix }) });
    setSalvando(false);
    if (r.ok) { setMix(r.d.mix); toast('Exibição atualizada.', 'success'); } else toast(r.d.error || 'Não foi possível salvar.', 'error');
  }
  return (
    <div className="card ofa-card">
      <h2>Exibição no site</h2>
      <p className="muted">Os produtos dos nossos vendedores aparecem sempre primeiro. Os produtos externos só completam as seções, dentro destes limites. As chaves valem na hora e não apagam nada.</p>
      <label className="ofa-chk ofa-chave"><input type="checkbox" checked={mix.ativo} onChange={(e) => setMix({ ...mix, ativo: e.target.checked })} /> <strong>Mostrar produtos externos no site</strong> · {mix.ativo ? 'Ligado' : 'Desligado'}</label>
      <fieldset className="ofa-plats" disabled={!mix.ativo}>
        <legend>Origens exibidas</legend>
        {PLATAFORMAS.map((p) => {
          const ligada = !mix.plataformasDesligadas.includes(p);
          return (
            <label key={p} className="ofa-chk">
              <input type="checkbox" checked={ligada} onChange={(e) => setMix({ ...mix, plataformasDesligadas: e.target.checked ? mix.plataformasDesligadas.filter((x) => x !== p) : [...mix.plataformasDesligadas, p] })} />
              {ROTULO_PLATAFORMA[p]}
            </label>
          );
        })}
      </fieldset>
      <label className="ofa-chk"><input type="checkbox" checked={mix.mostrarOrigem} onChange={(e) => setMix({ ...mix, mostrarOrigem: e.target.checked })} /> Mostrar a origem do produto (selo, nome da plataforma e do vendedor) · {mix.mostrarOrigem ? 'Ligado' : 'Desligado'}</label>
      <div className="ofa-grid2">
        <label className="ofa-campo"><span>Participação máxima numa seção com produtos nativos (%)</span><input type="number" min={0} max={100} value={mix.maxPct} onChange={(e) => num('maxPct', e.target.value)} /><small>Ex.: 30% = no máximo 3 ofertas a cada 7 produtos nativos.</small></label>
        <label className="ofa-campo"><span>Ofertas numa seção sem nenhum produto nativo</span><input type="number" min={0} max={48} value={mix.maxSemNativos} onChange={(e) => num('maxSemNativos', e.target.value)} /></label>
        <label className="ofa-campo"><span>Máximo de ofertas seguidas</span><input type="number" min={1} max={4} value={mix.maxSeguidos} onChange={(e) => num('maxSeguidos', e.target.value)} /></label>
        <label className="ofa-campo"><span>Ofertas na página inicial (0 esconde a seção)</span><input type="number" min={0} max={24} value={mix.homeQtd} onChange={(e) => num('homeQtd', e.target.value)} /></label>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Conforme os vendedores próprios crescerem, reduza a participação. Ordem das ofertas: destaque, prioridade e mais recentes. Número de vendas não é usado.</p>
      <div className="ofa-form-acoes"><button className="btn btn-pri" disabled={salvando} onClick={salvar}>Salvar</button></div>
    </div>
  );
}

// ---------------- Desempenho ----------------
function Desempenho() {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { api('/api/admin/partner-offers/stats').then((r) => (r.ok ? setD(r.d) : setErro(r.d.error || 'Indisponível.'))); }, []);
  if (erro) return <div className="card ofa-card" role="alert">{erro}</div>;
  if (!d) return <div className="card ofa-card muted">Carregando…</div>;
  const c = (v: number | null) => (v === null ? 'indisponível' : v.toLocaleString('pt-BR'));
  return (
    <div className="card ofa-card">
      <h2>Desempenho · últimos {d.periodoDias} dias</h2>
      <p className="ofa-aviso-k"><Icon name="info" size={16} /> {d.aviso}</p>
      {!d.cliquesDisponivel && <p className="muted" style={{ fontSize: 13 }}>Cliques de saída indisponíveis: a tabela do script 02 ainda não foi criada.</p>}
      <div className="ofa-kpis">
        <div><b>{c(d.totais.visualizacoes)}</b><small>visualizações das páginas de oferta</small></div>
        <div><b>{c(d.totais.cliques)}</b><small>cliques de saída</small></div>
      </div>
      <div className="ofa-tabela-wrap">
        <table className="ofa-tabela">
          <thead><tr><th>Oferta</th><th>Plataforma</th><th>Visualizações</th><th>Cliques</th><th>Taxa de saída</th></tr></thead>
          <tbody>
            {d.ofertas.map((o: any) => (
              <tr key={o.id}><td>{o.titulo}<small>{o.categoria} · {ROTULO_STATUS[o.status as StatusOferta]}</small></td><td>{ROTULO_PLATAFORMA[o.plataforma as keyof typeof ROTULO_PLATAFORMA]}</td><td>{o.visualizacoes}</td><td>{c(o.cliques)}</td><td>{o.taxaSaida === null ? '—' : `${o.taxaSaida}%`}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ofa-grid2" style={{ marginTop: 16 }}>
        <div><h3>Por categoria</h3><ul className="ofa-mini">{d.porCategoria.map((x: any) => <li key={x.nome}><span>{x.nome}</span><b>{x.visualizacoes} / {d.cliquesDisponivel ? x.cliques : '—'}</b></li>)}</ul></div>
        <div><h3>Por plataforma</h3><ul className="ofa-mini">{d.porPlataforma.map((x: any) => <li key={x.nome}><span>{ROTULO_PLATAFORMA[x.nome as keyof typeof ROTULO_PLATAFORMA] || x.nome}</span><b>{x.visualizacoes} / {d.cliquesDisponivel ? x.cliques : '—'}</b></li>)}</ul></div>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Formato: visualizações / cliques. A origem do tráfego de cada visita está na aba Audiência do admin.</p>
    </div>
  );
}
