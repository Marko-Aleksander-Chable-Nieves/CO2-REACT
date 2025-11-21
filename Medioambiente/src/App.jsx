// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceDot,
  BarChart, Bar, LabelList, Cell,
  PieChart, Pie
} from "recharts";

/* ===== Paleta ===== */
const C = {
  bg: "#0f1115",
  text: "#E6EAF2",
  primary: "#2E7D32",   // barras TopN / punto pico
  secondary: "#1E88E5", // serie global / barras 2
  accent: "#FFC107",    // punto valle / último
  neutral: "#546E7A",   // ejes/grid
  card: "#151922",
};

/* ===== Tooltip oscuro (texto claro) ===== */
const TTS = {
  contentStyle: { background: "#1b2130", border: "1px solid #3a4556", borderRadius: 8 },
  labelStyle: { color: "#E6EAF2", fontWeight: 700 },
  itemStyle: { color: "#E6EAF2" },
};

/* ===== Utilidades ===== */
const truncate = (s, n = 28) =>
  (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

/* ===== Selector de países con checkboxes + búsqueda ===== */
function CountryFilter({ countries, value, onChange }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return countries;
    return countries.filter((c) => c.toLowerCase().includes(qq));
  }, [countries, q]);

  const setAll = () => onChange(filtered);
  const clear = () => onChange([]);

  const toggle = (c) => {
    if (value.includes(c)) onChange(value.filter((v) => v !== c));
    else onChange([...value, c]);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          placeholder="Buscar país…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: 1,
            background: "#111",
            color: "#eee",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "6px 8px",
          }}
        />
        <button
          onClick={setAll}
          style={{
            background: "#223",
            color: "#cfe3ff",
            border: "1px solid #345",
            borderRadius: 8,
            padding: "6px 8px",
          }}
        >
          Seleccionar
        </button>
        <button
          onClick={clear}
          style={{
            background: "#222",
            color: "#ffd8d8",
            border: "1px solid #544",
            borderRadius: 8,
            padding: "6px 8px",
          }}
        >
          Limpiar
        </button>
      </div>

      <div
        style={{
          maxHeight: 220,
          overflow: "auto",
          border: "1px solid #333",
          borderRadius: 8,
          padding: 8,
          background: "#111",
        }}
      >
        {filtered.map((c) => (
          <label
            key={c}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#eee",
              marginBottom: 6,
            }}
          >
            <input
              type="checkbox"
              checked={value.includes(c)}
              onChange={() => toggle(c)}
            />
            <span>{c}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: "#999", fontSize: 12 }}>Sin coincidencias</div>
        )}
      </div>

      <div style={{ fontSize: 12, color: "#bbb", marginTop: 6 }}>
        Seleccionados: {value.length} (Vacío = todos)
      </div>
    </div>
  );
}

/* ===== Label de porcentaje para el anillo ===== */
const PercentLabel = (props) => {
  const { percent, cx, cy, innerRadius, outerRadius, midAngle } = props;
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text
      x={x}
      y={y}
      fill="#E6EAF2"
      textAnchor="middle"
      dominantBaseline="central"
      fontWeight={800}
      style={{ pointerEvents: "none" }} 
    >
      {(percent * 100).toFixed(1)}%
    </text>
  );
};

/* ===== Label del año a la derecha de cada barra (picos) ===== */
const YearRightLabel = (props) => {
  const { x = 0, y = 0, width = 0, value } = props;
  return (
    <text x={x + width + 8} y={y + 12} fill="#cfd8dc" fontSize={12}>
      ({value})
    </text>
  );
};

