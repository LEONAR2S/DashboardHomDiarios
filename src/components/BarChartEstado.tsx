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

  const totalHomicidios = useMemo(
    () => data.reduce((sum, item) => sum + (item.valor || 0), 0),
    [data]
  );

  // Cargar datos
  useEffect(() => {
    fetch('/data/Estado.json')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        ordenarPorNombre(json);
      })
      .catch((err) => console.error('Error cargando datos:', err));
  }, []);

  // Renderizar gráfico
  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const minVal = Math.min(...sortedData.map((d) => d.valor));
    const maxVal = Math.max(...sortedData.map((d) => d.valor));

    const getColorGradient = (value: number, min: number, max: number) => {
      const ratio = (value - min) / (max - min);
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
                const val = params[0].value;
                const name = params[0].name;
                return showAsPercentage
                  ? `${name}<br/>${val.toFixed(2)}%`
                  : `${name}<br/>${val.toLocaleString()} homicidios`;
              },
            },
            toolbox: {},
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
                data: sortedData.map((item) =>
                  showAsPercentage
                    ? parseFloat(((item.valor * 100) / totalHomicidios).toFixed(2))
                    : item.valor
                ),
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
          }
        : {
            title: { text: 'Mapa de Árbol: Homicidios por Estado' },
            tooltip: {
              formatter: (params: any) => {
                const val = params.value;
                return showAsPercentage
                  ? `${params.name}<br/>${val.toFixed(2)}%`
                  : `${params.name}<br/>${val.toLocaleString()} homicidios`;
              },
            },
            series: [
              {
                type: 'treemap',
                data: sortedData.map((item) => ({
                  name: item.entidad,
                  value: showAsPercentage
                    ? parseFloat(((item.valor * 100) / totalHomicidios).toFixed(2))
                    : item.valor,
                  itemStyle: {
                    color: getColorGradient(item.valor, minVal, maxVal),
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
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [sortedData, chartType, showAsPercentage, totalHomicidios]);

  const ordenarPorNombre = (baseData: Datos[] = data) => {
    const ordenada = [...baseData].sort((a, b) => a.entidad.localeCompare(b.entidad));
    setSortedData(ordenada);
  };

  const ordenarPorValor = () => {
    const ordenada = [...data].sort((a, b) => b.valor - a.valor);
    setSortedData(ordenada);
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
    <div
      style={{
        position: 'relative',
        padding: '1rem',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        background: '#fff',
        marginBottom: '2rem',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 🔘 Botones de herramientas */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          gap: '10px',
          marginBottom: '10px',
          alignItems: 'center',
        }}
      >
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}>
          <FaDownload />
        </button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}>
          <FaFilePdf />
        </button>
        <button onClick={() => ordenarPorNombre()} title="Ordenar por Estado" style={buttonStyle}>
          <FaSortAlphaDown />
        </button>
        <button onClick={ordenarPorValor} title="Ordenar por Valor" style={buttonStyle}>
          <FaSortAmountDown />
        </button>
        <button
          onClick={() => setChartType((prev) => (prev === 'bar' ? 'treemap' : 'bar'))}
          title="Cambiar tipo de gráfico"
          style={buttonStyle}
        >
          {chartType === 'bar' ? <FaSitemap /> : <FaChartBar />}
        </button>
        <button
          onClick={() => setShowAsPercentage((prev) => !prev)}
          title="Mostrar como porcentaje"
          style={buttonStyle}
        >
          {showAsPercentage ? '%' : '#'}
        </button>
        <div style={totalBoxStyle}>
          Total: {totalHomicidios.toLocaleString()}
        </div>
      </div>

      {/* 📊 Contenedor de la gráfica */}
      <div ref={chartRef} style={{ width: '100%', height: '500px', minHeight: '300px' }} />
    </div>
  );
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

export default BarChartEstado;
