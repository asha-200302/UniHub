
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, Award, BarChart3, BookOpen, ChevronRight, FlaskConical,
  Globe2, GraduationCap, Hand, Mail, Menu, RotateCcw, Search, Users, X,
  ExternalLink, UserRound, Building2, Landmark, Briefcase, Scale, Leaf,
  ChevronDown, Upload, FileText, GitBranch,
  Database, LibraryBig, LineChart, PieChart as PieIcon
} from 'lucide-react';
import { ModuleErrorBoundary } from '../../core/resilience/ModuleErrorBoundary';
import './styles.css';

type Profile = {
  id: string; name: string; type: 'Faculty'|'Researcher'|'Fellow'; designation: string;
  school: string; primary_category: string; categories?: string[]; clusters?: string[];
  qualifications?: string; email?: string; profile_url?: string; image_url?: string;
  areas_of_expertise?: string; bio?: string; research_quest?: string; publications?: string;
  projects?: string; achievements?: string; additional_info?: string; social_links?: Record<string,string>;
  has_international_exp?: boolean; international_evidence?: string; intl_track_category?: 'phd'|'postdoc'|'fellowship'|'visiting'|null;
  publications_list?: Publication[]; projects_list?: Project[]; qual_level?: string;
  designation_group?: string; category?: string;
};
type Project = {
  title: string; pi?: string; agency?: string; funding_agency?: string; status?: string;
  grant_amount?: string|number; description?: string; full_text?: string; category?: string;
  faculty_id?: string; faculty_name?: string; school?: string;
};
type Publication = {
  title: string; full_text?: string; year?: number|string; category?: string;
  faculty_id?: string; faculty_name?: string; school?: string;
};
type SubmittedPublication = Publication & {
  id: string; author: string; school: string; category: string; journal: string; link: string;
};
type SubmittedProject = Project & {
  id: string; pi: string; school: string; category: string; year: number; github_url: string;
};
type ProjectRow = Project & {
  id?: string; faculty_id?: string; faculty_name: string; school: string;
  category: string; year?: number|string; github_url?: string;
};
type PublicationRow = Publication & {
  id?: string; faculty_id?: string; faculty_name: string; school: string;
  category: string; journal?: string; link?: string;
};
type UploadKind = 'paper'|'project';
type SubmissionStore = { papers: SubmittedPublication[]; projects: SubmittedProject[] };
type View = 'directory'|'projects'|'publications'|'international'|'profile';
type ChartConfig = { type: string; data: any; options?: any };

const SUBMISSION_STORAGE_KEY = 'unihub_submissions_v1';
function loadSubmissions(): SubmissionStore {
  try {
    const value = JSON.parse(localStorage.getItem(SUBMISSION_STORAGE_KEY) || '{}');
    return {
      papers: Array.isArray(value.papers) ? value.papers : [],
      projects: Array.isArray(value.projects) ? value.projects : []
    };
  } catch {
    return {papers:[],projects:[]};
  }
}
function persistSubmissions(value: SubmissionStore) {
  try { localStorage.setItem(SUBMISSION_STORAGE_KEY, JSON.stringify(value)); } catch {}
}

const SCHOOLS = [
  'School of Arts, Humanities and Social Sciences','School of Engineering','School of Management Sciences',
  'School of Law, Governance and Public Policy','School of Biosciences','School of Mathematics and Natural Sciences'
];
const CATEGORIES = ['Law','Public Health','Sustainability','Science Tech','Humanities','IKS','Management'];
const CLUSTERS = ['Engineering & Science Tech','Management & Humanities','Health & Life Sciences','Law','IKS','Sustainability'];
const PUB_CATEGORIES = ['General Research','Law','Public Health','Sustainability','Science Tech','Humanities','IKS','Management'];
const DOMAIN_COLORS: Record<string,string> = {
  'Science Tech':'#0284c7','Public Health':'#059669','Humanities':'#7c3aed','Sustainability':'#10b981',
  'Management':'#b8860b','IKS':'#d97706','Law':'#dc2626','General Research':'#64748b'
};
const TRACK_LABELS: Record<string,string> = {
  phd:'Foreign PhD / Degrees', postdoc:'Overseas Postdoc / Research',
  fellowship:'Global Fellowships', visiting:'Visiting Appointments'
};
const REGION_REGEX: Record<string,RegExp> = {
  USA:/usa|united states|america|california|boston|new york|georgia|arizona|oregon|mit|stanford|harvard|princeton|purdue|rutgers/i,
  UK:/uk|united kingdom|britain|england|london|oxford|cambridge|edinburgh|manchester/i,
  Europe:/france|germany|switzerland|inria|cern|max planck|erasmus|humboldt|paris|nice|eth/i,
  Asia:/japan|singapore|china|nanyang|nus|tokyo|kyoto|tsinghua/i,
  'Australia & Oceania':/australia|sydney|melbourne|anu/i,
  'Canada & Americas':/canada|toronto|mcgill|waterloo|brazil|mexico/i
};
const navItems: {key:Exclude<View,'profile'>; label:string; icon:React.ReactNode}[] = [
  {key:'directory',label:'Faculty Directory',icon:<Users size={14}/>},
  {key:'projects',label:'Research Projects',icon:<FlaskConical size={14}/>},
  {key:'publications',label:'Publications & Papers',icon:<BookOpen size={14}/>},
  {key:'international',label:'International Collaborations',icon:<Globe2 size={14}/>}
];

const stripSchool = (school='') => school.replace(/^School of\s+/i,'');
const normalize = (s='') => s.toLowerCase().replace(/\s+/g,' ').trim();
const formatAmount = (v: unknown) => v === undefined || v === null || v === '' ? 'Not specified' : typeof v === 'number' ? `₹${v.toLocaleString('en-IN')}` : String(v);
const fallbackImage = 'https://chanakyauniversity.edu.in/wp-content/uploads/2026/02/default-img.jpg';

function getProfileCombinedClusters(p: Profile): string[] {
  const source = [...(p.clusters || []), ...(p.categories || []), p.primary_category || ''];
  const out: string[] = [];
  const add = (v:string) => { if (v && !out.includes(v)) out.push(v); };
  source.forEach(v => {
    const x = v.toLowerCase();
    if (x.includes('engineering') || x.includes('science tech') || x.includes('science & technology')) add('Engineering & Science Tech');
    if (x === 'management' || x === 'humanities') add('Management & Humanities');
    if (x === 'law' || x.includes('law & governance')) add('Law');
    if (x === 'iks' || x.includes('indian knowledge')) add('IKS');
    if (x === 'sustainability') add('Sustainability');
    if (['health','public health','health & life sciences','biosciences','bioscience','bio science'].some(k => x.includes(k))) add('Health & Life Sciences');
  });
  if (p.school === 'School of Biosciences') add('Health & Life Sciences');
  if (p.school === 'School of Engineering') add('Engineering & Science Tech');
  return out;
}
function categoriesFor(p: Profile) {
  return Array.from(new Set([...(p.categories || []), p.primary_category || p.category || ''].filter(Boolean)));
}
function regionMatch(p: Profile, region: string) {
  if (region === 'ALL') return true;
  const text = [p.international_evidence,p.qualifications,p.bio].filter(Boolean).join(' ');
  return REGION_REGEX[region]?.test(text) ?? false;
}
function disciplineMatch(p: Profile, discipline: string) {
  if (discipline === 'ALL') return true;
  const text = [...categoriesFor(p), ...(p.clusters || []), p.school].join(' ').toLowerCase();
  const rules: Record<string,RegExp> = {
    'Science Tech':/science|engineering|technology|mathematics|data/i,
    'Law & Governance':/law|governance|public policy/i,
    'Management Sciences':/management/i,
    'Humanities & Social Sciences':/humanities|social sciences|arts/i,
    'Public Health & Biosciences':/health|bioscience|biology/i,
    'Sustainability & Environment':/sustainability|environment/i,
    'Indian Knowledge Systems':/iks|indian knowledge/i
  };
  return rules[discipline]?.test(text) ?? false;
}

