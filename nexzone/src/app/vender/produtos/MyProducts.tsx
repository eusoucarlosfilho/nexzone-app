'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from './FileUpload';
import CoverUpload from './CoverUpload';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const ST: Record<string, [string, string]> = {
  em_revisao: ['rev', 'Em revisão'], ativo: ['act', 'Ativo'], reprovado: ['rej', 'Reprovado'], pausado: ['rev', 'Pausado'],
};
const CATS = ['IA & Ferramentas', 'Templates & Planilhas', 'Design', 'Automações', 'Marketing Digital', 'Cursos & Ebooks'];

export default function MyProducts({ products, userId }: any) {
  const [list, setList] = useState<any[]>(products);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  function startEdit(p: any) {
    setEditId(p.id);
    setForm({
      titulo: p.titulo, descricao: p.descricao || '', categoria: p.categoria || CATS[0],
      preco: p.preco, preco_promo: p.preco_promo || '', tipo_entrega: p.tipo_entrega || 'arquivo',
      garantia_dias: p.garantia_dias || 7, conteudo_entrega: p.conteudo_entrega || '', emoji: p.emoji || '📦',
      arquivo_path: p.arquivo_path || '', arquivo_nome: p.arquivo_nome || '', capa_url: p.capa_url || '',
    });
  }

  async function salvar(id: string) {
    setBusy(id);
    try {
      const r = await fetch('/api/seller/product', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, ...form }),
      });
      const d = await r.json();
      if (r.ok) {
        setList((l) => l.map((p) => p.id === id ? { ...p, ...form, preco: Number(form.preco), preco_promo: form.preco_promo ? Number(form.preco_promo) : null, status: 'em_revisao' } : p));
        setEditId(null);
        router.refresh();
      } else alert(d.error || 'Erro ao salvar');
    } finally { setBusy(null); }
  }

  async function acao(id: string, action: 'pausar' | 'reativar') {
    setBusy(id);
    try {
      const r = await fetch('/api/seller/product', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, action }),
      });
      const d = await r.json();
      if (r.ok) setList((l) => l.map((p) => p.id === id ? { ...p, status: d.status } : p));
    } finally { setBusy(null); }
  }

  async function excluir(id: string) {
    if (!confirm('Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.')) return;
    setBusy(id);
    try {
      const r = await fetch('/api/seller/product', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id }),
      });
      if (r.ok) setList((l) => l.filter((p) => p.id !== id));
    } finally { setBusy(null); }
  }

  if (!list.length) return <div style={{ padding: 24 }} className="muted">Nenhum produto ainda.</div>;

  return (
    <div>
      {list.map((p) => {
        const st = ST[p.status] || ['rev', p.status];
        const editando = editId === p.id;
        return (
          <div key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="li" style={{ borderBottom: 'none' }}>
              <div className="em">{p.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontFamily: 'Outfit' }}>{p.titulo}</strong>
                <div className="muted">{money(p.preco_promo ?? p.preco)} · {p.categoria} · {p.vendas} vendas</div>
              </div>
              <span className={`pill ${st[0]}`}>{st[1]}</span>
              <div style={{ display: 'flex', gap: 6, marginLeft: 10 }}>
                <button className="btn btn-ghost btn-sm" disabled={busy === p.id} onClick={() => editando ? setEditId(null) : startEdit(p)}>{editando ? 'Fechar' : 'Editar'}</button>
                {p.status === 'pausado'
                  ? <button className="btn btn-ghost btn-sm" disabled={busy === p.id} onClick={() => acao(p.id, 'reativar')}>Reativar</button>
                  : <button className="btn btn-ghost btn-sm" disabled={busy === p.id} onClick={() => acao(p.id, 'pausar')}>Pausar</button>}
                <button className="btn btn-sm" style={{ background: '#fff', color: 'var(--red)', border: '1.5px solid #f3c2c2' }} disabled={busy === p.id} onClick={() => excluir(p.id)}>Excluir</button>
              </div>
            </div>

            {editando && (
              <div style={{ padding: '0 18px 20px' }}>
                <div className="fg"><label>Título</label><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
                <div className="fg"><label>Categoria</label>
                  <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                    {CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="fg"><label>Descrição</label><textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
                <div className="fg2">
                  <div className="fg"><label>Preço (R$)</label><input type="number" step="0.01" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} /></div>
                  <div className="fg"><label>Promo (opcional)</label><input type="number" step="0.01" value={form.preco_promo} onChange={(e) => setForm({ ...form, preco_promo: e.target.value })} /></div>
                </div>
                <div className="fg2">
                  <div className="fg"><label>Tipo de entrega</label>
                    <select value={form.tipo_entrega} onChange={(e) => setForm({ ...form, tipo_entrega: e.target.value })}>
                      <option value="arquivo">Arquivo (upload)</option><option value="link">Link de acesso</option><option value="chave">Chave / código</option><option value="acesso">Acesso / instrução</option>
                    </select>
                  </div>
                  <div className="fg"><label>Garantia (dias)</label><input type="number" value={form.garantia_dias} onChange={(e) => setForm({ ...form, garantia_dias: e.target.value })} /></div>
                </div>

                <div className="fg"><label>Imagem de capa</label>
                  <CoverUpload userId={userId} value={form.capa_url} onUploaded={(u) => setForm({ ...form, capa_url: u })} />
                </div>
                {form.tipo_entrega === 'arquivo' ? (
                  <div className="fg">
                    <label>Arquivo do produto</label>
                    <FileUpload userId={userId} current={form.arquivo_nome} onUploaded={(path, nome) => setForm({ ...form, arquivo_path: path, arquivo_nome: nome })} />
                  </div>
                ) : (
                  <div className="fg"><label>Conteúdo liberado pós-pagamento</label><input value={form.conteudo_entrega} onChange={(e) => setForm({ ...form, conteudo_entrega: e.target.value })} placeholder="https://… ou a chave/instrução" /></div>
                )}

                <div className="fg"><label>Emoji</label><input value={form.emoji} maxLength={2} style={{ width: 80 }} onChange={(e) => setForm({ ...form, emoji: e.target.value })} /></div>
                <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>⚠️ Ao salvar, o produto volta para revisão antes de ficar ativo de novo.</p>
                <button className="btn btn-pri btn-sm" disabled={busy === p.id} onClick={() => salvar(p.id)}>{busy === p.id ? 'Salvando…' : 'Salvar alterações'}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
