import { newProductIsHairClaw, validateNewClawOffers } from '../new-hair-claw'
test('new hair claws are recognized by selected type or an untyped hair-claw title',()=>{
 expect(newProductIsHairClaw({value:'Hair Claw'},'New design')).toBe(true)
 expect(newProductIsHairClaw(null,'New Hair Claw')).toBe(true)
 expect(newProductIsHairClaw({value:'Earrings'},'Hair claw earrings')).toBe(false)
})
test('requires real physical offers and rejects all color option labels before allocating stock identities',()=>{
 for(const name of ['Color','Primary colour','Hair claw color']) expect(()=>validateNewClawOffers({options:[{title:name}],variants:[]})).toThrow('Color is recorded')
 expect(()=>validateNewClawOffers({options:[{title:'Size'}],variants:[{options:{Size:'large'}}]})).toThrow('actual physical size')
 expect(()=>validateNewClawOffers({options:[{title:'Size'},{title:'Finish'}],variants:[{options:{Size:'2 inch',Finish:'Natural'}},{options:{Size:'4 inch',Finish:'Colors by Cate'}}]})).not.toThrow()
})
