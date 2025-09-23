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

const BarChartEstadoMapxHab = () => {
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

        echarts.registerMap('MexicoByRate', geoJson);

        const data = geoJson.features.map((f: any) => ({
          name: f.properties.name,
          value: f.properties['Tasa de Homicidios (x100k hab.)'] ?? 0
        }));

        setMapData(data);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!ready || !chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const values = mapData.map(d => d.value).filter(v => v > 0);
    const maxValue = Math.max(...values);

    chart.setOption({
      backgroundColor: '#1e1e1e',
      title: {
        text: 'Tasa de Homicidios por Estado (x100k hab.)',
        left: 'center',
        textStyle: { fontSize: 16, color: '#fff' }
      },
      tooltip: {
        trigger: 'item',
        formatter: ({ name, value }: any) =>
          `${name}<br/>Tasa: ${value?.toFixed(2)} por 100k hab.`,
        backgroundColor: '#333',
        textStyle: { color: '#fff' }
      },
      visualMap: {
        min: 0,
        max: maxValue,
        left: 'left',
        bottom: 'bottom',
        text: ['Alta', 'Baja'],
        textStyle: { color: '#fff' },
        calculable: true,
        inRange: {
          color: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c']
        }
      },
      series: [
        {
          name: 'Tasa de Homicidios',
          type: 'map',
          map: 'MexicoByRate',
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

export default BarChartEstadoMapxHab;
