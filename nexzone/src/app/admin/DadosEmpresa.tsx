'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { formatarCnpj, whatsappLegivel } from '@/lib/confianca';

// Admin › Configurações: dados da empresa que aparecem no rodapé do checkout e do site,
// e o prazo de entrega prometido quando o vendedor entrega pelo chat (contas, itens, moedas, serviços).
type D = { razao: string; cnpj: string; whatsapp: string; email: string; cidade: string; prazoManualHoras: number };

export default function DadosEmpresa() {
  const [d, setD] = useState<D | null>(null);
  const [f, setF] = useState({ razao: '', cnpj: '', whatsapp: '', email: '', cidade: '', prazo: '24' });
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch('/api/admin/confianca', { cache: 'no-store' }).then((r) => r.json()).then((j: D) => {
      if (!j || typeof j !== 'object' || (j as any).error) return;
      setD(j);
      setF({ razao: j.razao, cnpj: formatarCnpj(j.cnpj), whatsapp: whatsappLegivel(j.whatsapp), email: j.email, cidade: j.cidade, prazo: String(j.prazoManualHoras) });
    }).catch(() => {});
  }, []);

  async function salvar() {
    setSalvando(true); setErroCampo(null);
    try {
      const r = await fetch('/api/admin/confianca', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razao: f.razao, cnpj: f.cnpj, whatsapp: f.whatsapp, email: f.email, cidade: f.cidade, prazoManualHoras: Number(f.prazo) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErroCampo(j.campo || null); toast(j.error || 'Não foi possível salvar.', 'error'); return; }
      setD(j); toast('Dados salvos. Já aparecem no checkout.', 'success');
    } finally { setSalvando(false); }
  }

  if (!d) return null;
  const campo = (k: keyof typeof f, rotulo: string, ph: string, extra: any = {}) => (
    <div style={{ flex: '1 1 220px' }}>
      <label style={lbl}>{rotulo}</label>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph}
        style={{ ...inp, ...(erroCampo === (k === 'prazo' ? 'prazoManualHoras' : k) ? { borderColor: '#E5484D' } : {}) }} {...extra} />
    </div>
  );

  return (
    <div className="adm-card" style={{ maxWidth: 560, marginBottom: 18 }}>
      <h3 className="adm-ct" style={{ marginBottom: 6 }}>Dados da empresa no checkout</h3>
      <p style={{ ...hint, fontSize: 13, margin: '0 0 14px' }}>Aparecem no rodapé do checkout e do site. Comprador desconfiado procura o CNPJ antes de pagar. Campo vazio não aparece.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {campo('razao', 'Razão social', 'Ex.: Comprei Barato Ltda')}
        {campo('cnpj', 'CNPJ', '00.000.000/0000-00', { inputMode: 'numeric' })}
        {campo('whatsapp', 'WhatsApp do suporte', '(63) 99999-0000', { inputMode: 'tel' })}
        {campo('email', 'E-mail de contato', 'suporte@compreibarato.com.br', { inputMode: 'email' })}
        {campo('cidade', 'Cidade/UF', 'Palmas/TO')}
        {campo('prazo', 'Prazo de entrega pelo chat (horas)', '24', { inputMode: 'numeric', type: 'number', min: 1, max: 168 })}
      </div>
      <small style={{ ...hint, display: 'block', margin: '2px 0 14px' }}>O prazo vale para contas, itens, moedas e serviços (o vendedor entrega no chat). Prometa só o que os vendedores cumprem: atraso vira reembolso.</small>
      <button className="btn btn-pri btn-sm" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar dados da empresa'}</button>
    </div>
  );
}

const lbl = { display: 'block', fontFamily: 'Outfit', fontWeight: 800, fontSize: 13, marginBottom: 8 } as const;
const inp = { width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14, marginBottom: 6, background: '#fff' } as const;
const hint = { color: 'var(--muted)', fontSize: 12 } as const;
