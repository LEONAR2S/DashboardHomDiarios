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

interface NarcoticoDatos {
  entidad: string;
  tipo: string;
  mg: number;
  g: number;
  kg: number;
  t: number;
  litros: number;
  metros: number;
  piezas: number;
  tabletas: number;
  cajas: number;
  otra: number;
  no_identificado: number;
}

type Unidad = 'mg' | 'g' | 'kg' | 't';

const BarChartNarcoticos = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [data, setData] = useState<NarcoticoDatos[]>([]);
  const [filteredData, setFilteredData] = useState<NarcoticoDatos[]>([]);
  const [sortedData, setSortedData] = useState<NarcoticoDatos[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'treemap'>('bar');
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [showAverageLine, setShowAverageLine] = useState(false);
  const [useGradientColor, setUseGradientColor] = useState(true);

  const [selectedNarcotico, setSelectedNarcotico] = useState<string>('Cocaína');
  const [selectedEntidad, setSelectedEntidad] = useState<string>('Todas');
  const [selectedUnidad, setSelectedUnidad] = useState<Unidad>('kg');

  const [leyenda50, setLeyenda50] = useState<{ entidades: number; porcentaje: number } | null>(null);
  const [leyendaTop10, setLeyendaTop10] = useState<{ total: number; porcentaje: number } | null>(null);

  // ✅ Cargar datos JSON
  useEffect(() => {
    fetch('/data/Narcoticos_por_tipo.json')
      .then((res) => res.json())
      .then((json: NarcoticoDatos[]) => setData(json))
      .catch((err) => console.error('Error cargando datos:', err));
  }, []);

  // ✅ Calcular total según unidad seleccionada
  const calcularTotal = (d: NarcoticoDatos): number => {
    switch (selectedUnidad) {
      case 'mg':
        return d.mg;
      case 'g':
        return d.g + d.mg / 1000 + d.kg * 1000 + d.t * 1_000_000;
      case 'kg':
        return d.kg + d.g / 1000 + d.t * 1000;
      case 't':
        return d.t + d.kg / 1000 + d.g / 1_000_000;
      default:
        return 0;
    }
  };

  // ✅ Filtrar datos según narcótico o entidad (mostrar siempre las 32 entidades)
  useEffect(() => {
    if (!data.length) return;

    let result: NarcoticoDatos[] = [];

    if (selectedEntidad === 'Todas') {
      const entidades = Array.from(new Set(data.map((d) => d.entidad))).sort();
      result = entidades.map((entidad) => {
        const registro = data.find((d) => d.entidad === entidad && d.tipo === selectedNarcotico);
        return (
          registro || {
            entidad,
            tipo: selectedNarcotico,
            mg: 0,
            g: 0,
            kg: 0,
            t: 0,
            litros: 0,
            metros: 0,
            piezas: 0,
            tabletas: 0,
            cajas: 0,
            otra: 0,
            no_identificado: 0,
          }
        );
      });
    } else {
      result = data.filter((d) => d.entidad === selectedEntidad);
    }

    setFilteredData(result);
    setSortedData(result);
  }, [data, selectedNarcotico, selectedEntidad, selectedUnidad]);

  // ✅ Totales y promedios
  const total = useMemo(() => filteredData.reduce((sum, d) => sum + calcularTotal(d), 0), [filteredData]);
  const promedio = useMemo(() => (filteredData.length > 0 ? total / filteredData.length : 0), [total, filteredData]);

  const countAbove = useMemo(
    () => filteredData.filter((d) => calcularTotal(d) > promedio).length,
    [filteredData, promedio]
  );
  const countBelow = useMemo(() => filteredData.length - countAbove, [filteredData, countAbove]);

  // ✅ Ordenamientos
  const ordenarPorNombre = (base: NarcoticoDatos[] = filteredData) => {
    const sorted = [...base].sort((a, b) => a.entidad.localeCompare(b.entidad));
    setSortedData(sorted);
  };

  const ordenarPorValor = (base: NarcoticoDatos[] = filteredData) => {
    const sorted = [...base].sort((a, b) => calcularTotal(b) - calcularTotal(a));
    setSortedData(sorted);
  };

  // ✅ Funciones Top 10 y +50%
  const mostrarTop10 = () => {
    const sorted = [...filteredData].sort((a, b) => calcularTotal(b) - calcularTotal(a));
    const top10 = sorted.slice(0, 10);
    const totalTop10 = top10.reduce((sum, d) => sum + calcularTotal(d), 0);
    const porcentaje = parseFloat(((totalTop10 * 100) / total).toFixed(1));
    setLeyendaTop10({ total: totalTop10, porcentaje });
    setSortedData(top10);
  };

  const mostrarTop50Porciento = () => {
    const sorted = [...filteredData].sort((a, b) => calcularTotal(b) - calcularTotal(a));
    let acumulado = 0;
    const subset: NarcoticoDatos[] = [];
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

  const restablecerVistaOriginal = () => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    setShowAverageLine(false);
    setSortedData(filteredData);
  };


    // ✅ Renderizar gráfico con ECharts
  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const minVal = Math.min(...sortedData.map((d) => calcularTotal(d)));
    const maxVal = Math.max(...sortedData.map((d) => calcularTotal(d)));

    // 🎨 Gradiente verde → rojo
    const getColorGradient = (value: number, min: number, max: number) => {
      const ratio = (value - min) / (max - min || 1);
      const r = Math.round(0 + ratio * 255);
      const g = Math.round(255 - ratio * 255);
      return `rgb(${r},${g},0)`; // Verde a rojo
    };

    const labels =
      selectedEntidad === 'Todas'
        ? sortedData.map((d) => d.entidad)
        : sortedData.map((d) => d.tipo);

    const values = sortedData.map((d) => calcularTotal(d));

    // 🧱 Serie principal
    const baseSeries: echarts.SeriesOption = {
      type: 'bar',
      data: values.map((val) => ({
        value: showAsPercentage ? parseFloat(((val * 100) / total).toFixed(2)) : val,
        itemStyle: {
          color:
            val === 0
              ? '#e5e7eb' // Gris claro para entidades sin decomisos
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

    const unidadLabel =
      selectedUnidad === 'mg'
        ? 'Miligramos'
        : selectedUnidad === 'g'
        ? 'Gramos'
        : selectedUnidad === 'kg'
        ? 'Kilogramos'
        : 'Toneladas';

    const titleText =
      selectedEntidad === 'Todas'
        ? `Incautaciones de ${selectedNarcotico} por entidad (${unidadLabel})`
        : `Incautaciones de narcóticos en ${selectedEntidad} (${unidadLabel})`;

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
                  ? `${val.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selectedUnidad}`
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
              name: showAsPercentage ? '%' : unidadLabel,
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
                    ? `${params.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selectedUnidad}`
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
                    name: selectedEntidad === 'Todas' ? item.entidad : item.tipo,
                    value: val,
                    itemStyle: { color },
                  };
                }),
              },
            ],
          };

    chart.setOption(options);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

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
    selectedUnidad,
    selectedEntidad,
  ]);

  // ✅ Descargas
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
      link.download = `grafica_narcoticos_${selectedNarcotico}_${selectedEntidad}.png`;
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
    pdf.save(`grafica_narcoticos_${selectedNarcotico}_${selectedEntidad}.pdf`);
  };

    // --- Listas dinámicas ---
  const tiposDisponibles = Array.from(new Set(data.map((d) => d.tipo))).sort();
  const entidadesDisponibles = ['Todas', ...Array.from(new Set(data.map((d) => d.entidad))).sort()];

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
        <button onClick={restablecerVistaOriginal} title="Restablecer vista original" style={buttonStyle}>
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

      {/* 🔽 Selectores de filtros */}
      <div style={selectorsStyle}>
        <div>
          <label>
            <b>Narcótico:</b>
          </label>
          <select
            value={selectedNarcotico}
            onChange={(e) => setSelectedNarcotico(e.target.value)}
            style={selectStyle}
          >
            {tiposDisponibles.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>
            <b>Entidad:</b>
          </label>
          <select
            value={selectedEntidad}
            onChange={(e) => setSelectedEntidad(e.target.value)}
            style={selectStyle}
          >
            {entidadesDisponibles.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>
            <b>Unidad:</b>
          </label>
          <select
            value={selectedUnidad}
            onChange={(e) => setSelectedUnidad(e.target.value as Unidad)}
            style={selectStyle}
          >
            <option value="mg">Miligramos (mg)</option>
            <option value="g">Gramos (g)</option>
            <option value="kg">Kilogramos (kg)</option>
            <option value="t">Toneladas (t)</option>
          </select>
        </div>
      </div>

      {/* 📈 Contenedor del gráfico */}
      <div ref={chartRef} style={{ width: '100%', height: '500px', minHeight: '300px' }} />
    </div>
  );
};

// 🎨 Estilos
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

export default BarChartNarcoticos;
