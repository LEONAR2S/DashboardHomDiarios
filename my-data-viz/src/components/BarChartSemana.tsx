import * as echarts from 'echarts';
import { useEffect, useRef, useState } from 'react';
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
        {
          type: 'slider',
          show: false,
          xAxisIndex: 0,
          start: 0,
          end: 100,
          height: 20,
          bottom: 0,
        },
        {
          type: 'inside',
          xAxisIndex: 0,
          start: 0,
          end: 100
        }
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
  }, [sortedData, chartType]);

  const ordenarPorSemana = (baseData: Datos[] = data) => {
    const ordenada = [...baseData].sort((a, b) => {
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
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        gap: '10px',
        zIndex: 10,
      }}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}><FaDownload /></button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}><FaFilePdf /></button>
        <button onClick={() => ordenarPorSemana()} title="Ordenar por Semana" style={buttonStyle}><FaSortAlphaDown /></button>
        <button onClick={ordenarPorValor} title="Ordenar por Valor" style={buttonStyle}><FaSortAmountDown /></button>
        <button onClick={() => setChartType(chartType === 'bar' ? 'line' : 'bar')} title="Cambiar tipo de gráfico" style={buttonStyle}>
          {chartType === 'bar' ? <FaChartLine /> : <FaChartBar />}
        </button>
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '450px' }} />
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '16px',
  padding: '4px',
};

export default BarChartSemana;
