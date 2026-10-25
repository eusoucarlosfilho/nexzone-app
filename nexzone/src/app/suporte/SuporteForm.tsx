'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { CATEGORIAS_SUPORTE, MENSAGEM_MIN, MENSAGEM_MAX, ASSUNTO_MAX } from '@/lib/suporte/constantes';
import { enviarAnexo, validarAnexo } from '@/lib/suporte/anexoCliente';

type Pedido = { id: string; rotulo: string; grupo: 'compra' | 'venda' };

export default function SuporteForm({ conta, pedidos }: { conta: { nome: string; email: string } | null; pedidos: Pedido[] }) {
  const [t0] = useState(() => Date.now());
  const [nome, setNome] = useState(conta?.nome || '');
  const [email, setEmail] = useState(conta?.email || '');
  const [whatsapp, setWhatsapp] = useState('');
  const [categoria, setCategoria] = useState('');
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [pedidoId, setPedidoId] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [website, setWebsite] = useState(''); // honeypot (escondido)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [feito, setFeito] = useState<{ protocolo: string; link: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    e.target.value = '';
    if (!f) return;
    const m = validarAnexo(f);
    if (m) { setErr(m); return; }
    setErr(''); setArquivo(f);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!conta && (!nome.trim() || !email.trim())) { setErr('Informe seu nome e e-mail.'); return; }
    if (!categoria) { setErr('Escolha o tipo de suporte.'); return; }
    if (!assunto.trim()) { setErr('Informe o assunto.'); return; }
    if (mensagem.trim().length < MENSAGEM_MIN) { setErr(`A mensagem precisa ter pelo menos ${MENSAGEM_MIN} caracteres.`); return; }
    setBusy(true);
    try {
      let anexo: { path: string; nome: string } | null = null;
      if (arquivo) anexo = await enviarAnexo(arquivo);
      const r = await fetch('/api/suporte/abrir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ nome, email, whatsapp, categoria, assunto, mensagem, pedidoId: pedidoId || null, anexoPath: anexo?.path, anexoNome: anexo?.nome, website, t0 }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível enviar. Tente de novo.');
      setFeito({ protocolo: d.protocolo, link: d.link });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível enviar. Tente de novo.');
    } finally { setBusy(false); }
  }

  if (feito) {
    return (
      <div className="card" style={{ marginTop: 20, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Icon name="check" size={28} />
        </div>
        <h2 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 22, marginBottom: 6 }}>Chamado aberto!</h2>
        <p className="muted" style={{ marginBottom: 14 }}>Seu número de protocolo é</p>
        <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 28, letterSpacing: 1, color: 'var(--orange-ink)', marginBottom: 14 }}>{feito.protocolo}</div>
        <p style={{ marginBottom: 18 }}>Você receberá nossas respostas no e-mail informado.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-pri" href={feito.link}>Acompanhar chamado</Link>
          {conta && <Link className="btn btn-ghost" href="/suporte/meus-chamados">Meus chamados</Link>}
        </div>
      </div>
    );
  }

  const compras = pedidos.filter((p) => p.grupo === 'compra');
  const vendas = pedidos.filter((p) => p.grupo === 'venda');

  return (
    <form onSubmit={enviar} className="card" style={{ marginTop: 20 }} noValidate>
      {conta ? (
        <div style={{ background: 'var(--soft)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 14 }}>
          Abrindo como <strong>{conta.nome}</strong> · {conta.email}
        </div>
      ) : (
        <>
          <div className="fg2">
            <div className="fg"><label htmlFor="sp-nome">Seu nome</label><input id="sp-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} autoComplete="name" required /></div>
            <div className="fg"><label htmlFor="sp-email">Seu e-mail</label><input id="sp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" required /></div>
          </div>
          <div className="fg"><label htmlFor="sp-zap">WhatsApp (opcional)</label><input id="sp-zap" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={30} inputMode="tel" placeholder="(00) 00000-0000" /></div>
        </>
      )}

      {/* campo armadilha para robôs: fica fora da tela */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="sp-site">Não preencha</label>
        <input id="sp-site" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <div className="fg">
        <label htmlFor="sp-cat">Tipo de suporte</label>
        <select id="sp-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)} required>
          <option value="">Escolha…</option>
          {CATEGORIAS_SUPORTE.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <div className="fg"><label htmlFor="sp-ass">Assunto</label><input id="sp-ass" value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={ASSUNTO_MAX} required /></div>
      <div className="fg">
        <label htmlFor="sp-msg">Mensagem</label>
        <textarea id="sp-msg" value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={6} maxLength={MENSAGEM_MAX} required placeholder="Descreva o que aconteceu, com o máximo de detalhes." />
        <div className="muted" style={{ fontSize: 12, marginTop: 4, textAlign: 'right' }}>{mensagem.trim().length < MENSAGEM_MIN ? `mínimo ${MENSAGEM_MIN} caracteres` : `${mensagem.length}/${MENSAGEM_MAX}`}</div>
      </div>

      {conta && pedidos.length > 0 && (
        <div className="fg">
          <label htmlFor="sp-ped">Pedido relacionado (opcional)</label>
          <select id="sp-ped" value={pedidoId} onChange={(e) => setPedidoId(e.target.value)}>
            <option value="">Nenhum</option>
            {compras.length > 0 && <optgroup label="Minhas compras">{compras.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}</optgroup>}
            {vendas.length > 0 && <optgroup label="Minhas vendas">{vendas.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}</optgroup>}
          </select>
        </div>
      )}

      <div className="fg">
        <label>Anexo (opcional)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Icon name="upload" size={16} /> {arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}
          </button>
          {arquivo
            ? <span className="muted" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{arquivo.name} <button type="button" onClick={() => setArquivo(null)} style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', fontWeight: 800 }}>remover</button></span>
            : <span className="muted" style={{ fontSize: 13 }}>Imagem ou PDF, até 5 MB</span>}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={escolher} style={{ display: 'none' }} />
      </div>

      {err && <div style={{ color: 'var(--red)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{err}</div>}
      <button type="submit" className="btn btn-pri" disabled={busy} style={{ width: '100%' }}>{busy ? 'Enviando…' : 'Enviar chamado'}</button>
      <p className="muted" style={{ fontSize: 12, marginTop: 10, textAlign: 'center' }}>Responderemos no e-mail informado. Não peça nem envie senhas por aqui.</p>
    </form>
  );
}
