import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle, MapPin, PaperPlaneRight, ClipboardText,
  MagnifyingGlass, X, CaretRight, CaretLeft, Phone,
  User, WarningCircle, FirstAid, ListChecks,
} from '@phosphor-icons/react';
import api from '../../api/client';
import Map from '../../components/shared/Map';
import { useNotificationStore } from '../../stores/notificationStore';

// ── Constants ────────────────────────────────────────────────────────────────

const SUB_COUNTIES = [
  'Dagoretti North','Dagoretti South','Embakasi Central','Embakasi East',
  'Embakasi North','Embakasi South','Embakasi West','Kamukunji','Kasarani',
  'Kibra',"Lang'ata",'Makadara','Mathare','Roysambu','Ruaraka','Starehe','Westlands',
];

const ALERT_MODES = ['Phone', 'Radio', 'Walk-in', 'Other'];

const ORIGIN_OPTIONS = [
  'Community', 'Hospital', 'Police', 'Fire Department', 'Other EMS', 'Self-referral', 'Other',
];

const NATURE_OPTIONS = [
  'Trauma', 'Medical', 'Obstetric', 'Pediatric', 'Psychiatric', 'Burns', 'Poisoning', 'Other',
];

const NATURE_DETAIL: Record<string, string[]> = {
  Trauma:     ['Road Traffic Accident', 'Fall', 'Assault/Violence', 'Industrial Accident', 'Sports Injury', 'Other'],
  Medical:    ['Cardiac Arrest', 'Stroke', 'Seizure', 'Respiratory Distress', 'Diabetic Emergency', 'Other'],
  Obstetric:  ['Labour', 'Post-partum Haemorrhage', 'Eclampsia', 'Miscarriage', 'Other'],
  Pediatric:  ['Febrile Convulsion', 'Neonatal Emergency', 'Respiratory Distress', 'Trauma', 'Other'],
  Psychiatric:['Attempted Suicide', 'Acute Psychosis', 'Aggression', 'Other'],
  Burns:      ['Chemical', 'Electrical', 'Thermal', 'Other'],
  Poisoning:  ['Drug Overdose', 'Chemical Ingestion', 'Snake Bite', 'Other'],
  Other:      ['Other'],
};

// ── Steps config ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Alert',    icon: Phone },
  { id: 2, label: 'Location', icon: MapPin },
  { id: 3, label: 'Patient',  icon: User },
  { id: 4, label: 'Incident', icon: FirstAid },
  { id: 5, label: 'Review',   icon: ListChecks },
];

// ── Shared style tokens ───────────────────────────────────────────────────────

const inputCls = 'w-full h-11 px-4 border-2 border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none text-slate-700 placeholder:text-slate-300 bg-white transition-all';
const selectCls = inputCls;
const textareaCls = 'w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none resize-none text-slate-700 placeholder:text-slate-300 bg-white transition-all';

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-sm font-bold text-brand-teal mb-2">
    {children}
    {required && <span className="text-status-danger ml-1">*</span>}
  </label>
);

const Field = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className ?? 'flex flex-col'}>{children}</div>
);

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-slate-400 mt-1">{children}</p>
);

// ── Form state ────────────────────────────────────────────────────────────────

type FormState = {
  alertAt: string;
  alertMode: string;
  notifierName: string;
  notifierPhone: string;
  originOfAlert: string;
  locationName: string;
  subCounty: string;
  lat: number;
  lng: number;
  patientName: string;
  patientAge: string;
  patientGender: string;
  nextOfKin: string;
  nextOfKinPhone: string;
  massCasualty: boolean;
  massCasualtyCount: string;
  chiefComplaint: string;
  alertNature: string;
  alertNatureDetail: string;
  watcherComments: string;
  preHospitalManagement: string;
  placeOfReferral: string;
};

const defaultForm: FormState = {
  alertAt: new Date().toISOString().slice(0, 16),
  alertMode: 'Phone',
  notifierName: '',
  notifierPhone: '',
  originOfAlert: '',
  locationName: '',
  subCounty: '',
  lat: -1.2921,
  lng: 36.8219,
  patientName: '',
  patientAge: '',
  patientGender: '',
  nextOfKin: '',
  nextOfKinPhone: '',
  massCasualty: false,
  massCasualtyCount: '',
  chiefComplaint: '',
  alertNature: '',
  alertNatureDetail: '',
  watcherComments: '',
  preHospitalManagement: '',
  placeOfReferral: '',
};

