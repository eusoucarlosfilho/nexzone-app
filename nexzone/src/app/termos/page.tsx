import Nav from '@/components/Nav';

export const metadata = { title: 'Termos de Uso — Comprei Barato' };

export default function TermosPage() {
  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 760 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 30, fontWeight: 900 }}>Termos de Uso</h1>
        <p className="muted" style={{ marginBottom: 8 }}>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        <div style={{ background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--sub)', marginBottom: 24 }}>
          ⚠️ Este é um modelo inicial. Recomendamos a revisão por um advogado antes da operação comercial.
        </div>

        <div style={{ color: 'var(--sub)', fontSize: 15, lineHeight: 1.75 }}>
          <h2 style={h2}>1. Aceitação</h2>
          <p>Ao acessar e utilizar o Comprei Barato (“Plataforma”), você concorda com estes Termos de Uso. Caso não concorde, não utilize a Plataforma.</p>

          <h2 style={h2}>2. O que é o Comprei Barato</h2>
          <p>O Comprei Barato é um marketplace que conecta criadores (“Vendedores”) e compradores (“Compradores”) para a comercialização de produtos digitais de entrega imediata. A Plataforma atua como intermediadora, disponibilizando a vitrine, o processamento de pagamento e a entrega; não é a autora dos produtos anunciados.</p>

          <h2 style={h2}>3. Cadastro e conta</h2>
          <p>Para comprar ou vender, é necessário criar uma conta com informações verdadeiras e atualizadas. Você é responsável pela segurança das suas credenciais e por toda atividade realizada na sua conta.</p>

          <h2 style={h2}>4. Vendedores</h2>
          <p>O Vendedor é o único responsável pelo conteúdo, pela legalidade, pela titularidade e pela entrega do produto que anuncia. Ao publicar, o Vendedor declara possuir todos os direitos necessários e que o produto não viola leis ou direitos de terceiros. Produtos passam por aprovação antes de ficarem ativos, o que não transfere ao Comprei Barato a responsabilidade pelo conteúdo.</p>

          <h2 style={h2}>5. Pagamentos e comissão</h2>
          <p>Os pagamentos são processados via Pix por meio de provedor de pagamento parceiro (Mercado Pago). A Plataforma cobra uma comissão sobre cada venda, informada no painel do Vendedor. Repasses ao Vendedor respeitam o período de garantia e as condições descritas na Plataforma.</p>

          <h2 style={h2}>6. Entrega e acesso</h2>
          <p>A entrega do produto digital ocorre de forma automática após a confirmação do pagamento, por download de arquivo, link ou acesso, conforme definido pelo Vendedor.</p>

          <h2 style={h2}>7. Garantia e reembolso</h2>
          <p>O Comprador tem direito a solicitar reembolso dentro do prazo de garantia informado no produto (em regra, 7 dias), conforme o Código de Defesa do Consumidor. Reembolsos aprovados são processados pelo mesmo meio de pagamento.</p>

          <h2 style={h2}>8. Condutas proibidas</h2>
          <p>É proibido anunciar ou comercializar: conteúdo ilegal, pirateado ou que viole direitos autorais; contas ou acessos de terceiros; conteúdo que infrinja os termos de outras plataformas; e qualquer material vedado por lei. A violação pode levar à remoção do produto e ao encerramento da conta.</p>

          <h2 style={h2}>9. Propriedade intelectual</h2>
          <p>A marca, o layout e o software do Comprei Barato pertencem à Plataforma. O conteúdo dos produtos pertence aos respectivos Vendedores.</p>

          <h2 style={h2}>10. Limitação de responsabilidade</h2>
          <p>O Comprei Barato atua como intermediador e não se responsabiliza pela qualidade, veracidade ou adequação dos produtos anunciados pelos Vendedores, sem prejuízo das obrigações legais aplicáveis ao intermediador.</p>

          <h2 style={h2}>11. Suspensão e encerramento</h2>
          <p>A Plataforma pode suspender ou encerrar contas que violem estes Termos, a lei ou que apresentem risco a outros usuários.</p>

          <h2 style={h2}>12. Alterações</h2>
          <p>Estes Termos podem ser atualizados a qualquer momento. O uso contínuo após alterações implica aceitação da versão vigente.</p>

          <h2 style={h2}>13. Lei aplicável e foro</h2>
          <p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do domicílio do Comprador para dirimir controvérsias, quando aplicável.</p>

          <h2 style={h2}>14. Contato</h2>
          <p>Dúvidas sobre estes Termos podem ser enviadas pelo nosso canal de suporte informado na Plataforma.</p>
        </div>
      </div>
    </>
  );
}
const h2 = { fontFamily: 'Outfit', fontWeight: 800, fontSize: 18, color: 'var(--text)', margin: '22px 0 6px' } as const;
