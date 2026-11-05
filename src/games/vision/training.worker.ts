/// <reference lib="webworker" />
import { VisionEngine } from './engine';
import type { WorkerRequest, WorkerResponse } from './protocol';
const engine=new VisionEngine();
const send=(response:WorkerResponse)=>self.postMessage(response);
self.onmessage=async({data:r}:MessageEvent<WorkerRequest>)=>{
  try {
    if(r.action==='train'){const started=performance.now();await engine.init(r.kind!,r.preset!,r.units);await engine.train(r.train!,r.validation!,r.epochs!,r.rate!,epoch=>send({id:r.id,type:'progress',epoch}));send({id:r.id,type:'ready',snapshot:engine.snapshot(),elapsed:performance.now()-started,inspection:engine.inspect(r.train![0]!.input)});}
    else if(r.action==='restore'){await engine.restore(r.snapshot!);send({id:r.id,type:'ready',snapshot:engine.snapshot(),inspection:engine.inspect(r.inputs![0]!)});}
    else if(r.action==='predict')send({id:r.id,type:'predictions',predictions:engine.predict(r.inputs!)});
    else if(r.action==='inspect')send({id:r.id,type:'inspection',inspection:engine.inspect(r.inputs![0]!)});
  } catch(error){send({id:r.id,type:'error',error:error instanceof Error?error.message:String(error)});}
};
