import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Nav from '@/components/Nav';
import CertificadoView from '@/components/CertificadoView';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { vendedorPublico } from '@/lib/vendedorPublico';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Certificado · Comprei Barato', robots: { index: false } };

export default async function MeuCertificado({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/curso/${params.id}/certificado`)}`);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) redirect('/minhas-compras');
  const admin = createAdminClient();
  const { data: c } = await admin.from('curso_certificados').select('codigo, nome_aluno, titulo_curso, carga_horaria, emitido_em, product_id').eq('user_id', user.id).eq('product_id', params.id).maybeSingle();
  if (!c) redirect(`/curso/${params.id}`);
  const { data: p } = await admin.from('products').select('stores(nome, ocultar_vendedor)').eq('id', params.id).maybeSingle();
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://compreibarato.com.br';
  return (
    <>
      <Nav />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 16px 0' }}>
        <Link href={`/curso/${params.id}`} className="muted" style={{ fontWeight: 800, fontSize: 13 }}>← Voltar ao curso</Link>
      </div>
      <CertificadoView c={c as any} loja={vendedorPublico((p as any)?.stores).nome} site={site} />
    </>
  );
}
