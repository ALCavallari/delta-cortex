import L from 'leaflet';
import { RegistroCampo } from '@/types';
import { fieldMarkerHtml } from './EnvironmentalIcon';

/** Agrupa em pixels e afasta somente a apresentação. Nunca modifica os registros. */
export function attachFieldMarkers(map: L.Map, layer: L.LayerGroup, registros: RegistroCampo[], select: (r: RegistroCampo) => void, distinguirResolvidas = false) {
  const expanded = L.layerGroup().addTo(map);
  let active: L.Marker | null = null;
  const collapse = () => {
    expanded.clearLayers();
    active?.setOpacity(1);
    active = null;
  };
  const addRecord = (reg: RegistroCampo, position: L.LatLng, target: L.LayerGroup) => {
    const marker = L.marker(position, {
      icon: L.divIcon({className:'custom-field-pin',html:fieldMarkerHtml(reg, distinguirResolvidas),iconSize:[36,36],iconAnchor:[18,18]}),
      title: `${reg.tipo === 'Ocorrencia' ? 'Ocorrência' : 'Observação'}: ${reg.meio}${distinguirResolvidas && reg.situacao === 'resolvido' ? ' (Resolvida)' : ''}`,
      bubblingMouseEvents: false,
    });
    const tooltip = document.createElement('span');
    tooltip.textContent = `${reg.tipo === 'Ocorrencia' ? 'Ocorrência' : 'Observação'}: ${reg.meio} — ${reg.descricao.slice(0, 60)}`;
    marker.bindTooltip(tooltip, {direction:'top',offset:[0,-20]});
    marker.on('click', () => { collapse(); select(reg); });
    marker.addTo(target);
  };
  const draw = () => {
    collapse(); layer.clearLayers();
    const points = registros.map(r => map.latLngToLayerPoint([r.latitude,r.longitude]));
    const visited = new Set<number>();
    registros.forEach((reg, i) => {
      if (visited.has(i)) return;
      // Componente conexo: inclui também cadeias de marcadores próximos.
      const indices = [i]; visited.add(i);
      for (let k=0;k<indices.length;k++) {
        for(let j=0;j<registros.length;j++) {
          if (!visited.has(j) && points[indices[k]].distanceTo(points[j]) < 48) {
            visited.add(j); indices.push(j);
          }
        }
      }
      if (indices.length === 1) {addRecord(reg,L.latLng(reg.latitude,reg.longitude),layer); return;}
      const center = L.point(indices.reduce((n,j)=>n+points[j].x,0)/indices.length,indices.reduce((n,j)=>n+points[j].y,0)/indices.length);
      const cluster = L.marker(map.layerPointToLatLng(center), {
        icon: L.divIcon({className:'field-cluster',html:`<div style="width:40px;height:40px;background:#333436;color:white;border:3px solid #A3CA33;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;box-shadow:0 2px 8px #0006">${indices.length}</div>`,iconSize:[40,40],iconAnchor:[20,20]}),
        title:`Expandir ${indices.length} registros sobrepostos`,bubblingMouseEvents:false,
      }).addTo(layer);
      cluster.on('click', () => {
        const wasActive = active === cluster; collapse();
        if (wasActive) return;
        active = cluster; cluster.setOpacity(0);
        // Anéis de capacidade crescente, com pelo menos 52px entre símbolos.
        let offset=0, ring=1;
        while(offset<indices.length) {
          const radius=ring*64;
          const count=Math.min(Math.floor(2*Math.PI*radius/52),indices.length-offset);
          for(let k=0;k<count;k++) {
            const j=indices[offset+k], angle=2*Math.PI*k/count-Math.PI/2;
            const display=map.layerPointToLatLng(center.add(L.point(Math.cos(angle)*radius,Math.sin(angle)*radius)));
            const r=registros[j];
            L.polyline([[r.latitude,r.longitude],display],{weight:1.5,color:'#333436',opacity:0.7,interactive:false}).addTo(expanded);
            addRecord(r,display,expanded);
          }
          offset+=count;ring++;
        }
        const close = L.marker(map.layerPointToLatLng(center), {icon:L.divIcon({className:'field-cluster-close',html:'<div style="background:white;border:1px solid #97989A;border-radius:50%;width:28px;height:28px;text-align:center;line-height:26px;font-size:20px">×</div>',iconSize:[28,28],iconAnchor:[14,14]}),title:'Recolher agrupamento',bubblingMouseEvents:false}).addTo(expanded);
        close.on('click', collapse);
      });
    });
  };
  draw();
  map.on('click zoomstart movestart', collapse);
  map.on('zoomend moveend', draw);
  return () => {map.off('click zoomstart movestart',collapse);map.off('zoomend moveend',draw);expanded.remove();layer.clearLayers();};
}
