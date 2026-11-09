import { lerLinkGoogleMaps } from '@/services/googleMaps';

export async function GET(request: Request) {
  const link = new URL(request.url).searchParams.get('link') ?? '';
  if (link.length > 2048 || lerLinkGoogleMaps(link)?.tipo !== 'encurtado') {
    return Response.json({ erro: 'Informe um link curto do Google Maps.' }, { status: 400 });
  }

  try {
    let url = new URL(link);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
    // Só solicite endereços curtos aceitos pelo parser. A URL longa é analisada localmente.
    for (let saltos = 0; saltos < 4; saltos++) {
      const resposta = await fetch(url, { redirect: 'manual', cache: 'no-store', signal });
      const destino = resposta.headers.get('location');
      await resposta.body?.cancel();
      if (!destino || ![301, 302, 303, 307, 308].includes(resposta.status)) break;
      url = new URL(destino, url);
      const resultado = lerLinkGoogleMaps(url.href);
      if (!resultado) break;
      if (resultado.tipo !== 'encurtado') return Response.json(resultado);
    }
  } catch {
    // O formulário conserva o link original para abertura manual.
  }
  return Response.json({ tipo: 'sem-coordenadas' });
}
