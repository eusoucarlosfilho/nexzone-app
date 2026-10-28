import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { validarEtapa1, validarEtapa2, limparOrigem } from '@/lib/recrutamento';
import { enviarEventoMeta, ipDaRequisicao, cliquesMeta, lerConfig } from '@/lib/recrutamento-servidor';
import { avisarEquipeLead } from '@/lib/recrutamento-avisos';

export const dynamic = 'force-dynamic';

// Formulário público da página /produtores.
//   POST { etapa: 1, token, nome, whatsapp, email?, instagram?, origem?, eventId?, url? }
//   POST { etapa: 2, token, nicho, tipos[], ja_vende, plataformas[], faturamento?, link_produto?, mensagem?, eventId?, url? }
//   POST { etapa: 'contato', token, eventId? }   → clique no WhatsApp da página de obrigado (só evento do Meta)
// Grava com service_role; a tabela não é legível por ninguém de fora (SQL 20).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTO = /^[A-Za-z0-9_-]{8,80}$/;
const semTabela = (e: any) => /produtores_interessados|42P01|relation .* does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`);

// limite simples por IP (por instância): 20 envios a cada 10 minutos
const janela = new Map<string, number[]>();
function muitoRapido(ip: string | null) {
  const k = ip || 'sem-ip';
  const agora = Date.now();
  const lista = (janela.get(k) || []).filter((t) => agora - t < 600000);
  lista.push(agora);
  janela.set(k, lista);
  if (janela.size > 5000) janela.clear();
  return lista.length > 20;
}

const urlDaPagina = (u: unknown) => {
  try { const x = new URL(String(u || '')); return /compreibarato\.com\.br$|localhost$|vercel\.app$/.test(x.hostname) ? x.toString().slice(0, 500) : null; } catch { return null; }
};

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }); }
  const ip = ipDaRequisicao(req);
  if (muitoRapido(ip)) return NextResponse.json({ error: 'Muitas tentativas. Espere alguns minutos.' }, { status: 429 });
  // armadilha para robôs: campo escondido preenchido = finge que deu certo e ignora
  if (typeof b.site === 'string' && b.site.trim()) return NextResponse.json({ ok: true, token: b.token });

  const token = String(b.token || '');
  if (!UUID.test(token)) return NextResponse.json({ error: 'Recarregue a página e tente de novo.' }, { status: 400 });
  const eventId = EVENTO.test(String(b.eventId || '')) ? String(b.eventId) : null;
  const url = urlDaPagina(b.url) || 'https://compreibarato.com.br/produtores';
  const ua = (req.headers.get('user-agent') || '').slice(0, 400) || null;
  const admin = createAdminClient();

  if (b.etapa === 1) {
    const v = validarEtapa1(b);
    if (!v.ok) return NextResponse.json({ error: v.erro, campo: v.campo }, { status: 400 });
    const origem = limparOrigem(b.origem);
    // mesmo WhatsApp já cadastrado: atualiza o cadastro existente em vez de duplicar
    const { data: existente, error: e1 } = await admin.from('produtores_interessados').select('id, token').or(`token.eq.${token},whatsapp.eq.${v.dados.whatsapp}`).order('criado_em', { ascending: true }).limit(1);
    if (e1) {
      if (semTabela(e1)) return NextResponse.json({ error: 'Cadastro indisponível no momento. Fale com a gente pelo WhatsApp.' }, { status: 503 });
      console.error('[produtores] leitura', e1.message);
      return NextResponse.json({ error: 'Não foi possível enviar. Tente de novo.' }, { status: 500 });
    }
    let tokenFinal = token;
    let novo = false;
    if (existente && existente.length) {
      tokenFinal = existente[0].token;
      const { error } = await admin.from('produtores_interessados').update({ ...v.dados, atualizado_em: new Date().toISOString() }).eq('id', existente[0].id);
      if (error) { console.error('[produtores] update', error.message); return NextResponse.json({ error: 'Não foi possível enviar. Tente de novo.' }, { status: 500 }); }
    } else {
      const { error } = await admin.from('produtores_interessados').insert({ token, ...v.dados, origem });
      if (error) {
        if (semTabela(error)) return NextResponse.json({ error: 'Cadastro indisponível no momento. Fale com a gente pelo WhatsApp.' }, { status: 503 });
        console.error('[produtores] insert', error.message);
        return NextResponse.json({ error: 'Não foi possível enviar. Tente de novo.' }, { status: 500 });
      }
      novo = true;
    }
    // aviso no WhatsApp/e-mail da equipe só no cadastro NOVO (reenvio do mesmo número não repete o aviso)
    if (novo) await avisarEquipeLead(admin, await lerConfig(admin), { etapa: 1, ...(v.dados as any), origem });
    if (eventId) {
      const { fbp, fbc } = cliquesMeta(req, origem.fbclid);
      await enviarEventoMeta(admin, { nome: 'LeadParcial', eventId, url, ip, userAgent: ua, fbp, fbc, pessoa: { nome: v.dados.nome, whatsapp: v.dados.whatsapp, email: v.dados.email, id: tokenFinal } });
    }
    return NextResponse.json({ ok: true, token: tokenFinal });
  }

  if (b.etapa === 2) {
    const v = validarEtapa2(b);
    if (!v.ok) return NextResponse.json({ error: v.erro, campo: v.campo }, { status: 400 });
    const { data, error } = await admin.from('produtores_interessados')
      .update({ ...v.dados, etapa: 2, atualizado_em: new Date().toISOString() })
      .eq('token', token).select('nome, whatsapp, email, instagram, origem');
    if (error) {
      if (semTabela(error)) return NextResponse.json({ error: 'Cadastro indisponível no momento. Fale com a gente pelo WhatsApp.' }, { status: 503 });
      console.error('[produtores] etapa 2', error.message);
      return NextResponse.json({ error: 'Não foi possível enviar. Tente de novo.' }, { status: 500 });
    }
    if (!data?.length) return NextResponse.json({ error: 'Não encontramos a 1ª etapa. Recarregue a página e preencha de novo.' }, { status: 404 });
    const p = data[0] as any;
    await avisarEquipeLead(admin, await lerConfig(admin), { etapa: 2, nome: p.nome, whatsapp: p.whatsapp, email: p.email, instagram: p.instagram, origem: p.origem, nicho: v.dados.nicho, ja_vende: v.dados.ja_vende, faturamento: v.dados.faturamento });
    if (eventId) {
      const { fbp, fbc } = cliquesMeta(req, p.origem?.fbclid);
      await enviarEventoMeta(admin, { nome: 'Lead', eventId, url, ip, userAgent: ua, fbp, fbc, pessoa: { nome: p.nome, whatsapp: p.whatsapp, email: p.email, id: token },
        dados: { nicho: v.dados.nicho, ja_vende: v.dados.ja_vende, faturamento: v.dados.faturamento || '' } });
    }
    return NextResponse.json({ ok: true });
  }

  if (b.etapa === 'contato') {
    if (!eventId) return NextResponse.json({ ok: true });
    const { data } = await admin.from('produtores_interessados').select('nome, whatsapp, email, origem').eq('token', token).limit(1);
    const p = (data ?? [])[0] as any;
    if (p) {
      const { fbp, fbc } = cliquesMeta(req, p.origem?.fbclid);
      await enviarEventoMeta(admin, { nome: 'Contact', eventId, url, ip, userAgent: ua, fbp, fbc, pessoa: { nome: p.nome, whatsapp: p.whatsapp, email: p.email, id: token } });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
}
