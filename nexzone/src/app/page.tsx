import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { criarProduto } from './actions';
import { calcBalance } from '@/lib/balance';
import Link from 'next/link';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export const dynamic = 'force-dynamic';

export default async function VenderPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id, nome, status').eq('owner', user.id).maybeSingle();
  const bal = store ? await calcBalance(supabase, store.id) : { disponivel: 0, aLiberar: 0, sacado: 0, emProcessamento: 0, liberado: 0 };
  const { data: produtos } = store
    ? await supabase.from('products').select('*').eq('store_id', store.id).order('created_at', { ascending: false })
    : { data: [] as any[] };

  return (
    <>
      <Nav />
      <div className="page">
        <h1>Painel do Vendedor</h1>
        <p className="muted">Produtos novos entram em revisão antes de ir ao ar. Você é o vendedor âncora — abasteça a vitrine.</p>

        <Link href="/vender/recebimentos" className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, textDecoration: 'none', color: 'inherit' }}>
          <div className="em" style={{ width: 48, height: 48 }}>💰</div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontFamily: 'Outfit' }}>Recebimentos</strong>
            <div className="muted">Disponível para saque: <strong style={{ color: 'var(--green)' }}>{'R$ ' + Number(bal.disponivel).toFixed(2).replace('.', ',')}</strong> · A liberar: {'R$ ' + Number(bal.aLiberar).toFixed(2).replace('.', ',')}</div>
          </div>
          <span className="btn btn-pri btn-sm">Ver →</span>
        </Link>

        <div className="card" style={{ marginTop: 22 }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 18, marginBottom: 16 }}>Cadastrar produto</h2>
          <form action={criarProduto}>
            <div className="fg"><label>Título</label><input name="titulo" required placeholder="Ex: Pack 100 Templates de Carrossel" /></div>
            <div className="fg"><label>Categoria</label>
              <select name="categoria">
                <option>IA & Ferramentas</option><option>Templates & Planilhas</option><option>Design</option>
                <option>Automações</option><option>Marketing Digital</option><option>Cursos & Ebooks</option>
              </select>
            </div>
            <div className="fg"><label>Descrição</label><textarea name="descricao" rows={3} placeholder="O que o comprador recebe." /></div>
            <div className="fg2">
              <div className="fg"><label>Preço (R$)</label><input name="preco" type="number" step="0.01" required placeholder="19.90" /></div>
              <div className="fg"><label>Preço promocional (opcional)</label><input name="preco_promo" type="number" step="0.01" placeholder="14.90" /></div>
            </div>
            <div className="fg2">
              <div className="fg"><label>Tipo de entrega</label>
                <select name="tipo_entrega"><option value="arquivo">Arquivo</option><option value="chave">Chave / código</option><option value="link">Link de acesso</option><option value="acesso">Acesso</option></select>
              </div>
              <div className="fg"><label>Garantia (dias)</label><input name="garantia_dias" type="number" defaultValue={7} /></div>
            </div>
            <div className="fg"><label>Conteúdo liberado pós-pagamento (link ou texto)</label><input name="conteudo_entrega" placeholder="https://… ou a chave/instrução" /></div>
            <div className="fg"><label>Emoji da capa</label><input name="emoji" defaultValue="📦" maxLength={2} style={{ width: 80 }} /></div>
            <button className="btn btn-pri" style={{ width: '100%' }}>Enviar para revisão</button>
          </form>
        </div>

        <h2 style={{ fontFamily: 'Outfit', fontSize: 18, margin: '28px 0 14px' }}>Meus produtos</h2>
        <div className="card" style={{ padding: 0 }}>
          {(produtos ?? []).length ? (produtos as any[]).map((p) => {
            const st = { em_revisao: ['rev', 'Em revisão'], ativo: ['act', 'Ativo'], reprovado: ['rej', 'Reprovado'] }[p.status as string] || ['rev', p.status];
            return (
              <div className="li" key={p.id}>
                <div className="em">{p.emoji}</div>
                <div><strong style={{ fontFamily: 'Outfit' }}>{p.titulo}</strong><div className="muted">{money(p.preco_promo ?? p.preco)} · {p.categoria}</div></div>
                <div className="spacer" />
                <span className={`pill ${st[0]}`}>{st[1]}</span>
              </div>
            );
          }) : <div style={{ padding: 24 }} className="muted">Nenhum produto ainda.</div>}
        </div>
      </div>
    </>
  );
}
