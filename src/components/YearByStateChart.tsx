import * as echarts from 'echarts';
import { useEffect, useRef, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  FaDownload,
  FaFilePdf,
  FaChartBar,
  FaSitemap,
  FaChartLine,
  FaUndo,
} from 'react-icons/fa';

type RecordFull = {
  ID: number;
  Fecha: string;
  Año: number;
  Estado: string;
  Municipio: string;
};

interface YearCount {
  año: number;
  valor: number;
}

const TODOS_ESTADOS = '__TODOS__';
const TODOS_MUNICIPIOS = '__TODOS__';

const PolicemenByYearChart: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  // Estado UI / Datos
  const [allRecords, setAllRecords] = useState<RecordFull[]>([]);
  const [selectedEstado, setSelectedEstado] = useState<string>(TODOS_ESTADOS);
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>(TODOS_MUNICIPIOS);
  const [data, setData] = useState<YearCount[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'treemap' | 'line'>('line');
  const [useGradientColor, setUseGradientColor] = useState<boolean>(true);
  const [showAsPercentage, setShowAsPercentage] = useState(false);

  // 🔥 NUEVO: Toggle para Promedio
  const [showAverageLine, setShowAverageLine] = useState<boolean>(false);

  // Carga
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Totales y promedio
  const total = useMemo(() => data.reduce((s, d) => s + d.valor, 0), [data]);
  const promedioAbs = useMemo(() => (data.length ? total / data.length : 0), [total, data.length]);
  const promedioPct = useMemo(() => (total > 0 ? (promedioAbs / total) * 100 : 0), [promedioAbs, total]);

  // 🔹 Cargar datos
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);

    fetch('/data/DataPolice20182024.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: RecordFull[]) => {
        if (!mounted) return;
        setAllRecords(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando datos:', err);
        if (!mounted) return;
        setLoadError('No se pudieron cargar los datos.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // 🔹 Agrupar por año
  const agruparPorAño = (records: RecordFull[]): YearCount[] => {
    const map: Record<number, number> = {};
    for (const r of records) {
      if (!r.Año) continue;
      map[r.Año] = (map[r.Año] || 0) + 1;
    }
    return Object.entries(map)
      .map(([año, valor]) => ({ año: parseInt(año, 10), valor }))
      .sort((a, b) => a.año - b.año);
  };

  // 🔹 Actualizar `data` según filtros
  useEffect(() => {
    let filtered = allRecords;
    if (selectedEstado !== TODOS_ESTADOS) {
      filtered = filtered.filter((r) => r.Estado === selectedEstado);
    }
    if (selectedMunicipio !== TODOS_MUNICIPIOS) {
      filtered = filtered.filter((r) => r.Municipio === selectedMunicipio);
    }
    setData(agruparPorAño(filtered));
  }, [allRecords, selectedEstado, selectedMunicipio]);

  // 🔹 Si se selecciona municipio, actualizar estado automáticamente
  useEffect(() => {
    if (selectedMunicipio !== TODOS_MUNICIPIOS && selectedEstado === TODOS_ESTADOS) {
      const match = allRecords.find((r) => r.Municipio === selectedMunicipio);
      if (match) setSelectedEstado(match.Estado);
    }
  }, [selectedMunicipio, selectedEstado, allRecords]);

  // 🔹 Renderizar/Actualizar gráfico
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    // Crear instancia si no existe
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(el);
    }
    const chart = chartInstanceRef.current;

    // Si no hay data
    if (!data.length) {
      chart.clear();
      chart.setOption({
        title: { text: 'Sin datos', left: 'center', top: 'middle' },
      } as echarts.EChartsOption);
      return;
    }

    // Helpers de color
    const minVal = Math.min(...data.map((d) => d.valor));
    const maxVal = Math.max(...data.map((d) => d.valor));
    const getColorGradient = (v: number): string => {
      const ratio = (v - minVal) / (maxVal - minVal || 1);
      const r = Math.round(255 * ratio);
      const g = Math.round(200 * (1 - ratio));
      const b = 100;
      return `rgb(${r},${g},${b})`;
    };

    const xAxisData = data.map((d) => d.año.toString());
    const ySeriesData = data.map((d) =>
      showAsPercentage ? parseFloat(((d.valor / (total || 1)) * 100).toFixed(2)) : d.valor
    );

    const baseTitle =
      selectedEstado === TODOS_ESTADOS
        ? selectedMunicipio === TODOS_MUNICIPIOS
          ? 'Policías asesinados por año (Todos los estados)'
          : `Policías asesinados en municipio ${selectedMunicipio}`
        : selectedMunicipio === TODOS_MUNICIPIOS
        ? `Policías asesinados en estado ${selectedEstado}`
        : `Policías asesinados en ${selectedMunicipio}, ${selectedEstado}`;

    // markLine para promedio (solo en bar/line)
    const averageValueForAxis = showAsPercentage ? parseFloat(promedioPct.toFixed(2)) : parseFloat(promedioAbs.toFixed(2));
    const markLine =
      showAverageLine && chartType !== 'treemap'
        ? {
            symbol: 'none',
            label: {
              show: true,
              formatter: () =>
                `Promedio: ${showAsPercentage ? `${averageValueForAxis.toFixed(2)}%` : averageValueForAxis.toFixed(2)}`,
              color: '#222',
            },
            lineStyle: {
              type: 'dashed',
              color: '#d62728',
              width: 2,
            },
            data: [{ yAxis: averageValueForAxis }],
          }
        : undefined;

    const option: echarts.EChartsOption =
      chartType === 'treemap'
        ? {
            title: { text: baseTitle, left: 'center' },
            tooltip: {
              formatter: (p: any) =>
                `${p.name}: ${
                  showAsPercentage ? `${Number(p.value).toFixed(2)}%` : Number(p.value).toLocaleString()
                }`,
            },
            series: [
              {
                type: 'treemap',
                roam: false,
                breadcrumb: { show: false },
                data: data.map((d, idx) => ({
                  name: d.año.toString(),
                  value: ySeriesData[idx],
                  itemStyle: {
                    color: useGradientColor ? getColorGradient(d.valor) : '#5470C6',
                  },
                })),
                label: {
                  show: true,
                  formatter: (info: any) =>
                    `${info.name}\n${
                      showAsPercentage ? `${Number(info.value).toFixed(2)}%` : Number(info.value).toLocaleString()
                    }`,
                },
              },
            ],
          }
        : {
            title: { text: baseTitle, left: 'center' },
            tooltip: {
              trigger: 'axis',
              valueFormatter: (val: any) =>
                showAsPercentage ? `${Number(val).toFixed(2)}%` : Number(val).toLocaleString(),
            },
            xAxis: { type: 'category', data: xAxisData },
            yAxis: {
              type: 'value',
              name: showAsPercentage ? '%' : 'Número de policías',
            },
            series: [
              {
                type: chartType,
                data: ySeriesData,
                smooth: chartType === 'line',
                itemStyle: {
                  color: (params: any) => {
                    const v = data[params.dataIndex].valor;
                    return useGradientColor ? getColorGradient(v) : '#5470C6';
                  },
                },
                label: {
                  show: true,
                  position: 'top',
                  fontSize: 10,
                  color: '#333',
                  formatter: (val: any) =>
                    showAsPercentage ? `${Number(val.value).toFixed(2)}%` : Number(val.value).toLocaleString(),
                },
                markLine, // puede ser undefined y ECharts lo ignora
              },
            ],
            grid: { top: 60, right: 20, left: 50, bottom: 40 },
          };

    chart.clear(); // asegura que no queden restos al cambiar tipo
    chart.setOption(option);

    // Resize
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [
    data,
    selectedEstado,
    selectedMunicipio,
    chartType,
    useGradientColor,
    showAsPercentage,
    showAverageLine,
    total,
    promedioAbs,
    promedioPct,
  ]);

  // 🔹 Descargar imagen/PDF
  const handleDownload = async (type: 'png' | 'pdf') => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const img = canvas.toDataURL('image/png');
    const est = selectedEstado !== TODOS_ESTADOS ? selectedEstado : 'todos';
    const mun = selectedMunicipio !== TODOS_MUNICIPIOS ? selectedMunicipio : 'todos';
    if (type === 'png') {
      const link = document.createElement('a');
      link.href = img;
      link.download = `policias_${est}_${mun}.png`;
      link.click();
    } else {
      const pdf = new jsPDF();
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, 'PNG', 0, 10, w, h);
      pdf.save(`policias_${est}_${mun}.pdf`);
    }
  };

  // 🔹 Reset
  const handleReset = () => {
    setSelectedEstado(TODOS_ESTADOS);
    setSelectedMunicipio(TODOS_MUNICIPIOS);
    setChartType('line');
    setUseGradientColor(true);
    setShowAsPercentage(false);
    setShowAverageLine(false);
  };

  // Opciones selects
  const estadosOptions = useMemo(() => {
    const setEst = new Set(allRecords.map((r) => r.Estado));
    return Array.from(setEst).sort();
  }, [allRecords]);

  const municipiosOptions = useMemo(() => {
    let filtered = allRecords;
    if (selectedEstado !== TODOS_ESTADOS) {
      filtered = filtered.filter((r) => r.Estado === selectedEstado);
    }
    const setMun = new Set(filtered.map((r) => r.Municipio));
    return Array.from(setMun).sort();
  }, [allRecords, selectedEstado]);

  // Limpieza al desmontar (dispose de ECharts)
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div style={wrapperStyle}>
      {/* Estado de carga / error */}
      {loading && <div style={{ marginBottom: 8 }}>Cargando datos…</div>}
      {loadError && <div style={{ color: 'crimson', marginBottom: 8 }}>{loadError}</div>}

      {/* Filtros */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '10px',
          alignItems: 'center',
        }}
      >
        <label>Estado:</label>
        <select
          value={selectedEstado}
          onChange={(e) => {
            setSelectedEstado(e.target.value);
            setSelectedMunicipio(TODOS_MUNICIPIOS);
          }}
        >
          <option value={TODOS_ESTADOS}>Todos</option>
          {estadosOptions.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <label>Municipio:</label>
        <select value={selectedMunicipio} onChange={(e) => setSelectedMunicipio(e.target.value)}>
          <option value={TODOS_MUNICIPIOS}>Todos</option>
          {municipiosOptions.map((mun) => (
            <option key={mun} value={mun}>
              {mun}
            </option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
          Total: {total.toLocaleString()}{' '}
          {showAsPercentage ? '' : `· Promedio: ${promedioAbs.toFixed(2)}`}
        </div>
      </div>

      {/* Toolbar */}
      <div style={toolbarStyle}>
        <button onClick={() => handleDownload('png')} style={buttonStyle} title="Descargar PNG">
          <FaDownload />
        </button>
        <button onClick={() => handleDownload('pdf')} style={buttonStyle} title="Descargar PDF">
          <FaFilePdf />
        </button>
        <button onClick={() => setChartType('bar')} style={buttonStyle} title="Barras">
          <FaChartBar />
        </button>
        <button onClick={() => setChartType('line')} style={buttonStyle} title="Línea">
          <FaChartLine />
        </button>
        <button onClick={() => setChartType('treemap')} style={buttonStyle} title="Treemap">
          <FaSitemap />
        </button>
        <button onClick={handleReset} style={buttonStyle} title="Resetear">
          <FaUndo />
        </button>

        <button onClick={() => setUseGradientColor((v) => !v)} style={buttonStyle} title="Color por gradiente">
          {useGradientColor ? 'Gradiente ✔' : 'Gradiente ✘'}
        </button>

        <button onClick={() => setShowAsPercentage((v) => !v)} style={buttonStyle} title="Mostrar como porcentaje del total">
          {showAsPercentage ? '% ✔' : '#'}
        </button>

        <button
          onClick={() => setShowAverageLine((v) => !v)}
          style={{ ...buttonStyle, opacity: chartType === 'treemap' ? 0.5 : 1, cursor: chartType === 'treemap' ? 'not-allowed' : 'pointer' }}
          title={chartType === 'treemap' ? 'No disponible en treemap' : 'Mostrar/Ocultar promedio'}
          disabled={chartType === 'treemap'}
        >
          {showAverageLine ? 'Promedio ✔' : 'Promedio ✘'}
        </button>
      </div>

      <div ref={chartRef} style={{ width: '100%', height: '500px', minHeight: '300px' }} />
    </div>
  );
};

// Estilos
const wrapperStyle: React.CSSProperties = {
  padding: '1rem',
  border: '1px solid #ccc',
  borderRadius: '8px',
  background: '#fff',
  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: '8px',
  marginBottom: '10px',
  alignItems: 'center',
};

const buttonStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '14px',
  padding: '6px 8px',
  background: 'none',
};

export default PolicemenByYearChart;
