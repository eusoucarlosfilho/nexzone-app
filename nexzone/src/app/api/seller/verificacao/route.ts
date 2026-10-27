import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { statusVerificacao, caminhoKycValido } from '@/lib/verificacao-servidor';
import { semSql19 } from '@/lib/posVenda-servidor';
import { cpfValido, cnpjValido, soDigitos, idade } from '@/lib/documento';
import { cifrar } from '@/lib/whatsapp/config';

export const dynamic = 'force-dynamic';

// Verificação do produtor: GET → situação; POST → envia (ou reenvia) os dados e documentos.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  return NextResponse.json(await statusVerificacao(createAdminClient(), user.id), { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const erro = (m: string, campo?: string) => NextResponse.json({ error: m, campo }, { status: 400 });

  const tipo = b.tipo === 'pj' ? 'pj' : b.tipo === 'pf' ? 'pf' : null;
  if (!tipo) return erro('Escolha pessoa física ou jurídica.', 'tipo');
  const nome = String(b.nome ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!/\S+\s+\S+/.test(nome) || nome.length < 5) return erro(tipo === 'pf' ? 'Informe seu nome completo, igual ao documento.' : 'Informe a razão social.', 'nome');
  const doc = soDigitos(b.documento);
  if (tipo === 'pf' ? !cpfValido(doc) : !cnpjValido(doc)) return erro(tipo === 'pf' ? 'CPF inválido. Confira os números.' : 'CNPJ inválido. Confira os números.', 'documento');
  let nascimento: string | null = null;
  if (tipo === 'pf') {
    nascimento = String(b.nascimento || '');
    const a = idade(nascimento);
    if (a === null || a > 110) return erro('Informe a data de nascimento.', 'nascimento');
    if (a < 18) return erro('Para vender e sacar é preciso ter 18 anos ou mais.', 'nascimento');
  }
  const responsavel = tipo === 'pj' ? String(b.responsavel ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) : null;
  if (tipo === 'pj' && !/\S+\s+\S+/.test(responsavel || '')) return erro('Informe o nome completo do responsável pela empresa.', 'responsavel');
  if (!caminhoKycValido(b.doc_frente, user.id)) return erro('Envie a foto da frente do documento.', 'doc_frente');
  if (b.doc_verso && !caminhoKycValido(b.doc_verso, user.id)) return erro('Arquivo do verso inválido. Envie de novo.', 'doc_verso');
  if (!caminhoKycValido(b.selfie, user.id)) return erro('Envie a selfie segurando o documento.', 'selfie');

  const admin = createAdminClient();
  const atual = await statusVerificacao(admin, user.id);
  if (!atual.sql19) return NextResponse.json({ error: 'A verificação ainda não está ativa. Tente mais tarde.' }, { status: 503 });
  if (atual.status === 'aprovado') return NextResponse.json({ error: 'Sua identidade já está verificada.' }, { status: 409 });

  let documento_cifrado: string;
  try { documento_cifrado = cifrar(doc); } catch { return NextResponse.json({ error: 'Não foi possível salvar com segurança agora. Tente de novo.' }, { status: 500 }); }
  const { error } = await admin.from('verificacoes_vendedor').upsert({
    user_id: user.id, tipo, nome, documento_cifrado, documento_final: doc.slice(-4), nascimento, responsavel,
    doc_frente: b.doc_frente, doc_verso: b.doc_verso || null, selfie: b.selfie,
    status: 'pendente', motivo: null, enviado_em: new Date().toISOString(), decidido_em: null, decidido_por: null,
  });
  if (error) {
    if (semSql19(error)) return NextResponse.json({ error: 'A verificação ainda não está ativa.' }, { status: 503 });
    console.error('[verificacao]', error.message);
    return NextResponse.json({ error: 'Não foi possível enviar. Tente de novo.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...(await statusVerificacao(admin, user.id)) });
}
