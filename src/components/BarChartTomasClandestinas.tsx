// 📦 PARTE 1 — Imports, interfaz y estados iniciales
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
  FaSitemap,
} from 'react-icons/fa';

// 🧾 Estructura de los datos del JSON
interface TomasClandestinasDatos {
  entidad: string;
  tomas_clandestinas: number;
}

// ⚙️ Componente principal
const BarChartTomasClandestinas = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  // 📊 Estados principales
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [filteredData, setFilteredData] = useState<TomasClandestinasDatos[]>([]);
  const [sortedData, setSortedData] = useState<TomasClandestinasDatos[]>([]);

  // 🎨 Opciones visuales
  const [chartType, setChartType] = useState<'bar' | 'treemap'>('bar');
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [showAverageLine, setShowAverageLine] = useState(false);
  const [useGradientColor, setUseGradientColor] = useState(true);

  // 📉 Leyendas dinámicas
  const [leyenda50, setLeyenda50] = useState<{ entidades: number; porcentaje: number } | null>(null);
  const [leyendaTop10, setLeyendaTop10] = useState<{ total: number; porcentaje: number } | null>(null);



    // ✅ Cargar datos JSON desde /data/TomasCland.json
useEffect(() => {
  fetch('/data/TomasCland.json')
    .then((res) => res.json())
    .then((json: TomasClandestinasDatos[]) => {
      setFilteredData(json);
      setSortedData(json);
    })
    .catch((err) => console.error('Error cargando datos:', err));
}, []);

  // ✅ Calcular total nacional
  const total = useMemo(
    () => filteredData.reduce((sum, d) => sum + d.tomas_clandestinas, 0),
    [filteredData]
  );

  // ✅ Calcular promedio nacional
  const promedio = useMemo(
    () => (filteredData.length > 0 ? total / filteredData.length : 0),
    [total, filteredData]
  );

  // 📊 Conteo de entidades arriba/abajo del promedio
  const countAbove = useMemo(
    () => filteredData.filter((d) => d.tomas_clandestinas > promedio).length,
    [filteredData, promedio]
  );

  const countBelow = useMemo(
    () => filteredData.length - countAbove,
    [filteredData, countAbove]
  );

  // 🔤 Ordenar por nombre (A→Z)
  const ordenarPorNombre = (base: TomasClandestinasDatos[] = filteredData) => {
    const sorted = [...base].sort((a, b) => a.entidad.localeCompare(b.entidad));
    setSortedData(sorted);
  };

  // 📈 Ordenar por valor (mayor a menor)
  const ordenarPorValor = (base: TomasClandestinasDatos[] = filteredData) => {
    const sorted = [...base].sort((a, b) => b.tomas_clandestinas - a.tomas_clandestinas);
    setSortedData(sorted);
  };

  // 🏆 Mostrar Top 10 entidades
  const mostrarTop10 = () => {
    const sorted = [...filteredData].sort((a, b) => b.tomas_clandestinas - a.tomas_clandestinas);
    const top10 = sorted.slice(0, 10);
    const totalTop10 = top10.reduce((sum, d) => sum + d.tomas_clandestinas, 0);
    const porcentaje = parseFloat(((totalTop10 * 100) / total).toFixed(1));
    setLeyendaTop10({ total: totalTop10, porcentaje });
    setSortedData(top10);
  };

  // 💯 Mostrar +50% del total nacional
  const mostrarTop50Porciento = () => {
    const sorted = [...filteredData].sort((a, b) => b.tomas_clandestinas - a.tomas_clandestinas);
    let acumulado = 0;
    const subset: TomasClandestinasDatos[] = [];
    for (const item of sorted) {
      acumulado += item.tomas_clandestinas;
      subset.push(item);
      if (acumulado / total >= 0.5) break;
    }
    const porcentaje = parseFloat(((acumulado * 100) / total).toFixed(1));
    setLeyenda50({ entidades: subset.length, porcentaje });
    setSortedData(subset);
  };

  // 🔄 Restablecer vista original
  const restablecerVistaOriginal = () => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    setShowAverageLine(false);
    setSortedData(filteredData);
  };


    // ✅ Renderizar gráfico con ECharts
  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    // Crear o reutilizar instancia del gráfico
    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    // Calcular mínimo y máximo para escala de color
    const minVal = Math.min(...sortedData.map((d) => d.tomas_clandestinas));
    const maxVal = Math.max(...sortedData.map((d) => d.tomas_clandestinas));

    // 🎨 Gradiente verde → rojo
    const getColorGradient = (value: number, min: number, max: number) => {
      const ratio = (value - min) / (max - min || 1);
      const r = Math.round(0 + ratio * 255);
      const g = Math.round(255 - ratio * 255);
      return `rgb(${r},${g},0)`; // Verde → Rojo
    };

    // Etiquetas (entidades)
    const labels = sortedData.map((d) => d.entidad);
    const values = sortedData.map((d) => d.tomas_clandestinas);

    // 📊 Serie principal (barras)
    const baseSeries: echarts.SeriesOption = {
      type: 'bar',
      data: values.map((val) => ({
        value: showAsPercentage ? parseFloat(((val * 100) / total).toFixed(2)) : val,
        itemStyle: {
          color:
            val === 0
              ? '#e5e7eb'
              : useGradientColor
              ? getColorGradient(val, minVal, maxVal)
              : '#2563eb',
        },
      })),
      label: {
        show: true,
        position: 'top',
        fontSize: 10,
        color: '#333',
        formatter: (v: any) =>
          v.value > 0
            ? showAsPercentage
              ? `${v.value.toFixed(2)}%`
              : v.value.toLocaleString(undefined, { maximumFractionDigits: 0 })
            : '–',
      },
    };

    // 📈 Línea de promedio opcional
    if (showAverageLine) {
      (baseSeries as any).markLine = {
        symbol: 'none',
        data: [
          {
            yAxis: promedio,
            lineStyle: { type: 'dashed', color: 'red', width: 2 },
          },
        ],
      };
    }

    // 🏷️ Título dinámico
    const titleText = `Tomas clandestinas por entidad federativa`;

    // ⚙️ Configuración de opciones según tipo de gráfico
    const options: echarts.EChartsOption =
      chartType === 'bar'
        ? {
            title: {
              text: titleText,
              left: 'center',
              textStyle: { fontSize: 14, fontWeight: 'bold' },
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'shadow' },
              formatter: (params: any) => {
                const label = params[0].name;
                const val = params[0].value;
                const formatted = showAsPercentage
                  ? `${val.toFixed(2)}%`
                  : val > 0
                  ? `${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : 'Sin registro';
                return `<b>${label}</b><br/>${formatted}`;
              },
            },
            grid: { left: '3%', right: '3%', bottom: 60, top: 70, containLabel: true },
            xAxis: {
              type: 'category',
              data: labels,
              axisLabel: { rotate: 45, interval: 0, fontSize: 10 },
            },
            yAxis: {
              type: 'value',
              name: showAsPercentage ? '%' : 'Número de tomas',
              nameTextStyle: { fontWeight: 'bold' },
            },
            series: [baseSeries],
          }
        : {
            title: { text: titleText, left: 'center' },
            tooltip: {
              formatter: (params: any) =>
                `${params.marker ?? ''} <b>${params.name}</b><br/>${
                  params.value > 0
                    ? params.value.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : 'Sin registro'
                }`,
            },
            series: [
              {
                type: 'treemap',
                roam: false,
                nodeClick: false,
                label: {
                  show: true,
                  formatter: (info: any) =>
                    `${info.name}\n${
                      info.value > 0
                        ? info.value.toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : '–'
                    }`,
                },
                itemStyle: {
                  borderColor: '#fff',
                  borderWidth: 1,
                },
                data: sortedData.map((item) => {
                  const val = item.tomas_clandestinas;
                  const color =
                    val === 0
                      ? '#e5e7eb'
                      : useGradientColor
                      ? getColorGradient(val, minVal, maxVal)
                      : '#2563eb';
                  return {
                    name: item.entidad,
                    value: val,
                    itemStyle: { color },
                  };
                }),
              },
            ],
          };

    // Renderizar
    chart.setOption(options);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    // Limpiar al desmontar
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [
    sortedData,
    chartType,
    showAsPercentage,
    total,
    promedio,
    showAverageLine,
    useGradientColor,
  ]);


    // ✅ Descargar gráfico como imagen PNG
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
      link.download = `grafica_tomas_clandestinas.png`;
      link.click();
    }
  };

  // ✅ Descargar gráfico como PDF
  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
    pdf.save(`grafica_tomas_clandestinas.pdf`);
  };

  // 🧱 Renderizado principal del componente
  return (
    <div style={wrapperStyle}>
      {/* 🧭 Barra de herramientas */}
      <div style={toolbarStyle}>
        <button onClick={handleDownloadImage} title="Descargar imagen" style={buttonStyle}>
          <FaDownload />
        </button>
        <button onClick={handleDownloadPDF} title="Descargar PDF" style={buttonStyle}>
          <FaFilePdf />
        </button>
        <button onClick={() => ordenarPorNombre()} title="Ordenar A→Z" style={buttonStyle}>
          <FaSortAlphaDown />
        </button>
        <button onClick={() => ordenarPorValor()} title="Ordenar por valor" style={buttonStyle}>
          <FaSortAmountDown />
        </button>
        <button
          onClick={() => setUseGradientColor((p) => !p)}
          title="Gradiente de color"
          style={buttonStyle}
        >
          {useGradientColor ? 'Gradiente ✔' : 'Gradiente ✘'}
        </button>
        <button onClick={mostrarTop10} title="Top 10 entidades" style={buttonStyle}>
          Top 10
        </button>
        <button onClick={mostrarTop50Porciento} title="+50% del total nacional" style={buttonStyle}>
          +50%
        </button>
        <button
          onClick={() => setChartType((p) => (p === 'bar' ? 'treemap' : 'bar'))}
          title="Cambiar vista"
          style={buttonStyle}
        >
          {chartType === 'bar' ? <FaSitemap /> : <FaChartBar />}
        </button>
        <button
          onClick={() => setShowAsPercentage((p) => !p)}
          title="Mostrar en porcentaje"
          style={buttonStyle}
        >
          {showAsPercentage ? '%' : '#'}
        </button>
        <button
          onClick={() => setShowAverageLine((p) => !p)}
          title="Línea de promedio"
          style={buttonStyle}
        >
          {showAverageLine ? '🔴 Promedio' : '⚪ Promedio'}
        </button>
        <button onClick={restablecerVistaOriginal} title="Restablecer vista" style={buttonStyle}>
          ⟳
        </button>
      </div>

      {/* 📊 Leyendas dinámicas */}
      {showAverageLine && (
        <div style={legendBoxStyle}>
          🔺 {countAbove} por encima · 🔻 {countBelow} por debajo del promedio
        </div>
      )}
      {leyenda50 && (
        <div style={legendBoxStyle}>
          {leyenda50.entidades} entidades concentran el {leyenda50.porcentaje}%
        </div>
      )}
      {leyendaTop10 && (
        <div style={legendBoxStyle}>
          Top 10 acumulan {leyendaTop10.total.toLocaleString()} ({leyendaTop10.porcentaje}%)
        </div>
      )}

      {/* 📈 Contenedor del gráfico */}
      <div ref={chartRef} style={{ width: '100%', height: '500px', minHeight: '300px' }} />
    </div>
  );
};


// 🎨 Estilos globales del componente
const wrapperStyle: React.CSSProperties = {
  position: 'relative',
  padding: '1rem',
  border: '1px solid #ccc',
  borderRadius: '8px',
  background: '#fff',
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  marginBottom: '2rem',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: '10px',
  marginBottom: '10px',
  alignItems: 'center',
};

const buttonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #ddd',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '14px',
  padding: '6px 8px',
  transition: 'all 0.2s',
};

const legendBoxStyle: React.CSSProperties = {
  backgroundColor: '#f9f9f9',
  color: '#555',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  marginBottom: '10px',
};

// 🚀 Exportación final del componente
export default BarChartTomasClandestinas;
