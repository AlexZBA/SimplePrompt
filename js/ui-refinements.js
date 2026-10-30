'use strict';
// Position the browsing action within its own pane, above mobile navigation.
const UIRefinements={
 sync(){const button=$('artistReshuffle'),catalog=$('catalog');button.hidden=ArtistSystem.mode!=='artists'||ArtistCatalog.sort!=='shuffle'||!!draftRetained||(MobileUI.compact()&&MobileUI.page==='result');if(button.hidden)return;const rect=catalog.getBoundingClientRect();button.style.left=Math.max(rect.left+12,rect.right-66)+'px';button.style.top=Math.max(rect.top+12,rect.bottom-68)+'px';},
 init(){const artistRender=ArtistSystem.render,nav=MobileUI.syncNav;ArtistSystem.render=function(){artistRender.call(this);UIRefinements.sync();};MobileUI.syncNav=function(){nav.call(this);UIRefinements.sync();};window.addEventListener('resize',()=>this.sync());this.sync();}
};
UIRefinements.init();
