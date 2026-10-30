'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

// Admin › Configurações › Crescimento: Black Friday Gamer, oferta do dia e canais de ofertas.
type Dados = {
  sql30: boolean;
  tema: { modo: 'auto' | 'ligado' | 'desligado'; ativo: boolean; fase: 'esquenta' | 'black' | null };
  bf: { inicio: string; fim: string; descontoMin: number; fase: 'antes' | 'durante' | 'depois'; lista: number; avisados: number; inscritos: number };
  canais: { whatsapp: string; telegram: string; telegramToken: boolean; telegramChat: string; hora: number; postadoHoje: boolean; manualHoje: boolean };
  oferta: { id: string; titulo: string; preco: number; preco_promo: number | null; link: string; texto: string } | null;
};
const lbl: React.CSSProperties = { display: 'block', fontSize: 12.5, color: 'var(--sub)', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14 };
// ISO → "YYYY-MM-DDTHH:mm" no horário de Brasília (para o campo de data e hora)
const paraCampo = (iso: string) => new Date(Date.parse(iso) - 3 * 3600000).toISOString().slice(0, 16);
const doCampo = (v: string) => `${v}:00-03:00`;

export default function CrescimentoAdmin() {
  const [d, setD] = useState<Dados | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  const carregar = useCallback(async () => {
    const r = await fetch('/api/admin/crescimento-ofertas', { cache: 'no-store', credentials: 'include' });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) { toast('Falha ao carregar crescimento.', 'error'); return; }
    setD(j);
    setF({ inicio: paraCampo(j.bf.inicio), fim: paraCampo(j.bf.fim), descontoMin: String(j.bf.descontoMin), whatsapp: j.canais.whatsapp, telegram: j.canais.telegram, telegramChat: j.canais.telegramChat, hora: String(j.canais.hora), telegramToken: '', produto: '' });
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function post(corpo: any, ok: string) {
    setBusy(corpo.acao);
    try {
      const r = await fetch('/api/admin/crescimento-ofertas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível.', 'error'); return null; }
      toast(ok, 'success'); await carregar(); return j;
    } finally { setBusy(''); }
  }
  async function avisar() {
    const j = await post({ acao: 'avisar' }, 'Lote enviado.');
    if (j) toast(`${j.enviados} e-mails enviados · faltam ${j.restantes}.`, 'info');
  }

  if (!d) return <div className="adm-card" style={{ maxWidth: 760, marginTop: 18 }}>Carregando crescimento…</div>;
  const c = (k: string, rot: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label style={{ flex: '1 1 200px' }}><span style={lbl}>{rot}</span><input style={inp} value={f[k] ?? ''} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} {...extra} /></label>
  );
  const fase = { antes: 'ainda não começou', durante: 'NO AR agora', depois: 'encerrada' }[d.bf.fase];

  return (
    <div className="adm-card" style={{ maxWidth: 760, marginTop: 18 }}>
      <h3 className="adm-ct" style={{ marginTop: 0 }}>Crescimento: Black Friday, oferta do dia e canais</h3>
      {!d.sql30 && <p style={{ color: '#B45309', fontWeight: 700, fontSize: 13.5 }}>Falta rodar o SQL 30 para a lista de espera e a inscrição da Black Friday.</p>}

      <h4 style={{ fontFamily: 'Outfit', margin: '10px 0 6px' }}>Tema Black do site · {d.tema.ativo ? (d.tema.fase === 'black' ? 'LIGADO (Black ao vivo)' : 'LIGADO (Esquenta Black)') : 'desligado'}</h4>
      <p style={{ fontSize: 13.5, margin: '0 0 8px', color: 'var(--sub)' }}>Faixa preta com contagem em todas as páginas, botão BLACK FRIDAY no menu, topo da home no preto, selo BLACK nos descontos e vitrine &quot;Esquenta Black&quot;. No automático, liga 30 dias antes do início e desliga sozinho quando a Black termina.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([['auto', 'Automático'], ['ligado', 'Ligado agora'], ['desligado', 'Desligado']] as const).map(([m, rot]) => (
          <button key={m} className={`adm-btn ${d.tema.modo === m ? 'ap' : 'rp'}`} disabled={!!busy || d.tema.modo === m} onClick={() => post({ acao: 'salvar_tema', modo: m }, 'Tema salvo. O site atualiza em até 1 minuto.')}>{d.tema.modo === m ? '✓ ' : ''}{rot}</button>
        ))}
      </div>

      <h4 style={{ fontFamily: 'Outfit', margin: '22px 0 6px' }}>Black Friday Gamer · {fase}</h4>
      <p style={{ fontSize: 13.5, margin: '0 0 10px' }}><b>{d.bf.lista}</b> na lista de espera ({d.bf.avisados} já avisados) · <b>{d.bf.inscritos}</b> produtos inscritos pelos vendedores · página <a href="/black-friday" target="_blank" rel="noreferrer">/black-friday</a></p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {c('inicio', 'Começa (horário de Brasília)', { type: 'datetime-local' })}
        {c('fim', 'Termina', { type: 'datetime-local' })}
        {c('descontoMin', 'Desconto mínimo (%)', { inputMode: 'numeric' })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button className="adm-btn ap" disabled={!!busy} onClick={() => post({ acao: 'salvar_bf', inicio: doCampo(f.inicio), fim: doCampo(f.fim), descontoMin: Number(f.descontoMin) }, 'Datas salvas.')}>Salvar Black Friday</button>
        <a className="adm-btn rp" href="/api/admin/crescimento-ofertas?csv=1" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Baixar lista de espera (CSV)</a>
        <button className="adm-btn rp" disabled={!!busy || d.bf.fase === 'antes' || d.bf.avisados >= d.bf.lista} onClick={avisar} title="Disponível quando a campanha começar">{busy === 'avisar' ? 'Enviando…' : 'Avisar a lista por e-mail (até 90)'}</button>
      </div>
      <small style={{ display: 'block', color: 'var(--sub)', fontSize: 12, marginTop: 6 }}>O preço da Black Friday entra no ar sozinho no horário de início e volta ao normal no fim (rotina de 1 em 1 minuto). O aviso por e-mail vai em lotes de 90 por causa do limite diário do Resend; o CSV tem os WhatsApps de quem aceitou receber.</small>

      <h4 style={{ fontFamily: 'Outfit', margin: '22px 0 6px' }}>Oferta do dia</h4>
      {d.oferta ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, fontSize: 13.5 }}>
          <b>{d.oferta.titulo}</b> {d.canais.manualHoje ? <small>(escolhida por você para hoje)</small> : <small>(escolha automática: maior desconto + vendas, troca todo dia)</small>}
          <pre style={{ whiteSpace: 'pre-wrap', background: '#F6F6FA', borderRadius: 10, padding: 10, margin: '8px 0', fontFamily: 'inherit', fontSize: 13 }}>{d.oferta.texto}</pre>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="adm-btn ap" onClick={() => { navigator.clipboard?.writeText(d.oferta!.texto).then(() => toast('Texto copiado. Cole no canal do WhatsApp.', 'success')).catch(() => toast('Não deu para copiar.', 'error')); }}>Copiar texto para o canal</button>
            <button className="adm-btn rp" disabled={!!busy || !d.canais.telegramToken} onClick={() => post({ acao: 'postar_telegram' }, 'Postado no Telegram.')}>{d.canais.postadoHoje ? 'Postar de novo no Telegram' : 'Postar agora no Telegram'}</button>
          </div>
        </div>
      ) : <p style={{ fontSize: 13.5, color: 'var(--sub)' }}>Nenhum produto com promoção ativa hoje. A oferta do dia aparece quando algum anúncio tiver preço promocional.</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
        {c('produto', 'Escolher a oferta de hoje (link ou ID do produto)')}
        <button className="adm-btn ap" disabled={!!busy || !f.produto} onClick={() => post({ acao: 'oferta_manual', produto: f.produto }, 'Oferta de hoje definida.')}>Usar hoje</button>
        {d.canais.manualHoje && <button className="adm-btn rp" disabled={!!busy} onClick={() => post({ acao: 'oferta_manual', limpar: true }, 'Voltou para a escolha automática.')}>Voltar ao automático</button>}
      </div>

      <h4 style={{ fontFamily: 'Outfit', margin: '22px 0 6px' }}>Canais de ofertas</h4>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {c('whatsapp', 'Link do Canal do WhatsApp', { placeholder: 'https://whatsapp.com/channel/…' })}
        {c('telegram', 'Link do canal no Telegram', { placeholder: 'https://t.me/…' })}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        {c('telegramToken', d.canais.telegramToken ? 'Token do bot (já salvo — preencha só para trocar)' : 'Token do bot do Telegram', { type: 'password', autoComplete: 'off' })}
        {c('telegramChat', 'Canal para o bot postar', { placeholder: '@compreibarato_ofertas' })}
        {c('hora', 'Postar todo dia às (hora)', { inputMode: 'numeric' })}
      </div>
      <button className="adm-btn ap" style={{ marginTop: 10 }} disabled={!!busy} onClick={() => post({ acao: 'salvar_canais', whatsapp: f.whatsapp, telegram: f.telegram, telegramChat: f.telegramChat, hora: Number(f.hora), telegramToken: f.telegramToken }, 'Canais salvos.')}>Salvar canais</button>
      <small style={{ display: 'block', color: 'var(--sub)', fontSize: 12, marginTop: 6 }}>
        Os links aparecem na home e em /oferta-do-dia. O Canal do WhatsApp não tem envio automático: use &quot;Copiar texto&quot; e cole lá. No Telegram, crie um bot no @BotFather, coloque o bot como administrador do canal e cole o token aqui: ele posta a oferta sozinho todo dia na hora marcada.
      </small>
    </div>
  );
}