async function ensureChartJs(): Promise<any> {
  const w = window as any;
  if (w.Chart) return w.Chart;
  await new Promise<void>((resolve,reject) => {
    const existing = document.querySelector('script[data-unihub-chartjs]') as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load',()=>resolve(),{once:true}); existing.addEventListener('error',()=>reject(),{once:true}); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js';
    script.async = true; script.dataset.unihubChartjs = 'true';
    script.onload = () => resolve(); script.onerror = () => reject();
    document.head.appendChild(script);
  });
  return w.Chart;
}

const ChartPanel: React.FC<{
  title:string; icon?:React.ReactNode; config:ChartConfig|null; onClick?: (event:any, chart:any)=>void; hint?:React.ReactNode;
}> = ({title,icon,config,onClick,hint}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let chart:any;
    let alive = true;
    (async()=>{
      if (!config || !ref.current) return;
      try {
        const Chart = await ensureChartJs();
        if (!alive || !ref.current) return;
        chart = new Chart(ref.current, {
          ...config,
          options: {
            responsive:true, maintainAspectRatio:false,
            ...config.options,
            plugins:{
              legend:{position:window.innerWidth < 768 ? 'bottom' : 'right',labels:{font:{size:10},boxWidth:10},...(config.options?.plugins?.legend||{})},
              tooltip:{
                bodyFont:{size:10},
                ...(config.options?.plugins?.tooltip||{}),
                callbacks:{
                  footer:()=> '👉 Click the chart to filter the list below',
                  ...(config.options?.plugins?.tooltip?.callbacks||{})
                }
              }
            },
            onClick:(e:any,elements:any)=>onClick?.(e,{chart,elements}),
          }
        });
      } catch { /* chart CDN unavailable; the surrounding dashboard remains usable */ }
    })();
    return()=>{alive=false; if(chart) chart.destroy();};
  },[config,onClick]);
  return <section className="unihub-chart-card">
    <h3>{icon}{title}</h3>
    {hint}
    <div className="unihub-chart-container"><canvas ref={ref}/></div>
  </section>;
};

function Kpi({label,value,icon,variant=''}:{label:string;value:number|string;icon:React.ReactNode;variant?:string}) {
  return <div className={`unihub-kpi ${variant}`}><div className="unihub-kpi-icon">{icon}</div><div><h4>{label}</h4><div className="num">{value}</div></div></div>;
}
function FacultyCard({p,onOpen,intl=false}:{p:Profile;onOpen:(id:string)=>void;intl?:boolean}) {
  const cats=categoriesFor(p).slice(0,4);
  const snippet=p.bio||p.areas_of_expertise||p.qualifications||'Chanakya University Academic Profile';
  return <article className="unihub-faculty-card" onClick={()=>onOpen(p.id)}>
    {intl && <span className="unihub-intl-badge">Global Track</span>}
    <div className="unihub-card-head">
      <img className="unihub-avatar" src={p.image_url||fallbackImage} onError={e=>{(e.currentTarget as HTMLImageElement).src=fallbackImage}} alt={p.name}/>
      <div><h3>{p.name}</h3><div className="unihub-designation">{p.designation}</div></div>
    </div>
    <div className="unihub-card-body">
      <span className="unihub-school">{stripSchool(p.school)}</span>
      <div className="unihub-badges">{cats.map(c=><span className="unihub-badge" key={c}>{c}</span>)}</div>
      <p className="unihub-bio">{intl ? <><strong>Intl Highlights:</strong> {p.international_evidence}</> : snippet}</p>
    </div>
    <div className="unihub-card-foot"><span>{p.type}</span><span>View Full Profile →</span></div>
  </article>;
}

