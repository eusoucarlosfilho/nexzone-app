import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { validarEtapa1, validarEtapa2, limparOrigem } from '@/lib/recrutamento';
import { enviarEventoMeta, ipDaRequisicao, cliquesMeta, lerConfig } from '@/lib/recrutamento-servidor';
import { avisarNovoProdutor } from '@/lib/recrutamento-avisos';
import { criarContaELoja } from '@/lib/contaLojista';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Formulário público da página /produtores.
//   POST { etapa: 1, token, nome, whatsapp, email, senha, instagram?, origem?, eventId?, url? }
//        → grava o lead, CRIA A CONTA E A LOJA e já deixa a pessoa logada (cai direto no painel da loja)
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
    // conta no site: e-mail e senha são obrigatórios aqui
    if (!v.dados.email) return NextResponse.json({ error: 'Informe seu e-mail: ele é o login da sua loja.', campo: 'email' }, { status: 400 });
    const senha = String(b.senha ?? '');
    if (senha.length < 6) return NextResponse.json({ error: 'Crie uma senha com pelo menos 6 caracteres.', campo: 'senha' }, { status: 400 });
    if (senha.length > 72) return NextResponse.json({ error: 'Senha muito longa (máximo 72 caracteres).', campo: 'senha' }, { status: 400 });
    const { data: { user: logado } } = await createClient().auth.getUser();
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
    // conta + loja + sessão (quem já está logado neste navegador só segue para o painel)
    let conta: { existe?: boolean; slug?: string | null; logado?: boolean } = {};
    if (logado) conta = { logado: true };
    else {
      const r = await criarContaELoja(admin, { nome: v.dados.nome, email: String(v.dados.email), senha, whatsapp: v.dados.whatsapp, instagram: v.dados.instagram, origem });
      if (!r.ok && 'erro' in r) return NextResponse.json({ error: r.erro }, { status: 502 });
      conta = r.ok ? { slug: r.slug, logado: r.logado } : { existe: true };
    }
    // aviso ÚNICO da equipe, só no WhatsApp: chegou mais um produtor (reenvio do mesmo número não repete)
    if (novo) await avisarNovoProdutor(await lerConfig(admin), { nome: v.dados.nome, whatsapp: v.dados.whatsapp, instagram: v.dados.instagram, slug: conta.slug ?? null, jaTinhaConta: !!conta.existe, origem });
    if (eventId) {
      const { fbp, fbc } = cliquesMeta(req, origem.fbclid);
      await enviarEventoMeta(admin, { nome: 'LeadParcial', eventId, url, ip, userAgent: ua, fbp, fbc, pessoa: { nome: v.dados.nome, whatsapp: v.dados.whatsapp, email: v.dados.email, id: tokenFinal } });
    }
    return NextResponse.json({ ok: true, token: tokenFinal, existe: !!conta.existe, logado: !!conta.logado });
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
    const p = data[0] as any; // sem aviso aqui: a equipe já foi avisada no WhatsApp quando a loja foi criada
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
