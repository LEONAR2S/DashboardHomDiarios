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
  fecha: string; // fecha historia: dd/mm/yyyy
  valor: number;
}

const BarChartFecha = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [data, setData] = useState<Datos[]>([]);
  const [filteredData, setFilteredData] = useState<Datos[]>([]);
  const [sortedData, setSortedData] = useState<Datos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const ddmmyyyyToISO = (s: string) => {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  };

  const { minISO, maxISO } = useMemo(() => {
    if (!data.length) return { minISO: '', maxISO: '' };
    const allISO = data.map(d => ddmmyyyyToISO(d.fecha)).sort();
    return { minISO: allISO[0], maxISO: allISO[allISO.length - 1] };
  }, [data]);

  useEffect(() => {
    fetch('/data/Fecha.json')
      .then(res => res.json())
      .then((json: Datos[]) => {
        setData(json);
      });
  }, []);

  useEffect(() => {
    if (minISO && maxISO) {
      setStartDate(minISO);
      setEndDate(maxISO);
    }
  }, [minISO, maxISO]);

  useEffect(() => {
    if (!data.length || !startDate || !endDate) return;

    const filtered = data.filter(d => {
      const iso = ddmmyyyyToISO(d.fecha);
      return iso >= startDate && iso <= endDate;
    });
    setFilteredData(filtered);

    const ordenada = [...filtered].sort((a, b) =>
      ddmmyyyyToISO(a.fecha).localeCompare(ddmmyyyyToISO(b.fecha))
    );
    setSortedData(ordenada);
  }, [data, startDate, endDate]);

  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    chart.setOption({
      title: { text: 'Homicidios por Fecha' },
      tooltip: { trigger: 'axis' },
      toolbox: { feature: {} },
      dataZoom: [
        { id: 'slider-zoom', type: 'slider', show: true, xAxisIndex: 0, start: 0, end: 100, bottom: 0 },
        { id: 'inside-zoom', type: 'inside', xAxisIndex: 0, start: 0, end: 100 }
      ],
      grid: { top: 60, left: 50, right: 20, bottom: 70 },
      xAxis: {
        type: 'category',
        data: sortedData.map(item => item.fecha),
        axisLabel: { rotate: 45, interval: 0, fontSize: 10 },
        axisTick: { alignWithLabel: true },
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
        },
      ],
      animationDuration: 300,
    });

    const resizeHandler = () => chart.resize();
    window.addEventListener('resize', resizeHandler);
    return () => {
      window.removeEventListener('resize', resizeHandler);
    };
  }, [sortedData, chartType]);

  useEffect(() => {
    return () => {
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  const ordenarPorFecha = () => {
    const ordenada = [...filteredData].sort((a, b) =>
      ddmmyyyyToISO(a.fecha).localeCompare(ddmmyyyyToISO(b.fecha))
    );
    setSortedData(ordenada);
  };

  const ordenarPorValor = () => {
    const ordenada = [...filteredData].sort((a, b) => b.valor - a.valor);
    setSortedData(ordenada);
  };

  const applyRangeLastN = (n: number) => {
    const chart = chartInstanceRef.current;
    if (!chart || !sortedData.length) return;
    const len = sortedData.length;
    const start = sortedData[Math.max(0, len - n)].fecha;
    const end = sortedData[len - 1].fecha;
    chart.dispatchAction({ type: 'dataZoom', startValue: start, endValue: end, xAxisIndex: 0 });
  };

  const applyCalendarFullRange = () => {
    setStartDate(minISO);
    setEndDate(maxISO);
  };

  const handleDownloadImage = () => {
    if (!chartRef.current) return;
    const chart = chartInstanceRef.current ?? echarts.getInstanceByDom(chartRef.current);
    const base64 = chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    base64 && (document.createElement('a').apply((link) => { link.href = base64; link.download = 'grafica_fecha.png'; link.click(); }) );
  };

  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
    pdf.save('grafica_fecha.pdf');
  };

  return (
    <div style={{
      position: 'relative',
      padding: '1rem',
      border: '1px solid #ccc',
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      background: '#fff',
      marginBottom: '2rem',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
      }}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}><FaDownload /></button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}><FaFilePdf /></button>
        <button onClick={ordenarPorFecha} title="Ordenar por Fecha" style={buttonStyle}><FaSortAlphaDown /></button>
        <button onClick={ordenarPorValor} title="Ordenar por Valor" style={buttonStyle}><FaSortAmountDown /></button>
        <button onClick={() => setChartType(prev => prev === 'bar' ? 'line' : 'bar')} title="Tipo gráfico" style={buttonStyle}>
          {chartType === 'bar' ? <FaChartLine /> : <FaChartBar />}
        </button>
        <button onClick={() => applyRangeLastN(30)} title="Últimos 30 días" style={quickBtn}>Últ. 30</button>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#555' }}>De:</label>
          <input type="date" value={startDate} min={minISO} max={endDate || maxISO} onChange={e => setStartDate(e.target.value)} style={dateInput} />
          <label style={{ fontSize: 12, color: '#555' }}>a:</label>
          <input type="date" value={endDate} min={startDate || minISO} max={maxISO} onChange={e => setEndDate(e.target.value)} style={dateInput} />
          <button onClick={applyCalendarFullRange} title="Rango completo" style={quickBtn}>Rango total</button>
        </div>
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '520px', minHeight: 300 }} />
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

const quickBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid #bbb',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '12px',
  padding: '4px 8px',
};

const dateInput: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 6,
  padding: '4px 6px',
  fontSize: 12,
};

export default BarChartFecha;
