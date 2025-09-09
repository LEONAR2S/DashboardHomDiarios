import * as echarts from 'echarts';
import { useEffect, useRef, useState } from 'react';

const nombreOficialMap: Record<string, string> = {
  'Aguascalientes': 'Aguascalientes',
  'Baja California': 'Baja California',
  'Baja California Sur': 'Baja California Sur',
  'Campeche': 'Campeche',
  'Chiapas': 'Chiapas',
  'Chihuahua': 'Chihuahua',
  'Ciudad de México': 'Ciudad de México',
  'Coahuila': 'Coahuila de Zaragoza',
  'Colima': 'Colima',
  'Durango': 'Durango',
  'Guanajuato': 'Guanajuato',
  'Guerrero': 'Guerrero',
  'Hidalgo': 'Hidalgo',
  'Jalisco': 'Jalisco',
  'Michoacán': 'Michoacán de Ocampo',
  'Morelos': 'Morelos',
  'México': 'México',
  'Nayarit': 'Nayarit',
  'Nuevo León': 'Nuevo León',
  'Oaxaca': 'Oaxaca',
  'Puebla': 'Puebla',
  'Querétaro': 'Querétaro',
  'Quintana Roo': 'Quintana Roo',
  'San Luis Potosí': 'San Luis Potosí',
  'Sinaloa': 'Sinaloa',
  'Sonora': 'Sonora',
  'Tabasco': 'Tabasco',
  'Tamaulipas': 'Tamaulipas',
  'Tlaxcala': 'Tlaxcala',
  'Veracruz': 'Veracruz de Ignacio de la Llave',
  'Yucatán': 'Yucatán',
  'Zacatecas': 'Zacatecas',
};

const BarChartEstadoMap = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [mapData, setMapData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    fetch('/data/estados.json')
      .then(res => res.json())
      .then(geoJson => {
        geoJson.features = geoJson.features.map((f: any) => {
          const rawName = f.properties['Entidad Federativa:']?.trim();
          const mappedName = nombreOficialMap[rawName] || rawName;
          return {
            ...f,
            properties: {
              ...f.properties,
              name: mappedName
            }
          };
        });

        echarts.registerMap('Mexico', geoJson);

        const data = geoJson.features.map((f: any) => ({
          name: f.properties.name,
          value: f.properties['Homicidios Totales'] ?? 0
        }));

        setMapData(data);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!ready || !chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const filteredValues = mapData.map(d => d.value).filter(v => v < 5000);
    const maxValue = Math.max(...filteredValues);

    chart.setOption({
      backgroundColor: '#1e1e1e',
      title: {
        text: 'Homicidios Totales por Estado',
        left: 'center',
        textStyle: { fontSize: 16, color: '#fff' }
      },
      tooltip: {
        trigger: 'item',
        formatter: ({ name, value }: any) =>
          `${name}<br/>Homicidios: ${value?.toLocaleString() ?? 0}`,
        backgroundColor: '#333',
        textStyle: { color: '#fff' }
      },
      visualMap: {
        min: 0,
        max: maxValue,
        left: 'left',
        bottom: 'bottom',
        text: ['Alto', 'Bajo'],
        textStyle: { color: '#fff' },
        calculable: true,
        inRange: {
          color: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15']
        }
      },
      series: [
        {
          name: 'Homicidios Totales',
          type: 'map',
          map: 'Mexico',
          roam: true,
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontWeight: 'bold',
              color: '#fff'
            },
            itemStyle: {
              areaColor: '#2171b5'
            }
          },
          itemStyle: {
            borderColor: '#999',
            areaColor: '#333'
          },
          data: mapData
        }
      ]
    });

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [ready, mapData]);

  return (
    <div
      ref={chartRef}
      style={{
        width: '100%',
        height: '600px',
        minHeight: '400px',
        marginBottom: '2rem'
      }}
    />
  );
};

export default BarChartEstadoMap;
