import { useState } from 'react';
import { ArrowUpRight, BookOpen, Download, Upload } from 'lucide-react';
import Modal from './Modal';
import type { ProgressData } from '../core/types';
import { allMissions, sourceRepository } from '../core/registry';
import { exportProgress, parseProgress } from '../core/progress';

export function downloadJson(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Notebook({ progress, onImport, onClose }: { progress: ProgressData; onImport: (progress: ProgressData) => Promise<void>; onClose: () => void }) {
  const [notice,setNotice] = useState(''); const [error,setError] = useState(false);
  const values = Object.values(progress.missions);
  return <Modal title="Your field notebook" eyebrow="Every attempt is an observation" onClose={onClose}>
    <div className="notebook-stats"><div className="notebook-stat"><strong>{values.filter(m=>m.explored).length}<span> / 12</span></strong><span>Concepts explored</span></div><div className="notebook-stat"><strong>{values.filter(m=>m.completed).length}<span> / 12</span></strong><span>Missions complete</span></div><div className="notebook-stat"><strong>{values.filter(m=>m.demonstrated).length}<span> / 12</span></strong><span>Concept checks passed</span></div></div>
    <p>Your notebook lives in this browser. Export a backup to keep a copy or move your progress to another device. Importing a valid backup replaces the notebook on this device.</p>
    <div className="backup-actions"><button type="button" className="button-primary" onClick={()=>downloadJson('fieldwork-progress.json',exportProgress(progress))}><Download size={13}/> Export progress</button><label className="button-secondary import-label"><Upload size={13}/> Import progress<input aria-label="Import progress" type="file" accept="application/json,.json" onChange={async event=>{ const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;try{if(file.size>2*1024*1024)throw new Error('This backup is too large. Your current progress has not changed.');const parsed=parseProgress(await file.text(),allMissions.map(m=>m.id));await onImport(parsed);setError(false);setNotice('Your notebook has been restored.');}catch(cause){setError(true);setNotice(cause instanceof Error?cause.message:'Could not restore this backup.');}}}/></label></div>
    {notice&&<div className={`status-message${error?' error':''}`} role={error?'alert':'status'}>{notice}</div>}
    <h3><BookOpen size={14} style={{verticalAlign:'middle',marginRight:6}}/> Curriculum & sources</h3><p>These workshops cover selected concepts. Physics uses the guide first assessed in 2025. The CS pack connects to the machine-learning topic first assessed in 2027; detailed objective and level mappings are awaiting a current-guide review.</p>
    <ul className="sources-list"><li><a href="https://www.ibo.org/globalassets/new-structure/university-admission/pdfs/subject-guides/physics-guide.pdf" target="_blank" rel="noreferrer">IB Physics guide <ArrowUpRight size={12}/></a><small>A.1–A.3: SL and HL · A.4: HL · aerodynamic design is enrichment.</small></li><li><a href="https://ibo.org/university-admission/latest-curriculum-updates/computer-science-updates/" target="_blank" rel="noreferrer">IB Computer Science curriculum overview <ArrowUpRight size={12}/></a><small>A.4 machine learning · first assessment 2027.</small></li><li><a href="https://www.tensorflow.org/js/guide/models_and_layers" target="_blank" rel="noreferrer">TensorFlow.js: models and layers <ArrowUpRight size={12}/></a><small>Background on the neural networks you train in Robot Vision.</small></li>{sourceRepository&&<li><a href={sourceRepository} target="_blank" rel="noreferrer">Source code & model notes <ArrowUpRight size={12}/></a><small>Setup instructions, simulation assumptions, tests, and contribution guide.</small></li>}</ul>
    {progress.recentAttempts.length>0&&<><h3>Recent observations</h3><ul className="recent-list">{progress.recentAttempts.slice(0,5).map(run=><li key={run.id}><div><strong>{allMissions.find(m=>m.id===run.missionId)?.title??(run.game==='flight'?'Flight free play':'Vision free play')}</strong><br/><small>{run.summary.slice(0,110)}</small></div><span className="scope-pill">{run.completed?'Complete':'Explored'}</span></li>)}</ul></>}
  </Modal>;
}
