import type {DataKind} from './datasets';
import type {Preset} from './engine';
export function missionComplete(order:number,m:{kind:DataKind;preset:Preset;augmented:boolean;repairs:number;accuracy:number;parameters:number}){
 if(!Number.isFinite(m.accuracy)||!Number.isFinite(m.parameters))return false;
 if(order===1)return m.kind==='linear'&&m.preset==='perceptron'&&m.accuracy>=.8;
 if(order===2)return m.kind==='xor'&&m.preset==='mlp'&&m.accuracy>=.8;
 if(order===3)return m.kind==='linear'&&m.repairs>=3&&m.accuracy>=.8;
 if(order===4)return m.kind==='image'&&m.preset==='cnn'&&m.accuracy>=.75;
 if(order===5)return m.kind==='image'&&m.augmented&&m.accuracy>=.65;
 if(order===6)return m.kind==='image'&&m.accuracy>=.75&&m.parameters<=1500;
 return false;
}
