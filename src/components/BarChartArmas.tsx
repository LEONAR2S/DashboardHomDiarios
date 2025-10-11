import * as echarts from 'echarts';
import { useEffect, useRef, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FaDownload,
  FaFilePdf,
  FaSortAlphaDown,
  FaSortAmountDown,
  FaChartBar,
  FaSitemap,
  FaLayerGroup,
} from 'react-icons/fa';

interface ArmaDatos {
  entidad: string;
  Largas: number;
  Cortas: number;
  total: number;
}

type ModoArma = 'largas' | 'cortas' | 'apiladas';

const BarChartArmas = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [data, setData] = useState<ArmaDatos[]>([]);
  const [sortedData, setSortedData] = useState<ArmaDatos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'treemap'>('bar');
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [showAverageLine, setShowAverageLine] = useState(false);
  const [useGradientColor, setUseGradientColor] = useState(true);
  const [modo, setModo] = useState<ModoArma>('largas');

  const [leyenda50, setLeyenda50] = useState<{ entidades: number; porcentaje: number } | null>(null);
  const [leyendaTop10, setLeyendaTop10] = useState<{ total: number; porcentaje: number } | null>(null);

  // Totales dinámicos
  const total = useMemo(() => {
    if (modo === 'largas') return data.reduce((sum, d) => sum + d.Largas, 0);
    if (modo === 'cortas') return data.reduce((sum, d) => sum + d.Cortas, 0);
    return data.reduce((sum, d) => sum + d.total, 0);
  }, [data, modo]);

  const promedio = useMemo(() => (data.length > 0 ? total / data.length : 0), [total, data]);

  const countAbove = useMemo(
    () => data.filter((d) => {
      const val = modo === 'largas' ? d.Largas : modo === 'cortas' ? d.Cortas : d.total;
      return val > promedio;
    }).length,
    [data, promedio, modo]
  );

  const countBelow = useMemo(() => data.length - countAbove, [data, countAbove]);

  // Cargar datos
  useEffect(() => {
    fetch('/data/Arma.json')
      .then((res) => res.json())
      .then((json: ArmaDatos[]) => {
        setData(json);
        ordenarPorValor(json);
      })
      .catch((err) => console.error('Error cargando datos:', err));
  }, []);

  // Reordenar al cambiar modo
  useEffect(() => {
    if (data.length) ordenarPorValor(data);
  }, [modo]);

  // Renderizar gráfica
  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;
    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const minVal = Math.min(
      ...sortedData.map((d) =>
        modo === 'largas' ? d.Largas : modo === 'cortas' ? d.Cortas : d.total
      )
    );
    const maxVal = Math.max(
      ...sortedData.map((d) =>
        modo === 'largas' ? d.Largas : modo === 'cortas' ? d.Cortas : d.total
      )
    );

    // 🎨 Gradiente verde → rojo
    const getColorGradient = (value: number, min: number, max: number) => {
      const ratio = (value - min) / (max - min || 1);
      const r = Math.round(0 + ratio * 255);
      const g = Math.round(255 - ratio * 255);
      return `rgb(${r},${g},0)`;
    };

    const colorLargas = '#2563eb';
    const colorCortas = '#10b981';
    const colorApiladasLargas = '#2563eb';
    const colorApiladasCortas = '#10b981';

    // 🧱 Serie base (usada para modos “largas” o “cortas”)
    const baseSeries: echarts.SeriesOption = {
      type: 'bar',
      data: sortedData.map((item) => {
        const val =
          modo === 'largas'
            ? item.Largas
            : modo === 'cortas'
            ? item.Cortas
            : item.total;
        const out = showAsPercentage ? parseFloat(((val * 100) / total).toFixed(2)) : val;
        return {
          value: out,
          itemStyle: {
            color: useGradientColor ? getColorGradient(val, minVal, maxVal) : colorLargas,
          },
        };
      }),
      label: {
        show: true,
        position: 'top',
        fontSize: 10,
        color: '#333',
        formatter: (v: any) =>
          showAsPercentage ? `${v.value.toFixed(2)}%` : v.value.toLocaleString(),
      },
    };

    // ✅ Añadir línea de promedio solo si aplica
    if (showAverageLine && modo !== 'apiladas') {
      (baseSeries as any).markLine = {
        symbol: 'none',
        data: [
          {
            yAxis: promedio,
            lineStyle: { type: 'dashed', color: 'red', width: 2 },
          },
        ],
      };
    }

    // 🧩 Configuración principal
    const options: echarts.EChartsOption =
      chartType === 'bar'
        ? {
            title: {
              text:
                modo === 'largas'
                  ? 'Aseguramientos de Armas Largas por Entidad Federativa (2024)'
                  : modo === 'cortas'
                  ? 'Aseguramientos de Armas Cortas por Entidad Federativa (2024)'
                  : 'Aseguramientos Totales de Armas (2024) (Apilado)',
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'shadow' },
              formatter: (params: any) => {
                const entidad = params[0].name;
                if (modo === 'apiladas') {
                  const filas = params
                    .map((p: any) => `${p.marker} ${p.seriesName}: ${Number(p.value).toLocaleString()}`)
                    .join('<br/>');
                  const tot = params.reduce((acc: number, p: any) => acc + Number(p.value || 0), 0);
                  const totalMarker =
                    '<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background:#111;"></span>';
                  return `<b>${entidad}</b><br/>${filas}<br/>${totalMarker} Total: ${tot.toLocaleString()}`;
                } else {
                  const p = params[0];
                  const val = Number(p.value);
                  const valueStr = showAsPercentage ? `${val.toFixed(2)}%` : val.toLocaleString();
                  return `${p.marker} <b>${entidad}</b><br/>${valueStr} armas`;
                }
              },
            },
            grid: { left: '2%', right: '2%', bottom: 60, top: 60, containLabel: true },
            xAxis: {
              type: 'category',
              data: sortedData.map((item) => item.entidad),
              axisLabel: { rotate: 45, interval: 0 },
            },
            yAxis: { type: 'value', name: showAsPercentage && modo !== 'apiladas' ? '%' : 'Cantidad' },
            legend: modo === 'apiladas' ? { bottom: 10 } : undefined,
            series:
              modo === 'apiladas'
                ? [
                    {
                      name: 'Largas',
                      type: 'bar',
                      stack: 'total',
                      itemStyle: { color: colorApiladasLargas },
                      data: sortedData.map((d) => d.Largas),
                    },
                    {
                      name: 'Cortas',
                      type: 'bar',
                      stack: 'total',
                      itemStyle: { color: colorApiladasCortas },
                      label: {
                        show: true,
                        position: 'top',
                        formatter: (params: any) => {
                          const totalPorEntidad =
                            sortedData[params.dataIndex].Largas + sortedData[params.dataIndex].Cortas;
                          return totalPorEntidad.toLocaleString();
                        },
                        fontSize: 10,
                        color: '#333',
                      },
                      data: sortedData.map((d) => d.Cortas),
                    },
                  ]
                : [baseSeries],
          }
        : {
            title: { text: 'Mapa de Árbol: Aseguramientos de Armas' },
            tooltip: {
              formatter: (params: any) =>
                `${params.marker ?? ''} <b>${params.name}</b><br/>${params.value.toLocaleString()} armas`,
            },
            series: [
              {
                type: 'treemap',
                roam: false,
                nodeClick: false,
                label: {
                  show: true,
                  formatter: (info: any) => `${info.name}\n${info.value.toLocaleString()}`,
                },
                itemStyle: {
                  borderColor: '#fff',
                  borderWidth: 1,
                },
                data: sortedData.map((item) => {
                  const val =
                    modo === 'largas' ? item.Largas : modo === 'cortas' ? item.Cortas : item.total;
                  const color = useGradientColor
                    ? getColorGradient(val, minVal, maxVal)
                    : modo === 'largas'
                    ? colorLargas
                    : colorCortas;
                  return {
                    name: item.entidad,
                    value: val,
                    itemStyle: { color },
                  };
                }),
              },
            ],
          };

    chart.setOption(options);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [sortedData, chartType, showAsPercentage, total, promedio, showAverageLine, useGradientColor, modo]);

  // Ordenamientos
  const ordenarPorNombre = (base: ArmaDatos[] = data) =>
    setSortedData([...base].sort((a, b) => a.entidad.localeCompare(b.entidad)));

  const ordenarPorValor = (base: ArmaDatos[] = data) => {
    const ordenada = [...base].sort((a, b) => {
      const valA = modo === 'largas' ? a.Largas : modo === 'cortas' ? a.Cortas : a.total;
      const valB = modo === 'largas' ? b.Largas : modo === 'cortas' ? b.Cortas : b.total;
      return valB - valA;
    });
    setSortedData(ordenada);
  };

  // --- Botones auxiliares ---
  const mostrarTop10 = () => {
    const sorted = [...data].sort(
      (a, b) =>
        (modo === 'largas' ? b.Largas : modo === 'cortas' ? b.Cortas : b.total) -
        (modo === 'largas' ? a.Largas : modo === 'cortas' ? a.Cortas : a.total)
    );
    const top10 = sorted.slice(0, 10);
    const totalTop10 = top10.reduce(
      (sum, item) =>
        sum + (modo === 'largas' ? item.Largas : modo === 'cortas' ? item.Cortas : item.total),
      0
    );
    const porcentaje = parseFloat(((totalTop10 * 100) / total).toFixed(1));
    setLeyendaTop10({ total: totalTop10, porcentaje });
    setSortedData(top10);
  };

  const mostrarTop50Porciento = () => {
    const sorted = [...data].sort(
      (a, b) =>
        (modo === 'largas' ? b.Largas : modo === 'cortas' ? b.Cortas : b.total) -
        (modo === 'largas' ? a.Largas : modo === 'cortas' ? a.Cortas : a.total)
    );
    let acumulado = 0;
    const subset: ArmaDatos[] = [];
    for (const item of sorted) {
      const valor = modo === 'largas' ? item.Largas : modo === 'cortas' ? item.Cortas : item.total;
      acumulado += valor;
      subset.push(item);
      if (acumulado / total >= 0.5) break;
    }
    const porcentaje = parseFloat(((acumulado * 100) / total).toFixed(1));
    setLeyenda50({ entidades: subset.length, porcentaje });
    setSortedData(subset);
  };

  const restablecerVistaOriginal = () => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    setShowAverageLine(false);
    ordenarPorValor(data);
  };

  // --- Descargas ---
  const handleDownloadImage = () => {
    if (!chartRef.current) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    const base64 = chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    if (base64) {
      const link = document.createElement('a');
      link.href = base64;
      link.download = `grafica_armas_${modo}.png`;
      link.click();
    }
  };

  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
    pdf.save(`grafica_armas_${modo}.pdf`);
  };

  return (
    <div style={wrapperStyle}>
      <div style={toolbarStyle}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}><FaDownload /></button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}><FaFilePdf /></button>
        <button onClick={() => ordenarPorNombre()} title="Ordenar A→Z" style={buttonStyle}><FaSortAlphaDown /></button>
        <button onClick={() => ordenarPorValor()} title="Ordenar por valor" style={buttonStyle}><FaSortAmountDown /></button>
        <button onClick={() => setUseGradientColor((p) => !p)} title="Gradiente de color" style={buttonStyle}>
          {useGradientColor ? 'Gradiente ✔' : 'Gradiente ✘'}
        </button>
        <button onClick={mostrarTop10} title="Top 10" style={buttonStyle}>Top 10</button>
        <button onClick={mostrarTop50Porciento} title="+50%" style={buttonStyle}>+50%</button>
        <button
          onClick={() => setChartType((p) => (p === 'bar' ? 'treemap' : 'bar'))}
          title="Cambiar vista"
          style={buttonStyle}
        >
          {chartType === 'bar' ? <FaSitemap /> : <FaChartBar />}
        </button>
        <button
          onClick={() => setShowAsPercentage((p) => !p)}
          title="Mostrar en porcentaje"
          style={buttonStyle}
        >
          {showAsPercentage ? '%' : '#'}
        </button>
        <button
          onClick={() => setShowAverageLine((p) => !p)}
          title="Línea de promedio"
          style={buttonStyle}
        >
          {showAverageLine ? '🔴 Promedio' : '⚪ Promedio'}
        </button>

        <div style={toggleGroupStyle}>
          <button
            onClick={() => {
              setModo('largas');
              ordenarPorValor();
            }}
            style={{
              ...toggleButtonStyle,
              backgroundColor: modo === 'largas' ? '#2563eb' : '#f3f4f6',
              color: modo === 'largas' ? '#fff' : '#333',
            }}
          >
            Largas
          </button>
          <button
            onClick={() => {
              setModo('cortas');
              ordenarPorValor();
            }}
            style={{
              ...toggleButtonStyle,
              backgroundColor: modo === 'cortas' ? '#10b981' : '#f3f4f6',
              color: modo === 'cortas' ? '#fff' : '#333',
            }}
          >
            Cortas
          </button>
          <button
            onClick={() => {
              setModo('apiladas');
              ordenarPorValor();
            }}
            style={{
              ...toggleButtonStyle,
              backgroundColor: modo === 'apiladas' ? '#7c3aed' : '#f3f4f6',
              color: modo === 'apiladas' ? '#fff' : '#333',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FaLayerGroup /> Apiladas
          </button>
        </div>

        <button onClick={restablecerVistaOriginal} title="Restablecer" style={buttonStyle}>⟳</button>
      </div>

      {showAverageLine && modo !== 'apiladas' && (
        <div style={legendBoxStyle}>
          🔺 {countAbove} por encima · 🔻 {countBelow} por debajo del promedio
        </div>
      )}
      {leyenda50 && (
        <div style={legendBoxStyle}>
          {leyenda50.entidades} entidades concentran el {leyenda50.porcentaje}%
        </div>
      )}
      {leyendaTop10 && (
        <div style={legendBoxStyle}>
          Top 10 acumulan {leyendaTop10.total.toLocaleString()} ({leyendaTop10.porcentaje}%)
        </div>
      )}

      <div ref={chartRef} style={{ width: '100%', height: '500px', minHeight: '300px' }} />
    </div>
  );
};

// 🎨 Estilos
const wrapperStyle: React.CSSProperties = {
  position: 'relative',
  padding: '1rem',
  border: '1px solid #ccc',
  borderRadius: '8px',
  background: '#fff',
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  marginBottom: '2rem',
};
const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: '10px',
  marginBottom: '10px',
  alignItems: 'center',
};
const buttonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #ddd',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '14px',
  padding: '6px 8px',
};
const toggleGroupStyle: React.CSSProperties = { display: 'flex', gap: '4px' };
const toggleButtonStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'all 0.2s',
};
const legendBoxStyle: React.CSSProperties = {
  backgroundColor: '#f9f9f9',
  color: '#555',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  marginBottom: '10px',
};

export default BarChartArmas;
