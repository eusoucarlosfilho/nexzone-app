'use client';
import { useState } from 'react';
import { criarProduto } from '../actions';
import FileUpload from './FileUpload';

const CATS = ['IA & Ferramentas', 'Templates & Planilhas', 'Design', 'Automações', 'Marketing Digital', 'Cursos & Ebooks'];

export default function CreateProduct({ userId }: { userId: string }) {
  const [tipo, setTipo] = useState('arquivo');
  const [arquivoPath, setArquivoPath] = useState('');
  const [arquivoNome, setArquivoNome] = useState('');

  return (
    <form action={criarProduto}>
      <div className="fg"><label>Título</label><input name="titulo" required placeholder="Ex: Pack 100 Templates de Carrossel" /></div>
      <div className="fg"><label>Categoria</label>
        <select name="categoria">{CATS.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <div className="fg"><label>Descrição</label><textarea name="descricao" rows={3} placeholder="O que o comprador recebe." /></div>
      <div className="fg2">
        <div className="fg"><label>Preço (R$)</label><input name="preco" type="number" step="0.01" required placeholder="19.90" /></div>
        <div className="fg"><label>Preço promocional (opcional)</label><input name="preco_promo" type="number" step="0.01" placeholder="14.90" /></div>
      </div>
      <div className="fg2">
        <div className="fg"><label>Tipo de entrega</label>
          <select name="tipo_entrega" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="arquivo">Arquivo (upload)</option>
            <option value="link">Link de acesso</option>
            <option value="chave">Chave / código</option>
            <option value="acesso">Acesso / instrução</option>
          </select>
        </div>
        <div className="fg"><label>Garantia (dias)</label><input name="garantia_dias" type="number" defaultValue={7} /></div>
      </div>

      {tipo === 'arquivo' ? (
        <div className="fg">
          <label>Arquivo do produto (entregue após o pagamento)</label>
          <FileUpload userId={userId} onUploaded={(p, n) => { setArquivoPath(p); setArquivoNome(n); }} />
          <input type="hidden" name="arquivo_path" value={arquivoPath} />
          <input type="hidden" name="arquivo_nome" value={arquivoNome} />
        </div>
      ) : (
        <div className="fg"><label>Conteúdo liberado pós-pagamento (link ou texto)</label><input name="conteudo_entrega" placeholder="https://… ou a chave/instrução" /></div>
      )}

      <div className="fg"><label>Emoji da capa</label><input name="emoji" defaultValue="📦" maxLength={2} style={{ width: 80 }} /></div>
      <button className="btn btn-pri" style={{ width: '100%' }}>Enviar para revisão</button>
    </form>
  );
}
