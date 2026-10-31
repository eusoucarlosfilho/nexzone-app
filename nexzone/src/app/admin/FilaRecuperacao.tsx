'use client';
import { useMemo, useState } from 'react';
import { escreverEmail } from '@/lib/escreverEmail';
import { toast } from '@/lib/toast';
import { mensagemRecuperacao, linkWhatsapp, foneLegivel } from '@/lib/recuperacaoVenda';
import { contatoRecente, haQuantoCurto, type ItemFila, type Situacao } from '@/lib/filaRecuperacao';
import { registrarContatoRecuperacao } from '@/lib/recuperacaoCliente';

// Fila de recuperação: uma linha por pessoa + produto, com tudo que já saiu para ela.
// Cada toque em WhatsApp / E-mail / Copiar fica registrado com o nome de quem tocou, para ninguém mandar em dobro.
const SIT: Record<Situacao, [string, string]> = {
  novo: ['Novo', '#FF9A3C'],
  lembrado: ['Lembrado (automático)', '#7AA7FF'],
  contatado: ['Contatado', '#3DDC97'],
  desistiu: ['Desistiu', '#8A8AA0'],
};
const FILTROS: { id: string; rotulo: string; sit: Situacao[] }[] = [
  { id: 'chamar', rotulo: 'Para chamar', sit: ['novo', 'lembrado'] },
  { id: 'contatados', rotulo: 'Contatados', sit: ['contatado'] },
  { id: 'desistiram', rotulo: 'Desistiram', sit: ['desistiu'] },
  { id: 'todos', rotulo: 'Todos', sit: ['novo', 'lembrado', 'contatado', 'desistiu'] },
];
const SITE = 'https://www.compreibarato.com.br';

