'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import FileUpload from './FileUpload';
import GalleryUpload from './GalleryUpload';
import { galeriaDe, MAX_FOTOS } from '@/lib/galeria';
import { NOMES_CATEGORIAS, AVISO_JOGOS, ehJogos } from '@/lib/categorias';
import Icon from '@/components/Icon';

const CATS = NOMES_CATEGORIAS;

// Edição de um produto do próprio vendedor.
// Mesmo envio de antes (PATCH /api/seller/product com os mesmos campos); o servidor decide
// a validação final e devolve o produto para revisão. Aqui só organizamos e validamos na tela.
export default function EditProductForm({ product, userId, foco, onSaved, onCancel }: {
  product: any;
  userId: string;
  foco?: 'imagens' | null;
  onSaved: (atualizado: any) => void;
  onCancel: () => void;
}) {
  const p = product;
  const [form, setForm] = useState<any>({
    titulo: p.titulo, descricao: p.descricao || '', categoria: p.categoria || CATS[0],
    preco: p.preco, preco_promo: p.preco_promo || '', tipo_entrega: p.tipo_entrega || 'arquivo',
    garantia_dias: p.garantia_dias || 7, conteudo_entrega: p.conteudo_entrega || '', emoji: p.emoji || '📦',
    arquivo_path: p.arquivo_path || '', arquivo_nome: p.arquivo_nome || '', imagens: galeriaDe(p),
  });
  const [busy, setBusy] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const imagensRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (foco === 'imagens') imagensRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else tituloRef.current?.focus();
  }, [foco]);

  function validar() {
    const e: Record<string, string> = {};
    const preco = Number(form.preco);
    if (!String(form.titulo || '').trim()) e.titulo = 'Informe o título.';
    if (!preco || preco <= 0) e.preco = 'Informe um preço maior que zero.';
    if (form.preco_promo !== '' && form.preco_promo != null) {
      const promo = Number(form.preco_promo);
      if (!promo || promo <= 0) e.preco_promo = 'O preço promocional precisa ser maior que zero (ou deixe em branco).';
      else if (preco && promo >= preco) e.preco_promo = 'O preço promocional precisa ser menor que o preço normal.';
    }
    const g = Number(form.garantia_dias);
    if (!Number.isFinite(g) || g < 0 || g > 365) e.garantia_dias = 'Use um número de 0 a 365 dias.';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar() {
    if (!validar()) { toast('Revise os campos destacados.', 'error'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/seller/product', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: p.id, ...form, capa_url: form.imagens?.[0] || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        onSaved({
          ...p, ...form, preco: Number(form.preco), preco_promo: form.preco_promo ? Number(form.preco_promo) : null,
          garantia_dias: Number(form.garantia_dias || 7), capa_url: form.imagens?.[0] || null, status: 'em_revisao',
        });
        toast('Produto salvo! Enviado para revisão.', 'success');
      } else toast(d.error || 'Erro ao salvar', 'error');
    } catch { toast('Falha de conexão. Tente de novo.', 'error'); }
    finally { setBusy(false); }
  }

  const err = (k: string) => erros[k] ? <div className="ui-err" role="alert">{erros[k]}</div> : null;

  return (
    <div className="pm-edit" aria-label={`Editar ${p.titulo}`}>
      <div className="ui-sec">
        <h3><Icon name="edit" size={16} /> Informações do anúncio</h3>
        <div className="fg"><label htmlFor={`t-${p.id}`}>Título<span className="ui-req">*</span></label>
          <input id={`t-${p.id}`} ref={tituloRef} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} aria-invalid={!!erros.titulo} />{err('titulo')}</div>
        <div className="fg"><label htmlFor={`c-${p.id}`}>Categoria</label>
          <select id={`c-${p.id}`} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          {ehJogos(form.categoria) && (
            <div role="note" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#F3EDFF', border: '1px solid #D9C8FF', color: '#3B1E7A', borderRadius: 12, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>
              <Icon name="alert" size={15} style={{ marginTop: 1, flexShrink: 0 }} /><span><b>Regras de Jogos &amp; Games.</b> {AVISO_JOGOS}</span>
            </div>
          )}
        </div>
        <div className="fg"><label htmlFor={`d-${p.id}`}>Descrição</label><textarea id={`d-${p.id}`} rows={4} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
      </div>

      <div className="ui-sec">
        <h3><Icon name="money" size={16} /> Preço</h3>
        <div className="fg2">
          <div className="fg"><label htmlFor={`p-${p.id}`}>Preço (R$)<span className="ui-req">*</span></label>
            <input id={`p-${p.id}`} type="number" step="0.01" min={0} inputMode="decimal" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} aria-invalid={!!erros.preco} />{err('preco')}</div>
          <div className="fg"><label htmlFor={`pp-${p.id}`}>Preço promocional (opcional)</label>
            <input id={`pp-${p.id}`} type="number" step="0.01" min={0} inputMode="decimal" value={form.preco_promo} onChange={(e) => setForm({ ...form, preco_promo: e.target.value })} aria-invalid={!!erros.preco_promo} />
            {err('preco_promo') || <div className="ui-help">Menor que o preço normal. O desconto aparece no anúncio.</div>}</div>
        </div>
      </div>

      <div className="ui-sec" ref={imagensRef}>
        <h3><Icon name="image" size={16} /> Imagens</h3>
        <p className="ui-sec-sub">Até {MAX_FOTOS} fotos. A primeira é a capa. Prefira imagens nítidas, sem texto pequeno, em proporção paisagem.</p>
        <GalleryUpload userId={userId} value={form.imagens || []} onChange={(imgs) => setForm((f: any) => ({ ...f, imagens: imgs }))} />
      </div>

      <div className="ui-sec">
        <h3><Icon name="package" size={16} /> Entrega e garantia</h3>
        <div className="fg2">
          <div className="fg"><label htmlFor={`te-${p.id}`}>Tipo de entrega</label>
            <select id={`te-${p.id}`} value={form.tipo_entrega} onChange={(e) => setForm({ ...form, tipo_entrega: e.target.value })}>
              <option value="arquivo">Arquivo (upload)</option><option value="link">Link de acesso</option><option value="chave">Chave / código</option><option value="acesso">Acesso / instrução</option>
            </select>
          </div>
          <div className="fg"><label htmlFor={`g-${p.id}`}>Garantia (dias)</label>
            <input id={`g-${p.id}`} type="number" min={0} max={365} value={form.garantia_dias} onChange={(e) => setForm({ ...form, garantia_dias: e.target.value })} aria-invalid={!!erros.garantia_dias} />{err('garantia_dias')}</div>
        </div>
        {form.tipo_entrega === 'arquivo' ? (
          <div className="fg">
            <label>Arquivo do produto</label>
            <FileUpload userId={userId} current={form.arquivo_nome} onUploaded={(path, nome) => setForm({ ...form, arquivo_path: path, arquivo_nome: nome })} />
            <div className="ui-help">Entregue ao comprador somente depois do pagamento confirmado.</div>
          </div>
        ) : (
          <div className="fg"><label htmlFor={`ce-${p.id}`}>Conteúdo liberado pós-pagamento</label>
            <input id={`ce-${p.id}`} value={form.conteudo_entrega} onChange={(e) => setForm({ ...form, conteudo_entrega: e.target.value })} placeholder="https://… ou a chave/instrução" />
            <div className="ui-help">Link, chave ou instrução que o comprador recebe após o pagamento.</div>
          </div>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="alert" size={13} /> Ao salvar, o produto volta para revisão antes de ficar ativo de novo.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-pri btn-sm" disabled={busy} onClick={salvar}>{busy ? 'Salvando…' : 'Salvar e enviar para revisão'}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
