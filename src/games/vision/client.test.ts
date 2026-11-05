import {it,expect,vi} from 'vitest';
import {VisionClient} from './client';
import type {WorkerResponse} from './protocol';
it('terminates cancelled workers and ignores late progress, ready and error messages',()=>{
 const workers:FakeWorker[]=[];
 class FakeWorker {onmessage:((event:{data:WorkerResponse})=>void)|null=null;onerror:((event:{message:string})=>void)|null=null;terminated=false;request:{id:number}|null=null;constructor(){workers.push(this);}postMessage(request:{id:number}){this.request=request;}terminate(){this.terminated=true;}}
 vi.stubGlobal('Worker',FakeWorker);
 const outcomes:WorkerResponse[]=[];const client=new VisionClient(r=>outcomes.push(r));
 client.request({action:'inspect',inputs:[[.2,.4]]});const old=workers[0]!;const oldId=old.request!.id;client.cancel();expect(old.terminated).toBe(true);
 client.request({action:'inspect',inputs:[[.3,.6]]});old.onmessage?.({data:{id:oldId,type:'ready'}});old.onerror?.({message:'obsolete failure'});
 expect(outcomes).toEqual([]);const active=workers[1]!;active.onmessage?.({data:{id:active.request!.id,type:'inspection'}});expect(outcomes.length).toBe(1);client.dispose();expect(active.terminated).toBe(true);vi.unstubAllGlobals();
});
