'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { criarProduto } from '../actions';
import FileUpload from './FileUpload';
import GalleryUpload from './GalleryUpload';
import { MAX_FOTOS } from '@/lib/galeria';
import { NOMES_CATEGORIAS, AVISO_JOGOS, ehJogos } from '@/lib/categorias';
import SeoPanel from './SeoPanel';
import Icon from '@/components/Icon';

const CATS = NOMES_CATEGORIAS;

export default function CreateProduct({ userId }: { userId: string }) {
  // campos do produto (controlados — pra importação preencher)
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [precoPromo, setPrecoPromo] = useState('');
  const [categoria, setCategoria] = useState(CATS[0]);
  const [garantia, setGarantia] = useState('7');
  const [conteudoEntrega, setConteudoEntrega] = useState('');

  const [tipo, setTipo] = useState('arquivo');
  const [arquivoPath, setArquivoPath] = useState('');
  const [arquivoNome, setArquivoNome] = useState('');
  const [imagens, setImagens] = useState<string[]>([]); // galeria: a 1ª é a capa
  const [busy, setBusy] = useState(false);

  // importação de anúncio
  const [impUrl, setImpUrl] = useState('');
  const [impTexto, setImpTexto] = useState('');
  const [importando, setImportando] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [imagemSugerida, setImagemSugerida] = useState('');
  const [rehost, setRehost] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function aplicar(d: any) {
    if (d.titulo) setTitulo(d.titulo);
    if (d.descricao) setDescricao(d.descricao);
    if (d.preco != null) setPreco(String(d.preco));
    if (d.categoria && CATS.includes(d.categoria)) setCategoria(d.categoria);
    if (d.imagem_url) setImagemSugerida(d.imagem_url);
    setBloqueado(false);
  }

  async function importar(payload: any) {
    setImportando(true);
    try {
      const r = await fetch('/api/seller/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.ok) { aplicar(d.data); toast('Anúncio importado! Revise os campos e publique.', 'success'); }
      else if (d.blocked) { setBloqueado(true); toast(d.error || 'Não consegui abrir o link. Cole o texto do anúncio.', 'error'); }
      else toast(d.error || 'Não consegui importar.', 'error');
    } catch { toast('Falha ao importar. Tente de novo.', 'error'); }
    setImportando(false);
  }

  async function usarComoCapa() {
    if (!imagemSugerida) return;
    setRehost(true);
    try {
      const r = await fetch('/api/seller/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ rehost: true, imagem_url: imagemSugerida }),
      });
      const d = await r.json();
      if (d.ok) { setImagens((l) => [d.capa_url, ...l.filter((u) => u !== d.capa_url)].slice(0, MAX_FOTOS)); setImagemSugerida(''); toast('Capa definida!', 'success'); }
      else toast(d.error || 'Não consegui usar a imagem. Suba a capa manualmente.', 'error');
    } catch { toast('Falha ao definir a capa.', 'error'); }
    setRehost(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('imagens', JSON.stringify(imagens));
    fd.set('capa_url', imagens[0] || '');
    fd.set('arquivo_path', arquivoPath);
    fd.set('arquivo_nome', arquivoNome);
    setBusy(true);
    const r: any = await criarProduto(fd);
    setBusy(false);
    if (r?.ok) {
      toast('Produto enviado para revisão!', 'success');
      formRef.current?.reset();
      setTitulo(''); setDescricao(''); setPreco(''); setPrecoPromo(''); setCategoria(CATS[0]); setGarantia('7'); setConteudoEntrega('');
      setImagens([]); setArquivoPath(''); setArquivoNome(''); setTipo('arquivo');
      setImpUrl(''); setImpTexto(''); setImagemSugerida(''); setBloqueado(false);
      router.refresh();
    } else {
      toast(r?.error || 'Não foi possível cadastrar o produto.', 'error');
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      {/* ===== Importar anúncio de outro site ===== */}
      <div style={{ border: '1.5px dashed #FFCBA1', background: 'var(--soft)', borderRadius: 14, padding: 16, marginBottom: 22 }}>
        <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="sparkles" size={17} color="var(--orange-ink)" /> Trazer anúncio de outro site</div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
          Importe de Hotmart, Kiwify, Mercado Livre e outros — preenchemos o anúncio pra você. O arquivo/entrega você configura abaixo.
        </p>
        {!bloqueado ? (
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={impUrl} onChange={(e) => setImpUrl(e.target.value)} placeholder="Cole o link do seu anúncio em outro site"
                style={{ flex: '1 1 240px', height: 44, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14, background: '#fff' }} />
              <button type="button" className="btn btn-pri" disabled={importando || !impUrl.trim()} onClick={() => importar({ url: impUrl.trim() })}>
                {importando ? 'Buscando…' : 'Trazer anúncio'}
              </button>
            </div>
            <button type="button" onClick={() => setBloqueado(true)}
              style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: 'var(--orange-ink)', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
              ou colar o texto do anúncio manualmente
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--orange-ink)', marginBottom: 6 }}>Cole aqui o texto do anúncio (título, descrição, preço):</div>
            <textarea value={impTexto} onChange={(e) => setImpTexto(e.target.value)} rows={4} placeholder="Cole aqui o conteúdo do anúncio…"
              style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', background: '#fff' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn btn-pri btn-sm" disabled={importando || impTexto.trim().length < 20} onClick={() => importar({ texto: impTexto.trim() })}>
                {importando ? 'Processando…' : 'Importar do texto'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBloqueado(false)}>Voltar ao link</button>
            </div>
          </div>
        )}
        {imagemSugerida && (
          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <img src={imagemSugerida} alt="sugestão" style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>Imagem encontrada no anúncio</div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} disabled={rehost} onClick={usarComoCapa}>
                {rehost ? 'Salvando…' : 'Usar como capa'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="fg"><label>Título</label><input name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ex: Pack 100 Templates de Carrossel" /></div>
      <div className="fg"><label>Fotos do produto (até {MAX_FOTOS})</label>
        <GalleryUpload userId={userId} value={imagens} onChange={setImagens} />
      </div>
      <div className="fg"><label>Categoria</label>
        <select name="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
      {ehJogos(categoria) && (
        <div role="note" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#F3EDFF', border: '1px solid #D9C8FF', color: '#3B1E7A', borderRadius: 12, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>
          <Icon name="alert" size={15} style={{ marginTop: 1, flexShrink: 0 }} /><span><b>Regras de Jogos &amp; Games.</b> {AVISO_JOGOS}</span>
        </div>
      )}
      </div>
      <div className="fg"><label>Descrição</label><textarea name="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={6} placeholder="Para quem é, o que resolve, o que o comprador recebe e em qual formato." /></div>
      <div className="fg2">
        <div className="fg"><label>Preço (R$)</label><input name="preco" value={preco} onChange={(e) => setPreco(e.target.value)} type="number" step="0.01" required placeholder="19.90" /></div>
        <div className="fg"><label>Preço promocional (opcional)</label><input name="preco_promo" value={precoPromo} onChange={(e) => setPrecoPromo(e.target.value)} type="number" step="0.01" placeholder="14.90" /></div>
      </div>
      <div className="fg2">
        <div className="fg"><label>Tipo de entrega</label>
          <select name="tipo_entrega" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="arquivo">Arquivo (upload)</option>
            <option value="link">Link de acesso</option>
            <option value="chave">Chave / código</option>
            <option value="acesso">Acesso / instrução</option>
          </select>
        </div>
        <div className="fg"><label>Garantia (dias)</label><input name="garantia_dias" type="number" min={0} value={garantia} onChange={(e) => setGarantia(e.target.value)} /></div>
      </div>

      {tipo === 'arquivo' ? (
        <div className="fg">
          <label>Arquivo do produto (entregue após o pagamento)</label>
          <FileUpload userId={userId} onUploaded={(p, n) => { setArquivoPath(p); setArquivoNome(n); }} />
          <input type="hidden" name="arquivo_path" value={arquivoPath} />
          <input type="hidden" name="arquivo_nome" value={arquivoNome} />
        </div>
      ) : (
        <div className="fg"><label>Conteúdo liberado pós-pagamento (link ou texto)</label><input name="conteudo_entrega" value={conteudoEntrega} onChange={(e) => setConteudoEntrega(e.target.value)} placeholder="https://… ou a chave/instrução" /></div>
      )}

      {/* emoji legado: o servidor ainda lê o campo; vazio = padrão do servidor */}
      <input type="hidden" name="emoji" value="" />

      <SeoPanel
        titulo={titulo} descricao={descricao} categoria={categoria} preco={preco} precoPromo={precoPromo}
        temCapa={imagens.length > 0} tipoEntrega={tipo} garantiaDias={garantia}
        onApplyTitle={(t) => { setTitulo(t); toast('Título atualizado.', 'success'); }}
        onApplyDescription={(d) => { setDescricao(d); toast('Descrição atualizada.', 'success'); }}
      />

      <button className="btn btn-pri" disabled={busy} style={{ width: '100%' }}>{busy ? 'Enviando…' : 'Enviar para revisão'}</button>
    </form>
  );
}
