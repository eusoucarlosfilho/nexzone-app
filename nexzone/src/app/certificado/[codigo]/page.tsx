import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Icon from '@/components/Icon';
import CertificadoView from '@/components/CertificadoView';
import { createAdminClient } from '@/lib/supabase/server';
import { codigoValido } from '@/lib/curso';
import { vendedorPublico } from '@/lib/vendedorPublico';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Verificar certificado · Comprei Barato', robots: { index: false } };

// Verificação pública: qualquer pessoa confere se o certificado é verdadeiro pelo código.
export default async function VerificarCertificado({ params }: { params: { codigo: string } }) {
  const codigo = String(params.codigo || '').toUpperCase();
  let c: any = null, loja = 'Comprei Barato';
  if (codigoValido(codigo)) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.from('curso_certificados').select('codigo, nome_aluno, titulo_curso, carga_horaria, emitido_em, product_id').eq('codigo', codigo).maybeSingle();
      c = data;
      if (c) {
        const { data: p } = await admin.from('products').select('stores(nome, ocultar_vendedor)').eq('id', c.product_id).maybeSingle();
        loja = vendedorPublico((p as any)?.stores).nome;
      }
    } catch { c = null; }
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://compreibarato.com.br';
  return (
    <>
      <Nav />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px 0' }}>
        {c ? (
          <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 14, padding: '12px 16px', fontWeight: 800 }}>
            <Icon name="checkCircle" size={20} /> Certificado verdadeiro, emitido pelo Comprei Barato.
          </div>
        ) : (
          <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 14, padding: '12px 16px', fontWeight: 800 }}>
            <Icon name="alert" size={20} /> Não encontramos um certificado com o código {codigo || 'informado'}.
          </div>
        )}
      </div>
      {c && <CertificadoView c={c} loja={loja} site={site} imprimir={false} />}
    </>
  );
}
