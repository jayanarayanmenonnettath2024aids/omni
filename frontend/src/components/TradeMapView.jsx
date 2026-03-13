import React, { useEffect, useMemo, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const LOCATION_COORDS = {
  'chennai': { lat: 13.0827, lon: 80.2707, india: true },
  'mumbai': { lat: 19.076, lon: 72.8777, india: true },
  'kochi': { lat: 9.9312, lon: 76.2673, india: true },
  'hyderabad': { lat: 17.385, lon: 78.4867, india: true },
  'guntur': { lat: 16.3067, lon: 80.4365, india: true },
  'bangalore': { lat: 12.9716, lon: 77.5946, india: true },
  'bengaluru': { lat: 12.9716, lon: 77.5946, india: true },
  'kolkata': { lat: 22.5726, lon: 88.3639, india: true },
  'delhi': { lat: 28.6139, lon: 77.209, india: true },
  'visakhapatnam': { lat: 17.6868, lon: 83.2185, india: true },
  'rotterdam': { lat: 51.9244, lon: 4.4777, india: false },
  'doha': { lat: 25.2854, lon: 51.531, india: false },
  'seoul': { lat: 37.5665, lon: 126.978, india: false },
  'uae': { lat: 24.4539, lon: 54.3773, india: false },
  'dubai': { lat: 25.2048, lon: 55.2708, india: false },
  'singapore': { lat: 1.3521, lon: 103.8198, india: false },
  'shanghai': { lat: 31.2304, lon: 121.4737, india: false },
  'new york': { lat: 40.7128, lon: -74.006, india: false },
};

const aliasFor = (value) => {
  const text = String(value || '').toLowerCase();
  if (text.includes('bangalore air cargo')) return 'bangalore';
  if (text.includes('kochi port')) return 'kochi';
  if (text.includes('chennai port')) return 'chennai';
  if (text.includes('krishnapatnam')) return 'chennai';
  if (text.includes('south korea')) return 'seoul';
  if (text.includes('uae')) return 'uae';
  return text;
};

const resolveCoord = (value) => {
  const alias = aliasFor(value);
  if (LOCATION_COORDS[alias]) return LOCATION_COORDS[alias];
  const key = Object.keys(LOCATION_COORDS).find((name) => alias.includes(name));
  return key ? LOCATION_COORDS[key] : null;
};

const routeStroke = (type) => {
  if (type === 'EXPORT') return '#1d4ed8';
  if (type === 'IMPORT') return '#0f766e';
  return '#7c3aed';
};

const buildArcPoints = (from, to, strength = 0.18, segments = 28) => {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const distance = Math.sqrt(dLat * dLat + dLon * dLon);
  const lift = Math.max(1.2, distance * strength);

  // 2D perpendicular direction in lat/lon plane.
  const norm = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
  const pLat = -dLon / norm;
  const pLon = dLat / norm;

  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const baseLat = lat1 + dLat * t;
    const baseLon = lon1 + dLon * t;

    // Sine profile makes a smooth arc with zero offset at both endpoints.
    const offset = Math.sin(Math.PI * t) * lift;
    const lat = baseLat + pLat * offset;
    const lon = baseLon + pLon * offset;
    points.push([lat, lon]);
  }

  return points;
};

