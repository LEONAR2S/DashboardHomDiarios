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
} from 'react-icons/fa';

// Tipo mínimo del JSON (solo lo que usaremos)
type PoliceRecordMinimal = {
  Estado: string;
  ID: number;
  Año: number;
};

// Tipo agregado por estado
interface EstadoCount {
  entidad: string;
  valor: number;
}

// Para seleccionar “Todos los años” usamos un valor especial
const TODOS_ANIOS = 0;

const PolicemenKilledByStateChart: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  // Datos originales cargados (sin filtrar)
  const [allRecords, setAllRecords] = useState<PoliceRecordMinimal[]>([]);
  // Datos agrupados según el filtro actual
  const [data, setData] = useState<EstadoCount[]>([]);
  const [sortedData, setSortedData] = useState<EstadoCount[]>([]);

  const [selectedYear, setSelectedYear] = useState<number>(TODOS_ANIOS); // 0 = todos

  const [chartType, setChartType] = useState<'bar' | 'treemap'>('bar');
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [showAverageLine, setShowAverageLine] = useState(false);
  const [useGradientColor, setUseGradientColor] = useState(false);

  const [leyenda50, setLeyenda50] = useState<{ entidades: number; porcentaje: number } | null>(null);
  const [leyendaTop10, setLeyendaTop10] = useState<{ total: number; porcentaje: number } | null>(null);

  // Cálculos derivados
  const total = useMemo(() => data.reduce((sum, d) => sum + d.valor, 0), [data]);
  const promedio = useMemo(() => (data.length > 0 ? total / data.length : 0), [total, data]);
  const countAbove = useMemo(() => data.filter((d) => d.valor > promedio).length, [data, promedio]);
  const countBelow = useMemo(() => data.filter((d) => d.valor < promedio).length, [data, promedio]);

  // Efecto: cargar todos los registros al inicio
  useEffect(() => {
    fetch('/data/DataPolice20182024.json')
      .then((res) => res.json())
      .then((json: PoliceRecordMinimal[]) => {
        setAllRecords(json);
        // Inicialmente agrupar con todos los años
        const grouped = agruparPorEstado(json);
        setData(grouped);
        ordenarPorValor(grouped);
      })
      .catch((err) => {
        console.error('Error cargando datos policiales:', err);
      });
  }, []);

  // Efecto: cuando cambia selectedYear o allRecords, recalcular agrupado filtrado
  useEffect(() => {
    let filtered: PoliceRecordMinimal[];
    if (selectedYear === TODOS_ANIOS) {
      filtered = allRecords;
    } else {
      filtered = allRecords.filter((rec) => rec.Año === selectedYear);
    }
    const grouped = agruparPorEstado(filtered);
    setData(grouped);
    // también restablecer vistas especiales (top, 50%) cuando cambies de año
    setLeyenda50(null);
    setLeyendaTop10(null);
    setShowAverageLine(false);
    ordenarPorValor(grouped);
  }, [selectedYear, allRecords]);

  // Efecto: actualizar gráfico cuando sortedData u opciones cambien
  useEffect(() => {
    if (!chartRef.current || sortedData.length === 0) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const minVal = Math.min(...sortedData.map((d) => d.valor));
    const maxVal = Math.max(...sortedData.map((d) => d.valor));

    const getColorGradient = (value: number) => {
      const ratio = (value - minVal) / (maxVal - minVal || 1);
      const r = Math.round(255 * ratio);
      const g = Math.round(200 * (1 - ratio));
      const b = 100;
      return `rgb(${r},${g},${b})`;
    };

    const options =
      chartType === 'bar'
        ? {
            title: {
              text:
                selectedYear === TODOS_ANIOS
                  ? 'Policías asesinados por estado (Todos los años)'
                  : `Policías asesinados por estado en ${selectedYear}`,
            },
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const { name, value } = params[0];
                if (showAsPercentage) {
                  return `${name}<br/>${value.toFixed(2)}%`;
                }
                return `${name}<br/>${value.toLocaleString()} policías asesinados`;
              },
            },
            dataZoom: [
              { type: 'slider', show: false, xAxisIndex: 0, start: 0, end: 100, bottom: 0 },
              { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
            ],
            xAxis: {
              type: 'category',
              data: sortedData.map((d) => d.entidad),
              axisLabel: { rotate: 45, interval: 0 },
            },
            yAxis: {
              type: 'value',
              name: showAsPercentage ? '%' : 'Número de policías',
            },
            series: [
              {
                type: 'bar',
                data: sortedData.map((d) => {
                  const raw = d.valor;
                  const val = showAsPercentage
                    ? parseFloat(((raw * 100) / total).toFixed(2))
                    : raw;
                  return {
                    value: val,
                    itemStyle: {
                      color: useGradientColor ? getColorGradient(raw) : '#5470C6',
                    },
                  };
                }),
                label: {
                  show: true,
                  position: 'top',
                  fontSize: 10,
                  color: '#333',
                  formatter: (val: any) => {
                    return showAsPercentage
                      ? `${val.value.toFixed(2)}%`
                      : val.value.toLocaleString();
                  },
                },
                ...(showAverageLine && !showAsPercentage
                  ? {
                      markLine: {
                        symbol: 'none',
                        data: [
                          {
                            yAxis: promedio,
                            lineStyle: {
                              type: 'dashed',
                              color: 'red',
                              width: 2,
                            },
                          },
                        ],
                      },
                    }
                  : {}),
              },
            ],
          }
        : {
            title: {
              text:
                selectedYear === TODOS_ANIOS
                  ? 'Mapa de árbol: Policías asesinados por estado (Todos los años)'
                  : `Mapa de árbol: Policías asesinados por estado en ${selectedYear}`,
            },
            tooltip: {
              formatter: (params: any) => {
                const { name, value } = params;
                if (showAsPercentage) {
                  return `${name}<br/>${value.toFixed(2)}%`;
                }
                return `${name}<br/>${value.toLocaleString()} policías asesinados`;
              },
            },
            series: [
              {
                type: 'treemap',
                data: sortedData.map((d) => {
                  const raw = d.valor;
                  const val = showAsPercentage
                    ? parseFloat(((raw * 100) / total).toFixed(2))
                    : raw;
                  return {
                    name: d.entidad,
                    value: val,
                    itemStyle: {
                      color: useGradientColor ? getColorGradient(raw) : '#5470C6',
                    },
                  };
                }),
                label: {
                  show: true,
                  formatter: (info: any) =>
                    `${info.name}\n${
                      showAsPercentage
                        ? `${info.value.toFixed(2)}%`
                        : info.value.toLocaleString()
                    }`,
                },
                leafDepth: 1,
                upperLabel: { show: false },
              },
            ],
          };

    chart.setOption(options);

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [
    sortedData,
    chartType,
    showAsPercentage,
    total,
    promedio,
    showAverageLine,
    useGradientColor,
    selectedYear,
  ]);

  // Función para agrupar por estado (contar)
  const agruparPorEstado = (records: PoliceRecordMinimal[]): EstadoCount[] => {
    const map: Record<string, number> = {};
    for (const rec of records) {
      const estado = rec.Estado || 'Desconocido';
      map[estado] = (map[estado] || 0) + 1;
    }
    return Object.entries(map).map(([entidad, valor]) => ({
      entidad,
      valor,
    }));
  };

  // Ordenamientos
  const ordenarPorNombre = () => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    const arr = [...data].sort((a, b) => a.entidad.localeCompare(b.entidad));
    setSortedData(arr);
  };

  const ordenarPorValor = (baseData: EstadoCount[] = data) => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    const arr = [...baseData].sort((a, b) => b.valor - a.valor);
    setSortedData(arr);
  };

  // Funciones especiales
  const mostrarTop10 = () => {
    setLeyenda50(null);
    const top10 = [...data].sort((a, b) => b.valor - a.valor).slice(0, 10);
    const totalTop10 = top10.reduce((sum, item) => sum + item.valor, 0);
    const porcentaje = total > 0 ? parseFloat(((totalTop10 * 100) / total).toFixed(1)) : 0;
    setLeyendaTop10({ total: totalTop10, porcentaje });
    setSortedData(top10);
  };

  const mostrarTop50Porciento = () => {
    setLeyendaTop10(null);
    const ordenados = [...data].sort((a, b) => b.valor - a.valor);
    let acumulado = 0;
    const subset: EstadoCount[] = [];

    for (let i = 0; i < ordenados.length; i++) {
      acumulado += ordenados[i].valor;
      subset.push(ordenados[i]);
      if (acumulado / total >= 0.5) break;
    }
    const porcentaje = total > 0 ? parseFloat(((acumulado * 100) / total).toFixed(1)) : 0;
    setLeyenda50({ entidades: subset.length, porcentaje });
    setSortedData(subset);
  };

  const restablecerVistaOriginal = () => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    setShowAverageLine(false);
    ordenarPorValor(data);
  };

  const handleDownloadImage = () => {
    if (!chartRef.current) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    const base64 = chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    if (base64) {
      const link = document.createElement('a');
      link.href = base64;
      // Incluir año en nombre de archivo si aplica
      const suffix = selectedYear === TODOS_ANIOS ? 'todos' : selectedYear.toString();
      link.download = `policias_estado_${suffix}.png`;
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
    const suffix = selectedYear === TODOS_ANIOS ? 'todos' : selectedYear.toString();
    pdf.save(`policias_estado_${suffix}.pdf`);
  };

  // --- (Parte del render va en la Parte 2) ---

  return (
    <div style={wrapperStyle}>
      {/* Selector de año */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label htmlFor="yearSelect" style={{ marginRight: '0.5rem' }}>Año:</label>
        <select
          id="yearSelect"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          <option value={TODOS_ANIOS}>Todos los años</option>
          {/* Asumimos que los años van de 2018 a 2024 */}
          {Array.from({ length: 2024 - 2018 + 1 }, (_, i) => 2018 + i).map((yr) => (
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </select>
      </div>

      <div style={toolbarStyle}>
        <button onClick={handleDownloadImage} style={buttonStyle} title="Descargar imagen"><FaDownload /></button>
        <button onClick={handleDownloadPDF} style={buttonStyle} title="Descargar PDF"><FaFilePdf /></button>
        <button onClick={ordenarPorNombre} style={buttonStyle} title="Ordenar por estado"><FaSortAlphaDown /></button>
        <button onClick={() => ordenarPorValor()} style={buttonStyle} title="Ordenar por valor"><FaSortAmountDown /></button>
        <button onClick={mostrarTop10} style={buttonStyle} title="Top 10">Top 10</button>
        <button onClick={mostrarTop50Porciento} style={buttonStyle} title="+50%">+50%</button>
        <button onClick={restablecerVistaOriginal} style={buttonStyle} title="Vista original">⟳</button>
        <button onClick={() => setUseGradientColor((prev) => !prev)} style={buttonStyle}>
          {useGradientColor ? 'Gradiente ✔' : 'Gradiente ✘'}
        </button>
        <button
          onClick={() => setChartType((prev) => (prev === 'bar' ? 'treemap' : 'bar'))}
          style={buttonStyle}
          title="Cambiar tipo"
        >
          {chartType === 'bar' ? <FaSitemap /> : <FaChartBar />}
        </button>
        <button onClick={() => setShowAsPercentage((prev) => !prev)} style={buttonStyle} title="Mostrar porcentaje">
          {showAsPercentage ? '%' : '#'}
        </button>
        <button
          onClick={() => {
            setShowAverageLine((prev) => !prev);
            setLeyenda50(null);
            setLeyendaTop10(null);
          }}
          style={buttonStyle}
          title="Mostrar/Ocultar promedio"
        >
          {showAverageLine ? '🔴 Promedio' : '⚪ Promedio'}
        </button>

        <div style={totalBoxStyle}>
          Total: {total.toLocaleString()} policías
        </div>
      </div>

      {showAverageLine && (
        <div style={legendBoxStyle}>
          🔺 {countAbove} entidades por encima · 🔻 {countBelow} por debajo del promedio
        </div>
      )}

      {leyenda50 && !showAverageLine && (
        <div style={legendBoxStyle}>
          {leyenda50.entidades} entidades concentran el {leyenda50.porcentaje}% del total
        </div>
      )}

      {leyendaTop10 && !showAverageLine && (
        <div style={legendBoxStyle}>
          Top 10 entidades acumulan {leyendaTop10.total.toLocaleString()} policías ({leyendaTop10.porcentaje}%)
        </div>
      )}

      <div
        ref={chartRef}
        style={{ width: '100%', height: '500px', minHeight: '300px' }}
      />
    </div>
  );
};

// Estilos CSS-in-JS
const wrapperStyle: React.CSSProperties = {
  position: 'relative',
  padding: '1rem',
  border: '1px solid #ccc',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  background: '#fff',
  marginBottom: '2rem',
  width: '100%',
  boxSizing: 'border-box',
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

const totalBoxStyle: React.CSSProperties = {
  backgroundColor: '#eee',
  color: '#333',
  padding: '4px 10px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
};

const legendBoxStyle: React.CSSProperties = {
  backgroundColor: '#f9f9f9',
  color: '#555',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  marginBottom: '10px',
};

export default PolicemenKilledByStateChart;
