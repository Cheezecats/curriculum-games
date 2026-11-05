import { useState } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import type { AttemptResult, MissionDefinition } from '../core/types';
import Modal from './Modal';

export default function Debrief({ attempt, mission, onClose, onCheck, onNext }: { attempt: AttemptResult; mission: MissionDefinition | null; onClose: () => void; onCheck: (correct: boolean) => void; onNext?: () => void }) {
  const [answer,setAnswer]=useState<number|null>(null);
  const metrics=Object.entries(attempt.metrics).filter(([,v])=>Number.isFinite(v)).slice(0,9);
  const label=(key:string)=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ');
  return <Modal title={attempt.completed?'That idea worked.':'An observation worth keeping.'} eyebrow={attempt.completed?'Mission complete · recorded in your notebook':'Attempt recorded · a new starting point'} onClose={onClose}>
    <p className="debrief-summary">{attempt.summary}</p>
    <div className="metrics-grid">{metrics.map(([key,value])=><div className="metric-cell" key={key}><span>{label(key)}</span><strong>{value.toLocaleString(undefined,{maximumFractionDigits:Math.abs(value)<1?3:2})}</strong></div>)}</div>
    {mission&&<section className="check-panel"><div className="check-title"><h3>A question to take with you</h3><span>Optional · keeps gameplay open</span></div><p className="question">{mission.check.question}</p><div className="check-options">{mission.check.options.map((option,index)=><button type="button" key={option} className={`check-option${answer===index?(index===mission.check.correctIndex?' correct':' incorrect'):''}`} onClick={()=>{setAnswer(index);onCheck(index===mission.check.correctIndex);}}><span>{String.fromCharCode(65+index)}</span>{option}{answer===index&&index===mission.check.correctIndex&&<Check size={14}/>}</button>)}</div>{answer!==null&&<p role="status">{answer===mission.check.correctIndex?'Yes. ': 'Try thinking about it this way. '}{mission.check.explanation}</p>}</section>}
    <div className="debrief-actions"><button type="button" className="button-secondary" onClick={onClose}><RotateCcw size={13}/> Back to the workshop</button>{onNext&&attempt.completed&&<button type="button" className="button-primary" onClick={onNext}>Next experiment <ArrowRight size={13}/></button>}</div>
  </Modal>;
}
