/**
 * Text processing utilities for suggest-reply
 */

export function limparTexto(s: any): string {
  const raw = (s && typeof s === 'object') ? JSON.stringify(s) : String(s || '');
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function prepararMensagemParaFranqueado(texto: string): string {
  let mensagem = texto
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1')     // Remove itálico
    .replace(/#{1,6}\s*/g, '')       // Remove headers markdown
    .replace(/\[Fonte \d+\]/g, '')   // Remove citações [Fonte N]
    .replace(/\s+/g, ' ')            // Normaliza espaços múltiplos
    .trim();
  
  // Remover aspas desnecessárias no início e fim
  mensagem = mensagem.replace(/^["']|["']$/g, '');
  
  // Garantir que termine de forma apropriada
  if (!mensagem.match(/[.!?]$/)) {
    mensagem += '.';
  }
  
  return mensagem;
}

export function formatarContextoFontes(docs: any[]): string {
  return docs.map((d, i) =>
    `[Fonte ${i+1}] "${d.titulo}" — ${d.categoria || 'sem categoria'}\n` +
    `${limparTexto(d.conteudo).slice(0,700)}\n` +
    `ID:${d.id}`
  ).join('\n\n');
}