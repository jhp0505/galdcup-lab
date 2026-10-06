import {tiers,titleOf} from './config.js';
import {imageUrl} from './api.js';
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
const filename=s=>(s||'티어리스트').replace(/[\\/:*?"<>|]/g,'_').slice(0,80);
async function imageBlob(item){const r=await fetch(imageUrl(item),{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`${titleOf(item)} 이미지를 읽지 못했습니다.`);return r.blob();}
export async function downloadItem(item){downloadBlob(await imageBlob(item),`${filename(titleOf(item))}.webp`);}
function lines(ctx,text,maxWidth,maxLines){const out=[];let line='';for(const c of Array.from(text)){if(ctx.measureText(line+c).width>maxWidth&&line){out.push(line);line=c;}else line+=c;}if(line)out.push(line);if(out.length>maxLines){out.length=maxLines;let last=out[maxLines-1];while(ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);out[maxLines-1]=last+'…';}return out;}
export async function exportBoard(project,items,onProgress=()=>{}){
 await document.fonts?.ready;
 const rows=[];for(const tier of tiers){const list=items.filter(i=>i.tier===tier.id).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));if(!list.length)rows.push({tier,items:[]});else for(let offset=0;offset<list.length;offset+=10)rows.push({tier,items:list.slice(offset,offset+10),continued:offset>0});}
 const perPage=42,pages=Math.ceil(rows.length/perPage);let count=0;const blobs=[];
 for(let p=0;p<pages;p++){
 const pageRows=rows.slice(p*perPage,(p+1)*perPage),canvas=document.createElement('canvas');canvas.width=1600;canvas.height=156+pageRows.length*160+44;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#141519';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.textBaseline='middle';ctx.fillStyle='#c2f87b';ctx.font='600 18px sans-serif';ctx.fillText('갈드컵 연구소',32,34);
 ctx.fillStyle='#f4f6fa';ctx.font='700 34px sans-serif';ctx.fillText(lines(ctx,project.name,1500,1)[0],32,83);
 ctx.font='16px sans-serif';ctx.fillStyle='#bdc5d2';ctx.fillText(`${items.length}개 항목 · ${new Date().toLocaleString('ko-KR')} · ${p+1}/${pages}`,32,123);
 for(let r=0;r<pageRows.length;r++){
 const {tier,items:row,continued}=pageRows[r],y=150+r*160;
 ctx.fillStyle='#262a33';ctx.fillRect(32,y,1536,152);ctx.fillStyle=tier.color;ctx.fillRect(32,y,128,152);ctx.fillStyle='#171a20';ctx.font='800 32px sans-serif';ctx.textAlign='center';ctx.fillText(tier.label,96,y+68);if(continued){ctx.font='14px sans-serif';ctx.fillText('계속',96,y+100);}ctx.textAlign='left';
 for(let i=0;i<row.length;i++){
 const item=row[i],x=172+i*138;ctx.fillStyle='#f1f2f4';ctx.fillRect(x,y+8,128,136);ctx.fillStyle='#161b24';
 if(item.image_path){let bitmap;try{bitmap=await createImageBitmap(await imageBlob(item));}catch{throw Error(`${titleOf(item)} 이미지 저장에 실패했습니다. 연결 후 다시 시도해 주세요.`);}const h=item.label?105:136,scale=Math.min(128/bitmap.width,h/bitmap.height);ctx.drawImage(bitmap,x+(128-bitmap.width*scale)/2,y+8+(h-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);bitmap.close();if(item.label){ctx.fillStyle='#161b24';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText(lines(ctx,item.label,118,1)[0],x+64,y+129);}}
 else{ctx.font=(item.label.length<5?'32':'18')+'px sans-serif';const text=lines(ctx,item.label,110,5);ctx.textAlign='center';text.forEach((line,n)=>ctx.fillText(line,x+64,y+76+(n-(text.length-1)/2)*25));}
 ctx.textAlign='left';onProgress(++count,items.length);
 }
 if(!row.length){ctx.fillStyle='#c4cbd7';ctx.font='17px sans-serif';ctx.fillText('등록된 항목 없음',188,y+76);}
 }
 ctx.fillStyle='#bdc5d2';ctx.font='14px sans-serif';ctx.fillText('GALDCUP LAB · 저장 시점의 티어리스트',32,canvas.height-20);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('이미지 생성에 실패했습니다.')),'image/png'));blobs.push({blob,name:`${filename(project.name)}${pages>1?`-${p+1}`:''}.png`});canvas.width=canvas.height=1;
 }
 if(blobs.length===1)downloadBlob(blobs[0].blob,blobs[0].name);
 else{const zip=new JSZip();for(const b of blobs)zip.file(b.name,await b.blob.arrayBuffer());downloadBlob(await zip.generateAsync({type:'blob'}),`${filename(project.name)}-이미지.zip`);}
}
