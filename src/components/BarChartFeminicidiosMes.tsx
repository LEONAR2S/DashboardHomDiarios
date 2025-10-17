import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  PieChart,
  type BarSeriesOption,
  type LineSeriesOption,
  type PieSeriesOption,
} from "echarts/charts";
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  type GridComponentOption,
  type TitleComponentOption,
  type TooltipComponentOption,
  type LegendComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  FaDownload,
  FaFilePdf,
  FaChartBar,
  FaChartPie,
  FaChartLine,
  FaUndo,
} from "react-icons/fa";

// Registrar componentes ECharts
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

type EChartsOption = echarts.ComposeOption<
  | TitleComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | LegendComponentOption
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
>;

interface RegistroFeminicidio {
  Año: number;
  Entidad: string;
  Tipo_de_delito: string;
  [key: string]: any;
}

interface DatosMes {
  mes: string;
  valor: number;
}

const MESES_ORDENADOS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
];

const TODOS = "Todos";

const BarChartFeminicidiosMes: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [data, setData] = useState<DatosMes[]>([]);
  const [selectedEntidad, setSelectedEntidad] = useState<string>(TODOS);
  const [entidades, setEntidades] = useState<string[]>([TODOS]);
  const [chartType, setChartType] = useState<"bar" | "pie" | "line">("line");

  const [showAverage, setShowAverage] = useState(true);
  const [useGradientColor, setUseGradientColor] = useState(true);

  // 📊 Estadísticas
  const valores = useMemo(() => data.map((d) => d.valor), [data]);
  const media = useMemo(
    () => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0),
    [valores]
  );

  // 📥 Cargar datos iniciales
  useEffect(() => {
    fetch("/data/feminicidios.json")
      .then((res) => res.json())
      .then((json: RegistroFeminicidio[]) => {
        const filtrados = json.filter(
          (item) => item.Tipo_de_delito?.toLowerCase() === "feminicidio"
        );

        const setEnt = new Set(filtrados.map((f) => f.Entidad));
        setEntidades([TODOS, ...Array.from(setEnt)]);
        actualizarDatos(filtrados, TODOS);
      })
      .catch((err) => console.error("Error cargando datos:", err));
  }, []);

  // 🔁 Actualizar al cambiar estado
  useEffect(() => {
    fetch("/data/feminicidios.json")
      .then((res) => res.json())
      .then((json: RegistroFeminicidio[]) => {
        const filtrados = json.filter(
          (item) => item.Tipo_de_delito?.toLowerCase() === "feminicidio"
        );
        actualizarDatos(filtrados, selectedEntidad);
      });
  }, [selectedEntidad]);

  const actualizarDatos = (json: RegistroFeminicidio[], entidad: string) => {
    const meses = MESES_ORDENADOS;
    const mapa: Record<string, number> = {};

    json.forEach((item) => {
      if (entidad !== TODOS && item.Entidad !== entidad) return;
      meses.forEach((mes) => {
        mapa[mes] = (mapa[mes] || 0) + (Number(item[mes]) || 0);
      });
    });

    const dataMes = meses.map((mes) => ({
      mes,
      valor: mapa[mes] || 0,
    }));

    setData(dataMes);
  };

  // 🎨 Render gráfico
  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const minVal = Math.min(...data.map((d) => d.valor));
    const maxVal = Math.max(...data.map((d) => d.valor));

    // 🎨 Paletas de colores
    const getBarGradient = (v: number) => {
      const ratio = (v - minVal) / (maxVal - minVal || 1);
      const r = Math.round(100 + 100 * ratio);
      const g = Math.round(120 + 60 * (1 - ratio));
      const b = 200;
      return `rgb(${r},${g},${b})`; // Azul–morado suave
    };

    const getPointColor = (v: number) => {
      const ratio = (v - minVal) / (maxVal - minVal || 1);
      const r = Math.round(255 * ratio);
      const g = Math.round(255 * (1 - ratio));
      return `rgb(${r},${g},0)`; // Verde → Rojo
    };

    const solidBarColor = "#1c74ccff"; // Azul gris oscuro
    const piePalette = [
      "#1B263B",
      "#0E4D92",
      "#274C77",
      "#6C757D",
      "#495057",
      "#5C3C92",
      "#8B0000",
      "#006D5B",
    ]; // Tonos serios

    const baseTitle = `Feminicidios por Mes — ${
      selectedEntidad === TODOS ? "México" : selectedEntidad
    } (Ene–Ago 2025)`;

    let option: EChartsOption;

    // 📊 Gráfica de Barras
    if (chartType === "bar") {
      option = {
        title: { text: baseTitle, left: "center" },
        tooltip: {
          trigger: "axis",
          formatter: (p: any) =>
            `${p[0].name}<br/>${p[0].value} carpetas de investigación`,
        },
        grid: { top: 60, bottom: 70, left: 50, right: 50 },
        xAxis: { type: "category", data: data.map((d) => d.mes) },
        yAxis: { type: "value", name: "Carpetas" },
        series: [
          {
            type: "bar",
            data: data.map((d) => ({
              value: d.valor,
              itemStyle: {
                color: useGradientColor ? getBarGradient(d.valor) : solidBarColor,
              },
            })),
            label: {
              show: true,
              position: "top",
              fontSize: 10,
              formatter: (v: any) => v.value.toLocaleString(),
            },
            markLine: showAverage
              ? {
                  symbol: "none",
                  data: [
                    {
                      yAxis: media,
                      lineStyle: { type: "dashed", color: "red", width: 2 },
                      label: {
                        formatter: `Media: ${media.toFixed(2)}`,
                        color: "red",
                        position: "insideEndTop",
                        distance: 15,
                      },
                    },
                  ],
                }
              : undefined,
          } as BarSeriesOption,
        ],
      };
    }

    // 📈 Gráfica de Líneas (por defecto)
    else if (chartType === "line") {
      option = {
        title: { text: baseTitle, left: "center" },
        tooltip: {
          trigger: "axis",
          formatter: (p: any) =>
            `${p[0].name}<br/>${p[0].value} carpetas de investigación`,
        },
        grid: { top: 60, bottom: 70, left: 50, right: 80 },
        xAxis: { type: "category", data: data.map((d) => d.mes) },
        yAxis: { type: "value", name: "Carpetas" },
        series: [
          {
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 10,
            data: data.map((d) => d.valor),
            lineStyle: { width: 3, color: "#0047AB" }, // Azul fuerte
            itemStyle: {
              color: (params: any) => getPointColor(params.value),
            },
            label: {
              show: true,
              position: "top",
              fontSize: 10,
              formatter: (v: any) => v.value.toLocaleString(),
            },
            markLine: showAverage
              ? {
                  symbol: "none",
                  data: [
                    {
                      yAxis: media,
                      lineStyle: { type: "dashed", color: "red", width: 2 },
                      label: {
                        formatter: `Media: ${media.toFixed(2)}`,
                        color: "red",
                        position: "end",
                        align: "right",
                        padding: [0, 70, 0, 0], // evita corte
                      },
                    },
                  ],
                }
              : undefined,
          } as LineSeriesOption,
        ],
      };
    }

    // 🥧 Gráfica de Pastel
    else {
      option = {
        title: { text: baseTitle, left: "center" },
        tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
        legend: { bottom: 10 },
        series: [
          {
            type: "pie",
            radius: "60%",
            data: data.map((d, i) => ({
              name: d.mes,
              value: d.valor,
              itemStyle: {
                color: piePalette[i % piePalette.length],
              },
            })),
            label: { formatter: "{b}\n{c} ({d}%)" },
          } as PieSeriesOption,
        ],
      };
    }

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [data, chartType, showAverage, useGradientColor, selectedEntidad, media]);

  // 💾 Exportar imagen/PDF
  const handleDownload = async (type: "png" | "pdf") => {
    const dom = chartRef.current;
    if (!dom) return;
    const canvas = await html2canvas(dom);
    const img = canvas.toDataURL("image/png");
    if (type === "png") {
      const link = document.createElement("a");
      link.href = img;
      link.download = `feminicidios_mes_${selectedEntidad}.png`;
      link.click();
    } else {
      const pdf = new jsPDF();
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, "PNG", 0, 10, w, h);
      pdf.save(`feminicidios_mes_${selectedEntidad}.pdf`);
    }
  };

  const handleReset = () => {
    setChartType("line");
    setShowAverage(true);
    setUseGradientColor(true);
    setSelectedEntidad(TODOS);
  };

  return (
    <div
      style={{
        padding: "1rem",
        border: "1px solid #ccc",
        borderRadius: "8px",
        background: "#fff",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
      }}
    >
      {/* Filtro */}
      <div style={{ marginBottom: "1rem" }}>
        <label>Estado: </label>
        <select
          value={selectedEntidad}
          onChange={(e) => setSelectedEntidad(e.target.value)}
        >
          {entidades.map((ent) => (
            <option key={ent} value={ent}>
              {ent}
            </option>
          ))}
        </select>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          marginBottom: "10px",
        }}
      >
        <button onClick={() => handleDownload("png")} style={btnStyle}>
          <FaDownload />
        </button>
        <button onClick={() => handleDownload("pdf")} style={btnStyle}>
          <FaFilePdf />
        </button>
        <button onClick={() => setChartType("line")} style={btnStyle}>
          <FaChartLine />
        </button>
        <button onClick={() => setChartType("bar")} style={btnStyle}>
          <FaChartBar />
        </button>
        <button onClick={() => setChartType("pie")} style={btnStyle}>
          <FaChartPie />
        </button>
        <button onClick={handleReset} style={btnStyle}>
          <FaUndo />
        </button>
        <button
          onClick={() => setUseGradientColor((v) => !v)}
          style={btnStyle}
        >
          {useGradientColor ? "Gradiente ✔" : "Gradiente ✘"}
        </button>
        <button onClick={() => setShowAverage((v) => !v)} style={btnStyle}>
          {showAverage ? "Promedio ✔" : "Promedio ✘"}
        </button>
      </div>

      <div ref={chartRef} style={{ width: "100%", height: "500px" }} />
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: "14px",
  padding: "6px 8px",
  background: "none",
};

export default BarChartFeminicidiosMes;
