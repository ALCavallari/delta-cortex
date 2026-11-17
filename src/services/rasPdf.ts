import { jsPDF } from 'jspdf';
import { RegistroCampo, RelatorioVisita, Visita } from '@/types';

const tipo = (r: RegistroCampo) => r.tipo === 'Ocorrencia' ? 'Ocorrência' : 'Observação';
const dataBR = (data: string) => data.split('-').reverse().join('/');

async function prepararFoto(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const escala = Math.min(1, 1500 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar uma fotografia.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { jpeg: canvas.toDataURL('image/jpeg', 0.85), w: canvas.width, h: canvas.height };
}

export async function gerarRelatorio(visita: Visita, atividades: string[], registros: RegistroCampo[],
  codigoRelatorio: string, abreviacaoProjeto?: string): Promise<RelatorioVisita> {
  const logo = await fetch('/Delta%20S%20-%20Fundo%20Transparente.png');
  if (!logo.ok) throw new Error('Logo institucional indisponível.');
  const png = new Uint8Array(await logo.arrayBuffer());
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  // Helvetica é nativa do PDF e próxima à pilha sans-serif da interface.
  const fonte = 'helvetica';
  const cores = {
    azul: '#00AFF0', azulTexto: '#00648B', grafite: '#333436',
    cinzaTexto: '#61666C', borda: '#E2E8F0', fundo: '#F8FAFC',
  };
  const x = 17, largura = 176, direita = x + largura, limite = 272;
  let y = 43;
  const texto = (tamanho: number, peso = 'normal', cor = cores.grafite) =>
    doc.setFont(fonte, peso).setFontSize(tamanho).setTextColor(cor);
  const prop = doc.getImageProperties(png);
  const escalaLogo = Math.min(44 / prop.width, 17 / prop.height);
  const cabecalho = () => {
    doc.addImage(png, 'PNG', x, 20 - prop.height * escalaLogo / 2,
      prop.width * escalaLogo, prop.height * escalaLogo, 'delta-s');
    texto(11, 'bold').text('Delta S Engenharia', direita, 15, { align: 'right' });
    texto(9, 'normal', cores.azulTexto).text('Relatório de Acompanhamento Sistemático', direita, 21, { align: 'right' });
    texto(8, 'normal', cores.cinzaTexto).text('administrativo@deltas.eng.br', direita, 26, { align: 'right' });
    doc.setDrawColor(cores.azul).setLineWidth(0.28).line(x, 33, direita, 33);
  };
  const pagina = () => { doc.addPage(); cabecalho(); y = 43; };
  const reservar = (h: number) => { if (y + h > limite) pagina(); };
  const titulo = (nome: string) => {
    reservar(22);
    doc.setFillColor(cores.azul).roundedRect(x, y, 1, 6, 0.5, 0.5, 'F');
    texto(12, 'bold', cores.azulTexto).text(nome, x + 4, y + 4.6);
    doc.setDrawColor(cores.borda).setLineWidth(0.2).line(x, y + 8, direita, y + 8);
    y += 12;
  };
  const paragrafo = (conteudo: string, recuo = 0) => {
    texto(10);
    const linhas: string[] = doc.splitTextToSize(conteudo, largura - recuo);
    for (const linha of linhas) {
      reservar(5);
      texto(10).text(linha, x + recuo, y + 3.5);
      y += 5;
    }
  };

  doc.setProperties({ title: 'Relatório de Acompanhamento Sistemático', author: 'Delta S Engenharia' });
  cabecalho();
  texto(14, 'bold').text('RELATÓRIO DE ACOMPANHAMENTO SISTEMÁTICO', 105, y + 5, { align: 'center' });
  y += 15;
  const campos = [
    ['Cliente/Projeto', [visita.clienteNome, visita.identificacaoProjeto].filter(Boolean).join(' / ')],
    ['Identificação', codigoRelatorio],
    ['Data', dataBR(visita.data)],
    ['Responsável Técnico', visita.responsavelTecnicoNome],
  ];
  const passo = 6, margem = 5;
  const linhasIdentificacao = campos.flatMap(([rotulo, valor]) => {
    const etiqueta = `${rotulo}:`;
    const larguraRotulo = texto(10, 'bold').getTextWidth(etiqueta);
    const recuo = larguraRotulo + texto(10).getTextWidth(' ');
    const linhas: string[] = doc.splitTextToSize(valor || '—', largura - 2 * margem, { textIndent: recuo });
    return linhas.map((linha, i) => ({ linha, etiqueta: i === 0 ? etiqueta : '', recuo: i === 0 ? recuo : 0 }));
  });
  const alturaCard = (n: number) => 2 * margem + passo * n;
  // Mantém o card inteiro quando couber em uma página; divide apenas conteúdo excepcionalmente longo.
  if (alturaCard(linhasIdentificacao.length) <= limite - 43) reservar(alturaCard(linhasIdentificacao.length));
  for (let i = 0; i < linhasIdentificacao.length;) {
    reservar(alturaCard(1));
    const quantidade = Math.min(linhasIdentificacao.length - i,
      Math.max(1, Math.floor((limite - y - 2 * margem) / passo)));
    const altura = alturaCard(quantidade);
    doc.setFillColor(cores.fundo).setDrawColor(cores.borda).setLineWidth(0.2)
      .roundedRect(x, y, largura, altura, 2.2, 2.2, 'FD');
    for (let j = 0; j < quantidade; j++) {
      const { linha, etiqueta, recuo } = linhasIdentificacao[i + j];
      const linhaY = y + margem + 3.5 + j * passo;
      if (etiqueta) texto(10, 'bold').text(etiqueta, x + margem, linhaY);
      texto(10).text(linha, x + margem + recuo, linhaY);
    }
    y += altura;
    i += quantidade;
    if (i < linhasIdentificacao.length) pagina();
  }
  y += 5;
  titulo('Atividades Realizadas');
  for (const atividade of atividades) {
    reservar(5);
    doc.setFillColor(cores.azul).circle(x + 2, y + 2.4, 0.6, 'F');
    paragrafo(atividade, 5);
    y += 1;
  }
  y += 5;
  titulo('Observações e Ocorrências');
  if (!registros.length) paragrafo('Nenhum apontamento incluído nesta visita.');
  registros.forEach((r, i) => {
    const ocorrencia = r.tipo === 'Ocorrencia';
    const recorrente = ocorrencia && r.visitaId !== visita.id;
    const resolvido = ocorrencia && r.eventos?.some(e => e.visitaId === visita.id && e.situacao === 'resolvido' && (!visita.finalizadaEm || e.data <= visita.finalizadaEm));
    paragrafo(`${i + 1}. ${tipo(r)}${recorrente ? ' (Recorrente)' : ''} — ${r.descricao}`);
    if (resolvido) paragrafo('Resolução registrada nesta visita', 3);
    y += 5;
  });

  const fotos = registros.flatMap((r, i) => [...(r.fotos ?? [])]
    .sort((a,b) => a.capturadaEm.localeCompare(b.capturadaEm) || a.id.localeCompare(b.id))
    .map(foto => ({ foto, legenda: `${tipo(r)} nº ${i + 1} - ${r.descricao}` })));
  if (fotos.length) {
    const cartao = 85;
    const passoLegenda = 4;
    const alturaImagem = 90;
    const abertura = 55;
    const novaPaginaDeFotos = () => { pagina(); titulo('Registro Fotográfico'); };
    const desenharFoto = async (foto: typeof fotos[number]['foto'], col: number, topo: number, altura: number) => {
      let imagem;
      try { imagem = await prepararFoto(foto.dataUrl); }
      catch { throw new Error('Uma fotografia vinculada não pôde ser lida. O relatório não foi emitido.'); }
      doc.setFillColor('#FFFFFF').setDrawColor(cores.borda).setLineWidth(0.2)
        .roundedRect(col, topo, cartao, altura, 2.2, 2.2, 'FD');
      const escala = Math.min((cartao - 6) / imagem.w, 85 / imagem.h);
      const w = imagem.w * escala, h = imagem.h * escala;
      doc.addImage(imagem.jpeg, 'JPEG', col + (cartao - w) / 2, topo + 3 + (85 - h) / 2, w, h, foto.id, 'FAST');
    };
    texto(8.5);
    const comLegendas = fotos.map(item => ({
      ...item, linhas: doc.splitTextToSize(item.legenda, cartao - 8) as string[],
    }));
    const alturaLinha = (linhas: string[]) => alturaImagem + 6 + linhas.length * passoLegenda;
    novaPaginaDeFotos();
    for (let i = 0; i < comLegendas.length;) {
      const primeira = comLegendas[i];
      const proxima = comLegendas[i + 1];
      // Legendas excepcionalmente longas usam a largura da página e podem continuar na próxima.
      if (alturaLinha(primeira.linhas) > limite - abertura) {
        if (y + alturaImagem + 10 > limite) novaPaginaDeFotos();
        await desenharFoto(primeira.foto, x, y, alturaImagem);
        y += alturaImagem + 3;
        paragrafo(primeira.legenda);
        y += 6;
        i += 1;
        continue;
      }
      const fileira = proxima && alturaLinha(proxima.linhas) <= limite - abertura
        ? [primeira, proxima] : [primeira];
      const altura = Math.max(...fileira.map(item => alturaLinha(item.linhas)));
      if (y + altura > limite) novaPaginaDeFotos();
      for (const [coluna, { foto, linhas }] of fileira.entries()) {
        const col = x + coluna * (largura - cartao);
        await desenharFoto(foto, col, y, altura);
        doc.setDrawColor(cores.borda).line(col + 3, y + alturaImagem, col + cartao - 3, y + alturaImagem);
        linhas.forEach((linha, j) => {
          texto(8.5, 'normal', cores.cinzaTexto).text(linha, col + 4, y + alturaImagem + 5 + j * passoLegenda);
        });
      }
      y += altura + 6;
      i += fileira.length;
    }
  } else {
    y += 5;
    titulo('Registro Fotográfico');
    paragrafo('Sem fotografias vinculadas aos apontamentos incluídos.');
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(cores.borda).setLineWidth(0.2).line(x, 278, direita, 278);
    texto(8, 'normal', cores.cinzaTexto);
    doc.text(`Página ${i} de ${total}`, 105, 285, { align: 'center' });
  }
  return {
    id: crypto.randomUUID(), visitaId: visita.id, projetoId: visita.projetoId,
    nomeArquivo: `${codigoRelatorio}${abreviacaoProjeto ? ` - ${abreviacaoProjeto}` : ''}.pdf`,
    geradoEm: new Date().toISOString(), atividades, registroIds: registros.map(r => r.id),
    fotografiaIds: fotos.map(({foto}) => foto.id), pdf: doc.output('blob'),
  };
}
