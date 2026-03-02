// PunchLocationSettings — Admin panel to configure GPS-based punch location
// Admin sets: office name, lat/lng, allowed radius
// Employees can only punch within this zone when enabled

import { useState } from 'react';
import { MapPin, Navigation, Save, ToggleLeft, ToggleRight, Target } from 'lucide-react';
import { useSystemConfigStore } from '@/store/systemConfigStore';
import { useAuthStore } from '@/store/authStore';
import { Roles } from '@/types';

export const PunchLocationSettings = () => {
    const { user } = useAuthStore();
    const { punchLocation, setPunchLocation, togglePunchLocation } = useSystemConfigStore();

    const [form, setForm] = useState({
        name: punchLocation.name,
        lat: punchLocation.lat.toString(),
        lng: punchLocation.lng.toString(),
        radiusMeters: punchLocation.radiusMeters.toString(),
    });
    const [saved, setSaved] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [detectError, setDetectError] = useState<string | null>(null);

    // Only admin/superadmin can access
    if (user?.role !== Roles.ADMIN && user?.role !== Roles.SUPER_ADMIN) return null;


    const handleSave = () => {
        const lat = parseFloat(form.lat);
        const lng = parseFloat(form.lng);
        const radius = parseInt(form.radiusMeters, 10);

        if (isNaN(lat) || isNaN(lng)) {
            alert('Valid latitude aur longitude enter karein.');
            return;
        }
        if (isNaN(radius) || radius < 10) {
            alert('Radius kam se kam 10 meters hona chahiye.');
            return;
        }

        setPunchLocation({ name: form.name, lat, lng, radiusMeters: radius });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleDetectCurrent = () => {
        if (!navigator.geolocation) {
            setDetectError('GPS is device mein available nahi hai.');
            return;
        }
        setDetecting(true);
        setDetectError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm(f => ({
                    ...f,
                    lat: pos.coords.latitude.toFixed(6),
                    lng: pos.coords.longitude.toFixed(6),
                }));
                setDetecting(false);
            },
            (err) => {
                setDetectError(err.code === 1
                    ? 'Location permission deny ki gayi. Browser mein Allow karein.'
                    : 'Location detect nahi ho payi.');
                setDetecting(false);
            },
            { timeout: 10000 }
        );
    };

    return (
        <div className="glass rounded-2xl p-6 space-y-5 border border-dark-border">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">GPS Punch Location</h3>
                        <p className="text-dark-muted text-xs">Employee sirf is location ke andar punch kar sakta hai</p>
                    </div>
                </div>
                {/* Enable/Disable Toggle */}
                <button
                    onClick={togglePunchLocation}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${punchLocation.enabled
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-600/40 hover:bg-slate-700'
                        }`}
                >
                    {punchLocation.enabled
                        ? <><ToggleRight className="w-4 h-4" /> Enabled</>
                        : <><ToggleLeft className="w-4 h-4" /> Disabled</>
                    }
                </button>
            </div>

            {!punchLocation.enabled && (
                <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3 text-xs text-slate-500">
                    📍 Location-based punch abhi <strong className="text-slate-400">OFF</strong> hai. Toggle se on karein taaki employees sirf office se hi punch karen.
                </div>
            )}

            {/* Form */}
            <div className="space-y-4">
                {/* Location Name */}
                <div>
                    <label className="block text-xs text-dark-muted mb-1.5 font-semibold">Location Name</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Head Office, Factory A"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors placeholder-slate-600"
                    />
                </div>

                {/* Detect from Current Location */}
                <div>
                    <label className="block text-xs text-dark-muted mb-1.5 font-semibold">Coordinates (Lat / Long)</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={form.lat}
                            onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                            placeholder="Latitude e.g. 28.6139"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50 transition-colors placeholder-slate-600"
                        />
                        <input
                            type="text"
                            value={form.lng}
                            onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                            placeholder="Longitude e.g. 77.2090"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50 transition-colors placeholder-slate-600"
                        />
                        <button
                            onClick={handleDetectCurrent}
                            disabled={detecting}
                            title="Meri current location use karo"
                            className="px-3 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl border border-emerald-500/30 transition-all disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
                        >
                            <Navigation className={`w-4 h-4 ${detecting ? 'animate-spin' : ''}`} />
                            {detecting ? '...' : 'Detect'}
                        </button>
                    </div>
                    {detectError && (
                        <p className="text-red-400 text-xs mt-1.5">{detectError}</p>
                    )}
                    <p className="text-slate-600 text-[11px] mt-1.5">
                        💡 "Detect" button se admin ki current location automatically set ho jaayegi.
                        Ya Google Maps se exact coordinates copy karein.
                    </p>
                </div>

                {/* Radius */}
                <div>
                    <label className="block text-xs text-dark-muted mb-1.5 font-semibold">
                        Allowed Radius: <span className="text-emerald-400">{form.radiusMeters}m</span>
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="10"
                            max="1000"
                            step="10"
                            value={form.radiusMeters}
                            onChange={e => setForm(f => ({ ...f, radiusMeters: e.target.value }))}
                            className="flex-1 accent-emerald-500"
                        />
                        <input
                            type="number"
                            min="10"
                            max="5000"
                            value={form.radiusMeters}
                            onChange={e => setForm(f => ({ ...f, radiusMeters: e.target.value }))}
                            className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-sm text-center font-mono focus:outline-none focus:border-emerald-500/50"
                        />
                        <span className="text-slate-500 text-xs">meters</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                        <span>10m (strict)</span>
                        <span>500m (office block)</span>
                        <span>1km (area)</span>
                    </div>
                </div>
            </div>

            {/* Current saved config preview */}
            {punchLocation.lat !== 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-1">
                    <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5">
                        <Target className="w-3 h-3" /> Active Zone
                    </p>
                    <p className="text-xs text-slate-400">
                        <span className="text-white font-semibold">{punchLocation.name}</span>
                        {' '}— {punchLocation.lat.toFixed(5)}, {punchLocation.lng.toFixed(5)}
                        {' ('}<span className="text-emerald-400">{punchLocation.radiusMeters}m radius</span>)
                    </p>
                </div>
            )}

            {/* Save Button */}
            <button
                onClick={handleSave}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${saved
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-900/30'
                    }`}
            >
                {saved ? (
                    <><span>✓</span> Saved!</>
                ) : (
                    <><Save className="w-4 h-4" /> Save Location Settings</>
                )}
            </button>
        </div>
    );
};
