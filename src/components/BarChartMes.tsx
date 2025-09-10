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
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const BarChartMes = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [data, setData] = useState<Datos[]>([]);
  const [sortedData, setSortedData] = useState<Datos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  const [showAverage, setShowAverage] = useState(true);
  const [showStdDev, setShowStdDev] = useState(false);
  const [showCV, setShowCV] = useState(false);

  // Estadísticas
  const valores = useMemo(() => sortedData.map(d => d.valor), [sortedData]);

  const media = useMemo(() => (
    valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0
  ), [valores]);

  const stdDev = useMemo(() => {
    if (valores.length < 2) return 0;
    const sumSq = valores.reduce((sum, v) => sum + Math.pow(v - media, 2), 0);
    return Math.sqrt(sumSq / (valores.length - 1));
  }, [valores, media]);

  const coefVar = useMemo(() => (media ? stdDev / media : 0), [stdDev, media]);

  const maxMes = useMemo(() => (
    sortedData.length ? sortedData.reduce((max, d) => d.valor > max.valor ? d : max) : null
  ), [sortedData]);

  const minMes = useMemo(() => (
    sortedData.length ? sortedData.reduce((min, d) => d.valor < min.valor ? d : min) : null
  ), [sortedData]);

  // Cargar datos
  useEffect(() => {
    fetch('/data/Mes.json')
      .then(res => res.json())
      .then((json: Datos[]) => {
        setData(json);
        ordenarPorMesNatural(json);
      });
  }, []);

  // Crear gráfico
  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const options: echarts.EChartsOption = chartType === 'bar'
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
              ...(showAverage && valores.length
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
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [sortedData, chartType, showAverage, media]);

  // Ordenamientos
  const ordenarPorMesNatural = (baseData: Datos[] = data) => {
    const ordenado = [...baseData].sort(
      (a, b) => MESES_ORDENADOS.indexOf(a.mes) - MESES_ORDENADOS.indexOf(b.mes)
    );
    setSortedData(ordenado);
  };

  const ordenarPorValor = () => {
    const ordenado = [...data].sort((a, b) => b.valor - a.valor);
    setSortedData(ordenado);
  };

  // Exports
  const handleDownloadImage = () => {
    if (!chartRef.current) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    const url = chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grafica_mes.png';
      a.click();
    }
  };

  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 10, w, h);
    pdf.save('grafica_mes.pdf');
  };

  return (
    <div style={{ position: 'relative', padding: '1rem', border: '1px solid #ccc', borderRadius: 8, background: '#fff', marginTop: '1rem' }}>
      {/* Botones */}
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: '10px', zIndex: 10 }}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}><FaDownload /></button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}><FaFilePdf /></button>
        <button onClick={() => ordenarPorMesNatural()} title="Ordenar por mes" style={buttonStyle}><FaSortAlphaDown /></button>
        <button onClick={ordenarPorValor} title="Ordenar por valor" style={buttonStyle}><FaSortAmountDown /></button>
        <button onClick={() => setChartType(chartType === 'bar' ? 'pie' : 'bar')} title="Cambiar tipo gráfico" style={buttonStyle}>
          {chartType === 'bar' ? <FaChartPie /> : <FaChartBar />}
        </button>
        <button onClick={() => setShowAverage(p => !p)} title="Media" style={buttonStyle}>
          {showAverage ? 'Ocultar Media' : 'Mostrar Media'}
        </button>
        <button onClick={() => setShowStdDev(p => !p)} title="Desviación estándar" style={buttonStyle}>
          {showStdDev ? 'Ocultar SD' : 'Mostrar SD'}
        </button>
        <button onClick={() => setShowCV(p => !p)} title="Coeficiente de variación" style={buttonStyle}>
          {showCV ? 'Ocultar CV' : 'Mostrar CV'}
        </button>
      </div>

      {/* Estadísticas */}
      {(showAverage || showStdDev || showCV) && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          {showAverage && <div>📌 <strong>Media:</strong> {media.toFixed(2)}</div>}
          {showStdDev && <div>📉 <strong>Desviación estándar:</strong> {stdDev.toFixed(2)}</div>}
          {showCV && <div>📊 <strong>Coeficiente de variación:</strong> {(coefVar * 100).toFixed(2)}%</div>}
          {maxMes && <div>🔺 <strong>Máximo:</strong> {maxMes.mes} ({maxMes.valor.toLocaleString()})</div>}
          {minMes && <div>🔻 <strong>Mínimo:</strong> {minMes.mes} ({minMes.valor.toLocaleString()})</div>}
        </div>
      )}

      {/* Gráfico */}
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

export default BarChartMes;
