
import BarChartMes from './components/BarChartMes';
import BarChartTrim from './components/BarChartTrim';
import BarChartDia from './components/BarChartDia';
import BarChartEstado from './components/BarChartEstado';
import BarChartFecha from './components/BarChartFecha';
import BarChartSemana from './components/BarChartSemana';
import BarChartEstadoMap from './components/BarChartEstadoMap';
import BarChartEstadoMapxHab from './components/BarChartEstadoMapxHab';
import EstadoChartFecha from './components/EstadoChartFecha';
import './index.css';


function App() {

  return (
    <div className="min-h-screen bg-gray-100 px-4 sm:px-6 md:px-10 py-8">
  <header className="text-center mb-10">
    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-blue-700">
      VÍCTIMAS REPORTADAS POR DELITO DE HOMICIDIO
    </h1>
    <p className="text-lg sm:text-xl text-gray-600 mt-2">
      FISCALÍAS ESTATALES Y DEPENDENCIAS FEDERALES
    </p>
        <p className="text-lg sm:text-xl text-gray-600 mt-2">
      Año: 2025
    </p>
      
    <p className="text-lg sm:text-xl text-gray-600 mt-2">
      Fuente: http://www.informeseguridad.cns.gob.mx/
    </p>


  </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
        <BarChartEstado />
        <EstadoChartFecha />
        <BarChartEstadoMap />
        <BarChartEstadoMapxHab />
        <BarChartTrim />
        <BarChartMes />
        <BarChartSemana />
        <BarChartDia />
        <BarChartFecha />

      </main>
    </div>
  );
}

export default App;
