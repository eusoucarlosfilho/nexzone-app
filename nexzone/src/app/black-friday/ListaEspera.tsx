'use client';
import { useState } from 'react';
import { coletarOrigem } from '@/components/PixelsVenda';
import { eventoInstitucional } from '@/lib/pixelInstitucional';

// Formulário da lista de espera da Black Friday Gamer
export default function ListaEspera() {
  const [d, setD] = useState({ nome: '', email: '', whatsapp: '', aceitaWhatsapp: true, site: '' });
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'ok'>('livre');
  const [erro, setErro] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setEstado('enviando');
    try {
      const r = await fetch('/api/black-friday/espera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, origem: coletarOrigem() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error || 'Não deu certo. Tente de novo.'); setEstado('livre'); return; }
      eventoInstitucional('Lead', { content_name: 'Lista de espera Black Friday Gamer', content_category: 'black_friday_gamer' });
      setEstado('ok');
    } catch { setErro('Falha de conexão. Tente de novo.'); setEstado('livre'); }
  }

  if (estado === 'ok') return (
    <div className="bf-ok" role="status"><b>Você está na lista ✓</b><span>Assim que a Black Friday Gamer começar, a gente te avisa{d.whatsapp && d.aceitaWhatsapp ? ' por e-mail e WhatsApp' : ' por e-mail'}.</span></div>
  );
  return (
    <form className="bf-form" onSubmit={enviar}>
      <input aria-label="Seu nome" placeholder="Seu nome" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} maxLength={80} autoComplete="given-name" />
      <input aria-label="Seu e-mail" placeholder="Seu e-mail" type="email" required value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} maxLength={200} autoComplete="email" />
      <input aria-label="WhatsApp (opcional)" placeholder="WhatsApp (opcional)" inputMode="tel" value={d.whatsapp} onChange={(e) => setD({ ...d, whatsapp: e.target.value })} maxLength={20} autoComplete="tel" />
      <input tabIndex={-1} aria-hidden="true" autoComplete="off" value={d.site} onChange={(e) => setD({ ...d, site: e.target.value })} style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
      {d.whatsapp && <label className="bf-chk"><input type="checkbox" checked={d.aceitaWhatsapp} onChange={(e) => setD({ ...d, aceitaWhatsapp: e.target.checked })} /> Quero o aviso também no WhatsApp</label>}
      <button className="btn btn-pri" disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Entrando…' : 'Quero ser avisado'}</button>
      {erro && <small role="alert" style={{ color: '#FFB4A8' }}>{erro}</small>}
      <small className="bf-mini">Só avisos da Black Friday Gamer. Sem spam, e você sai quando quiser.</small>
    </form>
  );
}
