'use strict';
// Only the prompt panel and artist-detail footer differ from v1.2.
const PromptPanel={
 t(zh,en){return I18n.lang==='en'?en:zh;},
 sync(){for(const [id,zh,en]of [['reroll','随机补充','Fill randomly'],['copy','复制提示词','Copy prompt'],['moreGenerationLabel','更多生成选项','More generation options'],['promptPreviewLabel','英文提示词','English prompt'],['advancedKeepLabel','按指定种子重现搭配','Reproduce with a specific seed'],['workspaceTitleNote','已保留词不变，其余词可随机补充。','Retained tags stay; randomly fill the rest.']])$(id).textContent=this.t(zh,en);if(!selected().length)$('chosen').innerHTML='<p class="muted">'+this.t('先从浏览区选词，或随机补充一份搭配。','Choose tags from the browser, or start with a random prompt.')+'</p>';},
 footer(){const button=$('artistFooterAdd'),detail=modalCategory==='artist-detail',a=detail?ArtistSystem.artist(ArtistSystem.detail):null;button.hidden=!a;button.parentElement.classList.toggle('artist-footer-actions',!!a);if(!a){delete button.dataset.tag;return;}const chosen=isSelected(a.tag);button.dataset.tag=a.tag;button.textContent=this.t(chosen?'取消画师 Tag':'添加画师 Tag',chosen?'Remove artist tag':'Add artist tag');button.setAttribute('aria-pressed',String(chosen));button.disabled=blacklist.has(a.tag)||!!draftRetained;$('doneModal').textContent=this.t('返回列表','Back to list');},
 init(){const button=document.createElement('button');button.id='artistFooterAdd';button.className='primary';button.hidden=true;$('doneModal').parentElement.appendChild(button);button.addEventListener('click',()=>ArtistSystem.add(ArtistSystem.detail));this.sync();this.footer();}
};
const panelRender=render,panelResult=renderResult,panelModal=renderModal,panelSettings=ArtistSystem.settingsView;
render=function(){panelRender();PromptPanel.sync();};
renderResult=function(){panelResult();PromptPanel.sync();};
renderModal=function(){panelModal();PromptPanel.footer();};
ArtistSystem.settingsView=function(){panelSettings.call(this);PromptPanel.footer();};
PromptPanel.init();
