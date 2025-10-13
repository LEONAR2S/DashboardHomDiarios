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
  Fecha: string;
  Año: number;
  Trim: string;
  Mes: string;
  Semana: string; // e.g. "Sem 28 (08 jul - 14 jul)"
  Estado: string;
  Municipio: string;
  [key: string]: any;
};

interface SemanaCount {
  label: string;         // e.g. "2024 Sem 28 (08 jul - 14 jul)"
  año: number;
  numeroSemana: number;
  valor: number;
}

const TODOS_ESTADOS = "__TODOS__";
const TODOS_MUNICIPIOS = "__TODOS__";
const TODOS_AÑOS = 0;

const PolicemenBySemanaChart: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [allRecords, setAllRecords] = useState<RecordFull[]>([]);
  const [selectedEstado, setSelectedEstado] = useState<string>(TODOS_ESTADOS);
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>(TODOS_MUNICIPIOS);
  const [selectedYear, setSelectedYear] = useState<number>(TODOS_AÑOS);

  const [data, setData] = useState<SemanaCount[]>([]);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'treemap'>('line');
  const [useGradientColor, setUseGradientColor] = useState<boolean>(true);
  const [showAsPercentage, setShowAsPercentage] = useState(false);

  const total = useMemo(() => data.reduce((sum, d) => sum + d.valor, 0), [data]);

  useEffect(() => {
    fetch('/data/DataPolice20182024.json')
      .then((res) => res.json())
      .then((json: RecordFull[]) => {
        setAllRecords(json);
      })
      .catch((err) => {
        console.error('Error al cargar datos:', err);
      });
  }, []);

  // Agrupar por año + semana (incluyendo rango de días)
  const agruparPorSemana = (records: RecordFull[]): SemanaCount[] => {
    const map: Record<
      string,
      { año: number; numeroSemana: number; semanaLabel: string; valor: number }
    > = {};
    for (const r of records) {
      if (typeof r.Año !== 'number' || !r.Semana) continue;
      const match = r.Semana.match(/^Sem\s*(\d+)/);
      const numSem = match ? parseInt(match[1], 10) : 0;
      const key = `${r.Año}|${numSem}`;
      if (!map[key]) {
        map[key] = {
          año: r.Año,
          numeroSemana: numSem,
          semanaLabel: r.Semana,
          valor: 0,
        };
      }
      map[key].valor += 1;
    }
    return Object.entries(map)
.map(([, rec]) => ({
  label: `${rec.año} ${rec.semanaLabel}`,
  año: rec.año,
  numeroSemana: rec.numeroSemana,
  valor: rec.valor,
}))
      .sort((a, b) => {
        if (a.año !== b.año) return a.año - b.año;
        return a.numeroSemana - b.numeroSemana;
      });
  };

  useEffect(() => {
    let filtered = allRecords;

    if (selectedYear !== TODOS_AÑOS) {
      filtered = filtered.filter((r) => r.Año === selectedYear);
    }
    if (selectedEstado !== TODOS_ESTADOS) {
      filtered = filtered.filter((r) => r.Estado === selectedEstado);
    }
    if (selectedMunicipio !== TODOS_MUNICIPIOS) {
      filtered = filtered.filter((r) => r.Municipio === selectedMunicipio);
    }

    const grouped = agruparPorSemana(filtered);
    setData(grouped);
  }, [allRecords, selectedYear, selectedEstado, selectedMunicipio]);

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

  useEffect(() => {
    if (!chartRef.current) return;
    if (data.length === 0) {
      chartInstanceRef.current?.clear();
      return;
    }

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const minVal = Math.min(...data.map((d) => d.valor));
    const maxVal = Math.max(...data.map((d) => d.valor));
    const getColorGradient = (v: number): string => {
      const ratio = (v - minVal) / ((maxVal - minVal) || 1);
      const r = Math.round(255 * ratio);
      const g = Math.round(200 * (1 - ratio));
      const b = 100;
      return `rgb(${r},${g},${b})`;
    };

    const xAxisData = data.map((d) => d.label);
    const ySeriesData = data.map((d) =>
      showAsPercentage
        ? parseFloat(((d.valor * 100) / (total || 1)).toFixed(2))
        : d.valor
    );

    const titleText =
      selectedYear !== TODOS_AÑOS
        ? `Semanas del año ${selectedYear}`
        : selectedEstado === TODOS_ESTADOS
          ? selectedMunicipio === TODOS_MUNICIPIOS
            ? 'Policías asesinados por semana (todos los años)'
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
            data: data.map((d) => ({
              name: d.label,
              value: showAsPercentage
                ? parseFloat(((d.valor * 100) / (total || 1)).toFixed(2))
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
            const item = params[0];
            return `${item.name}: ${item.value}`;
          },
        },
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisLabel: {
            rotate: 45,
            interval: 0,
          },
        },
        yAxis: {
          type: 'value',
          name: showAsPercentage ? '%' : 'Número de policías',
        },
        dataZoom: [
          { type: 'slider', xAxisIndex: 0, start: 0, end: 100 },
          { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
        ],
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
    }

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [
    data,
    selectedYear,
    selectedEstado,
    selectedMunicipio,
    chartType,
    useGradientColor,
    showAsPercentage,
    total,
  ]);

  const handleDownload = async (type: 'png' | 'pdf') => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const img = canvas.toDataURL('image/png');
    const est = selectedEstado !== TODOS_ESTADOS ? selectedEstado : 'todos';
    const mun = selectedMunicipio !== TODOS_MUNICIPIOS ? selectedMunicipio : 'todos';
    const yr = selectedYear !== TODOS_AÑOS ? selectedYear.toString() : 'todos';
    if (type === 'png') {
      const link = document.createElement('a');
      link.href = img;
      link.download = `policias_semana_${yr}_${est}_${mun}.png`;
      link.click();
    } else {
      const pdf = new jsPDF();
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, 'PNG', 0, 10, w, h);
      pdf.save(`policias_semana_${yr}_${est}_${mun}.pdf`);
    }
  };

  const handleReset = () => {
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

  const estadosOptions = useMemo(() => {
    const s = new Set(allRecords.map((r) => r.Estado));
    return Array.from(s).sort();
  }, [allRecords]);

  const municipiosOptions = useMemo(() => {
    let recs = allRecords;
    if (selectedEstado !== TODOS_ESTADOS) {
      recs = recs.filter((r) => r.Estado === selectedEstado);
    }
    const s = new Set(recs.map((r) => r.Municipio));
    return Array.from(s).sort();
  }, [allRecords, selectedEstado]);

  return (
    <div style={wrapperStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
        <label>Año:</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          <option value={TODOS_AÑOS}>Todos</option>
          {yearsOptions.map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
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

export default PolicemenBySemanaChart;
