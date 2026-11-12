import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, Pencil, Trash2, ExternalLink, Save, Inbox } from 'lucide-react';

const configs = {
  Students: { endpoint: '/students', title: 'Student', fields: [['name','Full name','text',true],['email','Email address','email',true],['password','Temporary password','password',true],['rollNumber','Roll number','text'],['admissionYear','Admission year','number'],['year','Current year','number'],['section','Section','text'],['phone','Phone','tel'],['address','Address','text'],['departmentId','Department','department']] },
  Staff: { endpoint: '/staff', title: 'Staff member', fields: [['name','Full name','text',true],['email','Email address','email',true],['password','Temporary password (12+ characters)','password',true],['employeeCode','Employee code','text',true],['designation','Designation','text'],['departmentId','Department','department',true],['phone','Phone','tel']] },
  Enrollments: { endpoint: '/enrollments', title: 'Enrollment', fields: [['studentId','Student profile','student',true],['subjectId','Subject','subject',true]] },
  Subjects: { endpoint: '/subjects', title: 'Subject', fields: [['name','Subject name','text',true],['code','Subject code','text',true],['credits','Credits','number'],['departmentId','Department','department',true],['staffId','Assigned staff member','staff']] },
  Departments: { endpoint: '/departments', title: 'Department', fields: [['name','Department name','text',true],['code','Department code','text',true],['description','Description','textarea']] },
  Attendance: { endpoint: '/attendance', title: 'Attendance record', fields: [['studentId','Student profile','student',true],['subjectId','Subject','subject',true],['attendanceDate','Date','date',true],['status','Status','status',true],['remarks','Remarks','text']] },
  Examinations: { endpoint: '/exams', title: 'Examination', fields: [['name','Exam name','text',true],['type','Exam type','examType',true],['subjectId','Subject','subject',true],['examDate','Exam date','date',true],['maxMarks','Maximum marks','number',true],['academicYear','Academic year','text']] },
  Marks: { endpoint: '/marks', title: 'Mark', fields: [['examId','Examination','exam',true],['studentId','Student profile','student',true],['score','Score','number',true],['remarks','Remarks','text']] },
  Assignments: { endpoint: '/assignments', title: 'Assignment', fields: [['title','Assignment title','text',true],['description','Instructions','textarea'],['subjectId','Subject','subject',true],['dueDate','Due date','datetime-local',true]] },
  Submissions: { endpoint: '/submissions', title: 'Assignment submission', fields: [['assignmentId','Assignment','assignment',true],['content','Submission text','textarea'],['fileUrl','File link','url']] },
  'My Submissions': { endpoint: '/submissions', title: 'Assignment submission', fields: [['assignmentId','Assignment','assignment',true],['content','Submission text','textarea'],['fileUrl','File link','url']] },
  'Study Materials': { endpoint: '/materials', title: 'Study material', fields: [['title','Material title','text',true],['description','Description','textarea'],['fileUrl','File URL','url',true],['subjectId','Subject','subject',true]] },
  Announcements: { endpoint: '/announcements', title: 'Announcement', fields: [['title','Title','text',true],['message','Message','textarea',true],['targetRole','Audience','audience'],['targetDepartmentId','Department (optional)','department'],['expiresAt','Expiry date','date']] }
};

const endpoints = {
  'My Attendance': '/attendance', 'My Marks': '/marks',
  'My Submissions': '/submissions/my', Reports: '/reports/dashboard'
};
const unwrap = r => r?.data?.data ?? r?.data?.user ?? r?.data ?? [];
const rowsOf = r => { const d=unwrap(r); return Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : Array.isArray(d?.records) ? d.records : Array.isArray(d?.results) ? d.results : []; };
const idOf = x => x?.id ?? x?.userId ?? x?.markId ?? '—';
const labelOf = x => x?.name ?? x?.title ?? x?.user?.name ?? x?.student?.user?.name ?? x?.subject?.name ?? x?.exam?.name ?? (typeof x?.exam === 'string' ? x.exam : null) ?? x?.assignment?.title ?? x?.code ?? `Record ${idOf(x)}`;

