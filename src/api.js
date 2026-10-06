import {seed} from './config.js';
const cfg=window.GALDCUP_CONFIG||{},url=(cfg.SUPABASE_URL||'').replace(/\/$/,''),key=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY;
export const live=Boolean(url&&key);
const STORE='galdcup-demo-v2',SESSION=`galdcup-auth:${url}`;
let changed=()=>{},status=()=>{},bc,demo,session,refreshPromise,anonymousPromise;
const DEFAULT_PROJECT='00000000-0000-4000-8000-000000000001';
function migrateDemo(old){
 if(old?.projects)return old;
 const initial=old||seed(),now=new Date().toISOString();
 return {projects:[{id:DEFAULT_PROJECT,name:'첫 번째 프로젝트',created_at:now,updated_at:now,saved_at:now}],items:initial.items.map(i=>({...i,project_id:DEFAULT_PROJECT})),comments:initial.comments.map(c=>({...c,project_id:DEFAULT_PROJECT}))};
}
try{demo=migrateDemo(JSON.parse(localStorage.getItem(STORE))||JSON.parse(localStorage.getItem('galdcup-demo-v1')));}catch{demo=migrateDemo();}
let activeProject=sessionStorage.getItem('galdcup-project:'+url)||null;
export const getProjectId=()=>activeProject;
export function selectProject(id){activeProject=id||null;if(id)sessionStorage.setItem('galdcup-project:'+url,id);else sessionStorage.removeItem('galdcup-project:'+url);}
export async function listProjects(){return live?allRows('projects','&deleted_at=is.null'):structuredClone(demo.projects);}
export async function createProject(name){
 await requireEditor();name=name.trim();if(!name||name.length>80)throw Error('프로젝트 이름은 1~80자로 입력해 주세요.');
 const now=new Date().toISOString(),project={id:crypto.randomUUID(),name,created_at:now,updated_at:now,saved_at:now};
 if(live)await request('/rest/v1/projects',{method:'POST',body:{id:project.id,name}});
 else persist({...demo,projects:[...demo.projects,project]});
 return project.id;
}
export async function saveProject(){await requireEditor();if(!activeProject)throw Error('프로젝트를 먼저 선택해 주세요.');if(live)return rpc('save_project',{p_id:activeProject});const now=new Date().toISOString();persist({...demo,projects:demo.projects.map(p=>p.id===activeProject?{...p,updated_at:now,saved_at:now}:p)});return now;}

