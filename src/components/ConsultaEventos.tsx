import React, { useEffect, useState, useMemo, useCallback } from "react";
import type { ChangeEvent } from "react"; // ✅ Import de tipo separado

type EventRecord = {
  ID: number;
  Fecha: string;
  Año: number;
  Trim: string;
  Mes: string;
  Semana: string;
  Dia: number;
  Dia_Nombre: string;
  Clave_Ent: number;
  Estado: string;
  Municipio: string;
  Lon: number;
  Lat: number;
  Nombre: string;
  Edad: string;
  Corporacion: string;
  Tipo: string;
  Sexo: string;
  Estatus: string;
  Link: string;
};

interface Props {
  jsonUrl: string;
  pageSize?: number;
}

const ConsultaEventos: React.FC<Props> = ({ jsonUrl, pageSize = 50 }) => {
  const [allRecords, setAllRecords] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 🔍 Filtros
  const [filterYear, setFilterYear] = useState<number | "" | undefined>(undefined);
  const [filterEstado, setFilterEstado] = useState<string>("");
  const [filterMunicipio, setFilterMunicipio] = useState<string>("");
  const [filterNombre, setFilterNombre] = useState<string>("");
  const [filterSemana, setFilterSemana] = useState<string>("");
  const [filterFecha, setFilterFecha] = useState<string>("");

  // 🔢 Paginación
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Cargar datos desde el JSON
  useEffect(() => {
    setLoading(true);
    fetch(jsonUrl)
      .then((res) => res.json())
      .then((data: EventRecord[]) => {
        setAllRecords(data);
      })
      .catch((err) => {
        console.error("Error al cargar eventos:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [jsonUrl]);

  // 📆 Opciones de los selectores
  const yearsOptions = useMemo(() => {
    const s = new Set<number>();
    allRecords.forEach((r) => s.add(r.Año));
    return Array.from(s).sort((a, b) => a - b);
  }, [allRecords]);

  const estadosOptions = useMemo(() => {
    const s = new Set<string>();
    allRecords.forEach((r) => {
      if (r.Estado) s.add(r.Estado);
    });
    return Array.from(s).sort();
  }, [allRecords]);

  const municipiosOptions = useMemo(() => {
    const s = new Set<string>();
    allRecords
      .filter((r) => (filterEstado ? r.Estado === filterEstado : true))
      .forEach((r) => {
        if (r.Municipio) s.add(r.Municipio);
      });
    return Array.from(s).sort();
  }, [allRecords, filterEstado]);

  const semanasOptions = useMemo(() => {
    const s = new Set<string>();
    allRecords.forEach((r) => {
      if (r.Semana) s.add(r.Semana);
    });
    return Array.from(s).sort();
  }, [allRecords]);

  // 🔍 Aplicar filtros
  const filteredRecords = useMemo(() => {
    return allRecords.filter((r) => {
      if (filterYear && r.Año !== filterYear) return false;
      if (filterEstado && r.Estado !== filterEstado) return false;
      if (filterMunicipio && r.Municipio !== filterMunicipio) return false;
      if (filterNombre && !r.Nombre.toLowerCase().includes(filterNombre.toLowerCase())) return false;
      if (filterSemana && r.Semana !== filterSemana) return false;
      if (filterFecha && r.Fecha !== filterFecha) return false;
      return true;
    });
  }, [allRecords, filterYear, filterEstado, filterMunicipio, filterNombre, filterSemana, filterFecha]);

  // 📊 Paginación
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pageRecords = filteredRecords.slice(pageStart, pageEnd);

  // 📈 Resúmenes
  const resumenPorEstado = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach((r) => {
      const e = r.Estado || "Desconocido";
      map[e] = (map[e] || 0) + 1;
    });
    return Object.entries(map)
      .map(([estado, count]) => ({ estado, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const resumenPorMunicipio = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach((r) => {
      const m = r.Municipio || "Desconocido";
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map)
      .map(([municipio, count]) => ({ municipio, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  // 🎛️ Handlers
  const handleResetFilters = useCallback(() => {
    setFilterYear(undefined);
    setFilterEstado("");
    setFilterMunicipio("");
    setFilterNombre("");
    setFilterSemana("");
    setFilterFecha("");
    setCurrentPage(1);
  }, []);

  const gotoPage = (p: number) => {
    const np = Math.min(Math.max(1, p), totalPages);
    setCurrentPage(np);
  };

  // 🧠 Render
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-2xl shadow-xl border border-indigo-200">
      <h2 className="text-3xl font-bold text-indigo-800 mb-6 text-center">
        📋 Consulta de Eventos Policiales
      </h2>

      {loading ? (
        <p className="text-gray-600 text-center">Cargando datos...</p>
      ) : (
        <>
          {/* FILTROS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Año */}
            <div className="bg-white/80 p-4 rounded-lg shadow">
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <select
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={filterYear ?? ""}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setFilterYear(e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">Todos</option>
                {yearsOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Estado */}
            <div className="bg-white/80 p-4 rounded-lg shadow">
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={filterEstado}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterEstado(e.target.value)}
              >
                <option value="">Todos</option>
                {estadosOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Municipio */}
            <div className="bg-white/80 p-4 rounded-lg shadow">
              <label className="block text-sm font-medium text-gray-700 mb-1">Municipio</label>
              <select
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={filterMunicipio}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterMunicipio(e.target.value)}
                disabled={!filterEstado}
              >
                <option value="">Todos</option>
                {municipiosOptions.map((mun) => (
                  <option key={mun} value={mun}>
                    {mun}
                  </option>
                ))}
              </select>
            </div>

            {/* Semana */}
            <div className="bg-white/80 p-4 rounded-lg shadow">
              <label className="block text-sm font-medium text-gray-700 mb-1">Semana</label>
              <select
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={filterSemana}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterSemana(e.target.value)}
              >
                <option value="">Todas</option>
                {semanasOptions.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div className="bg-white/80 p-4 rounded-lg shadow">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha específica</label>
              <input
                type="date"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={filterFecha}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterFecha(e.target.value)}
              />
            </div>

            {/* Nombre */}
            <div className="bg-white/80 p-4 rounded-lg shadow">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                placeholder="Buscar por nombre..."
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={filterNombre}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterNombre(e.target.value)}
              />
            </div>
          </div>

          {/* Botón de reset */}
          <div className="flex justify-center mb-6">
            <button
              onClick={handleResetFilters}
              className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
            >
              Resetear filtros
            </button>
          </div>

          {/* 🔹 RESUMEN */}
          <div className="bg-white/80 p-4 rounded-lg shadow mb-6">
            <h3 className="font-semibold text-gray-700 mb-2">
              Total de eventos encontrados:{" "}
              <span className="text-indigo-700 font-bold">{filteredRecords.length}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1">Por Estado:</h4>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {resumenPorEstado.slice(0, 5).map((re) => (
                    <li key={re.estado}>
                      {re.estado}: {re.count}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1">Por Municipio:</h4>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {resumenPorMunicipio.slice(0, 5).map((rm) => (
                    <li key={rm.municipio}>
                      {rm.municipio}: {rm.count}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 🔹 TABLA */}
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-indigo-100">
                <tr>
                  {[
                    "ID",
                    "Fecha",
                    "Estado",
                    "Municipio",
                    "Nombre",
                    "Edad",
                    "Corporación",
                    "Tipo",
                    "Sexo",
                    "Estatus",
                    "Link",
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {pageRecords.map((rec) => (
                  <tr key={rec.ID} className="hover:bg-indigo-50 transition">
                    <td className="px-4 py-2 text-sm text-gray-600">{rec.ID}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{rec.Fecha}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{rec.Estado}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{rec.Municipio}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{rec.Nombre}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{rec.Edad}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{rec.Corporacion}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{rec.Tipo}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{rec.Sexo}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{rec.Estatus}</td>
                    <td className="px-4 py-2 text-sm text-indigo-600">
                      {rec.Link ? (
                        <a href={rec.Link} target="_blank" rel="noopener noreferrer" className="underline">
                          Ver
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 🔹 PAGINACIÓN */}
          <div className="mt-6 flex justify-center items-center space-x-4">
            <button
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              disabled={currentPage === 1}
              onClick={() => gotoPage(currentPage - 1)}
            >
              ← Anterior
            </button>
            <span className="text-sm text-gray-700">
              Página {currentPage} de {totalPages}
            </span>
            <button
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              disabled={currentPage === totalPages}
              onClick={() => gotoPage(currentPage + 1)}
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ConsultaEventos;