export default function FilaRecuperacao({ itens: inicial, sql26, onMudou }: { itens: ItemFila[]; sql26: boolean; onMudou?: () => void }) {
  const [itens, setItens] = useState<ItemFila[]>(inicial);
  const [filtro, setFiltro] = useState('chamar');
  const [aberto, setAberto] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(8);
  const lista = useMemo(() => itens.filter((i) => FILTROS.find((f) => f.id === filtro)!.sit.includes(i.situacao)), [itens, filtro]);

  const mensagem = (it: ItemFila) => mensagemRecuperacao({
    nome: it.nome, produto: it.produto, loja: it.loja,
    link: `${SITE}/checkout/${it.productId}${it.email ? `?email=${encodeURIComponent(it.email)}&` : '?'}utm_source=recuperacao&utm_medium=manual`,
  });

  // Antes de abrir o WhatsApp/e-mail: avisa se alguém já chamou nas últimas 24 h. Depois registra (sem esperar).
  function antesDeContatar(e: React.MouseEvent, it: ItemFila, canal: 'whatsapp' | 'email' | 'copiar') {
    if (contatoRecente(it) && !confirm(`${it.nome || it.email || 'Este cliente'} já foi contatado ${haQuantoCurto(it.ultimoManual!.quando)}${it.ultimoManual!.por ? ` por ${it.ultimoManual!.por}` : ''}. Mandar mesmo assim?`)) {
      e.preventDefault(); return false;
    }
    if (sql26) {
      registrarContatoRecuperacao(it.chave, canal);
      const agora = new Date().toISOString();
      setItens((l) => l.map((x) => (x.chave === it.chave ? { ...x, situacao: x.situacao === 'desistiu' ? 'desistiu' : 'contatado', ultimoManual: { quando: agora, por: 'você', canal }, historico: [...x.historico, { quando: agora, canal, tipo: 'manual', rotulo: canal === 'whatsapp' ? 'WhatsApp manual' : canal === 'email' ? 'E-mail manual' : 'Mensagem copiada', por: 'você' }] } : x)));
    }
    return true;
  }

  async function copiar(e: React.MouseEvent, it: ItemFila) {
    if (!antesDeContatar(e, it, 'copiar')) return;
    try { await navigator.clipboard.writeText(mensagem(it)); toast('Mensagem copiada e contato registrado.', 'success'); } catch { toast('Não deu para copiar neste navegador.', 'error'); }
  }

  async function desistiu(it: ItemFila, sim: boolean) {
    if (sim && !confirm(`Marcar ${it.nome || it.email || 'este cliente'} como "Desistiu"? Ele sai da fila e não recebe mais lembretes automáticos deste produto.`)) return;
    const r = await fetch('/api/admin/recuperacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'situacao', chave: it.chave, desistiu: sim }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.error || 'Não foi possível salvar.', 'error'); return; }
    setItens((l) => l.map((x) => (x.chave === it.chave ? { ...x, situacao: sim ? 'desistiu' : (x.ultimoManual ? 'contatado' : x.historico.length ? 'lembrado' : 'novo') } : x)));
    toast(sim ? 'Marcado como desistiu. Os lembretes param.' : 'Cliente de volta na fila.', 'success');
    onMudou?.();
  }

  const qtd = (f: typeof FILTROS[number]) => itens.filter((i) => f.sit.includes(i.situacao)).length;

  return (
    <div className="fr">
      <style dangerouslySetInnerHTML={{ __html: `
        .fr{margin-top:16px;border-top:1px solid var(--bd2);padding-top:14px}
        .fr-h{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
        .fr-h b{font-family:Outfit;font-size:15.5px}
        .fr-fs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}
        .fr-f{border:1px solid var(--bd2);background:var(--panel2);color:var(--sub);border-radius:50px;padding:6px 12px;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap}
        .fr-f.on{background:var(--tx);color:var(--panel);border-color:var(--tx)}
        .fr-it{border:1px solid var(--bd2);border-radius:14px;padding:12px 14px;margin-top:10px;background:var(--panel)}
        .fr-top{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
        .fr-nome{font-weight:900;font-size:14.5px}
        .fr-sub{font-size:12.5px;color:var(--sub);margin-top:2px;line-height:1.45;word-break:break-word}
        .fr-sit{font-size:11px;font-weight:900;border-radius:50px;padding:3px 10px;white-space:nowrap;border:1px solid currentColor}
        .fr-res{font-size:12.5px;color:var(--sub);margin-top:8px;background:var(--panel2);border-radius:10px;padding:8px 10px;cursor:pointer;border:0;width:100%;text-align:left}
        .fr-res b{color:var(--tx)}
        .fr-hist{list-style:none;margin:8px 0 0;padding:0 0 0 4px;display:grid;gap:6px;font-size:12.5px}
        .fr-hist li{display:flex;gap:8px;align-items:baseline}
        .fr-hist .pt{width:8px;height:8px;border-radius:50%;flex:none;transform:translateY(-1px)}
        .fr-hist small{color:var(--sub)}
        .fr-acoes{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
        .fr-acoes a,.fr-acoes button{font-size:12.5px;text-decoration:none;display:inline-flex;align-items:center;gap:5px}
        .fr-av{font-size:12px;color:#F5B83D;font-weight:800;margin-top:6px}
      ` }} />
      <div className="fr-h">
        <b>Clientes para recuperar</b>
        <div className="fr-fs" role="tablist">
          {FILTROS.map((f) => <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} className={`fr-f ${filtro === f.id ? 'on' : ''}`} onClick={() => { setFiltro(f.id); setMostrar(8); }}>{f.rotulo} · {qtd(f)}</button>)}
        </div>
      </div>
      {!sql26 && <p className="fr-sub" style={{ color: '#F5B83D' }}>Rode o SQL 26 para registrar quem já foi contatado. Até lá, a fila mostra só os envios automáticos.</p>}
      {!lista.length && <p className="fr-sub" style={{ padding: '10px 0' }}>{filtro === 'chamar' ? 'Ninguém para chamar agora. 🎉' : 'Ninguém aqui.'}</p>}

      {lista.slice(0, mostrar).map((it) => {
        const wa = it.avisos ? linkWhatsapp(it.whatsapp, mensagem(it)) : null;
        const [sitTxt, sitCor] = SIT[it.situacao];
        const ultimo = it.historico[it.historico.length - 1];
        const recente = contatoRecente(it);
        const falhas = it.historico.filter((h) => h.status === 'falhou').length;
        return (
          <div key={it.chave} className="fr-it">
            <div className="fr-top">
              <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                <div className="fr-nome">{it.nome || it.email || 'Cliente sem nome'}</div>
                <div className="fr-sub">
                  {it.tipo === 'pix' ? `Gerou Pix${it.pedidos.length > 1 ? ` ${it.pedidos.length}×` : ''}` : 'Saiu no checkout'} · {it.produto}{it.valor != null ? ` · R$ ${Number(it.valor).toFixed(2).replace('.', ',')}` : ''} · {haQuantoCurto(it.desde)}
                  {it.loja ? <><br />Loja: {it.loja}</> : null}
                  <br />{[it.email, it.whatsapp ? `${foneLegivel(it.whatsapp)}${it.avisos ? '' : ' (não aceitou avisos)'}` : null].filter(Boolean).join(' · ') || 'sem contato'}
                </div>
              </div>
              <span className="fr-sit" style={{ color: sitCor }}>{sitTxt}</span>
            </div>

            <button type="button" className="fr-res" onClick={() => setAberto(aberto === it.chave ? null : it.chave)} aria-expanded={aberto === it.chave}>
              {it.historico.length
                ? <><b>{it.historico.length} {it.historico.length === 1 ? 'envio' : 'envios'}</b> · último: {ultimo.rotulo}{ultimo.por ? ` por ${ultimo.por}` : ''} {haQuantoCurto(ultimo.quando)}{falhas ? ` · ${falhas} falhou` : ''} {aberto === it.chave ? '▲' : '▼'}</>
                : <><b>Nada enviado ainda</b> (o lembrete automático sai sozinho no tempo configurado)</>}
            </button>
            {aberto === it.chave && it.historico.length > 0 && (
              <ul className="fr-hist">
                {it.historico.map((h, i) => (
                  <li key={i}>
                    <span className="pt" style={{ background: h.tipo === 'manual' ? '#3DDC97' : h.status === 'falhou' ? '#FF5C5C' : '#7AA7FF' }} />
                    <span>{h.rotulo}{h.por ? ` · ${h.por}` : ''}{h.status === 'falhou' ? ' · falhou' : h.status === 'adiado' ? ' · adiado' : ''} <small>{new Date(h.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></span>
                  </li>
                ))}
              </ul>
            )}
            {recente && it.situacao !== 'desistiu' && <div className="fr-av">⚠ {it.ultimoManual!.por ? `${it.ultimoManual!.por} chamou` : 'Contatado'} {haQuantoCurto(it.ultimoManual!.quando)}. Espere a resposta antes de mandar de novo.</div>}

            <div className="fr-acoes">
              {it.situacao !== 'desistiu' && <>
                {wa && <a className="adm-btn ap" href={wa} target="_blank" rel="noreferrer" onClick={(e) => antesDeContatar(e, it, 'whatsapp')}>WhatsApp</a>}
                {it.email && <button type="button" className="adm-btn rp" onClick={(e) => { if (antesDeContatar(e, it, 'email') === false) return; escreverEmail(it.email!, it.tipo === 'pix' ? 'pix_pendente' : 'carrinho_abandonado', { nome: it.nome, produto: it.produto, link: `${SITE}/checkout/${it.productId}?email=${encodeURIComponent(it.email!)}&utm_source=recuperacao&utm_medium=email` }); }}>E-mail</button>}
                <button type="button" className="adm-btn rp" onClick={(e) => copiar(e, it)}>Copiar mensagem</button>
              </>}
              {sql26 && (it.situacao === 'desistiu'
                ? <button type="button" className="adm-btn rp" onClick={() => desistiu(it, false)}>Voltar para a fila</button>
                : <button type="button" className="adm-btn rp" style={{ marginLeft: 'auto' }} onClick={() => desistiu(it, true)}>Desistiu</button>)}
            </div>
          </div>
        );
      })}
      {lista.length > mostrar && <button type="button" className="adm-btn rp" style={{ marginTop: 10, width: '100%' }} onClick={() => setMostrar((m) => m + 20)}>Ver mais {lista.length - mostrar}</button>}
    </div>
  );
}
