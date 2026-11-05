import type { DataKind, Sample } from './datasets';
import type { Preset, Snapshot, Epoch, Inspection } from './engine';
export class JobGate {private current=0;next(){return ++this.current;}invalidate(){this.current++;}accept(id:number){return id===this.current;}}
export interface WorkerRequest {id:number;action:'train'|'restore'|'predict'|'inspect';kind?:DataKind;preset?:Preset;units?:number;epochs?:number;rate?:number;train?:Sample[];validation?:Sample[];inputs?:number[][];snapshot?:Snapshot;}
export interface WorkerResponse {id:number;type:'ready'|'progress'|'predictions'|'inspection'|'error';epoch?:Epoch;snapshot?:Snapshot;inspection?:Inspection;predictions?:number[][];error?:string;elapsed?:number;}
