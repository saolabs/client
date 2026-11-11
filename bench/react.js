(function(){
const {useState, memo, createElement: h} = React;
const A=['pretty','large','big','small','tall','short','long','handsome','plain','quaint','clean','elegant','easy','angry','crazy','helpful','mushy','odd','unsightly','adorable','important','inexpensive','cheap','expensive','fancy'],C=['red','yellow','blue','green','pink','brown','purple','brown','white','black','orange'],N=['table','chair','house','bbq','desk','car','pony','cookie','sandwich','burger','pizza','mouse','keyboard'];
let nextId=1,seed=1;const rnd=m=>(seed=(seed*16807)%2147483647)%m;
const build=n=>Array.from({length:n},()=>({id:nextId++,label:`${A[rnd(A.length)]} ${C[rnd(C.length)]} ${N[rnd(N.length)]}`}));
let api={};
const Row=memo(({row,selected,select,remove})=>h('tr',{className:selected?'danger':''},
  h('td',{className:'col-md-1'},row.id),
  h('td',{className:'col-md-4'},h('a',{className:'lbl',onClick:()=>select(row.id)},row.label)),
  h('td',{className:'col-md-1'},h('a',{className:'rm',onClick:()=>remove(row.id)},h('span',{className:'glyphicon glyphicon-remove','aria-hidden':'true'}))),
  h('td',{className:'col-md-6'})));
function App(){
  const [rows,setRows]=useState([]);const [selected,setSelected]=useState(0);
  api.rows=rows;api.setRows=setRows;api.setSelected=setSelected;
  const remove=React.useCallback(id=>setRows(r=>r.filter(x=>x.id!==id)),[]);
  const select=React.useCallback(id=>setSelected(id),[]);
  return h('div',{className:'container'},h('table',{className:'table'},h('tbody',null,rows.map(r=>h(Row,{key:r.id,row:r,selected:selected===r.id,select,remove})))));
}
const el=document.createElement('div');document.body.appendChild(el);
const root=ReactDOM.createRoot(el);ReactDOM.flushSync(()=>root.render(h(App)));
const set=f=>ReactDOM.flushSync(()=>api.setRows(f));
window.fw={name:'react',
 create:n=>set(build(n)),replace:n=>set(build(n)),
 update:()=>set(api.rows.map((r,i)=>i%10===0?{...r,label:r.label+' !!!'}:r)),
 select:()=>ReactDOM.flushSync(()=>api.setSelected(api.rows[1].id)),
 swap:()=>{const a=api.rows.slice();const t=a[1];a[1]=a[a.length-2];a[a.length-2]=t;set(a);},
 remove:()=>set(api.rows.filter((_,i)=>i!==5)),
 append:n=>set(api.rows.concat(build(n))),
 clear:()=>set([]),
 count:()=>document.querySelectorAll('tbody tr').length};
})();
