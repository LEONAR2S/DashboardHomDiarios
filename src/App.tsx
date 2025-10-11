import React, { useState } from 'react';
import BarChartMes from './components/BarChartMes';
import BarChartTrim from './components/BarChartTrim';
import BarChartDia from './components/BarChartDia';
import BarChartEstado from './components/BarChartEstado';
import BarChartFecha from './components/BarChartFecha';
import BarChartSemana from './components/BarChartSemana';
import BarChartEstadoMap from './components/BarChartEstadoMap';
import BarChartEstadoMapxHab from './components/BarChartEstadoMapxHab';
import EstadoChartFecha from './components/EstadoChartFecha';
import BarChartArmas from './components/BarChartArmas';
import BarChartNarcoticos from './components/BarChartNarcoticos';
import './index.css';

const App: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState<'homicidios' | 'aseguramientos' | null>(null);
  const goBackToMenu = () => setSelectedOption(null);

  // 🌈 PANTALLA DE BIENVENIDA
  if (!selectedOption) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-blue-200 to-indigo-200 px-4 py-10">
        <div className="bg-white rounded-3xl shadow-xl border border-blue-200/30 p-8 sm:p-10 w-full max-w-md sm:max-w-lg lg:max-w-xl text-center flex flex-col items-center transition-all duration-300 hover:shadow-blue-300/40">
          <h1 className="text-3xl sm:text-4xl font-bold text-blue-700 mb-4 leading-tight">
            ¡Bienvenido!
          </h1>

          <p className="text-base sm:text-lg text-gray-600 mb-8">
            Selecciona una categoría para visualizar los datos estadísticos:
          </p>

          {/* 🔘 BOTONES */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 w-full">
            <button
              onClick={() => setSelectedOption('homicidios')}
              className="flex-1 px-5 py-3 bg-blue-600 text-white text-base sm:text-lg font-medium rounded-lg shadow-md hover:bg-blue-700 active:scale-95 transition-all duration-200"
            >
              Homicidios Diarios
            </button>
            <button
              onClick={() => setSelectedOption('aseguramientos')}
              className="flex-1 px-5 py-3 bg-emerald-600 text-white text-base sm:text-lg font-medium rounded-lg shadow-md hover:bg-emerald-700 active:scale-95 transition-all duration-200"
            >
              Aseguramientos INEGI
            </button>
          </div>

          <p className="text-xs sm:text-sm text-gray-400 mt-8">
            © 2025 Inspeccion360 — Datos públicos oficiales
          </p>
        </div>
      </div>
    );
  }

  //  DASHBOARD DE HOMICIDIOS
  if (selectedOption === 'homicidios') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* ENCABEZADO */}
        <header className="text-center py-6 bg-white shadow-sm border-b border-gray-200/40">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-blue-700">
            VÍCTIMAS REPORTADAS POR DELITO DE HOMICIDIO
          </h1>
          <p className="text-sm sm:text-lg text-gray-600 mt-2">
            FISCALÍAS ESTATALES Y DEPENDENCIAS FEDERALES
          </p>
          <p className="text-sm sm:text-lg text-gray-600 mt-1">Año: 2025</p>
          <p className="text-sm sm:text-lg text-gray-600 mt-1">
            Fuente:{' '}
            <a
              href="http://www.informeseguridad.cns.gob.mx/"
              className="text-blue-600 underline hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              http://www.informeseguridad.cns.gob.mx/
            </a>
          </p>

          <div className="mt-4">
            <button
              onClick={goBackToMenu}
              className="bg-blue-600 text-white px-5 py-2 rounded-md shadow hover:bg-blue-700 active:scale-95 transition-all duration-200"
            >
              ← Volver al Menú Principal
            </button>
          </div>
        </header>

        {/* CONTENIDO */}
        <main className="flex flex-col w-full bg-gray-50">
          {[
            <BarChartEstado key="estado" />,
            <EstadoChartFecha key="fecha" />,
            <BarChartEstadoMap key="map" />,
            <BarChartEstadoMapxHab key="mapxhab" />,
            <BarChartTrim key="trim" />,
            <BarChartMes key="mes" />,
            <BarChartSemana key="semana" />,
            <BarChartDia key="dia" />,
            <BarChartFecha key="fecha2" />,
          ].map((Component, i) => (
            <section
              key={i}
              className="w-full py-6 px-2 sm:px-3 md:px-4 border-t border-gray-300/20 first:border-t-0 last:border-b border-b border-gray-300/20"
            >
              <div className="w-full">{Component}</div>
            </section>
          ))}
        </main>
      </div>
    );
  }

  // 🕵️‍♂️ DASHBOARD DE ASEGURAMIENTOS INEGI
  if (selectedOption === 'aseguramientos') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* ENCABEZADO PRINCIPAL */}
        <header className="text-center py-6 bg-white shadow-sm border-b border-gray-200/40">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-emerald-700">
            ASEGURAMIENTOS — INEGI
          </h1>
          <p className="text-sm sm:text-lg text-gray-600 mt-2">
            Censo Nacional de Seguridad Pública Estatal (CNSPE) 2025
          </p>
          <p className="text-sm sm:text-lg text-gray-600 mt-1">Año: 2025</p>
          <p className="text-sm sm:text-lg text-gray-600 mt-1">
            Fuente:{' '}
            <a
              href="https://www.inegi.org.mx/programas/cnspe/2025/"
              className="text-emerald-600 underline hover:text-emerald-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://www.inegi.org.mx/programas/cnspe/2025/
            </a>
          </p>

          <div className="mt-4">
            <button
              onClick={goBackToMenu}
              className="bg-emerald-600 text-white px-5 py-2 rounded-md shadow hover:bg-emerald-700 active:scale-95 transition-all duration-200"
            >
              ← Volver al Menú Principal
            </button>
          </div>
        </header>

        {/* CONTENIDO ASEGURAMIENTOS */}
        <main className="flex flex-col w-full bg-gray-50">
          {/*  ASEGURAMIENTOS DE ARMAS */}
          <section className="w-full py-8 px-2 sm:px-4 md:px-6 border-t border-gray-300/20">
            <h2 className="text-2xl font-semibold text-emerald-700 mb-4 text-center">
               Aseguramientos de Armas
            </h2>
            <BarChartArmas />
          </section>

          {/* 💊 ASEGURAMIENTOS DE NARCÓTICOS */}
          <section className="w-full py-8 px-2 sm:px-4 md:px-6 border-t border-gray-300/20">
            <h2 className="text-2xl font-semibold text-rose-700 mb-4 text-center">
              💊 Aseguramientos de Narcóticos
            </h2>
            <BarChartNarcoticos />
          </section>
        </main>
      </div>
    );
  }

  return null;
};

export default App;
