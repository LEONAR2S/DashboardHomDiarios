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

// 🧾 Estructura del JSON
interface HidrocarburoDatos {
  entidad: string;
  [key: string]: string | number; // 🔥 Permite claves dinámicas tipo 'Gas LP' o 'No_identificado'
}

// ⚙️ Componente principal
const BarChartHidrocarburos = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  // 📊 Estados de datos

  const [filteredData, setFilteredData] = useState<HidrocarburoDatos[]>([]);
  const [sortedData, setSortedData] = useState<HidrocarburoDatos[]>([]);

  // 🧭 Configuraciones visuales
  const [chartType, setChartType] = useState<'bar' | 'treemap'>('bar');
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [showAverageLine, setShowAverageLine] = useState(false);
  const [useGradientColor, setUseGradientColor] = useState(true);

  // ✅ Valor por defecto: Gasolina y todas las entidades
  const [selectedHidrocarburo, setSelectedHidrocarburo] = useState<string>('Gasolina');

  // 📉 Leyendas dinámicas
  const [leyenda50, setLeyenda50] = useState<{ entidades: number; porcentaje: number } | null>(null);
  const [leyendaTop10, setLeyendaTop10] = useState<{ total: number; porcentaje: number } | null>(null);



//////////////////////////////

    // ✅ Cargar datos JSON desde /data/Hidrocarb.json
useEffect(() => {
  fetch('/data/Hidrocarb.json')
    .then(res => res.json())
    .then((json: HidrocarburoDatos[]) => {
      setFilteredData(json);
      setSortedData(json);
    });
}, []);

  // ✅ Calcular total nacional del hidrocarburo seleccionado
  const calcularTotal = (d: HidrocarburoDatos): number =>
    d[selectedHidrocarburo as keyof HidrocarburoDatos] as number;

  // 🧮 Totales y promedios
  const total = useMemo(
    () => filteredData.reduce((sum, d) => sum + calcularTotal(d), 0),
    [filteredData, selectedHidrocarburo]
  );

  const promedio = useMemo(
    () => (filteredData.length > 0 ? total / filteredData.length : 0),
    [total, filteredData]
  );

  // 📊 Conteo de entidades arriba/abajo del promedio
  const countAbove = useMemo(
    () => filteredData.filter((d) => calcularTotal(d) > promedio).length,
    [filteredData, promedio]
  );

  const countBelow = useMemo(
    () => filteredData.length - countAbove,
    [filteredData, countAbove]
  );

  // 🔤 Ordenar por nombre A→Z
  const ordenarPorNombre = (base: HidrocarburoDatos[] = filteredData) => {
    const sorted = [...base].sort((a, b) => a.entidad.localeCompare(b.entidad));
    setSortedData(sorted);
  };

  // 📈 Ordenar por valor (mayor a menor)
  const ordenarPorValor = (base: HidrocarburoDatos[] = filteredData) => {
    const sorted = [...base].sort((a, b) => calcularTotal(b) - calcularTotal(a));
    setSortedData(sorted);
  };

  // 🏆 Mostrar Top 10 entidades
  const mostrarTop10 = () => {
    const sorted = [...filteredData].sort((a, b) => calcularTotal(b) - calcularTotal(a));
    const top10 = sorted.slice(0, 10);
    const totalTop10 = top10.reduce((sum, d) => sum + calcularTotal(d), 0);
    const porcentaje = parseFloat(((totalTop10 * 100) / total).toFixed(1));
    setLeyendaTop10({ total: totalTop10, porcentaje });
    setSortedData(top10);
  };

  // 💯 Mostrar +50% del total nacional
  const mostrarTop50Porciento = () => {
    const sorted = [...filteredData].sort((a, b) => calcularTotal(b) - calcularTotal(a));
    let acumulado = 0;
    const subset: HidrocarburoDatos[] = [];
    for (const item of sorted) {
      const val = calcularTotal(item);
      acumulado += val;
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

    // Inicializa o reutiliza la instancia del gráfico
    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    // Calcular rangos para colores gradientes
    const minVal = Math.min(...sortedData.map((d) => calcularTotal(d)));
    const maxVal = Math.max(...sortedData.map((d) => calcularTotal(d)));

    // 🎨 Gradiente verde → rojo según intensidad
    const getColorGradient = (value: number, min: number, max: number) => {
      const ratio = (value - min) / (max - min || 1);
      const r = Math.round(0 + ratio * 255);
      const g = Math.round(255 - ratio * 255);
      return `rgb(${r},${g},0)`; // Verde → Rojo
    };

    // Ejes y valores
    const labels = sortedData.map((d) => d.entidad);
    const values = sortedData.map((d) => calcularTotal(d));

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
    const titleText = `Volumen de ${selectedHidrocarburo} por entidad (litros o unidades registradas)`;

    // ⚙️ Opciones según tipo de gráfico
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
                  ? `${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
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
              name: showAsPercentage ? '%' : 'Volumen',
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
                    ? params.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
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
                        ? info.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : '–'
                    }`,
                },
                itemStyle: {
                  borderColor: '#fff',
                  borderWidth: 1,
                },
                data: sortedData.map((item) => {
                  const val = calcularTotal(item);
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
    selectedHidrocarburo,
  ]);


  //////////////////////


    // ✅ Descarga como imagen PNG
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
      link.download = `grafica_hidrocarburos_${selectedHidrocarburo}.png`;
      link.click();
    }
  };

  // ✅ Descarga como PDF
  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
    pdf.save(`grafica_hidrocarburos_${selectedHidrocarburo}.pdf`);
  };

  // 🔽 Hidrocarburos disponibles
  const tiposDisponibles = [
    'Gasolina',
    'Diésel',
    'Petróleo',
    'Gas LP',
    'Combustóleo',
    'Otros',
    'No_identificado',
  ];

  // 🧱 Renderizado principal
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

      {/* 🔽 Selector de tipo de hidrocarburo */}
      <div style={selectorsStyle}>
        <div>
          <label>
            <b>Tipo de hidrocarburo:</b>
          </label>
          <select
            value={selectedHidrocarburo}
            onChange={(e) => setSelectedHidrocarburo(e.target.value)}
            style={selectStyle}
          >
            {tiposDisponibles.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 📈 Contenedor del gráfico */}
      <div ref={chartRef} style={{ width: '100%', height: '500px', minHeight: '300px' }} />
    </div>
  );
};


///////


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

const selectorsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-start',
  gap: '20px',
  marginBottom: '15px',
  flexWrap: 'wrap',
};

const selectStyle: React.CSSProperties = {
  marginLeft: '10px',
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid #ccc',
  fontSize: '14px',
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

// 🚀 Exportación final
export default BarChartHidrocarburos;