const UploadForm: React.FC<{
  kind:UploadKind; onCancel:()=>void;
  onSubmit:(record:SubmittedPublication|SubmittedProject)=>void;
}> = ({kind,onCancel,onSubmit}) => {
  const isPaper=kind==='paper';
  const [form,setForm]=useState({title:'',person:'',school:SCHOOLS[0],category:isPaper?PUB_CATEGORIES[0]:CATEGORIES[0],year:String(new Date().getFullYear()),about:'',citation:'',url:''});
  const [error,setError]=useState('');
  const update=(key:keyof typeof form,value:string)=>setForm(current=>({...current,[key]:value}));
  const submit=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!isPaper){
      try {
        const host=new URL(form.url).hostname.toLowerCase();
        if(host!=='github.com'&&host!=='www.github.com'){setError('Enter a valid github.com repository URL.');return;}
      } catch {setError('Enter a valid GitHub repository URL.');return;}
    }
    const id=`${kind}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    if(isPaper) onSubmit({id,title:form.title,author:form.person,school:form.school,category:form.category,year:Number(form.year),journal:form.citation,link:form.url,full_text:form.about});
    else onSubmit({id,title:form.title,pi:form.person,school:form.school,category:form.category,year:Number(form.year),github_url:form.url,description:form.about,status:'Submitted'});
  };

  return <div className="unihub-upload-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel()}}>
    <section className="unihub-upload-dialog" role="dialog" aria-modal="true" aria-labelledby="unihub-upload-title">
      <div className="unihub-upload-heading"><div><h2 id="unihub-upload-title">{isPaper?'Research paper / publication':'GitHub / project'}</h2><p>{isPaper?'Add publication details to the directory.':'Add a GitHub project to the repository dashboard.'}</p></div><button type="button" className="unihub-upload-close" aria-label="Close upload form" onClick={onCancel}><X size={18}/></button></div>
      <form className="unihub-upload-form" onSubmit={submit}>
        <label>{isPaper?'Paper title':'Project title'} *<input required maxLength={180} value={form.title} onChange={event=>update('title',event.target.value)}/></label>
        <label>{isPaper?'Author / faculty name':'Principal investigator'} *<input required maxLength={120} value={form.person} onChange={event=>update('person',event.target.value)}/></label>
        <div className="unihub-upload-fields"><label>School<select value={form.school} onChange={event=>update('school',event.target.value)}>{SCHOOLS.map(school=><option key={school} value={school}>{stripSchool(school)}</option>)}</select></label>
          <label>Domain<select value={form.category} onChange={event=>update('category',event.target.value)}>{(isPaper?PUB_CATEGORIES:CATEGORIES).map(category=><option key={category} value={category}>{category}</option>)}</select></label></div>
        <label>Year *<input type="number" required min="1900" max={new Date().getFullYear()+10} value={form.year} onChange={event=>update('year',event.target.value)}/></label>
        {isPaper&&<label>Journal / publisher / citation<input maxLength={240} value={form.citation} onChange={event=>update('citation',event.target.value)}/></label>}
        <label>{isPaper?'Paper link (DOI or URL) *':'GitHub link *'}<input type="url" required placeholder={isPaper?'https://doi.org/...':'https://github.com/user/repo'} value={form.url} onChange={event=>{setError('');update('url',event.target.value)}}/></label>
        <label>About *<textarea required rows={4} maxLength={2000} value={form.about} onChange={event=>update('about',event.target.value)} placeholder="Describe the research or project."/></label>
        {error&&<p className="unihub-upload-error" role="alert">{error}</p>}
        <div className="unihub-upload-actions"><button type="button" className="unihub-upload-cancel" onClick={onCancel}>Cancel</button><button type="submit" className="unihub-upload-submit">{isPaper?'Add publication':'Add project'}</button></div>
      </form>
    </section>
  </div>;
};

const DirectoryPage: React.FC<{profiles:Profile[];onOpen:(id:string)=>void}> = ({profiles,onOpen}) => {
  const [query,setQuery]=useState(''); const [type,setType]=useState('ALL'); const [school,setSchool]=useState('ALL');
  const [category,setCategory]=useState('ALL'); const [cluster,setCluster]=useState('ALL'); const [intlOnly,setIntlOnly]=useState(false);
  const [designation,setDesignation]=useState('ALL'); const [qualLevel,setQualLevel]=useState('ALL');
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    try {
      const raw=sessionStorage.getItem('cu_filter_state');
      if(raw){const s=JSON.parse(raw); setQuery(s.query||'');setType(s.type||'ALL');setSchool(s.school||'ALL');setCategory(s.category||'ALL');setCluster(s.cluster||'ALL');setIntlOnly(!!s.intlOnly);setDesignation(s.designation||'ALL');}
      const params=new URLSearchParams(location.search); if(params.get('school'))setSchool(params.get('school')!); if(params.get('category'))setCategory(params.get('category')!);
    } catch {}
    setLoaded(true);
  },[]);
  useEffect(()=>{if(!loaded)return; try{sessionStorage.setItem('cu_filter_state',JSON.stringify({query,type,school,intlOnly,category,cluster,designation}));}catch{}},[query,type,school,intlOnly,category,cluster,designation,loaded]);

  const filtered=useMemo(()=>{
    const q=query.toLowerCase().trim();
    return profiles.filter(p=>{
      const hay=[p.name,p.designation,p.school,p.qualifications,p.areas_of_expertise,p.bio,p.research_quest,p.publications,p.projects,p.achievements].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(type==='ALL'||(type==='Faculty'&&p.type==='Faculty')||(type==='Researcher'&&(p.type==='Researcher'||p.type==='Fellow')))
      &&(school==='ALL'||p.school===school)&&(category==='ALL'||categoriesFor(p).includes(category))
      &&(cluster==='ALL'||getProfileCombinedClusters(p).includes(cluster))&&(!intlOnly||!!p.has_international_exp)
      &&(designation==='ALL'||(p.designation_group||p.designation||p.type)===designation)&&(qualLevel==='ALL'||p.qual_level===qualLevel);
    });
  },[profiles,query,type,school,category,cluster,intlOnly,designation,qualLevel]);

  const clear=()=>{setQuery('');setType('ALL');setSchool('ALL');setCategory('ALL');setCluster('ALL');setIntlOnly(false);setDesignation('ALL');setQualLevel('ALL');try{sessionStorage.removeItem('cu_filter_state')}catch{}};

  const schoolCounts=SCHOOLS.map(s=>profiles.filter(p=>p.school===s).length);
  const categoryCounts=CATEGORIES.map(c=>profiles.filter(p=>categoriesFor(p).includes(c)).length);
  const clusterCounts=CLUSTERS.map(c=>profiles.filter(p=>getProfileCombinedClusters(p).includes(c)).length);
  const intlSchool=SCHOOLS.map(s=>profiles.filter(p=>p.school===s&&p.has_international_exp).length);
  const qualLevels=['Ph.D. / Doctorate',"Master's / Postgraduate",'Bachelor\'s / Professional'];
  const qualCounts=qualLevels.map(q=>profiles.filter(p=>p.qual_level===q).length);
  const pubSchool=SCHOOLS.map(s=>profiles.filter(p=>p.school===s).reduce((n,p)=>n+(p.publications_list?.length||0),0));
  const projSchool=SCHOOLS.map(s=>profiles.filter(p=>p.school===s).reduce((n,p)=>n+(p.projects_list?.length||0),0));
  const designationLabels=Array.from(new Set(profiles.map(p=>p.designation_group||p.designation||p.type)));
  const designationCounts=designationLabels.map(d=>profiles.filter(p=>(p.designation_group||p.designation||p.type)===d).length);

  const tooltip = {callbacks:{label:(ctx:any)=>`${ctx.dataset.label||'Count'}: ${ctx.raw} (${((ctx.raw/profiles.length)*100).toFixed(1)}%)`}};
  const barConfig:ChartConfig={type:'bar',data:{labels:SCHOOLS.map(stripSchool),datasets:[{label:'Profiles',data:schoolCounts,backgroundColor:'#002561',hoverBackgroundColor:'#b8860b',borderRadius:6}]},options:{plugins:{tooltip:tooltip}}};
  const catConfig:ChartConfig={type:'doughnut',data:{labels:CATEGORIES,datasets:[{data:categoryCounts,backgroundColor:['#002561','#b8860b','#10b981','#0284c7','#8b5cf6','#f59e0b','#ec4899'],borderColor:'#fff',borderWidth:2,hoverOffset:14}]},options:{plugins:{tooltip}}};
  const clusterConfig:ChartConfig={type:'polarArea',data:{labels:CLUSTERS,datasets:[{data:clusterCounts,backgroundColor:['rgba(0,37,97,.72)','rgba(16,185,129,.72)','rgba(236,72,153,.72)','rgba(184,134,11,.72)','rgba(139,92,246,.72)','rgba(14,165,233,.72)']}]},options:{plugins:{tooltip}}};
  const intlConfig:ChartConfig={type:'bar',data:{labels:SCHOOLS.map(stripSchool),datasets:[{label:'International Profiles',data:intlSchool,backgroundColor:'#10b981',hoverBackgroundColor:'#047857',borderRadius:6}]},options:{plugins:{tooltip}}};
  const qualConfig:ChartConfig={type:'pie',data:{labels:qualLevels,datasets:[{data:qualCounts,backgroundColor:['#002561','#0284c7','#b8860b'],borderWidth:2,borderColor:'#fff'}]},options:{plugins:{tooltip}}};
  const pubConfig:ChartConfig={type:'bar',data:{labels:SCHOOLS.map(stripSchool),datasets:[{label:'Publications',data:pubSchool,backgroundColor:'#8b5cf6',hoverBackgroundColor:'#6d28d9',borderRadius:5}]},options:{indexAxis:'y',plugins:{tooltip}}};
  const projConfig:ChartConfig={type:'bar',data:{labels:SCHOOLS.map(stripSchool),datasets:[{label:'Projects',data:projSchool,backgroundColor:'#10b981',hoverBackgroundColor:'#059669',borderRadius:5}]},options:{indexAxis:'y',plugins:{tooltip}}};
  const desConfig:ChartConfig={type:'pie',data:{labels:designationLabels,datasets:[{data:designationCounts,backgroundColor:['#002561','#b8860b','#10b981','#0284c7','#8b5cf6','#f59e0b','#ec4899'],borderWidth:2,borderColor:'#fff'}]},options:{plugins:{tooltip}}};

  const schoolClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setSchool(SCHOOLS[elements[0].index])},[]);
  const catClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setCategory(CATEGORIES[elements[0].index])},[]);
  const clusterClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setCluster(CLUSTERS[elements[0].index])},[]);
  const intlClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0]){setSchool(SCHOOLS[elements[0].index]);setIntlOnly(true)}},[]);
  const qualClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setQualLevel(qualLevels[elements[0].index])},[]);
  const desClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setDesignation(designationLabels[elements[0].index])},[designationLabels]);

  return <div>
    <div className="unihub-page-title"><div><h2>Faculty &amp; Researcher Directory Dashboard</h2><p>Interactive faculty profiles, research expertise, publications, projects and international experience.</p></div></div>
    <div className="unihub-kpi-grid">
      <Kpi label="Total Records" value={profiles.length} icon={<Database/>}/><Kpi label="Faculty Members" value={profiles.filter(p=>p.type==='Faculty').length} icon={<Users/>} variant="gold"/>
      <Kpi label="Researchers / Fellows" value={profiles.filter(p=>p.type==='Researcher').length} icon={<GraduationCap/>} variant="purple"/>
      <Kpi label="Intl Experience / Collab" value={profiles.filter(p=>p.has_international_exp).length} icon={<Globe2/>} variant="green"/>
    </div>
    <div className="unihub-charts">
      <ChartPanel title="Distribution by Official School" icon={<Building2 size={14}/>} config={barConfig} onClick={schoolClick}/>
      <ChartPanel title="Distribution by Domain Category" icon={<PieIcon size={14}/>} config={catConfig} onClick={catClick}/>
      <ChartPanel title="Cluster Focus Breakdown" icon={<LineChart size={14}/>} config={clusterConfig} onClick={clusterClick}/>
      <ChartPanel title="International Exposure by School" icon={<Globe2 size={14}/>} config={intlConfig} onClick={intlClick}/>
      <ChartPanel title="Academic Qualifications Breakdown" icon={<GraduationCap size={14}/>} config={qualConfig} onClick={qualClick}/>
      <ChartPanel title="Publications Volume by School" icon={<BookOpen size={14}/>} config={pubConfig} onClick={schoolClick}/>
      <ChartPanel title="Projects Volume by School" icon={<FlaskConical size={14}/>} config={projConfig} onClick={schoolClick}/>
      <ChartPanel title="Faculty by Designation" icon={<Briefcase size={14}/>} config={desConfig} onClick={desClick}/>
    </div>
    <div className="unihub-filter">
      <div className="unihub-search-row"><div className="unihub-search-wrap"><Search size={15}/><input className="unihub-search" placeholder="Search faculty, designation, school, qualifications, expertise, bio, research, publications, projects, achievements…" value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="unihub-reset" onClick={clear}><RotateCcw size={13} style={{verticalAlign:'-2px'}}/> Clear All Filters</button></div>
      <div className="unihub-filter-grid">
        <div className="unihub-filter-group"><label>Type</label><select value={type} onChange={e=>setType(e.target.value)}><option value="ALL">All</option><option value="Faculty">Faculty Only</option><option value="Researcher">Researchers Only</option></select></div>
        <div className="unihub-filter-group"><label>School</label><select value={school} onChange={e=>setSchool(e.target.value)}><option value="ALL">All Schools</option>{SCHOOLS.map(s=><option key={s} value={s}>{stripSchool(s)}</option>)}</select></div>
        <div className="unihub-filter-group"><label>Designation</label><select value={designation} onChange={e=>setDesignation(e.target.value)}><option value="ALL">All Designations</option>{designationLabels.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
        <div className="unihub-filter-group"><label>Qualification</label><select value={qualLevel} onChange={e=>setQualLevel(e.target.value)}><option value="ALL">All Qualifications</option>{qualLevels.map(q=><option key={q}>{q}</option>)}</select></div>
      </div>
      <div style={{marginTop:12}}><div className="unihub-filter-group"><label>Domain Category</label><div className="unihub-pills"><button className={`unihub-pill ${category==='ALL'?'active':''}`} onClick={()=>setCategory('ALL')}>All</button>{CATEGORIES.map(c=><button key={c} className={`unihub-pill ${category===c?'active':''}`} onClick={()=>setCategory(c)}>{c}</button>)}</div></div></div>
      <div style={{marginTop:11}}><div className="unihub-filter-group"><label>Cluster Focus</label><div className="unihub-pills"><button className={`unihub-pill ${cluster==='ALL'?'active':''}`} onClick={()=>setCluster('ALL')}>All Clusters</button>{CLUSTERS.map(c=><button key={c} className={`unihub-pill ${cluster===c?'active':''}`} onClick={()=>setCluster(c)}>{c}</button>)}</div></div></div>
      <label className="unihub-toggle" style={{marginTop:9}}><input type="checkbox" checked={intlOnly} onChange={e=>setIntlOnly(e.target.checked)}/> International Experience Only</label>
    </div>
    <div className="unihub-meta">Showing {filtered.length} of {profiles.length} profiles</div>
    {filtered.length ? <div className="unihub-cards">{filtered.map(p=><FacultyCard key={p.id} p={p} onOpen={onOpen}/>)}</div> : <div className="unihub-empty">No faculty or researchers matching your filters.</div>}
  </div>;
};

const ProjectsPage: React.FC<{profiles:Profile[];submissions:SubmittedProject[]}> = ({profiles,submissions}) => {
  const all=useMemo<ProjectRow[]>(()=>[
    ...profiles.flatMap(p=>(p.projects_list||[]).map(pj=>({...pj,faculty_id:p.id,faculty_name:p.name,school:p.school,category:pj.category||p.primary_category||'Humanities'}))),
    ...submissions.map(project=>({...project,faculty_name:project.pi}))
  ],[profiles,submissions]);
  const [q,setQ]=useState(''); const [school,setSchool]=useState('ALL'); const [cat,setCat]=useState('ALL');
  const filtered=useMemo(()=>all.filter(p=>{const hay=[p.title,p.faculty_name,p.school,p.funding_agency,p.description,p.github_url].join(' ').toLowerCase();return(!q||hay.includes(q.toLowerCase()))&&(school==='ALL'||p.school===school)&&(cat==='ALL'||p.category===cat)}),[all,q,school,cat]);
  const schoolCounts=SCHOOLS.map(s=>all.filter(p=>p.school===s).length);
  const catCounts=CATEGORIES.map(c=>all.filter(p=>p.category===c).length);
  const schoolConfig:ChartConfig={type:'bar',data:{labels:SCHOOLS.map(stripSchool),datasets:[{label:'Projects',data:schoolCounts,backgroundColor:'#002561',hoverBackgroundColor:'#b8860b',borderRadius:6}]},options:{plugins:{tooltip:{callbacks:{label:(ctx:any)=>`Projects: ${ctx.raw}`}}}}};
  const catConfig:ChartConfig={type:'doughnut',data:{labels:CATEGORIES,datasets:[{data:catCounts,backgroundColor:CATEGORIES.map(c=>DOMAIN_COLORS[c]||'#64748b'),borderColor:'#fff',borderWidth:2,hoverOffset:12}]},options:{plugins:{tooltip:{callbacks:{label:(ctx:any)=>`${ctx.label}: ${ctx.raw}`}}}}};
  const schoolClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setSchool(SCHOOLS[elements[0].index])},[]);
  const catClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setCat(CATEGORIES[elements[0].index])},[]);
  return <div>
    <div className="unihub-page-title"><div><h2>Research Projects &amp; Sponsored Grants Portal</h2><p>Sponsored research projects, principal investigators, agencies, funding and project status.</p></div></div>
    <div className="unihub-kpi-grid"><Kpi label="Total Projects & Grants" value={all.length} icon={<FlaskConical/>}/><Kpi label="Funding Agencies & Partners" value={new Set(all.map(p=>p.funding_agency||p.agency).filter(Boolean)).size} icon={<Landmark/>} variant="gold"/><Kpi label="Investigating Faculty" value={new Set(all.map(p=>p.faculty_id)).size} icon={<Users/>} variant="green"/></div>
    <div className="unihub-charts"><ChartPanel title="Projects by Official School" config={schoolConfig} onClick={schoolClick}/><ChartPanel title="Projects by Category Domain" config={catConfig} onClick={catClick}/></div>
    <div className="unihub-filter"><div className="unihub-search-row"><div className="unihub-search-wrap"><Search size={15}/><input className="unihub-search" placeholder="Search title, investigator, school, funding agency, description" value={q} onChange={e=>setQ(e.target.value)}/></div><button className="unihub-reset" onClick={()=>{setQ('');setSchool('ALL');setCat('ALL')}}><RotateCcw size={13}/> Clear All Filters</button></div><div className="unihub-filter-grid"><div className="unihub-filter-group"><label>School</label><select value={school} onChange={e=>setSchool(e.target.value)}><option value="ALL">All Schools</option>{SCHOOLS.map(s=><option key={s} value={s}>{stripSchool(s)}</option>)}</select></div><div className="unihub-filter-group"><label>Category</label><select value={cat} onChange={e=>setCat(e.target.value)}><option value="ALL">All</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div></div></div>
    <div className="unihub-meta">Showing {filtered.length} of {all.length} research projects</div>
    <div className="unihub-table-wrap"><div className="unihub-table-hint">Scroll table horizontally to view full details</div><div className="unihub-table-scroll"><table className="unihub-table"><thead><tr><th style={{width:'32%'}}>Project Title &amp; Overview</th><th style={{width:'18%'}}>Principal Investigator</th><th style={{width:'22%'}}>School &amp; Domain</th><th style={{width:'16%'}}>Granting Agency</th><th style={{width:'12%'}}>Grant &amp; Status</th></tr></thead><tbody>{filtered.map((p,i)=><tr key={p.id||`${p.faculty_id}-${i}`}><td><div className="title">{p.github_url?<a className="unihub-link" href={p.github_url} target="_blank" rel="noreferrer">{p.title}</a>:p.title}</div><div className="clamp">{p.description||p.full_text||'No project overview provided.'}</div><span className="unihub-record-year">{p.year||'Year not specified'}</span></td><td>{p.faculty_id?<a className="unihub-link" href={`?unihubProfile=${p.faculty_id}`}>{p.faculty_name}</a>:p.faculty_name||p.pi}</td><td><span className="unihub-school">{stripSchool(p.school||'')}</span><br/><span className="unihub-domain" style={{display:'inline-block',marginTop:5}}>{p.category}</span></td><td><span className="unihub-agency">{p.funding_agency||p.agency||'Not specified'}</span></td><td><span className="unihub-amount">{formatAmount(p.grant_amount)}</span><span className="unihub-status">{p.status||'Status not specified'}</span></td></tr>)}</tbody></table></div>{!filtered.length&&<div className="unihub-empty">No projects matching your search filter.</div>}</div>
  </div>;
};

const PublicationsPage: React.FC<{profiles:Profile[];submissions:SubmittedPublication[]}> = ({profiles,submissions}) => {
  const all=useMemo<PublicationRow[]>(()=>[
    ...profiles.flatMap(p=>(p.publications_list||[]).map(pb=>({...pb,faculty_id:p.id,faculty_name:p.name,school:p.school,category:pb.category||p.primary_category||'General Research'}))),
    ...submissions.map(paper=>({...paper,faculty_name:paper.author}))
  ],[profiles,submissions]);
  const [q,setQ]=useState(''); const [school,setSchool]=useState('ALL'); const [cat,setCat]=useState('ALL');
  const filtered=useMemo(()=>all.filter(p=>{const hay=[p.title,p.faculty_name,p.category,p.full_text].join(' ').toLowerCase();return(!q||hay.includes(q.toLowerCase()))&&(school==='ALL'||p.school===school)&&(cat==='ALL'||p.category===cat)}),[all,q,school,cat]);
  const schoolCounts=SCHOOLS.map(s=>all.filter(p=>p.school===s).length); const catCounts=PUB_CATEGORIES.map(c=>all.filter(p=>p.category===c).length);
  const authorCounts=Array.from(new Set(all.map(p=>p.faculty_name))).map(name=>({name,count:all.filter(p=>p.faculty_name===name).length})).sort((a,b)=>b.count-a.count).slice(0,8);
  const configs:ChartConfig[]=[
    {type:'bar',data:{labels:SCHOOLS.map(stripSchool),datasets:[{label:'Publications',data:schoolCounts,backgroundColor:'#002561',hoverBackgroundColor:'#b8860b',borderRadius:6}]},options:{plugins:{tooltip:{callbacks:{label:(ctx:any)=>`Publications: ${ctx.raw}`}}}}},
    {type:'doughnut',data:{labels:PUB_CATEGORIES,datasets:[{data:catCounts,backgroundColor:PUB_CATEGORIES.map(c=>DOMAIN_COLORS[c]||'#64748b'),borderColor:'#fff',borderWidth:2,hoverOffset:12}]},options:{plugins:{tooltip:{callbacks:{label:(ctx:any)=>`${ctx.label}: ${ctx.raw}`}}}}},
    {type:'bar',data:{labels:authorCounts.map(a=>a.name),datasets:[{label:'Publications',data:authorCounts.map(a=>a.count),backgroundColor:'#8b5cf6',hoverBackgroundColor:'#6d28d9',borderRadius:5}]},options:{indexAxis:'y',plugins:{tooltip:{callbacks:{label:(ctx:any)=>`Publications: ${ctx.raw}`}}}}}
  ];
  const schoolClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setSchool(SCHOOLS[elements[0].index])},[]);
  const catClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setCat(PUB_CATEGORIES[elements[0].index])},[]);
  const authorClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setQ(authorCounts[elements[0].index].name)},[authorCounts]);
  return <div>
    <div className="unihub-page-title"><div><h2>Publications &amp; Scholarly Papers Portal</h2><p>Scholarly publications, authors, domains and publication-year records.</p></div></div>
    <div className="unihub-kpi-grid"><Kpi label="Total Publications Recorded" value={all.length} icon={<BookOpen/>}/><Kpi label="Publishing Authors / Faculty" value={new Set(all.map(p=>p.faculty_id)).size} icon={<Users/>} variant="gold"/><Kpi label="International Exposure Pubs" value={all.filter(p=>profiles.find(f=>f.id===p.faculty_id)?.has_international_exp).length} icon={<Globe2/>} variant="green"/></div>
    <div className="unihub-charts"><ChartPanel title="Publications Volume by School" config={configs[0]} onClick={schoolClick}/><ChartPanel title="Publications by Domain Category" config={configs[1]} onClick={catClick}/><ChartPanel title="Top Publishing Faculty Authors" config={configs[2]} onClick={authorClick}/></div>
    <div className="unihub-filter"><div className="unihub-search-row"><div className="unihub-search-wrap"><Search size={15}/><input className="unihub-search" placeholder="Search title, author, keywords" value={q} onChange={e=>setQ(e.target.value)}/></div><button className="unihub-reset" onClick={()=>{setQ('');setSchool('ALL');setCat('ALL')}}><RotateCcw size={13}/> Clear All Filters</button></div><div className="unihub-filter-grid"><div className="unihub-filter-group"><label>School</label><select value={school} onChange={e=>setSchool(e.target.value)}><option value="ALL">All Schools</option>{SCHOOLS.map(s=><option key={s} value={s}>{stripSchool(s)}</option>)}</select></div><div className="unihub-filter-group"><label>Category</label><select value={cat} onChange={e=>setCat(e.target.value)}><option value="ALL">All</option>{PUB_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div></div></div>
    <div className="unihub-meta">Showing {filtered.length} publications</div>
    <div className="unihub-table-wrap"><div className="unihub-table-hint">Scroll table horizontally to view full details</div><div className="unihub-table-scroll"><table className="unihub-table"><thead><tr><th style={{width:'38%'}}>Publication Title &amp; Citation</th><th style={{width:'20%'}}>Author / Faculty Name</th><th style={{width:'20%'}}>School</th><th style={{width:'15%'}}>Domain Category</th><th style={{width:'7%'}}>Year</th></tr></thead><tbody>{filtered.map((p,i)=><tr key={p.id||`${p.faculty_id}-${i}`}><td><div className="title">{p.link?<a className="unihub-link" href={p.link} target="_blank" rel="noreferrer">{p.title}</a>:p.title}</div>{p.journal&&<div className="clamp">{p.journal}</div>}{p.full_text&&normalize(p.full_text)!==normalize(p.title)&&<div className="clamp">{p.full_text}</div>}</td><td>{p.faculty_id?<a className="unihub-link" href={`?unihubProfile=${p.faculty_id}`}>{p.faculty_name}</a>:p.faculty_name}</td><td>{stripSchool(p.school)}</td><td><span className="unihub-domain" style={{background:`${DOMAIN_COLORS[p.category]||'#64748b'}18`,color:DOMAIN_COLORS[p.category]||'#64748b'}}>{p.category}</span></td><td>{p.year||'—'}</td></tr>)}</tbody></table></div></div>
  </div>;
};

const InternationalPage: React.FC<{profiles:Profile[];onOpen:(id:string)=>void}> = ({profiles,onOpen}) => {
  const intl=useMemo(()=>profiles.filter(p=>p.has_international_exp),[profiles]);
  const [school,setSchool]=useState('ALL'); const [track,setTrack]=useState('ALL'); const [discipline,setDiscipline]=useState('ALL'); const [region,setRegion]=useState('ALL'); const [q,setQ]=useState('');
  const filtered=useMemo(()=>intl.filter(p=>{const hay=[p.name,p.designation,p.school,p.qualifications,p.international_evidence,p.bio].join(' ').toLowerCase();return(!q||hay.includes(q.toLowerCase()))&&(school==='ALL'||p.school===school)&&(track==='ALL'||p.intl_track_category===track)&&disciplineMatch(p,discipline)&&regionMatch(p,region)}),[intl,q,school,track,discipline,region]);
  const schoolCounts=SCHOOLS.map(s=>intl.filter(p=>p.school===s).length);
  const trackKeys=['phd','postdoc','fellowship','visiting']; const trackCounts=trackKeys.map(k=>intl.filter(p=>p.intl_track_category===k).length);
  const schoolConfig:ChartConfig={type:'bar',data:{labels:SCHOOLS.map(stripSchool),datasets:[{label:'International Profiles',data:schoolCounts,backgroundColor:'#10b981',hoverBackgroundColor:'#047857',borderRadius:6}]},options:{plugins:{tooltip:{callbacks:{label:(ctx:any)=>`International Profiles: ${ctx.raw}`}}}}};
  const trackConfig:ChartConfig={type:'doughnut',data:{labels:trackKeys.map(k=>TRACK_LABELS[k]),datasets:[{data:trackCounts,backgroundColor:['#002561','#0284c7','#b8860b','#10b981'],borderColor:'#fff',borderWidth:2,hoverOffset:14}]},options:{plugins:{tooltip:{callbacks:{label:(ctx:any)=>`${ctx.label}: ${ctx.raw}`}}}}};
  const schoolClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setSchool(SCHOOLS[elements[0].index])},[]);
  const trackClick=useCallback((_e:any,{elements}:any)=>{if(elements?.[0])setTrack(trackKeys[elements[0].index])},[]);
  const disciplineOptions=['Science Tech','Law & Governance','Management Sciences','Humanities & Social Sciences','Public Health & Biosciences','Sustainability & Environment','Indian Knowledge Systems'];
  return <div>
    <div className="unihub-page-title"><div><h2>Global Engagement &amp; International Track Portal</h2><p>International credentials, visiting appointments, fellowships and global research exposure.</p></div></div>
    <div className="unihub-kpi-grid"><Kpi label="Faculty with Intl Exposure" value={intl.length} icon={<Globe2/>} variant="green"/><Kpi label="Global Fellowships / Postdocs" value={intl.filter(p=>p.intl_track_category==='postdoc'||p.intl_track_category==='fellowship').length} icon={<Award/>} variant="gold"/></div>
    <div className="unihub-charts"><ChartPanel title="International Exposure by School" config={schoolConfig} onClick={schoolClick}/><ChartPanel title="International Track Credentials Breakdown" config={trackConfig} onClick={trackClick} hint={<div className="unihub-credential-header"><select value={track} onChange={e=>setTrack(e.target.value)}><option value="ALL">All Credential Tracks…</option>{trackKeys.map(k=><option key={k} value={k}>{TRACK_LABELS[k]}</option>)}</select><span style={{fontSize:10,color:'#64748b'}}><Hand size={12} style={{verticalAlign:'-2px'}}/> Click any chart slice or select from dropdown to filter faculty cards</span></div>}/></div>
    <div className="unihub-filter"><div className="unihub-search-row"><div className="unihub-search-wrap"><Search size={15}/><input className="unihub-search" placeholder="Search name, designation, school, qualifications, international evidence, bio" value={q} onChange={e=>setQ(e.target.value)}/></div><button className="unihub-reset" onClick={()=>{setQ('');setSchool('ALL');setTrack('ALL');setDiscipline('ALL');setRegion('ALL')}}><RotateCcw size={13}/> Clear All Filters</button></div><div className="unihub-filter-grid"><div className="unihub-filter-group"><label>Official School</label><select value={school} onChange={e=>setSchool(e.target.value)}><option value="ALL">All Schools</option>{SCHOOLS.map(s=><option key={s} value={s}>{stripSchool(s)}</option>)}</select></div><div className="unihub-filter-group"><label>Credential Type Track</label><select value={track} onChange={e=>setTrack(e.target.value)}><option value="ALL">All Credential Tracks…</option>{trackKeys.map(k=><option key={k} value={k}>{TRACK_LABELS[k]}</option>)}</select></div><div className="unihub-filter-group"><label>Discipline Domain</label><select value={discipline} onChange={e=>setDiscipline(e.target.value)}><option value="ALL">All Disciplines</option>{disciplineOptions.map(d=><option key={d}>{d}</option>)}</select></div><div className="unihub-filter-group"><label>Global Region/Country</label><select value={region} onChange={e=>setRegion(e.target.value)}><option value="ALL">All Regions</option>{Object.keys(REGION_REGEX).map(r=><option key={r}>{r}</option>)}</select></div></div><div className="unihub-region-hint">Region filtering uses international_evidence + qualifications + bio text, including the country/institution patterns specified for USA, UK, Europe, Asia, Australia &amp; Oceania, and Canada &amp; Americas.</div></div>
    <div className="unihub-meta">Showing {filtered.length} international profiles</div>
    {filtered.length?<div className="unihub-cards">{filtered.map(p=><FacultyCard key={p.id} p={p} onOpen={onOpen} intl/>)}</div>:<div className="unihub-empty">No international profiles matching your filters.</div>}
  </div>;
};

const ProfilePage: React.FC<{profile:Profile;profiles:Profile[];onBack:()=>void;onOpen:(id:string)=>void}> = ({profile,profiles,onBack,onOpen}) => {
  const [tab,setTab]=useState('qualifications');
  const similar=useMemo(()=>{const same=profiles.filter(p=>p.id!==profile.id&&p.school===profile.school);return [...same,...profiles.filter(p=>p.id!==profile.id&&p.school!==profile.school)].slice(0,6)},[profiles,profile]);
  const formatBullets=(text='')=>text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const pub=profile.publications_list||[]; const proj=profile.projects_list||[];
  return <div>
    <button className="unihub-profile-back" onClick={onBack}><ArrowLeft size={14} style={{verticalAlign:'-2px'}}/> Back to Faculty Directory</button>
    <div className="unihub-profile-hero"><img className="unihub-avatar" src={profile.image_url||fallbackImage} onError={e=>{(e.currentTarget as HTMLImageElement).src=fallbackImage}} alt={profile.name}/><div><h2>{profile.name}</h2><p>{profile.designation}</p><p><span className="unihub-school">{stripSchool(profile.school)}</span></p><p><Mail size={12} style={{verticalAlign:'-2px'}}/> {profile.email||'Email not listed'}</p></div><div className="unihub-profile-actions">{profile.profile_url&&<a href={profile.profile_url} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Official University Profile Page</a>}</div></div>
    <div className="unihub-tabs">{[['qualifications','Qualifications & Expertise'],['publications',`Publications (${pub.length})`],['projects',`Projects & Grants (${proj.length})`],['achievements','Achievements'],['international','International Experience']].map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}</div>
    <div className="unihub-profile-panel">
      {tab==='qualifications'&&<div className="unihub-profile-grid"><div><h3><GraduationCap size={16} style={{verticalAlign:'-3px'}}/> Qualifications</h3><p>{profile.qualifications||'Qualifications not listed.'}</p></div><div><h3>Areas of Specialization</h3><p>{profile.areas_of_expertise||'Areas of expertise not listed.'}</p></div><div><h3>Research Question / Focus</h3><p>{profile.research_quest||'No research question listed.'}</p></div><div><h3>Category &amp; Cluster</h3><div className="unihub-badges">{categoriesFor(profile).map(c=><span className="unihub-badge" key={c}>{c}</span>)}{getProfileCombinedClusters(profile).map(c=><span className="unihub-badge" key={c}>{c}</span>)}</div></div></div>}
      {tab==='publications'&&(pub.length?<div>{pub.map((x,i)=><div className="unihub-project-item" key={i}><h4>{x.title}</h4><p><strong>Year:</strong> {x.year||'—'} · <strong>Category:</strong> {x.category||profile.primary_category||'General Research'}</p>{x.full_text&&normalize(x.full_text)!==normalize(x.title)&&!normalize(x.full_text).startsWith(normalize(x.title).slice(0,25))&&<p>{x.full_text}</p>}</div>)}</div>:<div className="unihub-empty">No publications recorded for this profile.</div>)}
      {tab==='projects'&&(proj.length?<div>{proj.map((x,i)=><div className="unihub-project-item" key={i}><h4>{x.title}</h4><p><strong>PI:</strong> {x.pi||profile.name} · <strong>Agency:</strong> {x.funding_agency||x.agency||'Not specified'}</p><p><strong>Grant:</strong> {formatAmount(x.grant_amount)} · <strong>Status:</strong> {x.status||'Not specified'}</p><p>{x.description||x.full_text||'No project description provided.'}</p></div>)}</div>:<div className="unihub-empty">No projects or grants recorded for this profile.</div>)}
      {tab==='achievements'&&(formatBullets(profile.achievements).length?<ul className="unihub-bullets">{formatBullets(profile.achievements).map((x,i)=><li key={i}>{x}</li>)}</ul>:<div className="unihub-empty">No achievements recorded for this profile.</div>)}
      {tab==='international'&&<div><h3>International Experience</h3><p>{profile.international_evidence||'No explicit international credentials listed.'}</p>{profile.has_international_exp&&<div className="unihub-badges"><span className="unihub-badge">International Experience</span>{profile.intl_track_category&&<span className="unihub-badge">{TRACK_LABELS[profile.intl_track_category]}</span>}</div>}</div>}
    </div>
    <div className="unihub-similar"><h3 style={{color:'#002561',fontSize:15,margin:'0 0 9px'}}>Similar Faculty &amp; Researchers in {stripSchool(profile.school)}</h3><div className="unihub-cards">{similar.map(p=><div className="unihub-similar-card" key={p.id} onClick={()=>onOpen(p.id)}><img src={p.image_url||fallbackImage} onError={e=>{(e.currentTarget as HTMLImageElement).src=fallbackImage}} alt=""/><div><strong>{p.name}</strong><span>{p.designation}</span></div></div>)}</div></div>
  </div>;
};

const UniHubModuleContent: React.FC = () => {
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [loading,setLoading]=useState(true); const [failed,setFailed]=useState(false);
  const [view,setView]=useState<View>('directory'); const [profile,setProfile]=useState<Profile|null>(null); const [mobileNav,setMobileNav]=useState(false);
  const [uploadOpen,setUploadOpen]=useState(false); const [uploadMessage,setUploadMessage]=useState('');
  const [uploadKind,setUploadKind]=useState<UploadKind|null>(null);
  const [submissions,setSubmissions]=useState<SubmissionStore>(()=>loadSubmissions());

  const openProfile=useCallback((id:string)=>{
    const p=profiles.find(x=>x.id===id); if(!p)return;
    setProfile(p);setView('profile');setMobileNav(false);
    const url=new URL(window.location.href);url.searchParams.set('unihubProfile',id);window.history.pushState({},'',url);
  },[profiles]);
  const back=useCallback(()=>{setProfile(null);setView('directory');const url=new URL(window.location.href);url.searchParams.delete('unihubProfile');window.history.pushState({},'',url)},[]);
  useEffect(()=>{
    let alive=true;
    fetch(`/data.json?v=${Date.now()}`,{cache:'no-store'})
      .then(r=>{if(!r.ok)throw new Error('fetch');return r.json()}).then((d:Profile[])=>{if(!alive)return;setProfiles(d);const id=new URLSearchParams(window.location.search).get('unihubProfile');if(id){const p=d.find(x=>x.id===id);if(p){setProfile(p);setView('profile')}}setLoading(false)})
      .catch(()=>{if(alive){setFailed(true);setLoading(false)}})
    return()=>{alive=false};
  },[]);
  useEffect(()=>{const fn=()=>{const id=new URLSearchParams(window.location.search).get('unihubProfile');if(id){const p=profiles.find(x=>x.id===id);if(p){setProfile(p);setView('profile')}}else{setProfile(null);setView('directory')}};window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)},[profiles]);

  if(loading)return <div className="unihub-root"><div className="unihub-main"><div className="unihub-empty">Loading Chanakya University directory data…</div></div></div>;
  if(failed)return <div className="unihub-root"><div className="unihub-main"><div className="unihub-empty">Failed to load directory data. Please refresh.</div></div></div>;

  const subtitles:Record<Exclude<View,'profile'>,string>={directory:'Faculty & Research Directory Dashboard',projects:'Research Projects & Sponsored Grants Portal',publications:'Publications & Scholarly Papers Portal',international:'Global Engagement & International Track Portal'};
  const active=view==='profile'?'profile':view;
  const go=(v:View)=>{if(v==='profile')return;setProfile(null);setView(v);setMobileNav(false);const url=new URL(window.location.href);url.searchParams.delete('unihubProfile');window.history.replaceState({},'',url)};
  const saveUpload=(record:SubmittedPublication|SubmittedProject)=>{
    setSubmissions(current=>{
      const next='author' in record?{...current,papers:[...current.papers,record]}:{...current,projects:[...current.projects,record]};
      persistSubmissions(next);
      return next;
    });
    setUploadKind(null);
    setUploadMessage('Submission added to the UniHub dashboard.');
  };
  return <div className="unihub-root">
    <header className="unihub-header">
      <div className="unihub-header-top">
        <div className="unihub-brand">
          <div className="unihub-logo"><img src="/chanakya-logo-color.png" alt="Chanakya University"/></div>
          <div><h1>Chanakya University</h1><p>{active==='profile'?'Faculty Profile':subtitles[active]}</p></div>
        </div>
        <button className="unihub-menu" onClick={()=>setMobileNav(x=>!x)} aria-label="Toggle navigation" aria-expanded={mobileNav}>
          {mobileNav ? <X size={16}/> : <Menu size={16}/>}
        </button>
      </div>
      <nav className={`unihub-nav ${mobileNav?'mobile-active':''}`}>
      <div className="unihub-nav-container">
        {navItems.map(n=><button key={n.key} className={active===n.key?'active':''} onClick={()=>go(n.key)}>{n.icon} <span style={{marginLeft:6}}>{n.label}</span></button>)}
        {active==='profile'&&<button className="active" onClick={()=>profile&&openProfile(profile.id)}><UserRound size={14}/><span style={{marginLeft:6}}>Faculty Profile View</span></button>}
        <div className="unihub-upload">
          <button className="unihub-upload-trigger" onClick={()=>setUploadOpen(x=>!x)} aria-expanded={uploadOpen} aria-haspopup="true">
            <Upload size={14}/><span>Upload</span><ChevronDown size={12}/>
          </button>
          {uploadOpen&&<div className="unihub-upload-menu">
            <button onClick={()=>{setUploadOpen(false);setUploadKind('paper')}}><FileText size={14}/> Research Paper</button>
            <button onClick={()=>{setUploadOpen(false);setUploadKind('project')}}><GitBranch size={14}/> Repository</button>
          </div>}
        </div>
      </div>
      </nav>
    </header>
    {uploadKind&&<UploadForm kind={uploadKind} onCancel={()=>setUploadKind(null)} onSubmit={saveUpload}/>}
    {uploadMessage&&<div className="unihub-upload-status" role="status">{uploadMessage}<button onClick={()=>setUploadMessage('')} aria-label="Dismiss upload status"><X size={13}/></button></div>}
    <main className="unihub-main">{active==='directory'&&<DirectoryPage profiles={profiles} onOpen={openProfile}/>} {active==='projects'&&<ProjectsPage profiles={profiles} submissions={submissions.projects}/>} {active==='publications'&&<PublicationsPage profiles={profiles} submissions={submissions.papers}/>} {active==='international'&&<InternationalPage profiles={profiles} onOpen={openProfile}/>} {active==='profile'&&profile&&<ProfilePage profile={profile} profiles={profiles} onBack={back} onOpen={openProfile}/>}</main>
  </div>;
};

export const UniHubModule: React.FC = () => <ModuleErrorBoundary moduleId="unihub" moduleName="UniHub (Git & Research Repository)" teamName="Team 07"><UniHubModuleContent/></ModuleErrorBoundary>;
export default UniHubModule;
