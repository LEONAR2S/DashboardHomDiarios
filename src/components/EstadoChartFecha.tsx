import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FaDownload,
  FaFilePdf,
  FaSortNumericDownAlt,
  FaSortAlphaDown,
  FaChartBar,
  FaChartLine,
  FaUndo,
} from 'react-icons/fa';

interface EntidadData {
  entidad: string;
  valor: number;
}

interface EstadoFechaJson {
  [fecha: string]: EntidadData[];
}

const EstadoChartFecha = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

  const [estadoData, setEstadoData] = useState<EstadoFechaJson>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedEntidad, setSelectedEntidad] = useState<string | null>(null);

  const [rawData, setRawData] = useState<EntidadData[]>([]);
  const [sortedData, setSortedData] = useState<EntidadData[]>([]);

  const [valueAsc, setValueAsc] = useState(false);
  const [alphaAsc, setAlphaAsc] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  // Conversores de fecha
  const ddmmyyyyToISO = (s: string) => {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  };

  const isoToDdMmYyyy = (iso: string) => {
    const [yyyy, mm, dd] = iso.split('-');
    return `${dd}/${mm}/${yyyy}`;
  };

  // Cargar JSON al inicio
  useEffect(() => {
    fetch('/data/EstadoFecha.json')
      .then(res => res.json())
      .then((json: EstadoFechaJson) => {
        setEstadoData(json);
        const dates = Object.keys(json).sort((a, b) =>
          ddmmyyyyToISO(a).localeCompare(ddmmyyyyToISO(b))
        );
        setAvailableDates(dates);
        if (dates.length) setSelectedDate(dates[dates.length - 1]);
      })
      .catch(err => {
        console.error('Error cargando estadoData:', err);
      });
  }, []);

  // Actualizar rawData cuando cambia fecha
  useEffect(() => {
    if (selectedDate && estadoData[selectedDate]) {
      setRawData(estadoData[selectedDate]);
    } else {
      setRawData([]);
    }
    // Resetear entidad al cambiar la fecha
    setSelectedEntidad(null);
  }, [selectedDate, estadoData]);

  // Ordenamiento por valor (asc/desc)
  useEffect(() => {
    let sorted = [...rawData];
    sorted.sort((a, b) => (valueAsc ? a.valor - b.valor : b.valor - a.valor));
    setSortedData(sorted);
  }, [rawData, valueAsc]);

  // Toggle alfabético
  const sortAlphabetically = () => {
    const sorted = [...rawData].sort((a, b) =>
      alphaAsc
        ? a.entidad.localeCompare(b.entidad)
        : b.entidad.localeCompare(a.entidad)
    );
    setSortedData(sorted);
    setAlphaAsc(!alphaAsc);
  };

  // Historial de entidad específica
  const historialEntidad = useMemo(() => {
    if (!selectedEntidad) return null;
    return availableDates.map(fecha => {
      const entList = estadoData[fecha];
      const ent = entList?.find(e => e.entidad === selectedEntidad);
      return { fecha, valor: ent ? ent.valor : 0 };
    });
  }, [selectedEntidad, estadoData, availableDates]);

  // Lista de entidades para seleccionar
  const entidadesList = useMemo(() => {
    if (!availableDates.length) return [];
    const fecha = availableDates[availableDates.length - 1];
    const list = estadoData[fecha] || [];
    return list.map(e => e.entidad).sort();
  }, [estadoData, availableDates]);

  // Botón reinicio: volver al estado inicial
  const reiniciarGrafica = () => {
    if (availableDates.length) {
      setSelectedDate(availableDates[availableDates.length - 1]);
    }
    setSelectedEntidad(null);
    setValueAsc(false);
    setAlphaAsc(true);
    setChartType('bar');
  };

  // Render del chart
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartInstanceRef.current ?? echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const resize = () => chart.resize();
    window.addEventListener('resize', resize);

    const renderChart = () => {
      // decidir datos base
      let xData: string[] = [];
      let yData: number[] = [];

      if (selectedEntidad && historialEntidad) {
        xData = historialEntidad.map(d => d.fecha);
        yData = historialEntidad.map(d => d.valor);
      } else {
        xData = sortedData.map(d => d.entidad);
        yData = sortedData.map(d => d.valor);
      }

      const minVal = yData.length ? Math.min(...yData) : 0;
      const maxVal = yData.length ? Math.max(...yData) : 0;

      const option: echarts.EChartsOption = {
        title: {
          text: selectedEntidad
            ? `Historial de ${selectedEntidad}`
            : `Entidades federativas - ${selectedDate}`,
          left: 'center',
        },
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: xData,
          axisLabel: { rotate: 45, interval: 0, fontSize: 10 },
        },
        yAxis: { type: 'value' },
        dataZoom: [
  {
    type: 'slider',
    show: true,
    start: 0,
    end: 100,
    bottom: 30,
  },
  {
    type: 'inside',
    start: 0,
    end: 100,
  }
],
        series: [
          {
            type: chartType,
            data: yData,
            smooth: chartType === 'line',
            label: {
              show: chartType === 'bar',
              position: 'top',
            },
            
            // Línea: color por valor de cada punto
            itemStyle: chartType === 'bar'
              ? {
                  color: (params: any) => {
                    const val = params.value as number;
                    const ratio = maxVal !== minVal ? (val - minVal) / (maxVal - minVal) : 0;
                    const r = Math.round(255 * ratio);
                    const g = Math.round(255 * (1 - ratio));
                    return `rgb(${r},${g},0)`;
                  },
                }
              : undefined,
            lineStyle: chartType === 'line'
              ? {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: 'green' },
                      { offset: 1, color: 'red' },
                    ],
                  },
                  width: 3,
                }
              : undefined,
            areaStyle: chartType === 'line'
              ? {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(255,0,0,0.3)' },
                    { offset: 1, color: 'rgba(0,255,0,0.3)' },
                  ]),
                }
              : undefined,
          },
        ],
        grid: { left: 60, right: 20, bottom: 100, top: 60 },
        animationDuration: 300,
      };

      chart.setOption(option);
    };

    renderChart();

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, [
    sortedData,
    selectedDate,
    chartType,
    selectedEntidad,
    historialEntidad,
  ]);

  const exportImage = () => {
    const chart = chartInstanceRef.current;
    const url = chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedEntidad
        ? `historial_${selectedEntidad}.png`
        : `grafica_entidades_${selectedDate}.png`;
      a.click();
    }
  };

  const exportPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 10, w, h);
    const filename = selectedEntidad
      ? `historial_${selectedEntidad}.pdf`
      : `grafica_entidades_${selectedDate}.pdf`;
    pdf.save(filename);
  };

  // Calcular totales para mostrar
  const totalDelDia = useMemo(() => {
    return rawData.reduce((sum, d) => sum + d.valor, 0);
  }, [rawData]);

  const totalEntidadSeleccionada = useMemo(() => {
    if (!selectedEntidad || !historialEntidad) return null;
    return historialEntidad.reduce((sum, d) => sum + d.valor, 0);
  }, [selectedEntidad, historialEntidad]);

  return (
    <div style={wrapper}>
      <div style={toolbar}>
        <button onClick={exportImage} style={buttonStyle}><FaDownload /></button>
        <button onClick={exportPDF} style={buttonStyle}><FaFilePdf /></button>

        <label>
          Fecha:&nbsp;
          <input
            type="date"
            value={selectedDate ? ddmmyyyyToISO(selectedDate) : ''}
            min={availableDates.length ? ddmmyyyyToISO(availableDates[0]) : ''}
            max={availableDates.length ? ddmmyyyyToISO(availableDates[availableDates.length - 1]) : ''}
            onChange={e => {
              const iso = e.target.value;
              const ddmm = isoToDdMmYyyy(iso);
              if (estadoData[ddmm]) setSelectedDate(ddmm);
              else alert('No hay datos para esta fecha');
            }}
            style={dateInput}
          />
        </label>

        <label>
          Entidad:&nbsp;
          <select
            value={selectedEntidad || ''}
            onChange={e => setSelectedEntidad(e.target.value || null)}
            style={selectStyle}
          >
            <option value="">-- Todas entidades --</option>
            {entidadesList.map(ent => (
              <option key={ent} value={ent}>{ent}</option>
            ))}
          </select>
        </label>

        <button onClick={() => setChartType(prev => (prev === 'bar' ? 'line' : 'bar'))} style={buttonStyle}>
          {chartType === 'bar' ? <FaChartLine /> : <FaChartBar />} Cambiar a {chartType === 'bar' ? 'Línea' : 'Barras'}
        </button>

        <button onClick={() => setValueAsc(p => !p)} style={buttonStyle}>
          <FaSortNumericDownAlt /> Orden Valor ({valueAsc ? '↑' : '↓'})
        </button>

        <button onClick={sortAlphabetically} style={buttonStyle}>
          <FaSortAlphaDown /> Alfabético ({alphaAsc ? 'A-Z' : 'Z-A'})
        </button>

        <button onClick={reiniciarGrafica} style={buttonStyle} title="Reiniciar">
          <FaUndo /> Reiniciar
        </button>

        <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
          {selectedEntidad
            ? `Entidad: ${selectedEntidad} — Total: ${totalEntidadSeleccionada ?? 0}`
            : `Fecha: ${selectedDate} — Total del día: ${totalDelDia}`}
        </span>
      </div>

      <div ref={chartRef} style={{ width: '100%', height: 520, minHeight: 300 }} />
    </div>
  );
};

// Estilos
const wrapper: React.CSSProperties = {
  position: 'relative',
  padding: '1rem',
  background: '#fff',
  marginBottom: '2rem',
  border: '1px solid #ccc',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  width: '100%',
  boxSizing: 'border-box',
};

const toolbar: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 10,
  marginBottom: 10,
};

const buttonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #ddd',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '14px',
  padding: '6px 8px',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const dateInput: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 12,
};

const selectStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 12,
};

export default EstadoChartFecha;
