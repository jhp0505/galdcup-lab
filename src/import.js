const MB=1024*1024;
const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
export async function zipImages(file){
 if(file.size>30*MB)throw Error('ZIP은 30MB 이하로 넣어 주세요.');
 let zip;try{zip=await JSZip.loadAsync(file);}catch{throw Error('일반 ZIP 파일인지 확인해 주세요. 암호화 ZIP은 지원하지 않습니다.');}
 const entries=Object.values(zip.files).filter(e=>!e.dir&&!e.name.startsWith('__MACOSX/')&&!e.name.split('/').some(s=>s.startsWith('.'))&&/\.(png|jpe?g|webp|gif)$/i.test(e.name));
 if(!entries.length)throw Error('ZIP 안에 PNG, JPG, WebP, GIF 이미지가 없습니다.');
 if(entries.length>50)throw Error('이미지는 한 번에 50개까지 가져올 수 있어요.');
 let total=0;
 for(const e of entries){const size=e._data.uncompressedSize;if(!Number.isFinite(size)||size>10*MB)throw Error('ZIP 내부 이미지는 개별 10MB 이하여야 합니다.');total+=size;}
 if(total>100*MB)throw Error('압축 해제 후 합계 100MB 이하여야 합니다.');
 const files=[];let inflatedTotal=0;
 for(const e of entries){
  // Abort inflated output beyond the advertised size (including malformed ZIPs).
  const blob=await new Promise((resolve,reject)=>{let size=0,chunks=[];const stream=e.internalStream('uint8array');stream.on('data',chunk=>{size+=chunk.length;if(size>10*MB){stream.pause();reject(Error('압축 해제 크기 제한을 초과했습니다.'));}else chunks.push(chunk);}).on('error',reject).on('end',()=>resolve(new Blob(chunks))).resume();});
  inflatedTotal+=blob.size;if(inflatedTotal>100*MB)throw Error('실제 압축 해제 크기가 100MB를 초과했습니다.');
  const name=e.name.split('/').at(-1);files.push(new File([blob],name,{type:types[name.split('.').at(-1).toLowerCase()]}));
 }
 return files;
}
export async function normalizeImage(file){
 if(file.size>10*MB)throw Error(`${file.name}: 이미지는 10MB 이하로 넣어 주세요.`);
 if(!/\.(png|jpe?g|webp|gif)$/i.test(file.name))throw Error('PNG, JPG, WebP, GIF만 지원합니다.');
 let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error(`${file.name}: 손상되었거나 지원하지 않는 이미지입니다.`);}
 if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error(`${file.name}: 4천만 화소 이하 이미지를 사용해 주세요.`);}
 const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('이미지 변환에 실패했습니다.')),'image/webp',.9));
}