export default function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ====== CONTROLES ====== */
  const [unit, setUnit] = useState("Gt"); // "Gt" | "Mt"

  // Filtros de agregados
  const [hideWorld, setHideWorld] = useState(false);
  const [hideGroups, setHideGroups] = useState(false);   // regiones / grupos sin código
  const [hideGCP, setHideGCP] = useState(false);
  const [hideOWID, setHideOWID] = useState(false);
  const [hideRegular, setHideRegular] = useState(false); // NUEVO: países normales con código

  const [yearMin, setYearMin] = useState(1750);
  const [yearMax, setYearMax] = useState(2023);
  const [yearMinInput, setYearMinInput] = useState("");
  const [yearMaxInput, setYearMaxInput] = useState("");

  const [topN] = useState(5); // top fijo
  const [countryFilter, setCountryFilter] = useState([]); // [] = todos

  /* ---- Cargar CSV ---- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("annual-co2-emissions-per-country.csv", {
          cache: "no-store",
        });
        if (!res.ok)
          throw new Error(`No pude descargar el CSV (HTTP ${res.status}).`);
        const text = await res.text();
        Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          worker: false,
          complete: (r) => {
            setRows(r.data || []);
            setLoading(false);
          },
          error: (e) => {
            setError(`Error de parseo: ${e?.message || e}`);
            setLoading(false);
          },
        });
      } catch (e) {
        setError(e?.message || String(e));
        setLoading(false);
      }
    })();
  }, []);

  /* ---- Autodetección de columnas ---- */
  const columns = useMemo(() => {
    if (!rows.length) return null;
    const norm = (s) =>
      String(s ?? "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/₂/g, "2")
        .toLowerCase()
        .trim();
    const keys = Object.keys(rows[0] || {});
    const nmap = keys.map(norm);
    const pick = (needles) => {
      const i = nmap.findIndex((k) => needles.some((n) => k.includes(n)));
      return i >= 0 ? keys[i] : null;
    };
    const cols = {
      entity: pick(["entity", "country", "pais", "name"]),
      code: pick(["code", "iso"]),
      year: pick(["year", "anio", "ano", "año"]),
      co2: pick(["co2", "co 2", "emision", "emisiones", "emission"]),
    };
    if (!cols.entity || !cols.year || !cols.co2)
      return { ...cols, __invalid: true };
    return cols;
  }, [rows]);

  /* ---- Meta (años + lista de países visibles) ---- */
  const meta = useMemo(() => {
    if (!rows.length || !columns || columns.__invalid)
      return { years: [], countries: [] };

    const years = Array.from(
      new Set(
        rows.map((r) => Number(r[columns.year])).filter(Number.isFinite)
      )
    ).sort((a, b) => a - b);

    const baseEntityAllowed = (r) => {
      const name = String(r[columns.entity] ?? "");
      const codeRaw = columns.code ? r[columns.code] : null;
      const hasCode =
        codeRaw !== null &&
        codeRaw !== undefined &&
        String(codeRaw).trim() !== "";

      // Ocultar World
      if (hideWorld && name.toLowerCase() === "world") return false;
      // Regiones / grupos sin código ISO (Africa, Europe, Upper-middle-income countries, etc.)
      if (hideGroups && !hasCode) return false;
      // Grupos GCP
      if (hideGCP && /\(gcp\)/i.test(name)) return false;
      // Agregados OWID_*
      if (
        hideOWID &&
        columns.code &&
        typeof codeRaw === "string" &&
        codeRaw.startsWith("OWID")
      )
        return false;
      // NUEVO: ocultar países "normales" que sí tienen código
      if (hideRegular && hasCode) return false;

      return true;
    };

    const countries = Array.from(
      new Set(
        rows
          .filter(baseEntityAllowed)
          .map((r) => r[columns.entity])
          .filter(Boolean)
      )
    ).sort();

    return { years, countries };
  }, [rows, columns, hideWorld, hideGroups, hideGCP, hideOWID, hideRegular]);

  /* ---- Ajustar años iniciales al rango real + inputs visibles ---- */
  useEffect(() => {
    if (!meta.years.length) return;
    const y0 = meta.years[0];
    const y1 = meta.years.at(-1);
    setYearMin(y0);
    setYearMax(y1);
    setYearMinInput(String(y0));
    setYearMaxInput(String(y1));
  }, [meta.years]);

  /* ---- Helpers de filtros ---- */
  const scaleDiv = unit === "Gt" ? 1e9 : 1e6; // toneladas -> Gt/Mt
  const unitLabel = unit;

  const entityAllowed = (r) => {
    const name = String(r[columns.entity] ?? "");
    const codeRaw = columns.code ? r[columns.code] : null;
    const hasCode =
      codeRaw !== null &&
      codeRaw !== undefined &&
      String(codeRaw).trim() !== "";

    if (hideWorld && name.toLowerCase() === "world") return false;
    if (hideGroups && !hasCode) return false;
    if (hideGCP && /\(gcp\)/i.test(name)) return false;
    if (
      hideOWID &&
      columns.code &&
      typeof codeRaw === "string" &&
      codeRaw.startsWith("OWID")
    )
      return false;
    // NUEVO: ocultar países normales con código
    if (hideRegular && hasCode) return false;

    if (countryFilter.length === 0) return true;
    return countryFilter.includes(name);
  };

  /* ---- Handlers para validar años al salir del input ---- */
  const handleYearMinBlur = () => {
    if (!meta.years.length) return;
    const baseMin = meta.years[0];
    let val = parseInt(yearMinInput, 10);
    if (!Number.isFinite(val)) val = baseMin;
    const clamped = Math.max(baseMin, Math.min(val, yearMax));
    setYearMin(clamped);
    setYearMinInput(String(clamped));
  };

  const handleYearMaxBlur = () => {
    if (!meta.years.length) return;
    const baseMax = meta.years.at(-1);
    let val = parseInt(yearMaxInput, 10);
    if (!Number.isFinite(val)) val = baseMax;
    const clamped = Math.min(baseMax, Math.max(val, yearMin));
    setYearMax(clamped);
    setYearMaxInput(String(clamped));
  };

  /* ---- Serie global por año (mundo completo) ---- */
  const globalSeries = useMemo(() => {
    if (!columns || columns.__invalid) return [];
    const byYear = new Map();
    for (const r of rows) {
      const y = Number(r[columns.year]);
      if (!Number.isFinite(y)) continue;
      const v = Number(r[columns.co2]) || 0;
      byYear.set(y, (byYear.get(y) || 0) + v);
    }
    return Array.from(byYear, ([year, value]) => ({
      year,
      val: value / scaleDiv,
    })).sort((a, b) => a.year - b.year);
  }, [rows, columns, scaleDiv]);

  /* ---- Último, YoY, pico y valle (globales) ---- */
  const latest = useMemo(() => {
    if (!globalSeries.length) return null;
    const last = globalSeries.at(-1);
    const prev = globalSeries.at(-2) || { val: 0, year: last.year - 1 };
    const yoy = prev.val ? ((last.val - prev.val) / prev.val) * 100 : 0;
    let peak = last,
      valley = last;
    for (const d of globalSeries) {
      if (d.val > peak.val) peak = d;
      if (d.val < valley.val) valley = d;
    }
    return { last, prev, yoy, peak, valley };
  }, [globalSeries]);

  /* ---- Serie global recortada (por inputs de año) ---- */
  const seriesClamped = useMemo(
    () => globalSeries.filter((d) => d.year >= yearMin && d.year <= yearMax),
    [globalSeries, yearMin, yearMax]
  );

  const visibleSeries = seriesClamped.length ? seriesClamped : globalSeries;

  const localExtremes = useMemo(() => {
    if (!visibleSeries.length) return { peak: null, valley: null };
    let peak = visibleSeries[0],
      valley = visibleSeries[0];
    for (const d of visibleSeries) {
      if (d.val > peak.val) peak = d;
      if (d.val < valley.val) valley = d;
    }
    return { peak, valley };
  }, [visibleSeries]);

  /* ---- Top N (último año visible = yearMax) con filtros ---- */
  const top = useMemo(() => {
    if (!columns || columns.__invalid || !globalSeries.length || !meta.years.length)
      return { list: [], world: 0, lastYear: null };

    const displayYear = Math.min(yearMax, meta.years.at(-1));
    const world = globalSeries.find((d) => d.year === displayYear)?.val ?? 0;

    const byCountry = new Map();
    for (const r of rows) {
      if (Number(r[columns.year]) !== displayYear) continue;
      if (!entityAllowed(r)) continue;
      byCountry.set(
        r[columns.entity],
        (byCountry.get(r[columns.entity]) || 0) + (Number(r[columns.co2]) || 0)
      );
    }

    const list = Array.from(byCountry, ([country, val]) => ({
      country,
      val: val / scaleDiv,
    }))
      .sort((a, b) => b.val - a.val)
      .slice(0, topN);

    return { list, world, lastYear: displayYear };
  }, [
    rows,
    columns,
    globalSeries,
    topN,
    hideWorld,
    hideGroups,
    hideGCP,
    hideOWID,
    hideRegular,
    countryFilter,
    scaleDiv,
    yearMax,
    meta.years,
  ]);

  /* ---- Subieron vs bajaron (año visible = yearMax) + listas ---- */
  const upDown = useMemo(() => {
    if (!columns || columns.__invalid || !meta.years.length) {
      return {
        up: 0,
        down: 0,
        same: 0,
        year: null,
        upList: [],
        downList: [],
        sameList: [],
      };
    }
    const Y = Math.min(yearMax, meta.years.at(-1));
    const Yp = Y - 1;

    const cur = new Map();
    const prev = new Map();

    for (const r of rows) {
      if (!entityAllowed(r)) continue;
      const y = Number(r[columns.year]);
      if (!Number.isFinite(y)) continue;
      const c = r[columns.entity],
        v = Number(r[columns.co2]) || 0;
      if (y === Y) cur.set(c, (cur.get(c) || 0) + v);
      if (y === Yp) prev.set(c, (prev.get(c) || 0) + v);
    }

    const upList = [];
    const downList = [];
    const sameList = [];
    let up = 0,
      down = 0,
      same = 0;

    const allCountries = new Set([...cur.keys(), ...prev.keys()]);
    for (const c of allCountries) {
      const v = (cur.get(c) || 0) / scaleDiv;
      const vp = (prev.get(c) || 0) / scaleDiv;
      const deltaAbs = v - vp;
      const deltaPct = vp ? (deltaAbs / vp) * 100 : v ? 100 : 0;

      if (deltaAbs > 0) {
        up++;
        upList.push({ country: c, deltaAbs, deltaPct });
      } else if (deltaAbs < 0) {
        down++;
        downList.push({ country: c, deltaAbs, deltaPct });
      } else {
        same++;
        sameList.push({ country: c });
      }
    }

    upList.sort((a, b) => b.deltaAbs - a.deltaAbs);
    downList.sort((a, b) => a.deltaAbs - b.deltaAbs);
    sameList.sort((a, b) => a.country.localeCompare(b.country));

    return { up, down, same, year: Y, upList, downList, sameList };
  }, [
    rows,
    columns,
    hideWorld,
    hideGroups,
    hideGCP,
    hideOWID,
    hideRegular,
    countryFilter,
    scaleDiv,
    yearMax,
    meta.years,
  ]);

  /* ---- Picos por país (Top 15) con filtros ---- */
  const peaksTop = useMemo(() => {
    if (!columns || columns.__invalid) return [];
    const map = new Map();
    for (const r of rows) {
      if (!entityAllowed(r)) continue;
      const c = r[columns.entity],
        y = Number(r[columns.year]),
        v = Number(r[columns.co2]) || 0;
      const cur = map.get(c);
      if (!cur || v > cur.raw)
        map.set(c, { country: c, year: y, val: v / scaleDiv, raw: v });
    }
    return Array.from(map.values())
      .sort((a, b) => b.val - a.val)
      .slice(0, 15);
  }, [
    rows,
    columns,
    hideWorld,
    hideGroups,
    hideGCP,
    hideOWID,
    hideRegular,
    countryFilter,
    scaleDiv,
  ]);

  /* ====== UI ====== */
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 20px" }}>
        <h1 style={{ margin: "8px 0 2px", fontSize: 28, fontWeight: 800 }}>
          Emisiones Globales de CO₂-Dariana Echeverria y Marko Chable
        </h1>
        <p style={{ margin: "0 0 18px", color: "#a9b4c0" }}>
        </p>

        {loading && <div style={{ padding: 16 }}>Cargando datos…</div>}
        {error && (
          <div style={{ padding: 16, color: "#ff6b6b" }}>Error: {error}</div>
        )}

        {!loading && !error && columns && !columns.__invalid && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 2fr 1fr",
              gap: 16,
            }}
          >
            {/* ===== COLUMNA 1 ===== */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              <Card title="KPI Principal">
                {latest && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3,1fr)",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <KPI
                      title={`Emisiones globales (${latest.last.year})`}
                      value={`${latest.last.val.toFixed(2)} ${unitLabel}`}
                      sub={`${latest.yoy >= 0 ? "+" : ""}${latest.yoy.toFixed(
                        2
                      )}% YoY`}
                    />
                    <KPI
                      title="Pico global"
                      value={`${latest.peak.val.toFixed(2)} ${unitLabel}`}
                      sub={`Año ${latest.peak.year}`}
                    />
                    <KPI
                      title="Valle global"
                      value={`${latest.valley.val.toFixed(2)} ${unitLabel}`}
                      sub={`Año ${latest.valley.year}`}
                    />
                  </div>
                )}

                {/* Línea principal con pico/valle del rango visible */}
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart
                    data={visibleSeries}
                    margin={{ top: 8, right: 24, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid
                      stroke={C.neutral}
                      strokeDasharray="3 3"
                      opacity={0.25}
                    />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#cfd8dc", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "#cfd8dc", fontSize: 12 }}
                      tickFormatter={(v) => v.toFixed(1)}
                    />
                    <Tooltip
                      {...TTS}
                      formatter={(v) =>
                        `${Number(v).toFixed(2)} ${unitLabel}`
                      }
                      labelFormatter={(l) => `Año ${l}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="val"
                      name={`CO₂ global (${unitLabel})`}
                      stroke={C.secondary}
                      dot={false}
                      strokeWidth={2}
                    />

                    {localExtremes.peak && (
                      <ReferenceDot
                        x={localExtremes.peak.year}
                        y={localExtremes.peak.val}
                        r={5}
                        fill={C.primary}
                        stroke="#ffffff"
                      >
                        <text
                          x={0}
                          y={-10}
                          textAnchor="middle"
                          fill="#cfd8dc"
                          fontSize="11"
                        >
                          {`Pico ${localExtremes.peak.year} (${localExtremes.peak.val.toFixed(
                            2
                          )} ${unitLabel})`}
                        </text>
                      </ReferenceDot>
                    )}
                    {localExtremes.valley && (
                      <ReferenceDot
                        x={localExtremes.valley.year}
                        y={localExtremes.valley.val}
                        r={5}
                        fill={C.accent}
                        stroke="#ffffff"
                      >
                        <text
                          x={0}
                          y={-10}
                          textAnchor="middle"
                          fill="#cfd8dc"
                          fontSize="11"
                        >
                          {`Valle ${localExtremes.valley.year} (${localExtremes.valley.val.toFixed(
                            2
                          )} ${unitLabel})`}
                        </text>
                      </ReferenceDot>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card
                title={`Países que Suben vs Bajan (${upDown.year ?? "—"})`}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={[
                      { name: "Subieron", value: upDown.up },
                      { name: "Bajaron", value: upDown.down },
                      { name: "Igual", value: upDown.same },
                    ]}
                    margin={{ top: 30, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      stroke={C.neutral}
                      strokeDasharray="3 3"
                      opacity={0.25}
                    />
                    <XAxis dataKey="name" tick={{ fill: "#cfd8dc" }} />
                    <YAxis tick={{ fill: "#cfd8dc" }} />
                    <Tooltip {...TTS} />
                    <Bar dataKey="value" name="Países">
                      <Cell fill={C.accent} />
                      <Cell fill={C.secondary} />
                      <Cell fill={C.neutral} />
                      <LabelList
                        dataKey="value"
                        position="top"
                        fill="#cfd8dc"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Listas ↑ / ↓ / = (Top 10) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 12,
                    marginTop: 12,
                  }}
                >
                  <ListCard
                    title="↑ Subieron (Top 10)"
                    items={upDown.upList.slice(0, 10)}
                    unit={unitLabel}
                    positive
                  />
                  <ListCard
                    title="↓ Bajaron (Top 10)"
                    items={upDown.downList.slice(0, 10)}
                    unit={unitLabel}
                  />
                  <SameListCard
                    title="= Igual"
                    items={upDown.sameList.slice(0, 10)}
                  />
                </div>
              </Card>
            </div>

            {/* ===== COLUMNA 2 ===== */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              <Card title={`Top ${topN} países (${top.lastYear ?? "—"})`}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={top.list}
                    layout="vertical"
                    margin={{ top: 6, right: 40, bottom: 0, left: 10 }}
                  >
                    <CartesianGrid
                      stroke={C.neutral}
                      strokeDasharray="3 3"
                      opacity={0.3}
                    />
                    <XAxis type="number" tick={{ fill: "#cfd8dc" }} />
                    <YAxis
                      type="category"
                      dataKey="country"
                      width={130}
                      tick={{ fill: "#cfd8dc", fontSize: 12 }}
                      tickFormatter={(v) => truncate(v, 30)}
                    />
                    <Tooltip
                      {...TTS}
                      formatter={(v) =>
                        `${Number(v).toFixed(2)} ${unitLabel}`
                      }
                    />
                    <Bar
                      dataKey="val"
                      name={`${unitLabel} CO₂`}
                      fill={C.primary}
                      barSize={16}
                    >
                      <LabelList
                        dataKey="val"
                        position="right"
                        formatter={(v) => Number(v).toFixed(2)}
                        fill="#cfd8dc"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Anillo Top5 vs resto (con porcentajes) */}
                <div style={{ height: 180, marginTop: 8 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: "Top 5",
                            value: top.list
                              .slice(0, 5)
                              .reduce(
                                (s, d) => s + (d.val || 0),
                                0
                              ),
                          },
                          {
                            name: "Resto",
                            value: Math.max(
                              0,
                              (top.world || 0) -
                                top.list
                                  .slice(0, 5)
                                  .reduce(
                                    (s, d) => s + (d.val || 0),
                                    0
                                  )
                            ),
                          },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={75}
                        label={PercentLabel}
                        labelLine={false}
                      >
                        <Cell fill={C.primary} />
                        <Cell fill="#263238" />
                      </Pie>
                      {/* Tooltip sin porcentaje para evitar NaN% */}
                      <Tooltip
                        {...TTS}
                        formatter={(value, name) => [
                          `${Number(value).toFixed(2)} ${unitLabel}`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ fontSize: 12, color: "#a9b4c0" }}>
                  Mundo: {top.world ? top.world.toFixed(2) : "—"} {unitLabel}
                </div>
              </Card>

              {/* ===== GRÁFICA DE PICOS AJUSTADA ===== */}
              <Card title="Pico histórico por país (Top-15, etiqueta con año)">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={peaksTop}
                    layout="vertical"
                    margin={{ top: 8, right: 60, bottom: 0, left: 5 }}
                  >
                    <CartesianGrid
                      stroke={C.neutral}
                      strokeDasharray="3 3"
                      opacity={0.25}
                    />
                    <XAxis type="number" tick={{ fill: "#cfd8dc" }} />
                    <YAxis
                      type="category"
                      dataKey="country"
                      width={140}
                      tickLine={false}
                      tick={{ fill: "#cfd8dc", fontSize: 12 }}
                      tickFormatter={(v) => truncate(v, 36)}
                    />
                    <Tooltip
                      {...TTS}
                      formatter={(v) =>
                        `${Number(v).toFixed(2)} ${unitLabel}`
                      }
                    />
                    <Bar
                      dataKey="val"
                      name={`${unitLabel} CO₂`}
                      fill={C.secondary}
                      barSize={14}
                    >
                      <LabelList dataKey="year" content={YearRightLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* ===== COLUMNA 3 (Sidebar) ===== */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              <Card title="Filtros">
                {/* Unidades */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Unidades
                  </div>
                  <label style={{ marginRight: 12 }}>
                    <input
                      type="radio"
                      name="unit"
                      value="Gt"
                      checked={unit === "Gt"}
                      onChange={() => setUnit("Gt")}
                    />{" "}
                    Gt
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="unit"
                      value="Mt"
                      checked={unit === "Mt"}
                      onChange={() => setUnit("Mt")}
                    />{" "}
                    Mt
                  </label>
                </div>

                {/* Años (inputs editables) */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Año</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#9fb0bd",
                      marginBottom: 6,
                    }}
                  >
                    Rango permitido:{" "}
                    <strong>
                      {meta.years[0] ?? "—"} – {meta.years.at?.(-1) ?? "—"}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#bbb",
                          marginBottom: 4,
                        }}
                      >
                        Desde
                      </div>
                      <input
                        type="number"
                        min={meta.years[0]}
                        max={yearMax}
                        value={yearMinInput}
                        onChange={(e) => setYearMinInput(e.target.value)}
                        onBlur={handleYearMinBlur}
                        style={{
                          width: "100%",
                          background: "#111",
                          color: "#eee",
                          border: "1px solid #333",
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#bbb",
                          marginBottom: 4,
                        }}
                      >
                        Hasta
                      </div>
                      <input
                        type="number"
                        min={yearMin}
                        max={meta.years.at(-1)}
                        value={yearMaxInput}
                        onChange={(e) => setYearMaxInput(e.target.value)}
                        onBlur={handleYearMaxBlur}
                        style={{
                          width: "100%",
                          background: "#111",
                          color: "#eee",
                          border: "1px solid #333",
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Países */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    País(es)
                  </div>
                  <CountryFilter
                    countries={meta.countries}
                    value={countryFilter}
                    onChange={setCountryFilter}
                  />
                </div>

                {/* Ocultar agregados */}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 600 }}>Ocultar agregados</div>
                  <label>
                    <input
                      type="checkbox"
                      checked={hideWorld}
                      onChange={(e) => setHideWorld(e.target.checked)}
                    />{" "}
                    “World”
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={hideGroups}
                      onChange={(e) => setHideGroups(e.target.checked)}
                    />{" "}
                    Regiones / grupos (sin código)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={hideGCP}
                      onChange={(e) => setHideGCP(e.target.checked)}
                    />{" "}
                    Grupos (GCP)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={hideOWID}
                      onChange={(e) => setHideOWID(e.target.checked)}
                    />{" "}
                    Agregados OWID_*
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={hideRegular}
                      onChange={(e) => setHideRegular(e.target.checked)}
                    />{" "}
                    Países estándar
                  </label>
                </div>
              </Card>

              <Card title="Unidades (Mt y Gt)">
                <ul
                  style={{
                    margin: "4px 0 0 18px",
                    padding: 0,
                    color: "#cfd8dc",
                  }}
                >
                  <li>
                    <strong>Mt</strong>: megatoneladas de CO₂ (millones de toneladas).
                  </li>
                  <li>
                    <strong>Gt</strong>: gigatoneladas de CO₂ (mil millones de toneladas).
                  </li>
                </ul>
                <div style={{ marginTop: 8, fontSize: 12, color: "#a9b4c0" }}>
                  1 Gt = 1,000 Mt
                </div>
              </Card>
            </div>
          </div>
        )}

        {!loading && columns && columns.__invalid && (
          <div style={{ padding: 16, color: "#ff6b6b" }}>
            No pude detectar columnas (necesito país, año y CO₂). Revisa
            encabezados del CSV.
          </div>
        )}
      </div>
    </div>
  );
}

/* ====== Subcomponentes simples ====== */
function KPI({ title, value, sub }) {
  return (
    <div
      style={{
        background: "#0d1118",
        border: `1px solid ${C.neutral}33`,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: "#9fb0bd" }}>{title}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: C.text,
          lineHeight: 1,
          marginTop: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#9fb0bd", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.neutral}33`,
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 6px 18px rgba(0,0,0,.25)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function ListCard({ title, items, unit, positive = false }) {
  return (
    <div
      style={{
        background: "#0d1118",
        border: `1px solid ${C.neutral}33`,
        borderRadius: 12,
        padding: 12,
        maxHeight: 180,
        overflow: "auto",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {items.length === 0 && (
        <div style={{ color: "#9fb0bd", fontSize: 12 }}>—</div>
      )}
      {items.map((d) => (
        <div
          key={d.country}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          <span style={{ color: "#cfd8dc" }}>{d.country}</span>
          <span style={{ color: positive ? "#9BE7A8" : "#F8B4B4" }}>
            {d.deltaAbs >= 0 ? "+" : ""}
            {d.deltaAbs.toFixed(2)} {unit}{" "}
            <span style={{ color: "#a9b4c0" }}>
              ({d.deltaPct >= 0 ? "+" : ""}
              {d.deltaPct.toFixed(1)}%)
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function SameListCard({ title, items }) {
  return (
    <div
      style={{
        background: "#0d1118",
        border: `1px solid ${C.neutral}33`,
        borderRadius: 12,
        padding: 12,
        maxHeight: 180,
        overflow: "auto",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {items.length === 0 && (
        <div style={{ color: "#9fb0bd", fontSize: 12 }}>—</div>
      )}
      {items.map((d) => (
        <div
          key={d.country}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          <span style={{ color: "#cfd8dc" }}>{d.country}</span>
          <span style={{ color: "#a9b4c0" }}>=</span>
        </div>
      ))}
    </div>
  );
}
