export type OrderKey={id:string,token:string};
const memory=new Map<string,OrderKey[]>();
export function orderKeys(restaurant:string):OrderKey[]{if(memory.has(restaurant))return memory.get(restaurant)!;try{const stored=JSON.parse(localStorage.getItem('table-orders:'+restaurant)||'[]');if(Array.isArray(stored))return stored.filter(o=>typeof o.id==='string'&&typeof o.token==='string')}catch{}return memory.get(restaurant)||[]}
export function rememberOrder(restaurant:string,key:OrderKey){const keys=[key,...orderKeys(restaurant).filter(o=>o.id!==key.id)];memory.set(restaurant,keys);let saved=true;try{localStorage.setItem('table-orders:'+restaurant,JSON.stringify(keys))}catch{saved=false}window.dispatchEvent(new Event('table-order-placed'));return saved}
