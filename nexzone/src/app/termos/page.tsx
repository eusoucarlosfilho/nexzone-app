import Nav from '@/components/Nav';
import Icon from '@/components/Icon';
import { AVISO_JOGOS } from '@/lib/categorias';
import { lerTaxas } from '@/lib/settings';
import { TAXAS_PADRAO, brl, pctTexto } from '@/lib/taxas';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Termos de Uso — Comprei Barato' };

export default async function TermosPage() {
  const t = await lerTaxas().catch(() => TAXAS_PADRAO);
  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 760 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 30, fontWeight: 900 }}>Termos de Uso</h1>
        <p className="muted" style={{ marginBottom: 8 }}>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        <div style={{ background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--sub)', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="alert" size={16} style={{ marginTop: 1, flexShrink: 0 }} /><span>Este é um modelo inicial. Recomendamos a revisão por um advogado antes da operação comercial.</span>
        </div>

        <div style={{ color: 'var(--sub)', fontSize: 15, lineHeight: 1.75 }}>
          <h2 style={h2}>1. Aceitação</h2>
          <p>Ao acessar e utilizar o Comprei Barato (“Plataforma”), você concorda com estes Termos de Uso. Caso não concorde, não utilize a Plataforma.</p>

          <h2 style={h2}>2. O que é o Comprei Barato</h2>
          <p>O Comprei Barato é um marketplace que conecta criadores (“Vendedores”) e compradores (“Compradores”) para a comercialização de bens digitais: contas, itens, moedas e serviços de jogos, gift cards, keys e códigos, e produtos digitais (arquivos, cursos e softwares). A Plataforma atua como intermediadora, disponibilizando a vitrine, o processamento de pagamento e a entrega; não é a autora dos produtos anunciados.</p>

          <h2 style={h2}>3. Cadastro e conta</h2>
          <p>Para comprar ou vender, é necessário criar uma conta com informações verdadeiras e atualizadas. Você é responsável pela segurança das suas credenciais e por toda atividade realizada na sua conta.</p>

          <h2 style={h2}>4. Vendedores</h2>
          <p>O Vendedor é o único responsável pelo conteúdo, pela legalidade, pela titularidade e pela entrega do produto que anuncia. Ao publicar, o Vendedor declara possuir todos os direitos necessários e que o produto não viola leis ou direitos de terceiros. Produtos passam por aprovação antes de ficarem ativos, o que não transfere ao Comprei Barato a responsabilidade pelo conteúdo.</p>

          <h2 style={h2}>5. Pagamentos, taxas e repasses</h2>
          <p>Os pagamentos são processados por provedores parceiros: Pix pela MisticPay e cartão pela Stripe. O Comprador paga no site e o valor fica retido pela Plataforma até o fim do prazo de liberação.</p>
          <p><b>Taxa do Vendedor (por plano do anúncio):</b> Básico {pctTexto(t.planoBasico)}, Destaque {pctTexto(t.planoDestaque)} e Topo {pctTexto(t.planoTopo)} sobre o valor de cada venda concluída. O plano escolhido no anúncio no momento da compra é o que vale para aquele pedido. Os planos Destaque e Topo dão mais visibilidade na vitrine e na busca, mas não garantem vendas. As vagas do plano Topo são limitadas por categoria.</p>
          <p><b>Taxa de serviço do Comprador:</b> {brl(t.compradorPix)} por pedido no Pix e {pctTexto(t.compradorCartaoPct)} + {brl(t.compradorCartaoFixo)} no cartão, exibida no checkout antes do pagamento. Ela remunera o processamento do pagamento e a intermediação, e é devolvida junto em caso de reembolso integral aprovado pela Plataforma.</p>
          <p><b>Liberação do saldo ao Vendedor</b>, contada a partir da entrega e se não houver reclamação aberta: contas de jogo, {t.liberaContaDias} dias; demais anúncios, {t.liberaPadraoDias} dias; vendas pagas com cartão, no mínimo {t.liberaCartaoDias} dias. Reclamações, contestações e estornos podem segurar o valor até a resolução, e valores reembolsados depois da liberação podem ser descontados do saldo futuro do Vendedor.</p>
          <p><b>Saques:</b> feitos para a chave Pix do titular verificado. O primeiro saque de cada período de 7 dias é gratuito; os demais custam {brl(t.saqueExtraTaxa)} cada. As taxas podem ser alteradas com aviso prévio na Plataforma, sem efeito sobre pedidos já pagos.</p>

          <h2 style={h2}>6. Entrega e acesso</h2>
          <p>Gift cards, keys, códigos, arquivos e links são liberados automaticamente após a confirmação do pagamento. Contas, itens, moedas e serviços são entregues pelo Vendedor no chat do pedido, onde a conversa fica registrada. Na compra de uma conta, o Comprador deve trocar e-mail, senha e dados de recuperação assim que receber.</p>

          <h2 style={h2}>7. Garantia e reembolso</h2>
          <p>O Comprador tem direito a solicitar reembolso dentro do prazo de garantia informado no produto (em regra, 7 dias), conforme o Código de Defesa do Consumidor. Reembolsos aprovados são processados pelo mesmo meio de pagamento.</p>

          <h2 style={h2}>8. Condutas proibidas</h2>
          <p>É proibido anunciar ou comercializar: conteúdo ilegal, pirateado ou que viole direitos autorais; contas ou acessos de terceiros, roubados, invadidos ou compartilhados; cheats, hacks, bots e scripts que violem as regras dos jogos; conteúdo que infrinja os termos de outras plataformas; e qualquer material vedado por lei. A violação pode levar à remoção do produto e ao encerramento da conta.</p>

          <h2 style={h2}>8.1 Categoria Jogos &amp; Games</h2>
          <p>{AVISO_JOGOS}</p>

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
