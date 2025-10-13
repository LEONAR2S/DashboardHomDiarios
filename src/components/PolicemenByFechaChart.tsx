import * as echarts from 'echarts';
import { useEffect, useRef, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  FaDownload,
  FaFilePdf,
  FaChartBar,
  FaChartLine,
  FaSitemap,
  FaUndo,
} from 'react-icons/fa';

type RecordFull = {
  ID: number;
  Fecha: string; // e.g. "2024-07-07"
  Año: number;
  Trim: string;
  Mes: string;
  Semana: string;
  Estado: string;
  Municipio: string;
  [key: string]: any;
};

interface FechaCount {
  fecha: string;
  valor: number;
}

interface EstadoCount {
  estado: string;
  valor: number;
}

const TODOS_ESTADOS = "__TODOS__";
const TODOS_MUNICIPIOS = "__TODOS__";
const TODOS_AÑOS = 0;

const PolicemenByFechaChart: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [allRecords, setAllRecords] = useState<RecordFull[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(TODOS_AÑOS);
  const [selectedEstado, setSelectedEstado] = useState<string>(TODOS_ESTADOS);
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>(TODOS_MUNICIPIOS);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const [dataByDate, setDataByDate] = useState<FechaCount[]>([]);
  const [dataByEstado, setDataByEstado] = useState<EstadoCount[]>([]);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'treemap'>('line');
  const [useGradientColor, setUseGradientColor] = useState<boolean>(true);
  const [showAsPercentage, setShowAsPercentage] = useState(false);

  const totalByDate = useMemo(() => dataByDate.reduce((s, d) => s + d.valor, 0), [dataByDate]);
  const totalByEstado = useMemo(() => dataByEstado.reduce((s, d) => s + d.valor, 0), [dataByEstado]);

  // Carga datos inicial
  useEffect(() => {
    fetch('/data/DataPolice20182024.json')
      .then((res) => res.json())
      .then((json: RecordFull[]) => {
        setAllRecords(json);
      })
      .catch((err) => console.error('Error cargando datos:', err));
  }, []);

  // Agrupar por fecha
  const agruparPorFecha = (records: RecordFull[]): FechaCount[] => {
    const map: Record<string, number> = {};
    for (const r of records) {
      if (!r.Fecha) continue;
      map[r.Fecha] = (map[r.Fecha] || 0) + 1;
    }
    return Object.entries(map)
      .map(([fecha, valor]) => ({ fecha, valor }))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  };

  // Agrupar por estado para una fecha elegida
  const agruparPorEstado = (records: RecordFull[]): EstadoCount[] => {
    const map: Record<string, number> = {};
    for (const r of records) {
      const est = r.Estado || TODOS_ESTADOS;
      map[est] = (map[est] || 0) + 1;
    }
    return Object.entries(map)
      .map(([estado, valor]) => ({ estado, valor }))
      .sort((a, b) => b.valor - a.valor);
  };

  // Efecto para calcular data según filtros
  useEffect(() => {
    let filtered = allRecords;

    if (selectedYear !== TODOS_AÑOS) {
      filtered = filtered.filter((r) => r.Año === selectedYear);
    }
    if (selectedEstado !== TODOS_ESTADOS) {
      filtered = filtered.filter((r) => typeof r.Estado === 'string' && r.Estado === selectedEstado);
    }
    if (selectedMunicipio !== TODOS_MUNICIPIOS) {
      filtered = filtered.filter((r) => typeof r.Municipio === 'string' && r.Municipio === selectedMunicipio);
    }

    // Siempre generar fechas
    const groupedDates = agruparPorFecha(filtered);
    setDataByDate(groupedDates);

    // Si seleccionaste fecha, generar estados solo para esa fecha
    if (selectedDate) {
      const recsFecha = filtered.filter((r) => r.Fecha === selectedDate);
      const groupedEstados = agruparPorEstado(recsFecha);
      setDataByEstado(groupedEstados);

      // Ajustar selects de estado/municipio para esa fecha:
      // Los estados disponibles:
      const estadosSet = new Set(recsFecha.map((r) => r.Estado));
      if (!estadosSet.has(selectedEstado)) {
        // Si el estado actualmente seleccionado no está en esa fecha, resetearlo
        setSelectedEstado(TODOS_ESTADOS);
        setSelectedMunicipio(TODOS_MUNICIPIOS);
      }
    } else {
      // Si no hay fecha seleccionada, vaciar dataByEstado
      setDataByEstado([]);
    }
  }, [allRecords, selectedDate, selectedYear, selectedEstado, selectedMunicipio]);

  // React al cambiar municipio para ajustar estado
  useEffect(() => {
    if (selectedMunicipio !== TODOS_MUNICIPIOS && selectedEstado === TODOS_ESTADOS) {
      const match = allRecords.find((r) => r.Municipio === selectedMunicipio);
      if (match) {
        setSelectedEstado(match.Estado);
      }
    }
  }, [selectedMunicipio, selectedEstado, allRecords]);

  // Datos disponibles para los dropdowns cuando fecha está seleccionada
  const estadosParaFecha = useMemo(() => {
    if (!selectedDate) return Array.from(new Set(allRecords.map((r) => r.Estado)));
    const recsFecha = allRecords.filter((r) => r.Fecha === selectedDate);
    return Array.from(new Set(recsFecha.map((r) => r.Estado))).sort();
  }, [allRecords, selectedDate]);

  const municipiosParaFecha = useMemo(() => {
    if (!selectedDate) {
      // Si no hay fecha, municipios normales con filtro de estado
      let recs = allRecords;
      if (selectedEstado !== TODOS_ESTADOS) {
        recs = recs.filter((r) => r.Estado === selectedEstado);
      }
      return Array.from(new Set(recs.map((r) => r.Municipio))).sort();
    }
    // Si hay fecha seleccionada, solo municipios en esa fecha y en el estado (si estado seleccionado)
    const recsFecha = allRecords.filter((r) => r.Fecha === selectedDate);
    let recs = recsFecha;
    if (selectedEstado !== TODOS_ESTADOS) {
      recs = recs.filter((r) => r.Estado === selectedEstado);
    }
    return Array.from(new Set(recs.map((r) => r.Municipio))).sort();
  }, [allRecords, selectedDate, selectedEstado]);

  // Render del gráfico
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    if (selectedDate && dataByEstado.length > 0) {
      // Modo: por estados en esa fecha
      const states = dataByEstado.map((d) => d.estado);
      const values = dataByEstado.map((d) =>
        showAsPercentage
          ? parseFloat(((d.valor * 100) / (totalByEstado || 1)).toFixed(2))
          : d.valor
      );

      const minVal = Math.min(...dataByEstado.map((d) => d.valor));
      const maxVal = Math.max(...dataByEstado.map((d) => d.valor));
const getColorGradient = (v: number) => {
  if (isNaN(v)) return '#ccc'; // fallback seguro
  if (maxVal === minVal) return 'rgb(100,150,200)'; // si todos los valores son iguales

  const ratio = Math.min(Math.max((v - minVal) / (maxVal - minVal), 0), 1);
  const r = Math.round(255 * ratio);
  const g = Math.round(200 * (1 - ratio));
  const b = 100;
  return `rgb(${r},${g},${b})`;
};

      const option: echarts.EChartsOption = {
        title: { text: `Estados con eventos el ${selectedDate}`, left: 'center' },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            const it = params[0];
            return `${it.name}: ${it.value}`;
          },
        },
        xAxis: {
          type: 'category',
          data: states,
          axisLabel: { rotate: 45, interval: 0 },
        },
        yAxis: {
          type: 'value',
          name: showAsPercentage ? '%' : 'Cantidad',
        },
        dataZoom: [
          { type: 'slider', xAxisIndex: 0, start: 0, end: 100 },
          { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
        ],
        series: [
          {
            type: 'bar',
            data: values,
            itemStyle: {
              color: (params: any) => {
                const v = dataByEstado[params.dataIndex].valor;
                return useGradientColor ? getColorGradient(v) : '#5470C6';
              },
            },
            label: {
              show: true,
              position: 'top',
              formatter: (val: any) =>
                showAsPercentage ? `${val.value.toFixed(2)}%` : val.value.toLocaleString(),
            },
          },
        ],
      };

      chart.setOption(option);
      const handleResize = () => chart.resize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    // Modo general: fechas
    if (dataByDate.length === 0) {
      chart.clear();
      return;
    }

    const fechas = dataByDate.map((d) => d.fecha);
    const valuesDate = dataByDate.map((d) =>
      showAsPercentage
        ? parseFloat(((d.valor * 100) / (totalByDate || 1)).toFixed(2))
        : d.valor
    );

    const minVal = Math.min(...dataByDate.map((d) => d.valor));
    const maxVal = Math.max(...dataByDate.map((d) => d.valor));
    const getColorGradient = (v: number) => {
      const ratio = (v - minVal) / ((maxVal - minVal) || 1);
      const r = Math.round(255 * ratio);
      const g = Math.round(200 * (1 - ratio));
      const b = 100;
      return `rgb(${r},${g},${b})`;
    };

    const titleText =
      selectedYear !== TODOS_AÑOS
        ? `Fechas en año ${selectedYear}`
        : selectedEstado === TODOS_ESTADOS
        ? selectedMunicipio === TODOS_MUNICIPIOS
          ? 'Policías por fecha (todos los años)'
          : `Policías en municipio ${selectedMunicipio}`
        : selectedMunicipio === TODOS_MUNICIPIOS
          ? `Policías en estado ${selectedEstado}`
          : `Policías en ${selectedMunicipio}, ${selectedEstado}`;

    let option: echarts.EChartsOption;
    if (chartType === 'treemap') {
      option = {
        title: { text: titleText, left: 'center' },
        tooltip: { formatter: (p: any) => `${p.name}: ${p.value}` },
        series: [
          {
            type: 'treemap',
            data: dataByDate.map((d) => ({
              name: d.fecha,
              value: showAsPercentage
                ? parseFloat(((d.valor * 100) / (totalByDate || 1)).toFixed(2))
                : d.valor,
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
      };
    } else {
      option = {
        title: { text: titleText, left: 'center' },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            const it = params[0];
            return `${it.name}: ${it.value}`;
          },
        },
        xAxis: {
          type: 'category',
          data: fechas,
          axisLabel: {
            rotate: 45,
            interval: 0,
          },
        },
        yAxis: {
          type: 'value',
          name: showAsPercentage ? '%' : 'Cantidad',
        },
        dataZoom: [
          { type: 'slider', xAxisIndex: 0, start: 0, end: 100 },
          { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
        ],
        series: [
          {
            type: chartType,
            data: valuesDate,
            smooth: chartType === 'line',
            itemStyle: {
              color: (params: any) => {
                const v = dataByDate[params.dataIndex].valor;
                return useGradientColor ? getColorGradient(v) : '#5470C6';
              },
            },
            label: {
              show: true,
              position: 'top',
              formatter: (val: any) =>
                showAsPercentage ? `${val.value.toFixed(2)}%` : val.value.toLocaleString(),
            },
          },
        ],
      };
    }

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [
    dataByDate,
    dataByEstado,
    selectedDate,
    selectedYear,
    selectedEstado,
    selectedMunicipio,
    chartType,
    useGradientColor,
    showAsPercentage,
    totalByDate,
    totalByEstado,
  ]);

  const handleDownload = async (type: 'png' | 'pdf') => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const img = canvas.toDataURL('image/png');
    const est = selectedEstado !== TODOS_ESTADOS ? selectedEstado : 'todos';
    const mun = selectedMunicipio !== TODOS_MUNICIPIOS ? selectedMunicipio : 'todos';
    const yr = selectedYear !== TODOS_AÑOS ? selectedYear.toString() : 'todos';
    const dateSuffix = selectedDate || 'all';
    if (type === 'png') {
      const link = document.createElement('a');
      link.href = img;
      link.download = `policias_estado_${dateSuffix}_${yr}_${est}_${mun}.png`;
      link.click();
    } else {
      const pdf = new jsPDF();
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, 'PNG', 0, 10, w, h);
      pdf.save(`policias_estado_${dateSuffix}_${yr}_${est}_${mun}.pdf`);
    }
  };

  const handleReset = () => {
    setSelectedDate("");
    setSelectedYear(TODOS_AÑOS);
    setSelectedEstado(TODOS_ESTADOS);
    setSelectedMunicipio(TODOS_MUNICIPIOS);
    setChartType('line');
    setUseGradientColor(true);
    setShowAsPercentage(false);
  };

  const yearsOptions = useMemo(() => {
    const s = new Set(allRecords.map((r) => r.Año));
    return Array.from(s).sort((a, b) => a - b);
  }, [allRecords]);

  return (
    <div style={wrapperStyle}>
      {/* Controles de filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
        <label>Fecha específica:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            // cuando seleccionas fecha, reinicia estado y municipio para recargar opciones
            setSelectedEstado(TODOS_ESTADOS);
            setSelectedMunicipio(TODOS_MUNICIPIOS);
          }}
        />

        <label>Año:</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          disabled={!!selectedDate}
        >
          <option value={TODOS_AÑOS}>Todos</option>
          {yearsOptions.map((yr) => (
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </select>

        <label>Estado:</label>
        <select
          value={selectedEstado}
          onChange={(e) => {
            setSelectedEstado(e.target.value);
            setSelectedMunicipio(TODOS_MUNICIPIOS);
          }}
        >
          <option value={TODOS_ESTADOS}>Todos</option>
          {estadosParaFecha.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>

        <label>Municipio:</label>
        <select
          value={selectedMunicipio}
          onChange={(e) => setSelectedMunicipio(e.target.value)}
        >
          <option value={TODOS_MUNICIPIOS}>Todos</option>
          {municipiosParaFecha.map((mun) => (
            <option key={mun} value={mun}>{mun}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
          Total: {(selectedDate ? totalByEstado : totalByDate).toLocaleString()}
        </div>
      </div>

      {/* Botones */}
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
        <button onClick={() => setUseGradientColor(!useGradientColor)} style={buttonStyle} title="Alternar gradiente">
          {useGradientColor ? 'Gradiente ✔' : 'Gradiente ✘'}
        </button>
        <button onClick={() => setShowAsPercentage(!showAsPercentage)} style={buttonStyle} title="Mostrar porcentaje">
          {showAsPercentage ? '%' : '#'}
        </button>
      </div>

      {/* Gráfico */}
      <div ref={chartRef} style={{ width: '100%', height: '500px', minHeight: '300px' }} />
    </div>
  );
};

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

export default PolicemenByFechaChart;
