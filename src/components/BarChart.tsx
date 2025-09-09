import * as echarts from 'echarts';
import { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FaDownload, FaFilePdf, FaSortAlphaDown, FaSortAmountDown } from 'react-icons/fa';

interface Datos {
  mes: string;
  valor: number;
}

interface Props {
  data: Datos[];
}

const MESES_ORDENADOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const BarChart = ({ data }: Props) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [sortedData, setSortedData] = useState<Datos[]>([]);

  // Orden predeterminado por mes natural
  useEffect(() => {
    ordenarPorMesNatural();
  }, [data]);

  // Renderizar gráfico cuando cambia sortedData
  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    const chart = echarts.init(chartRef.current);

    chart.setOption({
      title: { text: 'Ventas por Mes' },
      tooltip: {},
      xAxis: {
        type: 'category',
        data: sortedData.map((item: Datos) => item.mes),
        axisLabel: {
          rotate: 45,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          type: 'bar',
          data: sortedData.map((item: Datos) => item.valor),
                label: {
        show: true,
        position: 'top',
        fontSize: 12,
        color: '#333',
         formatter: (value: any) => {
        return value.value.toLocaleString(); // Agrega separador de miles
      },
      },
        },
      ],
    });

    return () => {
      chart.dispose();
    };
  }, [sortedData]);

  // Ordenar por mes natural
  const ordenarPorMesNatural = () => {
    const dataOrdenada = [...data].sort((a, b) => {
      return MESES_ORDENADOS.indexOf(a.mes) - MESES_ORDENADOS.indexOf(b.mes);
    });
    setSortedData(dataOrdenada);
  };

  // Ordenar por valor descendente
  const ordenarPorValor = () => {
    const dataOrdenada = [...data].sort((a, b) => b.valor - a.valor);
    setSortedData(dataOrdenada);
  };

  // Descargar imagen PNG
  const handleDownloadImage = () => {
    if (!chartRef.current) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    const base64 = chart?.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff',
    });
    if (base64) {
      const link = document.createElement('a');
      link.href = base64;
      link.download = 'grafica.png';
      link.click();
    }
  };

  // Descargar PDF
  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
    pdf.save('grafica.pdf');
  };

  return (
    <div style={{
      position: 'relative',
      padding: '1rem',
      border: '1px solid #ccc',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      background: '#fff',
      marginTop: '1rem',
    }}>
      {/* Botones */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        gap: '10px',
        zIndex: 10,
      }}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}>
          <FaDownload />
        </button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}>
          <FaFilePdf />
        </button>
        <button onClick={ordenarPorMesNatural} title="Ordenar por mes" style={buttonStyle}>
          <FaSortAlphaDown />
        </button>
        <button onClick={ordenarPorValor} title="Ordenar por valor descendente" style={buttonStyle}>
          <FaSortAmountDown />
        </button>
      </div>

      {/* Contenedor gráfico */}
      <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
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
