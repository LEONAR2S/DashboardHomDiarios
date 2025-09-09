import * as echarts from 'echarts';
import { useEffect, useRef, useState } from 'react';
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

const BarChart = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Datos[]>([]);
  const [sortedData, setSortedData] = useState<Datos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

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
            tooltip: {},
            xAxis: {
              type: 'category',
              data: sortedData.map(item => item.mes),
              axisLabel: {
                rotate: 45,
                interval: 0,
              },
            },
            yAxis: { type: 'value' },
            series: [
              {
                type: 'bar',
                data: sortedData.map(item => item.valor),
                label: {
                  show: true,
                  position: 'top',
                  fontSize: 12,
                  color: '#333',
                  formatter: (val: any) => val.value.toLocaleString(),
                },
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
                data: sortedData.map(item => ({
                  name: item.mes,
                  value: item.valor,
                })),
                label: {
                  formatter: '{b}\n{c} ({d}%)',
                },
              },
            ],
          };

    chart.setOption(options);

    // ✅ Hacer la gráfica responsive
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [sortedData, chartType]);

  const ordenarPorMesNatural = (baseData: Datos[] = data) => {
    const ordenada = [...baseData].sort(
      (a, b) => MESES_ORDENADOS.indexOf(a.mes) - MESES_ORDENADOS.indexOf(b.mes)
    );
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
    <div
      style={{
        position: 'relative',
        padding: '1rem',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        background: '#fff',
        marginTop: '1rem',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          gap: '10px',
          zIndex: 10,
        }}
      >
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}>
          <FaDownload />
        </button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}>
          <FaFilePdf />
        </button>
        <button onClick={() => ordenarPorMesNatural()} title="Ordenar por mes" style={buttonStyle}>
          <FaSortAlphaDown />
        </button>
        <button onClick={ordenarPorValor} title="Ordenar por valor descendente" style={buttonStyle}>
          <FaSortAmountDown />
        </button>
        <button
          onClick={() => setChartType(chartType === 'bar' ? 'pie' : 'bar')}
          title="Cambiar tipo de gráfico"
          style={buttonStyle}
        >
          {chartType === 'bar' ? <FaChartPie /> : <FaChartBar />}
        </button>
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '400px', minHeight: 300 }} />
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

export default BarChart;
