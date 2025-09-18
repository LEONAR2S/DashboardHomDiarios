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
}

const BarChartEstado = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [data, setData] = useState<Datos[]>([]);
  const [sortedData, setSortedData] = useState<Datos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'treemap'>('bar');
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [showAverageLine, setShowAverageLine] = useState(false);
  const [useGradientColor, setUseGradientColor] = useState(false);  // ← nuevo estado

  const [leyenda50, setLeyenda50] = useState<{ entidades: number; porcentaje: number } | null>(null);
  const [leyendaTop10, setLeyendaTop10] = useState<{ total: number; porcentaje: number } | null>(null);

  const totalHomicidios = useMemo(
    () => data.reduce((sum, item) => sum + (item.valor || 0), 0),
    [data]
  );

  const promedioNacional = useMemo(
    () => (data.length > 0 ? totalHomicidios / data.length : 0),
    [totalHomicidios, data]
  );

  const countAbove = useMemo(
    () => data.filter((d) => d.valor > promedioNacional).length,
    [data, promedioNacional]
  );

  const countBelow = useMemo(
    () => data.filter((d) => d.valor < promedioNacional).length,
    [data, promedioNacional]
  );

  useEffect(() => {
    fetch('/data/Estado.json')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        ordenarPorValor(json); // predeterminado: por valor
      })
      .catch((err) => console.error('Error cargando datos:', err));
  }, []);

  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const minVal = Math.min(...sortedData.map((d) => d.valor));
    const maxVal = Math.max(...sortedData.map((d) => d.valor));

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
            title: { text: 'Homicidios por Entidad Federativa' },
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const { value, name } = params[0];
                return showAsPercentage
                  ? `${name}<br/>${value.toFixed(2)}%`
                  : `${name}<br/>${value.toLocaleString()} homicidios`;
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
            yAxis: { type: 'value' },
            series: [
              {
                type: 'bar',
                data: sortedData.map((item) => {
                  const val = showAsPercentage
                    ? parseFloat(((item.valor * 100) / totalHomicidios).toFixed(2))
                    : item.valor;

                  if (useGradientColor) {
                    // Si se activa el gradiente
                    return {
                      value: val,
                      itemStyle: {
                        color: getColorGradient(item.valor, minVal, maxVal),
                      },
                    };
                  } else {
                    // color fijo / predeterminado
                    return {
                      value: val,
                      // puedes poner un color fijo, ej. '#5470C6'
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
                            yAxis: promedioNacional,
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
            // Treemap u otro tipo si lo tienes
            title: { text: 'Mapa de Árbol: Homicidios por Estado' },
            tooltip: {
              formatter: (params: any) => {
                const { name, value } = params;
                return showAsPercentage
                  ? `${name}<br/>${value.toFixed(2)}%`
                  : `${name}<br/>${value.toLocaleString()} homicidios`;
              },
            },
            series: [
              {
                type: 'treemap',
                data: sortedData.map((item) => {
                  const val = showAsPercentage
                    ? parseFloat(((item.valor * 100) / totalHomicidios).toFixed(2))
                    : item.valor;

                  const color = useGradientColor
                    ? getColorGradient(item.valor, minVal, maxVal)
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
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [sortedData, chartType, showAsPercentage, totalHomicidios, showAverageLine, useGradientColor]);

  const ordenarPorNombre = (baseData: Datos[] = data) => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    const ordenada = [...baseData].sort((a, b) => a.entidad.localeCompare(b.entidad));
    setSortedData(ordenada);
  };

  const ordenarPorValor = (baseData: Datos[] = data) => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    const ordenada = [...baseData].sort((a, b) => b.valor - a.valor);
    setSortedData(ordenada);
  };

  const mostrarTop10 = () => {
    setLeyenda50(null);
    const top10 = [...data]
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    const totalTop10 = top10.reduce((sum, item) => sum + item.valor, 0);
    const porcentaje = parseFloat(((totalTop10 * 100) / totalHomicidios).toFixed(1));

    setLeyendaTop10({ total: totalTop10, porcentaje });
    setSortedData(top10);
  };

  const mostrarTop50Porciento = () => {
    setLeyendaTop10(null);
    const sorted = [...data].sort((a, b) => b.valor - a.valor);
    let acumulado = 0;
    let subset: Datos[] = [];

    for (let i = 0; i < sorted.length; i++) {
      acumulado += sorted[i].valor;
      subset.push(sorted[i]);
      if ((acumulado / totalHomicidios) >= 0.5) break;
    }

    const porcentaje = parseFloat(((acumulado * 100) / totalHomicidios).toFixed(1));
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
      link.download = 'grafica_estado.png';
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
    pdf.save('grafica_estado.pdf');
  };

  return (
    <div style={wrapperStyle}>
      <div style={toolbarStyle}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}><FaDownload /></button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}><FaFilePdf /></button>
        <button onClick={() => ordenarPorNombre()} title="Ordenar por Estado" style={buttonStyle}><FaSortAlphaDown /></button>
        <button onClick={() => ordenarPorValor()} title="Ordenar por Valor" style={buttonStyle}><FaSortAmountDown /></button>

        {/* Nuevo botón para activar/desactivar gradiente */}
        <button
          onClick={() => setUseGradientColor((prev) => !prev)}
          title={useGradientColor ? "Desactivar gradiente" : "Activar gradiente de color"}
          style={buttonStyle}
        >
          {useGradientColor ? "Gradiente ✔" : "Gradiente ✘"}
        </button>

        <button onClick={mostrarTop10} title="Top 10 estados" style={buttonStyle}>Top 10</button>
        <button onClick={mostrarTop50Porciento} title="Estados con +50%" style={buttonStyle}>+50%</button>
        <button onClick={() => setChartType((prev) => (prev === 'bar' ? 'treemap' : 'bar'))} title="Cambiar tipo de gráfico" style={buttonStyle}>
          {chartType === 'bar' ? <FaSitemap /> : <FaChartBar />}
        </button>
        <button onClick={() => setShowAsPercentage((prev) => !prev)} title="Mostrar como porcentaje" style={buttonStyle}>
          {showAsPercentage ? '%' : '#'}
        </button>
        <button onClick={() => {
          setShowAverageLine((prev) => !prev);
          setLeyenda50(null);
          setLeyendaTop10(null);
        }} title="Mostrar/Ocultar Promedio Nacional" style={buttonStyle}>
          {showAverageLine ? '🔴 Prom. Nal.' : '⚪ Prom. Nal.'}
        </button>
        <button onClick={restablecerVistaOriginal} title="Restablecer vista original" style={buttonStyle}>⟳</button>
        <div style={totalBoxStyle}>Total: {totalHomicidios.toLocaleString()}</div>
      </div>

      {showAverageLine && (
        <div style={legendBoxStyle}>
          🔺 {countAbove} estados por encima · 🔻 {countBelow} estados por debajo del promedio
        </div>
      )}

      {leyenda50 && !showAverageLine && (
        <div style={legendBoxStyle}>
          {leyenda50.entidades} entidades concentran el {leyenda50.porcentaje}% de los homicidios
        </div>
      )}

      {leyendaTop10 && !showAverageLine && (
        <div style={legendBoxStyle}>
          Top 10 entidades acumulan {leyendaTop10.total.toLocaleString()} homicidios ({leyendaTop10.porcentaje}%)
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
