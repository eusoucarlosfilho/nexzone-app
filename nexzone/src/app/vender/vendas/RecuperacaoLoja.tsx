'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';

// Painel do vendedor › Vendas: recuperação de vendas da loja.
// Fica recolhido num botão que mostra quantos clientes há para recuperar; clicou, abre:
// status dos lembretes automáticos, botão para chamar de uma vez quem ficou para trás e atalhos para o contato um a um.
type Status = {
  minutos: number; roboEm: string | null; whatsapp: boolean;
  produtos: { total: number; comRecuperacao: number };
  antigos: { pedidos: number; carrinhos: number };
};

export default function RecuperacaoLoja({ pendentes, carrinhos, onVer }: { pendentes: number; carrinhos: number; onVer: (filtro: 'aguardando' | 'abandonou') => void }) {
  const [s, setS] = useState<Status | null>(null);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/vender/recuperacao', { cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setS(j);
    } catch { /* sem o status, o painel mostra só os atalhos */ }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const antigos = s ? s.antigos.pedidos + s.antigos.carrinhos : 0;
  const contatos = pendentes + carrinhos;
  // Número do botão: quem dá para chamar agora pelo botão; sem o status, quem está na lista para contato manual
  const qt = s ? antigos : contatos;
  const roboOk = !!(s?.roboEm && Date.now() - new Date(s.roboEm).getTime() < 10 * 60000);

  async function chamar() {
    if (!confirm(`Mandar lembrete para até 12 dos ${antigos} clientes que ficaram para trás nos últimos 7 dias? Cada cliente recebe uma vez só, pelo WhatsApp (quem aceitou avisos) e por e-mail.`)) return;
    setEnviando(true);
    try {
      const r = await fetch('/api/vender/recuperacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'antigos' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast(j.error || 'Não foi possível enviar.', 'error');
      else toast(`${j.enviados} lembretes enviados${j.restantes ? `. Faltam ${j.restantes}: clique de novo daqui a alguns minutos.` : '. Ninguém ficou para trás.'}`, 'success');
      carregar();
    } finally { setEnviando(false); }
  }

  if (!s && !contatos) return null;
  const ponto = (ok: boolean) => <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: ok ? '#22C55E' : '#EF4444', marginRight: 7, flexShrink: 0 }} />;

  return (
    <div className="card rl" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .rl-top{width:100%;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 18px;background:none;border:0;cursor:pointer;text-align:left;font-family:inherit;color:var(--text)}
        .rl-top:hover .rl-tit{color:var(--orange-ink)}
        .rl-ic{width:36px;height:36px;border-radius:11px;background:var(--soft);color:var(--orange-ink);display:grid;place-items:center;flex-shrink:0}
        .rl-tit{font-family:'Outfit';font-weight:900;font-size:16px;transition:color .15s}
        .rl-qt{display:inline-flex;align-items:center;background:var(--orange);color:#fff;border-radius:50px;padding:5px 12px;font-weight:900;font-size:13px;animation:rlPulse 1.8s ease-in-out infinite}
        .rl-zero{color:var(--muted);font-size:13px;font-weight:700}
        .rl-sv{margin-left:auto;color:var(--muted);font-size:13px;font-weight:800;white-space:nowrap}
        .rl-body{border-top:1px solid var(--border);padding:16px 18px 18px}
        .rl-st{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;font-size:13.5px;margin-bottom:14px}
        .rl-st small{color:var(--muted);font-size:12.5px;line-height:1.45}
        .rl-st a{color:var(--orange-ink);font-weight:800;font-size:12.5px}
        .rl-acoes{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .rl-go{display:inline-flex;align-items:center;gap:6px;background:#22C55E;color:#06371B;border:0;border-radius:50px;padding:10px 16px;font-weight:900;font-size:13.5px;cursor:pointer}
        .rl-go:disabled{opacity:.55;cursor:not-allowed}
        .rl-bt{display:inline-flex;align-items:center;gap:6px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:50px;padding:9px 14px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap}
        @keyframes rlPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,107,0,.5)}50%{box-shadow:0 0 0 7px rgba(255,107,0,0)}}
        @media (prefers-reduced-motion:reduce){.rl-qt{animation:none}}
        @media (max-width:560px){.rl-sv{margin-left:48px}.rl-acoes>*{flex:1 1 100%;justify-content:center}}
      ` }} />
      <button type="button" className="rl-top" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        <span className="rl-ic"><Icon name="chat" size={18} /></span>
        <span className="rl-tit">Recuperação de vendas</span>
        {qt > 0
          ? <span className="rl-qt">{qt} para recuperar</span>
          : <span className="rl-zero">Ninguém para chamar agora</span>}
        <span className="rl-sv">{aberto ? 'Fechar ▲' : qt ? 'Abrir e chamar ▼' : 'Ver detalhes ▼'}</span>
      </button>

      {aberto && (
        <div className="rl-body">
          {s && (
            <div className="rl-st">
              <div style={{ display: 'flex' }}>{ponto(roboOk)}<div><b>Lembrete automático</b><br /><small>{roboOk ? `Ligado. Quem gera o Pix e não paga recebe um lembrete ${s.minutos} min depois e outro em 24 h.` : 'Pausado no momento. Use o botão abaixo para chamar quem ficou para trás.'}</small></div></div>
              <div style={{ display: 'flex' }}>{ponto(!s.produtos.total || s.produtos.comRecuperacao === s.produtos.total)}<div><b>Carrinho abandonado</b><br /><small>Ligado em {s.produtos.comRecuperacao} de {s.produtos.total} {s.produtos.total === 1 ? 'produto' : 'produtos'}. Dá para colocar um cupom de volta em cada um.</small><br /><a href="/vender/produtos">Configurar em Produtos › Checkout e order bump →</a></div></div>
              <div style={{ display: 'flex' }}>{ponto(s.whatsapp)}<div><b>WhatsApp</b><br /><small>{s.whatsapp ? 'As mensagens saem pelo WhatsApp oficial do Comprei Barato e por e-mail.' : 'Saindo só por e-mail no momento. Use também o contato direto abaixo.'}</small></div></div>
            </div>
          )}

          <div className="rl-acoes">
            {s && (
              <button className="rl-go" disabled={enviando || !antigos} onClick={chamar}>
                <Icon name="chat" size={15} />
                {enviando ? 'Enviando… (até 1 min)' : antigos ? `Chamar quem ficou para trás (${antigos})` : 'Ninguém para trás nos últimos 7 dias'}
              </button>
            )}
            {pendentes > 0 && <button className="rl-bt" onClick={() => onVer('aguardando')}>Ver {pendentes} {pendentes === 1 ? 'Pix não pago' : 'Pix não pagos'}</button>}
            {carrinhos > 0 && <button className="rl-bt" onClick={() => onVer('abandonou')}>Ver {carrinhos} {carrinhos === 1 ? 'carrinho' : 'carrinhos'}</button>}
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>
            {s && antigos > 0 && <>{s.antigos.pedidos} Pix não pagos e {s.antigos.carrinhos} carrinhos dos últimos 7 dias ainda sem lembrete. Vai de 12 em 12, com intervalo, para proteger o número. </>}
            Nas listas você chama um a um pelo seu WhatsApp, com a mensagem pronta. É o reforço que mais recupera.
          </p>
        </div>
      )}
    </div>
  );
}
