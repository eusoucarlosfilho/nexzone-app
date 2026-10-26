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
import EditorMensagem from './EditorMensagem';
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
  const [estoque, setEstoque] = useState('');
  const [conteudoEntrega, setConteudoEntrega] = useState('');
  const [usaPadrao, setUsaPadrao] = useState(false);

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

  // Validação na tela (o servidor continua sendo quem decide; aqui só evitamos envios com erro óbvio)
  const [erros, setErros] = useState<Record<string, string>>({});
  function validar() {
    const e: Record<string, string> = {};
    const p = Number(preco);
    if (!titulo.trim()) e.titulo = 'Informe o título do produto.';
    if (!p || p <= 0) e.preco = 'Informe um preço maior que zero.';
    if (precoPromo !== '') {
      const pr = Number(precoPromo);
      if (!pr || pr <= 0) e.preco_promo = 'O preço promocional precisa ser maior que zero (ou deixe em branco).';
      else if (p && pr >= p) e.preco_promo = 'O preço promocional precisa ser menor que o preço normal.';
    }
    const g = Number(garantia);
    if (!Number.isFinite(g) || g < 0 || g > 365) e.garantia = 'Use um número de 0 a 365 dias.';
    if (estoque !== '' && !(/^\d+$/.test(estoque) && Number(estoque) <= 1000000)) e.estoque = 'Digite só números inteiros (ex.: 25), ou deixe em branco.';
    setErros(e);
    return Object.keys(e).length === 0;
  }
  const err = (k: string) => erros[k] ? <div className="ui-err" role="alert">{erros[k]}</div> : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validar()) { toast('Revise os campos destacados.', 'error'); return; }
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
      router.push('/vender/produtos');
      router.refresh();
    } else {
      toast(r?.error || 'Não foi possível cadastrar o produto.', 'error');
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate>
      {/* ===== Importar anúncio de outro site (opcional) ===== */}
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

      <section className="ui-sec" aria-labelledby="sec-basico">
        <h3 id="sec-basico"><Icon name="edit" size={16} /> 1. Informações básicas</h3>
        <p className="ui-sec-sub">Como o produto aparece na vitrine e na busca.</p>
      <div className="fg"><label htmlFor="np-titulo">Título<span className="ui-req">*</span></label><input id="np-titulo" name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required aria-invalid={!!erros.titulo} placeholder="Ex: Pack 100 Templates de Carrossel" />
        {err('titulo') || <div className="ui-help">Seja específico: o que é, para quem e o principal benefício.</div>}</div>
      <div className="fg"><label htmlFor="np-cat">Categoria<span className="ui-req">*</span></label>
        <select id="np-cat" name="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
      {ehJogos(categoria) && (
        <div role="note" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#F3EDFF', border: '1px solid #D9C8FF', color: '#3B1E7A', borderRadius: 12, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>
          <Icon name="alert" size={15} style={{ marginTop: 1, flexShrink: 0 }} /><span><b>Regras de Jogos &amp; Games.</b> {AVISO_JOGOS}</span>
        </div>
      )}
      </div>
      <div className="fg"><label htmlFor="np-desc">Descrição</label><textarea id="np-desc" name="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={6} placeholder="Para quem é, o que resolve, o que o comprador recebe e em qual formato." />
        <div className="ui-help">Descrições completas vendem mais e são aprovadas mais rápido.</div></div>
      </section>

      <section className="ui-sec" aria-labelledby="sec-img">
        <h3 id="sec-img"><Icon name="image" size={16} /> 2. Imagens</h3>
        <p className="ui-sec-sub">Até {MAX_FOTOS} fotos. A primeira é a capa. Use imagens nítidas, em paisagem, sem textos pequenos. Sem foto, o anúncio mostra o ícone da categoria.</p>
        <GalleryUpload userId={userId} value={imagens} onChange={setImagens} />
      </section>

      <section className="ui-sec" aria-labelledby="sec-preco">
        <h3 id="sec-preco"><Icon name="money" size={16} /> 3. Preço</h3>
      <div className="fg2">
        <div className="fg"><label htmlFor="np-preco">Preço (R$)<span className="ui-req">*</span></label><input id="np-preco" name="preco" value={preco} onChange={(e) => setPreco(e.target.value)} type="number" step="0.01" min={0} inputMode="decimal" required aria-invalid={!!erros.preco} placeholder="19.90" />{err('preco')}</div>
        <div className="fg"><label htmlFor="np-promo">Preço promocional (opcional)</label><input id="np-promo" name="preco_promo" value={precoPromo} onChange={(e) => setPrecoPromo(e.target.value)} type="number" step="0.01" min={0} inputMode="decimal" aria-invalid={!!erros.preco_promo} placeholder="14.90" />
          {err('preco_promo') || <div className="ui-help">Menor que o preço normal. O desconto aparece no anúncio.</div>}</div>
      </div>
      </section>

      <section className="ui-sec" aria-labelledby="sec-entrega">
        <h3 id="sec-entrega"><Icon name="package" size={16} /> 4. Entrega e garantia</h3>
        <p className="ui-sec-sub">O que o comprador recebe depois que o pagamento é confirmado.</p>
      <div className="fg2">
        <div className="fg"><label htmlFor="np-tipo">Tipo de entrega<span className="ui-req">*</span></label>
          <select id="np-tipo" name="tipo_entrega" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="arquivo">Arquivo (upload)</option>
            <option value="link">Link de acesso</option>
            <option value="chave">Chave / código</option>
            <option value="acesso">Acesso / instrução</option>
          </select>
        </div>
        <div className="fg"><label htmlFor="np-gar">Garantia (dias)</label><input id="np-gar" name="garantia_dias" type="number" min={0} max={365} value={garantia} onChange={(e) => setGarantia(e.target.value)} aria-invalid={!!erros.garantia} />
          {err('garantia') || <div className="ui-help">Prazo em que o comprador pode abrir reclamação.</div>}</div>
      </div>
      <div className="fg"><label htmlFor="np-est">Quantidade disponível (opcional)</label>
        <input id="np-est" name="estoque" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={7} placeholder="Ilimitado"
          value={estoque} onChange={(e) => setEstoque(e.target.value.replace(/[^\d]/g, ''))} aria-invalid={!!erros.estoque} />
        {err('estoque') || <div className="ui-help">Aparece na página do produto (ex.: &quot;Restam só 5 unidades&quot;). Cai 1 a cada venda paga; ao zerar, mostra &quot;Esgotado&quot; e para de vender. Em branco = sem limite.</div>}</div>

      {tipo === 'arquivo' ? (
        <div className="fg">
          <label>Arquivo do produto</label>
          <FileUpload userId={userId} onUploaded={(p, n) => { setArquivoPath(p); setArquivoNome(n); }} />
          <div className="ui-help">Entregue ao comprador somente depois do pagamento confirmado.</div>
          <input type="hidden" name="arquivo_path" value={arquivoPath} />
          <input type="hidden" name="arquivo_nome" value={arquivoNome} />
        </div>
      ) : null}
      <div className="fg"><label htmlFor="np-cont">{tipo === 'arquivo' ? 'Mensagem pós-compra (opcional, vai junto com o arquivo)' : 'Mensagem pós-compra (link, chave ou instruções)'}</label>
        <EditorMensagem id="np-cont" name="conteudo_entrega" novo valor={conteudoEntrega} onValor={setConteudoEntrega} usaPadrao={usaPadrao} onUsaPadrao={setUsaPadrao} />
        <div className="ui-help">Aparece no pedido e é enviada automaticamente no chat com o cliente assim que o pagamento é confirmado.</div></div>
      </section>

      {/* emoji legado: o servidor ainda lê o campo; vazio = padrão do servidor */}
      <input type="hidden" name="emoji" value="" />

      <SeoPanel
        titulo={titulo} descricao={descricao} categoria={categoria} preco={preco} precoPromo={precoPromo}
        temCapa={imagens.length > 0} tipoEntrega={tipo} garantiaDias={garantia}
        onApplyTitle={(t) => { setTitulo(t); toast('Título atualizado.', 'success'); }}
        onApplyDescription={(d) => { setDescricao(d); toast('Descrição atualizada.', 'success'); }}
      />

      <button className="btn btn-pri btn-lg" disabled={busy} style={{ width: '100%', marginTop: 8 }}>{busy ? 'Enviando…' : 'Enviar para revisão'}</button>
      <p className="ui-help" style={{ textAlign: 'center' }}>Depois de enviado, o produto aparece em Meus produtos como “Em revisão”.</p>
    </form>
  );
}
