import { salvarWhatsapp } from '@/app/conta/actions';

// Convite simples na página do pedido: salva o WhatsApp no perfil do comprador.
// Só aparece para quem ainda não tem número. Não altera nada do pagamento.
export default function ConviteWhatsApp({ orderId, aviso }: { orderId: string; aviso?: string }) {
  return (
    <form action={salvarWhatsapp} className="card" style={{ marginTop: 16 }}>
      <input type="hidden" name="voltar" value={`/pedido/${orderId}`} />
      <strong style={{ fontFamily: 'Outfit', display: 'block', marginBottom: 4 }}>Receba avisos deste pedido no WhatsApp</strong>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Pagamento, liberação do acesso e mensagens do vendedor. Você pode desativar quando quiser em Minha conta.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input name="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(63) 99999-9999" maxLength={20} required aria-label="Seu WhatsApp com DDD"
          style={{ flex: '1 1 180px', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 12, fontSize: 15 }} />
        <button type="submit" className="btn btn-pri btn-sm">Quero receber</button>
      </div>
      {aviso === 'invalido' && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 8 }}>Número inválido. Use DDD + número.</p>}
      {aviso === 'erro' && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 8 }}>Não foi possível salvar agora.</p>}
    </form>
  );
}
