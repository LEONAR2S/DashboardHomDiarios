import * as echarts from 'echarts';
import { useEffect, useRef, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FaDownload,
  FaFilePdf,
  FaChartBar,
  FaChartLine,
} from 'react-icons/fa';

interface Datos {
  fecha: string; // formato dd/mm/yyyy
  valor: number;
}

const BarChartFecha = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [data, setData] = useState<Datos[]>([]);
  const [sortedData, setSortedData] = useState<Datos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const [showAverage, setShowAverage] = useState(true);
  const [showStdDev, setShowStdDev] = useState(false);
  const [showCV, setShowCV] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const ddmmyyyyToISO = (s: string) => {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  };

  const { minISO, maxISO } = useMemo(() => {
    if (!data.length) return { minISO: '', maxISO: '' };
    const allISO = data.map(d => ddmmyyyyToISO(d.fecha)).sort();
    return { minISO: allISO[0], maxISO: allISO[allISO.length - 1] };
  }, [data]);

  const valores = useMemo(() => sortedData.map(d => d.valor), [sortedData]);

  const media = useMemo(() => (
    valores.length ? valores.reduce((sum, v) => sum + v, 0) / valores.length : 0
  ), [valores]);

  const stdDev = useMemo(() => {
    if (valores.length < 2) return 0;
    const sumSq = valores.reduce((sum, v) => sum + Math.pow(v - media, 2), 0);
    return Math.sqrt(sumSq / (valores.length - 1));
  }, [valores, media]);

  const coefVar = useMemo(() => (media ? stdDev / media : 0), [stdDev, media]);
  const countAbove = useMemo(() => valores.filter(v => v > media).length, [valores, media]);
  const countBelow = useMemo(() => valores.filter(v => v < media).length, [valores, media]);

  useEffect(() => {
    fetch('/data/Fecha.json')
      .then(res => res.json())
      .then((json: Datos[]) => setData(json));
  }, []);

  useEffect(() => {
    if (minISO && maxISO) {
      setStartDate(minISO);
      setEndDate(maxISO);
    }
  }, [minISO, maxISO]);

  useEffect(() => {
    if (!startDate || !endDate) return;

    const filtered = data.filter(d => {
      const iso = ddmmyyyyToISO(d.fecha);
      return iso >= startDate && iso <= endDate;
    });

    const ordenado = [...filtered].sort((a, b) =>
      ddmmyyyyToISO(a.fecha).localeCompare(ddmmyyyyToISO(b.fecha))
    );

    setSortedData(ordenado);
  }, [data, startDate, endDate]);

  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const options: echarts.EChartsOption = {
      title: { text: 'Homicidios por Fecha' },
      tooltip: { trigger: 'axis' },
      graphic: showAverage
        ? [
            {
              type: 'text',
              left: '5%',
              top: '12%',
              style: {
                text: `Media: ${media.toFixed(2)}`,
                fill: 'red',
                font: '16px sans-serif',
                fontWeight: 'bold',
              },
            },
          ]
        : [],
      dataZoom: [
        { type: 'slider', xAxisIndex: 0, start: 0, end: 100, bottom: 0 },
        { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
      ],
      grid: { top: showAverage ? 100 : 60, left: 50, right: 20, bottom: 70 },
      xAxis: {
        type: 'category',
        data: sortedData.map(d => d.fecha),
        axisLabel: { rotate: 45, interval: 0, fontSize: 10 },
        axisTick: { alignWithLabel: true },
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: chartType,
          data: sortedData.map(d => d.valor),
          smooth: chartType === 'line',
label: {
  show: true,
  position: chartType === 'bar' ? 'top' : 'right',
  fontSize: 10,
  formatter: (params) => {
    const val = typeof params.value === 'number' ? params.value : Number(params.value);
    return val.toLocaleString();
  },
},
          ...(showAverage && valores.length
            ? {
                markLine: {
                  symbol: 'none',
                  data: [{ yAxis: media }],
                  lineStyle: { type: 'dashed', color: 'red', width: 2 },
                },
              }
            : {}),
        },
      ],
      animationDuration: 300,
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

  const applyLastN = (n: number) => {
    const chart = chartInstanceRef.current;
    if (!chart || !sortedData.length) return;

    const start = sortedData[Math.max(0, sortedData.length - n)].fecha;
    const end = sortedData[sortedData.length - 1].fecha;

    chart.dispatchAction({
      type: 'dataZoom',
      startValue: start,
      endValue: end,
    });
  };

  const exportImage = () => {
    if (!chartRef.current) return;

    const chart = chartInstanceRef.current ?? echarts.getInstanceByDom(chartRef.current);
    const url = chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });

    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grafica_fecha.png';
      a.click();
    }
  };

  const exportPDF = async () => {
    if (!chartRef.current) return;

    const canvas = await html2canvas(chartRef.current);
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 10, w, h);
    pdf.save('grafica_fecha.pdf');
  };

  return (
    <div style={{ position: 'relative', padding: '1rem', background: '#fff', marginBottom: '2rem', border: '1px solid #ccc', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginBottom: 10 }}>
        <button onClick={exportImage} style={buttonStyle}><FaDownload /></button>
        <button onClick={exportPDF} style={buttonStyle}><FaFilePdf /></button>
        <button onClick={() => setChartType(prev => prev === 'bar' ? 'line' : 'bar')} style={buttonStyle}>
          {chartType === 'bar' ? <FaChartLine /> : <FaChartBar />}
        </button>
        <button onClick={() => applyLastN(30)} style={buttonStyle}>Últ. 30</button>
        <input type="date" value={startDate} min={minISO} max={endDate} onChange={e => setStartDate(e.target.value)} style={dateInput} />
        <input type="date" value={endDate} min={startDate} max={maxISO} onChange={e => setEndDate(e.target.value)} style={dateInput} />
        <button onClick={() => { setStartDate(minISO); setEndDate(maxISO); }} style={buttonStyle}>Rango completo</button>
        <button onClick={() => setShowAverage(p => !p)} style={buttonStyle}>{showAverage ? 'Ocultar Media' : 'Mostrar Media'}</button>
        <button onClick={() => setShowStdDev(p => !p)} style={buttonStyle}>{showStdDev ? 'Ocultar SD' : 'Mostrar SD'}</button>
        <button onClick={() => setShowCV(p => !p)} style={buttonStyle}>{showCV ? 'Ocultar CV' : 'Mostrar CV'}</button>
      </div>

      {(showAverage || showStdDev || showCV) && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          {showAverage && <>📌 Media: {media.toFixed(2)} · 🔺 Fechas por encima: {countAbove} · 🔻 Fechas por debajo: {countBelow}</>}
          {showStdDev && <div>📉 Desviación estándar: {stdDev.toFixed(2)}</div>}
          {showCV && <div>📊 Coeficiente de variación: {(coefVar * 100).toFixed(2)}%</div>}
        </div>
      )}

      <div ref={chartRef} style={{ width: '100%', height: 520, minHeight: 300 }} />
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

const dateInput: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 12,
};

export default BarChartFecha;
