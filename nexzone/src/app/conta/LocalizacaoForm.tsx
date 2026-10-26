'use client';
import { useState } from 'react';
import LocalizacaoCampos from '@/components/LocalizacaoCampos';
import { salvarLocalizacao } from './actions';

export default function LocalizacaoForm({ ufInicial, cidadeInicial }: { ufInicial: string; cidadeInicial: string }) {
  const [uf, setUf] = useState(ufInicial);
  const [cidade, setCidade] = useState(cidadeInicial);
  return (
    <form action={salvarLocalizacao} className="card" style={{ marginTop: 16 }}>
      <h2 style={{ fontFamily: 'Outfit', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Sua região (opcional)</h2>
      <p className="muted" style={{ marginBottom: 14 }}>
        Estado e cidade nos ajudam a entender de onde vêm nossos clientes. Usamos só de forma agregada.
        Não pedimos endereço nem localização do aparelho. Deixe em branco para não informar.
      </p>
      <LocalizacaoCampos uf={uf} cidade={cidade} onUf={setUf} onCidade={setCidade} idBase="conta-loc" nomeUf="uf" nomeCidade="cidade" />
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-pri btn-sm">Salvar região</button>
        {(ufInicial || cidadeInicial) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { const f = e.currentTarget.form; setUf(''); setCidade(''); setTimeout(() => f?.requestSubmit(), 0); }}>Remover região</button>
        )}
      </div>
    </form>
  );
}
