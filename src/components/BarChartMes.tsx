import * as echarts from 'echarts';
import { useEffect, useRef, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FaDownload,
  FaFilePdf,
  FaSortAlphaDown,
  FaSortAmountDown,
  FaChartPie,
  FaChartBar,
} from 'react-icons/fa';

interface Datos {
  mes: string;
  valor: number;
}

const MESES_ORDENADOS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const BarChart = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Datos[]>([]);
  const [sortedData, setSortedData] = useState<Datos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  const [showAverage, setShowAverage] = useState(true);
  const [showStdDev, setShowStdDev] = useState(false);
  const [showCV, setShowCV] = useState(false);

  const valores = useMemo(() => sortedData.map(d => d.valor), [sortedData]);

  const media = useMemo(() => {
    return valores.length > 0
      ? valores.reduce((a, b) => a + b, 0) / valores.length
      : 0;
  }, [valores]);

  const stdDev = useMemo(() => {
    if (valores.length < 2) return 0;
    const mean = media;
    const sumSq = valores.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
    return Math.sqrt(sumSq / (valores.length - 1));
  }, [valores, media]);

  const coefVar = useMemo(() => {
    return media !== 0 ? stdDev / media : 0;
  }, [stdDev, media]);

  const maxMes = useMemo(() => {
    return sortedData.length > 0 ? sortedData.reduce((max, item) => item.valor > max.valor ? item : max) : null;
  }, [sortedData]);

  const minMes = useMemo(() => {
    return sortedData.length > 0 ? sortedData.reduce((min, item) => item.valor < min.valor ? item : min) : null;
  }, [sortedData]);

  useEffect(() => {
    fetch('/data/Mes.json')
      .then(res => res.json())
      .then(json => {
        setData(json);
        ordenarPorMesNatural(json);
      });
  }, []);

  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;
    const chart = echarts.init(chartRef.current);

    const options =
      chartType === 'bar'
        ? {
            title: { text: 'Homicidios por Mes' },
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const val = params[0].value;
                const name = params[0].name;
                return `${name}<br/>${val.toLocaleString()} homicidios`;
              },
            },
            xAxis: {
              type: 'category',
              data: sortedData.map(i => i.mes),
              axisLabel: { rotate: 45, interval: 0 },
            },
            yAxis: { type: 'value' },
            series: [
              {
                type: 'bar',
                data: valores,
                label: {
                  show: true,
                  position: 'top',
                  fontSize: 12,
                  formatter: (v: any) => v.value.toLocaleString(),
                },
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
          }
        : {
            title: { text: 'Distribución de Homicidios por Mes' },
            tooltip: {
              trigger: 'item',
              formatter: '{b}: {c} ({d}%)',
            },
            series: [
              {
                type: 'pie',
                radius: '60%',
                data: sortedData.map(i => ({ name: i.mes, value: i.valor })),
                label: {
                  formatter: '{b}\n{c} ({d}%)',
                },
              },
            ],
          };

    chart.setOption(options);
    window.addEventListener('resize', () => chart.resize());
    return () => {
      window.removeEventListener('resize', () => chart.resize());
      chart.dispose();
    };
  }, [sortedData, chartType, showAverage, media]);

  const ordenarPorMesNatural = (baseData: Datos[] = data) => {
    setSortedData([...baseData].sort((a, b) => MESES_ORDENADOS.indexOf(a.mes) - MESES_ORDENADOS.indexOf(b.mes)));
  };

  const ordenarPorValor = () => {
    setSortedData([...data].sort((a, b) => b.valor - a.valor));
  };

  const handleDownloadImage = () => {
    if (!chartRef.current) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    const base64 = chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    if (base64) {
      const link = document.createElement('a');
      link.href = base64;
      link.download = 'grafica_mes.png';
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
    pdf.save('grafica_mes.pdf');
  };

  return (
    <div style={{ position: 'relative', padding: '1rem', border: '1px solid #ccc', borderRadius: 8, background: '#fff', marginTop: '1rem' }}>
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: '10px', zIndex: 10 }}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}><FaDownload /></button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}><FaFilePdf /></button>
        <button onClick={ordenarPorMesNatural} title="Ordenar por mes" style={buttonStyle}><FaSortAlphaDown /></button>
        <button onClick={ordenarPorValor} title="Ordenar por valor" style={buttonStyle}><FaSortAmountDown /></button>
        <button onClick={() => setChartType(chartType === 'bar' ? 'pie' : 'bar')} title="Cambiar tipo gráfico" style={buttonStyle}>
          {chartType === 'bar' ? <FaChartPie /> : <FaChartBar />}
        </button>
        <button onClick={() => setShowAverage(prev => !prev)} title="Mostrar/Ocultar promedio" style={buttonStyle}>
          {showAverage ? 'Ocultar Media' : 'Mostrar Media'}
        </button>
        <button onClick={() => setShowStdDev(prev => !prev)} title="Mostrar/Ocultar desviación estándar" style={buttonStyle}>
          {showStdDev ? 'Ocultar SD' : 'Mostrar SD'}
        </button>
        <button onClick={() => setShowCV(prev => !prev)} title="Mostrar/Ocultar CV" style={buttonStyle}>
          {showCV ? 'Ocultar CV' : 'Mostrar CV'}
        </button>
      </div>

      {/* Análisis estadístico */}
      {(showStdDev || showCV || showAverage) && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          {showAverage && <div>📌 <strong>Media:</strong> {media.toFixed(2)}</div>}
          {showStdDev && <div>📉 <strong>Desviación estándar:</strong> {stdDev.toFixed(2)}</div>}
          {showCV && <div>📊 <strong>Coeficiente de variación:</strong> {(coefVar * 100).toFixed(2)}%</div>}
          {maxMes && <div>🔺 <strong>Máximo:</strong> {maxMes.mes} ({maxMes.valor.toLocaleString()})</div>}
          {minMes && <div>🔻 <strong>Mínimo:</strong> {minMes.mes} ({minMes.valor.toLocaleString()})</div>}
        </div>
      )}

      <div ref={chartRef} style={{ width: '100%', height: '400px', minHeight: 300 }} />
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #ddd',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '14px',
  padding: '6px',
};

export default BarChart;
