'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { cpfValido, cnpjValido, soDigitos, formatarDocumento, mascararDocumento } from '@/lib/documento';
import type { StatusVerificacao } from '@/lib/verificacao-servidor';

type Arq = { path: string; nome: string; previa: string | null } | null;

function Upload({ userId, rotulo, dica, valor, onValor, erro }: { userId: string; rotulo: string; dica: string; valor: Arq; onValor: (a: Arq) => void; erro?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!/^image\/|application\/pdf/.test(f.type)) { toast('Envie uma foto (JPG, PNG) ou PDF.', 'error'); return; }
    if (f.size > 10 * 1024 * 1024) { toast('Arquivo muito grande (máximo 10 MB).', 'error'); return; }
    setBusy(true);
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
    const path = `${userId}/kyc/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from('entregaveis').upload(path, f, { upsert: false, contentType: f.type });
    setBusy(false);
    if (error) { toast('Não foi possível enviar: ' + error.message, 'error'); return; }
    onValor({ path, nome: f.name, previa: f.type.startsWith('image/') ? URL.createObjectURL(f) : null });
  }
  return (
    <div className={`vf-up ${valor ? 'ok' : ''} ${erro ? 'err' : ''}`}>
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}>
        {valor?.previa ? <img src={valor.previa} alt="" /> : <span className="vf-ic"><Icon name={valor ? 'file' : 'upload'} size={22} /></span>}
        <span className="vf-tx"><b>{rotulo}</b><small>{busy ? 'Enviando…' : valor ? `${valor.nome} · trocar` : dica}</small></span>
        {valor && <Icon name="checkCircle" size={20} color="var(--green)" />}
      </button>
      <input ref={ref} type="file" accept="image/*,application/pdf" capture={rotulo.includes('Selfie') ? 'user' : undefined} hidden onChange={enviar} />
      {erro && <div className="vf-err">{erro}</div>}
    </div>
  );
}

export default function VerificacaoForm({ userId, inicial }: { userId: string; inicial: StatusVerificacao }) {
  const [st, setSt] = useState(inicial);
  const [editar, setEditar] = useState(inicial.status === 'nao_enviada' || inicial.status === 'reprovado');
  const [tipo, setTipo] = useState<'pf' | 'pj'>(inicial.tipo || 'pf');
  const [nome, setNome] = useState(inicial.nome || '');
  const [doc, setDoc] = useState('');
  const [nasc, setNasc] = useState('');
  const [resp, setResp] = useState('');
  const [frente, setFrente] = useState<Arq>(null);
  const [verso, setVerso] = useState<Arq>(null);
  const [selfie, setSelfie] = useState<Arq>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const docOk = tipo === 'pf' ? cpfValido(doc) : cnpjValido(doc);

  async function enviar() {
    const e: Record<string, string> = {};
    if (!/\S+\s+\S+/.test(nome.trim())) e.nome = tipo === 'pf' ? 'Nome completo, igual ao documento.' : 'Razão social completa.';
    if (!docOk) e.documento = tipo === 'pf' ? 'CPF inválido.' : 'CNPJ inválido.';
    if (tipo === 'pf' && !nasc) e.nascimento = 'Informe a data de nascimento.';
    if (tipo === 'pj' && !/\S+\s+\S+/.test(resp.trim())) e.responsavel = 'Nome completo do responsável.';
    if (!frente) e.doc_frente = 'Envie a frente do documento.';
    if (!selfie) e.selfie = 'Envie a selfie com o documento.';
    setErros(e);
    if (Object.keys(e).length) { toast('Confira os campos destacados.', 'error'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/seller/verificacao', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nome, documento: doc, nascimento: nasc, responsavel: resp, doc_frente: frente!.path, doc_verso: verso?.path || null, selfie: selfie!.path }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { if (d.campo) setErros({ [d.campo]: d.error }); toast(d.error || 'Não foi possível enviar.', 'error'); return; }
      setSt(d); setEditar(false); toast('Enviado! Avisamos no sino quando a análise terminar.', 'success');
    } finally { setBusy(false); }
  }

  return (
    <div className="vf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {!st.sql19 && <div className="card">A verificação fica disponível depois que o SQL 19 for aplicado.</div>}
      {st.sql19 && !editar && (
        <div className={`card vf-st ${st.status}`}>
          <span className="vf-st-ic"><Icon name={st.status === 'aprovado' ? 'checkCircle' : st.status === 'pendente' ? 'clock' : 'alert'} size={24} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{st.status === 'aprovado' ? 'Identidade verificada' : st.status === 'pendente' ? 'Em análise' : 'Verificação não aprovada'}</b>
            <p>{st.status === 'aprovado' ? 'Tudo certo! Seus saques estão liberados.' : st.status === 'pendente' ? 'Recebemos seus dados. A análise sai em até 1 dia útil e você é avisado no sino.' : st.motivo || 'Revise os dados e envie de novo.'}</p>
            {st.nome && <small className="muted">{st.nome}{st.final && st.tipo ? ` · ${mascararDocumento(st.tipo, st.final)}` : ''}</small>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {st.status === 'aprovado' && <Link href="/vender/recebimentos" className="btn btn-pri btn-sm">Ir para Recebimentos</Link>}
              {st.status !== 'aprovado' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditar(true)}>{st.status === 'pendente' ? 'Corrigir dados enviados' : 'Enviar de novo'}</button>}
            </div>
          </div>
        </div>
      )}
      {st.sql19 && editar && (
        <div className="card">
          {st.status === 'reprovado' && st.motivo && <div className="vf-aviso"><Icon name="alert" size={16} /> <span><b>O que corrigir:</b> {st.motivo}</span></div>}
          <div className="vf-tipo" role="radiogroup" aria-label="Tipo de pessoa">
            {(['pf', 'pj'] as const).map((t) => (
              <label key={t} className={tipo === t ? 'on' : ''}><input type="radio" checked={tipo === t} onChange={() => { setTipo(t); setDoc(''); }} />
                <span><b>{t === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'}</b><small>{t === 'pf' ? 'Vendo no meu CPF' : 'Tenho CNPJ (MEI, ME, LTDA…)'}</small></span></label>
            ))}
          </div>
          <div className="fg"><label htmlFor="vf-nome">{tipo === 'pf' ? 'Nome completo (igual ao documento)' : 'Razão social'}</label>
            <input id="vf-nome" value={nome} maxLength={160} autoComplete={tipo === 'pf' ? 'name' : 'organization'} onChange={(e) => setNome(e.target.value)} aria-invalid={!!erros.nome} />
            {erros.nome && <div className="vf-err">{erros.nome}</div>}</div>
          <div className="fg2">
            <div className="fg"><label htmlFor="vf-doc">{tipo === 'pf' ? 'CPF' : 'CNPJ'}</label>
              <input id="vf-doc" inputMode="numeric" value={formatarDocumento(doc)} maxLength={18} placeholder={tipo === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'} onChange={(e) => setDoc(soDigitos(e.target.value).slice(0, tipo === 'pf' ? 11 : 14))} aria-invalid={!!erros.documento} />
              {doc.length >= (tipo === 'pf' ? 11 : 14) && !docOk && <div className="vf-err">{tipo === 'pf' ? 'CPF inválido.' : 'CNPJ inválido.'}</div>}
              {erros.documento && <div className="vf-err">{erros.documento}</div>}</div>
            {tipo === 'pf' ? (
              <div className="fg"><label htmlFor="vf-nasc">Data de nascimento</label>
                <input id="vf-nasc" type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} aria-invalid={!!erros.nascimento} />
                {erros.nascimento && <div className="vf-err">{erros.nascimento}</div>}</div>
            ) : (
              <div className="fg"><label htmlFor="vf-resp">Responsável pela empresa</label>
                <input id="vf-resp" value={resp} maxLength={160} onChange={(e) => setResp(e.target.value)} aria-invalid={!!erros.responsavel} />
                {erros.responsavel && <div className="vf-err">{erros.responsavel}</div>}</div>
            )}
          </div>
          <p className="muted" style={{ fontSize: 13, margin: '4px 0 10px' }}>Documento com foto {tipo === 'pj' ? 'do responsável ' : ''}(RG, CNH ou passaporte). Foto nítida, sem reflexo, com os 4 cantos aparecendo.</p>
          <div className="vf-ups">
            <Upload userId={userId} rotulo="Frente do documento" dica="Foto ou PDF" valor={frente} onValor={setFrente} erro={erros.doc_frente} />
            <Upload userId={userId} rotulo="Verso do documento" dica="Opcional para CNH digital" valor={verso} onValor={setVerso} />
            <Upload userId={userId} rotulo="Selfie segurando o documento" dica="Rosto e documento visíveis" valor={selfie} onValor={setSelfie} erro={erros.selfie} />
          </div>
          <p className="muted" style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'flex-start', margin: '12px 0' }}><Icon name="lock" size={14} /> Seus documentos ficam em armazenamento privado e só a equipe de análise vê. O número do documento é guardado criptografado. A chave Pix de saque deve estar no mesmo {tipo === 'pf' ? 'CPF' : 'CNPJ'}.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-pri" disabled={busy} onClick={enviar}>{busy ? 'Enviando…' : 'Enviar para análise'}</button>
            {st.status !== 'nao_enviada' && <button type="button" className="btn btn-ghost" onClick={() => setEditar(false)}>Cancelar</button>}
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.vf{max-width:760px}
.vf .card{padding:20px}
.vf-st{display:flex;gap:14px;align-items:flex-start;border-left:4px solid var(--border2)}
.vf-st.aprovado{border-left-color:var(--green)}.vf-st.pendente{border-left-color:#E5A100}.vf-st.reprovado{border-left-color:var(--red)}
.vf-st-ic{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex:none;background:var(--bg2)}
.vf-st.aprovado .vf-st-ic{background:var(--green-bg);color:var(--green)}.vf-st.pendente .vf-st-ic{background:#FFF4D6;color:#8A5800}.vf-st.reprovado .vf-st-ic{background:var(--red-bg);color:var(--red)}
.vf-st b{font-family:'Outfit';font-size:18px}
.vf-st p{margin:4px 0;color:var(--sub)}
.vf-aviso{display:flex;gap:8px;align-items:flex-start;background:var(--red-bg);color:var(--red);border-radius:12px;padding:10px 12px;margin-bottom:14px;font-size:14px}
.vf-tipo{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.vf-tipo label{display:flex;gap:10px;align-items:flex-start;border:1.5px solid var(--border2);border-radius:14px;padding:12px;cursor:pointer}
.vf-tipo label.on{border-color:var(--orange);background:var(--soft)}
.vf-tipo input{margin-top:3px;accent-color:var(--orange)}
.vf-tipo b{display:block;font-size:14.5px}.vf-tipo small{color:var(--sub);font-size:12.5px}
.vf-ups{display:grid;gap:8px}
.vf-up button{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;gap:12px;align-items:center;border:1.5px dashed var(--border2);border-radius:14px;padding:10px 12px;background:#fff}
.vf-up button:hover{border-color:var(--orange)}
.vf-up button:focus-visible{outline:2px solid var(--orange);outline-offset:2px}
.vf-up.ok button{border-style:solid;border-color:#9FD9BF;background:#F6FCF9}
.vf-up.err button{border-color:var(--red)}
.vf-up img{width:52px;height:52px;object-fit:cover;border-radius:10px;flex:none}
.vf-ic{width:52px;height:52px;border-radius:10px;background:var(--soft);color:var(--orange-ink);display:flex;align-items:center;justify-content:center;flex:none}
.vf-tx{flex:1;min-width:0;display:flex;flex-direction:column}
.vf-tx b{font-size:14.5px}.vf-tx small{color:var(--sub);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vf-err{color:var(--red);font-size:12.5px;margin-top:4px;font-weight:700}
@media(max-width:560px){.vf-tipo,.vf .fg2{grid-template-columns:1fr}}
`;
