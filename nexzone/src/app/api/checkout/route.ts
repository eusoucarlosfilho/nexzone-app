await supabase.from('orders').update({ gateway_ref: pay.gatewayRef }).eq('id', order.id);

  return NextResponse.json({
    orderId: order.id, pix: pay.pixCopiaECola, qr: pay.pixQrBase64,
  });
