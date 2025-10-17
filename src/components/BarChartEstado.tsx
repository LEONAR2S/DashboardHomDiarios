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

interface Datos {
  entidad: string;
  valor: number;
  tasa: number;
}

const BarChartEstado = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [data, setData] = useState<Datos[]>([]);
  const [sortedData, setSortedData] = useState<Datos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'treemap'>('bar');
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [showAverageLine, setShowAverageLine] = useState(false);
  const [useGradientColor, setUseGradientColor] = useState(false);
  
  // Nuevo estado para modo: "valor" o "tasa"
  const [dataMode, setDataMode] = useState<'valor' | 'tasa'>('valor');

  const [leyenda50, setLeyenda50] = useState<{ entidades: number; porcentaje: number } | null>(null);
  const [leyendaTop10, setLeyendaTop10] = useState<{ total: number; porcentaje: number } | null>(null);

  const total = useMemo(
    () => data.reduce((sum, item) => sum + (item[dataMode] || 0), 0),
    [data, dataMode]
  );

  const promedio = useMemo(
    () => (data.length > 0 ? total / data.length : 0),
    [total, data]
  );

  const countAbove = useMemo(
    () => data.filter((d) => d[dataMode] > promedio).length,
    [data, promedio, dataMode]
  );

  const countBelow = useMemo(
    () => data.filter((d) => d[dataMode] < promedio).length,
    [data, promedio, dataMode]
  );

  useEffect(() => {
    fetch('/data/Estado.json')
      .then((res) => res.json())
      .then((json: Datos[]) => {
        setData(json);
        ordenarPorValor(json);
      })
      .catch((err) => console.error('Error cargando datos:', err));
  }, []);

  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const minVal = Math.min(...sortedData.map((d) => d[dataMode]));
    const maxVal = Math.max(...sortedData.map((d) => d[dataMode]));

    const getColorGradient = (value: number, min: number, max: number) => {
      const ratio = (value - min) / (max - min || 1);
      const r = Math.round(255 * ratio);
      const g = Math.round(200 * (1 - ratio));
      const b = 100;
      return `rgb(${r},${g},${b})`;
    };

    const options =
      chartType === 'bar'
        ? {
            title: { text: dataMode === 'valor' ? 'Homicidios por Entidad Federativa' : 'Tasa por cada 100 mil habitantes por Entidad' },
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const { value, name } = params[0];
                if (dataMode === 'tasa') {
                  return `${name}<br/>${value.toFixed(2)} tasa por cada 100 mil habitantes`;
                } else {
                  // valor absoluto
                  return showAsPercentage
                    ? `${name}<br/>${value.toFixed(2)}%`
                    : `${name}<br/>${value.toLocaleString()} homicidios`;
                }
              },
            },
            dataZoom: [
              { type: 'slider', show: false, xAxisIndex: 0, start: 0, end: 100, bottom: 0 },
              { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
            ],
            xAxis: {
              type: 'category',
              data: sortedData.map((item) => item.entidad),
              axisLabel: { rotate: 45, interval: 0 },
            },
            yAxis: {
              type: 'value',
              name: dataMode === 'tasa'
                ? 'Tasa / 100k hab.'
                : showAsPercentage
                ? '%'
                : 'Homicidios'
            },
            series: [
              {
                type: 'bar',
                data: sortedData.map((item) => {
                  const rawValue = item[dataMode];
                  const val = showAsPercentage && dataMode === 'valor'
                    ? parseFloat(((rawValue * 100) / total).toFixed(2))
                    : rawValue;

                  if (useGradientColor) {
                    return {
                      value: val,
                      itemStyle: {
                        color: getColorGradient(rawValue, minVal, maxVal),
                      },
                    };
                  } else {
                    return {
                      value: val,
                      itemStyle: {
                        color: '#5470C6',
                      },
                    };
                  }
                }),
                label: {
                  show: true,
                  position: 'top',
                  fontSize: 10,
                  color: '#333',
                  formatter: (val: any) => {
                    if (dataMode === 'tasa') {
                      return `${val.value.toFixed(2)}`;
                    } else {
                      return showAsPercentage
                        ? `${val.value.toFixed(2)}%`
                        : val.value.toLocaleString();
                    }
                  },
                },
                ...(showAverageLine && dataMode === 'valor' && !showAsPercentage
                  ? {
                      markLine: {
                        symbol: 'none',
                        data: [
                          {
                            yAxis: promedio,
                            lineStyle: { type: 'dashed', color: 'red', width: 2 },
                          },
                        ],
                      },
                    }
                  : {}),
              },
            ],
          }
        : {
            // Treemap
            title: { text: dataMode === 'valor' ? 'Mapa de Árbol: Homicidios por Estado' : 'Mapa de Árbol: Tasa por cada 100 mil habitantes' },
            tooltip: {
              formatter: (params: any) => {
                const { name, value } = params;
                if (dataMode === 'tasa') {
                  return `${name}<br/>${value.toFixed(2)} tasa por cada 100 mil habitantes`;
                } else {
                  return showAsPercentage
                    ? `${name}<br/>${value.toFixed(2)}%`
                    : `${name}<br/>${value.toLocaleString()} homicidios`;
                }
              },
            },
            series: [
              {
                type: 'treemap',
                data: sortedData.map((item) => {
                  const rawValue = item[dataMode];
                  const val = showAsPercentage && dataMode === 'valor'
                    ? parseFloat(((rawValue * 100) / total).toFixed(2))
                    : rawValue;

                  const color = useGradientColor
                    ? getColorGradient(rawValue, minVal, maxVal)
                    : '#5470C6';

                  return {
                    name: item.entidad,
                    value: val,
                    itemStyle: {
                      color,
                    },
                  };
                }),
                label: {
                  show: true,
                  formatter: (info: any) =>
                    `${info.name}\n${
                      dataMode === 'tasa'
                        ? `${info.value.toFixed(2)}`
                        : showAsPercentage
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
    const handleResize = () => chart.resize();
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
    dataMode,
  ]);

  const ordenarPorNombre = (baseData: Datos[] = data) => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    const ordenada = [...baseData].sort((a, b) => a.entidad.localeCompare(b.entidad));
    setSortedData(ordenada);
  };

  const ordenarPorValor = (baseData: Datos[] = data) => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    const ordenada = [...baseData].sort((a, b) => b[dataMode] - a[dataMode]);
    setSortedData(ordenada);
  };

  const mostrarTop10 = () => {
    setLeyenda50(null);
    const top10 = [...data]
      .sort((a, b) => b[dataMode] - a[dataMode])
      .slice(0, 10);

    const totalTop10 = top10.reduce((sum, item) => sum + item[dataMode], 0);
    const porcentaje = parseFloat(((totalTop10 * 100) / (dataMode === 'valor' ? total : total)).toFixed(1));
    // Nota: porcentaje tiene sentido solo si estás en modo 'valor' o si quieres comparar tasas relativas; ajusta según lo que desees

    setLeyendaTop10({ total: totalTop10, porcentaje });
    setSortedData(top10);
  };

  const mostrarTop50Porciento = () => {
    setLeyendaTop10(null);
    const sorted = [...data].sort((a, b) => b[dataMode] - a[dataMode]);
    let acumulado = 0;
    let subset: Datos[] = [];

    for (let i = 0; i < sorted.length; i++) {
      acumulado += sorted[i][dataMode];
      subset.push(sorted[i]);
      if ((acumulado / total) >= 0.5) break;
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

  const handleDownloadImage = () => {
    if (!chartRef.current) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    const base64 = chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    if (base64) {
      const link = document.createElement('a');
      link.href = base64;
      link.download = `grafica_estado_${dataMode}.png`;
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
    pdf.save(`grafica_estado_${dataMode}.pdf`);
  };

  return (
    <div style={wrapperStyle}>
      <div style={toolbarStyle}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}><FaDownload /></button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}><FaFilePdf /></button>
        <button onClick={() => ordenarPorNombre()} title="Ordenar por Estado" style={buttonStyle}><FaSortAlphaDown /></button>
        <button onClick={() => ordenarPorValor()} title="Ordenar por Valor/Tasa" style={buttonStyle}><FaSortAmountDown /></button>

        {/* Botón para activar/desactivar gradiente */}
        <button
          onClick={() => setUseGradientColor((prev) => !prev)}
          title={useGradientColor ? "Desactivar gradiente" : "Activar gradiente de color"}
          style={buttonStyle}
        >
          {useGradientColor ? "Gradiente ✔" : "Gradiente ✘"}
        </button>

        <button onClick={mostrarTop10} title="Top 10 entidades" style={buttonStyle}>Top 10</button>
        <button onClick={mostrarTop50Porciento} title="Entidades con +50%" style={buttonStyle}>+50%</button>
        <button onClick={() => setChartType((prev) => (prev === 'bar' ? 'treemap' : 'bar'))} title="Cambiar tipo de gráfico" style={buttonStyle}>
          {chartType === 'bar' ? <FaSitemap /> : <FaChartBar />}
        </button>
        <button onClick={() => setShowAsPercentage((prev) => !prev)} title="Mostrar como porcentaje (solo para valor absoluto)" style={buttonStyle}>
          {showAsPercentage ? '%' : '#'}
        </button>
        <button onClick={() => {
          setShowAverageLine((prev) => !prev);
          setLeyenda50(null);
          setLeyendaTop10(null);
        }} title="Mostrar/Ocultar Promedio Nacional (solo para valor absoluto sin porcentaje)" style={buttonStyle}>
          {showAverageLine ? '🔴 Prom. Nal.' : '⚪ Prom. Nal.'}
        </button>

        {/* Botón para alternar valor vs tasa */}
        <button
          onClick={() => {
            setDataMode((prev) => (prev === 'valor' ? 'tasa' : 'valor'));
            // Cuando cambias de modo, restableces algunas vistas
            setLeyenda50(null);
            setLeyendaTop10(null);
            setShowAverageLine(false);
          }}
          title="Alternar entre valor absoluto y tasa"
          style={buttonStyle}
        >
          {dataMode === 'valor' ? 'Tasa x C/100mil Hab.' : 'Numeros Absolutos'}
        </button>

        <button onClick={restablecerVistaOriginal} title="Restablecer vista original" style={buttonStyle}>⟳</button>
        <div style={totalBoxStyle}>
          {dataMode === 'valor'
            ? `Total homicidios: ${total.toLocaleString()}`
            : `Total tasa (sum): ${total.toFixed(2)}`}  
        </div>
      </div>

      {showAverageLine && dataMode === 'valor' && (
        <div style={legendBoxStyle}>
          🔺 {countAbove} entidades por encima · 🔻 {countBelow} entidades por debajo del promedio nacional
        </div>
      )}

      {leyenda50 && !showAverageLine && (
        <div style={legendBoxStyle}>
          {leyenda50.entidades} entidades concentran el {leyenda50.porcentaje}% de { dataMode === 'valor' ? 'los homicidios' : 'la tasa' }
        </div>
      )}

      {leyendaTop10 && !showAverageLine && (
        <div style={legendBoxStyle}>
          Top 10 entidades acumulan {leyendaTop10.total.toLocaleString()} { dataMode === 'valor' ? 'homicidios' : 'tasa' } ({leyendaTop10.porcentaje}%)
        </div>
      )}

      <div ref={chartRef} style={{ width: '100%', height: '500px', minHeight: '300px' }} />
    </div>
  );
};

// Estilos
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

export default BarChartEstado;
