'use strict';
// Output adapters never mutate canonical tag identities or selection state.
const ArtistModel={
 key:'simpleprompt-artist-test-model-v1',value:'raw',
 options:[['raw','通用／原始 Tag','Generic / original tag'],['nai4','NovelAI V4+','NovelAI V4+'],['nai3','NovelAI V3','NovelAI V3'],['anima','Anima','Anima'],['noob','NoobAI','NoobAI'],['illustrious','Illustrious','Illustrious']],
 format(tag,category){if(category!=='artists')return tag;if(this.value==='raw')return 'artist:'+tag;const name=tag.replaceAll('_',' ');if(this.value==='nai4'||this.value==='nai3')return 'artist:'+name;const escaped=name.replace(/([\\()[\]])/g,'\\$1');return this.value==='anima'?'@'+escaped:escaped;},
 output(tags){return tags.map(t=>this.format(t.en,t.category)).join(', ');},
 sync(){const control=$('artistModel');if(!control)return;const t=(zh,en)=>I18n.lang==='en'?en:zh;control.innerHTML=this.options.map(([id,zh,en])=>`<option value="${id}">${escapeHTML(t(zh,en))}</option>`).join('');control.value=this.value;control.disabled=!!draftRetained;control.setAttribute('aria-label',t('生图模型','Image model'));$('artistModelLabel').textContent=t('模型','Model');$('artistModelNote').textContent=this.value==='raw'?'':t('仅转换画师写法；模型对画师的识别效果可能不同。','Artist syntax only; artist recognition varies by model.');},
 set(value){if(!this.options.some(o=>o[0]===value))return;this.value=value;try{localStorage.setItem(this.key,value);}catch{}renderResult();},
 init(){try{const v=localStorage.getItem(this.key);if(this.options.some(o=>o[0]===v))this.value=v;}catch{}$('artistModel').addEventListener('change',e=>this.set(e.target.value));renderResult();}
};
const modelOriginalResult=renderResult;
renderResult=function(){modelOriginalResult();$('output').value=ArtistModel.output(selected());ArtistModel.sync();};
ArtistModel.init();