// ── Review row ────────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value?: string | boolean }) {
  if (!value && value !== false) return null;
  return (
    <div className="flex gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 font-medium">{String(value)}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NewIncidentWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addNotification } = useNotificationStore();

  const submitted    = (location.state as any)?.submitted;
  const submittedCase = (location.state as any)?.caseNumber;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [showMap, setShowMap]       = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const set = (updates: Partial<FormState>) => setForm(prev => ({ ...prev, ...updates }));

  const canNext: Record<number, boolean> = {
    1: !!form.alertMode,
    2: !!form.locationName.trim() && !!form.subCounty,
    3: true,
    4: !!form.chiefComplaint.trim(),
  };

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Nairobi, Kenya')}&limit=1`);
      const data = await res.json();
      if (data?.length > 0) {
        set({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), locationName: searchQuery });
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    set({ lat, lng });
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data?.display_name) {
        const name = data.display_name.split(',').slice(0, 2).join(',').trim();
        set({ locationName: name });
        setSearchQuery(name);
      }
    } catch {}
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/incidents', {
        alertMode:            form.alertMode,
        alertAt:              form.alertAt,
        originOfAlert:        form.originOfAlert || undefined,
        notifierDetails:      form.notifierName ? [{ name: form.notifierName, phone: form.notifierPhone }] : undefined,
        locationName:         form.locationName,
        subCounty:            form.subCounty,
        lat:                  form.lat,
        lng:                  form.lng,
        patientName:          form.patientName  || undefined,
        patientAge:           form.patientAge   || undefined,
        patientGender:        form.patientGender || undefined,
        nextOfKin:            form.nextOfKin    || undefined,
        nextOfKinPhone:       form.nextOfKinPhone || undefined,
        massCasualty:         form.massCasualty,
        massCasualtyCount:    form.massCasualtyCount ? parseInt(form.massCasualtyCount, 10) : undefined,
        chiefComplaint:       form.chiefComplaint,
        alertNature:          form.alertNature  || undefined,
        alertNatureDetail:    form.alertNatureDetail || undefined,
        watcherComments:      form.watcherComments || undefined,
        preHospitalManagement: form.preHospitalManagement || undefined,
        placeOfReferral:      form.placeOfReferral || undefined,
      }),
    onSuccess: (res) => {
      const caseNumber = res?.data?.data?.caseNumber ?? '';
      navigate('/watcher/new-incident', { state: { submitted: true, caseNumber } });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        title: 'Submission Failed',
        message: err?.response?.data?.message || 'Could not submit incident.',
      });
    },
  });

  // ── Success screen ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-brand-green/10 flex items-center justify-center">
          <CheckCircle size={48} weight="fill" className="text-brand-green" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-brand-teal">Alert Submitted</h2>
          {submittedCase && (
            <p className="text-sm text-slate-500 mt-2">
              Case <span className="font-bold text-brand-teal">{submittedCase}</span> is now in the dispatch queue.
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setForm(defaultForm); setStep(1); navigate('/watcher/new-incident', { replace: true, state: {} }); }}
            className="px-5 py-2.5 border-2 border-slate-200 text-brand-teal text-sm font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <PaperPlaneRight size={16} /> New Alert
          </button>
          <button
            onClick={() => navigate('/watcher')}
            className="px-5 py-2.5 bg-brand-teal text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all"
          >
            My Alerts
          </button>
        </div>
      </div>
    );
  }

  // ── Wizard shell ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <div className="flex-1">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-0.5">New Incident</p>
          <h1 className="text-lg font-bold text-brand-teal">{STEPS[step - 1].label}</h1>
        </div>
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-status-danger hover:bg-red-50 rounded-lg transition-all">
          <X size={20} weight="bold" />
        </button>
      </div>

      {/* Step progress */}
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-0 max-w-2xl mx-auto">
          {STEPS.map((s, idx) => {
            const done    = step > s.id;
            const current = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => done && setStep(s.id)}
                  className={`flex flex-col items-center gap-1 group ${done ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all font-bold text-sm ${
                    done    ? 'bg-brand-green text-white'      :
                    current ? 'bg-brand-teal text-white ring-4 ring-brand-teal/20' :
                              'bg-slate-100 text-slate-400'
                  }`}>
                    {done ? <CheckCircle size={18} weight="fill" /> : <s.icon size={16} weight={current ? 'fill' : 'regular'} />}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide hidden sm:block ${
                    current ? 'text-brand-teal' : done ? 'text-brand-green' : 'text-slate-400'
                  }`}>
                    {s.label}
                  </span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded-full ${step > s.id ? 'bg-brand-green' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Step header */}
          <div className="bg-brand-teal px-6 py-4 flex items-center gap-3">
            {(() => { const S = STEPS[step - 1]; return <S.icon size={20} weight="fill" className="text-white/80" />; })()}
            <div>
              <p className="text-xs font-bold text-brand-green uppercase tracking-widest">Step {step} of {STEPS.length}</p>
              <h2 className="text-lg font-bold text-white">{STEPS[step - 1].label}</h2>
            </div>
          </div>

          <div className="p-6 space-y-5">

            {/* ── Step 1: Alert Details ───────────────────────────────────────── */}
            {step === 1 && (
              <>
                <Field>
                  <Label required>Alert Date &amp; Time</Label>
                  <input type="datetime-local" className={inputCls} value={form.alertAt} onChange={e => set({ alertAt: e.target.value })} />
                  <Hint>When was the alert received?</Hint>
                </Field>

                <Field>
                  <Label required>Mode of Alert</Label>
                  <select className={selectCls} value={form.alertMode} onChange={e => set({ alertMode: e.target.value })}>
                    {ALERT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </Field>

                <Field>
                  <Label>Origin of Alert</Label>
                  <select className={selectCls} value={form.originOfAlert} onChange={e => set({ originOfAlert: e.target.value })}>
                    <option value="">Select origin...</option>
                    {ORIGIN_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <Label>Notifier Name</Label>
                    <input type="text" placeholder="Full name" className={inputCls} value={form.notifierName} onChange={e => set({ notifierName: e.target.value })} />
                  </Field>
                  <Field>
                    <Label>Notifier Phone</Label>
                    <input type="tel" placeholder="07XXXXXXXX" className={inputCls} value={form.notifierPhone} onChange={e => set({ notifierPhone: e.target.value })} />
                  </Field>
                </div>
              </>
            )}

            {/* ── Step 2: Location ─────────────────────────────────────────────── */}
            {step === 2 && (
              <>
                <Field>
                  <Label required>Location of Incident</Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Kenyatta Avenue, CBD Nairobi"
                      className={inputCls}
                      value={form.locationName}
                      onChange={e => set({ locationName: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowMap(v => !v)}
                      className={`shrink-0 h-11 px-4 border-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all ${
                        showMap
                          ? 'bg-brand-teal text-white border-brand-teal'
                          : 'border-slate-200 text-brand-teal hover:border-brand-teal'
                      }`}
                    >
                      <MapPin size={15} weight="fill" />
                      Map
                    </button>
                  </div>
                </Field>

                {showMap && (
                  <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex gap-2 p-3 border-b border-slate-100 bg-slate-50">
                      <input
                        type="text"
                        placeholder="Search location..."
                        className="flex-1 h-10 px-4 border-2 border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchLocation())}
                      />
                      <button
                        type="button"
                        onClick={searchLocation}
                        disabled={isSearching}
                        className="h-10 px-4 bg-brand-teal text-white rounded-xl text-xs font-bold disabled:opacity-50"
                      >
                        {isSearching ? '...' : <MagnifyingGlass size={15} />}
                      </button>
                    </div>
                    <Map
                      center={[form.lat, form.lng]}
                      zoom={14}
                      markers={[{ id: 'scene', lat: form.lat, lng: form.lng, title: form.locationName || 'Scene', type: 'incident' }]}
                      onLocationSelect={handleMapClick}
                      layerType="street"
                      className="h-56 w-full"
                    />
                    {form.locationName && (
                      <div className="px-4 py-2.5 bg-brand-green/5 border-t border-brand-green/20 text-xs text-brand-green font-bold flex items-center gap-1.5">
                        <MapPin size={12} weight="fill" /> {form.locationName} · {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
                      </div>
                    )}
                  </div>
                )}

                <Field>
                  <Label required>Sub-County</Label>
                  <select className={selectCls} value={form.subCounty} onChange={e => set({ subCounty: e.target.value })}>
                    <option value="">Select sub-county...</option>
                    {SUB_COUNTIES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </>
            )}

            {/* ── Step 3: Patient ──────────────────────────────────────────────── */}
            {step === 3 && (
              <>
                <Field>
                  <Label>Patient Name</Label>
                  <input type="text" placeholder="Full name" className={inputCls} value={form.patientName} onChange={e => set({ patientName: e.target.value })} />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <Label>Age</Label>
                    <input type="text" placeholder="e.g. 34" className={inputCls} value={form.patientAge} onChange={e => set({ patientAge: e.target.value })} />
                  </Field>
                  <Field>
                    <Label>Sex</Label>
                    <select className={selectCls} value={form.patientGender} onChange={e => set({ patientGender: e.target.value })}>
                      <option value="">Select...</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <Label>Next of Kin</Label>
                    <input type="text" placeholder="Full name" className={inputCls} value={form.nextOfKin} onChange={e => set({ nextOfKin: e.target.value })} />
                  </Field>
                  <Field>
                    <Label>Next of Kin Phone</Label>
                    <input type="tel" placeholder="07XXXXXXXX" className={inputCls} value={form.nextOfKinPhone} onChange={e => set({ nextOfKinPhone: e.target.value })} />
                  </Field>
                </div>

                <label className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  form.massCasualty ? 'border-status-danger bg-status-danger/5' : 'border-slate-200 hover:border-status-danger/50'
                }`}>
                  <input type="checkbox" className="w-5 h-5 mt-0.5 accent-red-500 shrink-0" checked={form.massCasualty} onChange={e => set({ massCasualty: e.target.checked })} />
                  <div>
                    <p className="font-bold text-status-danger text-sm flex items-center gap-1.5">
                      <WarningCircle size={16} weight="fill" /> Declare Mass Casualty Incident (MCI)
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Multiple victims requiring heavy response.</p>
                  </div>
                </label>

                {form.massCasualty && (
                  <Field>
                    <Label>Approximate Number of Casualties</Label>
                    <input type="number" min="2" placeholder="e.g. 5" className={inputCls} value={form.massCasualtyCount} onChange={e => set({ massCasualtyCount: e.target.value })} />
                  </Field>
                )}
              </>
            )}

            {/* ── Step 4: Incident Details ─────────────────────────────────────── */}
            {step === 4 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <Label>Nature of Alert</Label>
                    <select className={selectCls} value={form.alertNature} onChange={e => set({ alertNature: e.target.value, alertNatureDetail: '' })}>
                      <option value="">Select...</option>
                      {NATURE_OPTIONS.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </Field>
                  <Field>
                    <Label>Specify Nature</Label>
                    <select className={selectCls} value={form.alertNatureDetail} onChange={e => set({ alertNatureDetail: e.target.value })} disabled={!form.alertNature}>
                      <option value="">Select...</option>
                      {(NATURE_DETAIL[form.alertNature] ?? []).map(d => <option key={d}>{d}</option>)}
                    </select>
                  </Field>
                </div>

                <Field>
                  <Label required>Chief Complaint</Label>
                  <textarea rows={3} placeholder="Describe the primary complaint / reason for call..." className={textareaCls} value={form.chiefComplaint} onChange={e => set({ chiefComplaint: e.target.value })} required />
                  <Hint>Be as specific as possible — this is what dispatchers see first.</Hint>
                </Field>

                <Field>
                  <Label>Caller / Watcher Notes</Label>
                  <textarea rows={3} placeholder="Any additional observations from the caller..." className={textareaCls} value={form.watcherComments} onChange={e => set({ watcherComments: e.target.value })} />
                </Field>

                <Field>
                  <Label>Pre-Hospital Management Given</Label>
                  <textarea rows={3} placeholder="e.g. Tourniquet applied, IV access obtained..." className={textareaCls} value={form.preHospitalManagement} onChange={e => set({ preHospitalManagement: e.target.value })} />
                </Field>

                <Field>
                  <Label>Place of Referral</Label>
                  <input type="text" placeholder="e.g. Kenyatta National Hospital" className={inputCls} value={form.placeOfReferral} onChange={e => set({ placeOfReferral: e.target.value })} />
                </Field>
              </>
            )}

            {/* ── Step 5: Review ──────────────────────────────────────────────── */}
            {step === 5 && (
              <>
                <p className="text-sm text-slate-500">Review all details before submitting. Click any completed step above to go back and edit.</p>

                {[
                  { heading: 'Alert Details', rows: [
                    { label: 'Alert Time',   value: form.alertAt },
                    { label: 'Mode',         value: form.alertMode },
                    { label: 'Origin',       value: form.originOfAlert },
                    { label: 'Notifier',     value: form.notifierName ? `${form.notifierName} · ${form.notifierPhone}` : undefined },
                  ]},
                  { heading: 'Location', rows: [
                    { label: 'Location',     value: form.locationName },
                    { label: 'Sub-County',   value: form.subCounty },
                    { label: 'Coordinates',  value: form.lat ? `${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : undefined },
                  ]},
                  { heading: 'Patient', rows: [
                    { label: 'Name',         value: form.patientName },
                    { label: 'Age / Sex',    value: [form.patientAge, form.patientGender].filter(Boolean).join(' · ') || undefined },
                    { label: 'Next of Kin',  value: form.nextOfKin ? `${form.nextOfKin} · ${form.nextOfKinPhone}` : undefined },
                    { label: 'MCI',          value: form.massCasualty ? `Yes (${form.massCasualtyCount || '?'} casualties)` : undefined },
                  ]},
                  { heading: 'Incident', rows: [
                    { label: 'Nature',       value: [form.alertNature, form.alertNatureDetail].filter(Boolean).join(' → ') || undefined },
                    { label: 'Complaint',    value: form.chiefComplaint },
                    { label: 'Pre-hospital', value: form.preHospitalManagement },
                    { label: 'Referral',     value: form.placeOfReferral },
                  ]},
                ].map(section => (
                  <div key={section.heading} className="border-2 border-slate-100 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
                      <p className="text-xs font-black text-brand-teal uppercase tracking-widest">{section.heading}</p>
                    </div>
                    <div className="px-4 py-1">
                      {section.rows.map(row => row.value ? <ReviewRow key={row.label} label={row.label} value={row.value} /> : null)}
                    </div>
                  </div>
                ))}

                {mutation.isError && (
                  <div className="bg-status-danger/10 border border-status-danger/30 text-status-danger px-4 py-3 rounded-xl text-sm font-semibold">
                    Submission failed — check your connection and try again.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation footer */}
      <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between sticky bottom-0 gap-4">
        <button
          type="button"
          onClick={() => step === 1 ? navigate(-1) : setStep(s => s - 1)}
          className="flex items-center gap-2 px-5 py-2.5 border-2 border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-all"
        >
          <CaretLeft size={16} weight="bold" />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        <div className="flex items-center gap-1">
          {STEPS.map(s => (
            <div key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${step === s.id ? 'w-6 bg-brand-teal' : step > s.id ? 'w-3 bg-brand-green' : 'w-3 bg-slate-200'}`} />
          ))}
        </div>

        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext[step]}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-teal text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <CaretRight size={16} weight="bold" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.chiefComplaint || !form.locationName || !form.subCounty}
            className="flex items-center gap-2 px-8 py-2.5 bg-brand-green text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all shadow-md disabled:opacity-50"
          >
            <ClipboardText size={18} weight="bold" />
            {mutation.isPending ? 'Submitting...' : 'Submit Alert'}
          </button>
        )}
      </div>
    </div>
  );
}
