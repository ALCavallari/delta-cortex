import { CoordenadasUTM } from '@/types';

export interface EstampaFotoOptions {
  dataHora: Date;
  clienteProjeto: string;
  utm: CoordenadasUTM;
}

/**
 * Aplica visualmente via Canvas uma faixa informativa indelével e profissional na fotografia,
 * contendo a marca DELTA S ENGENHARIA, data, hora, cliente/projeto e coordenadas UTM.
 */
export async function aplicarEstampaFoto(
  fileOrDataUrl: File | Blob | string,
  options: EstampaFotoOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível obter o contexto 2D do Canvas.'));
          return;
        }

        // 1. Desenha a fotografia original preservando as proporções e resolução
        ctx.drawImage(img, 0, 0, width, height);

        // 2. Calcula dimensões e escala proporcional da legenda
        const scale = Math.max(width, height) / 1000;
        const fontSizeTitle = Math.max(16, Math.round(18 * scale));
        const fontSizeBody = Math.max(12, Math.round(14 * scale));
        const lineHeight = fontSizeBody * 1.45;
        const padding = Math.max(14, Math.round(16 * scale));

        const numLinhas = 3;
        const faixaHeight = padding * 2 + fontSizeTitle + numLinhas * lineHeight;

        // 3. Desenha a faixa inferior em grafite semitransparente
        ctx.fillStyle = 'rgba(40, 42, 44, 0.82)';
        ctx.fillRect(0, height - faixaHeight, width, faixaHeight);

        // Linha sutil de topo na faixa com cor Azul Delta S (#00AFF0)
        ctx.fillStyle = '#00AFF0';
        ctx.fillRect(0, height - faixaHeight, width, Math.max(3, Math.round(3 * scale)));

        // 4. Formata data e hora no padrão brasileiro (DD/MM/AAAA e HH:MM:SS)
        const d = options.dataHora;
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        const horas = String(d.getHours()).padStart(2, '0');
        const minutos = String(d.getMinutes()).padStart(2, '0');
        const segundos = String(d.getSeconds()).padStart(2, '0');

        const dataStr = `${dia}/${mes}/${ano}`;
        const horaStr = `${horas}:${minutos}:${segundos}`;

        // 5. Configurações de texto com sombra para máxima legibilidade
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.textBaseline = 'top';

        let currentY = height - faixaHeight + padding;

        // Cabeçalho: DELTA S ENGENHARIA
        ctx.font = `bold ${fontSizeTitle}px sans-serif, -apple-system, BlinkMacSystemFont`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('DELTA S ENGENHARIA', padding, currentY);

        // Indicador em verde Delta S ao lado do título
        const titleWidth = ctx.measureText('DELTA S ENGENHARIA').width;
        ctx.font = `bold ${fontSizeBody}px sans-serif`;
        ctx.fillStyle = '#A3CA33';
        ctx.fillText(' • REGISTRO DE CAMPO', padding + titleWidth + 10 * scale, currentY + (fontSizeTitle - fontSizeBody) / 2);

        currentY += fontSizeTitle + (6 * scale);

        // Linha 1: Cliente / Projeto
        ctx.font = `normal ${fontSizeBody}px monospace, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Cliente/Projeto: ${options.clienteProjeto || 'Não especificado'}`, padding, currentY);
        currentY += lineHeight;

        // Linha 2: Data e Hora
        ctx.fillText(`Data: ${dataStr}   Hora: ${horaStr}`, padding, currentY);
        currentY += lineHeight;

        // Linha 3: coordenadas UTM SIRGAS 2000
        const utm = options.utm;
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(
          `UTM ${utm.referenciaGeodesica}: Zona ${utm.zona}${utm.hemisferio}  |  E: ${utm.easting.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m  |  N: ${utm.northing.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`,
          padding,
          currentY
        );

        // 6. Exporta imagem carimbada de alta qualidade
        const stampedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve(stampedDataUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Falha ao carregar a imagem para processamento da estampa.'));
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        } else {
          reject(new Error('Erro ao ler arquivo da imagem.'));
        }
      };
      reader.onerror = () => reject(new Error('Erro no FileReader.'));
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