export default function ModulePage({ page, api, role, profile }) {
  const cfg = configs[page];
  const [rows,setRows]=useState([]), [lookups,setLookups]=useState({});
  const [form,setForm]=useState({attendanceDate:new Date().toISOString().slice(0,10),status:'PRESENT',type:'INTERNAL',targetRole:''});
  const [editing,setEditing]=useState(null), [loading,setLoading]=useState(false), [saving,setSaving]=useState(false);
  const [search,setSearch]=useState(''), [notice,setNotice]=useState(null), [error,setError]=useState('');
  const isStudent = role === 'STUDENT';
  const canCreate = !!cfg && (!isStudent || page==='My Submissions') && !(page==='Assignments' && role!=='STAFF') && !(page==='Study Materials' && role!=='STAFF') && !(page==='Attendance' && !['ADMIN','STAFF'].includes(role)) && (!['Submissions','My Submissions'].includes(page) || (page==='My Submissions' && role==='STUDENT'));
  const canEdit = ['Students','Staff','Departments','Subjects','Attendance','Examinations','Marks','Assignments','Study Materials','Announcements'].includes(page) && !isStudent;
  const canDelete = (canEdit && !(page==='Attendance' && role!=='ADMIN')) || page==='Enrollments';
  const lookupNeeds = useMemo(() => cfg?.fields.map(f=>f[2]).filter(t=>['department','student','staff','subject','exam','assignment'].includes(t)) ?? [],[page]);

  async function load() {
    setLoading(true); setError('');
    try {
      let endpoint = cfg?.endpoint || endpoints[page] || '/reports/dashboard';
      if (page==='My Attendance') endpoint=`/attendance/student/${profile?.studentProfile?.id}`;
      if (page==='My Marks') endpoint=`/marks/student/${profile?.studentProfile?.id}`;
      if (page==='My Submissions') endpoint='/submissions/my';
      if (['My Attendance','My Marks'].includes(page) && !profile?.studentProfile?.id) throw new Error('Student profile is not available for this account.');
      if (page === 'Submissions' && role !== 'STUDENT') {
        const assignments = rowsOf(await api.get('/assignments'));
        const submitted = await Promise.all(assignments.map(a => api.get(`/submissions/assignment/${a.id}`).then(r => rowsOf(r)).catch(() => [])));
        setRows(submitted.flat());
      } else {
        const response=await api.get(endpoint);
        if (page === 'Reports') {
          const report = unwrap(response);
          setRows(Object.entries(report || {}).map(([name,value])=>({id:name,name:name.replace(/([A-Z])/g,' $1'),value})));
        } else setRows(rowsOf(response));
      }
    } catch(e) { setRows([]); setError(e.response?.data?.message || e.message || `Unable to load ${page}.`); }
    finally { setLoading(false); }
  }
  async function loadLookups() {
    const map={};
    const tasks=[];
    if(lookupNeeds.includes('department')) tasks.push(api.get('/departments').then(r=>map.department=rowsOf(r)));
    if(lookupNeeds.includes('staff')) tasks.push(api.get('/staff').then(r=>map.staff=rowsOf(r).map(x=>({...x,profileId:x.staffProfile?.id,label:`${x.name} · ${x.staffProfile?.employeeCode || x.email}`}))));
    if(lookupNeeds.includes('student')) tasks.push(api.get('/students?limit=100').then(r=>map.student=rowsOf(r).map(x=>({...x,profileId:x.studentProfile?.id,label:`${x.name} · ${x.studentProfile?.rollNumber || x.email}`}))));
    if(lookupNeeds.includes('subject')) tasks.push(api.get('/subjects').then(r=>map.subject=rowsOf(r)).catch(()=>{}));
    if(lookupNeeds.includes('exam')) tasks.push(api.get('/exams').then(r=>map.exam=rowsOf(r)));
    if(lookupNeeds.includes('assignment')) tasks.push(api.get('/assignments').then(r=>map.assignment=rowsOf(r)));
    await Promise.all(tasks); setLookups(map);
  }
  useEffect(()=>{setRows([]);setForm({attendanceDate:new Date().toISOString().slice(0,10),status:'PRESENT',type:'INTERNAL',targetRole:''});setEditing(null);setNotice(null);setError('');setSearch('');load();if(canCreate)loadLookups();},[page,profile?.studentProfile?.id]);

  function edit(item) {
    const next={};
    cfg.fields.forEach(([key,,type])=>{
      let v=item[key] ?? item.studentProfile?.[key] ?? item.staffProfile?.[key] ?? '';
      if(type==='datetime-local' && v) v=new Date(v).toISOString().slice(0,16);
      if(type==='date' && v) v=String(v).slice(0,10);
      if(key==='departmentId' && !v) v=item.studentProfile?.departmentId ?? item.staffProfile?.departmentId ?? '';
      next[key]=v;
    });
    setForm(next);setEditing(idOf(item));setNotice(null);setError('');
  }
  async function save(e) {
    e.preventDefault();setSaving(true);setError('');setNotice(null);
    try {
      const body={...form};
      cfg.fields.forEach(([key,,type])=>{if(['number','department','student','staff','subject','exam','assignment'].includes(type) && body[key]!=='' && body[key]!=null) body[key]=Number(body[key]);});
      if(body.password==='' || (editing && !body.password)) delete body.password;
      if(page==='Staff' && !editing && body.password.length<12) throw new Error('Staff password must contain at least 12 characters.');
      if(page==='Students' && !editing && body.password.length<8) throw new Error('Student password must contain at least 8 characters.');
      if(['Submissions','My Submissions'].includes(page) && !body.content && !body.fileUrl) throw new Error('Add submission text or a file link.');
      
      if(page==='Assignments' && body.dueDate) body.dueDate=new Date(body.dueDate).toISOString();
      if(page==='Examinations' && body.examDate) body.examDate=new Date(body.examDate).toISOString();
      if(body.targetDepartmentId==='') body.targetDepartmentId=null;
      if(body.expiresAt==='') body.expiresAt=null;
      if(body.targetRole==='') body.targetRole=null;
      if(body.expiresAt) body.expiresAt=new Date(`${body.expiresAt}T23:59:59`).toISOString();
      if(editing) await api.put(`${cfg.endpoint}/${editing}`,body); else await api.post(cfg.endpoint,body);
      setNotice(`${cfg.title} ${editing?'updated':'created'} successfully.`);setEditing(null);setForm({});await load();
    } catch(e) {setError(e.response?.data?.message || e.message || 'Could not save this record.');}
    finally {setSaving(false);}
  }
  async function remove(item) {
    if(!window.confirm(`Delete this ${cfg.title.toLowerCase()}? This action cannot be undone.`)) return;
    try {await api.delete(`${cfg.endpoint}/${idOf(item)}`);setNotice(`${cfg.title} deleted.`);await load();}
    catch(e){setError(e.response?.data?.message || 'Unable to delete this record.');}
  }
  async function gradeSubmission(item) {
    const marks = window.prompt('Enter marks for this submission:', item.marks ?? '');
    if (marks === null) return;
    const feedback = window.prompt('Feedback (optional):', item.feedback ?? '') ?? '';
    try {
      await api.put(`/submissions/${idOf(item)}/grade`, { marks: Number(marks), feedback });
      setNotice('Submission graded successfully.'); await load();
    } catch(e) { setError(e.response?.data?.message || 'Unable to grade submission.'); }
  }
  const visible=rows.filter(x=>JSON.stringify(x).toLowerCase().includes(search.toLowerCase()));
  const optionsFor=t=>lookups[t]||[];
  const renderField=([key,label,type,required])=>{
    const common={value:form[key]??'',required:!!required && !(editing && key==='password'),onChange:e=>setForm(p=>({...p,[key]:e.target.value}))};
    if(type==='textarea') return <textarea {...common} rows="3" placeholder={`Enter ${label.toLowerCase()}`}/>;
    if(['department','student','staff','subject','exam','assignment','status','examType','audience'].includes(type)) {
      let opts=optionsFor(type);
      if(type==='status') opts=['PRESENT','ABSENT','LATE','LEAVE'].map(v=>({id:v,name:v}));
      if(type==='examType') opts=['INTERNAL','SEMESTER','PRACTICAL','MODEL'].map(v=>({id:v,name:v}));
      if(type==='audience') opts=['ADMIN','STAFF','STUDENT'].map(v=>({id:v,name:v}));
      return <select {...common}><option value="">Select {label}</option>{opts.map(o=><option key={o.id} value={['student','staff'].includes(type)?o.profileId:o.id}>{o.label||o.name||o.title||o.code}</option>)}</select>;
    }
    return <input {...common} type={type} min={type==='number'?0:undefined} placeholder={type==='url'?'https://…':`Enter ${label.toLowerCase()}`}/>;
  };
  return <div className="module-page">
    <div className="module-heading"><div><span className="eyebrow">UIT • CSE PORTAL</span><h2>{page}</h2><p>{cfg?`Manage ${page.toLowerCase()} and keep academic records up to date.`:`View your ${page.toLowerCase()} information.`}</p></div><div className="record-count"><strong>{rows.length}</strong><span>{rows.length===1?'Record':'Records'}</span></div></div>
    {notice&&<div className="alert success-alert">{notice}</div>}{error&&<div className="alert error-alert" role="alert">{error}</div>}
    <div className={`module-layout ${!canCreate?'single-column':''}`}>
      {canCreate&&<section className="module-card form-card"><div className="card-heading"><div><span className="eyebrow">{editing?'EDIT RECORD':'NEW RECORD'}</span><h3>{editing?`Update ${cfg.title}`:`Add ${cfg.title}`}</h3></div><span className="card-heading-icon"><Plus size={20}/></span></div>
        <form className="module-form" onSubmit={save}>{cfg.fields.map(f=><label key={f[0]}>{f[1]}{renderField(f)}</label>)}
          <div className="form-actions"><button className="primary-button" disabled={saving}><Save size={16}/>{saving?'Saving…':editing?'Save changes':`Create ${cfg.title}`}</button>{editing&&<button type="button" className="secondary-button" onClick={()=>{setEditing(null);setForm({});}}>Cancel</button>}</div>
        </form></section>}
      <section className="module-card records-card"><div className="records-heading"><div><span className="eyebrow">RECORDS</span><h3>{isStudent?'Your records':`All ${page}`}</h3></div><button className="secondary-button" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
        <div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${page.toLowerCase()}…`}/></div>
        {loading?<div className="empty-state"><span className="loader"/><p>Loading records…</p></div>:visible.length===0?<div className="empty-state"><Inbox size={32}/><strong>{error?'Records unavailable':'Nothing to show yet'}</strong><p>{error?'Check your access or connection and refresh.':'Records will appear here when they are available.'}</p></div>:
          <div className="records-list">{visible.map((item,i)=><article className="record-row" key={idOf(item)=== '—'?i:idOf(item)}><div className="record-avatar">{String(labelOf(item)).slice(0,1).toUpperCase()}</div><div className="record-main"><strong>{labelOf(item)}</strong><small>{item.email||(item.value!==undefined?String(item.value):'')||item.subject?.code||item.exam?.type||item.assignment?.title||item.student?.user?.email||item.attendanceDate?.slice?.(0,10)||item.createdAt?.slice?.(0,10)||`Record #${idOf(item)}`}</small><div className="record-meta">{Object.entries(item).filter(([k,v])=>!['id','passwordHash','name','title','email','createdAt','updatedAt'].includes(k)&&v!==null&&typeof v!=='object').slice(0,3).map(([k,v])=><span key={k}>{k.replace(/[A-Z]/g,' $&')}: {String(v)}</span>)}</div></div>
            {item.fileUrl&&<a className="icon-action" href={item.fileUrl} target="_blank" rel="noreferrer" aria-label="Open file"><ExternalLink size={16}/></a>}
            {page==='Submissions'&&role!=='STUDENT'&&<button className="secondary-button grade-button" onClick={()=>gradeSubmission(item)}>Grade</button>}{canDelete&&cfg&&<div className="record-actions">{canEdit&&<button className="icon-action" onClick={()=>edit(item)} title="Edit"><Pencil size={16}/></button>}<button className="icon-action danger-action" onClick={()=>remove(item)} title="Delete"><Trash2 size={16}/></button></div>}
          </article>)}</div>}
      </section>
    </div>
  </div>;
}