try{session=JSON.parse(sessionStorage.getItem(SESSION));}catch{}
function saveSession(s){session=s?.access_token?{...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+s.expires_in}:null;if(session)sessionStorage.setItem(SESSION,JSON.stringify(session));else sessionStorage.removeItem(SESSION);}
async function request(path,{method='GET',body,headers={},auth=true,retry=true}={}){
 if(auth&&session&&session.expires_at<Date.now()/1000+60){
  if(!refreshPromise)refreshPromise=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false}).then(saveSession).catch(e=>{saveSession(null);throw e;}).finally(()=>refreshPromise=null);
  await refreshPromise;
 }
 const token=auth&&session?.access_token||(key?.startsWith('eyJ')?key:null);
 let r;try{r=await fetch(url+path,{method,headers:{apikey:key,...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':body instanceof Blob?body.type:'application/json'}:{}),...headers},body:body?(body instanceof Blob?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(20000)});}catch{throw Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');}
 const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{data=null;}
 if(!r.ok){if(r.status===401&&session&&auth&&retry){session.expires_at=0;return request(path,{method,body,headers,auth,retry:false});}throw Error(data?.message||data?.msg||data?.error_description||data?.error||`요청 실패 (${r.status})`);}return data;
}
async function ensureAnonymous(){
 if(session)return;
 if(!anonymousPromise)anonymousPromise=request('/auth/v1/signup',{method:'POST',body:{data:{}},auth:false}).then(result=>{if(!session)saveSession(result);}).finally(()=>anonymousPromise=null);
 await anonymousPromise;
}
const rpc=(name,body={})=>request(`/rest/v1/rpc/${name}`,{method:'POST',body});
function persist(next=demo){const now=new Date().toISOString();next={...next,projects:next.projects.map(p=>p.id===activeProject?{...p,updated_at:now}:p)};localStorage.setItem(STORE,JSON.stringify(next));demo=next;bc?.postMessage('changed');changed();}
export const imageUrl=i=>i.image_path?(live?`${url}/storage/v1/object/public/tier-images/${encodeURIComponent(i.image_path)}`:i.image_path):'';
async function allRows(table,query){let rows=[];for(let offset=0;;offset+=1000){const data=await request(`/rest/v1/${table}?select=*&order=id&limit=1000&offset=${offset}${query}`);rows.push(...data);if(data.length<1000)break;}return rows;}
export async function snapshot(){
 const projects=await listProjects();let id=activeProject;
 if(!projects.some(p=>p.id===id)){id=projects[0]?.id||null;selectProject(id);}
 if(!id)return {projects,projectId:null,items:[],comments:[]};
 if(!live)return structuredClone({projects,projectId:id,items:demo.items.filter(i=>i.project_id===id),comments:demo.comments.filter(c=>c.project_id===id)});
 const [items,comments]=await Promise.all([allRows('items',`&deleted_at=is.null&project_id=eq.${id}`),allRows('comments',`&project_id=eq.${id}`)]);
 return {projects,projectId:id,items,comments};
}
export async function isEditor(){return sessionStorage.getItem('galdcup-edit-mode')==='yes';}
// Editing is a UI mode, not a password-protected role. Anonymous Auth is automatic.
export async function login(){sessionStorage.setItem('galdcup-edit-mode','yes');}
export async function logout(){sessionStorage.removeItem('galdcup-edit-mode');}
async function requireEditor(){if(!await isEditor())throw Error('수정하기 버튼을 눌러 편집 모드를 켜 주세요.');if(live)await ensureAnonymous();}
export async function renameProject(id,name){
 await requireEditor();name=name.trim();if(!name||name.length>80)throw Error('프로젝트 이름은 1~80자로 입력해 주세요.');
 if(live){await rpc('rename_project',{p_id:id,p_name:name});return;}
 if(!demo.projects.some(p=>p.id===id))throw Error('이미 삭제된 프로젝트입니다.');
 persist({...demo,projects:demo.projects.map(p=>p.id===id?{...p,name,updated_at:new Date().toISOString()}:p)});
}
export async function deleteProject(id){
 await requireEditor();
 if(live){await rpc('delete_project',{p_id:id});return;}
 persist({...demo,projects:demo.projects.filter(p=>p.id!==id),items:demo.items.filter(i=>i.project_id!==id),comments:demo.comments.filter(c=>c.project_id!==id)});
}
export async function moveItem(id,tier,beforeId=null){
 await requireEditor();if(live){await rpc('move_item',{p_id:id,p_tier:tier,p_before:beforeId});return;}
 const next=structuredClone(demo),item=next.items.find(i=>i.id===id&&i.project_id===activeProject);if(!item)throw Error('이미 삭제된 항목입니다.');
 const target=next.items.filter(i=>i.project_id===item.project_id&&i.tier===tier&&i.id!==id).sort((a,b)=>a.position-b.position),idx=target.findIndex(i=>i.id===beforeId);
 target.splice(idx<0?target.length:idx,0,item);target.forEach((i,p)=>{i.tier=tier;i.position=p;});persist(next);
}
export async function upload(blob){await requireEditor();if(!live)return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});const path=`${crypto.randomUUID()}.webp`;await request(`/storage/v1/object/tier-images/${path}`,{method:'POST',body:blob,headers:{'x-upsert':'false'}});return path;}
export async function removeUploads(paths){if(live&&paths.length)await request('/storage/v1/object/tier-images',{method:'DELETE',body:{prefixes:paths}});}
export async function addItems(rows,projectId=activeProject){await requireEditor();if(!projectId)throw Error('프로젝트를 선택해 주세요.');rows=rows.map(row=>({...row,project_id:projectId}));if(live){await request('/rest/v1/items',{method:'POST',body:rows});return;}persist({...demo,items:[...demo.items,...rows.map((i,p)=>({...i,id:crypto.randomUUID(),position:Date.now()+p,updated_at:new Date().toISOString()}))]});}
export async function editItem(item,patch){await requireEditor();if(live){const data=await request(`/rest/v1/items?id=eq.${item.id}&updated_at=eq.${encodeURIComponent(item.updated_at)}&deleted_at=is.null`,{method:'PATCH',body:patch,headers:{Prefer:'return=representation'}});if(!data.length)throw Error('다른 사람이 먼저 수정했습니다. 최신 항목을 다시 열어 주세요.');return;}const next=structuredClone(demo);Object.assign(next.items.find(i=>i.id===item.id),patch,{updated_at:new Date().toISOString()});persist(next);}
export async function deleteItem(item){await requireEditor();if(live){await rpc('delete_item',{p_id:item.id});return;}persist({...demo,items:demo.items.filter(i=>i.id!==item.id),comments:demo.comments.filter(c=>c.item_id!==item.id)});}
export async function addComment(itemId,name,body,suggestedTier){if(live){await ensureAnonymous();await rpc('post_comment',{p_item:itemId,p_name:name,p_body:body,p_tier:suggestedTier||null});return;}persist({...demo,comments:[...demo.comments,{id:crypto.randomUUID(),project_id:demo.items.find(i=>i.id===itemId)?.project_id,item_id:itemId,name,body,suggested_tier:suggestedTier||null,created_at:new Date().toISOString()}]});}
export async function deleteComment(id){await requireEditor();if(live)await request(`/rest/v1/comments?id=eq.${id}`,{method:'DELETE'});else persist({...demo,comments:demo.comments.filter(c=>c.id!==id)});}
export function subscribe(change,report){
 changed=change;status=report;
 if(!live){bc=new BroadcastChannel(STORE);const update=()=>{try{demo=migrateDemo(JSON.parse(localStorage.getItem(STORE)));changed();}catch{}};bc.onmessage=update;window.addEventListener('storage',e=>{if(e.key===STORE)update();});status('demo');return;}
 // Supabase public Postgres Changes channel, Phoenix JSON protocol 1.0.
 // Read access is public; mutations independently use authenticated REST requests.
 let ws,retryTimer,heartbeat,joinTimeout,lastReply=0,ref=0,attempt=0,joined=false,connecting=false,wsToken=null;
 function send(event,payload,topic='realtime:galdcup'){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({topic,event,payload,ref:String(++ref),join_ref:topic==='phoenix'?undefined:'1'}));}
 async function connect(){
  if(connecting)return;connecting=true;
  clearTimeout(retryTimer);if(!navigator.onLine){status('offline');connecting=false;retryTimer=setTimeout(connect,3000);return;}
  status('reconnecting');joined=false;ref=0;
  try{if(key.startsWith('sb_publishable_')&&!session)await ensureAnonymous();if(session)await request('/auth/v1/user');}
  catch(error){console.error(error);connecting=false;retryTimer=setTimeout(connect,15000);return;}
  wsToken=session?.access_token||(key.startsWith('eyJ')?key:null);connecting=false;
  ws=new WebSocket(`${url.replace(/^http/,'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`);
  ws.onopen=()=>{lastReply=Date.now();send('phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[{event:'*',schema:'public',table:'projects'},{event:'*',schema:'public',table:'items'},{event:'*',schema:'public',table:'comments'}],private:false},access_token:wsToken});joinTimeout=setTimeout(()=>{if(!joined)ws.close();},12000);heartbeat=setInterval(()=>{if(Date.now()-lastReply>65000){ws.close();return;}if(session?.access_token&&session.access_token!==wsToken){wsToken=session.access_token;send('access_token',{access_token:wsToken});}send('heartbeat',{},'phoenix');},25000);};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}lastReply=Date.now();if(m.event==='phx_reply'&&m.ref==='1'&&m.payload?.status==='ok'){joined=true;attempt=0;clearTimeout(joinTimeout);status('live');change();}if(m.event==='postgres_changes')change();if(m.event==='system'&&m.payload?.status==='error')ws.close();if(m.event==='phx_error'||(m.event==='phx_reply'&&m.payload?.status==='error'))ws.close();};
  ws.onclose=()=>{clearInterval(heartbeat);clearTimeout(joinTimeout);status(navigator.onLine?'reconnecting':'offline');retryTimer=setTimeout(connect,Math.min(15000,1000*2**attempt++));};
  ws.onerror=()=>ws.close();
 }
 connect();window.addEventListener('online',()=>{if(ws?.readyState===WebSocket.CLOSED)connect();change();});window.addEventListener('offline',()=>{status('offline');ws?.close();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)change();});
 // Regular reconciliation recovers missed events after interrupted connections.
 setInterval(()=>{if(!document.hidden&&navigator.onLine)change();},15000);
}
