import * as echarts from 'echarts';
import { useEffect, useRef, useState } from 'react';

type RecordFull = {
  ID: number;
  Fecha: string;
  Año: number;
  Estado: string;
  Municipio: string;
  Lat: number;
  Lon: number;
  Nombre: string;
  Edad?: string;
  Corporacion?: string;
  Tipo: string;
  Sexo: string;
  Estatus: string;
  Link?: string;
};

// 🔧 Tamaño fijo del tooltip
const TOOLTIP_WIDTH = 280;  // px
const TOOLTIP_HEIGHT = 300; // px

const PoliceMapPoints: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<RecordFull[]>([]);

  // Punto fijado (tooltip pegado)
  const fixedRef = useRef<{ seriesIndex: number; dataIndex: number } | null>(null);
  // Flag para distinguir si el click de ZRender fue sobre un punto o en vacío
  const clickedOnSeriesRef = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch('/data/estados.json').then((res) => res.json()),
      fetch('/data/DataPolice20182024.json').then((res) => res.json()),
    ])
      .then(([geoJson, policeRecords]) => {
        echarts.registerMap('Mexico', geoJson);
        setData(policeRecords);
        setReady(true);
      })
      .catch((err) => console.error('Error cargando datos:', err));
  }, []);

  useEffect(() => {
    if (!ready || !chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    // --- Agrupar eventos por coordenadas ---
    const grouped = new Map<string, RecordFull[]>();
    data
      .filter((r) => Number.isFinite(r.Lat) && Number.isFinite(r.Lon))
      .forEach((r) => {
        const key = `${r.Lat},${r.Lon}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(r);
      });

    const scatterData = Array.from(grouped.entries()).map(([key, events]) => {
      const [lat, lon] = key.split(',').map(Number);
      return {
        name: `${events.length} evento(s)`,
        value: [lon, lat], // [lng, lat]
        events,
      };
    });

    // ---------- Helpers ----------
    // Normaliza y valida params de ECharts para obtener índices seguros
    const getPointIdx = (params: unknown) => {
      const p = params as any;
      // ECharts envía en minúsculas. Si vienen en mayúsculas, las normalizamos.
      const seriesIndex: number | undefined =
        typeof p?.seriesIndex === 'number'
          ? p.seriesIndex
          : typeof p?.SeriesIndex === 'number'
          ? p.SeriesIndex
          : undefined;

      const dataIndex: number | undefined =
        typeof p?.dataIndex === 'number'
          ? p.dataIndex
          : typeof p?.DataIndex === 'number'
          ? p.DataIndex
          : undefined;

      const componentType: string | undefined = p?.componentType ?? p?.ComponentType;
      const seriesType: string | undefined = p?.seriesType ?? p?.SeriesType;

      const isScatter =
        componentType === 'series' && (seriesType === 'scatter' || seriesType === 'effectScatter');

      if (isScatter && typeof seriesIndex === 'number' && typeof dataIndex === 'number') {
        return { seriesIndex, dataIndex, ok: true as const };
      }
      return { ok: false as const };
    };

    // Espera a que el DOM del tooltip exista antes de enlazar handlers
    const schedule = (fn: () => void) => {
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fn, 0)));
    };

    const bindTooltipControls = (seriesIndex: number, dataIndex: number) => {
      const id = `tooltip_${seriesIndex}_${dataIndex}`;
      // Busca el root del contenido del tooltip
      const root =
        document.getElementById(id) ||
        chart.getDom().querySelector(`#${CSS.escape(id)}`) ||
        document.body.querySelector(`#${CSS.escape(id)}`);

      if (!root) return;

      // 🔒 Asegurar tamaño fijo + scroll interno
      const rootEl = root as HTMLElement;
      rootEl.style.width = `${TOOLTIP_WIDTH}px`;
      rootEl.style.minWidth = `${TOOLTIP_WIDTH}px`;
      rootEl.style.maxWidth = `${TOOLTIP_WIDTH}px`;
      rootEl.style.height = `${TOOLTIP_HEIGHT}px`;
      rootEl.style.minHeight = `${TOOLTIP_HEIGHT}px`;
      rootEl.style.maxHeight = `${TOOLTIP_HEIGHT}px`;
      rootEl.style.overflowY = 'auto';
      rootEl.style.boxSizing = 'border-box';
      rootEl.style.paddingRight = '6px'; // deja espacio para scroll
      rootEl.style.wordBreak = 'break-word';

      const totalAttr = root.getAttribute('data-total');
      const total = totalAttr ? parseInt(totalAttr, 10) : 1;
      const indicator = root.querySelector<HTMLElement>(`#${CSS.escape(id)}-indicator`);
      const prevBtn = root.querySelector<HTMLButtonElement>(`#${CSS.escape(id)}-prev`);
      const nextBtn = root.querySelector<HTMLButtonElement>(`#${CSS.escape(id)}-next`);
      const closeBtn = root.querySelector<HTMLButtonElement>(`#${CSS.escape(id)}-close`);

      // Mantener índice actual entre rerenders del tooltip
      const stateKey = '__currentIndex';
      let current = (root as any)[stateKey] ?? 0;

      const show = (i: number) => {
        for (let j = 0; j < total; j++) {
          const el = root.querySelector<HTMLElement>(`#${CSS.escape(id)}-block-${j}`);
          if (el) el.style.display = j === i ? '' : 'none';
        }
        if (indicator) indicator.textContent = `${i + 1} / ${total}`;
        (root as any)[stateKey] = i;
        // Mantener scroll en top al cambiar de página (opcional)
        rootEl.scrollTop = 0;
      };

      if (total > 1) show(current);

      const safe = (handler: (e: MouseEvent) => void) => (e: Event) => {
        e.stopPropagation();
        handler(e as MouseEvent);
      };

      if (prevBtn) {
        // Evitar que el botón se rompa de línea y se mueva
        prevBtn.style.flex = '0 0 auto';
        prevBtn.style.whiteSpace = 'nowrap';
        prevBtn.onclick = safe(() => {
          current = (current - 1 + total) % total;
          show(current);
        });
      }
      if (nextBtn) {
        nextBtn.style.flex = '0 0 auto';
        nextBtn.style.whiteSpace = 'nowrap';
        nextBtn.onclick = safe(() => {
          current = (current + 1) % total;
          show(current);
        });
      }
      if (closeBtn) {
        closeBtn.style.flex = '0 0 auto';
        closeBtn.onclick = safe(() => {
          window.dispatchEvent(
            new CustomEvent('echarts-hide-tooltip', { detail: { seriesIndex, dataIndex } })
          );
        });
      }

      // Asegura que el contenedor del tooltip permita interacción
      const tooltipEl = root.closest('.echarts-tooltip') as HTMLElement | null;
      if (tooltipEl) tooltipEl.style.pointerEvents = 'auto';
    };

    const showAndBindTooltip = (seriesIndex: number, dataIndex: number) => {
      chart.dispatchAction({ type: 'showTip', seriesIndex, dataIndex });
      schedule(() => bindTooltipControls(seriesIndex, dataIndex));
    };

    const option: echarts.EChartsOption = {
      backgroundColor: '#1e1e1e',
      title: {
        text: 'Homicidios de Policías (2018–2024)',
        left: 'center',
        textStyle: { color: '#fff', fontSize: 16 },
      },
      geo: {
        map: 'Mexico',
        roam: true,
        itemStyle: { areaColor: '#2b2b2b', borderColor: '#666' },
        emphasis: { itemStyle: { areaColor: '#2171b5' } },
      },
      tooltip: {
        // Control manual del tooltip (no se cierra con hover)
        trigger: 'item',
        triggerOn: 'none',
        enterable: true,       // permite interactuar dentro del tooltip
        appendToBody: true,    // evita recortes por overflow del contenedor
        alwaysShowContent: true,
        showContent: true,
        renderMode: 'html',
        confine: false,        // con appendToBody, conviene false
        backgroundColor: '#222',
        borderColor: '#555',
        borderWidth: 1,
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          const events: RecordFull[] = params?.data?.events || [];
          const n = events.length;
          const id = `tooltip_${params.seriesIndex}_${params.dataIndex}`;

          // 🔒 Estilos comunes para tamaño fijo (no crece/encoge)
          const fixedBoxStyle = `
            width:${TOOLTIP_WIDTH}px;
            min-width:${TOOLTIP_WIDTH}px;
            max-width:${TOOLTIP_WIDTH}px;
            height:${TOOLTIP_HEIGHT}px;
            min-height:${TOOLTIP_HEIGHT}px;
            max-height:${TOOLTIP_HEIGHT}px;
            overflow-y:auto;
            box-sizing:border-box;
            color:#fff;
            padding:6px;
            word-break: break-word;
          `;

          const eventHtml = (d: RecordFull) => `
            <div style="line-height:1.4; margin-bottom:6px;">
              <strong>ID:</strong> ${d.ID}<br/>
              <strong>Nombre:</strong> ${d.Nombre || 'Sin nombre'}<br/>
              <strong>Fecha:</strong> ${d.Fecha}<br/>
              <strong>Estado:</strong> ${d.Estado}<br/>
              <strong>Municipio:</strong> ${d.Municipio}<br/>
              <strong>Edad:</strong> ${d.Edad || 'N/A'}<br/>
              <strong>Corporación:</strong> ${d.Corporacion || 'N/A'}<br/>
              <strong>Tipo:</strong> ${d.Tipo || 'N/A'}<br/>
              <strong>Sexo:</strong> ${d.Sexo || 'N/A'}<br/>
              <strong>Estatus:</strong> ${d.Estatus || 'N/A'}<br/>
              ${d.Link ? `<a href="${d.Link}" target="_blank" style="color:#9cf; word-break:break-all;">Ver fuente</a>` : ''}
            </div>
          `;

          // Un solo evento (sin paginación)
          if (n <= 1) {
            return `
              <div id="${id}" data-total="1" style="${fixedBoxStyle}">
                ${events[0] ? eventHtml(events[0]) : 'Sin datos'}
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
                  <button id="${id}-close" style="background:#444; color:#fff; border:none; padding:4px 8px; cursor:pointer; flex:0 0 auto;">Cerrar</button>
                </div>
              </div>
            `;
          }

          // Varios eventos -> paginación
          const blocks = events
            .map((d, i) => {
              const display = i === 0 ? '' : 'display:none;';
              return `<div id="${id}-block-${i}" style="${display}">
                        <div style="font-weight:600; margin-bottom:4px;">Evento ${i + 1} de ${n}</div>
                        ${eventHtml(d)}
                      </div>`;
            })
            .join('');

          // Header sin wrap (los botones no se van a segunda línea)
          const headerBar = `
            <div style="
              display:flex; 
              align-items:center; 
              justify-content:space-between; 
              margin-bottom:6px; 
              gap:8px;">
              <div style="display:flex; gap:8px; flex-wrap:nowrap; align-items:center;">
                <button id="${id}-prev" style="background:#555; color:#fff; border:none; padding:4px 8px; cursor:pointer; flex:0 0 auto; white-space:nowrap;">« Anterior</button>
                <button id="${id}-next" style="background:#555; color:#fff; border:none; padding:4px 8px; cursor:pointer; flex:0 0 auto; white-space:nowrap;">Siguiente »</button>
              </div>
              <div id="${id}-indicator" style="opacity:.85; font-size:12px; white-space:nowrap; flex:0 0 auto;">1 / ${n}</div>
            </div>
          `;

          return `
            <div id="${id}" data-total="${n}" style="${fixedBoxStyle}">
              ${headerBar}
              ${blocks}
              <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
                <button id="${id}-close" style="background:#444; color:#fff; border:none; padding:4px 8px; cursor:pointer; flex:0 0 auto;">Cerrar</button>
              </div>
            </div>
          `;
        },
      },
      series: [
        {
          name: 'Casos individuales',
          type: 'scatter',
          coordinateSystem: 'geo',
          symbol: 'circle',
          symbolSize: 7,
          data: scatterData,
          itemStyle: { color: '#ff6666', borderColor: '#fff', borderWidth: 1 },
          emphasis: { itemStyle: { color: '#ffcc00' } },
          selectedMode: 'single', // resalta punto fijado
        },
      ],
    };

    chart.setOption(option);

    // -------- CONTROL MANUAL DEL TOOLTIP (fijado) --------

    // Hover: mostrar/ocultar SOLO si NO está fijado
    chart.on('mouseover', (params) => {
      const idx = getPointIdx(params);
      if (idx.ok && !fixedRef.current) {
        showAndBindTooltip(idx.seriesIndex, idx.dataIndex);
      }
    });

    chart.on('mouseout', () => {
      if (!fixedRef.current) {
        chart.dispatchAction({ type: 'hideTip' });
      }
    });

    // Click en punto: fijar (o refijar en otro punto)
    chart.on('click', (params) => {
      const idx = getPointIdx(params);
      if (idx.ok) {
        clickedOnSeriesRef.current = true;

        // Visual select
        chart.dispatchAction({ type: 'unselect', seriesIndex: 0 });
        chart.dispatchAction({
          type: 'select',
          seriesIndex: idx.seriesIndex,
          dataIndex: idx.dataIndex,
        });

        fixedRef.current = { seriesIndex: idx.seriesIndex, dataIndex: idx.dataIndex };
        showAndBindTooltip(idx.seriesIndex, idx.dataIndex);
      }
    });

    // Click en vacío: desfijar (si no lo quieres, comenta este bloque)
    const zr = chart.getZr();
    const onZrClick = () => {
      if (!clickedOnSeriesRef.current) {
        if (fixedRef.current) {
          chart.dispatchAction({ type: 'unselect', seriesIndex: 0 });
          chart.dispatchAction({ type: 'hideTip' });
          fixedRef.current = null;
        }
      }
      clickedOnSeriesRef.current = false;
    };
    zr.on('click', onZrClick);

    // Cerrar desde botón del tooltip
    const onCloseFromTooltip = (ev: any) => {
      const detail = ev.detail;
      if (
        fixedRef.current &&
        detail.seriesIndex === fixedRef.current.seriesIndex &&
        detail.dataIndex === fixedRef.current.dataIndex
      ) {
        chart.dispatchAction({ type: 'unselect', seriesIndex: 0 });
        chart.dispatchAction({ type: 'hideTip' });
        fixedRef.current = null;
      }
    };
    window.addEventListener('echarts-hide-tooltip', onCloseFromTooltip);

    // Al salir de todo el lienzo: si no está fijado, ocultar
    chart.on('globalout', () => {
      if (!fixedRef.current) chart.dispatchAction({ type: 'hideTip' });
    });

    // Resize
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('echarts-hide-tooltip', onCloseFromTooltip);
      zr.off('click', onZrClick);
      chart.dispose();
    };
  }, [ready, data]);

  return (
    <div
      ref={chartRef}
      style={{
        width: '100%',
        height: '700px',
        border: '1px solid #444',
        borderRadius: 8,
        background: '#111',
        marginBottom: '2rem',
      }}
    />
  );
};

export default PoliceMapPoints;
