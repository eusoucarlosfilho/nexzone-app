'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import BoostButton from './BoostButton';
import EditProductForm from './EditProductForm';
import ProductThumb from '@/components/ProductThumb';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const data = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const POR_PAGINA = 10;

type Filtro = 'todos' | 'ativo' | 'em_revisao' | 'parados' | 'destaque';
type Ordem = 'recentes' | 'antigos' | 'preco_menor' | 'preco_maior' | 'vendas' | 'nota';
type Plano = { dias: number; valor: number; label: string };

export function destaqueAtivo(p: any, agora = Date.now()) {
  return !!p.destaque_ate && new Date(p.destaque_ate).getTime() > agora;
}

export default function ProductManager({ products, userId, planos }: { products: any[]; userId: string; planos: Plano[] }) {
  const router = useRouter();
  const [list, setList] = useState<any[]>(products);
  useEffect(() => { setList(products); }, [products]);

  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [cat, setCat] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('recentes');
  const [pagina, setPagina] = useState(1);
  const [editar, setEditar] = useState<{ id: string; foco: 'imagens' | null } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ tipo: 'excluir' | 'pausar'; p: any } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // fecha o menu "Mais ações" com clique fora ou Esc
  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [menu]);

  // Indicadores calculados dos produtos reais do vendedor
  const stats = useMemo(() => {
    const agora = Date.now();
    return {
      total: list.length,
      ativo: list.filter((p) => p.status === 'ativo').length,
      em_revisao: list.filter((p) => p.status === 'em_revisao').length,
      parados: list.filter((p) => p.status === 'reprovado' || p.status === 'pausado').length,
      destaque: list.filter((p) => destaqueAtivo(p, agora)).length,
    };
  }, [list]);

  const categorias = useMemo(() => Array.from(new Set(list.map((p) => p.categoria).filter(Boolean))).sort(), [list]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const agora = Date.now();
    let l = list.filter((p) => {
      if (t && !String(p.titulo || '').toLowerCase().includes(t)) return false;
      if (cat && p.categoria !== cat) return false;
      if (filtro === 'ativo' && p.status !== 'ativo') return false;
      if (filtro === 'em_revisao' && p.status !== 'em_revisao') return false;
      if (filtro === 'parados' && !(p.status === 'reprovado' || p.status === 'pausado')) return false;
      if (filtro === 'destaque' && !destaqueAtivo(p, agora)) return false;
      return true;
    });
    const preco = (p: any) => Number(p.preco_promo ?? p.preco);
    const cmp: Record<Ordem, (a: any, b: any) => number> = {
      recentes: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
      antigos: (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
      preco_menor: (a, b) => preco(a) - preco(b),
      preco_maior: (a, b) => preco(b) - preco(a),
      vendas: (a, b) => Number(b.vendas || 0) - Number(a.vendas || 0),
      nota: (a, b) => Number(b.nota || 0) - Number(a.nota || 0),
    };
    l = [...l].sort(cmp[ordem]);
    return l;
  }, [list, busca, cat, filtro, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pag = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  useEffect(() => { setPagina(1); }, [busca, cat, filtro, ordem]);

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
      if (r.ok) {
        setList((l) => l.filter((p) => p.id !== id));
        toast('Pedido de exclusão enviado.', 'success');
        router.refresh(); // confere com o servidor: se o produto não foi excluído, ele volta à lista
      } else toast(d.error || 'Não foi possível excluir.', 'error');
    } catch { toast('Falha de conexão. Tente de novo.', 'error'); }
    finally { setBusy(null); setConfirmar(null); }
  }

  function copiar(texto: string, msg: string) {
    navigator.clipboard?.writeText(texto).then(() => toast(msg, 'success'), () => toast('Não consegui copiar. Copie manualmente: ' + texto, 'error'));
    setMenu(null);
  }

  const cards: { id: Filtro; label: string; value: number; icon: string }[] = [
    { id: 'todos', label: 'Produtos cadastrados', value: stats.total, icon: 'package' },
    { id: 'ativo', label: 'Ativos', value: stats.ativo, icon: 'checkCircle' },
    { id: 'em_revisao', label: 'Em revisão', value: stats.em_revisao, icon: 'hourglass' },
    { id: 'parados', label: 'Pausados ou reprovados', value: stats.parados, icon: 'alert' },
    { id: 'destaque', label: 'Com destaque ativo', value: stats.destaque, icon: 'star' },
  ];

  return (
    <div>
      <div className="ui-stats" role="group" aria-label="Resumo dos seus produtos (clique para filtrar)">
        {cards.map((c) => (
          <button key={c.id} type="button" className={`ui-stat ${filtro === c.id ? 'on' : ''}`} aria-pressed={filtro === c.id} onClick={() => setFiltro(c.id)}>
            <span className="ui-stat-ic" aria-hidden="true"><Icon name={c.icon} size={18} /></span>
            <b>{c.value}</b>
            <small>{c.label}</small>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState icon="package" title="Você ainda não cadastrou produtos"
            text="Cadastre seu primeiro produto digital. Ele passa por uma revisão rápida antes de ir ao ar."
            action={<Link href="/vender/produtos/novo" className="btn btn-pri">+ Cadastrar novo produto</Link>} />
        </div>
      ) : (
        <div className="card pm-card">
          <div className="ui-toolbar">
            <label className="ui-grow" style={{ position: 'relative', display: 'flex' }}>
              <span className="sr-only">Buscar produto pelo nome</span>
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome do produto" style={{ width: '100%' }} />
            </label>
            <label><span className="sr-only">Status</span>
              <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
                <option value="todos">Todos os status</option>
                <option value="ativo">Ativos</option>
                <option value="em_revisao">Em revisão</option>
                <option value="parados">Pausados ou reprovados</option>
                <option value="destaque">Com destaque ativo</option>
              </select>
            </label>
            <label><span className="sr-only">Categoria</span>
              <select value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Todas as categorias</option>
                {categorias.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label><span className="sr-only">Ordenar</span>
              <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
                <option value="recentes">Mais recentes</option>
                <option value="antigos">Mais antigos</option>
                <option value="preco_menor">Menor preço</option>
                <option value="preco_maior">Maior preço</option>
                <option value="vendas">Mais vendidos</option>
                <option value="nota">Melhor avaliados</option>
              </select>
            </label>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }} aria-live="polite">
            {filtrados.length} de {list.length} produto{list.length === 1 ? '' : 's'}
          </div>

          {filtrados.length === 0 ? (
            <EmptyState icon="search" title="Nenhum produto com esses filtros"
              action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => { setBusca(''); setCat(''); setFiltro('todos'); }}>Limpar filtros</button>} />
          ) : (
            <ul className="pm-list">
              {visiveis.map((p) => {
                const emDestaque = destaqueAtivo(p);
                const ativo = p.status === 'ativo';
                const aberto = editar?.id === p.id;
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
                        {p.status === 'em_revisao' && <div className="ui-help">Aguardando a aprovação da equipe. Você é avisado quando for publicado.</div>}
                        {p.status === 'reprovado' && <div className="ui-help">Não aprovado. Edite o anúncio e salve para enviar de novo à revisão.</div>}
                        {p.status === 'pausado' && <div className="ui-help">Pausado: não aparece no site. Reative para enviar de novo à revisão.</div>}
                      </div>
                      <div className="pm-nums">
                        <div className="pm-price">
                          {p.preco_promo ? <><s className="muted">{money(p.preco)}</s> <b>{money(p.preco_promo)}</b></> : <b>{money(p.preco)}</b>}
                        </div>
                        <div className="muted" style={{ fontSize: 12.5 }}>
                          {Number(p.vendas || 0).toLocaleString('pt-BR')} venda{Number(p.vendas) === 1 ? '' : 's'}
                          {Number(p.nota) > 0 ? ` · ★ ${Number(p.nota).toFixed(1)}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="pm-actions">
                      {ativo
                        ? <Link href={`/produto/${p.id}`} className="btn btn-ghost btn-sm" target="_blank" rel="noopener"><Icon name="eye" size={16} /> Ver anúncio</Link>
                        : <span className="btn btn-ghost btn-sm pm-off" title="O anúncio só fica visível depois de aprovado">Ver anúncio</span>}
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy === p.id} aria-expanded={aberto && editar?.foco !== 'imagens'}
                        onClick={() => setEditar(aberto && editar?.foco !== 'imagens' ? null : { id: p.id, foco: null })}><Icon name="edit" size={16} /> {aberto ? 'Fechar edição' : 'Editar'}</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy === p.id}
                        onClick={() => setEditar({ id: p.id, foco: 'imagens' })}><Icon name="image" size={16} /> Imagens</button>
                      {ativo && !emDestaque && <BoostButton productId={p.id} destaqueAte={p.destaque_ate} planos={planos} />}
                      {!ativo && !emDestaque && <span className="btn btn-ghost btn-sm pm-off" title="O destaque fica disponível depois que o anúncio for aprovado"><Icon name="rocket" size={16} /> Destacar</span>}

                      <div className="pm-more" ref={menu === p.id ? menuRef : undefined}>
                        <button type="button" className="btn btn-ghost btn-sm" aria-haspopup="menu" aria-expanded={menu === p.id}
                          onClick={() => setMenu(menu === p.id ? null : p.id)}>Mais ações <Icon name="chevronDown" size={14} /></button>
                        {menu === p.id && (
                          <div className="pm-menu" role="menu">
                            <button role="menuitem" type="button" onClick={() => { setMenu(null); router.push(`/vender/checkout/${p.id}`); }}><Icon name="palette" size={15} /> Configurar checkout</button>
                            <button role="menuitem" type="button" disabled={!ativo} onClick={() => copiar(`${window.location.origin}/produto/${p.id}`, 'Link do produto copiado!')}><Icon name="link" size={15} /> Copiar link do anúncio</button>
                            <button role="menuitem" type="button" disabled={!ativo} onClick={() => copiar(`${window.location.origin}/checkout/${p.id}`, 'Link de checkout copiado! Use em páginas de venda externas.')}><Icon name="cart" size={15} /> Copiar link de checkout</button>
                            {p.status === 'pausado'
                              ? <button role="menuitem" type="button" onClick={() => { setMenu(null); patch(p.id, 'reativar'); }}><Icon name="send" size={15} /> Reativar (envia para revisão)</button>
                              : <button role="menuitem" type="button" onClick={() => { setMenu(null); setConfirmar({ tipo: 'pausar', p }); }}><Icon name="sleep" size={15} /> Pausar anúncio</button>}
                            <button role="menuitem" type="button" className="pm-danger" onClick={() => { setMenu(null); setConfirmar({ tipo: 'excluir', p }); }}><Icon name="trash" size={15} /> Excluir</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {aberto && (
                      <EditProductForm key={`${p.id}-${editar?.foco}`} product={p} userId={userId} foco={editar?.foco}
                        onCancel={() => setEditar(null)}
                        onSaved={(novo) => { setList((l) => l.map((x) => x.id === p.id ? novo : x)); setEditar(null); router.refresh(); }} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {totalPaginas > 1 && (
            <nav className="ui-pager" aria-label="Páginas da lista de produtos">
              <button type="button" className={pag <= 1 ? 'off' : ''} disabled={pag <= 1} onClick={() => setPagina(pag - 1)}>‹ Anterior</button>
              <span aria-current="page" className="on">{pag} de {totalPaginas}</span>
              <button type="button" className={pag >= totalPaginas ? 'off' : ''} disabled={pag >= totalPaginas} onClick={() => setPagina(pag + 1)}>Próxima ›</button>
            </nav>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmar}
        title={confirmar?.tipo === 'excluir' ? 'Excluir este produto?' : 'Pausar este anúncio?'}
        text={confirmar?.tipo === 'excluir'
          ? `"${confirmar?.p?.titulo}" será removido do seu catálogo. Esta ação não pode ser desfeita. Produtos que já têm vendas podem não ser excluídos.`
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
