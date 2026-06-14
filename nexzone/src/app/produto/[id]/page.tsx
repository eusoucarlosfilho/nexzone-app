import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PerguntasClient from './PerguntasClient';

export const dynamic = 'force-dynamic';

export default async function PerguntasPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) {
    return (
      <div>
        <h1 className="adm-h" style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 900 }}>Perguntas</h1>
        <p className="muted">Você ainda não tem uma loja.</p>
      </div>
    );
  }

  const { data } = await supabase.from('product_questions')
    .select('id, autor_nome, pergunta, resposta, respondida_em, created_at, products(titulo, emoji)')
    .eq('store_id', store.id).order('created_at', { ascending: false }).limit(200);

  const perguntas = (data ?? []).map((q: any) => ({
    id: q.id, autor_nome: q.autor_nome, pergunta: q.pergunta, resposta: q.resposta,
    respondida_em: q.respondida_em, created_at: q.created_at,
    produto: q.products?.titulo ?? 'Produto', emoji: q.products?.emoji ?? '📦',
  }));

  return <PerguntasClient perguntas={perguntas} />;
}
