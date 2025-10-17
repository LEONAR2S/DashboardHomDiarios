import * as echarts from "echarts";
import { useEffect, useRef, useState, useMemo } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  FaDownload,
  FaFilePdf,
  FaSortAlphaDown,
  FaSortAmountDown,
  FaChartBar,
  FaSitemap,
} from "react-icons/fa";

interface RegistroFeminicidio {
  Año: number;
  Clave_Ent: number;
  Entidad: string;
  "Cve._Municipio": number;
  Municipio: string;
  "Bien_jurídico_afectado": string;
  Tipo_de_delito: string;
  Subtipo_de_delito: string;
  Modalidad: string;
  [key: string]: any;
}

interface DatosEstado {
  entidad: string;
  total: number;
}

const BarChartFeminicidiosEstado = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [data, setData] = useState<DatosEstado[]>([]);
  const [sortedData, setSortedData] = useState<DatosEstado[]>([]);
  const [chartType, setChartType] = useState<"bar" | "treemap">("bar");
  const [useGradientColor, setUseGradientColor] = useState(true); // gradiente activado por defecto
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [showAverageLine, setShowAverageLine] = useState(false);

  const [leyenda50, setLeyenda50] = useState<{ estados: number; porcentaje: number } | null>(null);
  const [leyendaTop10, setLeyendaTop10] = useState<{ total: number; porcentaje: number } | null>(
    null
  );

  const total = useMemo(() => data.reduce((sum, d) => sum + d.total, 0), [data]);
  const promedio = useMemo(() => (data.length ? total / data.length : 0), [data, total]);
  const countAbove = useMemo(() => data.filter((d) => d.total > promedio).length, [data, promedio]);
  const countBelow = useMemo(() => data.filter((d) => d.total < promedio).length, [data, promedio]);

  // 📥 Cargar datos desde JSON
  useEffect(() => {
    fetch("/data/feminicidios.json")
      .then((res) => res.json())
      .then((json: RegistroFeminicidio[]) => {
        const filtrados = json.filter(
          (item) => item.Tipo_de_delito?.toLowerCase() === "feminicidio"
        );

        const meses = [
          "Enero",
          "Febrero",
          "Marzo",
          "Abril",
          "Mayo",
          "Junio",
          "Julio",
          "Agosto",
          "Septiembre",
          "Octubre",
          "Noviembre",
          "Diciembre",
        ];

        const mapa = new Map<string, number>();
        filtrados.forEach((item) => {
          const totalMeses = meses.reduce((sum, mes) => sum + (Number(item[mes]) || 0), 0);
          mapa.set(item.Entidad, (mapa.get(item.Entidad) || 0) + totalMeses);
        });

        const agrupado = Array.from(mapa, ([entidad, total]) => ({ entidad, total }));
        setData(agrupado);
        ordenarPorValor(agrupado);
      })
      .catch((err) => console.error("Error cargando datos:", err));
  }, []);

  // 🎨 Render del gráfico
  useEffect(() => {
    if (!chartRef.current || !sortedData.length) return;
    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const minVal = Math.min(...sortedData.map((d) => d.total));
    const maxVal = Math.max(...sortedData.map((d) => d.total));

    const getColorGradient = (value: number, min: number, max: number) => {
      const ratio = (value - min) / (max - min || 1);
      const r = Math.round(255 * ratio);
      const g = Math.round(150 * (1 - ratio));
      const b = 180;
      return `rgb(${r},${g},${b})`;
    };

    const options =
      chartType === "bar"
        ? {
            title: {
              text: "Feminicidios por Estado — Carpetas de Investigación (2025)",
              left: "center",
            },
            tooltip: {
              trigger: "axis",
              formatter: (params: any) => {
                const { name, value } = params[0];
                return showAsPercentage
                  ? `${name}<br/>${value.toFixed(2)}%`
                  : `${name}<br/>${value} carpetas de investigación`;
              },
            },
            dataZoom: [
              { type: "inside" },
              { type: "slider", start: 0, end: 100 },
            ],
            xAxis: {
              type: "category",
              data: sortedData.map((d) => d.entidad),
              axisLabel: { rotate: 45, interval: 0 },
            },
            yAxis: {
              type: "value",
              name: showAsPercentage ? "%" : "Carpetas de Investigación",
            },
            series: [
              {
                type: "bar",
                data: sortedData.map((item) => {
                  const val = showAsPercentage ? (item.total * 100) / total : item.total;
                  return {
                    value: val,
                    itemStyle: {
                      color: useGradientColor
                        ? getColorGradient(item.total, minVal, maxVal)
                        : "#C13584",
                    },
                  };
                }),
                label: {
                  show: true,
                  position: "top",
                  fontSize: 10,
                  color: "#333",
                  formatter: (val: any) =>
                    showAsPercentage ? `${val.value.toFixed(2)}%` : val.value,
                },
                ...(showAverageLine
                  ? {
                      markLine: {
                        symbol: "none",
                        data: [
                          {
                            yAxis: promedio,
                            lineStyle: { type: "dashed", color: "red", width: 2 },
                            label: {
                              show: true,
                              formatter: `Promedio Nacional: ${promedio.toFixed(2)}`,
                              position: "end",
                              color: "red",
                            },
                          },
                        ],
                      },
                    }
                  : {}),
              },
            ],
          }
        : {
            title: {
              text: "Mapa de Árbol — Feminicidios por Estado (2025)",
              left: "center",
            },
            tooltip: { formatter: (params: any) => `${params.name}<br/>${params.value} carpetas` },
            series: [
              {
                type: "treemap",
                roam: true,
                nodeClick: false,
                data: sortedData.map((d) => ({
                  name: d.entidad,
                  value: d.total,
                  itemStyle: {
                    color: useGradientColor ? getColorGradient(d.total, minVal, maxVal) : "#C13584",
                  },
                })),
                label: {
                  show: true,
                  formatter: (info: any) => `${info.name}\n${info.value.toLocaleString()} carpetas`,
                },
              },
            ],
          };

    chart.setOption(options);
    const resizeHandler = () => chart.resize();
    window.addEventListener("resize", resizeHandler);
    return () => {
      window.removeEventListener("resize", resizeHandler);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [sortedData, chartType, useGradientColor, showAverageLine, showAsPercentage, total, promedio]);

  // 🔘 Funciones auxiliares
  const ordenarPorNombre = (base: DatosEstado[] = data) => {
    setSortedData([...base].sort((a, b) => a.entidad.localeCompare(b.entidad)));
  };

  const ordenarPorValor = (base: DatosEstado[] = data) => {
    setSortedData([...base].sort((a, b) => b.total - a.total));
  };

  const mostrarTop10 = () => {
    const top = [...data].sort((a, b) => b.total - a.total).slice(0, 10);
    const totalTop = top.reduce((sum, d) => sum + d.total, 0);
    const porcentaje = (totalTop * 100) / total;
    setLeyendaTop10({ total: totalTop, porcentaje });
    setSortedData(top);
  };

  const mostrarTop50 = () => {
    const sorted = [...data].sort((a, b) => b.total - a.total);
    let acumulado = 0;
    let subset: DatosEstado[] = [];
    for (let d of sorted) {
      acumulado += d.total;
      subset.push(d);
      if (acumulado / total >= 0.5) break;
    }
    const porcentaje = (acumulado * 100) / total;
    setLeyenda50({ estados: subset.length, porcentaje });
    setSortedData(subset);
  };

  const resetVista = () => {
    setLeyenda50(null);
    setLeyendaTop10(null);
    setShowAverageLine(false);
    ordenarPorValor(data);
  };

  const handleDownloadImage = () => {
    if (!chartRef.current) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    const base64 = chart?.getDataURL({ type: "png", backgroundColor: "#fff" });
    if (base64) {
      const link = document.createElement("a");
      link.href = base64;
      link.download = "feminicidios_estado_2025.png";
      link.click();
    }
  };

  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF();
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, pdfHeight);
    pdf.save("feminicidios_estado_2025.pdf");
  };

  // 💅 Estilos
  const wrapperStyle: React.CSSProperties = {
    padding: "1rem",
    background: "#fff",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  };

  const toolbarStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    marginBottom: "10px",
  };

  const buttonStyle: React.CSSProperties = {
    border: "1px solid #ddd",
    background: "none",
    borderRadius: 6,
    padding: "6px 8px",
    cursor: "pointer",
  };

  const legendBoxStyle: React.CSSProperties = {
    backgroundColor: "#f9f9f9",
    padding: "6px 10px",
    borderRadius: 6,
    marginBottom: 8,
    color: "#555",
  };

  const totalBoxStyle: React.CSSProperties = {
    backgroundColor: "#eee",
    color: "#333",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "bold",
    marginBottom: "10px",
    textAlign: "center",
  };

  // Render
  return (
    <div style={wrapperStyle}>
      <div style={totalBoxStyle}>
        Total nacional de carpetas de investigación por feminicidio:{" "}
        {total.toLocaleString()}
      </div>

      <div style={toolbarStyle}>
        <button onClick={handleDownloadImage} style={buttonStyle} title="Descargar imagen">
          <FaDownload />
        </button>
        <button onClick={handleDownloadPDF} style={buttonStyle} title="Descargar PDF">
          <FaFilePdf />
        </button>
        <button onClick={() => ordenarPorNombre()} style={buttonStyle} title="Ordenar A–Z">
          <FaSortAlphaDown />
        </button>
        <button onClick={() => ordenarPorValor()} style={buttonStyle} title="Ordenar por valor">
          <FaSortAmountDown />
        </button>
        <button
          onClick={() => setUseGradientColor((p) => !p)}
          style={buttonStyle}
          title="Activar/Desactivar gradiente"
        >
          {useGradientColor ? "Gradiente ✔" : "Gradiente ✘"}
        </button>
        <button onClick={mostrarTop10} style={buttonStyle}>
          Top 10
        </button>
        <button onClick={mostrarTop50} style={buttonStyle}>
          +50%
        </button>
        <button
          onClick={() => setChartType((p) => (p === "bar" ? "treemap" : "bar"))}
          style={buttonStyle}
        >
          {chartType === "bar" ? <FaSitemap /> : <FaChartBar />}
        </button>
        <button
          onClick={() => setShowAsPercentage((p) => !p)}
          style={buttonStyle}
          title="Mostrar como porcentaje"
        >
          {showAsPercentage ? "%" : "#"}
        </button>
        <button
          onClick={() => setShowAverageLine((p) => !p)}
          style={buttonStyle}
          title="Mostrar/Ocultar Promedio Nacional"
        >
          {showAverageLine ? "🔴 Prom. Nal." : "⚪ Prom. Nal."}
        </button>
        <button onClick={resetVista} style={buttonStyle}>
          ⟳
        </button>
      </div>

      {showAverageLine && (
        <div style={legendBoxStyle}>
          🔺 {countAbove} estados por encima · 🔻 {countBelow} por debajo del promedio nacional
        </div>
      )}

      {leyenda50 && !showAverageLine && (
        <div style={legendBoxStyle}>
          {leyenda50.estados} estados concentran el{" "}
          {leyenda50.porcentaje.toFixed(1)}% de las carpetas
        </div>
      )}

      {leyendaTop10 && !showAverageLine && (
        <div style={legendBoxStyle}>
          Top 10 estados acumulan {leyendaTop10.total.toLocaleString()} carpetas (
          {leyendaTop10.porcentaje.toFixed(1)}%)
        </div>
      )}

      <div ref={chartRef} style={{ width: "100%", height: "550px" }} />
    </div>
  );
};

export default BarChartFeminicidiosEstado;
