'use client';
import { toast } from '@/lib/toast';
import { escreverEmail } from '@/lib/escreverEmail';
import Icon from './Icon';
import ProductThumb from './ProductThumb';
import { mensagemRecuperacao, linkWhatsapp, haQuanto, foneLegivel } from '@/lib/recuperacaoVenda';
import type { CarrinhoAbandonado } from '@/lib/clientesPedidos';
import { registrarContatoRecuperacao } from '@/lib/recuperacaoCliente';
import { chaveRecuperacao } from '@/lib/filaRecuperacao';

// Lista de quem preencheu os dados no checkout e saiu sem gerar o Pix, com contato e mensagem pronta.
// tema "loja" = painel do lojista (claro); "admin" = Sala de comando (usa as classes do admin).
const money = (v: number | null) => (v == null ? '—' : 'R$ ' + Number(v).toFixed(2).replace('.', ','));

export default function CarrinhosAbandonados({ itens, tema = 'loja', mostrarLoja = false, site = 'https://www.compreibarato.com.br', privado = false, registrar = false }: { itens: CarrinhoAbandonado[]; tema?: 'loja' | 'admin'; mostrarLoja?: boolean; site?: string; privado?: boolean; registrar?: boolean }) {
  const reg = (c: CarrinhoAbandonado, canal: 'whatsapp' | 'email' | 'copiar') => { if (registrar) registrarContatoRecuperacao(chaveRecuperacao(c.email, c.user_id, c.product_id), canal); };
  const adm = tema === 'admin';
  const linkDe = (c: CarrinhoAbandonado) => `${site}/checkout/${c.product_id}?email=${encodeURIComponent(c.email)}&utm_source=recuperacao&utm_medium=whatsapp`;
  const msg = (c: CarrinhoAbandonado) => mensagemRecuperacao({ nome: c.nome, produto: c.titulo, loja: c.loja, link: linkDe(c) });
  async function copiar(c: CarrinhoAbandonado) {
    try { await navigator.clipboard.writeText(msg(c)); reg(c, 'copiar'); toast('Mensagem copiada.', 'success'); } catch { toast('Não deu para copiar neste navegador.', 'error'); }
  }
  const sub = adm ? 'var(--sub)' : 'var(--muted)';
  const bt: React.CSSProperties = adm
    ? { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }
    : { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 50, padding: '7px 12px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none' };
  const wa: React.CSSProperties = adm ? bt : { ...bt, background: '#25D366', color: '#0B3D1E', border: 'none' };

  if (!itens.length) return <div style={{ padding: 28, color: sub, textAlign: 'center' }}>Ninguém abandonou o checkout nos últimos 30 dias.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <p style={{ fontSize: 13, color: sub, margin: adm ? '0 0 10px' : '14px 16px 6px' }}>
        Preencheram nome e e-mail no checkout e saíram antes de gerar o Pix. {privado ? 'O Comprei Barato manda os lembretes automáticos por você. Por segurança, o contato do cliente fica protegido pela plataforma.' : 'O lembrete automático já vai para eles; o contato direto é o reforço. WhatsApp só aparece para quem aceitou receber avisos.'}
      </p>
      <table className={adm ? 'adm-table' : undefined} style={adm ? undefined : { width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ textAlign: 'left' }}>
          {['Quando', 'Produto', 'Cliente', 'Valor', 'Lembretes', ''].map((h) => <th key={h} style={adm ? undefined : th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {itens.map((c) => {
            const zap = c.avisos ? linkWhatsapp(c.whatsapp, msg(c)) : null;
            return (
              <tr key={c.id} style={adm ? undefined : { borderTop: '1px solid var(--border)' }}>
                <td style={adm ? undefined : td}>{new Date(c.quando).toLocaleDateString('pt-BR')}<br /><small style={{ color: sub }}>{haQuanto(c.quando)}</small></td>
                <td style={adm ? undefined : td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ProductThumb capa_url={c.capa_url} categoria={c.categoria} titulo={c.titulo} tamanho={28} raio={7} icone={16} />{c.titulo}</span>{mostrarLoja && c.loja && <><br /><small style={{ color: sub }}>{c.loja}</small></>}</td>
                <td style={adm ? undefined : td}><b style={{ display: 'block' }}>{c.nome || '—'}</b><small style={{ color: sub }}>{c.email}{c.whatsapp ? ` · ${foneLegivel(c.whatsapp)}` : ''}</small></td>
                <td style={adm ? { whiteSpace: 'nowrap' } : { ...td, whiteSpace: 'nowrap', fontWeight: 800 }}>{money(c.preco)}</td>
                <td style={adm ? undefined : td}><small style={{ color: sub }}>{c.lembretes.length ? c.lembretes.join(' · ') : 'nenhum ainda'}</small></td>
                <td style={adm ? undefined : td}>
                  {privado ? <small style={{ color: sub }}>Lembrete automático</small> : <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {zap && <a className={adm ? 'adm-btn ap' : undefined} style={wa} href={zap} target="_blank" rel="noreferrer" onClick={() => reg(c, 'whatsapp')}><Icon name="chat" size={14} /> WhatsApp</a>}
                    {adm
                      ? <button type="button" className="adm-btn rp" style={bt} onClick={() => { reg(c, 'email'); escreverEmail(c.email, 'carrinho_abandonado', { nome: c.nome, produto: c.titulo, link: linkDe(c).replace('utm_medium=whatsapp', 'utm_medium=email') }); }}><Icon name="mail" size={14} /> E-mail</button>
                      : <a style={bt} href={`mailto:${c.email}?subject=${encodeURIComponent('Sua compra no Comprei Barato')}&body=${encodeURIComponent(msg(c))}`} onClick={() => reg(c, 'email')}><Icon name="mail" size={14} /> E-mail</a>}
                    <button type="button" className={adm ? 'adm-btn rp' : undefined} style={adm ? undefined : bt} onClick={() => copiar(c)}><Icon name="copy" size={14} /> Copiar</button>
                  </div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
const th: React.CSSProperties = { padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' };
const td: React.CSSProperties = { padding: '13px 16px', verticalAlign: 'top' };
