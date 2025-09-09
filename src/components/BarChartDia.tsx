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
  dia_nombre: string;
  valor: number;
}

const DIAS_ORDENADOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const BarChartDia = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [data, setData] = useState<Datos[]>([]);
  const [sortedData, setSortedData] = useState<Datos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('pie');

  useEffect(() => {
    fetch('/data/Dia.json')
      .then(res => res.json())
      .then(json => {
        setData(json);
        ordenarPorDiaNatural(json);
      });
  }, []);

  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const options =
      chartType === 'bar'
        ? {
            title: { text: 'Homicidios Diarios por Día de la Semana' },
            tooltip: {},
            xAxis: {
              type: 'category',
              data: sortedData.map(item => item.dia_nombre),
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
            title: { text: 'Distribución de Homicidios por Día (Pastel)' },
            tooltip: {
              trigger: 'item',
              formatter: '{b}: {c} ({d}%)',
            },
            series: [
              {
                type: 'pie',
                radius: '60%',
                data: sortedData.map(item => ({
                  name: item.dia_nombre,
                  value: item.valor,
                })),
                label: {
                  formatter: '{b}\n{c} ({d}%)',
                },
              },
            ],
          };

    chart.setOption(options);

    const resizeHandler = () => chart.resize();
    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [sortedData, chartType]);

  const ordenarPorDiaNatural = (baseData: Datos[] = data) => {
    const ordenada = [...baseData].sort(
      (a, b) => DIAS_ORDENADOS.indexOf(a.dia_nombre) - DIAS_ORDENADOS.indexOf(b.dia_nombre)
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
      link.download = 'grafica_dia.png';
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
    pdf.save('grafica_dia.pdf');
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
        }}
      >
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}>
          <FaDownload />
        </button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}>
          <FaFilePdf />
        </button>
        <button onClick={() => ordenarPorDiaNatural()} title="Ordenar por Día" style={buttonStyle}>
          <FaSortAlphaDown />
        </button>
        <button onClick={ordenarPorValor} title="Ordenar por Valor" style={buttonStyle}>
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

      {/* 📊 Contenedor del gráfico */}
      <div ref={chartRef} style={{ width: '100%', height: '400px', minHeight: '300px' }} />
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

export default BarChartDia;
