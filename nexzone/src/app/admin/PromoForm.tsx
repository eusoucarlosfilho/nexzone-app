'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';

type Stats = {
  inscritos: number | null;
  migracaoOk: boolean;
  cota: { hoje: number; mes: number } | null;
  limiteDiario: number;
  limiteMensal: number;
  chaveOk: boolean;
};

export default function PromoForm() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [assunto, setAssunto] = useState('');
  const [texto, setTexto] = useState('');
  const [botaoTexto, setBotaoTexto] = useState('Ver ofertas');
  const [botaoUrl, setBotaoUrl] = useState('https://www.compreibarato.com.br');
  const [busy, setBusy] = useState<'' | 'teste' | 'enviar'>('');
  const [testado, setTestado] = useState('');      // assinatura do conteúdo já testado
  const [resultado, setResultado] = useState('');

  async function carregar() {
    try {
      const r = await fetch('/api/admin/promo', { credentials: 'include', cache: 'no-store' });
      if (r.ok) setStats(await r.json());
    } catch {}
  }
  useEffect(() => { carregar(); }, []);

  const assinatura = useMemo(() => JSON.stringify([assunto.trim(), texto.trim(), botaoTexto.trim(), botaoUrl.trim()]), [assunto, texto, botaoTexto, botaoUrl]);
  const testeValido = testado !== '' && testado === assinatura;

  const livresHoje = stats?.cota ? Math.max(0, stats.limiteDiario - stats.cota.hoje) : 0;
  const livresMes = stats?.cota ? Math.max(0, stats.limiteMensal - stats.cota.mes) : 0;
  const inscritos = stats?.inscritos ?? 0;
  const cabeHoje = inscritos > 0 && inscritos <= livresHoje && inscritos <= livresMes;
  const podeEnviar = !!stats?.chaveOk && !!stats?.migracaoOk && testeValido && cabeHoje && !busy;

  async function chamar(acao: 'teste' | 'enviar') {
    if (acao === 'enviar') {
      const ok = window.confirm(`Enviar "${assunto.trim()}" para ${inscritos} pessoa(s) que aceitaram receber promoções?\n\nNão dá para desfazer.`);
      if (!ok) return;
    }
    setBusy(acao); setResultado('');
    try {
      const r = await fetch('/api/admin/promo', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, confirmar: acao === 'enviar', assunto, texto, botaoTexto, botaoUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Falha no envio', 'error'); setResultado(d.error || ''); return; }
      if (acao === 'teste') {
        setTestado(assinatura);
        toast(`Teste enviado para ${d.enviadoPara}`, 'success');
        setResultado(`Teste enviado para ${d.enviadoPara}. Confira na caixa de entrada (e no spam) antes de enviar para todos.`);
      } else {
        toast(`Promoção enviada: ${d.enviados}/${d.total}`, d.falhas ? 'error' : 'success');
        setResultado(`Enviados: ${d.enviados} de ${d.total}${d.falhas ? ` · falhas: ${d.falhas} (${(d.erros || []).join('; ')})` : ''}.`);
        setTestado('');
      }
    } catch {
      toast('Falha de conexão', 'error');
    } finally {
      setBusy('');
      carregar();
    }
  }

  return (
    <div className="adm-card" style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 12, background: 'var(--panel2)', border: '1px solid var(--bd2)', marginBottom: 18 }}>
        <Icon name="info" size={16} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          <strong>Plano grátis do Resend: 100 e-mails por dia e 3.000 por mês</strong> (somando avisos de compra, venda, chat e promoções; o dia vira à meia-noite UTC, 21h em Brasília).
          {stats?.cota && (
            <> Usados hoje: <b>{stats.cota.hoje}/{stats.limiteDiario}</b> · no mês: <b>{stats.cota.mes}/{stats.limiteMensal}</b>.</>
          )}
          <br />Envios acima do limite diário são bloqueados. Promoções vão <b>somente</b> para quem marcou “Quero receber promoções” em Minha conta, sempre com o link “Não quero mais receber”.
        </div>
      </div>

      {stats && !stats.chaveOk && <p style={aviso}>RESEND_API_KEY não está configurada na Vercel. Envio desativado.</p>}
      {stats && !stats.migracaoOk && <p style={aviso}>A migração 0003 (e-mails) ainda não foi aplicada no Supabase. Envio desativado.</p>}

      <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 15, marginBottom: 14 }}>
        Inscritos: {stats?.inscritos ?? '—'} {stats && inscritos > livresHoje && inscritos > 0 && (
          <span style={{ color: '#E23B3B', fontSize: 13 }}> · acima do que resta hoje ({livresHoje})</span>
        )}
      </div>

      <label style={lbl}>Assunto</label>
      <input value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={150} placeholder="Ex.: Semana do Template — até 50% off" style={inp} />

      <label style={lbl}>Texto</label>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={5000} rows={7}
        placeholder={'Escreva a mensagem.\n\nDeixe uma linha em branco para começar outro parágrafo.'}
        style={{ ...inp, height: 'auto', padding: 12, lineHeight: 1.5, resize: 'vertical' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
        <div>
          <label style={lbl}>Texto do botão</label>
          <input value={botaoTexto} onChange={(e) => setBotaoTexto(e.target.value)} maxLength={40} style={inp} />
        </div>
        <div>
          <label style={lbl}>Link do botão</label>
          <input value={botaoUrl} onChange={(e) => setBotaoUrl(e.target.value)} placeholder="https://www.compreibarato.com.br/..." style={inp} />
        </div>
      </div>
      <small style={hint}>Deixe o link em branco para enviar sem botão.</small>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        <button className="adm-btn rp" disabled={!!busy || !stats?.chaveOk || !stats?.migracaoOk} onClick={() => chamar('teste')}>
          {busy === 'teste' ? 'Enviando teste…' : 'Enviar teste para mim'}
        </button>
        <button className="adm-btn ap" disabled={!podeEnviar} onClick={() => chamar('enviar')}
          title={!testeValido ? 'Envie um teste deste mesmo conteúdo antes' : !cabeHoje ? 'Sem inscritos ou acima da cota' : ''}>
          {busy === 'enviar' ? 'Enviando…' : `Enviar para ${inscritos} inscrito(s)`}
        </button>
      </div>
      {!testeValido && <small style={{ ...hint, display: 'block', marginTop: 8 }}>O envio para todos libera depois de um teste com exatamente este conteúdo.</small>}
      {resultado && <p style={{ fontSize: 13, marginTop: 12 }}>{resultado}</p>}
    </div>
  );
}

const lbl = { display: 'block', fontFamily: 'Outfit', fontWeight: 800, fontSize: 13, margin: '10px 0 6px' } as const;
const inp = { width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--bd2, #E4E4ED)', padding: '0 12px', fontSize: 14, marginBottom: 4, background: 'var(--panel, #fff)', color: 'var(--tx, #16161F)' } as const;
const hint = { color: 'var(--sub)', fontSize: 12 } as const;
const aviso = { color: '#E23B3B', fontSize: 13, fontWeight: 700, marginBottom: 12 } as const;
