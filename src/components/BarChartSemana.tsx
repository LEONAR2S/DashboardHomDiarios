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
  FaChartLine,
} from 'react-icons/fa';

interface Datos {
  semana: string;
  valor: number;
}

const BarChartSemana = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Datos[]>([]);
  const [sortedData, setSortedData] = useState<Datos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const [showAverage, setShowAverage] = useState(true);
  const [showStdDev, setShowStdDev] = useState(false);
  const [showCV, setShowCV] = useState(false);

  const valores = useMemo(() => sortedData.map(d => d.valor), [sortedData]);

  const media = useMemo(() => {
    return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
  }, [valores]);

  const countAbove = useMemo(() => {
    return valores.filter(v => v > media).length;
  }, [valores, media]);

  const countBelow = useMemo(() => {
    return valores.filter(v => v < media).length;
  }, [valores, media]);

  const stdDev = useMemo(() => {
    if (valores.length < 2) return 0;
    const mean = media;
    const sumSq = valores.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
    return Math.sqrt(sumSq / (valores.length - 1));
  }, [valores, media]);

  const coefVar = useMemo(() => {
    return media !== 0 ? stdDev / media : 0;
  }, [stdDev, media]);

  const maxSemana = useMemo(() => {
    return sortedData.length > 0 ? sortedData.reduce((max, d) => d.valor > max.valor ? d : max) : null;
  }, [sortedData]);

  const minSemana = useMemo(() => {
    return sortedData.length > 0 ? sortedData.reduce((min, d) => d.valor < min.valor ? d : min) : null;
  }, [sortedData]);

  useEffect(() => {
    fetch('/data/Semana.json')
      .then(res => res.json())
      .then(json => {
        setData(json);
        ordenarPorSemana(json);
      });
  }, []);

  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;
    const chart = echarts.init(chartRef.current);

    const option = {
      title: { text: 'Homicidios por Semana' },
      tooltip: { trigger: 'axis' },
      toolbox: {
        feature: {
          restore: {},
          dataZoom: { yAxisIndex: 'none' }
        }
      },
      dataZoom: [
        { type: 'slider', show: false, xAxisIndex: 0, start: 0, end: 100, height: 20, bottom: 0 },
        { type: 'inside', xAxisIndex: 0, start: 0, end: 100 }
      ],
      xAxis: {
        type: 'category',
        data: sortedData.map(item => item.semana),
        axisLabel: {
          rotate: 45,
          interval: 0,
          fontSize: 10,
        },
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: chartType,
          data: sortedData.map(item => item.valor),
          smooth: chartType === 'line',
          label: {
            show: true,
            position: chartType === 'bar' ? 'top' : 'right',
            fontSize: 10,
            color: '#333',
            formatter: (val: any) => val.value.toLocaleString(),
          },
          lineStyle: chartType === 'line' ? { width: 2 } : undefined,
          itemStyle: chartType === 'line' ? { color: '#5470c6' } : undefined,
          ...(showAverage && valores.length > 0
            ? {
                markLine: {
                  symbol: 'none',
                  data: [
                    {
                      yAxis: media,
                      lineStyle: {
                        type: 'dashed',
                        color: 'red',
                        width: 2,
                      },
                      label: {
                        formatter: `Media: ${media.toFixed(2)}`,
                        position: 'end',
                        color: 'red',
                        fontWeight: 'bold',
                      },
                    },
                  ],
                },
              }
            : {}),
        },
      ],
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      chart.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [sortedData, chartType, showAverage, media]);

  const ordenarPorSemana = (baseData?: Datos[]) => {
    const base = baseData ?? data;
    const ordenada = [...base].sort((a, b) => {
      const getNum = (sem: string) => parseInt(sem.match(/Sem (\d+)/)?.[1] || '0', 10);
      return getNum(a.semana) - getNum(b.semana);
    });
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
      link.download = 'grafica_semana.png';
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
    pdf.save('grafica_semana.pdf');
  };

  return (
    <div style={{
      position: 'relative',
      padding: '1rem',
      border: '1px solid #ccc',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      background: '#fff',
      marginBottom: '2rem',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '1rem',
      }}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}><FaDownload /></button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}><FaFilePdf /></button>
        <button onClick={() => ordenarPorSemana()} title="Ordenar por Semana" style={buttonStyle}><FaSortAlphaDown /></button>
        <button onClick={ordenarPorValor} title="Ordenar por Valor" style={buttonStyle}><FaSortAmountDown /></button>
        <button onClick={() => setChartType(chartType === 'bar' ? 'line' : 'bar')} title="Cambiar tipo de gráfico" style={buttonStyle}>
          {chartType === 'bar' ? <FaChartLine /> : <FaChartBar />}
        </button>
        <button onClick={() => setShowAverage(prev => !prev)} title="Mostrar/Ocultar Media" style={buttonStyle}>
          {showAverage ? 'Ocultar Media' : 'Mostrar Media'}
        </button>
        <button onClick={() => setShowStdDev(prev => !prev)} title="Mostrar/Ocultar Desviación Estándar" style={buttonStyle}>
          {showStdDev ? 'Ocultar SD' : 'Mostrar SD'}
        </button>
        <button onClick={() => setShowCV(prev => !prev)} title="Mostrar/Ocultar CV" style={buttonStyle}>
          {showCV ? 'Ocultar CV' : 'Mostrar CV'}
        </button>
      </div>

      {/* Panel de estadísticas */}
      {(showAverage || showStdDev || showCV) && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          {showAverage && (
            <>
              <div>📌 <strong>Media:</strong> {media.toFixed(2)}</div>
              <div>🔺 <strong>Semanas por encima:</strong> {countAbove}</div>
              <div>🔻 <strong>Semanas por debajo:</strong> {countBelow}</div>
            </>
          )}
          {showStdDev && <div>📉 <strong>Desviación estándar:</strong> {stdDev.toFixed(2)}</div>}
          {showCV && <div>📊 <strong>Coeficiente de variación:</strong> {(coefVar * 100).toFixed(2)}%</div>}
          {maxSemana && <div>🔺 <strong>Máximo:</strong> {maxSemana.semana} ({maxSemana.valor.toLocaleString()})</div>}
          {minSemana && <div>🔻 <strong>Mínimo:</strong> {minSemana.semana} ({minSemana.valor.toLocaleString()})</div>}
        </div>
      )}

      <div ref={chartRef} style={{ width: '100%', height: '450px' }} />
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

export default BarChartSemana;
