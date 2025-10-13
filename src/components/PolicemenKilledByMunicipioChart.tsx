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
  FaSearch,
} from 'react-icons/fa';

type PoliceRecordMinimal = {
  Estado: string;
  Municipio: string;
  ID: number;
  Año: number;
};

interface MunicipioCount {
  municipio: string;
  estado: string;
  valor: number;
}

const TODOS_ANIOS = 0;
const TODOS_ESTADOS = "__TODOS__";

const PolicemenKilledByMunicipioChart: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [allRecords, setAllRecords] = useState<PoliceRecordMinimal[]>([]);
  const [data, setData] = useState<MunicipioCount[]>([]);
  const [sortedData, setSortedData] = useState<MunicipioCount[]>([]);

  const [selectedYear, setSelectedYear] = useState<number>(TODOS_ANIOS);
  const [selectedEstado, setSelectedEstado] = useState<string>(TODOS_ESTADOS);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [chartType, setChartType] = useState<'bar' | 'treemap'>('bar');
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [showAverageLine, setShowAverageLine] = useState(false);
  // Gradiente activado por defecto:
  const [useGradientColor, setUseGradientColor] = useState<boolean>(true);

  const [leyenda50, setLeyenda50] = useState<{ entidades: number; porcentaje: number } | null>(null);
  const [leyendaTop10, setLeyendaTop10] = useState<{ total: number; porcentaje: number } | null>(null);

  const total = useMemo(() => data.reduce((sum, d) => sum + d.valor, 0), [data]);
  const promedio = useMemo(() => (data.length > 0 ? total / data.length : 0), [total, data]);
  const countAbove = useMemo(() => data.filter((d) => d.valor > promedio).length, [data, promedio]);
  const countBelow = useMemo(() => data.filter((d) => d.valor < promedio).length, [data, promedio]);

  // Cargar datos
  useEffect(() => {
    fetch('/data/DataPolice20182024.json')
      .then((res) => res.json())
      .then((json: PoliceRecordMinimal[]) => {
        setAllRecords(json);
        const grouped = agruparPorMunicipio(json);
        setData(grouped);
        ordenarPorValor(grouped);
      })
      .catch((err) => {
        console.error('Error cargando datos municipales:', err);
      });
  }, []);

  // Filtrar por año + estado
  useEffect(() => {
    let filtered = allRecords;
    if (selectedYear !== TODOS_ANIOS) {
      filtered = filtered.filter((r) => r.Año === selectedYear);
    }
    if (selectedEstado !== TODOS_ESTADOS) {
      filtered = filtered.filter((r) => r.Estado === selectedEstado);
    }
    const grouped = agruparPorMunicipio(filtered);
    setData(grouped);
    setLeyenda50(null);
    setLeyendaTop10(null);
    setShowAverageLine(false);
    ordenarPorValor(grouped);
  }, [allRecords, selectedYear, selectedEstado]);

  // Filtrar por término de búsqueda
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) {
      return sortedData;
    }
    const lower = searchTerm.toLowerCase();
    return sortedData.filter((d) => d.municipio.toLowerCase().includes(lower));
  }, [searchTerm, sortedData]);

  // Render del gráfico con ECharts
  useEffect(() => {
    if (!chartRef.current || filteredData.length === 0) {
      return;
    }
    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const minVal = Math.min(...filteredData.map((d) => d.valor));
    const maxVal = Math.max(...filteredData.map((d) => d.valor));

    const getColorGradient = (v: number): string => {
      const ratio = (v - minVal) / (maxVal - minVal || 1);
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
                  ? selectedEstado === TODOS_ESTADOS
                    ? 'Policías asesinados por municipio (Todos los años)'
                    : `Municipios de ${selectedEstado} (Todos los años)`
                  : selectedEstado === TODOS_ESTADOS
                  ? `Policías asesinados por municipio en ${selectedYear}`
                  : `Municipios de ${selectedEstado} en ${selectedYear}`,
            },
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const idx = params[0].dataIndex;
                const item = filteredData[idx];
                const { municipio, estado, valor } = item;
                if (showAsPercentage) {
                  return `${municipio}, ${estado}<br/>${params[0].value.toFixed(2)}%`;
                }
                return `${municipio}, ${estado}<br/>${valor.toLocaleString()} policías asesinados`;
              },
            },
            dataZoom: [
              { type: 'slider', xAxisIndex: 0, start: 0, end: 100 },
              { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
            ],
            xAxis: {
              type: 'category',
              data: filteredData.map((d) => d.municipio),
              axisLabel: { rotate: 45, interval: 0 },
            },
            yAxis: {
              type: 'value',
              name: showAsPercentage ? '%' : 'Número de policías',
            },
            series: [
              {
                type: 'bar',
                data: filteredData.map((d) =>
                  showAsPercentage
                    ? parseFloat(((d.valor * 100) / total).toFixed(2))
                    : d.valor
                ),
                itemStyle: {
                  color: (params: any) => {
                    const val = filteredData[params.dataIndex].valor;
                    return useGradientColor ? getColorGradient(val) : '#5470C6';
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
                ...(showAverageLine && !showAsPercentage
                  ? {
                      markLine: {
                        symbol: 'none',
                        data: [
                          {
                            yAxis: promedio,
                            lineStyle: { type: 'dashed', color: 'red' },
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
                  ? selectedEstado === TODOS_ESTADOS
                    ? 'Mapa de árbol: Policías asesinados por municipio (Todos los años)'
                    : `Municipios de ${selectedEstado} (Todos los años)`
                  : selectedEstado === TODOS_ESTADOS
                  ? `Mapa de árbol: Policías asesinados en ${selectedYear}`
                  : `Municipios de ${selectedEstado} en ${selectedYear}`,
            },
            tooltip: {
              formatter: (params: any) => {
                const name = params.name;
                const item = filteredData.find((d) => d.municipio === name);
                if (!item) {
                  return name;
                }
                if (showAsPercentage) {
                  return `${item.municipio}, ${item.estado}<br/>${params.value.toFixed(2)}%`;
                }
                return `${item.municipio}, ${item.estado}<br/>${item.valor.toLocaleString()} policías asesinados`;
              },
            },
            series: [
              {
                type: 'treemap',
                data: filteredData.map((d) => ({
                  name: d.municipio,
                  value: showAsPercentage
                    ? parseFloat(((d.valor * 100) / total).toFixed(2))
                    : d.valor,
                  itemStyle: {
                    color: useGradientColor ? getColorGradient(d.valor) : '#5470C6',
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
    filteredData,
    chartType,
    showAsPercentage,
    total,
    promedio,
    showAverageLine,
    useGradientColor,
    selectedYear,
    selectedEstado,
  ]);

  // Función de agrupamiento municipio + estado
  const agruparPorMunicipio = (records: PoliceRecordMinimal[]): MunicipioCount[] => {
    const map: Record<string, { estado: string; valor: number }> = {};
    for (const r of records) {
      const key = `${r.Municipio}|${r.Estado}`;
      if (!map[key]) {
        map[key] = { estado: r.Estado, valor: 0 };
      }
      map[key].valor += 1;
    }
    return Object.entries(map).map(([key, val]) => {
      const [municipio] = key.split('|');
      return { municipio, estado: val.estado, valor: val.valor };
    });
  };

  const ordenarPorValor = (base: MunicipioCount[] = data) => {
    setSortedData([...base].sort((a, b) => b.valor - a.valor));
  };

  const ordenarPorNombre = () => {
    setSortedData([...data].sort((a, b) => a.municipio.localeCompare(b.municipio)));
  };

  const mostrarTop10 = () => {
    setLeyenda50(null);
    const top10 = [...data].sort((a, b) => b.valor - a.valor).slice(0, 10);
    const totalTop10 = top10.reduce((s, i) => s + i.valor, 0);
    const pct = total > 0 ? parseFloat(((totalTop10 * 100) / total).toFixed(1)) : 0;
    setLeyendaTop10({ total: totalTop10, porcentaje: pct });
    setSortedData(top10);
  };

  const mostrarTop50 = () => {
    setLeyendaTop10(null);
    let acc = 0;
    const subset: MunicipioCount[] = [];
    const ord = [...data].sort((a, b) => b.valor - a.valor);
    for (const item of ord) {
      acc += item.valor;
      subset.push(item);
      if (acc / total >= 0.5) break;
    }
    const pct = total > 0 ? parseFloat(((acc * 100) / total).toFixed(1)) : 0;
    setLeyenda50({ entidades: subset.length, porcentaje: pct });
    setSortedData(subset);
  };

  const resetView = () => {
    // Resetear todo: orden, leyendas, promedio, usar gradiente por defecto
    setLeyenda50(null);
    setLeyendaTop10(null);
    setShowAverageLine(false);
    setUseGradientColor(true);  // restaurar gradiente
    ordenarPorValor(data);
    setSearchTerm('');
  };

  const handleDownload = async (type: 'png' | 'pdf') => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const img = canvas.toDataURL('image/png');
    const estadoSuffix =
      selectedEstado !== TODOS_ESTADOS ? selectedEstado : 'todos';
    const yearSuffix = selectedYear !== TODOS_ANIOS ? selectedYear.toString() : 'todos';
    if (type === 'png') {
      const link = document.createElement('a');
      link.href = img;
      link.download = `policias_municipio_${estadoSuffix}_${yearSuffix}.png`;
      link.click();
    } else {
      const pdf = new jsPDF();
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, 'PNG', 0, 10, w, h);
      pdf.save(`policias_municipio_${estadoSuffix}_${yearSuffix}.pdf`);
    }
  };

  const estadosOptions = useMemo(() => {
    const setEst = new Set(allRecords.map((r) => r.Estado));
    return Array.from(setEst).sort();
  }, [allRecords]);

  return (
    <div style={wrapperStyle}>
      {/* Filtros: año, estado, buscador */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '10px',
          alignItems: 'center',
        }}
      >
        <label>Año:</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          <option value={TODOS_ANIOS}>Todos</option>
          {Array.from({ length: 2024 - 2018 + 1 }, (_, i) => 2018 + i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <label>Estado:</label>
        <select
          value={selectedEstado}
          onChange={(e) => setSelectedEstado(e.target.value)}
        >
          <option value={TODOS_ESTADOS}>Todos</option>
          {estadosOptions.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <FaSearch
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#888',
            }}
          />
          <input
            type="text"
            placeholder="Buscar municipio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px 6px 28px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      {/* Barra de botones de acción */}
      <div style={toolbarStyle}>
        <button onClick={() => handleDownload('png')} style={buttonStyle} title="Descargar imagen">
          <FaDownload />
        </button>
        <button onClick={() => handleDownload('pdf')} style={buttonStyle} title="Descargar PDF">
          <FaFilePdf />
        </button>
        <button onClick={ordenarPorNombre} style={buttonStyle} title="Ordenar por municipio">
          <FaSortAlphaDown />
        </button>
        <button onClick={() => ordenarPorValor()} style={buttonStyle} title="Ordenar por valor">
          <FaSortAmountDown />
        </button>
        <button onClick={mostrarTop10} style={buttonStyle} title="Top 10 municipios">
          Top 10
        </button>
        <button onClick={mostrarTop50} style={buttonStyle} title="+50%">
          +50%
        </button>
        <button onClick={resetView} style={buttonStyle} title="Restablecer vista">
          ⟳
        </button>
        <button onClick={() => setUseGradientColor(!useGradientColor)} style={buttonStyle} title="Gradiente on/off">
          {useGradientColor ? 'Gradiente ✔' : 'Gradiente ✘'}
        </button>
        <button
          onClick={() => setChartType(chartType === 'bar' ? 'treemap' : 'bar')}
          style={buttonStyle}
          title="Cambiar tipo de gráfica"
        >
          {chartType === 'bar' ? <FaSitemap /> : <FaChartBar />}
        </button>
        <button onClick={() => setShowAsPercentage(!showAsPercentage)} style={buttonStyle} title="Mostrar porcentaje">
          {showAsPercentage ? '%' : '#'}
        </button>
        <button
          onClick={() => {
            setShowAverageLine(!showAverageLine);
            setLeyenda50(null);
            setLeyendaTop10(null);
          }}
          style={buttonStyle}
          title="Mostrar/Ocultar promedio"
        >
          {showAverageLine ? '🔴 Promedio' : '⚪ Promedio'}
        </button>

        <div style={totalBoxStyle}>Total: {total.toLocaleString()} policías</div>
      </div>

      {showAverageLine && (
        <div style={legendBoxStyle}>
          🔺 {countAbove} municipios por encima · 🔻 {countBelow} por debajo del promedio
        </div>
      )}
      {leyenda50 && !showAverageLine && (
        <div style={legendBoxStyle}>
          {leyenda50.entidades} municipios concentran el {leyenda50.porcentaje}% del total
        </div>
      )}
      {leyendaTop10 && !showAverageLine && (
        <div style={legendBoxStyle}>
          Top 10 municipios acumulan {leyendaTop10.total.toLocaleString()} policías ({leyendaTop10.porcentaje}%)
        </div>
      )}

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
const totalBoxStyle: React.CSSProperties = {
  backgroundColor: '#eee',
  color: '#333',
  padding: '4px 10px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 'bold',
};
const legendBoxStyle: React.CSSProperties = {
  backgroundColor: '#f9f9f9',
  color: '#555',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  marginBottom: '10px',
};

export default PolicemenKilledByMunicipioChart;
