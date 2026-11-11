(function(){
const {createApp, shallowRef, ref, h, nextTick} = Vue;
const A=['pretty','large','big','small','tall','short','long','handsome','plain','quaint','clean','elegant','easy','angry','crazy','helpful','mushy','odd','unsightly','adorable','important','inexpensive','cheap','expensive','fancy'],C=['red','yellow','blue','green','pink','brown','purple','brown','white','black','orange'],N=['table','chair','house','bbq','desk','car','pony','cookie','sandwich','burger','pizza','mouse','keyboard'];
let nextId=1,seed=1;const rnd=m=>(seed=(seed*16807)%2147483647)%m;
const build=n=>Array.from({length:n},()=>({id:nextId++,label:`${A[rnd(A.length)]} ${C[rnd(C.length)]} ${N[rnd(N.length)]}`}));
const rows=shallowRef([]),selected=ref(0);
// Template biên dịch lúc chạy bằng compiler của Vue (bản global đầy đủ) — có patch flag như SFC.
const app=createApp({
  setup(){return {rows,selected,select:id=>{selected.value=id},remove:id=>{rows.value=rows.value.filter(r=>r.id!==id)}}},
  template:`<div class="container"><table class="table"><tbody>
<tr v-for="row in rows" :key="row.id" :class="{danger: selected===row.id}">
<td class="col-md-1">{{ row.id }}</td>
<td class="col-md-4"><a class="lbl" @click="select(row.id)">{{ row.label }}</a></td>
<td class="col-md-1"><a class="rm" @click="remove(row.id)"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td>
<td class="col-md-6"></td>
</tr></tbody></table></div>`});
const el=document.createElement('div');document.body.appendChild(el);app.mount(el);
// Vue flush ở microtask: ép flush đồng bộ bằng scheduler nội bộ không có API công khai → đo qua await nextTick.
const set=v=>{rows.value=v;return nextTick();};
window.fw={name:'vue',
 create:n=>set(build(n)),replace:n=>set(build(n)),
 update:()=>set(rows.value.map((r,i)=>i%10===0?{...r,label:r.label+' !!!'}:r)),
 select:()=>{selected.value=rows.value[1].id;return nextTick();},
 swap:()=>{const a=rows.value.slice();const t=a[1];a[1]=a[a.length-2];a[a.length-2]=t;return set(a);},
 remove:()=>set(rows.value.filter((_,i)=>i!==5)),
 append:n=>set(rows.value.concat(build(n))),
 clear:()=>set([]),
 count:()=>document.querySelectorAll('tbody tr').length};
})();
