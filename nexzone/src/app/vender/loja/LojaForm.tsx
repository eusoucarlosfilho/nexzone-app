'use client';
import { useState } from 'react';
import { salvarLoja } from './actions';
import CoverUpload from '../produtos/CoverUpload';

const CATS = ['IA & Ferramentas', 'Templates & Planilhas', 'Design', 'Automações', 'Marketing Digital', 'Cursos & Ebooks'];

export default function LojaForm({ store, userId }: any) {
  const [logo, setLogo] = useState(store.logo_url || '');
  const [banner, setBanner] = useState(store.banner_url || '');
  const [cor, setCor] = useState(store.cor || '#FF6B00');

  return (
    <form action={salvarLoja}>
      <div className="fg"><label>Nome da loja</label><input name="nome" defaultValue={store.nome} required /></div>
      <div className="fg"><label>Descrição</label><textarea name="descricao" rows={3} defaultValue={store.descricao ?? ''} placeholder="Conte o que sua loja oferece." /></div>
      <div className="fg"><label>Categoria principal</label>
        <select name="categoria" defaultValue={store.categoria ?? CATS[0]}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
      </div>

      <div className="fg"><label>Logo da loja</label>
        <CoverUpload userId={userId} value={store.logo_url} onUploaded={setLogo} hint="Quadrada, recomendado 400×400px (PNG ou JPG)" />
        <input type="hidden" name="logo_url" value={logo} />
      </div>

      <div className="fg"><label>Banner da loja (imagem larga, topo da página)</label>
        <CoverUpload userId={userId} value={store.banner_url} onUploaded={setBanner} hint="Larga, recomendado 1200×300px (proporção 4:1, JPG)" />
        <input type="hidden" name="banner_url" value={banner} />
      </div>

      <div className="fg"><label>Cor de destaque</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} style={{ width: 52, height: 40, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
          <span className="muted" style={{ fontSize: 13 }}>{cor}</span>
        </div>
        <input type="hidden" name="cor" value={cor} />
      </div>

      <button className="btn btn-pri">Salvar alterações</button>
    </form>
  );
}
