'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from '@/lib/toast';
import PlanoRapido from './PlanoRapido';
import EditProductForm from './EditProductForm';
import ProductThumb from '@/components/ProductThumb';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EstoqueCampo from './EstoqueCampo';
import { rotuloItem, orientacaoItem } from '@/lib/moderacao';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const data = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

type Plano = { dias: number; valor: number; label: string };
type Filtros = { q: string; status: string; cat: string; ordem: string };
type Stats = { total: number; ativo: number; em_revisao: number; parados: number; destaque: number };

function destaqueAtivo(p: any) {
  return !!p.destaque_ate && new Date(p.destaque_ate).getTime() > Date.now();
}

// Meus produtos — a lista, os filtros e a paginação vêm do SERVIDOR (page.tsx).
// Este componente só recebe a página atual e troca os parâmetros da URL.
export default function ProductManager({ products, total, pagina, porPagina, stats, categorias, filtros, userId, planos, estoqueAtivo = false, planosModelo = { pcts: { basico: 5, destaque: 8, topo: 11 }, ativos: false } }: {
  planosModelo?: { pcts: { basico: number; destaque: number; topo: number }; ativos: boolean };
  products: any[]; total: number; pagina: number; porPagina: number; stats: Stats; categorias: string[];
  filtros: Filtros; userId: string; planos: Plano[]; estoqueAtivo?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [list, setList] = useState<any[]>(products);
  useEffect(() => { setList(products); }, [products]);

  const [busca, setBusca] = useState(filtros.q);
  useEffect(() => { setBusca(filtros.q); }, [filtros.q]);
  const [editar, setEditar] = useState<{ id: string; foco: 'imagens' | null; produto: any | null } | null>(null);
  const [carregandoEdicao, setCarregandoEdicao] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ tipo: 'excluir' | 'pausar'; p: any } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [menu]);

  // Troca parâmetros da URL; qualquer filtro novo volta para a página 1
  function irPara(mudancas: Partial<Filtros & { page: number }>) {
    const atual: Record<string, string> = { q: filtros.q, status: filtros.status, cat: filtros.cat, ordem: filtros.ordem, page: String(pagina) };
    const novo: Record<string, string> = { ...atual, ...Object.fromEntries(Object.entries(mudancas).map(([k, v]) => [k, String(v ?? '')])) };
    if (!('page' in mudancas)) novo.page = '1';
    const sp = new URLSearchParams();
    if (novo.q) sp.set('q', novo.q);
    if (novo.status && novo.status !== 'todos') sp.set('status', novo.status);
    if (novo.cat) sp.set('cat', novo.cat);
    if (novo.ordem && novo.ordem !== 'recentes') sp.set('ordem', novo.ordem);
    if (novo.page && novo.page !== '1') sp.set('page', novo.page);
    const s = sp.toString();
    setEditar(null);
    router.push(s ? `${pathname}?${s}` : pathname);
  }

  // Abre a edição: busca os campos sensíveis do produto só agora, no servidor, com checagem de dono
  async function abrirEdicao(id: string, foco: 'imagens' | null) {
    if (editar?.id === id && editar.produto) { setEditar({ ...editar, foco }); return; }
    setCarregandoEdicao(id);
    try {
      const r = await fetch(`/api/seller/product?id=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.produto) setEditar({ id, foco, produto: d.produto });
      else toast(d.error || 'Não foi possível abrir a edição.', 'error');
    } catch { toast('Falha de conexão. Tente de novo.', 'error'); }
    finally { setCarregandoEdicao(null); }
  }

  async function patch(id: string, action: 'pausar' | 'reativar') {
    setBusy(id);
    try {
      const r = await fetch('/api/seller/product', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, action }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setList((l) => l.map((p) => p.id === id ? { ...p, status: d.status } : p));
        toast(action === 'pausar' ? 'Produto pausado. Ele saiu do ar.' : 'Produto reenviado para revisão.', 'success');
        router.refresh();
      } else toast(d.error || 'Não foi possível atualizar o produto.', 'error');
    } catch { toast('Falha de conexão. Tente de novo.', 'error'); }
    finally { setBusy(null); }
  }

  async function excluir(id: string) {
    setBusy(id);
    try {
      const r = await fetch('/api/seller/product', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id }),
      });
      const d = await r.json().catch(() => ({}));
      // Só confirma quando o servidor informa que uma linha foi realmente apagada
      if (r.ok && Number(d.excluidos) > 0) {
        setList((l) => l.filter((p) => p.id !== id));
        toast('Produto excluído.', 'success');
        router.refresh();
      } else toast(d.error || 'O produto não foi excluído.', 'error');
    } catch { toast('Falha de conexão. Tente de novo.', 'error'); }
    finally { setBusy(null); setConfirmar(null); }
  }

  function copiar(texto: string, msg: string) {
    navigator.clipboard?.writeText(texto).then(() => toast(msg, 'success'), () => toast('Não consegui copiar. Copie manualmente: ' + texto, 'error'));
    setMenu(null);
  }

  const cards: { id: string; label: string; value: number; icon: string }[] = [
    { id: 'todos', label: 'Produtos cadastrados', value: stats.total, icon: 'package' },
    { id: 'ativo', label: 'Ativos', value: stats.ativo, icon: 'checkCircle' },
    { id: 'em_revisao', label: 'Em revisão', value: stats.em_revisao, icon: 'hourglass' },
    { id: 'parados', label: 'Pausados ou reprovados', value: stats.parados, icon: 'alert' },
    { id: 'destaque', label: 'Com destaque ativo', value: stats.destaque, icon: 'star' },
  ];
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const temFiltro = !!(filtros.q || filtros.cat || filtros.status !== 'todos');

  return (
    <div>
      <div className="ui-stats" role="group" aria-label="Resumo dos seus produtos (clique para filtrar)">
        {cards.map((c) => (
          <button key={c.id} type="button" className={`ui-stat ${filtros.status === c.id ? 'on' : ''}`} aria-pressed={filtros.status === c.id} onClick={() => irPara({ status: c.id })}>
            <span className="ui-stat-ic" aria-hidden="true"><Icon name={c.icon} size={18} /></span>
            <b>{c.value}</b>
            <small>{c.label}</small>
          </button>
        ))}
      </div>

      {stats.total === 0 ? (
        <div className="card">
          <EmptyState icon="package" title="Você ainda não cadastrou produtos"
            text="Cadastre seu primeiro produto digital. Ele passa por uma revisão rápida antes de ir ao ar."
            action={<Link href="/vender/produtos/novo" className="btn btn-pri">+ Cadastrar novo produto</Link>} />
        </div>
      ) : (
        <div className="card pm-card">
          <div className="ui-toolbar">
            <form className="ui-grow" role="search" style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); irPara({ q: busca.trim() }); }}>
              <label className="sr-only" htmlFor="pm-busca">Buscar produto pelo nome</label>
              <input id="pm-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome do produto" maxLength={100} style={{ flex: 1, minWidth: 0 }} />
              <button type="submit" className="btn btn-ghost btn-sm">Buscar</button>
            </form>
            <label><span className="sr-only">Status</span>
              <select value={filtros.status} onChange={(e) => irPara({ status: e.target.value })}>
                <option value="todos">Todos os status</option>
                <option value="ativo">Ativos</option>
                <option value="em_revisao">Em revisão</option>
                <option value="parados">Pausados ou reprovados</option>
                <option value="destaque">Com destaque ativo</option>
              </select>
            </label>
            <label><span className="sr-only">Categoria</span>
              <select value={filtros.cat} onChange={(e) => irPara({ cat: e.target.value })}>
                <option value="">Todas as categorias</option>
                {categorias.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label><span className="sr-only">Ordenar</span>
              <select value={filtros.ordem} onChange={(e) => irPara({ ordem: e.target.value })}>
                <option value="recentes">Mais recentes</option>
                <option value="antigos">Mais antigos</option>
                <option value="preco_menor">Menor preço</option>
                <option value="preco_maior">Maior preço</option>
                <option value="vendas">Mais vendas registradas</option>
                <option value="nota">Melhor avaliados</option>
              </select>
            </label>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }} aria-live="polite">
            {total} produto{total === 1 ? '' : 's'}{temFiltro ? ' com esses filtros' : ''} · página {Math.min(pagina, totalPaginas)} de {totalPaginas}
          </div>

          {list.length === 0 ? (
            <EmptyState icon="search" title={temFiltro ? 'Nenhum produto com esses filtros' : 'Nenhum produto nesta página'}
              action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(pathname)}>Limpar filtros</button>} />
          ) : (
            <ul className="pm-list">
              {list.map((p) => {
                const emDestaque = destaqueAtivo(p);
                const ativo = p.status === 'ativo';
                const aberto = !!editar && editar.id === p.id && !!editar.produto;
                const travado = p.moderacao === 'pausado_admin' || p.moderacao === 'cancelado';
                return (
                  <li key={p.id} className={`pm-item ${aberto ? 'open' : ''}`}>
                    <div className="pm-row">
                      <ProductThumb capa_url={p.capa_url} categoria={p.categoria} titulo={p.titulo} tamanho={64} raio={14} icone={26} />
                      <div className="pm-info">
                        <strong className="pm-tit">{p.titulo}</strong>
                        <div className="pm-meta">
                          {p.categoria && <span>{p.categoria}</span>}
                          <span>Cadastrado em {data(p.created_at)}</span>
                        </div>
                        <div className="pm-badges">
                          <StatusBadge tipo="produto" status={p.status} />
                          {emDestaque
                            ? <span className="ui-badge hot"><Icon name="star" size={12} /> Destaque até {data(p.destaque_ate)}</span>
                            : <span className="ui-badge neutral">Sem destaque</span>}
                        </div>
                        {p.status === 'em_revisao' && <div className="ui-help">Aguardando a aprovação da equipe.</div>}
                        {p.status === 'reprovado' && !p.moderacao && <div className="ui-help">Não aprovado. Edite o anúncio e salve para enviar de novo à revisão.</div>}
                        {p.status === 'pausado' && !travado && (p.pausado_sem_estoque
                          ? <div className="ui-help" style={{ color: 'var(--red)', fontWeight: 700 }}>Esgotado: saiu de venda quando o estoque zerou. Informe a nova quantidade abaixo e ele volta ao ar sozinho, sem revisão.</div>
                          : <div className="ui-help">Pausado: não aparece no site. Reative para enviar de novo à revisão.</div>)}
                      </div>
                      <div className="pm-nums">
                        <div className="pm-price">
                          {p.preco_promo ? <><s className="muted">{money(p.preco)}</s> <b>{money(p.preco_promo)}</b></> : <b>{money(p.preco)}</b>}
                        </div>
                        <div className="muted" style={{ fontSize: 12.5 }}>
                          {Number(p.vendas || 0).toLocaleString('pt-BR')} venda{Number(p.vendas) === 1 ? '' : 's'} registrada{Number(p.vendas) === 1 ? '' : 's'}
                          {Number(p.nota) > 0 ? ` · ★ ${Number(p.nota).toFixed(1)}` : ''}
                        </div>
                      </div>
                    </div>

                    {p.moderacao && (
                      <div className={`pm-mod ${p.moderacao}`} role="status">
                        <strong>
                          {p.moderacao === 'correcao' ? (p.status === 'em_revisao' ? 'Correção enviada: aguardando a equipe conferir' : 'O que corrigir')
                            : p.moderacao === 'pausado_admin' ? 'Pausado pela equipe do Comprei Barato' : 'Anúncio cancelado pela equipe do Comprei Barato'}
                        </strong>
                        {Array.isArray(p.moderacao_itens) && p.moderacao_itens.length > 0 && (
                          <ul>{p.moderacao_itens.map((i: string) => <li key={i}><b>{rotuloItem(i)}</b>{p.moderacao === 'correcao' && orientacaoItem(i) ? ` — ${orientacaoItem(i)}` : ''}</li>)}</ul>
                        )}
                        {p.moderacao_texto && <p>“{p.moderacao_texto}”</p>}
                        <small>
                          {p.moderacao === 'correcao'
                            ? (p.status === 'em_revisao' ? 'Você já reenviou. Se precisar, ainda pode ajustar e salvar de novo.' : 'Clique em Editar, faça os ajustes e salve: o anúncio volta para a revisão da equipe.')
                            : 'Este anúncio está travado e não pode ser editado nem reativado. Fale com o suporte se tiver dúvidas.'}
                        </small>
                      </div>
                    )}

                    {estoqueAtivo && (
                      <EstoqueCampo id={p.id} estoque={p.estoque ?? null}
                        onSalvo={(r) => setList((l) => l.map((x) => x.id === p.id ? { ...x, estoque: r.estoque, ...(r.status ? { status: r.status } : {}), pausado_sem_estoque: r.pausado_sem_estoque === true } : x))} />
                    )}

                    <div className="pm-actions">
                      {ativo
                        ? <Link href={`/produto/${p.id}`} className="btn btn-ghost btn-sm" target="_blank" rel="noopener"><Icon name="eye" size={16} /> Ver anúncio</Link>
                        : <span className="btn btn-ghost btn-sm pm-off" title="O anúncio só fica visível depois de aprovado">Ver anúncio</span>}
                      <button type="button" className="btn btn-ghost btn-sm" disabled={travado || busy === p.id || carregandoEdicao === p.id} aria-expanded={aberto}
                        title={travado ? 'Anúncio travado pela equipe' : undefined}
                        onClick={() => aberto ? setEditar(null) : abrirEdicao(p.id, null)}>
                        <Icon name="edit" size={16} /> {carregandoEdicao === p.id ? 'Abrindo…' : aberto ? 'Fechar edição' : 'Editar'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={travado || busy === p.id || carregandoEdicao === p.id}
                        onClick={() => abrirEdicao(p.id, 'imagens')}><Icon name="image" size={16} /> Imagens</button>
                      <Link href={`/vender/checkout/${p.id}`} className="btn btn-ghost btn-sm"><Icon name="cart" size={16} /> Checkout e order bump</Link>
                      <Link href={`/vender/curso/${p.id}`} className="btn btn-ghost btn-sm"><Icon name="play" size={16} /> Área de membros</Link>
                      <PlanoRapido productId={p.id} plano={p.plano || 'basico'} pcts={planosModelo.pcts} ativos={planosModelo.ativos} />

                      <div className="pm-more" ref={menu === p.id ? menuRef : undefined}>
                        <button type="button" className="btn btn-ghost btn-sm" aria-haspopup="menu" aria-expanded={menu === p.id}
                          onClick={() => setMenu(menu === p.id ? null : p.id)}>Mais ações <Icon name="chevronDown" size={14} /></button>
                        {menu === p.id && (
                          <div className="pm-menu" role="menu">
                            <button role="menuitem" type="button" onClick={() => { setMenu(null); router.push(`/vender/checkout/${p.id}`); }}><Icon name="palette" size={15} /> Checkout e order bump</button>
                            <button role="menuitem" type="button" onClick={() => { setMenu(null); router.push(`/vender/curso/${p.id}`); }}><Icon name="play" size={15} /> Área de membros (aulas)</button>
                            <button role="menuitem" type="button" disabled={!ativo} onClick={() => copiar(`${window.location.origin}/produto/${p.id}`, 'Link do produto copiado!')}><Icon name="link" size={15} /> Copiar link do anúncio</button>
                            <button role="menuitem" type="button" disabled={!ativo} onClick={() => copiar(`${window.location.origin}/checkout/${p.id}`, 'Link de checkout copiado! Use em páginas de venda externas.')}><Icon name="cart" size={15} /> Copiar link de checkout</button>
                            {travado ? null : p.status === 'pausado'
                              ? <button role="menuitem" type="button" onClick={() => { setMenu(null); patch(p.id, 'reativar'); }}><Icon name="send" size={15} /> Reativar (envia para revisão)</button>
                              : <button role="menuitem" type="button" onClick={() => { setMenu(null); setConfirmar({ tipo: 'pausar', p }); }}><Icon name="sleep" size={15} /> Pausar anúncio</button>}
                            <button role="menuitem" type="button" className="pm-danger" onClick={() => { setMenu(null); setConfirmar({ tipo: 'excluir', p }); }}><Icon name="trash" size={15} /> Excluir</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {aberto && (
                      <EditProductForm key={`${p.id}-${editar?.foco}`} product={editar!.produto} userId={userId} foco={editar?.foco}
                        onCancel={() => setEditar(null)}
                        onSaved={(novo) => {
                          setList((l) => l.map((x) => x.id === p.id ? { ...x, titulo: novo.titulo, categoria: novo.categoria, preco: novo.preco, preco_promo: novo.preco_promo, capa_url: novo.capa_url, status: novo.status } : x));
                          setEditar(null); router.refresh();
                        }} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {totalPaginas > 1 && (
            <nav className="ui-pager" aria-label="Páginas da lista de produtos">
              <button type="button" className={pagina <= 1 ? 'off' : ''} disabled={pagina <= 1} onClick={() => irPara({ page: pagina - 1 })}>‹ Anterior</button>
              <span aria-current="page" className="on">{Math.min(pagina, totalPaginas)} de {totalPaginas}</span>
              <button type="button" className={pagina >= totalPaginas ? 'off' : ''} disabled={pagina >= totalPaginas} onClick={() => irPara({ page: pagina + 1 })}>Próxima ›</button>
            </nav>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmar}
        title={confirmar?.tipo === 'excluir' ? 'Excluir este produto?' : 'Pausar este anúncio?'}
        text={confirmar?.tipo === 'excluir'
          ? `"${confirmar?.p?.titulo}" será removido do seu catálogo. Esta ação não pode ser desfeita. Produtos com pedidos não podem ser excluídos.`
          : `"${confirmar?.p?.titulo}" sai do ar imediatamente. Para voltar, ele passa por uma nova revisão.`}
        confirmLabel={confirmar?.tipo === 'excluir' ? 'Excluir produto' : 'Pausar anúncio'}
        danger={confirmar?.tipo === 'excluir'}
        busy={!!confirmar && busy === confirmar.p.id}
        onCancel={() => setConfirmar(null)}
        onConfirm={() => {
          if (!confirmar) return;
          if (confirmar.tipo === 'excluir') excluir(confirmar.p.id);
          else { const id = confirmar.p.id; setConfirmar(null); patch(id, 'pausar'); }
        }}
      />
    </div>
  );
}