const TradeMapView = ({ userRole }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/data?role=${encodeURIComponent(userRole || 'super')}`);
        const payload = await res.json();
        if (!cancelled) {
          setTransactions(Array.isArray(payload?.transactions) ? payload.transactions : []);
        }
      } catch (_e) {
        if (!cancelled) setTransactions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userRole]);

  const routes = useMemo(() => {
    const dedupe = new Map();
    for (const tx of transactions) {
      const fromText = tx.origin || '';
      const toText = tx.destination || '';
      const from = resolveCoord(fromText);
      const to = resolveCoord(toText);
      if (!from || !to) continue;

      let type = String(tx.trade_type || 'DOMESTIC').toUpperCase();
      if (type !== 'EXPORT' && type !== 'IMPORT') {
        type = from.india && to.india ? 'DOMESTIC' : 'UNKNOWN';
      }
      if (type === 'UNKNOWN') continue;

      const key = `${fromText}|${toText}|${type}`;
      const current = dedupe.get(key) || {
        fromText,
        toText,
        from,
        to,
        type,
        count: 0,
        value: 0,
      };
      current.count += 1;
      current.value += Number(tx.qty || 0) * Number(tx.rate || 0);
      dedupe.set(key, current);
    }

    return Array.from(dedupe.values()).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const roleNormalized = String(userRole || 'super').toLowerCase();
  const roleRouteType = roleNormalized === 'import' ? 'IMPORT' : roleNormalized === 'export' ? 'EXPORT' : roleNormalized === 'domestic' ? 'DOMESTIC' : 'ALL';

  const visibleRoutes = useMemo(() => {
    if (roleRouteType === 'ALL') return routes;
    return routes.filter((route) => route.type === roleRouteType);
  }, [routes, roleRouteType]);

  const mapCenter = useMemo(() => {
    if (roleRouteType === 'DOMESTIC') return [22.5, 79.5];
    if (roleRouteType === 'EXPORT') return [18, 72];
    if (roleRouteType === 'IMPORT') return [24, 78];
    return [20, 20];
  }, [roleRouteType]);

  const mapZoom = roleRouteType === 'DOMESTIC' ? 4 : 2;

  const roleLabel = String(userRole || 'super').toUpperCase();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3">Trade Route <span className="text-blue-600">Map</span></h1>
          <p className="text-sm text-gray-500 font-medium">Role-aware route connections for {roleLabel} desk on a real map view.</p>
        </div>
        <div className="rounded-xl border border-corp-border bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-corp-dark">
          {roleRouteType === 'ALL' ? 'ALL ROUTES' : `${roleRouteType} ROUTES`}
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-20 text-center text-xs font-black uppercase tracking-widest text-blue-600">
          Loading route network...
        </div>
      ) : (
        <>
          <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500">
              <Globe2 size={14} /> {roleRouteType === 'DOMESTIC' ? 'India Domestic Route Map' : roleRouteType === 'ALL' ? 'Global Trade Route Map' : `${roleRouteType} Route Map`}
            </div>
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              scrollWheelZoom={true}
              style={{ height: 460, width: '100%', borderRadius: 12 }}
              className="border border-slate-100"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              />

              {visibleRoutes.map((route, idx) => {
                const from = [route.from.lat, route.from.lon];
                const to = [route.to.lat, route.to.lon];
                const color = routeStroke(route.type);
                const weight = Math.min(7, 2 + route.count * 0.7);
                const arcPoints = buildArcPoints(from, to, route.type === 'DOMESTIC' ? 0.08 : 0.17, route.type === 'DOMESTIC' ? 20 : 34);
                return (
                  <React.Fragment key={`route-${idx}`}>
                    <Polyline positions={arcPoints} pathOptions={{ color, weight, opacity: 0.72 }} smoothFactor={1.2}>
                      <Popup>
                        <div style={{ minWidth: 190 }}>
                          <div><strong>{route.type}</strong></div>
                          <div>{route.fromText} {'->'} {route.toText}</div>
                          <div>Shipments: {route.count}</div>
                          <div>Value: INR {new Intl.NumberFormat('en-IN').format(Math.round(route.value))}</div>
                        </div>
                      </Popup>
                    </Polyline>
                    <CircleMarker center={from} radius={4} pathOptions={{ color, fillColor: color, fillOpacity: 0.95 }} />
                    <CircleMarker center={to} radius={4} pathOptions={{ color, fillColor: color, fillOpacity: 0.95 }} />
                  </React.Fragment>
                );
              })}
            </MapContainer>
          </div>

          <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-corp-border bg-gray-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
              Route Ledger ({visibleRoutes.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] border-b border-corp-border">
                    <th className="px-6 py-4 text-left">Type</th>
                    <th className="px-6 py-4 text-left">Source</th>
                    <th className="px-6 py-4 text-left">Destination</th>
                    <th className="px-6 py-4 text-right">Shipments</th>
                    <th className="px-6 py-4 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleRoutes.length ? visibleRoutes.map((route, idx) => (
                    <tr key={`${route.fromText}-${route.toText}-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-corp-dark">{route.type}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{route.fromText}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{route.toText}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{route.count}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900 italic">INR {new Intl.NumberFormat('en-IN').format(Math.round(route.value))}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="5" className="px-6 py-10 text-center text-sm font-semibold text-gray-400">No routes available for this role/filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TradeMapView;
