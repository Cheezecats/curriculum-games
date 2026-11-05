import {it,expect} from 'vitest';
import {missionComplete} from './outcome';
it('requires actual task, architecture, label repairs and held-out outcomes for each contract',()=>{
 const good={kind:'image' as const,preset:'cnn' as const,augmented:true,repairs:3,accuracy:.9,parameters:631};
 expect(missionComplete(4,good)).toBe(true);expect(missionComplete(4,{...good,preset:'mlp'})).toBe(false);
 expect(missionComplete(5,good)).toBe(true);expect(missionComplete(5,{...good,augmented:false})).toBe(false);
 expect(missionComplete(6,good)).toBe(true);expect(missionComplete(6,{...good,parameters:1501})).toBe(false);
 expect(missionComplete(1,{...good,kind:'linear',preset:'perceptron'})).toBe(true);
 expect(missionComplete(1,good)).toBe(false);
 expect(missionComplete(2,{...good,kind:'xor',preset:'mlp'})).toBe(true);
 expect(missionComplete(2,{...good,kind:'linear',preset:'mlp'})).toBe(false);
 expect(missionComplete(3,good)).toBe(false);
 expect(missionComplete(3,{...good,kind:'linear'})).toBe(true);
 expect(missionComplete(3,{...good,kind:'linear',repairs:2})).toBe(false);
 for(let order=1;order<=6;order++)expect(missionComplete(order,{...good,accuracy:.2})).toBe(false);
});
