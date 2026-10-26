'use client';
import { useEffect, useState } from 'react';
import { UFS, municipiosDaUf } from '@/lib/brasil';

/**
 * Estado (UF) e cidade DECLARADOS pelo usuário. Opcionais.
 * A lista de cidades vem da API pública do IBGE; se ela falhar, vira campo de texto.
 * Não pedimos GPS nem endereço.
 */
export default function LocalizacaoCampos({ uf, cidade, onUf, onCidade, idBase = 'cb-loc', nomeUf, nomeCidade }: {
  uf: string; cidade: string;
  onUf: (v: string) => void; onCidade: (v: string) => void;
  idBase?: string; nomeUf?: string; nomeCidade?: string;
}) {
  const [cidades, setCidades] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!uf) { setCidades([]); setFalhou(false); return; }
    setCarregando(true); setFalhou(false);
    municipiosDaUf(uf).then((lista) => {
      if (!vivo) return;
      setCidades(lista);
      setFalhou(lista.length === 0);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [uf]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 10 }}>
      <div className="fg" style={{ marginBottom: 0 }}>
        <label htmlFor={`${idBase}-uf`}>ESTADO</label>
        <select id={`${idBase}-uf`} name={nomeUf} value={uf} onChange={(e) => { onUf(e.target.value); onCidade(''); }} autoComplete="address-level1">
          <option value="">UF</option>
          {UFS.map((u) => <option key={u.sigla} value={u.sigla}>{u.sigla}</option>)}
        </select>
      </div>
      <div className="fg" style={{ marginBottom: 0 }}>
        <label htmlFor={`${idBase}-cidade`}>CIDADE</label>
        {uf && !falhou ? (
          <select id={`${idBase}-cidade`} name={nomeCidade} value={cidade} onChange={(e) => onCidade(e.target.value)} disabled={carregando} autoComplete="address-level2">
            <option value="">{carregando ? 'Carregando…' : 'Selecione'}</option>
            {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <input id={`${idBase}-cidade`} name={nomeCidade} value={cidade} onChange={(e) => onCidade(e.target.value)}
            placeholder={uf ? 'Digite sua cidade' : 'Escolha a UF'} disabled={!uf} maxLength={60} autoComplete="address-level2" />
        )}
      </div>
    </div>
  );
}
