'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { linkWhatsapp, mensagemDoProdutor } from '@/lib/recrutamento';
import { iniciarPixel, evento, novoEventId } from '../pixel';

// Página de obrigado: o produtor já pode chamar a equipe no WhatsApp (lead quente responde em minutos).
export default function Obrigado({ pixel, whatsapp }: { pixel: string; whatsapp: string }) {
  const [est, setEst] = useState<{ token: string; nome: string } | null>(null);
  useEffect(() => {
    iniciarPixel(pixel);
    try { const s = JSON.parse(sessionStorage.getItem('cb_recrut') || 'null'); if (s?.token) setEst({ token: s.token, nome: s.nome || '' }); } catch {}
  }, [pixel]);

  const primeiro = est?.nome.split(' ')[0] || '';
  function chamar() {
    const eventId = novoEventId('contato');
    evento('Contact', eventId);
    if (est?.token) {
      try {
        const body = JSON.stringify({ etapa: 'contato', token: est.token, eventId, url: window.location.href });
        fetch('/api/produtores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
      } catch {}
    }
  }

  return (
    <div className="ob">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ob-card">
        <a href="/" className="ob-logo"><img src="/logo.png" alt="Comprei Barato" width={150} height={75} /></a>
        <div className="ob-ok"><Icon name="check" size={34} /></div>
        <h1>{primeiro ? `${primeiro}, recebemos seu cadastro!` : 'Recebemos seu cadastro!'}</h1>
        <p>Seu cadastro de <b>lojista</b> está em análise. A nossa equipe vai te chamar no WhatsApp para liberar seus primeiros anúncios.</p>
        {whatsapp ? (
          <>
            <p className="ob-forte">Quer adiantar? Chame a gente agora:</p>
            <a className="ob-btn" href={linkWhatsapp(whatsapp, mensagemDoProdutor(est?.nome || 'produtor'))} target="_blank" rel="noopener noreferrer" onClick={chamar}>
              <Icon name="chat" size={20} /> Falar agora no WhatsApp
            </a>
          </>
        ) : null}
        <ul>
          <li><Icon name="clock" size={16} /> Respondemos em horário comercial, normalmente no mesmo dia.</li>
          <li><Icon name="shield" size={16} /> Salve nosso número para não perder a mensagem.</li>
        </ul>
        <a className="ob-link" href="/">Conhecer o marketplace <Icon name="arrowRight" size={14} /></a>
      </div>
    </div>
  );
}

const CSS = `
.ob{min-height:100vh;background:#16162A radial-gradient(60% 50% at 70% 100%,rgba(255,107,0,.45),transparent);display:flex;align-items:center;justify-content:center;padding:28px 16px}
.ob-card{background:#fff;color:var(--text);border-radius:28px;max-width:520px;width:100%;padding:30px 26px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.35);animation:cb-up .5s var(--ease) both}
.ob-logo img{height:56px;width:auto;margin:0 auto 6px;display:block}
.ob-ok{width:70px;height:70px;border-radius:50%;background:var(--green-bg);color:var(--green);display:flex;align-items:center;justify-content:center;margin:8px auto 14px;animation:cb-pop .5s both}
.ob h1{font-family:'Outfit';font-size:26px;font-weight:900;letter-spacing:-.6px;margin:0 0 10px;line-height:1.15}
.ob p{color:var(--sub);line-height:1.6;margin:0 0 14px}
.ob p b{color:var(--text)}
.ob-forte{color:var(--text)!important;font-weight:800;margin-top:6px!important}
.ob-btn{display:flex;align-items:center;justify-content:center;gap:10px;min-height:58px;border-radius:16px;background:#1FAF5A;color:#fff;font-family:'Outfit';font-weight:900;font-size:18px;text-decoration:none;box-shadow:0 14px 30px rgba(31,175,90,.35);transition:transform .15s}
.ob-btn:hover{transform:translateY(-2px)}
.ob ul{list-style:none;padding:0;margin:20px 0 6px;display:grid;gap:8px;text-align:left}
.ob li{display:flex;gap:8px;align-items:flex-start;color:var(--sub);font-size:14px;font-weight:700}
.ob li svg{flex:none;margin-top:2px;color:#E85F00}
.ob-link{display:inline-flex;align-items:center;gap:6px;margin-top:10px;color:#B84A00;font-weight:800;font-size:14px}
`;
