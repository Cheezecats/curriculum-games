import { JobGate } from './protocol';
import type { WorkerRequest, WorkerResponse } from './protocol';
export class VisionClient {
  private worker:Worker|null=null;private gate=new JobGate();
  constructor(private receive:(response:WorkerResponse)=>void){}
  request(request:Omit<WorkerRequest,'id'>){if(!this.worker){const worker=new Worker(new URL('./training.worker.ts',import.meta.url),{type:'module'});this.worker=worker;this.worker.onmessage=({data}:MessageEvent<WorkerResponse>)=>{if(this.gate.accept(data.id))this.receive(data);};this.worker.onerror=event=>{if(this.worker!==worker)return;this.receive({id:0,type:'error',error:event.message||'Worker could not start'});};}const id=this.gate.next();this.worker.postMessage({...request,id});return id;}
  cancel(){this.gate.invalidate();this.worker?.terminate();this.worker=null;}
  dispose(){this.cancel();}
}
