const COBBLEMON_PAGE_SIZE=96;
let cobblemonData=null,cobblemonSpecies=new Map(),cobblemonLimit=COBBLEMON_PAGE_SIZE;
const cobblemonGrid=document.getElementById('cobblemon-grid');
const cobblemonSearch=document.getElementById('cobblemon-search');
const cobblemonFormFilter=document.getElementById('cobblemon-form-filter');
const cobblemonResults=document.getElementById('cobblemon-results');
function cobblemonEscape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cobblemonFormName(form){if(form==='standard')return 'Standard';if(form==='alolan-alolan')return 'Alolan';return form.split('-').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ')}
function cobblemonName(record){return record.id?cobblemonSpecies.get(record.id)?.name||'Pokémon #'+record.id:record.name||'Pokémon'}
function renderCobblemon(){
 if(!cobblemonData||!cobblemonGrid)return;
 const query=(cobblemonSearch.value||'').trim().toLowerCase();
 const formFilter=cobblemonFormFilter.value;
 const matches=cobblemonData.records.filter(record=>{
  const form=cobblemonFormName(record.form);
  if(formFilter==='standard'&&record.form!=='standard')return false;
  if(formFilter==='alternate'&&record.form==='standard')return false;
  const name=cobblemonName(record);
  return !query||(name+' '+(record.id||'')+' '+form).toLowerCase().includes(query);
 });
 cobblemonResults.textContent=matches.length.toLocaleString()+' entries';
 const shown=matches.slice(0,cobblemonLimit);
 cobblemonGrid.innerHTML=shown.map(record=>{
  const name=cobblemonEscape(cobblemonName(record));
  const form=cobblemonEscape(cobblemonFormName(record.form));
  const number=record.id?'#'+String(record.id).padStart(3,'0'):'Community sprite';
  const normal=cobblemonData.assetBase+record.normal;
  const shiny=record.shiny?cobblemonData.assetBase+record.shiny:null;
  return '<article class="cobblemon-card"><div class="cobblemon-card-title"><div><h3>'+name+'</h3><p>'+number+' · '+form+'</p></div></div><div class="cobblemon-sprite-pair"><figure><img loading="lazy" decoding="async" src="'+normal+'" alt="'+name+' '+form+' normal Cobblemon sprite"><figcaption>Normal</figcaption></figure><figure>'+(shiny?'<img loading="lazy" decoding="async" src="'+shiny+'" alt="'+name+' '+form+' shiny Cobblemon sprite">':'<span class="sprite-unavailable">—</span>')+'<figcaption>Shiny</figcaption></figure></div></article>';
 }).join('')||'<p class="empty-message">No sprites match that search. Try another name or form.</p>';
 const more=document.getElementById('cobblemon-more');
 more.hidden=matches.length<=cobblemonLimit;
 more.textContent='Load more · '+(matches.length-cobblemonLimit).toLocaleString()+' remaining';
}
async function loadCobblemonData(){
 try{
  const response=await fetch('cobblemon-sprites.json');
  if(!response.ok)throw Error('The sprite index could not be loaded.');
  cobblemonData=await response.json();
  document.getElementById('cobblemon-file-count').textContent=cobblemonData.spriteFileCount.toLocaleString();
  document.getElementById('cobblemon-entry-count').textContent=cobblemonData.entryCount.toLocaleString();
  document.getElementById('cobblemon-source-date').textContent=new Date(cobblemonData.sourceUpdatedAt).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
  renderCobblemon();
 }catch(error){cobblemonGrid.innerHTML='<p class="empty-message">The Cobblemon sprite archive is temporarily unavailable. Please try again later.</p>';cobblemonResults.textContent='Unavailable'}
}
window.addEventListener('pokepaper:catalog-ready',event=>{
 cobblemonSpecies=new Map((event.detail.pokemon||[]).map(species=>[species.id,species]));
 renderCobblemon();
});
cobblemonSearch.addEventListener('input',()=>{cobblemonLimit=COBBLEMON_PAGE_SIZE;renderCobblemon()});
cobblemonFormFilter.addEventListener('change',()=>{cobblemonLimit=COBBLEMON_PAGE_SIZE;renderCobblemon()});
document.getElementById('cobblemon-more').addEventListener('click',()=>{cobblemonLimit+=COBBLEMON_PAGE_SIZE;renderCobblemon()});
function setPokepaperView(view){
 const isCobblemon=view==='cobblemon';
 document.querySelector('.intro').hidden=isCobblemon;
 document.getElementById('workspace').hidden=isCobblemon;
 document.querySelector('main > footer').hidden=isCobblemon;
 document.getElementById('cobblemon-view').hidden=!isCobblemon;
 document.querySelectorAll('.topbar nav [data-view]').forEach(button=>button.classList.toggle('nav-active',button.dataset.view===view));
 if(isCobblemon)renderCobblemon();
 window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.topbar nav [data-view]').forEach(button=>button.addEventListener('click',()=>setPokepaperView(button.dataset.view)));
loadCobblemonData();
