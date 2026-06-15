'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';

export default function TorpedosForm({ settings }: any) {
  const [horas, setHoras] = useState(String(settings.escalonamento_horas ?? 5));
  const [emailOn, setEmailOn] = useState(settings.escalonamento_email_on !== false);
  const [smsOn, setSmsOn] = useState(settings.escalonamento_sms_on === true);
  const [smsUrl, setSmsUrl] = useState(settings.sms_api_url || '');
  const [smsToken, setSmsToken] = useState('');
  const [smsRem, setSmsRem] = useState(settings.sms_remetente || '');
  const tokenSet = !!settings.sms_api_token_set;
  const [busy, setBusy] = useState(false);

  async function salvar() {
    setBusy(true);
    const r = await fetch('/api/admin/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        escalonamento_horas: Number(horas),
        escalonamento_email_on: emailOn,
        escalonamento_sms_on: smsOn,
        sms_api_url: smsUrl,
        sms_remetente: smsRem,
        sms_api_token: smsToken, // em branco = mantém
      }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { toast('Configurações de torpedos salvas!', 'success'); setSmsToken(''); }
    else toast(d.error || 'Erro ao salvar', 'error');
  }

  return (
    <div className="adm-card" style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>Avisar o vendedor após (horas sem responder)</label>
        <input type="number" step="1" value={horas} onChange={(e) => setHoras(e.target.value)} style={inp} />
        <small style={hint}>Se o vendedor não responder o cliente no chat dentro desse tempo, ele é avisado por e-mail/SMS e o cliente é informado.</small>
      </div>

      <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} />
        <span><strong style={{ fontFamily: 'Outfit', fontSize: 13 }}>Avisar por e-mail</strong><br /><small style={hint}>Requer a chave RESEND_API_KEY configurada no Vercel.</small></span>
      </label>

      <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, cursor: 'pointer' }}>
        <input type="checkbox" checked={smsOn} onChange={(e) => setSmsOn(e.target.checked)} />
        <span><strong style={{ fontFamily: 'Outfit', fontSize: 13 }}>Avisar por SMS</strong><br /><small style={hint}>Liga o envio de SMS (configure a API abaixo). Por enquanto pode deixar desligado.</small></span>
      </label>

      <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--soft, #FAFAFA)', opacity: smsOn ? 1 : .6 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>SMS — URL da API</label>
          <input value={smsUrl} onChange={(e) => setSmsUrl(e.target.value)} placeholder="https://api.seuprovedor.com/sms" style={inp} autoComplete="off" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>SMS — Token</label>
          <input type="password" value={smsToken} onChange={(e) => setSmsToken(e.target.value)}
            placeholder={tokenSet ? '•••••••• (já salvo — deixe em branco para manter)' : 'token do provedor'} style={inp} autoComplete="off" />
        </div>
        <div>
          <label style={lbl}>SMS — Remetente (opcional)</label>
          <input value={smsRem} onChange={(e) => setSmsRem(e.target.value)} placeholder="ComBarato" style={inp} autoComplete="off" />
        </div>
        <small style={{ ...hint, display: 'block', marginTop: 8 }}>💡 A estrutura do SMS já está pronta. É só preencher a URL e o token do provedor quando você contratar um, ligar o SMS e salvar.</small>
      </div>

      <button className="adm-btn ap" disabled={busy} onClick={salvar} style={{ marginTop: 16 }}>{busy ? 'Salvando…' : 'Salvar configurações'}</button>
    </div>
  );
}
const lbl = { display: 'block', fontFamily: 'Outfit', fontWeight: 800, fontSize: 13, marginBottom: 8 } as const;
const inp = { width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14, marginBottom: 6, background: '#fff' } as const;
const hint = { color: 'var(--muted)', fontSize: 12 } as const;
