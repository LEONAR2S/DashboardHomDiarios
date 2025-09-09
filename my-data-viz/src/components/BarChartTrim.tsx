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
  trimestre: string;
  valor: number;
}

const TRIM_ORDENADOS = ['Trim 1', 'Trim 2', 'Trim 3', 'Trim 4'];

const BarChartTrim = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Datos[]>([]);
  const [sortedData, setSortedData] = useState<Datos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('pie');
  const [showAsPercentage, setShowAsPercentage] = useState(false);

  const total = useMemo(() => {
    return data.reduce((acc, cur) => acc + cur.valor, 0);
  }, [data]);

  useEffect(() => {
    fetch('/data/Trim.json')
      .then(res => res.json())
      .then(json => {
        setData(json);
        ordenarPorTrimestreNatural(json);
      });
  }, []);

  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    const chart = echarts.init(chartRef.current);

    const seriesData = sortedData.map(item => {
      const value = showAsPercentage
        ? parseFloat(((item.valor * 100) / total).toFixed(2))
        : item.valor;

      return {
        name: item.trimestre,
        value,
      };
    });

    const options =
      chartType === 'pie'
        ? {
            title: { text: 'Homicidios Diarios por Trimestre' },
            tooltip: {
              trigger: 'item',
              formatter: (params: any) =>
                showAsPercentage
                  ? `${params.name}: ${params.value.toFixed(2)}%`
                  : `${params.name}: ${params.value.toLocaleString()} (${params.percent}%)`,
            },
            series: [
              {
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['50%', '50%'],
                data: seriesData,
                label: {
                  show: true,
                  formatter: (info: any) =>
                    showAsPercentage
                      ? `${info.name}: ${info.value.toFixed(2)}%`
                      : `${info.name}: ${info.value.toLocaleString()} (${info.percent}%)`,
                },
              },
            ],
          }
        : {
            title: { text: 'Homicidios Diarios por Trimestre' },
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const val = params[0].value;
                const name = params[0].name;
                return showAsPercentage
                  ? `${name}: ${val.toFixed(2)}%`
                  : `${name}: ${val.toLocaleString()} homicidios`;
              },
            },
            xAxis: {
              type: 'category',
              data: sortedData.map(item => item.trimestre),
              axisLabel: { rotate: 0, interval: 0 },
            },
            yAxis: { type: 'value' },
            series: [
              {
                type: 'bar',
                data: sortedData.map(item =>
                  showAsPercentage
                    ? parseFloat(((item.valor * 100) / total).toFixed(2))
                    : item.valor
                ),
                label: {
                  show: true,
                  position: 'top',
                  fontSize: 12,
                  color: '#333',
                  formatter: (val: any) =>
                    showAsPercentage
                      ? `${val.value.toFixed(2)}%`
                      : val.value.toLocaleString(),
                },
              },
            ],
          };

    chart.setOption(options);

    // ✅ Redimensionar automáticamente al hacer zoom o cambiar de tamaño
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [sortedData, chartType, showAsPercentage, total]);

  const ordenarPorTrimestreNatural = (baseData: Datos[] = data) => {
    const ordenada = [...baseData].sort(
      (a, b) =>
        TRIM_ORDENADOS.indexOf(a.trimestre) -
        TRIM_ORDENADOS.indexOf(b.trimestre)
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
    const base64 = chart?.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff',
    });
    if (base64) {
      const link = document.createElement('a');
      link.href = base64;
      link.download = 'grafica_trimestres.png';
      link.click();
    }
  };

  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
    pdf.save('grafica_trimestres.pdf');
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
        alignItems: 'center',
      }}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}>
          <FaDownload />
        </button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}>
          <FaFilePdf />
        </button>
        <button onClick={() => ordenarPorTrimestreNatural()} title="Ordenar por Trimestre" style={buttonStyle}>
          <FaSortAlphaDown />
        </button>
        <button onClick={ordenarPorValor} title="Ordenar por Valor" style={buttonStyle}>
          <FaSortAmountDown />
        </button>
        <button
          onClick={() => setShowAsPercentage(prev => !prev)}
          title="Mostrar como porcentaje"
          style={buttonStyle}
        >
          {showAsPercentage ? '%' : '#'}
        </button>
        <button
          onClick={() => setChartType(prev => (prev === 'bar' ? 'pie' : 'bar'))}
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

export default BarChartTrim;
