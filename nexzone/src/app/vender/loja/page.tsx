import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { salvarLoja } from './actions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, [string, string]> = {
  pendente: ['rev', 'Em análise'], verificado: ['act', 'Verificada'], suspenso: ['rej', 'Suspensa'],
};

export default async function LojaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: store } = await supabase.from('stores').select('*').eq('owner', user.id).maybeSingle();

  if (!store) {
    return (<div><h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Minha Loja</h1><p className="muted">Cadastre um produto primeiro para criar sua loja.</p></div>);
  }
  const st = STATUS[store.status] || ['rev', store.status];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Minha Loja</h1>
        <span className={`pill ${st[0]}`}>{st[1]}</span>
      </div>
      <p className="muted">Como sua loja aparece para os compradores. <a href={`/loja/${store.slug}`} target="_blank" rel="noreferrer" style={{ color: 'var(--orange)', fontWeight: 700 }}>Ver página pública ›</a></p>

      <div className="card" style={{ marginTop: 22, maxWidth: 620 }}>
        <form action={salvarLoja}>
          <div className="fg"><label>Nome da loja</label><input name="nome" defaultValue={store.nome} required /></div>
          <div className="fg"><label>Descrição</label><textarea name="descricao" rows={3} defaultValue={store.descricao ?? ''} placeholder="Conte o que sua loja oferece." /></div>
          <div className="fg"><label>Categoria principal</label>
            <select name="categoria" defaultValue={store.categoria ?? 'IA & Ferramentas'}>
              <option>IA & Ferramentas</option><option>Templates & Planilhas</option><option>Design</option>
              <option>Automações</option><option>Marketing Digital</option><option>Cursos & Ebooks</option>
            </select>
          </div>
          <button className="btn btn-pri">Salvar alterações</button>
        </form>
      </div>
    </div>
  );
}
