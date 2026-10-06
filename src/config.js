export const tiers = [
 {id:'Goat',label:'Goat',color:'#ff667b',desc:'이견 없는 정상'},
 {id:'S',label:'S',color:'#ff9674',desc:'최상위'},
 {id:'A',label:'A',color:'#ffc96b',desc:'상위'},
 {id:'B',label:'B',color:'#efdf7a',desc:'준수'},
 {id:'C',label:'C',color:'#87d7ac',desc:'보통'},
 {id:'D',label:'D',color:'#79bdf2',desc:'아쉬움'},
 {id:'F',label:'F',color:'#b69cf1',desc:'하위'},
 {id:'Joat',label:'Joat',color:'#df92d2',desc:'다시 생각해 보자'},
 {id:'unranked',label:'대기',color:'#9499a6',desc:'아직 정하지 않았어요'},
];
export const titleOf = item => item.label || '이름 없는 이미지';
export const tierOf = id => tiers.find(t=>t.id===id) || tiers.at(-1);
export function seed(){
 const groups=[['Χχ','Fƒ','Δδ','Σσ','Ππ'],['Nn','Tt','Eε','Aα'],['Aa','Pp','Rr','Iι','Θθ','Cc'],['Kκ','Bβ','Gg','Zz','Lℓ'],['Ss','Tτ','Γγ'],['Uu','Ww'],['Hη','Jj'],['Nν','Yυ'],['Ωω','Ψψ']];
 const items=groups.flatMap((labels,g)=>labels.map((label,p)=>({id:`demo-${g}-${p}`,label,tier:tiers[g].id,position:p,image_path:null,updated_at:new Date(0).toISOString()})));
 return {items,comments:[]};
}
