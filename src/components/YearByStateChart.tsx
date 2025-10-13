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

const TODOS_ESTADOS = "__TODOS__";
const TODOS_MUNICIPIOS = "__TODOS__";

const PolicemenByYearChart: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [allRecords, setAllRecords] = useState<RecordFull[]>([]);
  const [selectedEstado, setSelectedEstado] = useState<string>(TODOS_ESTADOS);
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>(TODOS_MUNICIPIOS);
  const [data, setData] = useState<YearCount[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'treemap' | 'line'>('line'); // ✅ Línea por defecto
  const [useGradientColor, setUseGradientColor] = useState<boolean>(true);
  const [showAsPercentage, setShowAsPercentage] = useState(false);

  const total = useMemo(() => data.reduce((s, d) => s + d.valor, 0), [data]);

  // 🔹 Cargar datos
  useEffect(() => {
    fetch('/data/DataPolice20182024.json')
      .then((res) => res.json())
      .then((json: RecordFull[]) => {
        setAllRecords(json);
      })
      .catch((err) => {
        console.error('Error cargando datos:', err);
      });
  }, []);

  // 🔹 Agrupar por año
  const agruparPorAño = (records: RecordFull[]): YearCount[] => {
    const map: Record<number, number> = {};
    for (const r of records) {
      if (!r.Año) continue;
      map[r.Año] = (map[r.Año] || 0) + 1;
    }
    return Object.entries(map)
      .map(([año, valor]) => ({ año: parseInt(año), valor }))
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
    const grouped = agruparPorAño(filtered);
    setData(grouped);
  }, [allRecords, selectedEstado, selectedMunicipio]);

  // 🔹 Si se selecciona municipio, actualizar estado automáticamente
  useEffect(() => {
    if (
      selectedMunicipio !== TODOS_MUNICIPIOS &&
      selectedEstado === TODOS_ESTADOS
    ) {
      const match = allRecords.find((r) => r.Municipio === selectedMunicipio);
      if (match) {
        setSelectedEstado(match.Estado);
      }
    }
  }, [selectedMunicipio, selectedEstado, allRecords]);

  // 🔹 Renderizar gráfico
  useEffect(() => {
    if (!chartRef.current || data.length === 0) {
      chartInstanceRef.current?.clear();
      return;
    }

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

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
      showAsPercentage
        ? parseFloat(((d.valor * 100) / (total || 1)).toFixed(2))
        : d.valor
    );

    const baseTitle =
      selectedEstado === TODOS_ESTADOS
        ? selectedMunicipio === TODOS_MUNICIPIOS
          ? 'Policías asesinados por año (Todos los estados)'
          : `Policías asesinados en municipio ${selectedMunicipio}`
        : selectedMunicipio === TODOS_MUNICIPIOS
        ? `Policías asesinados en estado ${selectedEstado}`
        : `Policías asesinados en ${selectedMunicipio}, ${selectedEstado}`;

    const option: echarts.EChartsOption =
      chartType === 'treemap'
        ? {
            title: { text: baseTitle, left: 'center' },
            tooltip: { formatter: (p: any) => `${p.name}: ${p.value}` },
            series: [
              {
                type: 'treemap',
                data: data.map((d) => ({
                  name: d.año.toString(),
                  value: ySeriesData[data.findIndex((x) => x.año === d.año)],
                  itemStyle: {
                    color: useGradientColor
                      ? getColorGradient(d.valor)
                      : '#5470C6',
                  },
                })),
                label: {
                  show: true,
                  formatter: (info: any) =>
                    `${info.name}\n${
                      showAsPercentage
                        ? `${info.value.toFixed(2)}%`
                        : info.value.toLocaleString()
                    }`,
                },
              },
            ],
          }
        : {
            title: { text: baseTitle, left: 'center' },
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) =>
                `${params[0].name}: ${params[0].value}`,
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
                    showAsPercentage
                      ? `${val.value.toFixed(2)}%`
                      : val.value.toLocaleString(),
                },
              },
            ],
          };

    chart.setOption(option);

    // ✅ CORREGIDO: Resize handler
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
    total,
  ]);

  // 🔹 Descargar imagen
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

  const handleReset = () => {
    setSelectedEstado(TODOS_ESTADOS);
    setSelectedMunicipio(TODOS_MUNICIPIOS);
    setChartType('line');
    setUseGradientColor(true);
    setShowAsPercentage(false);
  };

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

  return (
    <div style={wrapperStyle}>
      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
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
            <option key={st} value={st}>{st}</option>
          ))}
        </select>

        <label>Municipio:</label>
        <select
          value={selectedMunicipio}
          onChange={(e) => setSelectedMunicipio(e.target.value)}
        >
          <option value={TODOS_MUNICIPIOS}>Todos</option>
          {municipiosOptions.map((mun) => (
            <option key={mun} value={mun}>{mun}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
          Total: {total.toLocaleString()}
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
        <button onClick={() => setUseGradientColor(!useGradientColor)} style={buttonStyle}>
          {useGradientColor ? 'Gradiente ✔' : 'Gradiente ✘'}
        </button>
        <button onClick={() => setShowAsPercentage(!showAsPercentage)} style={buttonStyle}>
          {showAsPercentage ? '%' : '#'}
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
